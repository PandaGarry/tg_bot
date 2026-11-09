import { beforeEach, describe, expect, it, vi } from "vitest";

const { preload, createBuilding, drawGhost, drawRoads, buildingDepth, hitBuilding } = vi.hoisted(() => ({
  preload: vi.fn(),
  createBuilding: vi.fn(),
  drawGhost: vi.fn(),
  drawRoads: vi.fn(),
  buildingDepth: vi.fn((building: { x: number; z: number }) => building.x + building.z),
  hitBuilding: vi.fn((_building: { x: number; z: number }, _point: { x: number; y: number }, _size: number) => false),
}));

vi.mock("pixi.js", () => {
  class Container {
    children: Container[] = [];
    position = { x: 0, y: 0, set: vi.fn((x: number, y = x) => {
      this.position.x = x;
      this.position.y = y;
    }) };
    scale = { x: 1, y: 1, set: vi.fn((value: number) => {
      this.scale.x = value;
      this.scale.y = value;
    }) };
    visible = true;
    sortableChildren = false;
    label = "";
    zIndex = 0;
    addChild(...children: Container[]) {
      this.children.push(...children);
      return children[children.length - 1];
    }
    removeChild(child: Container) {
      this.children = this.children.filter((item) => item !== child);
      return child;
    }
    removeChildren() {
      const removed = [...this.children];
      this.children = [];
      return removed;
    }
    sortChildren() {}
    destroy() {
      this.children = [];
    }
  }
  class Graphics extends Container {}
  return { Container, Graphics };
});

vi.mock("../src/game/core/assets.js", () => ({
  loadTexture: vi.fn().mockRejectedValue(new Error("asset unavailable in lifecycle test")),
}));

vi.mock("../src/game/court/camera.js", () => ({
  CourtCamera: class {
    resize() {}
    toLocal(point: { x: number; y: number }) { return point; }
  },
}));

vi.mock("../src/game/court/input.js", () => ({
  CourtInput: class {
    setEnabled() {}
    destroy() {}
  },
}));

vi.mock("../src/game/court/building.js", () => ({
  buildingDepth,
  createBuilding,
  hitBuilding,
  preloadBuildingSprites: preload,
}));

vi.mock("../src/game/court/ghost.js", () => ({ drawGhost }));
vi.mock("../src/game/court/tileMap.js", () => ({
  destroyTileMap: () => undefined,
  drawRoads,
  drawTileMap: () => undefined,
}));
vi.mock("../src/game/court/isometric.js", () => ({
  sameCell: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  screenToCell: () => null,
}));

