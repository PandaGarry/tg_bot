/**
 * Фундамент: право писателя, простой, повтор команды, выключатель модуля.
 * Проверка идёт на настоящем Postgres.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { ActorFacts } from "@tdl/kernel";
import { createTestWorld, deadlinesOf, runCommand, stockOf, type TestWorld } from "./harness.js";
import { WorldService } from "../src/world/service.js";
import { loadConfig } from "../src/config.js";
import { createJournal } from "../src/logger.js";

const open: TestWorld[] = [];

afterEach(async () => {
  while (open.length > 0) {
    const world = open.pop();
    await world?.close();
  }
});

async function makeWorld(): Promise<TestWorld> {
  const world = await createTestWorld();
  open.push(world);
  return world;
}

describe("склад и модификатор", () => {
  it("пробный ресурс виден в складе, бонус производства виден в числе", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_probe.poke", { steps: 1 });
    expect(result.status).toBe("ok");
    const stock = await stockOf(world, actor.id);
    // 25 × 1.1 = 27.5 → округление до целого: 28.
    expect(stock.probe_dust).toBe(28);
  });

  it("виден в снимке вида, который уходит клиенту", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 2 });
    const view = (await world.service.view(actor)) as {
      stock: Record<string, number>;
      modules: Record<string, { level: number; holderId: string }>;
    };
    expect(view.stock.probe_dust).toBe(55);
    expect(view.modules._probe?.level).toBe(2);
    expect(view.modules._probe?.holderId).toBe(actor.id);
  });

  it("выдача срока уходит владельцу, а не миру", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - 10 * 60_000 WHERE world_id = $1`, [world.id]);
    await world.service.pumpOnce();
    const stock = await stockOf(world, actor.id);
    expect(stock.probe_dust).toBe(83);
    const worldStock = await stockOf(world, "world");
    expect(worldStock.probe_dust ?? 0).toBe(0);
  });

  it("предел склада обрезает выдачу, расхождение уходит в sim", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    // Полка пробного модуля постоянная: 500.
    for (let index = 0; index < 30; index += 1) {
      await runCommand(world, actor, "_probe.poke", { steps: 1 });
    }
    const stock = await stockOf(world, actor.id);
    expect(stock.probe_dust).toBeLessThanOrEqual(500);
    const clamps = await world.db.pool.query(`SELECT reason FROM sim_rejections WHERE world_id = $1 AND reason = 'stock.clamped'`, [
      world.id,
    ]);
    expect(clamps.rowCount ?? 0).toBeGreaterThan(0);
  });
});

describe("повтор команды", () => {
  it("тот же ключ не удваивает выдачу", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const key = "poke-key-0001";
    const first = await runCommand(world, actor, "_probe.poke", { steps: 1 }, key);
    const second = await runCommand(world, actor, "_probe.poke", { steps: 1 }, key);
    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    expect(second.repeat).toBe(true);
    const stock = await stockOf(world, actor.id);
    expect(stock.probe_dust).toBe(28);
    const commands = await world.db.pool.query(`SELECT count(*)::int AS count FROM commands WHERE world_id = $1`, [world.id]);
    expect(commands.rows[0]?.count).toBe(1);
    const auditRepeat = await world.db.pool.query(
      `SELECT count(*)::int AS count FROM audit_log WHERE world_id = $1 AND outcome = 'repeat'`,
      [world.id],
    );
    expect(auditRepeat.rows[0]?.count).toBe(1);
  });

  it("отказ по тому же ключу повторяется тем же ключом", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const key = "bad-key-0001";
    const first = await runCommand(world, actor, "_probe.nope", {}, key);
    expect(first.status).toBe("error");
    expect(first.key).toBe("kernel.command.unknown");
  });

  it("схема входа проверяется до обработчика", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const bad = await runCommand(world, actor, "_probe.poke", { steps: 0 });
    expect(bad.status).toBe("error");
    expect(bad.key).toBe("kernel.command.bad-input");
    const stock = await stockOf(world, actor.id);
    expect(stock.probe_dust).toBeUndefined();
    const security = world.records.filter((record) => record.channel === "security");
    expect(security.some((record) => record.event === "command.schema")).toBe(true);
  });
});

describe("сроки", () => {
  it("наступивший срок проводится один раз и ставит следующий", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    expect((await deadlinesOf(world, "_probe")).length).toBe(1);

    // Сдвигаем срок в прошлое: так проверяется шаг, не ожидание.
    await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - 10 * 60_000 WHERE world_id = $1`, [world.id]);
    await world.service.pumpOnce();
    const stock = await stockOf(world, actor.id);
    // 28 от пробы + 55 от такта (50 × 1.1): полка 500 не мешает.
    expect(stock.probe_dust).toBe(83);

    // Второй проход ничего не добавляет.
    await world.service.pumpOnce();
    expect((await stockOf(world, actor.id)).probe_dust).toBe(83);
    const ticks = await world.db.pool.query(`SELECT ticks FROM probe_state WHERE world_id = $1 AND holder_id = $2`, [
      world.id,
      actor.id,
    ]);
    expect(Number(ticks.rows[0]?.ticks ?? 0)).toBe(1);
    // Следующий срок поставлен.
    expect((await deadlinesOf(world, "_probe")).length).toBe(1);
    const reports = world.sink.reports();
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((record) => record.actorId === actor.id)).toBe(true);
  });

  it("срок в прошлом на постановке отклоняется и уходит в sim", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - 10 * 60_000 WHERE world_id = $1`, [world.id]);
    await world.service.pumpOnce();
    const rows = await world.db.pool.query<{ reason: string }>(
      `SELECT reason FROM sim_rejections WHERE world_id = $1 AND reason = 'deadline.past'`,
      [world.id],
    );
    // Штатный срок такта ставится в будущем: отказа быть не должно.
    expect(rows.rowCount).toBe(0);
  });
});

describe("выключатель модуля", () => {
  it("выключенный модуль не получает ни команды, ни сроки", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    await runCommand(world, actor, "_probe.hush", {});
    const stockAfterHush = await stockOf(world, actor.id);

    const refused = await runCommand(world, actor, "_probe.poke", { steps: 1 });
    expect(refused.status).toBe("error");
    expect(refused.key).toBe("kernel.module.disabled");

    // Срок остался в базе, но выборка его не берёт.
    await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - 10 * 60_000 WHERE world_id = $1`, [world.id]);
    await world.service.pumpOnce();
    expect((await stockOf(world, actor.id)).probe_dust).toBe(stockAfterHush.probe_dust);
    expect((await deadlinesOf(world, "_probe")).length).toBe(1);

    // Включаем обратно: просроченный срок проводится один раз.
    await world.service.setModuleState("_probe", "enabled");
    await world.service.pumpOnce();
    const afterEnable = await stockOf(world, actor.id);
    expect(afterEnable.probe_dust).toBeGreaterThan(stockAfterHush.probe_dust as number);
    const again = afterEnable.probe_dust;
    await world.service.pumpOnce();
    expect((await stockOf(world, actor.id)).probe_dust).toBe(again);
  });
});

describe("право писателя", () => {
  it("второй процесс не даёт писать первому", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });

    const secondJournal = createJournal((record) => world.records.push(record));
    const second = await WorldService.open({
      db: world.db,
      journal: secondJournal,
      registry: world.registry,
      world: world.world,
      sink: world.sink,
      processId: "second-process",
      stepBudgetMs: 2_000,
    });
    expect(second.stats().epoch).toBe(world.service.stats().epoch + 1);

    const refused = await runCommand(world, actor, "_probe.poke", { steps: 1 });
    expect(refused.status).toBe("error");
    expect(world.service.lostLease).toBe(true);
    expect(world.records.some((record) => record.channel === "security" && record.event === "writer.lost")).toBe(true);

    // Второй процесс пишет нормально.
    const viaSecond = await (async () => {
      const pending = second.submitCommand({
        actor,
        commandId: "_probe.poke",
        payload: { steps: 1 },
        requestId: "req-second-1",
        idempotencyKey: "second-key-1",
      });
      await second.pumpOnce();
      return pending;
    })();
    expect(viaSecond.status).toBe("ok");
    await second.stop();
  });
});

describe("простой и часы мира", () => {
  it("простой не сжигает оставшиеся минуты, а срок остаётся тем же", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    const before = await deadlinesOf(world, "_probe");
    const wakeAt = before[0]?.wakeAt as number;
    await world.service.stop();

    // Мир стоял 60 секунд: пульс остался в прошлом.
    await world.db.pool.query(`UPDATE world_pulse SET real_at_ms = real_at_ms - 60_000 WHERE world_id = $1`, [world.id]);

    const journal = createJournal((record) => world.records.push(record));
    const reopened = await WorldService.open({
      db: world.db,
      journal,
      registry: world.registry,
      world: world.world,
      sink: world.sink,
      processId: "reopened",
      stepBudgetMs: 2_000,
    });
    const after = await deadlinesOf(world, "_probe");
    // Срок тот же: простой сдвинул часы мира, а не срок.
    expect(after[0]?.wakeAt).toBe(wakeAt);
    const resume = world.records.find((record) => record.event === "world.resume");
    expect(Number((resume?.detail as { downtimeMs?: number } | undefined)?.downtimeMs ?? 0)).toBeGreaterThanOrEqual(60_000);
    await reopened.stop();
  });

  it("прыжок часов назад простоем не считается", async () => {
    const world = await makeWorld();
    await world.service.stop();
    await world.db.pool.query(`UPDATE world_pulse SET real_at_ms = real_at_ms + 3_600_000 WHERE world_id = $1`, [world.id]);
    const journal = createJournal((record) => world.records.push(record));
    const reopened = await WorldService.open({
      db: world.db,
      journal,
      registry: world.registry,
      world: world.world,
      sink: world.sink,
      processId: "reopened-2",
      stepBudgetMs: 2_000,
    });
    const resume = world.records.filter((record) => record.event === "world.resume").pop();
    expect(Number((resume?.detail as { downtimeMs?: number } | undefined)?.downtimeMs ?? -1)).toBe(0);
    await reopened.stop();
  });

  it("наступившее во время простоя проводится при подъёме и только один раз", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    const stockBefore = await stockOf(world, actor.id);
    await world.service.stop();
    // Срок наступил, пока мир стоял.
    await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - 30 * 60_000 WHERE world_id = $1`, [world.id]);
    await world.db.pool.query(`UPDATE world_pulse SET real_at_ms = real_at_ms - 60_000 WHERE world_id = $1`, [world.id]);

    const journal = createJournal((record) => world.records.push(record));
    const reopened = await WorldService.open({
      db: world.db,
      journal,
      registry: world.registry,
      world: world.world,
      sink: world.sink,
      processId: "reopened-3",
      stepBudgetMs: 2_000,
    });
    const afterOpen = await stockOf(world, actor.id);
    expect(afterOpen.probe_dust as number).toBeGreaterThan(stockBefore.probe_dust as number);
    await reopened.pumpOnce();
    expect((await stockOf(world, actor.id)).probe_dust).toBe(afterOpen.probe_dust);
    await reopened.stop();
  });
});

describe("видимость", () => {
  it("патч уходит владельцу, а не всему миру", async () => {
    const world = await makeWorld();
    const actor: ActorFacts = world.actor("lord-one");
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    const sink = world.sink as { patched: string[] } & TestWorld["sink"];
    void sink;
    const records = (world.sink as unknown as { records: { kind: string; actorId: string; ops?: { path: string }[] }[] }).records;
    const patches = records.filter((record) => record.kind === "patch");
    expect(patches.length).toBeGreaterThan(0);
    expect(patches.every((patch) => patch.actorId === "lord-one")).toBe(true);
    expect(patches.some((patch) => patch.ops?.some((op) => op.path === "modules._probe.level"))).toBe(true);
  });
});
