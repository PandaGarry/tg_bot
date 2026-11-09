import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { IMPERIAL_WALL_MODULES, wallModuleUrl } from "../src/game/court/wallModuleCatalog.js";

describe("imperial wall module catalog", () => {
  it("defines a coherent stage-one perimeter kit with stable ground anchors", () => {
    expect(Object.keys(IMPERIAL_WALL_MODULES).sort()).toEqual(["corner", "gate", "straight", "tower"]);
    expect(IMPERIAL_WALL_MODULES.corner).toMatchObject({ role: "corner", stage: 1, width: 512, height: 448, tipX: 256, tipY: 407 });
    expect(IMPERIAL_WALL_MODULES.straight).toMatchObject({ role: "straight", stage: 1, width: 512, height: 384, tipX: 256, tipY: 350 });
    expect(IMPERIAL_WALL_MODULES.gate).toMatchObject({ role: "gate", stage: 1, width: 512, height: 512, tipX: 256 });
    expect(IMPERIAL_WALL_MODULES.tower).toMatchObject({ role: "tower", stage: 1, width: 512, height: 512, tipX: 256 });
  });

  it("resolves only known original SVG modules", () => {
    expect(wallModuleUrl("corner")).toBe("/court/sprites/wall-imperial-corner-stage-01.svg");
    expect(wallModuleUrl("straight")).toBe("/court/sprites/wall-imperial-straight-stage-01.svg");
    expect(wallModuleUrl("gate")).toBe("/court/sprites/wall-imperial-gate-stage-01.svg");
    expect(wallModuleUrl("tower")).toBe("/court/sprites/wall-imperial-tower-stage-01.svg");
    expect(wallModuleUrl("unknown")).toBeUndefined();
  });

  it("ships every catalogued SVG with dimensions matching its metadata", () => {
    for (const [id, module] of Object.entries(IMPERIAL_WALL_MODULES)) {
      const file = `${module.file}.svg`;
      const candidates = [
        join(cwd(), "public", "court", "sprites", file),
        join(cwd(), "apps", "client", "public", "court", "sprites", file),
      ];
      const path = candidates.find(existsSync);
      if (!path) throw new Error(`Missing wall module asset: ${file}`);
      const source = readFileSync(path, "utf8");
      const dimensions = source.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/);
      expect(dimensions, id).not.toBeNull();
      expect({ width: Number(dimensions?.[1]), height: Number(dimensions?.[2]) }, id)
        .toEqual({ width: module.width, height: module.height });
      expect(source, id).toContain("</svg>");
    }
  });
});
