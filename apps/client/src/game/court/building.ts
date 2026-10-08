import { Container, Graphics } from "pixi.js";
import { getDepth, TILE_HEIGHT, TILE_WIDTH, worldToScreen } from "./isometric.js";
import type { CourtBuilding } from "./types.js";

export interface Footprint {
  width: number;
  depth: number;
}

const FOOTPRINTS: Record<string, Footprint> = {
  townhall: { width: 3, depth: 3 },
  cottage: { width: 2, depth: 2 },
  farm: { width: 2, depth: 2 },
  sawmill: { width: 2, depth: 2 },
  quarry: { width: 2, depth: 2 },
  mine: { width: 2, depth: 2 },
  barracks: { width: 2, depth: 2 },
  lantern: { width: 1, depth: 1 },
  bench: { width: 2, depth: 1 },
  well: { width: 2, depth: 2 },
  flag: { width: 1, depth: 1 },
};

const PALETTE: Record<string, { roof: number; light: number; dark: number; trim: number }> = {
  townhall: { roof: 0x9c5435, light: 0xe4d2a9, dark: 0x70513a, trim: 0xf0c866 },
  cottage: { roof: 0xa84f3b, light: 0xd8c49a, dark: 0x725039, trim: 0xf0d69b },
  farm: { roof: 0x6c7844, light: 0xb59a5d, dark: 0x675032, trim: 0xe4ca72 },
  sawmill: { roof: 0x72533a, light: 0xb78650, dark: 0x5d422d, trim: 0xdac08a },
  quarry: { roof: 0x74766e, light: 0xaaa696, dark: 0x5c5e57, trim: 0xd8cdb0 },
  mine: { roof: 0x554b40, light: 0x86765e, dark: 0x392f27, trim: 0xd6aa52 },
  barracks: { roof: 0x8b3830, light: 0xc6b58f, dark: 0x574030, trim: 0xd8be8b },
  lantern: { roof: 0xe4ad45, light: 0x9a6f3d, dark: 0x55391f, trim: 0xffdc76 },
  bench: { roof: 0x96653d, light: 0xb4834f, dark: 0x59391f, trim: 0xd3ad70 },
  well: { roof: 0x766e5c, light: 0xb6ab91, dark: 0x4c4337, trim: 0xe0c987 },
  flag: { roof: 0xa84f3b, light: 0x9a7043, dark: 0x49331f, trim: 0xe0b04a },
};

function footprintOf(type: string): Footprint {
  return FOOTPRINTS[type] ?? { width: 1, depth: 1 };
}

/** Для чётного пятна серверный якорь стоит на правой/нижней из двух клеток. */
export function buildingCenter(building: CourtBuilding): { x: number; z: number } {
  const footprint = footprintOf(building.type);
  return {
    x: building.x - (footprint.width % 2 === 0 ? 0.5 : 0),
    z: building.z - (footprint.depth % 2 === 0 ? 0.5 : 0),
  };
}

function point(x: number, z: number, elevation = 0): { x: number; y: number } {
  const projected = worldToScreen(x, z);
  return { x: projected.x, y: projected.y - elevation };
}

function polygon(
  graphics: Graphics,
  points: { x: number; y: number }[],
  fill: number,
  outline: number,
  width = 1.4,
): void {
  graphics
    .poly(points.flatMap(({ x, y }) => [x, y]), true)
    .fill({ color: fill })
    .stroke({ color: outline, width, join: "round" });
}

function footprintCorners(width: number, depth: number, elevation = 0): { x: number; y: number }[] {
  const halfW = width / 2;
  const halfD = depth / 2;
  return [
    point(-halfW, -halfD, elevation),
    point(halfW, -halfD, elevation),
    point(halfW, halfD, elevation),
    point(-halfW, halfD, elevation),
  ];
}

function drawFoundation(graphics: Graphics, width: number, depth: number): void {
  const corners = footprintCorners(width, depth);
  graphics.ellipse(0, 4, (width + depth) * TILE_WIDTH * 0.31, (width + depth) * TILE_HEIGHT * 0.21)
    .fill({ color: 0x15180f, alpha: 0.42 });
  polygon(graphics, corners, 0x554532, 0x2b2419, 1.8);
  const inset = corners.map(({ x, y }) => ({ x: x * 0.91, y: y * 0.91 - 1 }));
  polygon(graphics, inset, 0x81704e, 0xb49a69, 0.8);
}

/** Поднимает стены по двум видимым фасадам, оставляя верх под крышу. */
function drawWalls(
  graphics: Graphics,
  width: number,
  depth: number,
  height: number,
  light: number,
  dark: number,
  trim: number,
): void {
  const ground = footprintCorners(width, depth);
  const top = footprintCorners(width, depth, height);
  polygon(graphics, [ground[1]!, ground[2]!, top[2]!, top[1]!], dark, 0x40301f, 1.2);
  polygon(graphics, [ground[2]!, ground[3]!, top[3]!, top[2]!], light, 0x40301f, 1.2);
  // Каменный цоколь и деревянные стойки.
  graphics
    .moveTo(ground[1]!.x, ground[1]!.y - 2)
    .lineTo(ground[2]!.x, ground[2]!.y - 2)
    .lineTo(ground[3]!.x, ground[3]!.y - 2)
    .stroke({ color: trim, width: 2.2, alpha: 0.72 });
}

