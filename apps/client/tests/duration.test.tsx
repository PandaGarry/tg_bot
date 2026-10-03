import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/court/skin/duration";

describe("таймер улучшения", () => {
  it("меньше суток — часы:минуты:секунды", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(59_100)).toBe("00:01:00");
    expect(formatDuration((10 * 3600 + 42 * 60 + 5) * 1000)).toBe("10:42:05");
  });
  it("от суток — дни и часы:минуты", () => {
    expect(formatDuration((2 * 86_400 + 4 * 3600 + 12 * 60 + 30) * 1000)).toBe("2д 04:12");
    expect(formatDuration(86_400_000, "d")).toBe("1d 00:00");
  });
  it("отрицательное и мусор считаются нулём", () => {
    expect(formatDuration(-5000)).toBe("00:00:00");
    expect(formatDuration(Number.NaN)).toBe("00:00:00");
  });
});
