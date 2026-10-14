/**
 * Геометрия двора: клетки, пятна построек, полосы площадки и стоимость уровней.
 * Чистые функции без состояния и без базы — их проверяют тесты модуля.
 *
 * Данные зданий — из `@tdl/content-buildings` (docs/design/buildings.md, решено 14.10).
 */
import { buildingById } from "@tdl/content-buildings/catalog";
import { gridSideFor } from "@tdl/content-buildings/layout";

/** Цитадель — центральное здание двора (вместо Ратуши). */
export const CITADEL = "citadel";
/** Самая большая площадка по полосам (Цитадель 20+). */
export const MAX_GRID = 20;

export interface Size {
  w: number;
  h: number;
}

/** Смещения пятна относительно якоря: якорь — центр пятна, как и раньше. */
export function footprintBounds(size: Size): { fromX: number; toX: number; fromZ: number; toZ: number } {
  const halfW = Math.floor(size.w / 2);
  const halfH = Math.floor(size.h / 2);
  return { fromX: -halfW, toX: size.w - halfW - 1, fromZ: -halfH, toZ: size.h - halfH - 1 };
}

/** Размер пятна типа: из каталога зданий или декора. */
export function sizeOf(type: string, decorSizes: Record<string, [number, number]>): Size {
  const def = buildingById(type);
  if (def) return def.footprint;
  const decor = decorSizes[type];
  return decor ? { w: decor[0], h: decor[1] } : { w: 1, h: 1 };
}

/** Клетки, которые занимает пятно с якорем (x, z), строками «x:z». */
export function cellsOf(x: number, z: number, size: Size): string[] {
  const b = footprintBounds(size);
  const out: string[] = [];
  for (let dx = b.fromX; dx <= b.toX; dx += 1) {
    for (let dz = b.fromZ; dz <= b.toZ; dz += 1) out.push(`${x + dx}:${z + dz}`);
  }
  return out;
}

/** Пятно целиком внутри сетки. */
export function fitsGrid(x: number, z: number, size: Size, gridSize: number): boolean {
  const b = footprintBounds(size);
  return x + b.fromX >= 0 && z + b.fromZ >= 0 && x + b.toX <= gridSize - 1 && z + b.toZ <= gridSize - 1;
}

/** Центр сетки для Цитадели 4×4 (якорь — центр пятна). */
export function citadelAnchor(gridSize: number): { x: number; z: number } {
  const c = Math.floor(gridSize / 2);
  return { x: c, z: c };
}

/** Стартовая сетка: 10×10, Цитадель в центре, дорога от восточного края к Цитадели. */
export function startGridSize(): number {
  return gridSideFor(1);
}

export function defaultRoads(gridSize: number): { x: number; z: number }[] {
  const anchor = citadelAnchor(gridSize);
  // От Цитадели к восточному краю: клетки справа от пятна.
  const from = anchor.x + footprintBounds({ w: 4, h: 4 }).toX + 1;
  const roads: { x: number; z: number }[] = [];
  for (let x = from; x <= gridSize - 1; x += 1) roads.push({ x, z: anchor.z });
  return roads;
}

/** Сторона сетки по уровню Цитадели; сетка не уменьшается. */
export function gridSizeAt(citadelLevel: number, current: number): number {
  return Math.max(current, gridSideFor(citadelLevel));
}

/**
 * Стоимость уровня здания (дерево, камень, металл), без нулевых строк.
 * Уровень 1 — «старт» (0): постановка по лестнице ничего не стоит (открыто, см. DECISIONS 14.10).
 */
export function levelCost(type: string, level: number): Partial<Record<"wood" | "stone" | "metal", number>> | null {
  const def = buildingById(type);
  if (!def) return null;
  const row = def.levels[level - 1];
  if (!row) return null;
  const cost: Partial<Record<"wood" | "stone" | "metal", number>> = {};
  if (row.wood) cost.wood = row.wood;
  if (row.stone) cost.stone = row.stone;
  if (row.metal) cost.metal = row.metal;
  return cost;
}
