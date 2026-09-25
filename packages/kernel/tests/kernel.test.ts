import { describe, expect, it } from "vitest";
import { applyStockDeltas, clampToLimit, gatheredAmount, mergeStockEffects } from "../src/stock.js";
import { modulateDetailed, normalizeLimit } from "../src/modulate.js";
import { downtimeMs, monotonicWorldNow, remainingLabel, shiftWakeAt } from "../src/time.js";
import { buildRegistry, registryProblems } from "../src/registry.js";
import { defineCommand, defineModule, type ModifierDecl } from "../src/index.js";
import type { ModifierInput, ModifierEnv, WorldFacts } from "../src/index.js";

const world: WorldFacts = {
  id: "w1",
  name: "Первый мир",
  seed: 1541,
  size: 200,
  zones: 5,
  zonePit: 4,
  zoneCapital: 5,
  now: 1_000_000,
  downtimeMs: 0,
};

const env: ModifierEnv = { world, stock: {}, facts: {} };
const validator = { parse: (input: unknown) => input as Record<string, number> };

describe("склад", () => {
  it("складывает дельты и не уходит в минус", () => {
    const result = applyStockDeltas({ meat: 10, wood: 0 }, [
      { kind: "stock", resource: "meat", delta: 5 },
      { kind: "stock", resource: "wood", delta: -3 },
    ]);
    expect(result.next).toEqual({ meat: 15, wood: 0 });
    expect(result.deficits).toEqual(["wood"]);
  });

  it("сливает дельты одного ресурса в одну строку", () => {
    const merged = mergeStockEffects([
      { kind: "stock", resource: "meat", delta: 5 },
      { kind: "stock", resource: "meat", delta: -2 },
      { kind: "stock", resource: "wood", delta: 0 },
    ]);
    expect(merged).toEqual([{ kind: "stock", resource: "meat", delta: 3 }]);
  });

  it("держит ресурсы целыми", () => {
    const result = applyStockDeltas({ meat: 1 }, [{ kind: "stock", resource: "meat", delta: 1.5 }]);
    expect(result.next.meat).toBe(1);
    expect(result.deficits).toEqual(["meat"]);
  });

  it("обрезает склад по пределу", () => {
    expect(clampToLimit(120, 100)).toBe(100);
    expect(clampToLimit(80, 100)).toBe(80);
    expect(clampToLimit(80, undefined)).toBe(80);
  });

  it("сбор считает время, остаток точки и груз", () => {
    // 100 в час, 18 минут — 30; остаток точки 20 — берём 20.
    expect(gatheredAmount(100, 18 * 60_000, 20, 1_000)).toBe(20);
    // Груз 25 — берём 25.
    expect(gatheredAmount(100, 18 * 60_000, 1_000, 25)).toBe(25);
    // Ничего не прошло — ноль.
    expect(gatheredAmount(100, 0, 1_000, 1_000)).toBe(0);
  });
});

describe("модификаторы", () => {
  const sources = [
    {
      moduleId: "court",
      modifiers: [
        { id: "warehouse", phase: "limit", priority: 10, apply: () => ({ add: 500 }) } as ModifierDecl,
      ],
    },
    {
      moduleId: "research",
      modifiers: [
        { id: "farm_1", phase: "production", priority: 20, apply: () => ({ mul: 0.1 }) } as ModifierDecl,
        { id: "lord_farm", phase: "production", priority: 10, apply: () => ({ mul: 0.05 }) } as ModifierDecl,
      ],
    },
  ];

  it("идёт по приоритету, а не по порядку объявления", () => {
    const details = modulateDetailed({
      phase: "production",
      base: 100,
      sources,
      env,
      input: { resource: "mushrooms" } as ModifierInput,
    });
    // 100 × 1.05 = 105, затем × 1.1 = 115.5
    expect(details.value).toBeCloseTo(115.5, 6);
    expect(details.parts.map((part) => part.modifierId)).toEqual(["lord_farm", "farm_1"]);
  });

  it("фаза без модификаторов отдаёт базу", () => {
    const details = modulateDetailed({ phase: "gather", base: 7, sources, env });
    expect(details.value).toBe(7);
    expect(details.parts).toEqual([]);
  });

  it("предел не уходит в минус", () => {
    expect(normalizeLimit(-5)).toBe(0);
    expect(normalizeLimit(12.7)).toBe(12);
  });
});

