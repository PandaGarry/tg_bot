/**
 * Юнит-тесты архитектурной прогрессии Цитадели TDL-ARCH-006 R2 (Ossuary Cathedral-Fortress):
 * - соответствие уровней 1..5 пяти стадиям трёхчастной композиции и безопасный clamp;
 * - строгий математический контроль реального пятна [3, 3] (3.30 м × 3.30 м) и высоты <= 6.20 м;
 * - детерминированные 256×256 DataTexture-карты с крупным масштабом камня/сланца/дуба/железа
 *   и StrictMode-безопасное освобождение всех текстур и геометрий;
 * - двойной каскадный откат CitadelRenderer (R2 -> стабильная v2 -> CitadelLegacy).
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
  buildBannerClothMap,
  buildDressedStoneMaps,
  buildForgedIronMaps,
  buildSlateRoofMaps,
  buildTimberMaps,
  buildWallAshlarMaps,
  createCitadelTextureSet,
  disposeCitadelTextureSet,
  useCitadelTextureSet,
} from "../src/court/materials/citadelMaterials.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TDL-ARCH-006 R2 Ossuary Cathedral-Fortress level & architecture invariants", () => {
  it("сопоставляет уровни 1..5 пяти структурным стадиям без отката к 4-башенному замку", () => {
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
    expect(new Set(specs.map((s) => s.silhouetteTag)).size).toBe(5);
    expect(new Set(specs.map((s) => s.gatehouseStage)).size).toBe(5);
    expect(new Set(specs.map((s) => s.reliquaryStage)).size).toBe(5);

    // Проверка асимметричной эволюции масс (а не 4 одинаковых угловых башен)
    expect(specs[0]!.hasRearApse).toBe(false);
    expect(specs[2]!.hasRearApse).toBe(true);
    expect(specs[2]!.hasSideChapel).toBe(false);
    expect(specs[3]!.hasSideChapel).toBe(true);
    expect(specs[3]!.hasBrokenCrownTop).toBe(true);
    expect(specs[4]!.hasBrokenCrownTop).toBe(true);
    expect(specs[4]!.flyingButtressCount).toBe(2);
    expect(specs.map((s) => s.crownReliefScale)).toEqual([0.32, 0.38, 0.44, 0.5, 0.56]);
  });

  it("жёстко удерживает фактические координаты всех масс (неф, апсида, трансепт, башня, гейтхаус, ступени) внутри пятна 3×3 (3.30 м)", () => {
    const env = getCitadelFootprintEnvelope();
    const half = env.widthM / 2;
    expect(env.widthM).toBeCloseTo(3.3, 5);
    expect(env.depthM).toBeCloseTo(3.3, 5);

    let prevHeight = 0;
    for (const lvl of [1, 2, 3, 4, 5] as const) {
      const s = CITADEL_LEVEL_VARIANTS[lvl];
      const [w, h, d] = s.boundsMeters;
      expect(w).toBeLessThan(env.widthM);
      expect(d).toBeLessThan(env.depthM);
      expect(h).toBeLessThanOrEqual(env.maxHeightM);
      expect(s.crownTotalTopY).toBeLessThanOrEqual(env.maxHeightM);
      expect(h).toBeGreaterThan(prevHeight);
      prevHeight = h;

      // Фактические крайние границы по X и Z:
      expect(Math.abs(s.plinthOffsetX) + s.plinthWidth / 2).toBeLessThan(half);
      expect(Math.abs(s.plinthOffsetZ) + s.plinthDepth / 2).toBeLessThan(half);
      expect(s.stepReachZ + 0.04).toBeLessThan(half);
      expect(s.gateFrontZ).toBeLessThan(half);
      expect(Math.abs(s.towerCenterX) + s.towerBaseSize / 2 + 0.16).toBeLessThan(half);
      expect(Math.abs(s.towerCenterZ) + s.towerBaseSize / 2 + 0.16).toBeLessThan(half);
      if (s.hasRearApse) {
        expect(Math.abs(s.apseOffsetZ - s.apseRadius) + 0.05).toBeLessThan(half);
      }
      if (s.hasSideChapel) {
        expect(s.sideChapelCenterX + s.sideChapelWidth / 2 + 0.14).toBeLessThan(half);
      }
    }
  });

  it("строит детерминированные R2 PBR-текстуры и освобождает их без утечек в StrictMode", () => {
    const a = buildWallAshlarMaps(64);
    const b = buildWallAshlarMaps(64);
    expect(a.albedo).toEqual(b.albedo);
    expect(a.bump).toEqual(b.bump);
    expect(a.roughness?.length).toBe(64 * 64 * 4);
    expect(buildDressedStoneMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildSlateRoofMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildTimberMaps(64).bump.length).toBe(64 * 64 * 4);
    expect(buildForgedIronMaps(64).roughness?.length).toBe(64 * 64 * 4);
    expect(buildAgedBoneMaps(64).albedo.length).toBe(64 * 64 * 4);
    expect(buildBannerClothMap(64).length).toBe(64 * 64 * 4);
    expect(buildBannerAlphaMap(64).length).toBe(64 * 64 * 4);

    const set = createCitadelTextureSet();
    const texCount = Object.keys(set).length;
    expect(texCount).toBe(17);
    expect(set.wallMap.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(set.wallBump.colorSpace).toBe(THREE.NoColorSpace);
    expect(set.wallRoughness.colorSpace).toBe(THREE.NoColorSpace);
    disposeCitadelTextureSet(set);
    expect(set.wallMap.userData.__tdlDisposed).toBe(true);
    expect(set.bannerAlpha.userData.__tdlDisposed).toBe(true);

    const disposeSpy = vi.spyOn(THREE.DataTexture.prototype, "dispose");
    function TextureProbe() {
      const t = useCitadelTextureSet();
      return <span data-ok={t.wallMap instanceof THREE.DataTexture ? "1" : "0"} />;
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

  it("строит и корректно освобождает все 13 резных геометрий R2 (включая рёбра и эмблему Broken Ossuary Crown)", () => {
    const geomSet = createCitadelGeometrySet();
    const geomCount = Object.keys(geomSet).length;
    expect(geomCount).toBe(13);
    expect(geomSet.crownRib.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.brokenCrownEmblem.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.leanToRoof.attributes.position.count).toBeGreaterThan(10);
    expect(geomSet.flyingButtress.attributes.position.count).toBeGreaterThan(20);
    expect(geomSet.pointedArch.attributes.position.count).toBeGreaterThan(20);
    disposeCitadelGeometrySet(geomSet);
    expect(geomSet.crownRib.userData.__tdlDisposed).toBe(true);

    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    function GeomProbe() {
      const g = useCitadelGeometrySet();
      return <span data-ok={g.crownRib.attributes.position.count > 0 ? "1" : "0"} />;
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

  it("поддерживает каскадный откат R2 -> стабильная v2 -> legacy через CitadelErrorBoundary", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BrokenR2(): null {
      throw new Error("r2-fail");
    }
    function BrokenV2(): null {
      throw new Error("v2-fail");
    }

    const { getByTestId } = render(
      <CitadelErrorBoundary
        fallback={
          <CitadelErrorBoundary fallback={<div data-testid="legacy-fallback">legacy</div>}>
            <BrokenV2 />
          </CitadelErrorBoundary>
        }
      >
        <BrokenR2 />
      </CitadelErrorBoundary>,
    );

    expect(getByTestId("legacy-fallback").textContent).toBe("legacy");
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
