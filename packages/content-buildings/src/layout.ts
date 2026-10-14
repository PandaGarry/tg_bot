/**
 * Раскладка двора: сколько зданий каждого типа открыто на уровне Цитадели,
 * сколько клеток они занимают и какого размера площадка на каждой полосе.
 *
 * Правила — из docs/design/buildings.md (раздел «Лимиты строительства» и
 * «Размер в клетках»), решено 10.10 и 14.10. Размеры зданий — из каталога.
 * Модуль чистый: без состояния и без записи в базу.
 */
import { buildings } from "./catalog.js";
import type { BuildingDef } from "./types.js";

/** Полосы площадки: с какого уровня Цитадели действует сторона (в клетках). */
export const GRID_BANDS: readonly { fromCitadel: number; side: number }[] = [
  { fromCitadel: 1, side: 10 },
  { fromCitadel: 3, side: 12 },
  { fromCitadel: 5, side: 15 },
  { fromCitadel: 10, side: 18 },
  { fromCitadel: 15, side: 19 },
  { fromCitadel: 20, side: 20 },
];

/** Предел занятости клеток на полосе (остальное — дорожки, декор, перестановка). Предложено 14.10: 80%, см. DECISIONS. */
export const MAX_OCCUPANCY = 0.8;

/** Ресурсные здания растут по Цитадели: уровень Цитадели → число штук. */
const RESOURCE_GROWTH: readonly [number, number][] = [
  [5, 2],
  [8, 3],
  [11, 4],
  [15, 5],
];
const RESOURCE_IDS = new Set(["sawmill", "pen", "quarry", "mine", "farm"]);

/** Лазарет: пять штук, открываются на Ц2/6/10/15/20. */
const INFIRMARY_OPENS = [2, 6, 10, 15, 20];

export function gridSideFor(citadel: number): number {
  let side = GRID_BANDS[0]!.side;
  for (const band of GRID_BANDS) if (citadel >= band.fromCitadel) side = band.side;
  return side;
}

/** Сколько штук здания открыто на уровне Цитадели (0 — ещё не открыто). */
export function openCount(def: BuildingDef, citadel: number): number {
  if (def.id === "citadel") return 1;
  if (citadel < def.startCitadel) return 0;
  if (def.id === "infirmary") return INFIRMARY_OPENS.filter((t) => citadel >= t).length;
  if (RESOURCE_IDS.has(def.id)) {
    let n = 1;
    for (const [t, count] of RESOURCE_GROWTH) if (citadel >= t) n = count;
    return n;
  }
  // Остальные здания строятся один раз.
  return 1;
}

/** Клетки, которые заняты при данном уровне Цитадели, если открыто всё, что открыто. */
export function occupiedCells(citadel: number, list: readonly BuildingDef[] = buildings): number {
  let cells = 0;
  for (const def of list) cells += openCount(def, citadel) * def.footprint.w * def.footprint.h;
  return cells;
}

/** Занятость площадки, доля 0..1. */
export function occupancy(citadel: number, list: readonly BuildingDef[] = buildings): number {
  const side = gridSideFor(citadel);
  return occupiedCells(citadel, list) / (side * side);
}
