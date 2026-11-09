import { Container, Graphics, type Texture } from "pixi.js";
import { cellDiamond, cellCenter, worldToScreen, TILE_HEIGHT, TILE_WIDTH } from "./isometric.js";
import type { CourtGrid, CourtRoad } from "./types.js";

const SOIL = [0x33402c, 0x37452f, 0x394831, 0x35432e] as const;
export const TILE_CHUNK_SIZE = 8;

export interface TileChunkRange {
  xStart: number;
  xEnd: number;
  zStart: number;
  zEnd: number;
}

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
  texture?: Texture,
): void {
  graphics.poly(flat(points), true).fill(texture ? { texture } : { color, alpha }).stroke({ color: stroke, width, alpha });
}

/** Делит поле на ограниченные по размеру чанки без пропусков и пересечений клеток. */
export function getTileChunkRanges(size: number, chunkSize = TILE_CHUNK_SIZE): TileChunkRange[] {
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(chunkSize) || chunkSize < 1) return [];
  const chunks: TileChunkRange[] = [];
  for (let zStart = 0; zStart < size; zStart += chunkSize) {
    for (let xStart = 0; xStart < size; xStart += chunkSize) {
      chunks.push({
        xStart,
        xEnd: Math.min(xStart + chunkSize, size),
        zStart,
        zEnd: Math.min(zStart + chunkSize, size),
      });
    }
  }
  return chunks;
}

/** Отключает кеши чанков и освобождает их render textures перед уничтожением сцены. */
export function destroyTileMap(container: Container): void {
  for (const child of container.removeChildren()) {
    if (child.isCachedAsTexture) child.cacheAsTexture(false);
    child.destroy({ children: true });
  }
}

/**
 * Рисует грунт отдельными статичными чанками. Кеш каждого чанка ограничен 8×8
 * клетками; resolution ограничен 1.5, чтобы не создавать чрезмерные GPU-текстуры
 * на устройствах с высоким devicePixelRatio.
 */
export function drawTileMap(container: Container, size: number, rendererResolution = 1, groundTexture?: Texture): void {
  destroyTileMap(container);
  const resolution = Number.isFinite(rendererResolution)
    ? Math.min(1.5, Math.max(1, rendererResolution))
    : 1;

  for (const range of getTileChunkRanges(size)) {
    const chunk = new Container();
    chunk.label = `ground-chunk-${range.xStart}-${range.zStart}`;
    // Содержимое кеша строим в локальных координатах: иначе дальние чанки
    // захватят пустое пространство от начала доски и превратятся в большие текстуры.
    const origin = worldToScreen(range.xStart, range.zStart);
    const originY = origin.y - (size * TILE_HEIGHT) / 2;
    chunk.position.set(origin.x, originY);
    const graphics = new Graphics();

    for (let z = range.zStart; z < range.zEnd; z += 1) {
      for (let x = range.xStart; x < range.xEnd; x += 1) {
        const variation = (x * 7 + z * 11 + (x * z) % 5) % SOIL.length;
        const diamond = cellDiamond(x, z, size).map(({ x: px, y }) => ({ x: px - origin.x, y: y - originY }));
        drawDiamond(graphics, diamond, SOIL[variation]!, 0x536247, 0.8, 1, groundTexture);

        // Тонкая светлая кромка даёт клеткам объём, не споря с будущими спрайтами.
        const worldCenter = cellCenter(x, z, size);
        const center = { x: worldCenter.x - origin.x, y: worldCenter.y - originY };
        graphics
          .moveTo(center.x - TILE_WIDTH * 0.34, center.y - TILE_HEIGHT * 0.34)
          .lineTo(center.x, center.y - TILE_HEIGHT * 0.5)
          .lineTo(center.x + TILE_WIDTH * 0.34, center.y - TILE_HEIGHT * 0.34)
          .stroke({ color: 0x71805a, width: 0.55, alpha: 0.25 });
      }
    }

    chunk.addChild(graphics);
    chunk.cacheAsTexture({ resolution, antialias: true });
    container.addChild(chunk);
  }

  // Контур поля остаётся отдельным лёгким слоем: его размер зависит от всего поля,
  // поэтому не раздуваем ради него один из ограниченных текстурных чанков.
  const border = new Graphics();
  const corners = [
    cellDiamond(0, 0, size)[0]!,
    cellDiamond(size - 1, 0, size)[1]!,
    cellDiamond(size - 1, size - 1, size)[2]!,
    cellDiamond(0, size - 1, size)[3]!,
  ];
  border.poly(flat(corners), true).stroke({ color: 0x9b8054, width: 3, alpha: 0.95 });
  border.poly(flat(corners), true).stroke({ color: 0xd1b77f, width: 0.9, alpha: 0.72 });
  container.addChild(border);
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
