import { DEFAULT_COURT_SIZE } from "./types.js";

/** Производственная диметрия двора: отношение 1.72:1, камера ≈35°. */
export const TILE_WIDTH = 71.4;
export const TILE_HEIGHT = 41.4;

export interface IsoPoint {
  x: number;
  y: number;
}

export interface IsoWorldPoint {
  x: number;
  z: number;
}

export interface IsoCell {
  x: number;
  z: number;
}

/** Клеточные координаты → изометрическая плоскость до центрирования доски. */
export function worldToScreen(x: number, z: number): IsoPoint {
  return {
    x: (x - z) * (TILE_WIDTH / 2),
    y: (x + z) * (TILE_HEIGHT / 2),
  };
}

/** Обратное преобразование для непрерывных координат мира. */
export function screenToWorld(x: number, y: number): IsoWorldPoint {
  const horizontal = x / (TILE_WIDTH / 2);
  const vertical = y / (TILE_HEIGHT / 2);
  return {
    x: (horizontal + vertical) / 2,
    z: (vertical - horizontal) / 2,
  };
}

/** Центр клетки относительно центра всей доски — система координат камеры Pixi. */
export function cellCenter(x: number, z: number, size = DEFAULT_COURT_SIZE): IsoPoint {
  const point = worldToScreen(x + 0.5, z + 0.5);
  return { x: point.x, y: point.y - (size * TILE_HEIGHT) / 2 };
}

/** Четыре угла ромба клетки, уже центрированные относительно доски. */
export function cellDiamond(x: number, z: number, size = DEFAULT_COURT_SIZE): IsoPoint[] {
  const offsetY = (size * TILE_HEIGHT) / 2;
  return [
    worldToScreen(x, z),
    worldToScreen(x + 1, z),
    worldToScreen(x + 1, z + 1),
    worldToScreen(x, z + 1),
  ].map(({ x: px, y }) => ({ x: px, y: y - offsetY }));
}

/** Пиксель камеры → целая клетка; вне доски возвращает null. */
export function screenToCell(
  x: number,
  y: number,
  size = DEFAULT_COURT_SIZE,
): IsoCell | null {
  const world = screenToWorld(x, y + (size * TILE_HEIGHT) / 2);
  const cellX = Math.floor(world.x);
  const cellZ = Math.floor(world.z);
  if (cellX < 0 || cellZ < 0 || cellX >= size || cellZ >= size) return null;
  return { x: cellX, z: cellZ };
}

/** Глубина спрайта в порядке от дальнего края к ближнему. */
export function getDepth(x: number, z: number): number {
  return x + z;
}

/** Центр проекции всей доски; используется для initial framing. */
export function boardBounds(size = DEFAULT_COURT_SIZE): { width: number; height: number } {
  return { width: size * TILE_WIDTH, height: size * TILE_HEIGHT };
}
