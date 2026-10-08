import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { CourtCamera } from "../src/game/court/camera.js";

describe("court camera", () => {
  it("preserves the world point under the pinch/wheel anchor", () => {
    const root = new Container();
    const camera = new CourtCamera(root);
    camera.resize(390, 844, 14);
    const anchor = { x: 195, y: 464.2 };
    const before = camera.toLocal(anchor);

    camera.zoomAt(anchor, 1.8);
    const after = camera.toLocal(anchor);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(camera.currentZoom).toBe(1.8);
  });

  it("limits zoom and keeps the board in the viewport while panning", () => {
    const root = new Container();
    const camera = new CourtCamera(root);
    camera.resize(390, 844, 14);
    const center = { x: 195, y: 464.2 };

    camera.zoomAt(center, 8);
    expect(camera.currentZoom).toBe(2.2);
    camera.panBy(20_000, -20_000);
    expect(root.x).toBeLessThan(390 + root.scale.x * 14 * 71.4 / 2);
    expect(root.y).toBeGreaterThan(-root.scale.y * 14 * 41.4 / 2);
  });
});
