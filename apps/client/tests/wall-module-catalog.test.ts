import { describe, expect, it } from "vitest";
import { IMPERIAL_WALL_MODULES, wallModuleUrl } from "../src/game/court/wallModuleCatalog.js";

describe("imperial wall module catalog", () => {
  it("defines a coherent stage-one perimeter kit with stable ground anchors", () => {
    expect(Object.keys(IMPERIAL_WALL_MODULES).sort()).toEqual(["gate", "straight", "tower"]);
    expect(IMPERIAL_WALL_MODULES.straight).toMatchObject({ role: "straight", stage: 1, width: 512, height: 384, tipX: 256, tipY: 350 });
    expect(IMPERIAL_WALL_MODULES.gate).toMatchObject({ role: "gate", stage: 1, width: 512, height: 512, tipX: 256 });
    expect(IMPERIAL_WALL_MODULES.tower).toMatchObject({ role: "tower", stage: 1, width: 512, height: 512, tipX: 256 });
  });

  it("resolves only known original SVG modules", () => {
    expect(wallModuleUrl("straight")).toBe("/court/sprites/wall-imperial-straight-stage-01.svg");
    expect(wallModuleUrl("gate")).toBe("/court/sprites/wall-imperial-gate-stage-01.svg");
    expect(wallModuleUrl("tower")).toBe("/court/sprites/wall-imperial-tower-stage-01.svg");
    expect(wallModuleUrl("corner")).toBeUndefined();
  });
});
