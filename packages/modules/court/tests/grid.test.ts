import { describe, expect, it } from "vitest";
import {
  CITADEL,
  MAX_GRID,
  cellsOf,
  citadelAnchor,
  defaultRoads,
  fitsGrid,
  gridSizeAt,
  levelCost,
  sizeOf,
  startGridSize,
} from "../src/grid.js";

describe("сетка двора", () => {
  it("старт — 10×10, Цитадель в центре, дорога от её края до восточного", () => {
    expect(startGridSize()).toBe(10);
    expect(citadelAnchor(10)).toEqual({ x: 5, z: 5 });
    const roads = defaultRoads(10);
    expect(roads.map((r) => `${r.x}:${r.z}`)).toEqual(["7:5", "8:5", "9:5"]);
  });

  it("Цитадель 4×4 занимает 16 клеток и помещается в старт", () => {
    const size = sizeOf(CITADEL, {});
    expect(size).toEqual({ w: 4, h: 4 });
    const cells = cellsOf(5, 5, size);
    expect(cells).toHaveLength(16);
    expect(fitsGrid(5, 5, size, 10)).toBe(true);
    expect(fitsGrid(9, 9, size, 10)).toBe(false);
  });

  it("сетка растёт по полосам и не уменьшается", () => {
    expect(gridSizeAt(2, 10)).toBe(10);
    expect(gridSizeAt(3, 10)).toBe(12);
    expect(gridSizeAt(5, 12)).toBe(15);
    expect(gridSizeAt(30, 15)).toBe(20);
    expect(gridSizeAt(2, 15)).toBe(15);
    expect(MAX_GRID).toBe(20);
  });
});

describe("стоимость уровней", () => {
  it("уровень 1 — старт, ничего не стоит; уровень 2 Цитадели — 310 дерева", () => {
    expect(levelCost(CITADEL, 1)).toEqual({});
    expect(levelCost(CITADEL, 2)).toEqual({ wood: 310 });
  });

  it("у уровня нет строки — null (нельзя улучшить за пределы лестницы)", () => {
    expect(levelCost(CITADEL, 31)).toBeNull();
    expect(levelCost("tavern", 2)).toBeNull();
  });
});
