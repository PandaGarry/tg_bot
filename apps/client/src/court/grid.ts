/**
 * Сетка двора на стороне клиента: типы, пятна построек и перевод клетка ↔ мир.
 * Пятна — копия `FOOTPRINT` модуля court (сервер — власть).
 */

import { CELL } from "./skin/kit.js";

/** Постройка из вида: `rot` — четверти оборота по часовой стрелке (0 — вход на восток). */
export interface CourtBuildingLite {
  type: string;
  x: number;
  z: number;
  rot?: number;
}

/** Сетка двора из вида: то, что отдаёт модуль court. */
export interface CourtGridLite {
  size: number;
  buildings: CourtBuildingLite[];
  roads: { x: number; z: number }[];
}

export type CourtTool = { kind: "place"; type: string } | { kind: "road" } | null;

/** Постройка в руках игрока: новая или поднятая для переноса (`from`). */
export interface CourtPending {
  type: string;
  x: number;
  z: number;
  rot: number;
  from?: { x: number; z: number; rot: number };
}

/** Постройка, выбранная тапом. */
export interface CourtSelection {
  type: string;
  x: number;
  z: number;
  rot: number;
}

/** Клетка сетки → мир: сетка центрирована, край упирается в частокол. */
export function gridToWorld(g: number, size: number): number {
  return (g - (size - 1) / 2) * CELL;
}

/** Мир → клетка сетки. */
export function worldToCell(wx: number, wz: number, size: number) {
  return {
    x: Math.round(wx / CELL + (size - 1) / 2),
    z: Math.round(wz / CELL + (size - 1) / 2),
  };
}

/** Пятна построек [ширина, глубина] без поворота. */
export const FOOTVIEW: Record<string, [number, number]> = {
  townhall: [3, 3],
  cottage: [2, 2],
  farm: [2, 2],
  sawmill: [2, 2],
  quarry: [2, 2],
  mine: [2, 2],
  barracks: [2, 2],
  lantern: [1, 1],
  bench: [2, 1],
  well: [2, 2],
  flag: [1, 1],
  road: [1, 1],
};

/** Пятно с учётом поворота: нечётный поворот меняет ширину и глубину местами. */
export function sizeFor(type: string, rot = 0): [number, number] {
  const [w, h] = FOOTVIEW[type] ?? [1, 1];
  return rot % 2 === 1 ? [h, w] : [w, h];
}

/** Клетки, занятые постройками (переносимую можно пропустить). */
export function footprintKeys(grid: CourtGridLite, skip?: { x: number; z: number }): Set<string> {
  const set = new Set<string>();
  for (const b of grid.buildings) {
    if (skip && b.x === skip.x && b.z === skip.z) continue;
    const [w, h] = sizeFor(b.type, b.rot ?? 0);
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    for (let dx = -halfW; dx < w - halfW; dx++) {
      for (let dz = -halfH; dz < h - halfH; dz++) set.add(`${b.x + dx}:${b.z + dz}`);
    }
  }
  return set;
}

/** Центр пятна постройки в мире. */
export function centerOfBuilding(b: { type: string; x: number; z: number; rot?: number }, gridSize: number) {
  const [w, h] = sizeFor(b.type, b.rot ?? 0);
  return {
    wx: gridToWorld(b.x - Math.floor(w / 2) + (w - 1) / 2, gridSize),
    wz: gridToWorld(b.z - Math.floor(h / 2) + (h - 1) / 2, gridSize),
  };
}
