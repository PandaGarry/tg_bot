/**
 * Юнит-тесты визуальной прогрессии Цитадели (TDL-ARCH-006):
 * - соответствие уровней 1..5 визуальным вариантам и безопасный clamp;
 * - удержание габаритов всех уровней строго в пятне [3, 3] (3.30 м × 3.30 м);
 * - детерминированные DataTexture-карты, геометрии ExtrudeGeometry и их очистка
 *   на размонтировании (включая React StrictMode);
 * - безопасный откат CitadelRenderer на CitadelLegacy через ErrorBoundary.
 */

import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import {
  CITADEL_LEVEL_VARIANTS,
  clampCitadelLevel,
  getCitadelFootprintEnvelope,
  getCitadelVisualSpec,
} from "../src/court/buildings/citadel/citadelLevels.js";
import {
  createCitadelGeometrySet,
  disposeCitadelGeometrySet,
  useCitadelGeometrySet,
} from "../src/court/buildings/citadel/citadelGeometry.js";
import { CitadelErrorBoundary } from "../src/court/buildings/citadel/CitadelRenderer.js";
import {
  buildBasaltAshlarMaps,
  buildSlateRoofMaps,
  buildTimberMaps,
  createCitadelTextureSet,
  disposeCitadelTextureSet,
  useCitadelTextureSet,
} from "../src/court/materials/citadelMaterials.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TDL-ARCH-006 Citadel level mapping & visual architecture invariants", () => {
  it("сопоставляет уровни 1..5 с пятью отчётливо разными силуэтами и безопасно ограничивает выбросы", () => {
    expect(clampCitadelLevel(undefined)).toBe(1);
    expect(clampCitadelLevel(null)).toBe(1);
    expect(clampCitadelLevel(Number.NaN)).toBe(1);
    expect(clampCitadelLevel(0)).toBe(1);
    expect(clampCitadelLevel(-4)).toBe(1);
    expect(clampCitadelLevel(1)).toBe(1);
    expect(clampCitadelLevel(2.9)).toBe(2);
    expect(clampCitadelLevel(5)).toBe(5);
    expect(clampCitadelLevel(99)).toBe(5);

    const specs = ([1, 2, 3, 4, 5] as const).map((lvl) => getCitadelVisualSpec(lvl));
    const tags = new Set(specs.map((s) => s.silhouetteTag));
    const gates = new Set(specs.map((s) => s.gateStyle));
    const roofs = new Set(specs.map((s) => s.roofStyle));
    const necrotic = new Set(specs.map((s) => s.necroticStage));

    expect(tags.size).toBe(5);
    expect(gates.size).toBe(5);
    expect(roofs.size).toBe(5);
    expect(necrotic.size).toBe(5);

    expect(specs.map((s) => s.turretCount)).toEqual([0, 1, 2, 4, 4]);
    expect(specs[3]!.turretLayout).toBe("four-corner");
    expect(specs[4]!.turretLayout).toBe("four-bastion-spired");
    expect(specs[4]!.hasFlyingButtresses).toBe(true);
    expect(specs[3]!.hasFlyingButtresses).toBe(false);
    expect(specs.map((s) => s.bannerCount)).toEqual([0, 0, 1, 2, 4]);
    expect(specs.map((s) => s.brazierCount)).toEqual([0, 2, 2, 4, 4]);
  });

  it("удерживает габариты и вылет лестницы каждого уровня 1..5 строго внутри пятна 3×3 (3.30 м)", () => {
    const env = getCitadelFootprintEnvelope();
    expect(env.widthM).toBeCloseTo(3.3, 5);
    expect(env.depthM).toBeCloseTo(3.3, 5);

    let prevHeight = 0;
    for (const lvl of [1, 2, 3, 4, 5] as const) {
      const spec = CITADEL_LEVEL_VARIANTS[lvl];
      const [w, h, d] = spec.boundsMeters;
      expect(w).toBeLessThan(env.widthM);
      expect(d).toBeLessThan(env.depthM);
      expect(h).toBeLessThanOrEqual(env.maxHeightM);
      expect(spec.stepReachZ).toBeLessThan(env.depthM / 2);
      expect(spec.plinthSize).toBeLessThan(env.widthM);
      expect(h).toBeGreaterThan(prevHeight);
      prevHeight = h;
    }
  });

  it("строит детерминированные DataTexture-карты и освобождает их без утечек (включая StrictMode)", () => {
    const a = buildBasaltAshlarMaps(64);
    const b = buildBasaltAshlarMaps(64);
    expect(a.albedo).toEqual(b.albedo);
    expect(a.bump).toEqual(b.bump);
    expect(buildSlateRoofMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildTimberMaps(64).bump.length).toBe(64 * 64 * 4);

    const set = createCitadelTextureSet();
    expect(set.basaltMap.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(set.basaltBump.colorSpace).toBe(THREE.NoColorSpace);
    disposeCitadelTextureSet(set);
    expect(set.basaltMap.userData.__tdlDisposed).toBe(true);
    expect(set.bannerMap.userData.__tdlDisposed).toBe(true);

    const disposeSpy = vi.spyOn(THREE.DataTexture.prototype, "dispose");
    function TextureProbe() {
      const t = useCitadelTextureSet();
      return <span data-ok={t.basaltMap instanceof THREE.DataTexture ? "1" : "0"} />;
    }
    const mounted = render(
      <StrictMode>
        <TextureProbe />
      </StrictMode>,
    );
    expect(disposeSpy).toHaveBeenCalledTimes(11);
    mounted.unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(22);
  });

  it("строит и освобождает процедурные геометрии (контрфорс, арка, щипец, аркбутан, кристалл)", () => {
    const geomSet = createCitadelGeometrySet();
    expect(geomSet.buttress.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.pointedArch.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.gableRoof.attributes.position.count).toBeGreaterThan(10);
    expect(geomSet.flyingButtress.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.crystal.attributes.position.count).toBeGreaterThan(10);
    disposeCitadelGeometrySet(geomSet);
    expect(geomSet.buttress.userData.__tdlDisposed).toBe(true);

    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    function GeomProbe() {
      const g = useCitadelGeometrySet();
      return <span data-ok={g.crystal.attributes.position.count > 0 ? "1" : "0"} />;
    }
    const mounted = render(
      <StrictMode>
        <GeomProbe />
      </StrictMode>,
    );
    expect(disposeSpy).toHaveBeenCalledTimes(5);
    mounted.unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(10);
  });

  it("безопасно откатывается на резервный компонент через CitadelErrorBoundary при ошибке", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BrokenCitadel(): null {
      throw new Error("boom");
    }

    const { getByTestId } = render(
      <CitadelErrorBoundary fallback={<div data-testid="legacy-fallback">legacy</div>}>
        <BrokenCitadel />
      </CitadelErrorBoundary>,
    );

    expect(getByTestId("legacy-fallback").textContent).toBe("legacy");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
