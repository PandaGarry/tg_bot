import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResourceStrip } from "../src/ui/ResourceStrip.js";
import { formatCompactResource, formatCompactResourceParts, formatExactResource } from "../src/ui/resourceFormat.js";

describe("resource amount formatting", () => {
  it("uses localized compact units and promotes after rounding", () => {
    expect(formatCompactResource(999, "ru")).toBe("999");
    expect(formatCompactResource(1_250, "ru")).toBe("1,3к");
    expect(formatCompactResource(999_999, "ru")).toBe("1млн");
    expect(formatCompactResource(1_250_000, "ru")).toBe("1,3млн");
    expect(formatCompactResource(1_250_000_000, "ru")).toBe("1,3млрд");
    expect(formatCompactResource(1_250, "en")).toBe("1.3K");
    expect(formatCompactResource(1_250_000, "en")).toBe("1.3M");
    expect(formatCompactResourceParts(1_250_000, "ru")).toEqual({ value: "1,3", suffix: "млн" });
  });

  it("keeps exact values localized", () => {
    expect(formatExactResource(1_234_567, "ru")).toBe("1 234 567");
    expect(formatExactResource(1_234_567, "en")).toBe("1,234,567");
  });

  it("renders all six resources in one strip and reveals the exact value on tap", () => {
    const { container } = render(
      <ResourceStrip
        lang="ru"
        stock={{ meat: 1_250, wood: 12_345, stone: 999_999, metal: 1_250_000, mushrooms: 42, gold: 1_250_000_000 }}
      />,
    );

    const strip = container.querySelector(".hud-res");
    expect(strip).not.toBeNull();
    expect(strip?.querySelectorAll(":scope > [data-resource]")).toHaveLength(6);
    expect(strip?.querySelectorAll(".ic-frame")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Древесина: 12 345" })).toBeTruthy();
    expect(strip?.querySelector('[data-resource="gold"] b')?.textContent).toBe("1,3млрд");

    fireEvent.click(screen.getByRole("button", { name: "Древесина: 12 345" }));
    expect(screen.getByRole("status").textContent).toBe("Древесина: 12 345");
  });
});
