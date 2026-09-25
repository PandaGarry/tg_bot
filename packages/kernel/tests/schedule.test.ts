/**
 * Расписание: точные окна, полосы, пробелы, покрытие пор года.
 * Расчёт чистый: один и тот же день даёт один и тот же план.
 */

import { describe, expect, it } from "vitest";
import {
  defineModule,
  planHorizon,
  planIsFresh,
  planProblems,
  planWindows,
  splitUnitKey,
  unitKey,
  unitStates,
  windowsActiveAt,
  windowsStartedBetween,
  type ModuleDefinition,
} from "../src/index.js";

const TZ = 180;
const SEED = 1541;
const DAY = 86_400_000;

/** Заготовка: окно дня, событие недели, праздники, часовые окна, поры года. */
const FIXTURE: ModuleDefinition[] = [
  defineModule({
    id: "fix-day",
    version: 1,
    kind: "timed",
    content: {
      strings: {
        ru: { "fix-day.a": "Сбор", "fix-day.b": "Стройка", "fix-day.c": "Марш", "fix-day.d": "Обучение", "fix-day.e": "Стража" },
        en: { "fix-day.a": "Gather", "fix-day.b": "Build", "fix-day.c": "March", "fix-day.d": "Train", "fix-day.e": "Watch" },
      },
    },
    units: ["a", "b", "c", "d", "e"].map((id, index) => ({
      id,
      role: "event" as const,
      titleKey: `fix-day.${id}`,
      defaultState: "disabled" as const,
      lane: "daily" as const,
      rotation: { lane: "daily" as const, weight: index + 1, cooldownDays: 4, at: "12:00", lengthMs: DAY },
    })),
  }),
  defineModule({
    id: "fix-week",
    version: 1,
    kind: "timed",
    content: {
      strings: { ru: { "fix-week.a": "Урожай", "fix-week.b": "Кузня" }, en: { "fix-week.a": "Harvest", "fix-week.b": "Forge" } },
    },
    units: ["a", "b"].map((id) => ({
      id,
      role: "event" as const,
      titleKey: `fix-week.${id}`,
      defaultState: "disabled" as const,
      lane: "weekly" as const,
      rotation: {
        lane: "weekly" as const,
        weight: 1,
        cooldownDays: 7,
        at: "00:00",
        lengthMs: 6 * DAY,
        weekdays: [0] as const,
      },
    })),
  }),
  defineModule({
    id: "fix-feast",
    version: 1,
    kind: "timed",
    content: {
      strings: {
        ru: { "fix-feast.easter": "Пасха", "fix-feast.halloween": "Хеллоуин", "fix-feast.new-year": "Новый год" },
        en: { "fix-feast.easter": "Easter", "fix-feast.halloween": "Halloween", "fix-feast.new-year": "New Year" },
      },
    },
    units: [
      {
        id: "easter",
        role: "event",
        titleKey: "fix-feast.easter",
        defaultState: "disabled",
        lane: "feast",
        window: { repeat: { kind: "movable", feast: "easter", offsetDays: -5 }, at: "00:00", lengthMs: 10 * DAY },
      },
      {
        id: "halloween",
        role: "event",
        titleKey: "fix-feast.halloween",
        defaultState: "disabled",
        lane: "feast",
        window: { repeat: { kind: "yearly", month: 10, day: 25 }, at: "00:00", lengthMs: 7 * DAY },
      },
      {
        id: "new-year",
        role: "event",
        titleKey: "fix-feast.new-year",
        defaultState: "disabled",
        lane: "feast",
        window: {
          repeat: { kind: "yearly", month: 12, day: 20 },
          at: "00:00",
          lengthMs: 16 * DAY,
          until: { month: 1, day: 5 },
        },
      },
    ],
  }),
  defineModule({
    id: "fix-hour",
    version: 1,
    kind: "timed",
    content: {
      strings: { ru: { "fix-hour.a": "Стража", "fix-hour.b": "Обоз" }, en: { "fix-hour.a": "Watch", "fix-hour.b": "Caravan" } },
    },
    units: [
      { id: "watch", hour: "18:00" },
      { id: "caravan", hour: "20:00" },
    ].map((entry) => ({
      id: entry.id,
      role: "event" as const,
      titleKey: `fix-hour.${entry.id === "watch" ? "a" : "b"}`,
      defaultState: "disabled" as const,
      lane: "hourly" as const,
      rotation: { lane: "hourly" as const, weight: 1, cooldownDays: 1, at: entry.hour, lengthMs: 3_600_000 },
    })),
  }),
  defineModule({
    id: "fix-spring",
    version: 1,
    kind: "seasonal",
    content: { strings: { ru: { "fix-spring.n": "Весна" }, en: { "fix-spring.n": "Spring" } } },
    units: [
      {
        id: "spring",
        role: "season",
        titleKey: "fix-spring.n",
        defaultState: "disabled",
        lane: "season",
        window: {
          repeat: { kind: "yearly", month: 3, day: 1 },
          at: "00:00",
          lengthMs: 92 * DAY,
          until: { month: 6, day: 1 },
        },
      },
    ],
  }),
  defineModule({
    id: "fix-summer",
    version: 1,
    kind: "seasonal",
    content: { strings: { ru: { "fix-summer.n": "Лето" }, en: { "fix-summer.n": "Summer" } } },
    units: [
      {
        id: "summer",
        role: "season",
        titleKey: "fix-summer.n",
        defaultState: "disabled",
        lane: "season",
        window: {
          repeat: { kind: "yearly", month: 6, day: 1 },
          at: "00:00",
          lengthMs: 92 * DAY,
          until: { month: 9, day: 1 },
        },
      },
    ],
  }),
  defineModule({
    id: "fix-autumn",
    version: 1,
    kind: "seasonal",
    content: { strings: { ru: { "fix-autumn.n": "Осень" }, en: { "fix-autumn.n": "Autumn" } } },
    units: [
      {
        id: "autumn",
        role: "season",
        titleKey: "fix-autumn.n",
        defaultState: "disabled",
        lane: "season",
        window: {
          repeat: { kind: "yearly", month: 9, day: 1 },
          at: "00:00",
          lengthMs: 91 * DAY,
          until: { month: 12, day: 1 },
        },
      },
    ],
  }),
  defineModule({
    id: "fix-winter",
    version: 1,
    kind: "seasonal",
    content: { strings: { ru: { "fix-winter.n": "Зима" }, en: { "fix-winter.n": "Winter" } } },
    units: [
      {
        id: "winter",
        role: "season",
        titleKey: "fix-winter.n",
        defaultState: "disabled",
        lane: "season",
        window: {
          repeat: { kind: "yearly", month: 12, day: 1 },
          at: "00:00",
          lengthMs: 90 * DAY,
          until: { month: 3, day: 1 },
        },
      },
    ],
  }),
];

