/**
 * Переключатели мира: единицы видны, точечный запрет работает,
 * срок снимает запрет сам, расписание считает окна заранее.
 */

import { describe, expect, it } from "vitest";
import { KERNEL_KEYS } from "@tdl/protocol";
import { kitModule } from "./kit.js";
import { createTestWorld, runCommand, type TestWorld } from "./harness.js";

const GADGET = "_kit.gadget";

describe("переключатели единиц мира", () => {
  it("единицы сборки видны, состояния согласованы, счётчик един", async () => {
    const world = await createTestWorld();
    try {
      const units = world.service.statesOfUnits();
      expect(units.length).toBeGreaterThan(10);
      for (const unit of units) {
        expect(["enabled", "disabled"]).toContain(unit.state);
        expect(unit.key).toBe(`${unit.moduleId}.${unit.unitId}`);
        expect(unit.titleKey.length).toBeGreaterThan(0);
      }
      // Поры года идут встык: в любой миг ровно одна включена.
      const seasons = units.filter((unit) => unit.lane === "season");
      expect(seasons.filter((unit) => unit.state === "enabled")).toHaveLength(1);
      expect(world.service.stats().unitsEnabled).toBe(units.filter((unit) => unit.state === "enabled").length);
    } finally {
      await world.close();
    }
  });

  it("план окон посчитан заранее и покрывает горизонт", async () => {
    const world = await createTestWorld();
    try {
      const plan = world.service.schedulePlan();
      expect(plan.length).toBeGreaterThan(100);
      const last = Math.max(...plan.map((window) => window.stop));
      expect(last).toBeGreaterThan(Date.now() + 30 * 86_400_000);
      for (const window of plan) {
        expect(window.stop).toBeGreaterThan(window.start);
        expect(window.key).toBe(`${window.unitId}:${window.start}`);
      }
    } finally {
      await world.close();
    }
  });

  it("точечный запрет гасит единицу, а срок снимает его сам", async () => {
    const world = await createTestWorld();
    try {
      const daily = world.service.statesOfUnits("day-window").filter((unit) => unit.lane === "daily");
      expect(daily.length).toBeGreaterThan(0);
      const unit = daily[0]!;
      const until = Date.now() + 60;

      await world.service.setUnitState("day-window", unit.unitId, "disabled", { until, reason: "проверка" });
      const closed = world.service.unitStateOf(unit.key)!;
      expect(closed.state).toBe("disabled");
      expect(closed.reason).toBe("operator");
      expect(closed.note).toBe("проверка");
      expect(closed.until).toBe(until);

      // Запись лежит в базе: после перезапуска мира запрет читается оттуда.
      const stored = await world.db.pool.query<{ state: string; until_ms: string; reason: string }>(
        `SELECT state, until_ms, reason FROM unit_states WHERE world_id = $1 AND module_id = $2 AND unit_id = $3`,
        [world.id, "day-window", unit.unitId],
      );
      expect(stored.rows[0]?.state).toBe("disabled");
      expect(Number(stored.rows[0]?.until_ms)).toBe(until);
      expect(stored.rows[0]?.reason).toBe("проверка");

      // Срок вышел — переключатель снялся, дальше снова решает расписание.
      await new Promise((done) => setTimeout(done, 90));
      const freed = world.service.unitStateOf(unit.key)!;
      expect(freed.reason).not.toBe("operator");
      expect(freed.reason).not.toBe("quarantine");
    } finally {
      await world.close();
    }
  });

  it("команда единицы не проходит, пока единица закрыта", async () => {
    const world = await createTestWorld({ extraModules: [kitModule()] });
    try {
      const actor = world.actor();
      const open = await runCommand(world, actor, GADGET);
      expect(open.status).toBe("ok");

      await world.service.setUnitState("_kit", "gadget", "disabled", { reason: "сломался" });
      const closed = await runCommand(world, actor, GADGET);
      expect(closed.status).toBe("error");
      expect(closed.key).toBe(KERNEL_KEYS.disabled);
      expect(world.records.some((record) => record.event === "command.unit.closed")).toBe(true);

      // Возврат: запись снимается, команда снова проходит.
      await world.service.setUnitState("_kit", "gadget", "enabled");
      // Модуль краёв — классический: единица живёт по воле модуля.
      expect(world.service.unitStateOf(GADGET)!.reason).toBe("core");
      const again = await runCommand(world, actor, GADGET);
      expect(again.status).toBe("ok");
    } finally {
      await world.close();
    }
  });

  it("срок возврата возвращает модуль сам: и в ответе, и в базе", async () => {
    const world = await createTestWorld();
    try {
      // Срок оператора живёт по календарю (время сервера), а не по ходу мира.
      const until = world.service.calendarNow() + 60;
      await world.service.setModuleState("hour-window", "disabled", { until, reason: "тест срока" });
      expect(world.service.statesOfModules().find((item) => item.id === "hour-window")?.state).toBe("disabled");

      await new Promise((done) => setTimeout(done, 90));
      // До шага писателя действующее состояние уже считается возвращённым.
      const mid = world.service.statesOfModules().find((item) => item.id === "hour-window");
      expect(mid?.state).toBe("enabled");
      expect(mid?.until).toBeUndefined();

      // Шаг писателя снимает запись: база не врёт и не копит мусор.
      await world.service.pumpOnce();
      const row = await world.db.pool.query<{ state: string; until_ms: string; reason: string | null }>(
        `SELECT state, until_ms, reason FROM module_states WHERE world_id = $1 AND module_id = $2`,
        [world.id, "hour-window"],
      );
      expect(row.rows[0]?.state).toBe("enabled");
      expect(Number(row.rows[0]?.until_ms)).toBe(0);
      expect(row.rows[0]?.reason).toBeNull();
      expect(world.records.some((record) => record.event === "module.service.restored")).toBe(true);
    } finally {
      await world.close();
    }
  });

  it("срок возврата возвращает модуль в рождённое состояние, а не просто во «включено»", async () => {
    const world = await createTestWorld();
    try {
      // Большое событие месяца рождено закрытым: оно ждёт своего шага плана.
      expect(world.service.statesOfModules().find((item) => item.id === "month-window")?.state).toBe("disabled");

      // Оператор включает его на срок: по сроку оно возвращается к рождению.
      await world.service.setModuleState("month-window", "enabled", {
        until: world.service.calendarNow() + 50,
        reason: "разрешил на час",
      });
      expect(world.service.statesOfModules().find((item) => item.id === "month-window")?.state).toBe("enabled");

      await new Promise((done) => setTimeout(done, 90));
      await world.service.pumpOnce();
      expect(world.service.statesOfModules().find((item) => item.id === "month-window")?.state).toBe("disabled");
      const row = await world.db.pool.query<{ state: string }>(
        `SELECT state FROM module_states WHERE world_id = $1 AND module_id = $2`,
        [world.id, "month-window"],
      );
      expect(row.rows[0]?.state).toBe("disabled");
    } finally {
      await world.close();
    }
  });

  it("срок возврата возвращает и единицу: окно снова решает само", async () => {
    const world = await createTestWorld();
    try {
      const unit = world.service.statesOfUnits("day-window")[0]!;
      await world.service.setUnitState("day-window", unit.unitId, "disabled", {
        until: world.service.calendarNow() + 60,
        reason: "тест срока",
      });
      expect(world.service.unitStateOf(unit.key)?.state).toBe("disabled");

      await new Promise((done) => setTimeout(done, 90));
      await world.service.pumpOnce();
      const row = await world.db.pool.query(
        `SELECT 1 FROM unit_states WHERE world_id = $1 AND module_id = $2 AND unit_id = $3`,
        [world.id, "day-window", unit.unitId],
      );
      // Снятый запрет не оставляет строки: таблица помнит только живые переключатели.
      expect(row.rowCount).toBe(0);
      expect(world.records.some((record) => record.event === "unit.restored")).toBe(true);
    } finally {
      await world.close();
    }
  });

  it("простой мира: окна догоняются, а повседневное считается пропущенным", async () => {
    const world = await createTestWorld();
    try {
      // Стояли с 1 декабря: зима началась во время простоя и догоняется,
      // осень кончилась во время простоя и уходит в пропуск.
      const from = Date.parse("2027-11-25T00:00:00Z");
      const to = Date.parse("2027-12-02T00:00:00Z");
      const result = await world.service.resumeSchedule(from, to);

      expect(result.resumed.length).toBeGreaterThan(0);
      const resumedUnits = result.resumed.map((key) => key.split(":")[0]);
      expect(resumedUnits).toContain("winter");
      // Модуль большого события рождён выключенным: его окно не догоняется.
      expect(resumedUnits).not.toContain("capital-ten-day");
      expect(result.missed.some((key) => key.startsWith("autumn:"))).toBe(true);
      // Оборотное окно, которое ещё идёт, не догоняется, но и не пропадает:
      // оно просто продолжается — игрок в нём участвует.
      expect(result.continued.some((key) => key.startsWith("march-day:"))).toBe(true);
      expect(result.resumed.some((key) => key.startsWith("march-day:"))).toBe(false);
      // А оборотное окно, кончившееся во время простоя, уже не вернуть.
      expect(result.missed.some((key) => key.startsWith("march-day:"))).toBe(true);

      expect(world.records.some((record) => record.event === "schedule.resume")).toBe(true);
      expect(world.records.some((record) => record.event === "schedule.skipped")).toBe(true);
      expect(world.service.stats().scheduleResumed).toBeGreaterThan(0);
      expect(world.service.stats().scheduleContinued).toBeGreaterThan(0);

      // Часы мира после такой перемотки: план считает то же, что и догон.
      const units = world.service.statesOfUnits("season-winter");
      expect(units.some((unit) => unit.state === "enabled" || unit.reason === "between-windows")).toBe(true);
    } finally {
      await world.close();
    }
  });

  it("журнал расписания пишет старт и стоп окон сами", async () => {
    const world = await createTestWorld();
    try {
      await world.service.pumpOnce();
      const started = world.records.filter((record) => record.event === "schedule.start");
      // Пора года, окно дня, часовое окно, неделя — что-то из этого идёт всегда.
      expect(started.length).toBeGreaterThan(0);
      for (const record of started) {
        expect(record.channel).toBe("app");
        expect(typeof (record.detail as { key?: string })?.key).toBe("string");
      }
      // Второй проход не дублирует старт: ключ окна помнит, что оно уже шло.
      const before = started.length;
      await world.service.pumpOnce();
      expect(world.records.filter((record) => record.event === "schedule.start").length).toBe(before);
    } finally {
      await world.close();
    }
  });

  it("счётчики расписания видны оператору", async () => {
    const world: TestWorld = await createTestWorld();
    try {
      const stats = world.service.stats();
      expect(stats.windowsActive).toBeGreaterThan(0);
      expect(typeof stats.windowsSkipped).toBe("number");
      expect(stats.scheduleMissed).toBe(0);
      expect(stats.unitsQuarantined).toBe(0);
      expect(stats.unitsQuarantineLocked).toBe(0);
      // План посчитан вперёд: горизонт больше сегодняшнего дня.
      expect(stats.planHorizonMs).toBeGreaterThan(Date.now());
    } finally {
      await world.close();
    }
  });

  it("чужая единица не переключается: отказ вместо тишины", async () => {
    const world = await createTestWorld();
    try {
      await expect(world.service.setUnitState("day-window", "нет-такой", "disabled")).rejects.toThrow();
      await expect(world.service.setUnitState("нет-такого-модуля", "unit", "disabled")).rejects.toThrow();
    } finally {
      await world.close();
    }
  });
});
