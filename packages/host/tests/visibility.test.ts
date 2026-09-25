/**
 * Кому уходит изменение: игроку, плиткам или клану. Мир не рассылает патч
 * всем подряд — чужой склад и чужие марши в чужой патч не попадают.
 * Здесь же проверяется, что отчёты не хранятся бесконечно.
 */

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { createTestWorld, runCommand, type TestWorld } from "./harness.js";
import { kitModule } from "./kit.js";

const open: TestWorld[] = [];

afterEach(async () => {
  while (open.length > 0) await open.pop()?.close();
});

async function kitWorld(): Promise<TestWorld> {
  const world = await createTestWorld({ extraModules: [kitModule()] });
  open.push(world);
  return world;
}

async function reportRows(world: TestWorld, lordId: string): Promise<number> {
  const rows = await world.db.pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reports WHERE world_id = $1 AND lord_id = $2",
    [world.id, lordId],
  );
  return Number(rows.rows[0]?.count ?? 0);
}

describe("видимость изменения", () => {
  it("патч плиток уходит плиткам, а не игроку", async () => {
    const world = await kitWorld();
    const actor = world.actor();
    const tiles = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];

    const outcome = await runCommand(world, actor, "_kit.tile-touch", { tiles }, `key-${randomUUID()}`);

    expect(outcome.status).toBe("ok");
    const tilesRecords = world.sink.records.filter((record) => record.kind === "tiles");
    expect(tilesRecords).toHaveLength(1);
    expect(tilesRecords[0]?.tiles).toEqual(tiles);
    expect(tilesRecords[0]?.actorId).toBe(actor.id);
    expect(world.sink.records.filter((record) => record.kind === "patch")).toHaveLength(0);
  });

  it("патч клана уходит клану игрока, а без клана не уходит никому", async () => {
    const world = await kitWorld();
    const clanActor = { ...world.actor(), clanId: "clan-1" };

    await runCommand(world, clanActor, "_kit.clan-touch", {}, `key-${randomUUID()}`);
    const clanRecords = world.sink.records.filter((record) => record.kind === "clan");
    expect(clanRecords).toHaveLength(1);
    expect(clanRecords[0]?.actorId).toBe("clan-1");

    const loneActor = world.actor();
    await runCommand(world, loneActor, "_kit.clan-touch", {}, `key-${randomUUID()}`);
    expect(world.sink.records.filter((record) => record.kind === "clan")).toHaveLength(1);
    expect(world.sink.records.filter((record) => record.kind === "patch")).toHaveLength(0);
  });

  it("патч с чужим id уходит названному игроку, а не отправителю", async () => {
    const world = await kitWorld();
    const sender = world.actor();

    await runCommand(world, sender, "_kit.actor-touch", { holder: "lord-other" }, `key-${randomUUID()}`);

    const patches = world.sink.records.filter((record) => record.kind === "patch");
    expect(patches).toHaveLength(1);
    expect(patches[0]?.actorId).toBe("lord-other");
    expect(world.sink.patchesFor(sender.id)).toHaveLength(0);
  });

  it("отчёты не хранятся бесконечно: остаётся сотня последних на игрока", async () => {
    const world = await kitWorld();
    const lordId = `lord-${randomUUID().slice(0, 8)}`;
    const actor = world.actor(lordId);
    const other = world.actor();

    // Сто пять отчётов одному игроку: пять самых старых обязаны уйти.
    for (let index = 0; index < 105; index += 1) {
      const outcome = await runCommand(world, actor, "_kit.report", { id: lordId, kind: "gather" }, `key-${randomUUID()}`);
      expect(outcome.status).toBe("ok");
    }
    // Пять отчётов другому: его сотня не тронута.
    for (let index = 0; index < 5; index += 1) {
      await runCommand(world, actor, "_kit.report", { id: other.id, kind: "gather" }, `key-${randomUUID()}`);
    }

    expect(await reportRows(world, lordId)).toBe(100);
    expect(await reportRows(world, other.id)).toBe(5);

    const bounds = await world.db.pool.query<{ min: string; max: string }>(
      "SELECT MIN(id)::text AS min, MAX(id)::text AS max FROM reports WHERE world_id = $1 AND lord_id = $2",
      [world.id, lordId],
    );
    // Вытесняются именно старые: окно сдвинулось на пять вставок.
    expect(Number(bounds.rows[0]?.max) - Number(bounds.rows[0]?.min)).toBe(99);
    expect(Number(bounds.rows[0]?.min)).toBeGreaterThan(0);

    // Мир отдаёт отчёт каждый раз: вытеснение в базе вид получателя не трогает.
    const delivered = world.sink.reports(lordId);
    expect(delivered).toHaveLength(105);
    expect(delivered.at(-1)?.rows?.[0]?.key).toBe("kit.note");
  });

  it("строки отчёта с пустым ключом не уходят игроку и в базу не ложатся", async () => {
    const world = await kitWorld();
    const actor = world.actor();

    const empty = await runCommand(world, actor, "_kit.report", { id: actor.id, kind: "gather", rowKey: "" }, `key-${randomUUID()}`);
    expect(empty.status).toBe("ok");
    expect(await reportRows(world, actor.id)).toBe(0);
    expect(world.sink.reports(actor.id)).toHaveLength(0);

    const filled = await runCommand(world, actor, "_kit.report", { id: actor.id, kind: "gather" }, `key-${randomUUID()}`);
    expect(filled.status).toBe("ok");
    expect(await reportRows(world, actor.id)).toBe(1);
    expect(world.sink.reports(actor.id)).toHaveLength(1);
  });

  it("чужой отчёт не уходит отправителю", async () => {
    const world = await kitWorld();
    const actor = world.actor();

    await runCommand(world, actor, "_kit.report", { id: "lord-far", kind: "gather" }, `key-${randomUUID()}`);

    expect(world.sink.reports(actor.id)).toHaveLength(0);
    expect(world.sink.reports("lord-far")).toHaveLength(1);
    expect(await reportRows(world, "lord-far")).toBe(1);
  });
});
