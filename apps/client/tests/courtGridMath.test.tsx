/**
 * Юнит-тесты чистой математики сетки двора: координаты, границы, пятна построек, занятость.
 */

import { describe, expect, it } from "vitest";
import {
  CELL,
  FOOTVIEW,
  buildingAt,
  footprintCells,
  footprintCenterToWorld,
  footprintKeys,
  footprintSize,
  gridToWorld,
  isFootprintFree,
  worldToCell,
  type CourtGridLite,
} from "../src/court/scene/gridMath.js";

describe("court gridMath", () => {
  it("выполняет round-trip координат для всех клеток сетки 14×14 и 22×22", () => {
    for (const size of [14, 15, 22]) {
      for (let gx = 0; gx < size; gx += 1) {
        for (let gz = 0; gz < size; gz += 1) {
          const wx = gridToWorld(gx, size);
          const wz = gridToWorld(gz, size);
          expect(worldToCell(wx, wz, size)).toEqual({ x: gx, z: gz });
        }
      }
    }
  });

  it("соблюдает границы клетки и не возвращает -0", () => {
    const size = 14;
    const wx0 = gridToWorld(0, size);
    const wz0 = gridToWorld(0, size);
    const cell0 = worldToCell(wx0 - 0.04, wz0 - 0.04, size);
    expect(Object.is(cell0.x, 0)).toBe(true);
    expect(Object.is(cell0.z, 0)).toBe(true);

    const wx5 = gridToWorld(5, size);
    expect(worldToCell(wx5 + CELL * 0.49, 0, size).x).toBe(5);
    expect(worldToCell(wx5 - CELL * 0.49, 0, size).x).toBe(5);
    expect(worldToCell(wx5 + CELL * 0.51, 0, size).x).toBe(6);
    expect(worldToCell(wx5 - CELL * 0.51, 0, size).x).toBe(4);
  });

  it("сохраняет константы пятен для всех типов построек и декора", () => {
    expect(footprintSize("townhall")).toEqual([3, 3]);
    expect(footprintSize("bench")).toEqual([2, 1]);
    expect(footprintSize("farm")).toEqual([2, 2]);
    expect(footprintSize("lantern")).toEqual([1, 1]);
    expect(footprintSize("road")).toEqual([1, 1]);
    expect(footprintSize("unknown_future_type")).toEqual([1, 1]);
    expect(Object.keys(FOOTVIEW)).toHaveLength(12);
  });

  it("вычисляет пятно 1×1, 2×1, 2×2, 3×3 и мировой центр пятна", () => {
    expect(footprintCells("lantern", 4, 5)).toEqual([{ x: 4, z: 5 }]);
    expect(footprintCells("bench", 4, 5)).toEqual([
      { x: 3, z: 5 },
      { x: 4, z: 5 },
    ]);
    expect(footprintCells("farm", 4, 5)).toEqual([
      { x: 3, z: 4 },
      { x: 3, z: 5 },
      { x: 4, z: 4 },
      { x: 4, z: 5 },
    ]);
    expect(footprintCells("townhall", 7, 7)).toHaveLength(9);

    const thCenter = footprintCenterToWorld("townhall", 7, 7, 14);
    expect(thCenter.wx).toBeCloseTo(gridToWorld(7, 14));
    expect(thCenter.wz).toBeCloseTo(gridToWorld(7, 14));

    const farmCenter = footprintCenterToWorld("farm", 4, 5, 14);
    expect(farmCenter.wx).toBeCloseTo(gridToWorld(3.5, 14));
    expect(farmCenter.wz).toBeCloseTo(gridToWorld(4.5, 14));

    const benchCenter = footprintCenterToWorld("bench", 4, 5, 14);
    expect(benchCenter.wx).toBeCloseTo(gridToWorld(3.5, 14));
    expect(benchCenter.wz).toBeCloseTo(gridToWorld(5, 14));
  });

  it("строит карту занятости, пропускает переносимую постройку и находит постройку по любой клетке пятна", () => {
    const grid: CourtGridLite = {
      size: 14,
      buildings: [
        { type: "townhall", x: 7, z: 7 },
        { type: "farm", x: 3, z: 3 },
        { type: "bench", x: 5, z: 10 },
      ],
      roads: [{ x: 9, z: 7 }],
    };

    const allBusy = footprintKeys(grid);
    expect(allBusy.size).toBe(9 + 4 + 2);
    expect(allBusy.has("6:6")).toBe(true);
    expect(allBusy.has("8:8")).toBe(true);
    expect(allBusy.has("2:2")).toBe(true);
    expect(allBusy.has("4:10")).toBe(true);

    const withoutFarm = footprintKeys(grid, { x: 3, z: 3 });
    expect(withoutFarm.has("2:2")).toBe(false);
    expect(withoutFarm.has("3:3")).toBe(false);
    expect(withoutFarm.has("7:7")).toBe(true);

    expect(buildingAt(grid, 6, 8)?.type).toBe("townhall");
    expect(buildingAt(grid, 2, 2)?.type).toBe("farm");
    expect(buildingAt(grid, 4, 10)?.type).toBe("bench");
    expect(buildingAt(grid, 5, 10)?.type).toBe("bench");
    expect(buildingAt(grid, 6, 10)).toBeNull();
    expect(buildingAt(grid, 9, 7)).toBeNull();
  });

  it("проверяет границы сетки, дороги и пересечения пятен при размещении", () => {
    const grid: CourtGridLite = {
      size: 14,
      buildings: [{ type: "townhall", x: 7, z: 7 }],
      roads: [{ x: 9, z: 7 }],
    };
    const busy = footprintKeys(grid);
    const roads = new Set(grid.roads.map((r) => `${r.x}:${r.z}`));

    // 2×2 с якорем (0, 0) занимает (-1..0, -1..0) — выходит за границу 0
    expect(isFootprintFree({ size: 14, type: "farm", gx: 0, gz: 0, busy, roads })).toBe(false);
    // 2×2 с якорем (1, 1) занимает (0..1, 0..1) — внутри и свободно
    expect(isFootprintFree({ size: 14, type: "farm", gx: 1, gz: 1, busy, roads })).toBe(true);
    // Пересечение с Ратушей (6..8, 6..8)
    expect(isFootprintFree({ size: 14, type: "farm", gx: 6, gz: 6, busy, roads })).toBe(false);
    // Пересечение с дорогой (9, 7)
    expect(isFootprintFree({ size: 14, type: "farm", gx: 10, gz: 7, busy, roads })).toBe(false);
    // Выход за правый/нижний край 14×14
    expect(isFootprintFree({ size: 14, type: "lantern", gx: 14, gz: 5, busy, roads })).toBe(false);
    expect(isFootprintFree({ size: 14, type: "lantern", gx: 13, gz: 13, busy, roads })).toBe(true);
  });
});
