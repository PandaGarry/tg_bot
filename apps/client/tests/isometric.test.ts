import { describe, expect, it } from "vitest";
import { boardBounds, cellCenter, getDepth, screenToCell, screenToWorld, TILE_HEIGHT, TILE_WIDTH, worldToScreen } from "../src/game/court/isometric.js";

describe("court isometric projection", () => {
  it("projects world coordinates and reverses them without drift", () => {
    for (let x = 0; x <= 14; x += 1) {
      for (let z = 0; z <= 14; z += 1) {
        const projected = worldToScreen(x, z);
        const world = screenToWorld(projected.x, projected.y);
        expect(world.x).toBeCloseTo(x, 8);
        expect(world.z).toBeCloseTo(z, 8);
      }
    }
  });

  it("round-trips the center of every playable tile on a 14×14 board", () => {
    const size = 14;
    for (let x = 0; x < size; x += 1) {
      for (let z = 0; z < size; z += 1) {
        const center = cellCenter(x, z, size);
        expect(screenToCell(center.x, center.y, size)).toEqual({ x, z });
      }
    }
  });

  it("keeps the declared 1.72:1 tile ratio and board dimensions", () => {
    expect(TILE_WIDTH / TILE_HEIGHT).toBeCloseTo(1.7246, 3);
    expect(boardBounds(14)).toEqual({ width: 14 * TILE_WIDTH, height: 14 * TILE_HEIGHT });
  });

  it("sorts further south cells in front", () => {
    expect(getDepth(4, 6)).toBe(10);
    expect(getDepth(4, 7)).toBeGreaterThan(getDepth(4, 6));
  });
});
