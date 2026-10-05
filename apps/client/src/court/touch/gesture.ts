/**
 * Чистая логика касания двора: пороги, геометрия попадания, прицеливание и автопрокрутка.
 * Без React и без сцены, чтобы проверяться тестами (`tests/gesture.test.tsx`).
 */

import * as THREE from "three";

/** Пороги жестов. Палец дрожит сильнее мыши, поэтому его порог больше. */
export const TOUCH = {
  /** Сдвиг пальца (CSS px), после которого касание считается движением, а не тапом. */
  slop: 10,
  /** То же для мыши. */
  mouseSlop: 4,
  /** Удержание на постройке, после которого она поднимается для переноса. */
  longPressMs: 350,
  /** Призрак держится выше пальца, чтобы палец его не закрывал (CSS px). */
  lift: 56,
  /** Ширина полосы у края экрана, где включается автопрокрутка (CSS px). */
  edge: 64,
  /** Запас вокруг призрака (в клетках), внутри которого касание «берёт» призрак: палец толще клетки. */
  halo: 1,
} as const;

export function isTouchLike(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

export function slopFor(pointerType: string): number {
  return isTouchLike(pointerType) ? TOUCH.slop : TOUCH.mouseSlop;
}

export function liftFor(pointerType: string): number {
  return isTouchLike(pointerType) ? TOUCH.lift : 0;
}

/** Прямоугольник клеток, включительно. */
export interface CellRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Клетки пятна `size` с якорем `(x, z)`; тот же порядок, что у модуля court. */
export function rectOf(x: number, z: number, size: readonly [number, number]): CellRect {
  const hw = Math.floor(size[0] / 2);
  const hh = Math.floor(size[1] / 2);
  return { x0: x - hw, z0: z - hh, x1: x - hw + size[0] - 1, z1: z - hh + size[1] - 1 };
}

/** Клетка внутри прямоугольника с запасом `halo` (в клетках). */
export function rectContains(r: CellRect, x: number, z: number, halo = 0): boolean {
  return x >= r.x0 - halo && x <= r.x1 + halo && z >= r.z0 - halo && z <= r.z1 + halo;
}

/** Помещается ли пятно в сетку и не лежит ли на занятых клетках или дороге. */
export function fits(
  r: CellRect,
  gridSize: number,
  busy: ReadonlySet<string>,
  roads: ReadonlySet<string>,
): boolean {
  if (r.x0 < 0 || r.z0 < 0 || r.x1 > gridSize - 1 || r.z1 > gridSize - 1) return false;
  for (let x = r.x0; x <= r.x1; x++) {
    for (let z = r.z0; z <= r.z1; z++) {
      const key = `${x}:${z}`;
      if (busy.has(key) || roads.has(key)) return false;
    }
  }
  return true;
}

/** Автопрокрутка у края экрана: от −1 до 1 по каждой оси, 0 — вне полосы. */
export function edgeScroll(x: number, y: number, width: number, height: number, margin = TOUCH.edge) {
  const k = (v: number, max: number) => {
    if (v < margin) return -Math.min(1, (margin - v) / margin);
    if (v > max - margin) return Math.min(1, (v - (max - margin)) / margin);
    return 0;
  };
  return { x: k(x, width), y: k(y, height) };
}

/** Поворот прямой между двумя пальцами (радианы, по часовой на экране — плюс). */
export function twistDelta(
  a0: { x: number; y: number },
  b0: { x: number; y: number },
  a1: { x: number; y: number },
  b1: { x: number; y: number },
): number {
  const before = Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const after = Math.atan2(b1.y - a1.y, b1.x - a1.x);
  let d = after - before;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Тело постройки для попадания лучом: пятно в клетках и высота. */
export interface PickBody {
  type: string;
  x: number;
  z: number;
  rot: number;
  /** Высота тела в мире. */
  height: number;
}

/**
 * Постройка под лучом: ближайшая по ходу луча. Тело — коробка по пятну и высоте здания, поэтому
 * тап по крыше и стене попадает в здание, а не в землю за ним.
 */
export function pickBuilding(
  ray: THREE.Ray,
  bodies: readonly PickBody[],
  centerOf: (b: PickBody) => { wx: number; wz: number },
  sizeOf: (type: string, rot: number) => readonly [number, number],
  cell: number,
): PickBody | null {
  let best: PickBody | null = null;
  let bestD = Infinity;
  const box = new THREE.Box3();
  const hit = new THREE.Vector3();
  for (const b of bodies) {
    const [w, h] = sizeOf(b.type, b.rot);
    const { wx, wz } = centerOf(b);
    box.min.set(wx - (w * cell) / 2, 0.05, wz - (h * cell) / 2);
    box.max.set(wx + (w * cell) / 2, b.height, wz + (h * cell) / 2);
    if (ray.intersectBox(box, hit)) {
      const d = hit.distanceTo(ray.origin);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
  }
  return best;
}

/** Высота тела для попадания: Цитадель растёт со стадией, остальные пока низкие. */
export function bodyHeight(type: string, stage: number): number {
  if (type === "townhall") return [3.3, 4.3, 5.5, 6.5, 8][Math.min(4, Math.max(0, stage - 1))] ?? 4;
  if (type === "lantern" || type === "flag") return 1.6;
  return 1.9;
}
