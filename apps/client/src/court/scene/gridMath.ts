/**
 * Чистая математика сетки двора: координаты, пятна построек и проверка занятости.
 * Не зависит от Three.js и React; семантика полностью повторяет модульный контракт court.
 */

export const CELL = 1.1;

export interface CourtGridCell {
  x: number;
  z: number;
}

export interface CourtGridBuilding {
  type: string;
  x: number;
  z: number;
}

export interface CourtGridLite {
  size: number;
  buildings: CourtGridBuilding[];
  roads: CourtGridCell[];
}

/** Пятна построек [ширина, глубина] — копия FOOTPRINT модуля court (сервер — власть). */
export const FOOTVIEW: Record<string, readonly [number, number]> = {
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

export function footprintSize(type: string): readonly [number, number] {
  return FOOTVIEW[type] ?? [1, 1];
}

/** Клетка сетки → мир: сетка центрирована, край упирается в частокол. */
export function gridToWorld(g: number, size: number): number {
  return (g - (size - 1) / 2) * CELL;
}

/** Мир → клетка сетки. */
export function worldToCell(wx: number, wz: number, size: number): CourtGridCell {
  return {
    x: Math.round(wx / CELL + (size - 1) / 2) || 0,
    z: Math.round(wz / CELL + (size - 1) / 2) || 0,
  };
}

/** Список клеток, которые занимает постройка с якорем в (gx, gz). */
export function footprintCells(type: string, gx: number, gz: number): CourtGridCell[] {
  const [w, h] = footprintSize(type);
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const cells: CourtGridCell[] = [];
  for (let dx = -halfW; dx < w - halfW; dx += 1) {
    for (let dz = -halfH; dz < h - halfH; dz += 1) {
      cells.push({ x: gx + dx, z: gz + dz });
    }
  }
  return cells;
}

/** Мировые координаты геометрического центра пятна постройки. */
export function footprintCenterToWorld(
  type: string,
  gx: number,
  gz: number,
  size: number,
): { wx: number; wz: number; width: number; depth: number } {
  const [w, h] = footprintSize(type);
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  return {
    wx: gridToWorld(gx - halfW + (w - 1) / 2, size),
    wz: gridToWorld(gz - halfH + (h - 1) / 2, size),
    width: w,
    depth: h,
  };
}

/** Занятые постройками клетки (переносимую можно пропустить). */
export function footprintKeys(grid: CourtGridLite, skip?: CourtGridCell): Set<string> {
  const set = new Set<string>();
  for (const b of grid.buildings) {
    if (skip && b.x === skip.x && b.z === skip.z) continue;
    for (const cell of footprintCells(b.type, b.x, b.z)) {
      set.add(`${cell.x}:${cell.z}`);
    }
  }
  return set;
}

/** Постройка, чьё пятно накрывает клетку (для долгого нажатия). */
export function buildingAt(grid: CourtGridLite, cx: number, cz: number): CourtGridBuilding | null {
  for (const b of grid.buildings) {
    const [w, h] = footprintSize(b.type);
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    if (cx >= b.x - halfW && cx < b.x - halfW + w && cz >= b.z - halfH && cz < b.z - halfH + h) {
      return b;
    }
  }
  return null;
}

/** Можно ли поставить постройку с пятном type в клетку (gx, gz) внутри сетки size×size. */
export function isFootprintFree(opts: {
  size: number;
  type: string;
  gx: number;
  gz: number;
  busy: ReadonlySet<string>;
  roads: ReadonlySet<string>;
}): boolean {
  const { size, type, gx, gz, busy, roads } = opts;
  for (const cell of footprintCells(type, gx, gz)) {
    if (cell.x < 0 || cell.z < 0 || cell.x > size - 1 || cell.z > size - 1) return false;
    const key = `${cell.x}:${cell.z}`;
    if (busy.has(key) || roads.has(key)) return false;
  }
  return true;
}
