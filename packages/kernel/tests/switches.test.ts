/**
 * Переключатели и примерка: единица-спутник идёт за своей единицей, полоса
 * «ровно одна» не даёт включить двух пор года, а примерка меняет содержимое
 * повседневных окон по воле оператора.
 */

import { describe, expect, it } from "vitest";
import { defineModule, planWindows, registryProblems, unitStates, type ModuleDefinition } from "../src/index.js";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Сборка из двух пор года: у каждой своя единица и вид, который идёт за ней. */
function seasons(): ModuleDefinition[] {
  const make = (id: string, unit: string): ModuleDefinition =>
    defineModule({
      id,
      version: 1,
      kind: "seasonal",
      content: { strings: { ru: { [`${id}.name`]: unit }, en: { [`${id}.name`]: unit } } },
      units: [
        {
          id: unit,
          role: "season",
          titleKey: `${id}.name`,
          defaultState: "disabled",
          lane: "season",
          window: { repeat: { kind: "yearly", month: 9, day: 1 }, at: "00:00", lengthMs: 91 * DAY },
        },
        { id: "look", role: "look", titleKey: `${id}.name`, defaultState: "disabled", follows: unit },
      ],
    });
  return [
    make("season-autumn", "autumn"),
    make("season-winter", "winter"),
  ];
}

/** Сборка дня: одно окно полосы `daily`, часть — только по зиме. */
function days(): ModuleDefinition[] {
  return [
    defineModule({
      id: "day-window",
      version: 1,
      kind: "timed",
      content: { strings: { ru: {}, en: {} } },
      units: [
        {
          id: "summer-day",
          role: "event",
          titleKey: "day-window.sum",
          defaultState: "disabled",
          lane: "daily",
          rotation: { lane: "daily", weight: 1, cooldownDays: 0, at: "12:00", lengthMs: DAY, seasons: ["summer"] },
        },
        {
          id: "winter-day",
          role: "event",
          titleKey: "day-window.win",
          defaultState: "disabled",
          lane: "daily",
          rotation: { lane: "daily", weight: 1, cooldownDays: 0, at: "12:00", lengthMs: DAY, seasons: ["winter"] },
        },
      ],
    }),
  ];
}

const at = (iso: string): number => Date.parse(iso);

describe("переключатели единиц", () => {
  it("спутник идёт за своей единицей: включили пору — включился вид", () => {
    // Октябрь: по календарю идёт осень.
    const now = at("2026-10-05T00:00:00Z");
    const states = unitStates({ definitions: seasons(), windows: [], now });
    const autumnLook = states.find((unit) => unit.key === "season-autumn.look");
    expect(autumnLook?.state).toBe("disabled");
    expect(autumnLook?.followsKey).toBe("season-autumn.autumn");

    // Оператор включил зиму вне календаря: зима включена, осень уступила.
    // Осень в это время идёт по календарю — ей есть что уступать.
    const calendar = [
      {
        moduleId: "season-autumn",
        unitId: "autumn",
        lane: "season" as const,
        role: "season" as const,
        key: "autumn:1",
        start: now - 30 * DAY,
        stop: now + 30 * DAY,
        source: "window" as const,
      },
    ];
    const forced = unitStates({
      definitions: seasons(),
      windows: calendar,
      now,
      units: new Map([["season-winter.winter", { state: "enabled" as const, until: now + HOUR, reason: "подготовка" }]]),
    });
    expect(forced.find((unit) => unit.key === "season-winter.winter")).toMatchObject({ state: "enabled", reason: "operator" });
    expect(forced.find((unit) => unit.key === "season-winter.look")).toMatchObject({
      state: "enabled",
      followsKey: "season-winter.winter",
    });
    expect(forced.find((unit) => unit.key === "season-autumn.autumn")).toMatchObject({
      state: "disabled",
      reason: "yielded",
      yieldedTo: "season-winter.winter",
    });
    expect(forced.filter((unit) => unit.role === "season" && unit.state === "enabled")).toHaveLength(1);

    // Спящая пора уступкой не зовётся: у лета свой отдых, а не чужая воля.
    const sleeping = unitStates({ definitions: seasons(), windows: calendar, now }).find(
      (unit) => unit.key === "season-winter.winter",
    );
    expect(sleeping?.reason).toBe("between-windows");
  });

  it("воля оператора с большим сроком сильнее короткой, и всё считается без записи", () => {
    const now = at("2026-10-05T00:00:00Z");
    const states = unitStates({
      definitions: seasons(),
      windows: [],
      now,
      units: new Map([
        ["season-autumn.autumn", { state: "enabled" as const, until: now + HOUR, reason: "короткая" }],
        ["season-winter.winter", { state: "enabled" as const, until: now + 10 * DAY, reason: "долгая" }],
      ]),
    });
    expect(states.find((unit) => unit.key === "season-winter.winter")?.state).toBe("enabled");
    expect(states.find((unit) => unit.key === "season-autumn.autumn")?.reason).toBe("yielded");
  });
});

