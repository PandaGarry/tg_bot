import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fakeApp, unsubscribeResize } = vi.hoisted(() => ({
  fakeApp: {
    init: vi.fn().mockResolvedValue(undefined),
    canvas: {},
    destroy: vi.fn(),
  },
  unsubscribeResize: vi.fn(),
}));

vi.mock("pixi.js", () => ({
  Application: class {
    constructor() {
      return fakeApp;
    }
  },
}));

vi.mock("../src/game/core/resize.js", () => ({
  setupResize: vi.fn(() => unsubscribeResize),
}));

beforeEach(() => {
  vi.resetModules();
  fakeApp.init.mockClear();
  fakeApp.destroy.mockClear();
  unsubscribeResize.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Pixi application lifecycle", () => {
  it("destroys scene children without destroying globally cached asset textures", async () => {
    const { gameApp } = await import("../src/game/core/application.js");
    const container = { appendChild: vi.fn() };

    await gameApp.init(container as unknown as HTMLElement);
    expect(gameApp.ready).toBe(true);
    expect(container.appendChild).toHaveBeenCalledWith(fakeApp.canvas);

    gameApp.destroy();

    expect(unsubscribeResize).toHaveBeenCalledOnce();
    expect(fakeApp.destroy).toHaveBeenCalledWith(true, {
      children: true,
      texture: false,
      textureSource: false,
    });
    expect(gameApp.ready).toBe(false);
  });
});