describe("часы мира", () => {
  it("простой считается от последнего пульса", () => {
    expect(downtimeMs(1_000_000, 940_000)).toBe(60_000);
  });

  it("прыжок часов назад простоем не считается", () => {
    expect(downtimeMs(900_000, 1_000_000)).toBe(0);
  });

  it("срок сдвигается на простой, мировое время назад не идёт", () => {
    expect(shiftWakeAt(5_000, 60_000)).toBe(65_000);
    expect(monotonicWorldNow(1_000, 5_000)).toBe(5_000);
    expect(monotonicWorldNow(6_000, 5_000)).toBe(6_000);
  });

  it("ступенька таймера читается игроком", () => {
    expect(remainingLabel(30_000)).toEqual({ value: 30, unit: "s" });
    expect(remainingLabel(600_000)).toEqual({ value: 10, unit: "m" });
    expect(remainingLabel(7_200_000)).toEqual({ value: 2, unit: "h" });
    expect(remainingLabel(172_800_000)).toEqual({ value: 2, unit: "d" });
  });
});

describe("реестр", () => {
  const probe = defineModule({
    id: "probe",
    version: 1,
    kind: "core",
    content: { strings: { ru: { "probe.hello": "Привет" }, en: { "probe.hello": "Hello" } } },
    rules: {
      resources: [{ id: "dust", storage: "warehouse" }],
      modifiers: [
        { id: "dust_bonus", phase: "production", priority: 10, apply: () => ({ mul: 0.1 }) },
      ],
    },
    server: {
      commands: [
        defineCommand({
          id: "probe.poke",
          input: validator,
          handle: () => [{ kind: "stock", resource: "dust", delta: 1 }],
        }),
      ],
    },
    client: { slots: [{ slot: "hud.resources", id: "probe.hud" }] },
  });

  it("собирает порядок загрузки по зависимостям", () => {
    const registry = buildRegistry([
      defineModule({ id: "b", version: 1, kind: "core", depends: ["a"], content: { strings: { ru: {}, en: {} } } }),
      defineModule({ id: "a", version: 1, kind: "core", content: { strings: { ru: {}, en: {} } } }),
    ]);
    expect([...registry.order]).toEqual(["a", "b"]);
  });

  it("падает, если ключ есть только в одном языке", () => {
    const problems = registryProblems([
      defineModule({
        id: "bad",
        version: 1,
        kind: "core",
        content: { strings: { ru: { "a.b": "текст" }, en: {} } },
      }),
    ]);
    expect(problems.some((problem) => problem.includes("a.b"))).toBe(true);
  });

  it("падает на двух модификаторах одной фазы с одним приоритетом", () => {
    const problems = registryProblems([
      defineModule({
        id: "one",
        version: 1,
        kind: "core",
        content: { strings: { ru: {}, en: {} } },
        rules: {
          modifiers: [{ id: "m", phase: "strike", priority: 5, apply: () => ({}) }],
        },
      }),
      defineModule({
        id: "two",
        version: 1,
        kind: "core",
        content: { strings: { ru: {}, en: {} } },
        rules: {
          modifiers: [{ id: "m", phase: "strike", priority: 5, apply: () => ({}) }],
        },
      }),
    ]);
    expect(problems.some((problem) => problem.includes("приоритет занят"))).toBe(true);
  });

  it("падает на чужом гнезде, отсутствующей зависимости и занятом id", () => {
    const problems = registryProblems([
      defineModule({
        id: "x",
        version: 1,
        kind: "core",
        depends: ["nope"],
        content: { strings: { ru: {}, en: {} } },
        client: { slots: [{ slot: "court.view" as never, id: "x.view" }] },
      }),
      defineModule({ id: "x", version: 1, kind: "core", content: { strings: { ru: {}, en: {} } } }),
    ]);
    expect(problems.some((problem) => problem.includes("id занят"))).toBe(true);
    expect(problems.some((problem) => problem.includes("nope"))).toBe(true);
  });

  it("видит цикл в зависимостях", () => {
    const problems = registryProblems([
      defineModule({ id: "a", version: 1, kind: "core", depends: ["b"], content: { strings: { ru: {}, en: {} } } }),
      defineModule({ id: "b", version: 1, kind: "core", depends: ["a"], content: { strings: { ru: {}, en: {} } } }),
    ]);
    expect(problems.some((problem) => problem.includes("цикл"))).toBe(true);
  });

  it("принимает пробный модуль", () => {
    const registry = buildRegistry([probe]);
    expect(registry.byId.get("probe")?.rules?.resources?.[0]?.id).toBe("dust");
  });
});
