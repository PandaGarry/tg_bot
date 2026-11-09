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

  it("preserves the user's pan offset relative to the viewport after resize", () => {
    const root = new Container();
    const camera = new CourtCamera(root);
    camera.resize(390, 844, 14);
    camera.zoomAt({ x: 195, y: 464.2 }, 2.2);
    camera.panBy(-40, 0);

    const offsetFromCenter = root.x - 195;
    camera.resize(430, 900, 14);

    expect(root.x - 215).toBeCloseTo(offsetFromCenter, 6);
    expect(camera.currentZoom).toBe(2.2);
  });

  it("resets framing when the board size changes", () => {
    const root = new Container();
    const camera = new CourtCamera(root);
    camera.resize(390, 844, 14);
    camera.zoomAt({ x: 195, y: 464.2 }, 2.2);
    camera.resize(390, 844, 20);

    expect(camera.currentZoom).toBe(1);
    expect(root.x).toBe(195);
    expect(root.y).toBeCloseTo(464.2, 6);
  });
});
