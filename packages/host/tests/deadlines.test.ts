/**
 * Сроки: порядок, пачка, снятие, повтор, ошибка модуля на сроке.
 * Срок — строка в базе, и его проведение не должно ни теряться, ни удваиваться.
 */

import { afterEach, describe, expect, it } from "vitest";
import { countRows, createTestWorld, deadlinesOf, runCommand, simRows, type TestWorld } from "./harness.js";
import { kitModule } from "./kit.js";

const open: TestWorld[] = [];

afterEach(async () => {
  while (open.length > 0) await open.pop()?.close();
});

async function makeWorld(): Promise<TestWorld> {
  const world = await createTestWorld({ extraModules: [kitModule()] });
  open.push(world);
  return world;
}

/** Сдвигает все сроки в прошлое: проверяем шаг, а не ожидание. */
async function makeDue(world: TestWorld, minutes = 10): Promise<void> {
  await world.db.pool.query(`UPDATE deadlines SET wake_at_ms = wake_at_ms - $2 * 60_000 WHERE world_id = $1`, [
    world.id,
    minutes,
  ]);
}

async function auditOrder(world: TestWorld, event: string): Promise<string[]> {
  const rows = await world.db.pool.query<{ entity: string }>(
    `SELECT entity FROM audit_log WHERE world_id = $1 AND outcome = $2 ORDER BY id`,
    [world.id, event],
  );
  return rows.rows.map((row) => row.entity);
}

describe("порядок и пачка", () => {
  it("наступившие сроки идут по времени наступления", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    for (const step of [3, 1, 2]) {
      await runCommand(world, actor, "_kit.plan", { id: `kit-${step}`, key: `kit-${step}`, inMs: step * 60_000 });
    }
    await makeDue(world);
    await world.service.pumpOnce();
    expect(await auditOrder(world, "kit.deadline")).toEqual(["kit-1", "kit-2", "kit-3"]);
    expect(await deadlinesOf(world)).toHaveLength(0);
  });

  it("сорок сроков проводятся каждый ровно один раз", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    for (let index = 0; index < 40; index += 1) {
      await runCommand(world, actor, "_kit.plan", { id: `kit-${index}`, key: `kit-${index}`, inMs: 60_000 });
    }
    await makeDue(world);
    await world.service.pumpOnce();
    const order = await auditOrder(world, "kit.deadline");
    expect(order).toHaveLength(40);
    expect(new Set(order).size).toBe(40);
    // Второй проход ничего не добавляет: строки уже сняты.
    await world.service.pumpOnce();
    expect(await auditOrder(world, "kit.deadline")).toHaveLength(40);
  });

  it("срок снимается командой и повторно не приходит", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan", { id: "kit-cancel", key: "kit-cancel", inMs: 60_000 });
    await world.service.pumpOnce();
    expect(await deadlinesOf(world)).toHaveLength(1);
    await runCommand(world, actor, "_kit.plan", { id: "kit-cancel", key: "kit-cancel", inMs: 120_000 });
    await runCommand(world, actor, "_kit.cancel", { id: "kit-cancel", key: "kit-cancel", inMs: 1_000 });
    await makeDue(world);
    await world.service.pumpOnce();
    expect(await deadlinesOf(world)).toHaveLength(0);
    expect(await auditOrder(world, "kit.deadline")).toHaveLength(0);
  });

  it("тот же ключ с другим id не даёт двух сроков", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan", { id: "kit-первый", key: "kit-ключ", inMs: 60_000 });
    await runCommand(world, actor, "_kit.plan", { id: "kit-второй", key: "kit-ключ", inMs: 120_000 });
    const rows = await deadlinesOf(world);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("kit-второй");
  });
});

describe("срок и ошибка модуля", () => {
  it("отказ модуля на сроке снимает срок и пишет след", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan-mode", { mode: "refuse" });
    await makeDue(world);
    await world.service.pumpOnce();
    expect(await deadlinesOf(world)).toHaveLength(0);
    expect((await simRows(world, "deadline.refused")).length).toBe(1);
  });

  it("ошибка модуля на сроке пробуется снова, но не бесконечно", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan-mode", { mode: "throw" });
    await makeDue(world);
    for (let attempt = 0; attempt < 6; attempt += 1) await world.service.pumpOnce();
    expect(await deadlinesOf(world)).toHaveLength(0);
    const failed = await simRows(world, "deadline.failed");
    const abandoned = await simRows(world, "deadline.abandoned");
    expect(failed.length).toBe(5);
    expect(abandoned.length).toBe(1);
    // Писатель не крутится на сломанном сроке.
    const before = world.records.length;
    await world.service.pumpOnce();
    expect(world.records.length).toBe(before);
  });
});

describe("срок выключенного модуля", () => {
  it("не берётся, пока модуль выключен, и проводится один раз после включения", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan", { id: "kit-sleep", key: "kit-sleep", inMs: 60_000 });
    await runCommand(world, actor, "_kit.off", {});
    await makeDue(world);
    await world.service.pumpOnce();
    expect(await deadlinesOf(world, "_kit")).toHaveLength(1);
    expect(await auditOrder(world, "kit.deadline")).toHaveLength(0);

    await world.service.setModuleState("_kit", "enabled");
    await world.service.pumpOnce();
    expect(await auditOrder(world, "kit.deadline")).toEqual(["kit-sleep"]);
  });
});

describe("чужой срок", () => {
  it("сроки одного модуля не видны другому", async () => {
    const world = await createTestWorld({ extraModules: [kitModule()] });
    open.push(world);
    const actor = world.actor();
    const seen: string[][] = [];
    // Пробный модуль читает свои сроки: чужих в списке быть не должно.
    const probe = world.registry.byId.get("_probe");
    expect(probe).toBeDefined();
    await runCommand(world, actor, "_kit.plan", { id: "kit-один", key: "kit-один", inMs: 60_000 });
    await runCommand(world, actor, "_probe.poke", { steps: 1 });
    const rows = await deadlinesOf(world, "_probe");
    seen.push(rows.map((row) => row.id));
    expect(seen[0]?.every((id) => id.startsWith("probe."))).toBe(true);
    const kit = await deadlinesOf(world, "_kit");
    expect(kit.map((row) => row.id)).toEqual(["kit-один"]);
  });
});

describe("срок не наступил", () => {
  it("будущий срок ждёт своего времени", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    await runCommand(world, actor, "_kit.plan", { id: "kit-будущий", key: "kit-будущий", inMs: 3_600_000 });
    await world.service.pumpOnce();
    expect(await auditOrder(world, "kit.deadline")).toHaveLength(0);
    expect(await deadlinesOf(world, "_kit")).toHaveLength(1);
    expect(await countRows(world, "audit_log", `outcome = 'kit.deadline'`)).toBe(0);
  });
});
