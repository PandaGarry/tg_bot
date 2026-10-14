import { describe, expect, it } from "vitest";
import { buildingById, buildings, catalogTotals } from "../src/catalog.js";

describe("каталог зданий", () => {
  it("18 зданий и Цитадель, id уникальны", () => {
    expect(buildings).toHaveLength(19);
    const ids = buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildingById("citadel")?.ru).toBe("Цитадель");
  });

  it("уровни идут по порядку до предела; Таверна без уровней", () => {
    for (const b of buildings) {
      if (b.costOpen) {
        expect(b.id).toBe("tavern");
        expect(b.levels).toHaveLength(0);
        continue;
      }
      expect(b.levels.map((l) => l.level)).toEqual(Array.from({ length: b.maxLevel }, (_, i) => i + 1));
    }
  });

  it("пределы: Торговый пост 10, Цитадель 30, остальные 30", () => {
    expect(buildingById("trade-post")?.maxLevel).toBe(10);
    expect(buildingById("citadel")?.maxLevel).toBe(30);
    expect(buildingById("wall")?.maxLevel).toBe(30);
  });

  it("сила по уровням совпадает с итогом документа (округление до 3)", () => {
    for (const b of buildings) {
      if (b.powerTotal === null) continue;
      const sum = b.levels.reduce((a, l) => a + l.power, 0);
      expect(Math.abs(sum - b.powerTotal), b.id).toBeLessThanOrEqual(3);
    }
  });

  it("якорь Цитадели: 30-й уровень — 15 000 000 дерева, 21 день", () => {
    const top = buildingById("citadel")?.levels.at(-1);
    expect(top?.wood).toBe(15_000_000);
    expect(top?.seconds).toBe(21 * 86_400);
  });

  it("суммы каталога совпадают с economy.md (после снятия лестницы Таверны)", () => {
    const t = catalogTotals();
    expect(Math.round(t.wood / 1e5) / 10).toBe(386.0);
    expect(Math.round(t.stone / 1e5) / 10).toBe(123.5);
    expect(Math.round(t.metal / 1e5) / 10).toBe(19.2);
    expect(Math.round(t.seconds / 86_400)).toBe(598);
  });
});