function drawPyramidRoof(graphics: Graphics, width: number, depth: number, baseHeight: number, peakHeight: number, color: number): void {
  const corners = footprintCorners(width, depth, baseHeight);
  const peak = point(0, 0, peakHeight);
  const faceColors = [color, shade(color, -18), shade(color, 8), shade(color, -9)];
  for (let index = 0; index < corners.length; index += 1) {
    const next = (index + 1) % corners.length;
    polygon(graphics, [corners[index]!, corners[next]!, peak], faceColors[index]!, 0x503724, 1.3);
  }
  graphics.circle(peak.x, peak.y, 2.4).fill({ color: 0xf0d288 });
}

function drawTownhall(graphics: Graphics, level: number, palette: (typeof PALETTE)[string]): void {
  const wallHeight = 30 + Math.min(4, Math.max(0, level - 1)) * 2;
  drawWalls(graphics, 2.8, 2.8, wallHeight, palette.light, palette.dark, palette.trim);
  drawPyramidRoof(graphics, 2.65, 2.65, wallHeight + 1, wallHeight + 28, palette.roof);
  // Входная арка и пара тёплых окон на фасаде.
  graphics.roundRect(-7, -5, 14, 20, 4).fill({ color: 0x39291e }).stroke({ color: 0xd7c18f, width: 1 });
  graphics.roundRect(-4.5, 0, 9, 15, 3).fill({ color: 0x60432b });
  graphics.circle(-17, -22, 2.2).fill({ color: 0xf2d88c, alpha: 0.9 });
  graphics.circle(17, -22, 2.2).fill({ color: 0xf2d88c, alpha: 0.9 });
  graphics.moveTo(0, -wallHeight - 27).lineTo(0, -wallHeight - 45).stroke({ color: 0x4f361f, width: 2 });
  graphics.poly([0, -wallHeight - 45, 14, -wallHeight - 40, 0, -wallHeight - 35], true)
    .fill({ color: 0xa64f37 }).stroke({ color: 0x53351f, width: 1 });
}

function drawHouse(graphics: Graphics, palette: (typeof PALETTE)[string], barracks = false): void {
  const wallHeight = barracks ? 24 : 20;
  drawWalls(graphics, 1.75, 1.75, wallHeight, palette.light, palette.dark, palette.trim);
  drawPyramidRoof(graphics, 1.92, 1.92, wallHeight + 1, wallHeight + 17, palette.roof);
  graphics.roundRect(-5, -3, 10, 15, 3).fill({ color: 0x463021 });
  graphics.rect(-14, -18, 5, 7).fill({ color: 0xf0d18a, alpha: 0.88 });
  graphics.rect(9, -18, 5, 7).fill({ color: 0xf0d18a, alpha: 0.88 });
  if (barracks) {
    graphics.moveTo(15, -30).lineTo(15, -46).stroke({ color: 0x422d1d, width: 2 });
    graphics.poly([15, -45, 27, -42, 15, -38], true).fill({ color: 0xa93e30 });
  }
}

