/**
 * Двое часов: календарь и ход мира.
 *
 * Календарь (время сервера) — настоящий: по нему идут окна событий, сроки
 * оператора и карантин. Ход мира стоит, пока процесс не работает: по нему идут
 * сроки игроков, и оставшиеся минуты на простое не сгорают.
 *
 * Здесь проверяется и защита от плохих данных: испорченный пульс не может ни
 * откатить мир назад, ни заморозить его навсегда.
 */

import { describe, expect, it } from "vitest";
import { createTestWorld, deadlinesOf, drain, reopenTestWorld, dueCount } from "./harness.js";
import { kitModule } from "./kit.js";

const DAY = 86_400_000;

describe("часы мира и календарь", () => {
  it("плохой пульс не откатывает и не замораживает ход мира", async () => {
    const world = await createTestWorld();
    try {
      // Пульс из будущего — испорченная запись: верить ей нельзя.
      await reopenTestWorld(world, { pulse: { realAtMs: Date.now(), worldAtMs: Date.now() + DAY } });

      // Часы встают на настоящий миг, а не на выдуманное «завтра».
      const clockAtBoot = world.service.now();
      expect(Math.abs(clockAtBoot - Date.now())).toBeLessThan(5_000);
      expect(world.records.some((record) => record.event === "pulse.suspect")).toBe(true);
      const resume = world.records.find((record) => record.event === "world.resume")?.detail as
        | { worldAt: number; downtimeMs: number }
        | undefined;
      expect(resume).toBeDefined();
      expect(Math.abs(resume!.worldAt - clockAtBoot)).toBeLessThan(5_000);
      expect(resume!.downtimeMs).toBeLessThan(5_000);
    } finally {
      await world.close();
    }
  });

  it("мир стоял 40 суток: события идут по календарю, сроки игроков не сгорают", async () => {
    // Модуль краёв держит сроки: на нём и проверяется, что минуты не сгорели.
    const world = await createTestWorld({ extraModules: [kitModule()] });
    try {
      const worldAtStop = world.service.now();

      // Мир лежал 40 суток: и настоящие часы, и ход мира в пульсе отстали на 40 суток.
      // Календарь за это время ушёл вперёд, ход мира — нет.
      await reopenTestWorld(world, {
        pulse: { realAtMs: Date.now() - 40 * DAY, worldAtMs: worldAtStop - 40 * DAY },
      });

      const realNow = Date.now();
      // Ход мира продолжился с того мига, на котором остановился.
      expect(realNow - world.service.now()).toBeGreaterThan(39 * DAY);
      const resume = world.records.find((record) => record.event === "world.resume")?.detail as
        | { worldAt: number; downtimeMs: number; calendarNow: number }
        | undefined;
      expect(resume).toBeDefined();
      expect(resume!.downtimeMs).toBeGreaterThan(39 * DAY);
      expect(resume!.calendarNow - resume!.worldAt).toBeGreaterThan(39 * DAY);

      // Окна живут в настоящих датах: идущая пора года накрывает настоящий миг.
      const activeSeasons = world.service.statesOfUnits().filter((unit) => unit.lane === "season" && unit.state === "enabled");
      expect(activeSeasons).toHaveLength(1);
      const window = activeSeasons[0]?.window;
      expect(window).toBeDefined();
      expect(window!.start).toBeLessThanOrEqual(realNow);
      expect(window!.stop).toBeGreaterThan(realNow);

      // Догон: окна, начавшиеся и кончившиеся за простой, видны в журнале и счётчиках.
      expect(world.records.some((record) => record.event === "schedule.resume")).toBe(true);
      expect(world.records.some((record) => record.event === "schedule.skipped")).toBe(true);
      const stats = world.service.stats();
      expect(stats.scheduleResumed).toBeGreaterThan(0);
      expect(stats.scheduleMissed).toBeGreaterThan(0);
      expect(stats.windowsActive).toBeGreaterThan(0);

      // Пропусков за 40 суток сотни, поэтому в журнал идёт итог на единицу,
      // а сумма итогов сходится со счётчиком: ничего не потеряно.
      const skippedNotes = world.records
        .filter((record) => record.event === "schedule.skipped")
        .map((record) => record.detail as { unit: string; count: number });
      expect(skippedNotes.length).toBeGreaterThan(0);
      expect(skippedNotes.reduce((sum, note) => sum + note.count, 0)).toBe(stats.scheduleMissed);
      expect(skippedNotes.every((note) => note.unit.length > 0)).toBe(true);

      // Срок игрока поставлен на час хода мира: за простой он не выгорел,
      // поэтому сразу после подъёма ещё не наступил.
      await world.db.pool.query(
        `INSERT INTO deadlines (id, world_id, owner, wake_at_ms, key, payload, created_at_ms)
         VALUES ($1, $2, '_kit', $3, $4, '{"mode":"count"}'::jsonb, $5)`,
        ["kit.waits", world.id, world.service.now() + 1_500, "kit.overdue", world.service.now()],
      );
      expect(await dueCount(world)).toBe(0);
      expect((await deadlinesOf(world, "_kit")).some((row) => row.id === "kit.waits")).toBe(true);

      // Через полторы секунды хода мира срок наступает и проходит.
      await new Promise((done) => setTimeout(done, 2_000));
      await drain(world);
      const rows = await world.db.pool.query<{ marks: number }>(
        "SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = 'world'",
        [world.id],
      );
      expect(rows.rows[0]?.marks).toBe(1);
      expect((await deadlinesOf(world, "_kit")).some((row) => row.id === "kit.waits")).toBe(false);
    } finally {
      await world.close();
    }
  });
});

describe("сон писателя", () => {
  it("в тишине писатель не крутится, а просыпается на срок", async () => {
    // Потолок сна 40 мс: тест живёт быстро, поведение то же, что с двумя секундами.
    const world = await createTestWorld({ maxIdleMs: 40, extraModules: [kitModule()] });
    try {
      world.service.start();
      await new Promise((done) => setTimeout(done, 200));
      const idleSteps = world.service.stats().steps;
      // За 200 мс при сне в 40 мс проходов должно быть единицы, а не сотни.
      expect(idleSteps).toBeLessThan(20);

      // Срок впереди: писатель просыпается сам, без команд и понуканий.
      await world.db.pool.query(
        `INSERT INTO deadlines (id, world_id, owner, unit_id, wake_at_ms, key, payload, created_at_ms)
         VALUES ($1, $2, '_kit', $3, $4, 'kit.soon', '{"mode":"count"}'::jsonb, $5)`,
        ["kit.soon", world.id, "gadget", world.service.now() + 60, world.service.now()],
      );
      await new Promise((done) => setTimeout(done, 400));
      const marks = await world.db.pool.query<{ marks: number }>(
        "SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = 'world'",
        [world.id],
      );
      expect(marks.rows[0]?.marks).toBe(1);
    } finally {
      await world.close();
    }
  });
});