describe("court scene lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    preload.mockReset();
    preload.mockResolvedValue([]);
    createBuilding.mockReset();
    drawGhost.mockReset();
    drawRoads.mockReset();
    buildingDepth.mockClear();
    hitBuilding.mockReset();
    hitBuilding.mockReturnValue(false);
    createBuilding.mockImplementation(() => new (class {
      destroy() {}
    })());
  });

  it("ignores a late sprite preload and bridge updates after destroy", async () => {
    let resolvePreload!: (types: string[]) => void;
    preload.mockImplementationOnce(() => new Promise<string[]>((resolve) => {
      resolvePreload = resolve;
    }));

    const { bridge } = await import("../src/game/bridge.js");
    const { CourtScene } = await import("../src/game/court/courtScene.js");
    bridge.emit("state:update", {
      court: { grid: { size: 14, buildings: [], roads: [] } },
    });

    const stage = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
    const canvas = {
      parentElement: { clientWidth: 390, clientHeight: 844 },
    };
    const app = {
      stage,
      canvas,
      screen: { width: 390, height: 844 },
    };
    const scene = new CourtScene(app as never);

    bridge.emit("state:update", {
      court: {
        grid: { size: 14, buildings: [{ type: "cottage", x: 3, z: 4 }], roads: [] },
      },
    });
    expect(createBuilding).toHaveBeenCalledTimes(1);

    scene.destroy();
    resolvePreload(["cottage"]);
    await Promise.resolve();
    await Promise.resolve();

    bridge.emit("state:update", {
      court: {
        grid: { size: 14, buildings: [{ type: "cottage", x: 3, z: 4 }, { type: "farm", x: 6, z: 7 }], roads: [] },
      },
    });
    expect(createBuilding).toHaveBeenCalledTimes(1);
    expect(stage.removeChild).toHaveBeenCalledTimes(1);
  });

  it("skips preview redraw for resource-only or equivalent court state updates", async () => {
    const { bridge } = await import("../src/game/bridge.js");
    const { CourtScene } = await import("../src/game/court/courtScene.js");
    const stage = { addChild: vi.fn(), removeChild: vi.fn() };
    const canvas = { parentElement: { clientWidth: 390, clientHeight: 844 } };
    const app = { stage, canvas, screen: { width: 390, height: 844 } };
    const scene = new CourtScene(app as never);

    const state = {
      court: {
        grid: {
          size: 14,
          buildings: [{ type: "cottage", x: 3, z: 4 }],
          roads: [{ x: 2, z: 2 }],
        },
      },
    };
    bridge.emit("state:update", state);
    const callsAfterFirstUpdate = drawGhost.mock.calls.length;
    expect(callsAfterFirstUpdate).toBeGreaterThan(0);

    bridge.emit("state:update", {
      court: {
        grid: {
          size: 14,
          buildings: [{ type: "cottage", x: 3, z: 4 }],
          roads: [{ x: 2, z: 2 }],
        },
      },
      resources: { wood: 999 },
    } as never);
    expect(drawGhost).toHaveBeenCalledTimes(callsAfterFirstUpdate);

    bridge.emit("state:update", {
      court: {
        grid: {
          size: 14,
          buildings: [{ type: "cottage", x: 3, z: 4 }, { type: "farm", x: 6, z: 7 }],
          roads: [{ x: 2, z: 2 }],
        },
      },
    });
    expect(drawGhost).toHaveBeenCalledTimes(callsAfterFirstUpdate + 1);
    scene.destroy();
  });

  it("preserves unrelated building nodes and roads when only citadel level or array order changes", async () => {
    const { bridge } = await import("../src/game/bridge.js");
    const { CourtScene } = await import("../src/game/court/courtScene.js");
    const stage = { addChild: vi.fn(), removeChild: vi.fn() };
    const canvas = { parentElement: { clientWidth: 390, clientHeight: 844 } };
    const app = { stage, canvas, screen: { width: 390, height: 844 } };
    const scene = new CourtScene(app as never);

    const buildings = [
      { type: "cottage", x: 3, z: 4 },
      { type: "citadel", x: 7, z: 7 },
    ];
    const roads = [{ x: 1, z: 1 }, { x: 2, z: 2 }];
    bridge.emit("state:update", {
      court: {
        townhallLevel: 1,
        grid: { size: 14, buildings, roads },
      },
    });
    expect(createBuilding).toHaveBeenCalledTimes(2);
    const roadDrawCount = drawRoads.mock.calls.length;

    bridge.emit("state:update", {
      court: {
        townhallLevel: 1,
        grid: { size: 14, buildings: [...buildings].reverse(), roads: [...roads].reverse() },
      },
    });
    expect(createBuilding).toHaveBeenCalledTimes(2);
    expect(drawRoads).toHaveBeenCalledTimes(roadDrawCount);

    bridge.emit("state:update", {
      court: {
        townhallLevel: 2,
        grid: { size: 14, buildings, roads },
      },
    });
    expect(createBuilding).toHaveBeenCalledTimes(3);
    expect(createBuilding.mock.calls[2]![0].type).toBe("citadel");
    expect(drawRoads).toHaveBeenCalledTimes(roadDrawCount);
    scene.destroy();
  });

  it("sorts hit-test candidates only when the building set changes", async () => {
    const { bridge } = await import("../src/game/bridge.js");
    const { CourtScene } = await import("../src/game/court/courtScene.js");
    const stage = { addChild: vi.fn(), removeChild: vi.fn() };
    const canvas = { parentElement: { clientWidth: 390, clientHeight: 844 } };
    const app = { stage, canvas, screen: { width: 390, height: 844 } };
    const scene = new CourtScene(app as never);

    bridge.emit("state:update", {
      court: {
        grid: {
          size: 14,
          buildings: [
            { type: "cottage", x: 1, z: 1 },
            { type: "citadel", x: 8, z: 8 },
          ],
          roads: [],
        },
      },
    });
    expect(buildingDepth).toHaveBeenCalledTimes(2);
    const handleTap = (scene as unknown as { handleTap(point: { x: number; y: number }): void }).handleTap.bind(scene);
    handleTap({ x: 195, y: 420 });
    expect(hitBuilding.mock.calls.map(([building]) => [building.x, building.z])).toEqual([[8, 8], [1, 1]]);

    buildingDepth.mockClear();
    hitBuilding.mockClear();
    handleTap({ x: 195, y: 420 });
    expect(buildingDepth).not.toHaveBeenCalled();
    expect(hitBuilding).toHaveBeenCalledTimes(2);

    const sortCallsBeforeBuildingChange = buildingDepth.mock.calls.length;
    bridge.emit("state:update", {
      court: {
        grid: {
          size: 14,
          buildings: [
            { type: "cottage", x: 1, z: 1 },
            { type: "citadel", x: 8, z: 8 },
            { type: "farm", x: 4, z: 4 },
          ],
          roads: [],
        },
      },
    });
    expect(buildingDepth.mock.calls.length).toBeGreaterThan(sortCallsBeforeBuildingChange);
    scene.destroy();
  });

  it("rebuilds a building type only once when concurrent preload requests resolve together", async () => {
    preload.mockResolvedValue(["cottage"]);
    const { bridge } = await import("../src/game/bridge.js");
    const { CourtScene } = await import("../src/game/court/courtScene.js");
    const stage = { addChild: vi.fn(), removeChild: vi.fn() };
    const canvas = { parentElement: { clientWidth: 390, clientHeight: 844 } };
    const app = { stage, canvas, screen: { width: 390, height: 844 } };
    const scene = new CourtScene(app as never);
    const state = {
      court: {
        grid: {
          size: 14,
          buildings: [{ type: "cottage", x: 3, z: 4 }],
          roads: [],
        },
      },
    };

    bridge.emit("state:update", state);
    bridge.emit("state:update", state);
    expect(preload).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    await Promise.resolve();

    // One initial vector node plus one rebuild after the PNG becomes available.
    // A duplicate completion for the same in-flight asset must not rebuild it again.
    expect(createBuilding).toHaveBeenCalledTimes(2);
    scene.destroy();
  });
});
