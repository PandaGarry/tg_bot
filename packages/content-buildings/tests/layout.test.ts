import { describe, expect, it } from "vitest";
import { buildings, buildingById } from "../src/catalog.js";
import { GRID_BANDS, MAX_OCCUPANCY, gridSideFor, occupancy, occupiedCells, openCount } from "../src/layout.js";

describe("размеры в клетках (buildings.md, решено 14.10)", () => {
  it("каждое здание имеет размер; Цитадель 4×4, 3×3 и 2×2 по таблице", () => {
    expect(buildingById("citadel")!.footprint).toEqual({ w: 4, h: 4 });
    for (const id of ["wall", "warehouse", "infirmary", "academy", "clan-hall", "forge", "barracks", "range", "stable", "siege-yard"]) {
      expect(buildingById(id)!.footprint, id).toEqual({ w: 3, h: 3 });
    }
    for (const id of ["tavern", "watchtower", "trade-post", "sawmill", "pen", "quarry", "mine", "farm"]) {
      expect(buildingById(id)!.footprint, id).toEqual({ w: 2, h: 2 });
    }
    expect(buildings).toHaveLength(19);
  });
});

describe("открытие зданий по уровню Цитадели", () => {
  it("ресурсные растут 1 → 2 (Ц5) → 3 (Ц8) → 4 (Ц11) → 5 (Ц15)", () => {
    const sawmill = buildingById("sawmill")!;
    expect([1, 4, 5, 8, 11, 15, 30].map((c) => openCount(sawmill, c))).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });

  it("Лазарет: 5 штук на Ц2/6/10/15/20", () => {
    const inf = buildingById("infirmary")!;
    expect([1, 2, 6, 10, 15, 20].map((c) => openCount(inf, c))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("остальные здания — по одному с уровня старта", () => {
    const academy = buildingById("academy")!;
    expect(openCount(academy, 3)).toBe(0);
    expect(openCount(academy, 4)).toBe(1);
  });
});

describe("полосы площадки", () => {
  it("сторона по полосам: 10, 12 (Ц3), 15 (Ц5), 18 (Ц10), 19 (Ц15), 20 (Ц20)", () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 30].map(gridSideFor)).toEqual([10, 10, 12, 12, 15, 15, 18, 18, 19, 19, 20, 20]);
    expect(GRID_BANDS.map((b) => b.fromCitadel)).toEqual([1, 3, 5, 10, 15, 20]);
  });

  it("полная застройка — 254 клетки (сверка с buildings.md)", () => {
    expect(occupiedCells(30)).toBe(254);
  });

  it("на каждой полосе занятость не выше 80% (проверка на всех уровнях Цитадели)", () => {
    for (let c = 1; c <= 30; c++) {
      expect(occupancy(c), `Ц${c}`).toBeLessThanOrEqual(MAX_OCCUPANCY);
    }
  });

  it("старт 10×10 не вмещает набор Ц4 — поэтому веха 3 (12×12)", () => {
    expect(occupiedCells(4)).toBe(112);
    expect(112).toBeGreaterThan(10 * 10);
  });
});
