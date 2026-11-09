import { describe, expect, it } from "vitest";
import { BUILDING_SPRITES, buildingSpriteUrl } from "../src/game/court/spriteCatalog.js";

describe("TDL production sprite catalog", () => {
  it("uses the original imperial Citadel asset with a 4x4 footprint anchor", () => {
    expect(BUILDING_SPRITES.citadel).toMatchObject({
      file: "citadel-imperial-stage-01",
      extension: "svg",
      width: 512,
      height: 512,
      patch: 286,
      tipX: 256,
      tipY: 500,
    });
    expect(buildingSpriteUrl("citadel")).toBe("/court/sprites/citadel-imperial-stage-01.svg");
  });

  it("uses original imperial SVG assets for the first production building slice", () => {
    expect(buildingSpriteUrl("sawmill")).toBe("/court/sprites/sawmill-imperial-stage-01.svg");
    expect(buildingSpriteUrl("farm")).toBe("/court/sprites/farm-imperial-stage-01.svg");
    expect(buildingSpriteUrl("warehouse")).toBe("/court/sprites/warehouse-imperial-stage-01.svg");
    expect(buildingSpriteUrl("barracks")).toBe("/court/sprites/barracks-imperial-stage-01.svg");
    expect(BUILDING_SPRITES.warehouse).toMatchObject({ width: 512, height: 512, patch: 348, tipX: 256, tipY: 500 });
    expect(BUILDING_SPRITES.barracks).toMatchObject({ width: 512, height: 512, patch: 348, tipX: 256, tipY: 500 });
    expect(buildingSpriteUrl("academy")).toBeUndefined();
  });
});
