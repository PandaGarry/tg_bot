import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDING_SPRITES, buildingCenter, buildingDepth, buildingFootprintBounds, createBuilding } from "../src/game/court/building.js";
import { TILE_HEIGHT, worldToScreen } from "../src/game/court/isometric.js";

describe("court building geometry", () => {
  it("centers the visual footprint on the server's occupied cells", () => {
    expect(buildingFootprintBounds("citadel", 7, 7)).toMatchObject({
      minX: 5,
      minZ: 5,
      maxX: 9,
      maxZ: 9,
      center: { x: 7, z: 7 },
    });
    // Лесопилка 2×2 — центр в якоре; Казарма 3×3 — центр полклетки
    expect(buildingCenter({ type: "sawmill", x: 4, z: 6 })).toEqual({ x: 4, z: 6 });
    expect(buildingCenter({ type: "barracks", x: 4, z: 6 })).toEqual({ x: 4.5, z: 6.5 });
    expect(buildingCenter({ type: "bench", x: 4, z: 6 })).toEqual({ x: 4, z: 6.5 });
    expect(buildingCenter({ type: "lantern", x: 2, z: 8 })).toEqual({ x: 2.5, z: 8.5 });
  });

  it("positions the sprite at the footprint center and sorts by its front edge", () => {
    const building = { type: "sawmill", x: 4, z: 6 };
    const sprite = createBuilding(building, 14);
    const center = worldToScreen(4, 6);

    expect(sprite.position.x).toBeCloseTo(center.x, 6);
    expect(sprite.position.y).toBeCloseTo(center.y - (14 * TILE_HEIGHT) / 2, 6);
    expect(buildingDepth(building)).toBe(12);
    sprite.destroy({ children: true });
  });
});


describe("court building sprite assets", () => {
  it("ships valid day/night PNG pairs with anchors inside the day sprite", () => {
    const dimensions = (file: string) => {
      const bytes = readFileSync(new URL(`../public/court/sprites/${file}`, import.meta.url));
      expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
    };

    for (const [type, asset] of Object.entries(BUILDING_SPRITES)) {
      const day = dimensions(`${asset.file}.png`);
      const nightFile = asset.file.replace(/-(\\d+)$/, "-night-$1");
      const night = dimensions(`${nightFile}.png`);

      expect(day, type).toEqual({ width: asset.width, height: asset.height });
      expect(night.width, `${type} night width`).toBeGreaterThan(0);
      expect(night.height, `${type} night height`).toBeGreaterThan(0);
      expect(asset.tipX, `${type} anchor x`).toBeGreaterThanOrEqual(0);
      expect(asset.tipX, `${type} anchor x`).toBeLessThan(day.width);
      expect(asset.tipY, `${type} anchor y`).toBeGreaterThanOrEqual(0);
      expect(asset.tipY, `${type} anchor y`).toBeLessThan(day.height);
      expect(asset.patch, `${type} footprint width`).toBeGreaterThan(0);
    }
  });
});
