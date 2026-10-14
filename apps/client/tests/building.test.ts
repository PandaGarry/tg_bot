import { describe, expect, it } from "vitest";
import { buildingCenter, buildingDepth, buildingFootprintBounds, createBuilding } from "../src/game/court/building.js";
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
