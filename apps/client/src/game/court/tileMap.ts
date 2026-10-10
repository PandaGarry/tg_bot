import { Graphics } from "pixi.js";
import { cellDiamond, cellCenter, TILE_HEIGHT, TILE_WIDTH } from "./isometric.js";
import type { CourtGrid, CourtRoad } from "./types.js";

const SOIL = [0x33402c, 0x37452f, 0x394831, 0x35432e] as const;

function flat(points: { x: number; y: number }[]): number[] {
  return points.flatMap(({ x, y }) => [x, y]);
}

function drawDiamond(
  graphics: Graphics,
  points: { x: number; y: number }[],
  color: number,
  stroke: number,
  width: number,
  alpha = 1,
): void {
  graphics.poly(flat(points), true).fill({ color, alpha }).stroke({ color: stroke, width, alpha });
}

/** Рисует диметрический грунт и настоящую сетку клеток двора. */
export function drawTileMap(graphics: Graphics, size: number): void {
  graphics.clear();
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const variation = (x * 7 + z * 11 + (x * z) % 5) % SOIL.length;
      drawDiamond(graphics, cellDiamond(x, z, size), SOIL[variation]!, 0x536247, 0.8);

      // Тонкая светлая кромка даёт клеткам объём, не споря с будущими спрайтами.
      const center = cellCenter(x, z, size);
      graphics
        .moveTo(center.x - TILE_WIDTH * 0.34, center.y - TILE_HEIGHT * 0.34)
        .lineTo(center.x, center.y - TILE_HEIGHT * 0.5)
        .lineTo(center.x + TILE_WIDTH * 0.34, center.y - TILE_HEIGHT * 0.34)
        .stroke({ color: 0x71805a, width: 0.55, alpha: 0.25 });
    }
  }

  const border = [
    cellDiamond(0, 0, size)[0]!,
    cellDiamond(size - 1, 0, size)[1]!,
    cellDiamond(size - 1, size - 1, size)[2]!,
    cellDiamond(0, size - 1, size)[3]!,
  ];
  graphics.poly(flat(border), true).stroke({ color: 0x9b8054, width: 3, alpha: 0.95 });
  graphics.poly(flat(border), true).stroke({ color: 0xd1b77f, width: 0.9, alpha: 0.72 });
}

/** Каменные/утоптанные плиты на клетках, данные приходят только от сервера. */
export function drawRoads(graphics: Graphics, roads: CourtRoad[], size: number): void {
  graphics.clear();
  for (const road of roads) {
    if (!inside(road, size)) continue;
    const center = cellCenter(road.x, road.z, size);
    const diamond = cellDiamond(road.x, road.z, size).map((point) => ({
      x: center.x + (point.x - center.x) * 0.78,
      y: center.y + (point.y - center.y) * 0.78,
    }));
    drawDiamond(graphics, diamond, 0x766146, 0xb09a70, 1.1, 0.96);

    // Небольшие неровности-галька, расположенные детерминированно.
    for (let i = 0; i < 3; i += 1) {
      const dx = ((road.x * 13 + road.z * 7 + i * 11) % 19) - 9;
      const dy = ((road.x * 5 + road.z * 17 + i * 7) % 9) - 4;
      graphics
        .ellipse(center.x + dx, center.y + dy, 2.1 + (i % 2), 1.2)
        .fill({ color: i === 1 ? 0xc0a77b : 0x4e4232, alpha: 0.72 });
    }
  }
}

function inside(cell: CourtRoad, size: number): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x >= 0 && cell.z >= 0 && cell.x < size && cell.z < size;
}

/** Проверка занятости дороги при тапе — только для UX; сервер остаётся источником правды. */
export function hasRoadAt(grid: CourtGrid | undefined, x: number, z: number): boolean {
  return Boolean(grid?.roads.some((road) => road.x === x && road.z === z));
}
