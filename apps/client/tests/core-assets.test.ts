import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Assets, type Texture } from "pixi.js";

vi.mock("pixi.js", () => ({
  Assets: { load: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  vi.mocked(Assets.load).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Pixi texture loader", () => {
  it("shares one in-flight request for concurrent callers and caches the result", async () => {
    let resolveLoad!: (texture: Texture) => void;
    const loading = new Promise<Texture>((resolve) => {
      resolveLoad = resolve;
    });
    vi.mocked(Assets.load).mockReturnValue(loading);

    const { getTexture, loadTexture } = await import("../src/game/core/assets.js");
    const first = loadTexture("court-building:citadel", "/court/sprites/a-01.png");
    const second = loadTexture("court-building:citadel", "/court/sprites/a-01.png");

    expect(Assets.load).toHaveBeenCalledTimes(1);
    expect(Assets.load).toHaveBeenCalledWith("/court/sprites/a-01.png");

    const texture = {} as Texture;
    resolveLoad(texture);
    await expect(Promise.all([first, second])).resolves.toEqual([texture, texture]);
    expect(getTexture("court-building:citadel")).toBe(texture);

    await expect(loadTexture("court-building:citadel", "/court/sprites/a-01.png")).resolves.toBe(texture);
    expect(Assets.load).toHaveBeenCalledTimes(1);
  });

  it("clears a rejected in-flight request so a later attempt can retry", async () => {
    const texture = {} as Texture;
    vi.mocked(Assets.load)
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(texture);

    const { loadTexture } = await import("../src/game/core/assets.js");

    await expect(loadTexture("court-building:sawmill", "/court/sprites/d-01.png"))
      .rejects.toThrow("network failure");
    await expect(loadTexture("court-building:sawmill", "/court/sprites/d-01.png"))
      .resolves.toBe(texture);

    expect(Assets.load).toHaveBeenCalledTimes(2);
  });
});
