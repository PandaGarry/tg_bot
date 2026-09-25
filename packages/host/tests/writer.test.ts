/**
 * Право писателя: эпоха, потеря права, пульс, служебная запись.
 * Писать может только держатель эпохи: ни склад, ни срок, ни состояние модуля.
 */

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, type HostConfig } from "../src/config.js";
import { createJournal, type JournalRecord } from "../src/logger.js";
import { WorldService } from "../src/world/service.js";
import { applyKernelMigrations, applyModuleMigrations, ensureWorld, syncModuleStates } from "../src/db/bootstrap.js";
import { createDb, type Db } from "../src/db/index.js";
import { buildRegistry, type ModuleRegistry } from "@tdl/kernel";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";
import { TestSink } from "./harness.js";
import { kitModule } from "./kit.js";

interface Stand {
  worldId: string;
  db: Db;
  registry: ModuleRegistry;
  config: HostConfig;
  records: JournalRecord[];
  sink: TestSink;
}

const open: { service: WorldService; db: Db }[] = [];

afterEach(async () => {
  const databases = new Set<Db>();
  while (open.length > 0) {
    const entry = open.pop();
    await entry?.service.stop().catch(() => undefined);
    if (entry) databases.add(entry.db);
  }
  for (const db of databases) await db.close().catch(() => undefined);
});

async function stand(): Promise<Stand> {
  const url = readTestDbUrl("host");
  if (!url) throw new Error("адрес тестовой базы не найден");
  const worldId = `writer-${randomUUID().slice(0, 10)}`;
  const config = loadConfig({
    DATABASE_URL: url,
    WORLD_ID: worldId,
    WORLD_NAME: "мир проверки права",
    WORLD_SEED: "5",
    WORLD_SIZE: "32",
    SESSION_SECRET: "test-secret-0123456789",
    NODE_ENV: "test",
  });
  const records: JournalRecord[] = [];
  const journal = createJournal((record) => records.push(record));
  const db = createDb(url);
  await applyKernelMigrations(db, journal);
  const registry = buildRegistry([kitModule()]);
  const world = await ensureWorld(db, config, journal);
  await syncModuleStates(db, registry, world.id);
  await applyModuleMigrations(db, registry, world.id, journal);
  return { worldId, db, registry, config, records, sink: new TestSink() };
}

async function openService(base: Stand, processId: string): Promise<{ service: WorldService; records: JournalRecord[] }> {
  const records: JournalRecord[] = [];
  const journal = createJournal((record) => records.push(record));
  const rows = await base.db.pool.query(`SELECT * FROM worlds WHERE world_id = $1`, [base.worldId]);
  const raw = rows.rows[0] as { world_id: string; name: string; seed: string; size: number; zones: number; zone_pit: number; zone_capital: number; clock_offset_ms: string; created_at: Date };
  const world = {
    id: raw.world_id,
    name: raw.name,
    seed: Number(raw.seed),
    size: raw.size,
    zones: raw.zones,
    zonePit: raw.zone_pit,
    zoneCapital: raw.zone_capital,
    clockOffsetMs: Number(raw.clock_offset_ms),
    createdAt: raw.created_at,
  };
  const service = await WorldService.open({
    db: base.db,
    journal,
    registry: base.registry,
    world,
    sink: base.sink,
    processId,
    stepBudgetMs: 2_000,
  });
  open.push({ service, db: base.db });
  return { service, records };
}

describe("эпоха писателя", () => {
  it("второй процесс забирает право, первый его теряет", async () => {
    const base = await stand();
    const first = await openService(base, "процесс-1");
    const second = await openService(base, "процесс-2");
    expect(second.service.stats().epoch).toBe(first.service.stats().epoch + 1);

    // Старый процесс писать не может: команда ему отказана.
    const actor = { id: "lord-1", worldId: base.worldId, name: "лорд", clanId: null, isBot: false };
    const pending = first.service.submitCommand({
      actor,
      commandId: "_kit.mark",
      payload: { count: 3 },
      requestId: "req-old",
      idempotencyKey: "key-old",
    });
    await first.service.pumpOnce();
    const outcome = await pending;
    expect(outcome.status).toBe("error");
    expect(first.service.lostLease).toBe(true);
    expect(first.records.some((record) => record.channel === "security" && record.event === "writer.lost")).toBe(true);
    // Мир при этом не изменился.
    expect((await base.db.pool.query(`SELECT count(*)::int AS n FROM kit_state WHERE world_id = $1`, [base.worldId])).rows[0]).toEqual({ n: 0 });

    // Новый процесс пишет как обычно.
    const fresh = second.service.submitCommand({
      actor,
      commandId: "_kit.mark",
      payload: { count: 3 },
      requestId: "req-new",
      idempotencyKey: "key-new",
    });
    await second.service.pumpOnce();
    expect((await fresh).status).toBe("ok");
    expect((await base.db.pool.query(`SELECT marks FROM kit_state WHERE world_id = $1`, [base.worldId])).rows[0]).toEqual({ marks: 3 });
  });

  it("старый процесс не двигает пульс и состояние модуля", async () => {
    const base = await stand();
    const first = await openService(base, "процесс-старый");
    const second = await openService(base, "процесс-новый");
    const before = (await base.db.pool.query(`SELECT real_at_ms FROM world_pulse WHERE world_id = $1`, [base.worldId])).rows[0] as {
      real_at_ms: string;
    };

    await first.service.stop();
    const after = (await base.db.pool.query(`SELECT real_at_ms FROM world_pulse WHERE world_id = $1`, [base.worldId])).rows[0] as {
      real_at_ms: string;
    };
    expect(Number(after.real_at_ms)).toBeGreaterThanOrEqual(Number(before.real_at_ms));
    expect(first.records.some((record) => record.event === "pulse.failed")).toBe(true);

    await expect(first.service.setModuleState("_kit", "disabled")).rejects.toThrow();
    const states = await base.db.pool.query<{ state: string }>(
      `SELECT state FROM module_states WHERE world_id = $1 AND module_id = '_kit'`,
      [base.worldId],
    );
    expect(states.rows[0]?.state).toBe("enabled");
    await second.service.stop();
  });

  it("право берётся один раз на процесс: пульс идёт под ним", async () => {
    const base = await stand();
    const only = await openService(base, "процесс-единственный");
    await only.service.pumpOnce();
    const row = (await base.db.pool.query(`SELECT heartbeat_at, holder FROM writer_leases WHERE world_id = $1`, [base.worldId]))
      .rows[0] as { holder: string };
    expect(row.holder).toBe("процесс-единственный");
  });
});

describe("простой и пульс", () => {
  it("пульс пишется и держит простой нулевым при плановой остановке", async () => {
    const base = await stand();
    const first = await openService(base, "процесс-1");
    await first.service.stop();
    const opened = await openService(base, "процесс-2");
    const resume = opened.records.find((record) => record.event === "world.resume");
    expect(resume).toBeDefined();
    const downtime = Number((resume?.detail as { downtimeMs?: number } | undefined)?.downtimeMs ?? -1);
    // Плановая остановка пишет пульс: дыры почти нет.
    expect(downtime).toBeGreaterThanOrEqual(0);
    expect(downtime).toBeLessThan(1_000);
  });
});
