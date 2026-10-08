import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { CourtCamera } from "../src/game/court/camera.js";
import { CourtInput } from "../src/game/court/input.js";

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event as PointerEvent;
}

describe("court touch input", () => {
  it("accepts a slightly shaky tap held longer than a mouse click", async () => {
    const canvas = document.createElement("canvas");
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 390 },
      clientHeight: { configurable: true, value: 844 },
      getBoundingClientRect: {
        value: () => ({ left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844 }) as DOMRect,
      },
    });
    const camera = new CourtCamera(new Container());
    camera.resize(390, 844, 14);
    const onTap = vi.fn();
    const input = new CourtInput(canvas, camera, onTap, vi.fn());

    canvas.dispatchEvent(pointerEvent("pointerdown", 190, 420));
    canvas.dispatchEvent(pointerEvent("pointermove", 197, 426));
    await new Promise((resolve) => window.setTimeout(resolve, 225));
    canvas.dispatchEvent(pointerEvent("pointerup", 197, 426));

    expect(onTap).toHaveBeenCalledOnce();
    const point = onTap.mock.calls[0]?.[0] as { x: number; y: number };
    expect(point.x).toBeCloseTo(197, 6);
    expect(point.y).toBeCloseTo(426, 6);
    input.destroy();
  });
});
