/**
 * Подставка для тестов ядра: настоящий Postgres, один мир на тест.
 * Миры разделены по world_id, поэтому тесты не мешают друг другу.
 */

import { randomUUID } from "node:crypto";
import { buildRegistry, type ActorFacts, type ModuleDefinition, type ModuleRegistry, type PatchOp, type ReportRow, type TileRef } from "@tdl/kernel";
import { modules as buildModules } from "@tdl/modules";
import { applyKernelMigrations, applyModuleMigrations, ensureWorld, syncModuleStates } from "../src/db/bootstrap.js";
import { createDb, type Db } from "../src/db/index.js";
import { loadConfig, type HostConfig } from "../src/config.js";
import { createJournal, type JournalRecord } from "../src/logger.js";
import { WorldService, type ViewSink } from "../src/world/service.js";
import type { WorldRow } from "../src/db/schema.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";

export interface SinkRecord {
  kind: "patch" | "tiles" | "clan" | "error" | "report";
  actorId: string;
  ops?: PatchOp[];
  tiles?: TileRef[];
  key?: string;
  reportKind?: string;
  rows?: ReportRow[];
  serverNow?: number;
}

/**
 * Рассылка в тесте: копит, кому и что ушло, и передаёт дальше, если задан
 * получатель. Так проверяется и содержимое, и настоящий сокет.
 */
export class TestSink implements ViewSink {
  readonly records: SinkRecord[] = [];

  constructor(private readonly delegate?: ViewSink) {}

  patch(actorId: string, ops: PatchOp[], serverNow: number): void {
    this.records.push({ kind: "patch", actorId, ops, serverNow });
    this.delegate?.patch(actorId, ops, serverNow);
  }

  tiles(tiles: TileRef[], ops: PatchOp[], serverNow: number, actorId: string): void {
    this.records.push({ kind: "tiles", actorId, ops, tiles, serverNow });
    this.delegate?.tiles(tiles, ops, serverNow, actorId);
  }

  clan(clanId: string, ops: PatchOp[], serverNow: number): void {
    this.records.push({ kind: "clan", actorId: clanId, ops, serverNow });
    this.delegate?.clan(clanId, ops, serverNow);
  }

  error(actorId: string, key: string, params?: Record<string, string | number>): void {
    this.records.push({ kind: "error", actorId, key });
    this.delegate?.error(actorId, key, params);
  }

  report(actorId: string, kind: string, rows: ReportRow[], serverNow: number): void {
    this.records.push({ kind: "report", actorId, reportKind: kind, rows, serverNow });
    this.delegate?.report(actorId, kind, rows, serverNow);
  }

  patchesFor(actorId: string): PatchOp[] {
    return this.records.filter((record) => record.kind === "patch" && record.actorId === actorId).flatMap((record) => record.ops ?? []);
  }

  reports(actorId?: string): SinkRecord[] {
    return this.records.filter((record) => record.kind === "report" && (actorId === undefined || record.actorId === actorId));
  }
}

export interface TestWorldOptions {
  /** Дополнительные модули к сборке: проверка края контракта. */
  extraModules?: ModuleDefinition[];
  /** Модули, которых в сборке быть не должно. */
  withoutProbe?: boolean;
  size?: number;
  /** Настоящий получатель: TestSink записывает и передаёт дальше. */
  sink?: ViewSink;
  /** Срок годности очереди: по умолчанию как у мира. */
  queueWaitMs?: number;
}

export interface TestWorld {
  id: string;
  db: Db;
  config: HostConfig;
  world: WorldRow;
  registry: ModuleRegistry;
  service: WorldService;
  sink: TestSink;
  records: JournalRecord[];
  actor(id?: string): ActorFacts;
  close(): Promise<void>;
}

export function testRegistry(options: TestWorldOptions = {}): ModuleRegistry {
  const list = options.withoutProbe ? [] : [...buildModules];
  return buildRegistry([...list, ...(options.extraModules ?? [])]);
}

export async function createTestWorld(options: TestWorldOptions = {}): Promise<TestWorld> {
  const url = readTestDbUrl("host");
  if (!url) throw new Error("адрес тестовой базы не найден: запустите тесты пакета, а не файл напрямую");
  const id = `test-${randomUUID().slice(0, 12)}`;
  const records: JournalRecord[] = [];
  const journal = createJournal((record) => records.push(record));
  const config = loadConfig({
    DATABASE_URL: url,
    WORLD_ID: id,
    WORLD_NAME: `мир ${id}`,
    WORLD_SEED: "7",
    WORLD_SIZE: String(options.size ?? 64),
    SESSION_SECRET: "test-secret-0123456789",
    REGISTRATION_OPEN: "1",
    NODE_ENV: "test",
  });
  const db = createDb(url);
  await applyKernelMigrations(db, journal);
  const registry = testRegistry(options);
  const world = await ensureWorld(db, config, journal);
  await syncModuleStates(db, registry, world.id);
  await applyModuleMigrations(db, registry, world.id, journal);
  const sink = new TestSink(options.sink);
  const service = await WorldService.open({
    db,
    journal,
    registry,
    world,
    sink,
    processId: `test-${randomUUID().slice(0, 6)}`,
    stepBudgetMs: 2_000,
    queueWaitMs: options.queueWaitMs,
  });
  return {
    id,
    db,
    config,
    world,
    registry,
    service,
    sink,
    records,
    actor: (actorId = `lord-${randomUUID().slice(0, 8)}`): ActorFacts => ({
      id: actorId,
      worldId: id,
      name: actorId,
      clanId: null,
      isBot: false,
      type: "bone",
    }),
    close: async () => {
      await service.stop();
      await db.close();
    },
  };
}