describe("примерка поры года", () => {
  it("меняет содержимое повседневных окон, а после срока возвращает календарь", () => {
    const from = at("2027-01-10T00:00:00Z");
    const to = from + 4 * DAY;
    const seed = 1541;
    const calendar = planWindows({ modules: days(), from, to, tzOffsetMin: 0, seed });
    // Январь — зима: выпадает зимнее окно.
    expect(calendar.windows.map((window) => window.unitId)).toContain("winter-day");
    // Разогрев плана начинается раньше: проверяем дни, начавшиеся внутри примерки.
    const inside = (list: readonly { unitId: string; start: number }[], ms: number): string[] =>
      list.filter((window) => window.start >= ms).map((window) => window.unitId);

    // Примерка лета: содержимое берётся по примеряемой поре, а не по календарю.
    const rehearsal = planWindows({
      modules: days(),
      from,
      to,
      tzOffsetMin: 0,
      seed,
      seasonOverride: { season: "summer", fromMs: from, toMs: to },
    });
    expect(inside(rehearsal.windows, from)).toContain("summer-day");
    expect(inside(rehearsal.windows, from)).not.toContain("winter-day");
  });
});

describe("совместимость сборки", () => {
  it("модуль старого контракта работает, а сосед его состояний не меняет", () => {
    // Модуль собран так, как объявляли до правок ядра: без спутников и прочих
    // новых полей. Он должен проходить проверку и жить как прежде.
    const old = defineModule({
      id: "old",
      version: 1,
      kind: "timed",
      content: { strings: { ru: { "old.day": "старый день" }, en: { "old.day": "old day" } } },
      units: [
        {
          id: "day",
          role: "event",
          titleKey: "old.day",
          defaultState: "disabled",
          lane: "daily",
          rotation: { lane: "daily", weight: 1, cooldownDays: 0, at: "12:00", lengthMs: DAY },
        },
      ],
    });
    const now = at("2027-01-10T12:30:00Z");
    const plan = planWindows({ modules: [old], from: now, to: now + 3 * DAY, tzOffsetMin: 0, seed: 7 }).windows;
    const alone = unitStates({ definitions: [old], windows: plan, now });

    // Добавили соседний модуль — состояния старого не изменились ни на волос.
    const neighbour = defineModule({
      id: "new",
      version: 1,
      kind: "core",
      content: { strings: { ru: { "new.thing": "новое" }, en: { "new.thing": "new" } } },
      units: [{ id: "thing", role: "mechanic", titleKey: "new.thing" }],
    });
    const together = unitStates({ definitions: [old, neighbour], windows: plan, now });
    expect(together.filter((unit) => unit.moduleId === "old")).toEqual(alone);
  });

  it("обязательных полей у модуля не прибавилось: старый проходит проверку", () => {
    const problems = registryProblems([
      defineModule({
        id: "legacy",
        version: 1,
        kind: "core",
        content: { strings: { ru: {}, en: {} } },
      }),
    ]);
    expect(problems).toEqual([]);
  });
});

describe("проверка сборки", () => {
  it("ловит спутника без хозяина и цепочку спутников", () => {
    const problems = registryProblems([
      defineModule({
        id: "bad",
        version: 1,
        kind: "core",
        content: { strings: { ru: {}, en: {} } },
        units: [
          { id: "one", role: "mechanic", titleKey: "bad.one", follows: "нет-такой" },
          { id: "two", role: "look", titleKey: "bad.two", follows: "one" },
          { id: "three", role: "look", titleKey: "bad.three", follows: "two" },
        ],
      }),
    ]);
    expect(problems.some((problem) => problem.includes("которой в модуле нет"))).toBe(true);
    expect(problems.some((problem) => problem.includes("цепочка спутников"))).toBe(true);
  });
});
