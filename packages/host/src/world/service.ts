/**
 * Писатель мира. Ядро вызывает модуль только по команде или по наступившему
 * сроку, собирает снимок и применяет эффекты одной транзакцией.
 * Второго писателя на мир быть не может: право писателя — эпоха в базе.
 */

import {
  modulateDetailed,
  normalizeLimit,
  type ActorFacts,
  type CommandDecl,
  type CommandContext,
  type DeadlineContext,
  type DeadlineRow,
  type HandlerBase,
  type JsonObject,
  type JsonValue,
  type ModuleDefinition,
  type ModuleId,
  type ModuleState,
  type ModifierInput,
  type ModifierSource,
  type Phase,
  type ReportRow,
  type ResourceDecl,
  type ResourceId,
  type Effect,
  type StockSnapshot,
  type TileRef,
} from "@tdl/kernel";
import { KERNEL_KEYS } from "@tdl/protocol";
import type { PoolClient } from "pg";
import { CommandRejected, StaleWriter, type Db } from "../db/index.js";
import type { Journal } from "../logger.js";
import {
  applyEffects,
  tilesOfPatches,
  type AppliedPatch,
  type AppliedReport,
  type ApplyResult,
  type SimFact,
} from "./effects.js";
import { createModuleStore } from "./store.js";
import { WorldClock } from "./clock.js";
import type { WorldRow } from "../db/schema.js";

export interface ViewSink {
  patch(actorId: string, ops: AppliedPatch["ops"], serverNow: number): void;
  tiles(tiles: TileRef[], ops: AppliedPatch["ops"], serverNow: number, actorId: string): void;
  clan(clanId: string, ops: AppliedPatch["ops"], serverNow: number): void;
  error(actorId: string, key: string, params?: Record<string, string | number>): void;
  report(actorId: string, kind: string, rows: ReportRow[], serverNow: number): void;
}

export type CommandOutcome =
  | { status: "ok"; repeat: boolean }
  | { status: "error"; key: string; params?: Record<string, string | number> };

interface QueuedCommand {
  actor: ActorFacts;
  commandId: string;
  payload: unknown;
  requestId: string;
  idempotencyKey: string;
  resolve(outcome: CommandOutcome): void;
}

/** Сколько наступивших сроков берётся одним запросом. */
const DEADLINE_BATCH = 32;

/** После стольких ошибок срок снимается: сломанный модуль не держит писателя. */
const MAX_DEADLINE_ATTEMPTS = 5;

interface TxContext {
  client: PoolClient;
}

export interface ActorProfile {
  portrait: string;
  bannerSign: string;
  bannerColor: string;
  type: string;
}

export interface ServiceOptions {
  db: Db;
  /** Портрет, знамя и тип лорда: лежат во внешней базе, не в снимке шага. */
  profileOf?: (actorId: string) => Promise<ActorProfile | null>;
  journal: Journal;
  registry: { order: readonly ModuleId[]; byId: ReadonlyMap<ModuleId, ModuleDefinition> };
  world: WorldRow;
  sink: ViewSink;
  processId: string;
  /** Пакет сроков не держит цикл дольше 50 мс. */
  stepBudgetMs?: number;
  pulseIntervalMs?: number;
  now?: () => number;
}

interface PreparedFacts {
  factsByModule: Record<ModuleId, Record<string, number>>;
  stock: StockSnapshot;
}

export class WorldService {
  readonly worldId: string;
  private readonly db: Db;
  private readonly journal: Journal;
  private readonly order: readonly ModuleId[];
  private readonly byId: ReadonlyMap<ModuleId, ModuleDefinition>;
  private readonly sink: ViewSink;
  private readonly processId: string;
  private readonly profileOf?: (actorId: string) => Promise<ActorProfile | null>;
  private readonly stepBudgetMs: number;
  private readonly pulseIntervalMs: number;

  private readonly moduleStates = new Map<ModuleId, ModuleState>();
  private readonly queue: QueuedCommand[] = [];
  private readonly factsCache = new Map<string, PreparedFacts>();
  private readonly snapshots = new Map<string, JsonValue>();

  private world: WorldRow;
  private clockValue: WorldClock;
  private epoch = 0;
  private pumping = false;
  private stopped = false;
  /** Сбой шага: сколько раз подряд и до какого времени держим паузу. */
  private stepFailures = 0;
  private quietUntilMs = 0;
  /** Право писателя ушло другому процессу: этот выходит. */
  private leaseLost = false;
  private timer: NodeJS.Timeout | null = null;
  private pulseTimer: NodeJS.Timeout | null = null;
  private lastRejections = 0;

  constructor(options: ServiceOptions) {
    this.db = options.db;
    this.journal = options.journal;
    this.order = options.registry.order;
    this.byId = options.registry.byId;
    this.sink = options.sink;
    this.processId = options.processId;
    this.profileOf = options.profileOf;
    this.stepBudgetMs = options.stepBudgetMs ?? 50;
    this.pulseIntervalMs = options.pulseIntervalMs ?? 10_000;
    this.world = options.world;
    this.worldId = options.world.id;
    this.clockValue = new WorldClock({ offsetMs: options.world.clockOffsetMs, lastWorldAtMs: options.now?.() ?? Date.now() });
  }

