/**
 * Каталог зданий двора: 18 зданий и Цитадель. Данные — из docs/balance/ladders.md
 * через tools/gen-buildings.mjs; здесь только чтение и суммы, без игровой логики.
 */
import { BUILDINGS } from "./catalog.gen.js";
import type { BuildingDef } from "./types.js";

export type { BuildingDef, BuildingLevel } from "./types.js";

export const buildings: readonly BuildingDef[] = BUILDINGS;

export function buildingById(id: string): BuildingDef | undefined {
  return buildings.find((b) => b.id === id);
}

export interface CatalogTotals {
  wood: number;
  stone: number;
  metal: number;
  /** Сумма времени всех уровней всех зданий, секунды. */
  seconds: number;
}

/** Суммы по всем уровням всех зданий (Цитадель и остальные). */
export function catalogTotals(list: readonly BuildingDef[] = buildings): CatalogTotals {
  const t: CatalogTotals = { wood: 0, stone: 0, metal: 0, seconds: 0 };
  for (const b of list) {
    for (const l of b.levels) {
      t.wood += l.wood;
      t.stone += l.stone;
      t.metal += l.metal;
      t.seconds += l.seconds;
    }
  }
  return t;
}
