/**
 * Юнит-тесты визуальной прогрессии Цитадели (TDL-ARCH-006 v2):
 * - соответствие уровней 1..5 пяти стадиям единого архитектурного замысла и безопасный clamp;
 * - удержание габаритов всех уровней строго в пятне [3, 3] (3.30 м × 3.30 м);
 * - детерминированные 256×256 DataTexture-карты (albedo, bump, roughness, bone, alpha),
 *   резные Extrude/Tube/Lathe геометрии и их очистка на размонтировании (включая StrictMode);
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
  buildAgedBoneMaps,
  buildBannerAlphaMap,
  buildBasaltAshlarMaps,
  buildForgedIronMaps,
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
  it("сопоставляет уровни 1..5 пяти стадиям единого готического замысла и безопасно ограничивает выбросы", () => {
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

    // Единый замысел с 1-го уровня: контрфорсы, русты, аркады и геральдика развиваются непрерывно
    expect(specs.every((s) => s.buttressCount >= 4 && s.hasWallArcading && s.hasQuoins && s.hasHeraldicShields)).toBe(true);
    expect(specs.map((s) => s.portalArchTiers)).toEqual([2, 2, 3, 3, 3]);
    expect(specs.map((s) => s.reliquaryRings)).toEqual([0, 0, 0, 1, 2]);
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

  it("строит детерминированные 256×256 DataTexture-карты (с roughness/bone/alpha) и освобождает их без утечек", () => {
    const a = buildBasaltAshlarMaps(64);
    const b = buildBasaltAshlarMaps(64);
    expect(a.albedo).toEqual(b.albedo);
    expect(a.bump).toEqual(b.bump);
    expect(a.roughness?.length).toBe(64 * 64 * 4);
    expect(buildSlateRoofMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildTimberMaps(64).bump.length).toBe(64 * 64 * 4);
    expect(buildForgedIronMaps(64).roughness?.length).toBe(64 * 64 * 4);
    expect(buildAgedBoneMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildBannerAlphaMap(64).length).toBe(64 * 64 * 4);

    const set = createCitadelTextureSet();
    const texCount = Object.keys(set).length;
    expect(texCount).toBe(18);
    expect(set.basaltMap.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(set.basaltBump.colorSpace).toBe(THREE.NoColorSpace);
    expect(set.basaltRoughness.colorSpace).toBe(THREE.NoColorSpace);
    disposeCitadelTextureSet(set);
    expect(set.basaltMap.userData.__tdlDisposed).toBe(true);
    expect(set.bannerAlpha.userData.__tdlDisposed).toBe(true);
    expect(set.sootOverlay.userData.__tdlDisposed).toBe(true);

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
    expect(disposeSpy).toHaveBeenCalledTimes(texCount);
    mounted.unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(texCount * 2);
  });

  it("строит и освобождает резные процедурные геометрии (арки, вимперги, трилистник, пинакли, нервюры, щиты)", () => {
    const geomSet = createCitadelGeometrySet();
    const geomCount = Object.keys(geomSet).length;
    expect(geomCount).toBe(12);
    expect(geomSet.buttress.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.pointedArch.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.wimperg.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.trefoilTracery.attributes.position.count).toBeGreaterThan(30);
    expect(geomSet.gableRoof.attributes.position.count).toBeGreaterThan(10);
    expect(geomSet.flyingButtress.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.pinnacleSpire.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.heraldicShield.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.vaultRib.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.hornTrophy.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.crystal.attributes.position.count).toBeGreaterThan(10);
    expect(geomSet.crystalCore.attributes.position.count).toBeGreaterThan(10);
    disposeCitadelGeometrySet(geomSet);
    expect(geomSet.wimperg.userData.__tdlDisposed).toBe(true);

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
    expect(disposeSpy).toHaveBeenCalledTimes(geomCount);
    mounted.unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(geomCount * 2);
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
