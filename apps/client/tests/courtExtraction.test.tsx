/**
 * Проверки декомпозиции Slice B1: палитра, реестр материалов, профиль
 * качества, замена смещения +6.5 через grid.size, очистка 26 ShapeGeometry
 * (включая React StrictMode) и WebGL fallback.
 */

import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { C, PALETTE } from "../src/court/materials/palette.js";
import {
  COURT_MATERIALS,
  INTERACTION_MATERIALS,
  getGhostBoxMaterialSpec,
  getGhostPlaneMaterialSpec,
} from "../src/court/materials/MaterialRegistry.js";
import { DEFAULT_QUALITY_PROFILE } from "../src/court/performance/qualityProfiles.js";
import { Ground } from "../src/court/scene/CourtEnvironment.js";
import { CELL, worldToCell } from "../src/court/scene/gridMath.js";
import { WebglFallback } from "../src/court/scene/WebglFallback.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TDL-ARCH-005 Slice B1 invariants", () => {
  it("сохраняет палитру Bone-Wood №05 и скаляры материалов без изменений", () => {
    expect(PALETTE).toBe(C);
    expect(C.sky).toBe("#c3d3da");
    expect(C.snowOuter).toBe("#f7f4ec");
    expect(C.dirt).toBe("#8a6544");
    expect(C.log).toBe("#6d4a2c");
    expect(C.flag).toBe("#b3402f");

    expect(COURT_MATERIALS.palisadeBody).toEqual({ color: "#6d4a2c", roughness: 0.95, flatShading: true });
    expect(COURT_MATERIALS.citadelSmoke).toEqual({
      color: "#efe9dd",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    expect(COURT_MATERIALS.smokePuff).toEqual({
      color: "#efe9dd",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    expect(COURT_MATERIALS.lanternFlame).toEqual({
      color: "#8a6a3a",
      emissive: "#ffcf7a",
      emissiveIntensity: 0.85,
      roughness: 0.6,
    });
    expect(COURT_MATERIALS.bannerCloth.side).toBe(THREE.DoubleSide);
    expect(INTERACTION_MATERIALS.gridLine).toEqual({
      color: "#f0e6d2",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    expect(getGhostPlaneMaterialSpec("#7fae5a").opacity).toBe(0.5);
    expect(getGhostBoxMaterialSpec("#7fae5a").opacity).toBe(0.16);
  });

  it("сохраняет профиль качества (dpr [1, 1.75] и настройки теней) 1:1", () => {
    expect(DEFAULT_QUALITY_PROFILE.dpr).toEqual([1, 1.75]);
    expect(DEFAULT_QUALITY_PROFILE.shadows).toBe(true);
    expect(DEFAULT_QUALITY_PROFILE.gl).toEqual({ antialias: true, powerPreference: "high-performance" });
    expect(DEFAULT_QUALITY_PROFILE.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(DEFAULT_QUALITY_PROFILE.toneMappingExposure).toBe(1.12);
    expect(DEFAULT_QUALITY_PROFILE.camera).toEqual({ fov: 40, near: 2, far: 140, position: [17, 16, 17] });
    expect(DEFAULT_QUALITY_PROFILE.directionalShadow).toEqual({
      mapSize: [2048, 2048],
      cameraLeft: -24,
      cameraRight: 24,
      cameraTop: 24,
      cameraBottom: -24,
      bias: -0.0004,
      normalBias: 0.02,
    });
  });

  it("вычисляет клетку из grid.size через worldToCell идентично прежнему + 6.5 при size=14", () => {
    const samples = [-6.8, -3.1, -0.55, 0, 1.2, 4.4, 6.7];
    for (const x of samples) {
      for (const z of samples) {
        expect(worldToCell(x, z, 14)).toEqual({
          x: Math.round(x / CELL + 6.5) || 0,
          z: Math.round(z / CELL + 6.5) || 0,
        });
      }
    }
    // при ином размере сетки (например, 16) смещение масштабируется от size
    expect(worldToCell(0, 0, 16)).toEqual({ x: 8, z: 8 });
  });

  it("освобождает все 26 ShapeGeometry при размонтировании и безопасно переживает React StrictMode", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const disposeSpy = vi.spyOn(THREE.ShapeGeometry.prototype, "dispose");

    const plain = render(<Ground grid={null} />);
    expect(disposeSpy).not.toHaveBeenCalled();
    plain.unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(26);

    disposeSpy.mockClear();
    const strict = render(
      <StrictMode>
        <Ground grid={null} />
      </StrictMode>,
    );
    // StrictMode монтирует -> имитирует unmount (26 dispose) -> пересоздаёт живые геометрии при повторном mount
    expect(disposeSpy).toHaveBeenCalledTimes(26);
    strict.unmount();
    // Финальное размонтирование очищает вновь созданные 26 геометрий
    expect(disposeSpy).toHaveBeenCalledTimes(52);
    errSpy.mockRestore();
  });

  it("отрисовывает WebglFallback с court-fallback.jpg и сообщением", () => {
    const { container } = render(<WebglFallback message="Нужен WebGL" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toContain("court-fallback.jpg");
    expect(container.querySelector(".court-note")?.textContent).toBe("Нужен WebGL");
  });
});
