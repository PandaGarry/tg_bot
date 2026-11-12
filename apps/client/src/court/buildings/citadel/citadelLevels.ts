/**
 * Декларативная карта уровней Цитадели (TDL-ARCH-006, уровни 1..5).
 *
 * Не задаёт экономику, цену улучшения, требования или пятно: авторитетный
 * уровень `thLevel` и сетка приходят из серверного снимка `@tdl/module-court`.
 * Пятно фиксировано на [3, 3] клетки (3.3 м × 3.3 м при CELL = 1.1 м),
 * все габариты каждого уровня строго укладываются внутри этого пятна.
 */

import { CELL, footprintSize } from "../../scene/gridMath.js";

export type CitadelLevel = 1 | 2 | 3 | 4 | 5;

export type CitadelGateStyle =
  | "timber-arch"
  | "gated-porch"
  | "portcullis-keep"
  | "gothic-portcullis"
  | "barbican-fortress";

export type CitadelTurretLayout =
  | "none"
  | "single-watch"
  | "twin-front"
  | "four-corner"
  | "four-bastion-spired";

export type CitadelRoofStyle =
  | "pitched-manor"
  | "hip-dormer"
  | "crenellated-belfry"
  | "cruciform-lantern"
  | "sovereign-crown-spire";

export type CitadelNecroticStage = "none" | "ember-slit" | "reliquary-slit" | "lantern-core" | "sovereign-crown";

export interface CitadelLevelVisualSpec {
  readonly level: CitadelLevel;
  readonly id: `citadel.lv${CitadelLevel}`;
  readonly silhouetteTag: string;
  /** Полные габариты [ширина, высота, глубина] в мировых метрах (внутри 3.3 м × 3.3 м). */
  readonly boundsMeters: readonly [width: number, height: number, depth: number];
  /** Габариты каменного подиума и ступеней. */
  readonly plinthSize: number;
  readonly plinthHeight: number;
  readonly stepCount: 2 | 3;
  readonly stepReachZ: number;
  /** Массы ярусов. */
  readonly keepWidth: number;
  readonly keepHeight: number;
  readonly upperWidth: number;
  readonly upperHeight: number;
  readonly belfryWidth: number;
  readonly belfryHeight: number;
  /** Архитектурные признаки прогрессии. */
  readonly turretLayout: CitadelTurretLayout;
  readonly turretCount: 0 | 1 | 2 | 4;
  readonly gateStyle: CitadelGateStyle;
  readonly roofStyle: CitadelRoofStyle;
  readonly buttressCount: number;
  readonly hasBattlements: boolean;
  readonly hasMachicolations: boolean;
  readonly hasGableDormers: boolean;
  readonly hasRearApse: boolean;
  readonly hasFlyingButtresses: boolean;
  readonly brazierCount: 0 | 2 | 4;
  readonly bannerCount: 0 | 1 | 2 | 4;
  readonly goldTrimStage: "none" | "subtle-keystone" | "heraldic-collar" | "gilded-tracery" | "sovereign-filigree";
  readonly boneAccentStage: "none" | "spur-finials" | "ossuary-crown";
  readonly necroticStage: CitadelNecroticStage;
  readonly smokeOrigin: readonly [x: number, y: number, z: number];
}

export const CITADEL_MIN_LEVEL: CitadelLevel = 1;
export const CITADEL_MAX_LEVEL: CitadelLevel = 5;

/** Максимальный размер пятна Цитадели по доменному контракту [3, 3] (3.30 м × 3.30 м). */
export function getCitadelFootprintEnvelope(): { widthM: number; depthM: number; maxHeightM: number } {
  const [cellsW, cellsD] = footprintSize("townhall");
  return {
    widthM: cellsW * CELL,
    depthM: cellsD * CELL,
    maxHeightM: 6.2,
  };
}

/** Приводит произвольное значение уровня с сервера к безопасному диапазону 1..5. */
export function clampCitadelLevel(level: number | undefined | null): CitadelLevel {
  if (typeof level !== "number" || !Number.isFinite(level)) return 1;
  const floored = Math.floor(level);
  if (floored <= 1) return 1;
  if (floored >= 5) return 5;
  return floored as CitadelLevel;
}

