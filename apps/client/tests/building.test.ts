import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { buildingCenter, buildingDepth, buildingFootprintBounds, buildingSpriteBounds, isInsideBuildingSpriteHitArea, createBuilding } from "../src/game/court/building.js";
import { BUILDING_ART_BACKLOG, BUILDING_SPRITES, buildingSpriteUrl } from "../src/game/court/spriteCatalog.js";
import { buildings } from "@tdl/content-buildings/catalog";
import { TILE_HEIGHT, worldToScreen } from "../src/game/court/isometric.js";

describe("court building geometry", () => {
  it("matches the authoritative footprint for every catalog building", () => {
    for (const definition of buildings) {
      const bounds = buildingFootprintBounds(definition.id, 7, 7);
      expect(bounds.width, definition.id).toBe(definition.footprint.w);
      expect(bounds.depth, definition.id).toBe(definition.footprint.h);
      expect(bounds.maxX - bounds.minX, definition.id).toBe(definition.footprint.w);
      expect(bounds.maxZ - bounds.minZ, definition.id).toBe(definition.footprint.h);
    }
  });

  it("centers the visual footprint on the server's occupied cells", () => {
    expect(buildingFootprintBounds("citadel", 7, 7)).toMatchObject({
      minX: 5,
      minZ: 5,
      maxX: 9,
      maxZ: 9,
      center: { x: 7, z: 7 },
    });
    // Лесопилка 2×2 — центр в якоре; Казарма 3×3 — центр полклетки
    expect(buildingCenter({ type: "sawmill", x: 4, z: 6 })).toEqual({ x: 4, z: 6 });
    expect(buildingCenter({ type: "barracks", x: 4, z: 6 })).toEqual({ x: 4.5, z: 6.5 });
    expect(buildingCenter({ type: "bench", x: 4, z: 6 })).toEqual({ x: 4, z: 6.5 });
    expect(buildingCenter({ type: "lantern", x: 2, z: 8 })).toEqual({ x: 2.5, z: 8.5 });
  });

  it("positions the sprite at the footprint center and sorts by its front edge", () => {
    const building = { type: "sawmill", x: 4, z: 6 };
    const sprite = createBuilding(building, 14);
    const center = worldToScreen(4, 6);

    expect(sprite.position.x).toBeCloseTo(center.x, 6);
    expect(sprite.position.y).toBeCloseTo(center.y - (14 * TILE_HEIGHT) / 2, 6);
    expect(buildingDepth(building)).toBe(12);
    sprite.destroy({ children: true });
  });
});


describe("court sprite hit area", () => {
  it("covers the visible upper Citadel body instead of the old fixed 112px cap", () => {
    const bounds = buildingSpriteBounds({ type: "citadel", x: 7, z: 7 }, 14);
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThan(112);
    const visibleUpperBody = { x: bounds!.left + bounds!.width / 2, y: bounds!.top + bounds!.height * 0.2 };
    expect(isInsideBuildingSpriteHitArea(bounds!, visibleUpperBody)).toBe(true);
    expect(isInsideBuildingSpriteHitArea(bounds!, { x: bounds!.left + 1, y: visibleUpperBody.y })).toBe(false);
  });
});

describe("court art catalog coverage", () => {
  it("accounts for every domain building as a prototype fallback or explicit production backlog item", () => {
    const domainIds = buildings.map((building) => building.id).sort();
    const accountedIds = [
      ...Object.keys(BUILDING_SPRITES),
      ...BUILDING_ART_BACKLOG.map((item) => item.id),
    ];
    expect(new Set(accountedIds).size).toBe(accountedIds.length);
    expect([...accountedIds].sort()).toEqual(domainIds);
  });
});

describe("court building sprite assets", () => {
  it("does not assign the legacy research-web sprite to the Academy", () => {
    expect(BUILDING_SPRITES.academy).toBeUndefined();
    expect(buildingSpriteUrl("academy")).toBeUndefined();
  });

  it("ships valid day/night PNG pairs with anchors inside the day sprite", () => {
    const dimensions = (file: string) => {
      const candidates = [
        join(cwd(), "public", "court", "sprites", file),
        join(cwd(), "apps", "client", "public", "court", "sprites", file),
      ];
      const path = candidates.find(existsSync);
      if (!path) throw new Error(`Missing court sprite asset: ${file}`);
      const bytes = readFileSync(path);
      expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
    };

    for (const [type, asset] of Object.entries(BUILDING_SPRITES)) {
      expect(buildingSpriteUrl(type)).toBe(`/court/sprites/${asset.file}.png`);
      const day = dimensions(`${asset.file}.png`);
      const nightFile = asset.file.replace(/-([0-9]+)$/, "-night-$1");
      const night = dimensions(`${nightFile}.png`);

      expect(day, type).toEqual({ width: asset.width, height: asset.height });
      expect(night.width, `${type} night width`).toBeGreaterThan(0);
      expect(night.height, `${type} night height`).toBeGreaterThan(0);
      expect(asset.tipX, `${type} anchor x`).toBeGreaterThanOrEqual(0);
      expect(asset.tipX, `${type} anchor x`).toBeLessThan(day.width);
      expect(asset.tipY, `${type} anchor y`).toBeGreaterThanOrEqual(0);
      expect(asset.tipY, `${type} anchor y`).toBeLessThan(day.height);
      expect(asset.patch, `${type} footprint width`).toBeGreaterThan(0);
    }
  });
});
