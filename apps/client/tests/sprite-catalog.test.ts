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

  it("keeps legacy prototype sprite URLs compatible for remaining fallbacks", () => {
    expect(buildingSpriteUrl("sawmill")).toBe("/court/sprites/d-01.png");
    expect(buildingSpriteUrl("academy")).toBeUndefined();
  });
});