function plan(fromIso: string, toIso: string, modules: readonly ModuleDefinition[] = FIXTURE) {
  return planWindows({
    modules,
    from: Date.parse(fromIso),
    to: Date.parse(toIso),
    tzOffsetMin: TZ,
    seed: SEED,
  });
}

describe("расписание", () => {
  it("полосы заготовки проходят проверку за 2027 год", () => {
    const problems = planProblems({ modules: FIXTURE, from: 0, to: 0, tzOffsetMin: TZ, seed: SEED }, 2027);
    expect(problems).toEqual([]);
  });

  it("в любой день года идёт ровно одно окно дня", () => {
    const { windows } = plan("2027-01-01T00:00:00Z", "2027-04-01T00:00:00Z");
    const daily = windows.filter((window) => window.lane === "daily");
    expect(daily.length).toBeGreaterThanOrEqual(90);
    for (const window of daily) {
      expect(window.stop - window.start).toBe(86_400_000);
    }
    // Соседние окна стыкуются: дыр нет.
    const sorted = [...daily].sort((left, right) => left.start - right.start);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]!.start).toBe(sorted[index - 1]!.stop);
    }
  });

  it("событие недели начинается в понедельник и идёт шесть дней", () => {
    const { windows } = plan("2027-01-01T00:00:00Z", "2027-03-01T00:00:00Z");
    const weekly = windows.filter((window) => window.lane === "weekly");
    expect(weekly.length).toBeGreaterThanOrEqual(6);
    for (const window of weekly) {
      // 00:00 по часам мира (МСК) — это 21:00 предыдущего дня по UTC.
      const local = new Date(window.start + TZ * 60_000);
      expect(local.getUTCDay()).toBe(1);
      expect(local.getUTCHours()).toBe(0);
      expect(window.stop - window.start).toBe(6 * 86_400_000);
    }
  });

  it("праздники не накладываются и держат просвет не меньше недели", () => {
    const { windows } = plan("2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z");
    const feast = windows.filter((window) => window.lane === "feast").sort((left, right) => left.start - right.start);
    expect(feast.map((window) => window.unitId)).toContain("halloween");
    expect(feast.map((window) => window.unitId)).toContain("easter");
    expect(feast.map((window) => window.unitId)).toContain("new-year");
    for (let index = 1; index < feast.length; index += 1) {
      const gap = feast[index]!.start - feast[index - 1]!.stop;
      expect(gap).toBeGreaterThanOrEqual(7 * 86_400_000);
    }
  });

  it("Пасха считается: 2026 — 5 апреля, окно открывается за пять дней", () => {
    const { windows } = plan("2026-03-01T00:00:00Z", "2026-05-01T00:00:00Z");
    const easter = windows.find((window) => window.unitId === "easter");
    expect(easter).toBeDefined();
    const local = new Date(easter!.start + TZ * 60_000);
    expect(`${local.getUTCFullYear()}-${local.getUTCMonth() + 1}-${local.getUTCDate()}`).toBe("2026-3-31");
    expect(easter!.stop - easter!.start).toBe(10 * 86_400_000);
  });

  it("поры года стыкуются встык: в любой миг включена ровно одна", () => {
    const { windows } = plan("2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z");
    const start2027 = Date.parse("2027-01-01T00:00:00Z");
    const seasonLane = windows.filter((window) => window.lane === "season");
    const season = seasonLane.filter((window) => window.start >= start2027);
    expect(season.map((window) => window.unitId)).toEqual(["spring", "summer", "autumn", "winter"]);
    const sorted = [...season].sort((left, right) => left.start - right.start);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]!.start).toBe(sorted[index - 1]!.stop);
    }
    for (const moment of ["2027-02-15T12:00:00Z", "2027-07-15T12:00:00Z", "2027-11-15T12:00:00Z", "2027-12-25T12:00:00Z"]) {
      const active = windowsActiveAt(seasonLane, Date.parse(moment));
      expect(active).toHaveLength(1);
    }
  });

  it("одна и та же единица не выпадает чаще кулдауна, вчерашняя не повторяется", () => {
    const { windows } = plan("2027-01-01T00:00:00Z", "2027-04-01T00:00:00Z");
    const daily = windows.filter((window) => window.lane === "daily").sort((left, right) => left.start - right.start);
    const lastSeen = new Map<string, number>();
    for (let index = 0; index < daily.length; index += 1) {
      const window = daily[index]!;
      const previous = daily[index - 1];
      if (previous) expect(window.unitId).not.toBe(previous.unitId);
      const seen = lastSeen.get(window.unitId);
      if (seen !== undefined) {
        const days = (window.start - seen) / 86_400_000;
        expect(days).toBeGreaterThanOrEqual(4);
      }
      lastSeen.set(window.unitId, window.start);
    }
  });

  it("часовые окна: не больше двух в сутки и не ближе часа", () => {
    const { windows } = plan("2027-05-01T00:00:00Z", "2027-06-01T00:00:00Z");
    const hourly = windows.filter((window) => window.lane === "hourly").sort((left, right) => left.start - right.start);
    expect(hourly.length).toBeGreaterThan(0);
    let day = "";
    let perDay = 0;
    let previousStop = -Infinity;
    for (const window of hourly) {
      const local = new Date(window.start + TZ * 60_000).toISOString().slice(0, 10);
      if (local !== day) {
        day = local;
        perDay = 0;
      }
      perDay += 1;
      expect(perDay).toBeLessThanOrEqual(2);
      if (previousStop > -Infinity) expect(window.start - previousStop).toBeGreaterThanOrEqual(3_600_000);
      previousStop = window.stop;
      expect(window.stop - window.start).toBe(3_600_000);
    }
  });

  it("план повторяем и окна не накладываются внутри полосы", () => {
    const first = plan("2027-03-01T00:00:00Z", "2027-06-01T00:00:00Z");
    const second = plan("2027-03-01T00:00:00Z", "2027-06-01T00:00:00Z");
    expect(second.windows.map((window) => window.key)).toEqual(first.windows.map((window) => window.key));

    const byLane = new Map<string, typeof first.windows>();
    for (const window of first.windows) {
      if (!window.lane) continue;
      const list = byLane.get(window.lane) ?? [];
      list.push(window);
      byLane.set(window.lane, list);
    }
    for (const [lane, list] of byLane) {
      const sorted = [...list].sort((left, right) => left.start - right.start);
      for (let index = 1; index < sorted.length; index += 1) {
        if (lane === "season") continue;
        expect(sorted[index]!.start).toBeGreaterThanOrEqual(sorted[index - 1]!.stop);
      }
    }
  });

  it("кончившиеся и начавшиеся окна видны по границам", () => {
    const { windows } = plan("2027-03-01T00:00:00Z", "2027-04-01T00:00:00Z");
    const from = Date.parse("2027-03-05T00:00:00Z");
    const to = Date.parse("2027-03-06T00:00:00Z");
    const started = windowsStartedBetween(windows, from, to);
    expect(started.length).toBeGreaterThan(0);
    for (const window of started) {
      expect(window.start).toBeGreaterThan(from);
      expect(window.start).toBeLessThanOrEqual(to);
    }
  });

  it("окно не влезает в полосу — причина записана, а не потеряна", () => {
    const crowded: ModuleDefinition = defineModule({
      id: "crowded",
      version: 1,
      kind: "timed",
      content: {
        strings: {
          ru: { "crowded.a": "A", "crowded.b": "B", "crowded.c": "C" },
          en: { "crowded.a": "A", "crowded.b": "B", "crowded.c": "C" },
        },
      },
      units: [
        { id: "a", day: 10 },
        { id: "b", day: 12 },
        { id: "c", day: 17 },
      ].map((entry) => ({
        id: entry.id,
        role: "event" as const,
        titleKey: `crowded.${entry.id}`,
        defaultState: "disabled" as const,
        lane: "feast" as const,
        window: {
          repeat: { kind: "yearly" as const, month: 1, day: entry.day },
          at: "00:00",
          lengthMs: 3 * DAY,
        },
      })),
    });
    const { windows, skipped } = planWindows({
      modules: [crowded],
      from: Date.parse("2027-01-01T00:00:00Z"),
      to: Date.parse("2027-02-01T00:00:00Z"),
      tzOffsetMin: TZ,
      seed: 1,
    });
    expect(windows.filter((window) => window.source === "window")).toHaveLength(1);
    // Планирование идёт от якоря, поэтому причины собираем по видам: и за 2026, и за 2027.
    expect([...new Set(skipped.map((note) => note.reason))].sort()).toEqual(["lane-busy", "lane-gap"]);
    expect(skipped.every((note) => note.dayIndex > 0)).toBe(true);
  });
});