export const CITADEL_LEVEL_VARIANTS: Record<CitadelLevel, CitadelLevelVisualSpec> = {
  1: {
    level: 1,
    id: "citadel.lv1",
    silhouetteTag: "outpost-timber-stone-hall",
    boundsMeters: [2.44, 3.45, 2.74],
    plinthSize: 2.34,
    plinthHeight: 0.28,
    stepCount: 2,
    stepReachZ: 1.44,
    keepWidth: 1.98,
    keepHeight: 1.12,
    upperWidth: 1.84,
    upperHeight: 0.84,
    belfryWidth: 0,
    belfryHeight: 0,
    turretLayout: "none",
    turretCount: 0,
    gateStyle: "timber-arch",
    roofStyle: "pitched-manor",
    buttressCount: 0,
    hasBattlements: false,
    hasMachicolations: false,
    hasGableDormers: false,
    hasRearApse: false,
    hasFlyingButtresses: false,
    brazierCount: 0,
    bannerCount: 0,
    goldTrimStage: "none",
    boneAccentStage: "none",
    necroticStage: "none",
    smokeOrigin: [0.68, 2.55, -0.66],
  },
  2: {
    level: 2,
    id: "citadel.lv2",
    silhouetteTag: "bastion-watch-turret-porch",
    boundsMeters: [2.72, 4.18, 2.9],
    plinthSize: 2.54,
    plinthHeight: 0.34,
    stepCount: 3,
    stepReachZ: 1.5,
    keepWidth: 2.12,
    keepHeight: 1.24,
    upperWidth: 1.96,
    upperHeight: 0.9,
    belfryWidth: 0,
    belfryHeight: 0,
    turretLayout: "single-watch",
    turretCount: 1,
    gateStyle: "gated-porch",
    roofStyle: "hip-dormer",
    buttressCount: 6,
    hasBattlements: false,
    hasMachicolations: false,
    hasGableDormers: true,
    hasRearApse: false,
    hasFlyingButtresses: false,
    brazierCount: 2,
    bannerCount: 0,
    goldTrimStage: "subtle-keystone",
    boneAccentStage: "none",
    necroticStage: "ember-slit",
    smokeOrigin: [0.76, 2.86, -0.74],
  },
  3: {
    level: 3,
    id: "citadel.lv3",
    silhouetteTag: "twin-turret-crenellated-keep",
    boundsMeters: [2.88, 4.88, 3.04],
    plinthSize: 2.72,
    plinthHeight: 0.38,
    stepCount: 3,
    stepReachZ: 1.54,
    keepWidth: 2.24,
    keepHeight: 1.32,
    upperWidth: 2.04,
    upperHeight: 0.94,
    belfryWidth: 1.12,
    belfryHeight: 1.05,
    turretLayout: "twin-front",
    turretCount: 2,
    gateStyle: "portcullis-keep",
    roofStyle: "crenellated-belfry",
    buttressCount: 8,
    hasBattlements: true,
    hasMachicolations: false,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: false,
    brazierCount: 2,
    bannerCount: 1,
    goldTrimStage: "heraldic-collar",
    boneAccentStage: "none",
    necroticStage: "reliquary-slit",
    smokeOrigin: [0.84, 3.02, -0.82],
  },
  4: {
    level: 4,
    id: "citadel.lv4",
    silhouetteTag: "four-tower-gothic-fortress",
    boundsMeters: [3.04, 5.42, 3.16],
    plinthSize: 2.88,
    plinthHeight: 0.42,
    stepCount: 3,
    stepReachZ: 1.58,
    keepWidth: 2.34,
    keepHeight: 1.42,
    upperWidth: 2.12,
    upperHeight: 1.0,
    belfryWidth: 1.24,
    belfryHeight: 1.22,
    turretLayout: "four-corner",
    turretCount: 4,
    gateStyle: "gothic-portcullis",
    roofStyle: "cruciform-lantern",
    buttressCount: 10,
    hasBattlements: true,
    hasMachicolations: true,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: false,
    brazierCount: 4,
    bannerCount: 2,
    goldTrimStage: "gilded-tracery",
    boneAccentStage: "spur-finials",
    necroticStage: "lantern-core",
    smokeOrigin: [0.88, 3.2, -0.88],
  },
  5: {
    level: 5,
    id: "citadel.lv5",
    silhouetteTag: "sovereign-necrotic-citadel",
    boundsMeters: [3.16, 5.98, 3.24],
    plinthSize: 3.02,
    plinthHeight: 0.46,
    stepCount: 3,
    stepReachZ: 1.61,
    keepWidth: 2.44,
    keepHeight: 1.42,
    upperWidth: 2.2,
    upperHeight: 0.92,
    belfryWidth: 1.32,
    belfryHeight: 1.16,
    turretLayout: "four-bastion-spired",
    turretCount: 4,
    gateStyle: "barbican-fortress",
    roofStyle: "sovereign-crown-spire",
    buttressCount: 12,
    hasBattlements: true,
    hasMachicolations: true,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: true,
    brazierCount: 4,
    bannerCount: 4,
    goldTrimStage: "sovereign-filigree",
    boneAccentStage: "ossuary-crown",
    necroticStage: "sovereign-crown",
    smokeOrigin: [0.92, 3.36, -0.94],
  },
};

export function getCitadelVisualSpec(level: number | undefined | null): CitadelLevelVisualSpec {
  return CITADEL_LEVEL_VARIANTS[clampCitadelLevel(level)];
}
