import { describe, expect, it } from "vitest";
import { CITADEL_TIERS, citadelStage } from "../src/court/skin/boneWood/citadelStage";

describe("стадия Цитадели по уровню", () => {
  it("меняется каждые 5 уровней: 1–5, 6–10, 11–15, 16–20, 21–25", () => {
    const edges: [number, number][] = [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4], [21, 5], [25, 5]];
    for (const [level, stage] of edges) expect(citadelStage(level)).toBe(stage);
  });
  it("не выходит за пределы 1…5 и переживает мусор", () => {
    expect(citadelStage(0)).toBe(1);
    expect(citadelStage(-4)).toBe(1);
    expect(citadelStage(99)).toBe(CITADEL_TIERS);
    expect(citadelStage(Number.NaN)).toBe(1);
  });
});