  /** Подъём мира: право писателя, простой, модули, наступившие сроки. */
  static async open(options: ServiceOptions): Promise<WorldService> {
    const service = new WorldService(options);
    await service.reloadModuleStates();
    await service.takeLease();
    await service.applyDowntime();
    await service.drainDeadlines();
    return service;
  }

  /** Приём команд открывается только после подъёма: сроки уже проведены. */
  start(): void {
    if (this.stopped || this.timer) return;
    this.timer = setInterval(() => void this.pump(), 20);
    this.pulseTimer = setInterval(() => void this.writePulse().catch((error) => this.onFatal(error)), this.pulseIntervalMs);
    void this.pump();
  }

  /**
   * Плановая остановка: приём команд закрывается, текущая запись заканчивается,
   * пульс пишется в момент остановки. Дыра равна нулю.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.timer = null;
    this.pulseTimer = null;
    // Ждём текущий проход, чтобы запись закончилась сама.
    while (this.pumping) await new Promise((resolve) => setTimeout(resolve, 10));
    this.failPending();
    await this.writePulse().catch((error) => this.journal.write({ channel: "app", event: "pulse.failed", detail: String(error) }));
  }

  /** Сколько команд ждёт прохода: нужно порту для ответа о нагрузке. */
  get pending(): number {
    return this.queue.length;
  }

