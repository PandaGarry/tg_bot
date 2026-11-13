/**
 * Декларативная карта уровней Цитадели (TDL-ARCH-006 v2, уровни 1..5).
 *
 * Пять стадий развития ЕДИНОГО архитектурного замысла (осевой готический
 * оплот-некрополь: массивный базальтовый стилобат -> центральный неф с глубоким
 * резным порталом -> контрфорсы и пинакли -> фланговые башни -> нервюрный
 * соборный некротический реликварий с аркбутанами и геральдикой).
 *
 * Авторитетный уровень `thLevel` и сетка приходят с сервера (`@tdl/module-court`).
 * Пятно фиксировано на [3, 3] клетки (3.3 м × 3.3 м при CELL = 1.1 м).
 */

import { CELL, footprintSize } from "../../../scene/gridMath.js";

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
  /** Архитектурные признаки единой эволюции. */
  readonly turretLayout: CitadelTurretLayout;
  readonly turretCount: 0 | 1 | 2 | 4;
  readonly gateStyle: CitadelGateStyle;
  readonly portalArchTiers: 2 | 3;
  readonly roofStyle: CitadelRoofStyle;
  readonly buttressCount: number;
  readonly hasPinnacles: boolean;
  readonly hasWallArcading: boolean;
  readonly hasQuoins: boolean;
  readonly hasBattlements: boolean;
  readonly hasMachicolations: boolean;
  readonly hasGableDormers: boolean;
  readonly hasRearApse: boolean;
  readonly hasFlyingButtresses: boolean;
  readonly brazierCount: 0 | 2 | 4;
  readonly bannerCount: 0 | 1 | 2 | 4;
  readonly hasHeraldicShields: boolean;
  readonly reliquaryRings: 0 | 1 | 2;
  readonly goldTrimStage: "none" | "subtle-keystone" | "heraldic-collar" | "gilded-tracery" | "sovereign-filigree";
  readonly boneAccentStage: "none" | "trophy-skull" | "spur-finials" | "ossuary-crown";
  readonly necroticStage: CitadelNecroticStage;
  readonly weatheringStage: 1 | 2 | 3;
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
    silhouetteTag: "fortified-chapel-foundation",
    boundsMeters: [2.52, 3.55, 2.84],
    plinthSize: 2.38,
    plinthHeight: 0.3,
    stepCount: 2,
    stepReachZ: 1.46,
    keepWidth: 1.98,
    keepHeight: 1.14,
    upperWidth: 1.84,
    upperHeight: 0.82,
    belfryWidth: 0,
    belfryHeight: 0,
    turretLayout: "none",
    turretCount: 0,
    gateStyle: "timber-arch",
    portalArchTiers: 2,
    roofStyle: "pitched-manor",
    buttressCount: 4,
    hasPinnacles: false,
    hasWallArcading: true,
    hasQuoins: true,
    hasBattlements: false,
    hasMachicolations: false,
    hasGableDormers: false,
    hasRearApse: false,
    hasFlyingButtresses: false,
    brazierCount: 0,
    bannerCount: 0,
    hasHeraldicShields: true,
    reliquaryRings: 0,
    goldTrimStage: "none",
    boneAccentStage: "none",
    necroticStage: "none",
    weatheringStage: 1,
    smokeOrigin: [0.68, 2.6, -0.68],
  },
  2: {
    level: 2,
    id: "citadel.lv2",
    silhouetteTag: "bastion-watchtower-porch",
    boundsMeters: [2.76, 4.24, 2.96],
    plinthSize: 2.56,
    plinthHeight: 0.34,
    stepCount: 3,
    stepReachZ: 1.52,
    keepWidth: 2.1,
    keepHeight: 1.24,
    upperWidth: 1.94,
    upperHeight: 0.88,
    belfryWidth: 0,
    belfryHeight: 0,
    turretLayout: "single-watch",
    turretCount: 1,
    gateStyle: "gated-porch",
    portalArchTiers: 2,
    roofStyle: "hip-dormer",
    buttressCount: 6,
    hasPinnacles: true,
    hasWallArcading: true,
    hasQuoins: true,
    hasBattlements: false,
    hasMachicolations: false,
    hasGableDormers: true,
    hasRearApse: false,
    hasFlyingButtresses: false,
    brazierCount: 2,
    bannerCount: 0,
    hasHeraldicShields: true,
    reliquaryRings: 0,
    goldTrimStage: "subtle-keystone",
    boneAccentStage: "trophy-skull",
    necroticStage: "ember-slit",
    weatheringStage: 1,
    smokeOrigin: [0.76, 2.9, -0.74],
  },
  3: {
    level: 3,
    id: "citadel.lv3",
    silhouetteTag: "twin-bastion-ossarium-keep",
    boundsMeters: [2.92, 4.92, 3.08],
    plinthSize: 2.74,
    plinthHeight: 0.38,
    stepCount: 3,
    stepReachZ: 1.56,
    keepWidth: 2.22,
    keepHeight: 1.32,
    upperWidth: 2.02,
    upperHeight: 0.92,
    belfryWidth: 1.1,
    belfryHeight: 0.98,
    turretLayout: "twin-front",
    turretCount: 2,
    gateStyle: "portcullis-keep",
    portalArchTiers: 3,
    roofStyle: "crenellated-belfry",
    buttressCount: 8,
    hasPinnacles: true,
    hasWallArcading: true,
    hasQuoins: true,
    hasBattlements: true,
    hasMachicolations: false,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: false,
    brazierCount: 2,
    bannerCount: 1,
    hasHeraldicShields: true,
    reliquaryRings: 0,
    goldTrimStage: "heraldic-collar",
    boneAccentStage: "trophy-skull",
    necroticStage: "reliquary-slit",
    weatheringStage: 2,
    smokeOrigin: [0.82, 3.04, -0.82],
  },
  4: {
    level: 4,
    id: "citadel.lv4",
    silhouetteTag: "four-tower-gothic-reliquary",
    boundsMeters: [3.08, 5.52, 3.18],
    plinthSize: 2.88,
    plinthHeight: 0.42,
    stepCount: 3,
    stepReachZ: 1.59,
    keepWidth: 2.32,
    keepHeight: 1.38,
    upperWidth: 2.1,
    upperHeight: 0.94,
    belfryWidth: 1.22,
    belfryHeight: 1.08,
    turretLayout: "four-corner",
    turretCount: 4,
    gateStyle: "gothic-portcullis",
    portalArchTiers: 3,
    roofStyle: "cruciform-lantern",
    buttressCount: 10,
    hasPinnacles: true,
    hasWallArcading: true,
    hasQuoins: true,
    hasBattlements: true,
    hasMachicolations: true,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: false,
    brazierCount: 4,
    bannerCount: 2,
    hasHeraldicShields: true,
    reliquaryRings: 1,
    goldTrimStage: "gilded-tracery",
    boneAccentStage: "spur-finials",
    necroticStage: "lantern-core",
    weatheringStage: 2,
    smokeOrigin: [0.86, 3.2, -0.86],
  },
  5: {
    level: 5,
    id: "citadel.lv5",
    silhouetteTag: "sovereign-necropolis-cathedral",
    boundsMeters: [3.18, 6.08, 3.24],
    plinthSize: 3.0,
    plinthHeight: 0.46,
    stepCount: 3,
    stepReachZ: 1.62,
    keepWidth: 2.4,
    keepHeight: 1.42,
    upperWidth: 2.16,
    upperHeight: 0.92,
    belfryWidth: 1.3,
    belfryHeight: 1.12,
    turretLayout: "four-bastion-spired",
    turretCount: 4,
    gateStyle: "barbican-fortress",
    portalArchTiers: 3,
    roofStyle: "sovereign-crown-spire",
    buttressCount: 12,
    hasPinnacles: true,
    hasWallArcading: true,
    hasQuoins: true,
    hasBattlements: true,
    hasMachicolations: true,
    hasGableDormers: true,
    hasRearApse: true,
    hasFlyingButtresses: true,
    brazierCount: 4,
    bannerCount: 4,
    hasHeraldicShields: true,
    reliquaryRings: 2,
    goldTrimStage: "sovereign-filigree",
    boneAccentStage: "ossuary-crown",
    necroticStage: "sovereign-crown",
    weatheringStage: 3,
    smokeOrigin: [0.9, 3.32, -0.92],
  },
};

export function getCitadelVisualSpec(level: number | undefined | null): CitadelLevelVisualSpec {
  return CITADEL_LEVEL_VARIANTS[clampCitadelLevel(level)];
}
