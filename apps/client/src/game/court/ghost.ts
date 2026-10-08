import { Graphics } from "pixi.js";
import { buildingFootprint } from "./building.js";
import { cellDiamond, TILE_HEIGHT, TILE_WIDTH, worldToScreen } from "./isometric.js";
import type { CourtCell, CourtGrid, CourtSceneMode } from "./types.js";

const flat = (points: { x: number; y: number }[]): number[] => points.flatMap(({ x, y }) => [x, y]);

/** Рисует клетку/пятно под курсором; это только визуальная подсказка, не проверка сервера. */
export function drawGhost(
  graphics: Graphics,
  grid: CourtGrid,
  size: number,
  mode: CourtSceneMode,
  hover: CourtCell | null,
): void {
  graphics.clear();
  const target = mode.pending ?? (mode.placing && hover ? { ...hover, type: mode.placing } : null);
  const roadTarget = mode.roadTool && hover ? { ...hover, type: "road" } : null;
  const preview = target ?? roadTarget;
  if (!preview || !inside(preview, size)) return;

  if (preview.type === "road") {
    const points = cellDiamond(preview.x, preview.z, size).map((point) => {
      const center = worldToScreen(preview.x + 0.5, preview.z + 0.5);
      const centerY = center.y - (size * TILE_HEIGHT) / 2;
      return {
        x: center.x + (point.x - center.x) * 0.76,
        y: centerY + (point.y - centerY) * 0.76,
      };
    });
    graphics
      .poly(flat(points), true)
      .fill({ color: 0xc89a62, alpha: 0.34 })
      .stroke({ color: 0xf0d69b, width: 2, alpha: 0.94 });
    return;
  }

  const footprint = buildingFootprint(preview.type);
  const halfX = Math.floor(footprint.width / 2);
  const halfZ = Math.floor(footprint.depth / 2);
  const firstX = preview.x - halfX;
  const firstZ = preview.z - halfZ;
  const lastX = firstX + footprint.width - 1;
  const lastZ = firstZ + footprint.depth - 1;
  const points = [
    worldToScreen(firstX, firstZ),
    worldToScreen(lastX + 1, firstZ),
    worldToScreen(lastX + 1, lastZ + 1),
    worldToScreen(firstX, lastZ + 1),
  ].map((point) => ({ x: point.x, y: point.y - (size * TILE_HEIGHT) / 2 }));

  const valid = isPlacementOpen(grid, preview, mode.pending?.from, size);
  const color = valid ? 0x8ac76a : 0xd96a4d;
  graphics
    .poly(flat(points), true)
    .fill({ color, alpha: 0.27 })
    .stroke({ color, width: 2.5, alpha: 0.95 });

  // Небольшой маяк показывает, что именно сейчас выбрано в панели стройки.
  const center = worldToScreen(preview.x - (footprint.width % 2 === 0 ? 0.5 : 0), preview.z - (footprint.depth % 2 === 0 ? 0.5 : 0));
  graphics
    .circle(center.x, center.y - (size * TILE_HEIGHT) / 2 - TILE_HEIGHT * 0.45, Math.max(3, TILE_WIDTH * 0.11))
    .fill({ color, alpha: 0.72 })
    .stroke({ color: 0xf3e9d0, width: 1.2, alpha: 0.92 });
}

function isPlacementOpen(
  grid: CourtGrid,
  placement: CourtCell & { type: string },
  movingFrom: CourtCell | undefined,
  size: number,
): boolean {
  const footprint = buildingFootprint(placement.type);
  const halfX = Math.floor(footprint.width / 2);
  const halfZ = Math.floor(footprint.depth / 2);
  const cells = new Set<string>();
  for (const building of grid.buildings) {
    if (movingFrom && building.x === movingFrom.x && building.z === movingFrom.z && building.type === placement.type) continue;
    const occupied = buildingFootprint(building.type);
    const fromX = building.x - Math.floor(occupied.width / 2);
    const fromZ = building.z - Math.floor(occupied.depth / 2);
    for (let x = fromX; x < fromX + occupied.width; x += 1) {
      for (let z = fromZ; z < fromZ + occupied.depth; z += 1) cells.add(`${x}:${z}`);
    }
  }
  for (const road of grid.roads) cells.add(`${road.x}:${road.z}`);

  for (let x = placement.x - halfX; x < placement.x - halfX + footprint.width; x += 1) {
    for (let z = placement.z - halfZ; z < placement.z - halfZ + footprint.depth; z += 1) {
      if (x < 0 || z < 0 || x >= size || z >= size || cells.has(`${x}:${z}`)) return false;
    }
  }
  return true;
}

function inside(cell: CourtCell, size: number): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z) && cell.x >= 0 && cell.z >= 0 && cell.x < size && cell.z < size;
}