function drawSmallFeature(graphics: Graphics, type: string, palette: (typeof PALETTE)[string]): void {
  switch (type) {
    case "farm":
      for (let row = 0; row < 4; row += 1) {
        const y = -7 + row * 5;
        graphics.moveTo(-23, y).lineTo(0, y + 7).lineTo(23, y).stroke({ color: 0xd9bd6e, width: 1.7, alpha: 0.9 });
        for (let stalk = 0; stalk < 3; stalk += 1) {
          const x = -14 + stalk * 14;
          graphics.moveTo(x, y + 2).lineTo(x - 2, y - 2).stroke({ color: 0x8e9a50, width: 1.4 });
        }
      }
      break;
    case "sawmill":
      graphics.roundRect(-20, -13, 34, 22, 3).fill({ color: 0x745136 }).stroke({ color: 0x422f20, width: 1.5 });
      graphics.poly([-24, -12, -2, -28, 19, -12], true).fill({ color: palette.roof }).stroke({ color: 0x422f20, width: 1.4 });
      graphics.ellipse(15, 2, 10, 9).fill({ color: 0x92734c }).stroke({ color: 0x493720, width: 1.5 });
      graphics.circle(15, 2, 3).fill({ color: 0xd4b583 });
      break;
    case "quarry":
      graphics.poly([-24, 5, -13, -17, -3, -6, 8, -27, 23, 4, 13, 14, -18, 14], true)
        .fill({ color: 0x999587 }).stroke({ color: 0x4c4d47, width: 1.6 });
      graphics.poly([-13, -17, -4, -6, -17, 0], true).fill({ color: 0xc5bda8, alpha: 0.8 });
      break;
    case "mine":
      graphics.poly([-23, 8, -19, -12, 0, -24, 20, -12, 24, 8], true)
        .fill({ color: 0x5b5041 }).stroke({ color: 0x342c23, width: 1.5 });
      graphics.roundRect(-10, -2, 21, 16, 3).fill({ color: 0x201c17 }).stroke({ color: 0xb18d55, width: 2 });
      graphics.circle(0, 5, 3).fill({ color: 0xe0b04a, alpha: 0.8 });
      break;
    case "lantern":
      graphics.ellipse(0, 8, 12, 6).fill({ color: 0x22251a, alpha: 0.5 });
      graphics.roundRect(-2, -22, 4, 29, 2).fill({ color: palette.dark });
      graphics.roundRect(-8, -30, 16, 12, 3).fill({ color: 0xe5ae45 }).stroke({ color: 0x583c20, width: 1.5 });
      graphics.poly([-10, -30, 0, -36, 10, -30], true).fill({ color: palette.dark });
      graphics.circle(0, -24, 3).fill({ color: 0xffe28a, alpha: 0.92 });
      break;
    case "bench":
      graphics.roundRect(-22, -7, 44, 7, 2).fill({ color: palette.light }).stroke({ color: palette.dark, width: 1.4 });
      graphics.roundRect(-22, -19, 44, 6, 2).fill({ color: palette.roof }).stroke({ color: palette.dark, width: 1.4 });
      graphics.rect(-17, -12, 5, 18).fill({ color: palette.dark });
      graphics.rect(12, -12, 5, 18).fill({ color: palette.dark });
      break;
    case "well":
      graphics.ellipse(0, 3, 20, 13).fill({ color: 0x796d58 }).stroke({ color: 0x40382d, width: 2 });
      graphics.ellipse(0, 0, 12, 7).fill({ color: 0x211f18 }).stroke({ color: 0xd1c29c, width: 1.5 });
      graphics.moveTo(-17, -1).lineTo(-17, -25).moveTo(17, -1).lineTo(17, -25).stroke({ color: palette.dark, width: 3 });
      graphics.poly([-22, -24, 0, -35, 22, -24], true).fill({ color: palette.roof }).stroke({ color: palette.dark, width: 1.5 });
      break;
    case "flag":
      graphics.ellipse(0, 8, 10, 5).fill({ color: 0x22251a, alpha: 0.48 });
      graphics.moveTo(0, 9).lineTo(0, -39).stroke({ color: palette.dark, width: 3 });
      graphics.poly([2, -37, 24, -30, 2, -23], true).fill({ color: palette.roof }).stroke({ color: palette.dark, width: 1.2 });
      graphics.circle(0, -40, 2.4).fill({ color: palette.trim });
      break;
    default:
      drawHouse(graphics, palette);
  }
}

function shade(color: number, amount: number): number {
  const channels = [color >> 16, (color >> 8) & 0xff, color & 0xff].map((value) =>
    Math.max(0, Math.min(255, value + amount)),
  );
  return (channels[0]! << 16) | (channels[1]! << 8) | channels[2]!;
}

/** Создаёт векторный спрайт-заглушку здания; позже заменяется PNG через PIXI.Assets. */
export function createBuilding(building: CourtBuilding, size: number, townhallLevel = 1): Container {
  const footprint = footprintOf(building.type);
  const center = buildingCenter(building);
  const projected = worldToScreen(center.x, center.z);
  const container = new Container();
  container.position.set(projected.x, projected.y - (size * TILE_HEIGHT) / 2);
  container.zIndex = getDepth(center.x, center.z) + (footprint.width + footprint.depth) / 4;
  container.label = `building:${building.type}:${building.x}:${building.z}`;

  const graphics = new Graphics();
  container.addChild(graphics);
  const palette = PALETTE[building.type] ?? PALETTE.cottage!;
  drawFoundation(graphics, footprint.width, footprint.depth);

  if (building.type === "townhall") {
    drawTownhall(graphics, townhallLevel, palette);
  } else if (["cottage", "barracks"].includes(building.type)) {
    drawHouse(graphics, palette, building.type === "barracks");
  } else {
    drawSmallFeature(graphics, building.type, palette);
  }

  return container;
}

/** Грубый hit-area для выбора спрайта; реальные клетки вычисляются отдельно. */
export function hitBuilding(
  building: CourtBuilding,
  pointInBoard: { x: number; y: number },
  size: number,
): boolean {
  const footprint = footprintOf(building.type);
  const center = buildingCenter(building);
  const projected = worldToScreen(center.x, center.z);
  const centerY = projected.y - (size * TILE_HEIGHT) / 2;
  const halfWidth = ((footprint.width + footprint.depth) * TILE_WIDTH) / 4 + 10;
  const halfFootHeight = ((footprint.width + footprint.depth) * TILE_HEIGHT) / 4 + 10;
  const tallest = building.type === "townhall" ? 112 : 72;
  const dx = Math.abs(pointInBoard.x - projected.x);
  const dy = pointInBoard.y - centerY;
  return dx <= halfWidth && dy >= -tallest && dy <= halfFootHeight;
}

/** Размер пятна используется сценой при подсветке строительного призрака. */
export function buildingFootprint(type: string): Footprint {
  return footprintOf(type);
}
