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
  fakeApp.init.mockReset().mockResolvedValue(undefined);
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

  it("shares one in-flight initialization between concurrent callers", async () => {
    const { gameApp } = await import("../src/game/core/application.js");
    let resolveInit!: () => void;
    fakeApp.init.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveInit = resolve;
    }));
    const firstContainer = { appendChild: vi.fn() };
    const secondContainer = { appendChild: vi.fn() };

    const first = gameApp.init(firstContainer as unknown as HTMLElement);
    const second = gameApp.init(secondContainer as unknown as HTMLElement);

    expect(second).toBe(first);
    expect(fakeApp.init).toHaveBeenCalledOnce();
    resolveInit();
    await Promise.all([first, second]);

    expect(firstContainer.appendChild).toHaveBeenCalledOnce();
    expect(secondContainer.appendChild).not.toHaveBeenCalled();
    expect(gameApp.ready).toBe(true);
  });

  it("does not mount a canvas when destroyed during asynchronous initialization", async () => {
    const { gameApp } = await import("../src/game/core/application.js");
    let resolveInit!: () => void;
    fakeApp.init.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveInit = resolve;
    }));
    const container = { appendChild: vi.fn() };

    const pending = gameApp.init(container as unknown as HTMLElement);
    gameApp.destroy();
    resolveInit();
    await pending;

    expect(container.appendChild).not.toHaveBeenCalled();
    expect(fakeApp.destroy).toHaveBeenCalledWith(true, {
      children: true,
      texture: false,
      textureSource: false,
    });
    expect(gameApp.ready).toBe(false);
  });

  it("allows a new mount while an invalidated initialization is still pending", async () => {
    const { gameApp } = await import("../src/game/core/application.js");
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    fakeApp.init
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveSecond = resolve;
      }));
    const oldContainer = { appendChild: vi.fn() };
    const newContainer = { appendChild: vi.fn() };

    const oldInit = gameApp.init(oldContainer as unknown as HTMLElement);
    gameApp.destroy();
    const newInit = gameApp.init(newContainer as unknown as HTMLElement);

    expect(fakeApp.init).toHaveBeenCalledTimes(2);
    resolveSecond();
    await newInit;
    resolveFirst();
    await oldInit;

    expect(oldContainer.appendChild).not.toHaveBeenCalled();
    expect(newContainer.appendChild).toHaveBeenCalledOnce();
    expect(gameApp.ready).toBe(true);
    expect(fakeApp.destroy).toHaveBeenCalledOnce();
  });

  it("clears failed initialization and permits retry even when init throws synchronously", async () => {
    const { gameApp } = await import("../src/game/core/application.js");
    const container = { appendChild: vi.fn() };
    fakeApp.init.mockImplementationOnce(() => {
      throw new Error("renderer initialization failed");
    });

    await expect(gameApp.init(container as unknown as HTMLElement))
      .rejects.toThrow("renderer initialization failed");
    expect(fakeApp.destroy).toHaveBeenCalledOnce();

    await gameApp.init(container as unknown as HTMLElement);
    expect(container.appendChild).toHaveBeenCalledOnce();
    expect(gameApp.ready).toBe(true);
  });
});
