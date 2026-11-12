/**
 * Профили качества рендера двора (Slice B1).
 *
 * Текущий начальный профиль сохраняет точные параметры рендера PR #28:
 * dpr={[1, 1.75]}, shadows, ACESFilmicToneMapping с экспозицией 1.12 и
 * теневую карту 2048×2048. Адаптивное переключение качества в этом срезе не
 * добавляется.
 */

import * as THREE from "three";

export interface CourtQualityProfile {
  readonly id: "default";
  readonly shadows: boolean;
  readonly dpr: [number, number];
  readonly gl: {
    readonly antialias: boolean;
    readonly powerPreference: WebGLPowerPreference;
  };
  readonly toneMapping: THREE.ToneMapping;
  readonly toneMappingExposure: number;
  readonly camera: {
    readonly fov: number;
    readonly near: number;
    readonly far: number;
    readonly position: [number, number, number];
  };
  readonly directionalShadow: {
    readonly mapSize: [number, number];
    readonly cameraLeft: number;
    readonly cameraRight: number;
    readonly cameraTop: number;
    readonly cameraBottom: number;
    readonly bias: number;
    readonly normalBias: number;
  };
}

export const DEFAULT_QUALITY_PROFILE: CourtQualityProfile = {
  id: "default",
  shadows: true,
  dpr: [1, 1.75],
  gl: {
    antialias: true,
    powerPreference: "high-performance",
  },
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.12,
  camera: {
    fov: 40,
    near: 2,
    far: 140,
    position: [17, 16, 17],
  },
  directionalShadow: {
    mapSize: [2048, 2048],
    cameraLeft: -24,
    cameraRight: 24,
    cameraTop: 24,
    cameraBottom: -24,
    bias: -0.0004,
    normalBias: 0.02,
  },
};