describe("переключатели единиц", () => {
  const day = (iso: string): number => Date.parse(iso);
  it("событие включено в окне и выключено между окнами", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    // Пасха 2027 — 28 марта, окно открывается за пять дней: 23 марта.
    const inside = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-03-25T12:00:00Z") });
    const outside = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-07-20T12:00:00Z") });

    const easter = inside.find((unit) => unit.unitId === "easter")!;
    expect(easter.state).toBe("enabled");
    expect(easter.reason).toBe("window");
    expect(easter.window?.key).toContain("easter:");

    const easterOut = outside.find((unit) => unit.unitId === "easter")!;
    expect(easterOut.state).toBe("disabled");
    expect(easterOut.reason).toBe("between-windows");
    expect(easterOut.window).toBeUndefined();
  });

  it("окно дня включено круглые сутки, а часовое — только свой час", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    const states = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-01-10T12:00:00Z") });
    const daily = states.filter((unit) => unit.lane === "daily");
    expect(daily.filter((unit) => unit.state === "enabled")).toHaveLength(1);

    const hour = states.find((unit) => unit.unitId === "watch")!;
    expect(hour.lane).toBe("hourly");
    // Часовые окна идут по 18:00 и 20:00 по часам мира: в полдень молчат.
    expect(hour.state).toBe("disabled");
  });

  it("пора года идёт всегда ровно одна", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    for (const moment of ["2027-01-15T00:00:00Z", "2027-05-15T00:00:00Z", "2027-08-15T00:00:00Z", "2027-11-15T00:00:00Z"]) {
      const states = unitStates({ definitions: FIXTURE, windows: plan2027, now: day(moment) });
      const on = states.filter((unit) => unit.lane === "season" && unit.state === "enabled");
      expect(on).toHaveLength(1);
      expect(on[0]!.reason).toBe("window");
    }
  });

  it("оператор сильнее расписания и модуля, а срок сам снимает запрет", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    const until = day("2027-03-27T00:00:00Z");

    const override = new Map([["fix-feast.easter", { state: "disabled" as const, until, reason: "сломался" }]]);
    const quarantined = unitStates({
      definitions: FIXTURE,
      windows: plan2027,
      now: day("2027-03-25T12:00:00Z"),
      units: override,
    });
    const easter = quarantined.find((unit) => unit.unitId === "easter")!;
    expect(easter.state).toBe("disabled");
    expect(easter.reason).toBe("quarantine");
    expect(easter.until).toBe(until);
    expect(easter.window?.key).toContain("easter:");

    const after = unitStates({
      definitions: FIXTURE,
      windows: plan2027,
      now: day("2027-03-28T12:00:00Z"),
      units: override,
    });
    expect(after.find((unit) => unit.unitId === "easter")!.state).toBe("enabled");
  });

  it("выключенный модуль гасит все свои единицы", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    const states = unitStates({
      definitions: FIXTURE,
      windows: plan2027,
      now: day("2027-01-10T12:00:00Z"),
      modules: new Map([["fix-feast", { state: "disabled" as const }]]),
    });
    const feast = states.filter((unit) => unit.moduleId === "fix-feast");
    expect(feast.length).toBeGreaterThan(0);
    for (const unit of feast) {
      expect(unit.state).toBe("disabled");
      expect(unit.reason).toBe("module-off");
    }
  });

  it("запрет со сроком снимается сам, а без срока держится", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    const until = day("2027-01-05T00:00:00Z");
    const closed = new Map([["fix-feast", { state: "disabled" as const, until }]]);
    const locked = new Map([["fix-feast", { state: "disabled" as const }]]);

    const during = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-01-03T00:00:00Z"), modules: closed });
    expect(during.every((unit) => unit.moduleId !== "fix-feast" || unit.state === "disabled")).toBe(true);

    // Срок вышел — модуль сам вернулся в строй, и событие снова ждёт своё окно.
    const after = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-01-06T00:00:00Z"), modules: closed });
    const easter = after.find((unit) => unit.unitId === "easter")!;
    expect(easter.state).toBe("disabled");
    expect(easter.reason).toBe("between-windows");

    const forever = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-06-06T00:00:00Z"), modules: locked });
    expect(forever.every((unit) => unit.moduleId !== "fix-feast" || unit.state === "disabled")).toBe(true);
  });

  it("классическая механика не гаснет сама", () => {
    const plan2027 = plan("2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z").windows;
    const states = unitStates({ definitions: FIXTURE, windows: plan2027, now: day("2027-06-01T00:00:00Z") });
    expect(states.map((unit) => unit.key)).toContain("fix-day.a");
    expect(states.every((unit) => unit.moduleId.startsWith("fix-"))).toBe(true);
  });

  it("план пересчитывается заранее, а не по факту конца", () => {
    // Долгих окон нет: горизонт кончается вместе с промежутком.
    const short = FIXTURE.filter((module) => module.id === "fix-day");
    const { windows } = planWindows({
      modules: short,
      from: day("2027-01-01T00:00:00Z"),
      to: day("2027-06-01T00:00:00Z"),
      tzOffsetMin: TZ,
      seed: SEED,
    });
    expect(planHorizon(windows)).toBeLessThan(day("2027-06-03T00:00:00Z"));
    expect(planIsFresh(windows, day("2027-05-20T00:00:00Z"), 7 * 86_400_000)).toBe(true);
    expect(planIsFresh(windows, day("2027-05-28T00:00:00Z"), 7 * 86_400_000)).toBe(false);
  });

  it("ключ единицы склеивается и разбирается без потерь", () => {
    expect(unitKey("fix-feast", "halloween")).toBe("fix-feast.halloween");
    expect(splitUnitKey("fix-feast.halloween")).toEqual({ moduleId: "fix-feast", unitId: "halloween" });
    expect(splitUnitKey("fix-feast")).toBeNull();
    expect(splitUnitKey(".a")).toBeNull();
    expect(splitUnitKey("a.")).toBeNull();
  });
});