  /** Право писателя потеряно: процесс обязан выйти, писать ему нельзя. */
  get lostLease(): boolean {
    return this.leaseLost;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  get worldFactsSnapshot(): WorldRow {
    return this.world;
  }

  stats(): { epoch: number; pending: number; rejections: number; failures: number; modulesEnabled: number } {
    return {
      epoch: this.epoch,
      pending: this.queue.length,
      rejections: this.lastRejections,
      failures: this.stepFailures,
      modulesEnabled: [...this.moduleStates.values()].filter((state) => state === "enabled").length,
    };
  }

  /** Команда игрока встаёт в очередь писателя и обрабатывается в порядке прихода. */
  submitCommand(input: {
    actor: ActorFacts;
    commandId: string;
    payload: unknown;
    requestId: string;
    idempotencyKey: string;
  }): Promise<CommandOutcome> {
    if (this.stopped) return Promise.resolve({ status: "error", key: KERNEL_KEYS.generic });
    return new Promise((resolve) => {
      this.queue.push({ ...input, resolve });
    });
  }

  // --- модули -------------------------------------------------------------

  /**
   * Переключатель модуля. Единственный путь смены состояния снаружи:
   * кэш писателя и база меняются вместе, иначе модуль остался бы включённым
   * в памяти до следующего подъёма.
   */
  async setModuleState(moduleId: ModuleId, state: ModuleState): Promise<void> {
    if (!this.byId.has(moduleId)) throw new Error(`модуль ${moduleId} не в сборке`);
    const value = state === "disabled" ? "disabled" : "enabled";
    await this.tx(async ({ client }) => {
      await client.query(
        `INSERT INTO module_states (world_id, module_id, state, version)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (world_id, module_id) DO UPDATE SET state = EXCLUDED.state`,
        [this.worldId, moduleId, value],
      );
    });
    this.moduleStates.set(moduleId, value);
    this.clearCaches();
    this.journal.write({ channel: "app", worldId: this.worldId, event: `module.${value}`, detail: moduleId });
  }

  private async reloadModuleStates(): Promise<void> {
    this.moduleStates.clear();
    const rows = await this.db.pool.query<{ module_id: string; state: string }>(
      `SELECT module_id, state FROM module_states WHERE world_id = $1`,
      [this.worldId],
    );
    for (const row of rows.rows) {
      this.moduleStates.set(row.module_id, row.state === "disabled" ? "disabled" : "enabled");
    }
  }

  private enabled(): ModuleDefinition[] {
    const list: ModuleDefinition[] = [];
    for (const id of this.order) {
      const def = this.byId.get(id);
      if (!def) continue;
      if (this.moduleStates.get(id) === "disabled") continue;
      list.push(def);
    }
    return list;
  }

  /** Таблицы модуля: во чужие ядро писать не даёт. */
  private tablesOf(moduleId: ModuleId): ReadonlySet<string> {
    const def = this.byId.get(moduleId);
    return new Set(def?.server?.tables ?? []);
  }

  private modifierSources(): ModifierSource[] {
    return this.enabled().map((def) => ({ moduleId: def.id, modifiers: def.rules?.modifiers ?? [] }));
  }

  /** Открытые модули: клиент по этому списку решает, какие гнёзда заполнены. */
  openModuleIds(): ModuleId[] {
    return this.enabled().map((def) => def.id);
  }

  /** Ресурсы, объявленные включёнными модулями. Отдельной колонки в ядре нет. */
  declaredResources(): ResourceDecl[] {
    const seen = new Map<ResourceId, ResourceDecl>();
    for (const def of this.enabled()) {
      for (const resource of def.rules?.resources ?? []) seen.set(resource.id, resource);
    }
    return [...seen.values()];
  }

  // --- мир ----------------------------------------------------------------

  private worldFacts(now: number) {
    return {
      id: this.world.id,
      name: this.world.name,
      seed: this.world.seed,
      size: this.world.size,
      zones: this.world.zones,
      zonePit: this.world.zonePit,
      zoneCapital: this.world.zoneCapital,
      now,
      downtimeMs: this.clockValue.offset,
    };
  }

  now(): number {
    return this.clockValue.now();
  }

  private async takeLease(): Promise<void> {
    const result = await this.db.pool.query<{ epoch: string }>(
      `INSERT INTO writer_leases (world_id, epoch, holder, heartbeat_at)
       VALUES ($1, 1, $2, now())
       ON CONFLICT (world_id) DO UPDATE SET
         epoch = writer_leases.epoch + 1,
         holder = EXCLUDED.holder,
         heartbeat_at = now()
       RETURNING epoch`,
      [this.worldId, this.processId],
    );
    this.epoch = Number(result.rows[0]?.epoch ?? 1);
    this.journal.write({
      channel: "app",
      worldId: this.worldId,
      event: "writer.take",
      detail: { epoch: this.epoch, holder: this.processId },
    });
  }

  private async applyDowntime(): Promise<void> {
    const pulse = await this.db.pool.query<{ real_at_ms: string; world_at_ms: string }>(
      `SELECT real_at_ms, world_at_ms FROM world_pulse WHERE world_id = $1`,
      [this.worldId],
    );
    const row = pulse.rows[0];
    const nowReal = Date.now();
    if (row) {
      const downtime = Math.max(0, nowReal - Number(row.real_at_ms));
      this.clockValue = new WorldClock({ offsetMs: this.world.clockOffsetMs, lastWorldAtMs: Number(row.world_at_ms) });
      this.clockValue.applyDowntime(downtime);
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "world.resume",
        detail: { downtimeMs: downtime, worldAt: this.clockValue.now() },
      });
    } else {
      this.clockValue = new WorldClock({ offsetMs: this.world.clockOffsetMs, lastWorldAtMs: nowReal });
    }
    this.world = { ...this.world, clockOffsetMs: this.clockValue.offset };
    await this.db.pool.query(`UPDATE worlds SET clock_offset_ms = $2 WHERE world_id = $1`, [
      this.worldId,
      this.clockValue.offset,
    ]);
    await this.writePulse();
  }

  /**
   * Пульс пишется в транзакции с проверкой права: старый процесс не имеет
   * права сдвинуть пульс, иначе простой следующего подъёма посчитается неверно.
   */
  private async writePulse(): Promise<void> {
    const worldAt = this.clockValue.now();
    await this.tx(async ({ client }) => {
      await client.query(
        `INSERT INTO world_pulse (world_id, real_at_ms, world_at_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (world_id) DO UPDATE SET real_at_ms = EXCLUDED.real_at_ms, world_at_ms = EXCLUDED.world_at_ms`,
        [this.worldId, Date.now(), worldAt],
      );
      await client.query(`UPDATE writer_leases SET heartbeat_at = now() WHERE world_id = $1 AND epoch = $2`, [
        this.worldId,
        this.epoch,
      ]);
    });
  }

  // --- транзакция ---------------------------------------------------------

  /**
   * Одна транзакция шага. Право писателя проверяется в начале под блокировкой:
   * старый процесс после подъёма нового писать не может.
   */
  private async tx<T>(run: (ctx: TxContext) => Promise<T>): Promise<T> {
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const lease = await client.query<{ epoch: string; holder: string }>(
        `SELECT epoch, holder FROM writer_leases WHERE world_id = $1 FOR UPDATE`,
        [this.worldId],
      );
      const row = lease.rows[0];
      if (!row || Number(row.epoch) !== this.epoch || row.holder !== this.processId) {
        throw new StaleWriter(this.worldId);
      }
      const result = await run({ client });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Соединение уже мертво: откат не нужен.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private onFatal(error: unknown): void {
    if (error instanceof StaleWriter) {
      this.leaseLost = true;
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      if (this.pulseTimer) clearInterval(this.pulseTimer);
      this.timer = null;
      this.pulseTimer = null;
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        event: "writer.lost",
        detail: { epoch: this.epoch, holder: this.processId },
      });
      this.failPending();
      return;
    }
    // Сбой базы не должен превращаться в поток записей: пауза растёт, журнал не частит.
    this.stepFailures += 1;
    this.quietUntilMs = Date.now() + this.backoffMs();
    if (this.stepFailures === 1 || this.stepFailures % 20 === 0) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "world.error",
        detail: { failures: this.stepFailures, error: String(error) },
      });
    }
  }

  /** Пауза после сбоя: 25 мс, 50, 100… не больше пяти секунд. */
  private backoffMs(): number {
    const step = Math.min(this.stepFailures, 8);
    return Math.min(5_000, 25 * 2 ** step);
  }

  /** Очередь не висит: команда без ответа не должна ждать вечно. */
  private failPending(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.resolve({ status: "error", key: KERNEL_KEYS.generic });
    }
  }

  // --- снимок и факты -----------------------------------------------------

  private async stockOf(holderId: string, client?: PoolClient): Promise<StockSnapshot> {
    const rows = await (client ?? this.db.pool).query<{ resource_id: string; amount: string }>(
      `SELECT resource_id, amount FROM stock WHERE world_id = $1 AND holder_id = $2`,
      [this.worldId, holderId],
    );
    const stock: Record<ResourceId, number> = {};
    for (const resource of this.declaredResources()) stock[resource.id] = 0;
    for (const row of rows.rows) stock[row.resource_id] = Number(row.amount);
    return stock;
  }

  private syntheticActor(holderId: string): ActorFacts {
    return { id: holderId, worldId: this.worldId, name: "", clanId: null, isBot: false };
  }

  /** Снимок модуля: читает свои таблицы, чужих не видит. */
  private async snapshotFor(moduleId: ModuleId, actor: ActorFacts | null, client?: PoolClient): Promise<JsonValue> {
    const key = `${moduleId}|${actor?.id ?? "-"}`;
    const cached = this.snapshots.get(key);
    if (cached !== undefined) return cached;
    const def = this.byId.get(moduleId);
    if (!def?.server?.snapshot) {
      this.snapshots.set(key, null);
      return null;
    }
    const store = createModuleStore(client ?? this.db.pool, this.worldId, moduleId);
    const reader = async (): Promise<DeadlineRow[]> => {
      const rows = await (client ?? this.db.pool).query<{
        id: string;
        owner: string;
        wake_at_ms: string;
        key: string;
        payload: JsonValue | null;
      }>(
        `SELECT id, owner, wake_at_ms, key, payload FROM deadlines
         WHERE world_id = $1 AND owner = $2 ORDER BY wake_at_ms ASC`,
        [this.worldId, moduleId],
      );
      return rows.rows.map((row) => ({
        id: row.id,
        owner: row.owner,
        wakeAt: Number(row.wake_at_ms),
        key: row.key,
        payload: row.payload,
      }));
    };
    try {
      const state = await def.server.snapshot({
        world: this.worldFacts(this.now()),
        actor,
        now: this.now(),
        store,
        deadlines: reader,
      });
      const value = (state ?? null) as JsonValue;
      this.snapshots.set(key, value);
      return value;
    } catch (error) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId,
        event: "module.snapshot.failed",
        detail: String(error),
      });
      this.snapshots.set(key, null);
      return null;
    }
  }

  /**
   * Факты модулей для расчёта модификаторов: каждый модуль видит только свои.
   * Склад читается свежим всегда: снимок склада в памяти устаревает за шаг.
   */
  private async factsFor(holderId: string, client?: PoolClient): Promise<PreparedFacts> {
    const cached = this.factsCache.get(holderId);
    const stock = await this.stockOf(holderId, client);
    if (cached) return { factsByModule: cached.factsByModule, stock };
    const actor = holderId === "world" ? null : this.syntheticActor(holderId);
    const factsByModule: Record<ModuleId, Record<string, number>> = {};
    for (const def of this.enabled()) {
      const state = await this.snapshotFor(def.id, actor, client);
      const row: Record<string, number> = {};
      for (const [factKey, resolver] of Object.entries(def.server?.facts ?? {})) {
        try {
          const value = resolver(state, {
            world: this.worldFacts(this.now()),
            actor,
            stock,
            state,
            now: this.now(),
          });
          if (Number.isFinite(value)) row[factKey] = value;
        } catch (error) {
          this.journal.write({
            channel: "app",
            worldId: this.worldId,
            moduleId: def.id,
            event: "module.fact.failed",
            detail: String(error),
          });
        }
      }
      factsByModule[def.id] = row;
    }
    const prepared: PreparedFacts = { factsByModule, stock };
    this.factsCache.set(holderId, prepared);
    return prepared;
  }

  private clearCaches(): void {
    this.factsCache.clear();
    this.snapshots.clear();
  }

  private moderation(holderId: string, prepared: PreparedFacts) {
    return {
      modulate: (phase: Phase, base: number, input: ModifierInput = {}): number => {
        return modulateDetailed({
          phase,
          base,
          input,
          sources: this.modifierSources(),
          env: {
            world: this.worldFacts(this.now()),
            actor: holderId === "world" ? undefined : this.syntheticActor(holderId),
            stock: prepared.stock,
            factsByModule: prepared.factsByModule,
          },
        }).value;
      },
      modulateDetailed: (phase: Phase, base: number, input: ModifierInput = {}) =>
        modulateDetailed({
          phase,
          base,
          input,
          sources: this.modifierSources(),
          env: {
            world: this.worldFacts(this.now()),
            actor: holderId === "world" ? undefined : this.syntheticActor(holderId),
            stock: prepared.stock,
            factsByModule: prepared.factsByModule,
          },
        }),
    };
  }

  /**
   * Предел склада. Двор считается по своим фактам: чужой двор получает
   * свой предел, а не предел действующего. Нет фактов — читаем и считаем.
   */
  private async limitFor(
    holderId: string,
    resource: ResourceId,
    client?: PoolClient,
  ): Promise<number | null> {
    const holder = holderId;
    const facts = this.factsCache.get(holder) ?? (await this.factsFor(holder, client));
      const details = modulateDetailed({
        phase: "limit",
        base: 0,
        input: { resource, subject: "court" },
        sources: this.modifierSources(),
        env: {
          world: this.worldFacts(this.now()),
          actor: holder === "world" ? undefined : this.syntheticActor(holder),
          stock: facts.stock,
          factsByModule: facts.factsByModule,
        },
    });
    if (details.parts.length === 0) return null;
    return normalizeLimit(details.value);
  }

  private async handlerBase(
    moduleId: ModuleId,
    actor: ActorFacts | null,
    meta: { requestId: string; idempotencyKey: string; client?: PoolClient },
  ): Promise<HandlerBase> {
    const holderId = actor?.id ?? "world";
    const prepared = await this.factsFor(holderId, meta.client);
    const facts = prepared.factsByModule[moduleId] ?? {};
    const state = await this.snapshotFor(moduleId, actor, meta.client);
    const store = createModuleStore(meta.client ?? this.db.pool, this.worldId, moduleId);
    const deadlines = async (): Promise<DeadlineRow[]> => {
      const rows = await (meta.client ?? this.db.pool).query<{
        id: string;
        owner: string;
        wake_at_ms: string;
        key: string;
        payload: JsonValue | null;
      }>(
        `SELECT id, owner, wake_at_ms, key, payload FROM deadlines WHERE world_id = $1 AND owner = $2 ORDER BY wake_at_ms ASC`,
        [this.worldId, moduleId],
      );
      return rows.rows.map((row) => ({
        id: row.id,
        owner: row.owner,
        wakeAt: Number(row.wake_at_ms),
        key: row.key,
        payload: row.payload,
      }));
    };
    const modulation = this.moderation(holderId, prepared);
    return {
      world: this.worldFacts(this.now()),
      actor,
      now: this.now(),
      requestId: meta.requestId,
      idempotencyKey: meta.idempotencyKey,
      stock: prepared.stock,
      state,
      facts,
      store,
      deadlines,
      modulate: modulation.modulate,
      modulateDetailed: modulation.modulateDetailed,
    };
  }

  // --- проход писателя ----------------------------------------------------

  /** Один проход вручную: такты, тесты и служебные команды. */
  async pumpOnce(): Promise<void> {
    await this.pump();
  }

  private async pump(): Promise<void> {
    if (this.stopped || this.pumping || Date.now() < this.quietUntilMs) return;
    this.pumping = true;
    this.clearCaches();
    try {
      const deadlineAt = performance.now() + this.stepBudgetMs;
      while (!this.stopped && performance.now() < deadlineAt) {
        const batch = await this.fetchDue(DEADLINE_BATCH);
        if (batch.length === 0) break;
        let worked = false;
        for (const row of batch) {
          if (this.stopped || performance.now() >= deadlineAt) break;
          await this.runDeadline(row);
          worked = true;
          // Снимок, собранный до эффектов, устаревает за один шаг.
          this.clearCaches();
        }
        if (!worked) break;
      }
      while (!this.stopped && this.queue.length > 0 && performance.now() < deadlineAt) {
        const next = this.queue.shift();
        if (!next) break;
        try {
          next.resolve(await this.runCommand(next));
        } catch (error) {
          // Команда уже снята с очереди: ответ ей всё равно нужен.
          next.resolve({ status: "error", key: KERNEL_KEYS.generic });
          throw error;
        }
        this.clearCaches();
      }
      this.stepFailures = 0;
      this.quietUntilMs = 0;
    } catch (error) {
      this.onFatal(error);
    } finally {
      this.pumping = false;
    }
  }

  /** Наступившие сроки проводятся до приёма команд. */
  private async drainDeadlines(): Promise<void> {
    this.clearCaches();
    const startedAt = performance.now();
    let taken = 0;
    for (;;) {
      const batch = await this.fetchDue(DEADLINE_BATCH);
      if (batch.length === 0) break;
      for (const row of batch) {
        await this.runDeadline(row);
        this.clearCaches();
        taken += 1;
      }
      if (performance.now() - startedAt > 30_000) {
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          event: "deadlines.drain.slow",
          detail: { taken },
        });
        break;
      }
    }
    if (taken > 0) {
      this.journal.write({ channel: "app", worldId: this.worldId, event: "deadlines.drained", detail: { taken } });
    }
  }

  private async fetchDue(limit: number): Promise<DeadlineRow[]> {
    const owners = this.enabled().map((def) => def.id);
    if (owners.length === 0) return [];
    const rows = await this.db.pool.query<{
      id: string;
      owner: string;
      wake_at_ms: string;
      key: string;
      payload: JsonValue | null;
    }>(
      `SELECT id, owner, wake_at_ms, key, payload FROM deadlines
       WHERE world_id = $1 AND wake_at_ms <= $2 AND owner = ANY($3)
       ORDER BY wake_at_ms ASC, id ASC
       LIMIT $4`,
      [this.worldId, this.clockValue.now(), owners, limit],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      owner: row.owner,
      wakeAt: Number(row.wake_at_ms),
      key: row.key,
      payload: row.payload,
    }));
  }

  /**
   * Один срок. Строка удаляется в той же транзакции, что и эффекты:
   * повторный проход не создаёт второе событие.
   */
  private async runDeadline(row: DeadlineRow): Promise<void> {
    const def = this.byId.get(row.owner);
    if (!def || !def.onDeadline) {
      await this.tx(async ({ client }) => {
        await client.query(`DELETE FROM deadlines WHERE world_id = $1 AND id = $2 AND wake_at_ms = $3`, [
          this.worldId,
          row.id,
          row.wakeAt,
        ]);
        await client.query(
          `INSERT INTO sim_rejections (world_id, module_id, deadline_id, reason) VALUES ($1, $2, $3, $4)`,
          [this.worldId, row.owner, row.id, "deadline.owner.missing"],
        );
      });
      return;
    }
    let postCommit: ApplyResult | null = null;
    const simFacts: SimFact[] = [];
    try {
      await this.tx(async ({ client }) => {
        const deleted = await client.query<{ id: string }>(
          `DELETE FROM deadlines WHERE world_id = $1 AND id = $2 AND wake_at_ms = $3 RETURNING id`,
          [this.worldId, row.id, row.wakeAt],
        );
        if (deleted.rowCount === 0) return;
        const base = await this.handlerBase(def.id, null, {
          requestId: `deadline:${row.id}`,
          idempotencyKey: row.key,
          client,
        });
        const ctx: DeadlineContext = { ...base, deadline: row };
        const effects = await def.onDeadline?.(ctx);
        const applied = await this.applyInTx(client, def.id, null, effects ?? [], {
          requestId: `deadline:${row.id}`,
          idempotencyKey: row.key,
          commandId: null,
          holderId: "world",
          simFacts,
        });
        postCommit = applied;
      });
      if (postCommit) await this.publish(postCommit, null);
    } catch (error) {
      if (error instanceof StaleWriter) throw error;
      const refused = error instanceof CommandRejected;
      const attempts = await this.countAttempt(row.id);
      // Модуль отказал — строка снимается. Ошибка модуля — строка пробуется
      // снова, но не бесконечно: иначе один сломанный срок держит писателя.
      const abandon = !refused && attempts >= MAX_DEADLINE_ATTEMPTS;
      const reason = refused ? "deadline.refused" : abandon ? "deadline.abandoned" : "deadline.failed";
      this.journal.write({
        channel: refused || abandon ? "sim" : "app",
        worldId: this.worldId,
        moduleId: def.id,
        event: reason,
        detail: { message: String(error instanceof Error ? error.message : error), attempts },
      });
      try {
        await this.tx(async ({ client }) => {
          if (refused || abandon) {
            await client.query(`DELETE FROM deadlines WHERE world_id = $1 AND id = $2`, [this.worldId, row.id]);
          } else {
            await client.query(`UPDATE deadlines SET attempts = attempts + 1 WHERE world_id = $1 AND id = $2`, [
              this.worldId,
              row.id,
            ]);
          }
          await client.query(
            `INSERT INTO sim_rejections (world_id, module_id, deadline_id, reason, detail) VALUES ($1, $2, $3, $4, $5)`,
            [
              this.worldId,
              def.id,
              row.id,
              reason,
              JSON.stringify({ message: String(error instanceof Error ? error.message : error), attempts }),
            ],
          );
          for (const fact of simFacts) {
            await client.query(
              `INSERT INTO sim_rejections (world_id, actor_id, module_id, deadline_id, request_id, reason, claimed, computed, detail)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                this.worldId,
                fact.actorId,
                def.id,
                row.id,
                `deadline:${row.id}`,
                fact.reason,
                fact.claimed === null ? null : JSON.stringify(fact.claimed),
                fact.computed === null ? null : JSON.stringify(fact.computed),
                JSON.stringify({ extra: fact.extra }),
              ],
            );
          }
        });
      } catch (writeError) {
        if (writeError instanceof StaleWriter) throw writeError;
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          event: "deadline.write.failed",
          detail: String(writeError),
        });
      }
    }
  }

  /** Сколько раз этот срок уже пробовали провести. */
  private async countAttempt(deadlineId: string): Promise<number> {
    const rows = await this.db.pool.query<{ attempts: number }>(
      `SELECT attempts FROM deadlines WHERE world_id = $1 AND id = $2`,
      [this.worldId, deadlineId],
    );
    return Number(rows.rows[0]?.attempts ?? 0);
  }

  /** Команда игрока: схема, право, идемпотентность, обработчик, эффекты. */
  private async runCommand(queued: QueuedCommand): Promise<CommandOutcome> {
    const moduleId = queued.commandId.split(".")[0] ?? "";
    const def = this.byId.get(moduleId);
    const decl = def?.server?.commands?.find((command) => command.id === queued.commandId);
    if (!def || !decl) {
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: queued.actor.id,
        requestId: queued.requestId,
        event: "command.unknown",
        detail: { commandId: queued.commandId },
      });
      return { status: "error", key: KERNEL_KEYS.unknown };
    }
    if (this.moduleStates.get(moduleId) === "disabled") {
      return { status: "error", key: KERNEL_KEYS.disabled };
    }
    const parsed = this.parseInput(decl, queued.payload);
    if (!parsed.ok) {
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: queued.actor.id,
        moduleId,
        requestId: queued.requestId,
        event: "command.schema",
        detail: { commandId: queued.commandId, problems: parsed.problems },
      });
      await this.writeSecurityRow(queued, "command.schema", parsed.problems);
      return { status: "error", key: KERNEL_KEYS.badInput };
    }

    let outcome: CommandOutcome = { status: "ok", repeat: false };
    let applied: ApplyResult | null = null;
    const simFacts: SimFact[] = [];
    try {
      await this.tx(async ({ client }) => {
        const inserted = await client.query(
          `INSERT INTO commands (world_id, idempotency_key, request_id, actor_id, module_id, command_id, outcome, at_ms)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
           ON CONFLICT (world_id, idempotency_key) DO NOTHING
           RETURNING idempotency_key`,
          [
            this.worldId,
            queued.idempotencyKey,
            queued.requestId,
            queued.actor.id,
            moduleId,
            queued.commandId,
            this.clockValue.now(),
          ],
        );
        if (inserted.rowCount === 0) {
          const previous = await client.query<{ outcome: string; error_key: string | null; command_id: string }>(
            `SELECT outcome, error_key, command_id FROM commands WHERE world_id = $1 AND idempotency_key = $2`,
            [this.worldId, queued.idempotencyKey],
          );
          const row = previous.rows[0];
          if (row && row.command_id !== queued.commandId) {
            // Ключ повтора принадлежит другой команде: это не повтор, а подмена.
            this.journal.write({
              channel: "security",
              worldId: this.worldId,
              actorId: queued.actor.id,
              moduleId,
              requestId: queued.requestId,
              event: "command.key-reuse",
              detail: { idempotencyKey: queued.idempotencyKey, stored: row.command_id },
            });
            outcome = { status: "error", key: KERNEL_KEYS.badInput };
            return;
          }
          await client.query(
            `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, outcome, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, 'repeat', $6)`,
            [this.worldId, queued.actor.id, moduleId, queued.requestId, queued.commandId, queued.idempotencyKey],
          );
          outcome =
            row?.outcome === "error"
              ? { status: "error", key: row.error_key ?? KERNEL_KEYS.generic }
              : { status: "ok", repeat: true };
          return;
        }

        const base = await this.handlerBase(moduleId, queued.actor, {
          requestId: queued.requestId,
          idempotencyKey: queued.idempotencyKey,
          client,
        });
        const ctx: CommandContext = base;
        const effects = await decl.handle(ctx, parsed.value as never);
        applied = await this.applyInTx(client, moduleId, queued.actor, effects, {
          requestId: queued.requestId,
          idempotencyKey: queued.idempotencyKey,
          commandId: queued.commandId,
          holderId: queued.actor.id,
          simFacts,
        });
        await client.query(
          `UPDATE commands SET outcome = 'ok' WHERE world_id = $1 AND idempotency_key = $2`,
          [this.worldId, queued.idempotencyKey],
        );
      });
    } catch (error) {
      if (error instanceof StaleWriter) throw error;
      if (error instanceof CommandRejected) {
        await this.recordRejection(queued, moduleId, error, simFacts);
        return { status: "error", key: error.effectsKey, params: error.params };
      }
      // Клиент не получает след исключения: только ключ словаря.
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId,
        actorId: queued.actor.id,
        requestId: queued.requestId,
        event: "command.failed",
        detail: String(error instanceof Error ? error.message : error),
      });
      await this.recordRejection(queued, moduleId, new CommandRejected(KERNEL_KEYS.generic), simFacts);
      return { status: "error", key: KERNEL_KEYS.generic };
    }
    if (applied) await this.publish(applied, queued.actor);
    return outcome;
  }

  private parseInput(
    decl: CommandDecl<JsonObject>,
    payload: unknown,
  ): { ok: true; value: unknown } | { ok: false; problems: string[] } {
    const validator = decl.input as unknown as {
      safeParse?: (input: unknown) => { success: boolean; data?: unknown; error?: unknown };
      parse?: (input: unknown) => unknown;
    };
    if (typeof validator.safeParse === "function") {
      const result = validator.safeParse(payload);
      if (result.success) return { ok: true, value: result.data };
      return { ok: false, problems: [String(result.error)] };
    }
    try {
      return { ok: true, value: validator.parse?.(payload) };
    } catch (error) {
      return { ok: false, problems: [String(error)] };
    }
  }

  private async writeSecurityRow(queued: QueuedCommand, event: string, problems: string[]): Promise<void> {
    await this.db.pool
      .query(
        `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, detail)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          this.worldId,
          queued.actor.id,
          queued.commandId.split(".")[0] ?? null,
          queued.requestId,
          event,
          JSON.stringify({ problems }),
        ],
      )
      .catch(() => undefined);
  }

  /** Отказ пишется отдельной короткой транзакцией после отката игровой. */
  private async recordRejection(
    queued: QueuedCommand,
    moduleId: ModuleId,
    error: CommandRejected,
    simFacts: readonly SimFact[] = [],
  ): Promise<void> {
    this.journal.write({
      channel: error.channel,
      worldId: this.worldId,
      actorId: queued.actor.id,
      moduleId,
      requestId: queued.requestId,
      event: error.effectsKey,
    });
    try {
      await this.tx(async ({ client }) => {
        await client.query(
          `INSERT INTO commands (world_id, idempotency_key, request_id, actor_id, module_id, command_id, outcome, error_key, at_ms)
           VALUES ($1, $2, $3, $4, $5, $6, 'error', $7, $8)
           ON CONFLICT (world_id, idempotency_key) DO UPDATE SET outcome = 'error', error_key = EXCLUDED.error_key`,
          [
            this.worldId,
            queued.idempotencyKey,
            queued.requestId,
            queued.actor.id,
            moduleId,
            queued.commandId,
            error.effectsKey,
            this.clockValue.now(),
          ],
        );
        await client.query(
          `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, detail)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            this.worldId,
            queued.actor.id,
            moduleId,
            queued.requestId,
            error.effectsKey,
            JSON.stringify({ channel: error.channel }),
          ],
        );
        for (const fact of simFacts) {
          await client.query(
            `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, claimed, computed, detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              this.worldId,
              fact.actorId ?? queued.actor.id,
              moduleId,
              queued.requestId,
              fact.reason,
              fact.claimed === null ? null : JSON.stringify(fact.claimed),
              fact.computed === null ? null : JSON.stringify(fact.computed),
              JSON.stringify({ commandId: queued.commandId, idempotencyKey: queued.idempotencyKey, extra: fact.extra }),
            ],
          );
        }
        await client.query(
          `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, outcome, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            this.worldId,
            queued.actor.id,
            moduleId,
            queued.requestId,
            queued.commandId,
            error.effectsKey,
            queued.idempotencyKey,
          ],
        );
      });
    } catch (writeError) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "rejection.write.failed",
        detail: String(writeError),
      });
    }
  }

  private async applyInTx(
    client: PoolClient,
    moduleId: ModuleId,
    actor: ActorFacts | null,
    effects: readonly Effect[],
    meta: {
      requestId: string;
      idempotencyKey: string;
      commandId: string | null;
      holderId: string;
      /** Сюда ядро кладёт расхождения: при откате их пишет отдельная транзакция. */
      simFacts?: SimFact[];
    },
  ): Promise<ApplyResult> {
    const prepared = await this.factsFor(meta.holderId, client);
    const limitOf = (holder: string, resource: ResourceId) => this.limitFor(holder, resource, client);
    const applied = await applyEffects(
      {
        client,
        tablesOf: (moduleId) => this.tablesOf(moduleId),
        worldId: this.worldId,
        now: this.clockValue.now(),
        moduleId,
        actor,
        journal: this.journal,
        requestId: meta.requestId,
        commandId: meta.commandId,
        idempotencyKey: meta.idempotencyKey,
        limitOf,
        simFacts: meta.simFacts ?? [],
      },
      effects,
    );
    return applied;
  }

  /**
   * Рассылка после коммита. Клиент не должен видеть изменение, которое может
   * откатиться, а снимок отчёта обязан читаться уже по зафиксированному миру:
   * поэтому кеши сбрасываются до рассылки, а не после.
   */
  private async publish(applied: ApplyResult, actor: ActorFacts | null): Promise<void> {
    this.clearCaches();
    const serverNow = this.clockValue.now();
    for (const patch of applied.patches) this.deliverPatch(patch, actor, serverNow);
    for (const report of applied.reports) this.sink.report(report.id, report.kind, report.rows, serverNow);
    this.lastRejections += applied.clamped.length;
    await this.afterCommit({ disabledModules: applied.disabledModules });
  }

  /**
   * Состояние модуля меняется после коммита: внутри транзакции база ещё
   * не видна другому соединению, и выключенный модуль получил бы вызов.
   */
  private async afterCommit(result: { disabledModules: ModuleId[] }): Promise<void> {
    if (result.disabledModules.length === 0) return;
    for (const moduleId of result.disabledModules) this.moduleStates.set(moduleId, "disabled");
    await this.reloadModuleStates();
    this.clearCaches();
  }

  private deliverPatch(patch: AppliedPatch, actor: ActorFacts | null, serverNow: number): void {
    switch (patch.route.kind) {
      case "actor": {
        const id = patch.route.id ?? actor?.id ?? "world";
        this.sink.patch(id, patch.ops, serverNow);
        break;
      }
      case "tiles": {
        this.sink.tiles(patch.route.tiles, patch.ops, serverNow, actor?.id ?? "world");
        break;
      }
      case "clan": {
        if (actor?.clanId) this.sink.clan(actor.clanId, patch.ops, serverNow);
        break;
      }
    }
  }

  tilesOfPatches(patches: readonly AppliedPatch[]): TileRef[] {
    return tilesOfPatches(patches);
  }

  /** Снимок вида игрока: мир, я, склад, состояния модулей. */
  async view(actor: ActorFacts | null): Promise<JsonValue> {
    const holderId = actor?.id ?? "world";
    const prepared = await this.factsFor(holderId);
    const modules: Record<string, JsonValue> = {};
    for (const def of this.enabled()) {
      modules[def.id] = await this.snapshotFor(def.id, actor);
    }
    const profile = actor && this.profileOf ? await this.profileOf(actor.id) : null;
    return {
      world: this.worldFacts(this.clockValue.now()),
      me: actor
        ? {
            id: actor.id,
            name: actor.name,
            clanId: actor.clanId,
            portrait: profile?.portrait ?? "",
            bannerSign: profile?.bannerSign ?? "",
            bannerColor: profile?.bannerColor ?? "",
            type: profile?.type ?? "",
          }
        : null,
      stock: prepared.stock,
      modules,
    };
  }

  /** Служебные данные для админской панели: строки отказов. */
  async rejections(limit = 50): Promise<JsonValue[]> {
    const rows = await this.db.pool.query(
      `SELECT id, ts, actor_id, module_id, reason, claimed, computed FROM sim_rejections
       WHERE world_id = $1 ORDER BY id DESC LIMIT $2`,
      [this.worldId, limit],
    );
    return rows.rows as JsonValue[];
  }
}
