/**
 * Сторожа ядра: ошибка модуля, отказ, чужой склад, чужие таблицы, чужие деньги.
 * Проверяется не «сколько пришло», а что ничего не протекло: ни в базу,
 * ни к игроку, ни в чужой патч.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createTestWorld, countRows, runCommand, simRows, stockOf, type TestWorld } from "./harness.js";
import { badReadModule, kitModule } from "./kit.js";

const open: TestWorld[] = [];

afterEach(async () => {
  while (open.length > 0) await open.pop()?.close();
});

async function makeWorld(): Promise<TestWorld> {
  const world = await createTestWorld({ extraModules: [kitModule()] });
  open.push(world);
  return world;
}

describe("модуль ошибся", () => {
  it("исключение модуля не меняет мир и не выходит наружу", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.crash", {});
    expect(result.status).toBe("error");
    // Клиент не получает след исключения: только ключ словаря.
    expect(result.key).toBe("kernel.failed");
    expect(await countRows(world, "kit_state")).toBe(0);
    expect((await stockOf(world, actor.id)).kit_dust ?? 0).toBe(0);
    const app = world.records.filter((record) => record.channel === "app" && record.event === "command.failed");
    expect(app.length).toBe(1);
    expect(String(app[0]?.detail)).toContain("модуль сломался");
  });

  it("отказ модуля откатывает и его же выданное", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.refuse", {});
    expect(result.status).toBe("error");
    expect(result.key).toBe("kit.note");
    // Сто ресурса стояло в том же списке эффектов: он не применён.
    expect((await stockOf(world, actor.id)).kit_dust ?? 0).toBe(0);
    // Факт отказа сохранён отдельной короткой транзакцией.
    expect(await countRows(world, "audit_log")).toBeGreaterThan(0);
    expect((await simRows(world)).some((row) => row.reason === "kit.note")).toBe(true);
  });

  it("ошибка в одном эффекте откатывает всю пачку", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.world-column", {});
    expect(result.status).toBe("error");
    expect(await countRows(world, "kit_state")).toBe(0);
    expect((await simRows(world, "rows.column")).length).toBeGreaterThan(0);
  });
});

describe("границы таблиц модуля", () => {
  it("в чужую таблицу писать нельзя", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.foreign-table", {});
    expect(result.status).toBe("error");
    expect(result.key).toBe("kernel.failed");
    expect((await simRows(world, "rows.table")).length).toBeGreaterThan(0);
    expect(await countRows(world, "probe_state")).toBe(0);
  });

  it("имя колонки проверяется до запроса", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.bad-column", {});
    expect(result.status).toBe("error");
    expect((await simRows(world, "rows.column")).length).toBeGreaterThan(0);
    // Таблица модуля цела: инъекция в имя колонки не прошла.
    expect(await countRows(world, "kit_state")).toBe(0);
  });

  it("склад не уходит в минус", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.spend", { count: 5 });
    expect(result.status).toBe("error");
    expect(result.key).toBe("kernel.stock.insufficient");
    expect((await stockOf(world, actor.id)).kit_dust ?? 0).toBe(0);
    expect(await countRows(world, "stock")).toBe(0);
  });
});

describe("предел чужого склада", () => {
  it("выдача другому двору обрезается по его пределу", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const other = world.actor("lord-other-0001");
    // Полка пробного модуля — 500. Отдаём 20 000: остаток не влезает.
    const result = await runCommand(world, actor, "_kit.gift", { holder: other.id });
    expect(result.status).toBe("ok");
    expect((await stockOf(world, other.id)).probe_dust).toBe(500);
    expect((await stockOf(world, actor.id)).probe_dust ?? 0).toBe(0);
    const clamped = await simRows(world, "stock.clamped");
    expect(clamped.length).toBe(1);
    expect(Number(clamped[0]?.computed ? (clamped[0]?.computed as { kept?: number }).kept : 0)).toBe(500);
  });
});

describe("патч", () => {
  it("испорченный патч не ломает команду и уходит в sim", async () => {
    const world = await makeWorld();
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.bad-patch", {});
    expect(result.status).toBe("ok");
    expect((await stockOf(world, actor.id)).kit_dust).toBe(1);
    expect((await simRows(world, "patch.invalid")).length).toBe(1);
    expect(world.sink.patchesFor(actor.id).length).toBe(0);
  });
});

describe("сбой базы", () => {
  it("сбой шага не превращается в поток записей и проходит сам", async () => {
    const world = await makeWorld();
    await world.service.pumpOnce();
    const before = world.records.length;
    // Такая же ошибка, как при недоступной базе: таблицы нет.
    await world.db.pool.query(`ALTER TABLE deadlines RENAME TO deadlines_hidden`);
    await world.service.pumpOnce();
    await world.service.pumpOnce();
    await world.service.pumpOnce();
    const failures = world.records.slice(before).filter((record) => record.event === "world.error");
    expect(failures.length).toBe(1);
    expect(world.service.stats().failures).toBe(1);

    // База вернулась: проход идёт как обычно, счётчик сбоев обнулён.
    await world.db.pool.query(`ALTER TABLE deadlines_hidden RENAME TO deadlines`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const actor = world.actor();
    const result = await runCommand(world, actor, "_kit.mark", { count: 2 });
    expect(result.status).toBe("ok");
    expect(world.service.stats().failures).toBe(0);
    expect((await stockOf(world, actor.id)).kit_dust).toBe(2);
  });
});

describe("чтение модуля", () => {
  it("пишущий запрос модуля не проходит и в базу не попадает", async () => {
    const world = await createTestWorld({ extraModules: [badReadModule()] });
    open.push(world);
    const actor = world.actor();
    await world.db.pool.query(`INSERT INTO read_state (world_id, holder_id, marks) VALUES ($1, $2, 1)`, [
      world.id,
      actor.id,
    ]);

    const view = (await world.service.view(actor)) as { modules: Record<string, unknown> };
    // Снимок не собрался: состояние модуля пустое, а не полуприменённое.
    expect(view.modules._badread ?? null).toBeNull();
    const failures = world.records.filter((record) => record.event === "module.snapshot.failed");
    // Первый же недопустимый запрос обрывает снимок: дальше модуль не идёт.
    expect(failures.length).toBe(1);
    expect(String(failures[0]?.detail)).toContain("select или with");
    // Строка на месте: DELETE не прошёл.
    expect(await countRows(world, "read_state", `holder_id = '${actor.id}'`)).toBe(1);
  });
});