/** Команда с проходом писателя: так же, как это делает сокет. */
export async function runCommand(
  world: TestWorld,
  actor: ActorFacts,
  commandId: string,
  payload: Record<string, unknown> = {},
  idempotencyKey = `${commandId}:${randomUUID()}`,
  requestId = `req-${randomUUID().slice(0, 8)}`,
): Promise<{ status: string; key?: string; repeat?: boolean; reload(): Promise<void> }> {
  const pending = world.service.submitCommand({ actor, commandId, payload, requestId, idempotencyKey });
  await world.service.pumpOnce();
  const outcome = await pending;
  return {
    status: outcome.status,
    ...(outcome.status === "error" ? { key: outcome.key } : { repeat: outcome.repeat }),
    reload: async () => {
      await world.service.pumpOnce();
    },
  };
}

/** Сколько сроков уже наступило и ещё не проведено. */
export async function dueCount(world: TestWorld): Promise<number> {
  const rows = await world.db.pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM deadlines WHERE world_id = $1 AND wake_at_ms <= $2`,
    [world.id, world.service.now()],
  );
  return Number(rows.rows[0]?.n ?? 0);
}

/**
 * Гоняет проходы писателя, пока есть работа. Один проход ограничен бюджетом
 * (сроки — не дольше 50 мс), поэтому «провести всё» — это несколько проходов.
 */
export async function drain(
  world: TestWorld,
  options: { maxMs?: number; until?: () => boolean; limit?: number } = {},
): Promise<number> {
  const maxMs = options.maxMs ?? 20_000;
  const startedAt = Date.now();
  let steps = 0;
  for (;;) {
    const due = await dueCount(world);
    const pending = world.service.pending;
    if (pending === 0 && due === 0) break;
    if (Date.now() - startedAt > maxMs) {
      throw new Error(`проходы не закончились за ${maxMs} мс: в очереди ${pending}, сроков ${due}`);
    }
    if (options.limit !== undefined && steps >= options.limit) break;
    await world.service.pumpOnce();
    steps += 1;
  }
  if (options.until && !options.until()) throw new Error("условие прогона не выполнено");
  return steps;
}

export async function stockOf(world: TestWorld, holderId: string): Promise<Record<string, number>> {
  const rows = await world.db.pool.query<{ resource_id: string; amount: string }>(
    `SELECT resource_id, amount FROM stock WHERE world_id = $1 AND holder_id = $2`,
    [world.id, holderId],
  );
  const stock: Record<string, number> = {};
  for (const row of rows.rows) stock[row.resource_id] = Number(row.amount);
  return stock;
}

export async function deadlinesOf(world: TestWorld, owner?: string): Promise<{ id: string; owner: string; wakeAt: number; key: string }[]> {
  const rows = await world.db.pool.query<{ id: string; owner: string; wake_at_ms: string; key: string }>(
    owner
      ? `SELECT id, owner, wake_at_ms, key FROM deadlines WHERE world_id = $1 AND owner = $2 ORDER BY id`
      : `SELECT id, owner, wake_at_ms, key FROM deadlines WHERE world_id = $1 ORDER BY id`,
    owner ? [world.id, owner] : [world.id],
  );
  return rows.rows.map((row) => ({ id: row.id, owner: row.owner, wakeAt: Number(row.wake_at_ms), key: row.key }));
}

export async function countRows(world: TestWorld, table: string, where = "1 = 1"): Promise<number> {
  const rows = await world.db.pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE world_id = $1 AND ${where}`,
    [world.id],
  );
  return Number(rows.rows[0]?.count ?? 0);
}

export async function simRows(world: TestWorld, reason?: string): Promise<{ reason: string; claimed: unknown; computed: unknown }[]> {
  const rows = await world.db.pool.query<{ reason: string; claimed: unknown; computed: unknown }>(
    reason
      ? `SELECT reason, claimed, computed FROM sim_rejections WHERE world_id = $1 AND reason = $2 ORDER BY id`
      : `SELECT reason, claimed, computed FROM sim_rejections WHERE world_id = $1 ORDER BY id`,
    reason ? [world.id, reason] : [world.id],
  );
  return rows.rows;
}
