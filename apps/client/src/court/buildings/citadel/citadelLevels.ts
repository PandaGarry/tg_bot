/**
 * Декларативная карта архитектурной эволюции Цитадели (TDL-ARCH-006 R2, уровни 1..5).
 *
 * Ossuary Cathedral-Fortress — трёхчастная асимметричная композиция:
 * 1. Primary mass: широкий сводчатый Неф + гранёная Апсида + поперечный Трансепт-Придел;
 * 2. Secondary mass: узкий и глубокий выдвинутый Гейтхаус с тёмным зевом врат;
 * 3. Dominant vertical accent: вынесенная на лево-тыльное плечо гранёно-ступенчатая
 *    Башня-Реликварий с аркбутанами и венцом Broken Ossuary Crown.
 *
 * Авторитетный уровень `thLevel` приходит с сервера (`@tdl/module-court`).
 * Все габариты и вылеты контрфорсов строго внутри [3, 3] пятна (3.30 м × 3.30 м).
 */

import { CELL, footprintSize } from "../../scene/gridMath.js";

export type CitadelLevel = 1 | 2 | 3 | 4 | 5;

export type CitadelMassPhase =
  | "frontier-ossuary-chapel"
  | "gatehouse-of-the-watch"
  | "cathedral-keep"
  | "ossuary-bastion"
  | "sovereign-citadel";

export type CitadelReliquaryStage =
  | "corner-ossuary-base"
  | "watch-spire-offset"
  | "sanctuary-lantern-tower"
  | "first-broken-crown"
  | "sovereign-broken-crown";

export type CitadelGatehouseStage =
  | "sealed-lintel-portal"
  | "projecting-watch-gatehouse"
  | "fortified-portcullis-gate"
  | "pylon-barbican-gatehouse"
  | "sovereign-void-barbican";

export interface CitadelLevelVisualSpec {
  readonly level: CitadelLevel;
  readonly id: `citadel.lv${CitadelLevel}`;
  readonly silhouetteTag: CitadelMassPhase;
  /** Полные габариты [ширина, высота, глубина] внутри [3, 3] (<= 3.30 м × 6.20 м × 3.30 м). */
  readonly boundsMeters: readonly [width: number, height: number, depth: number];
  /** Базовый ступенчатый стилобат. */
  readonly plinthWidth: number;
  readonly plinthDepth: number;
  readonly plinthHeight: number;
  readonly plinthOffsetX: number;
  readonly plinthOffsetZ: number;
  readonly stepCount: 2 | 3;
  readonly stepReachZ: number;
  /** 1. Primary Mass: Sanctuary Nave + Apse + Transverse Side Wing. */
  readonly naveCenterX: number;
  readonly naveCenterZ: number;
  readonly naveWidth: number;
  readonly naveDepth: number;
  readonly naveWallHeight: number;
  readonly naveRoofHeight: number;
  readonly hasRearApse: boolean;
  readonly apseRadius: number;
  readonly apseHeight: number;
  readonly apseOffsetZ: number;
  readonly hasSideChapel: boolean;
  readonly sideChapelCenterX: number;
  readonly sideChapelWidth: number;
  readonly sideChapelDepth: number;
  readonly sideChapelHeight: number;
  readonly sideChapelRoofHeight: number;
  readonly naveButtressPairs: 2 | 3 | 4;
  readonly hasPinnacles: boolean;
  /** 2. Secondary Mass: Projecting Monumental Sealed Gatehouse. */
  readonly gatehouseStage: CitadelGatehouseStage;
  readonly gateCenterX: number;
  readonly gateFrontZ: number;
  readonly gateWidth: number;
  readonly gateDepth: number;
  readonly gateWallHeight: number;
  readonly gateParapetHeight: number;
  readonly portalVoidWidth: number;
  readonly portalVoidHeight: number;
  readonly portalVoidDepth: number;
  readonly portalArchTiers: 1 | 2 | 3;
  readonly hasPortcullis: boolean;
  readonly crownReliefScale: number;
  /** 3. Dominant Vertical Accent: Offset Stepped Reliquary Tower & Broken Ossuary Crown. */
  readonly reliquaryStage: CitadelReliquaryStage;
  readonly towerCenterX: number;
  readonly towerCenterZ: number;
  readonly towerBaseSize: number;
  readonly towerShaftRadius: number;
  readonly towerShaftTopY: number;
  readonly crownBaseY: number;
  readonly crownTotalTopY: number;
  readonly hasBrokenCrownTop: boolean;
  readonly flyingButtressCount: 0 | 1 | 2;
  /** Сдержанная ритуальная детализация (строго подчинена общей архитектуре). */
  readonly brazierCount: 0 | 2 | 4;
  readonly bannerCount: 0 | 1 | 2;
  readonly weatheringStage: 1 | 2 | 3;
  readonly smokeOrigin: readonly [x: number, y: number, z: number];
}

export const CITADEL_MIN_LEVEL: CitadelLevel = 1;
export const CITADEL_MAX_LEVEL: CitadelLevel = 5;

export function getCitadelFootprintEnvelope(): { widthM: number; depthM: number; maxHeightM: number } {
  const [cellsW, cellsD] = footprintSize("townhall");
  return {
    widthM: cellsW * CELL,
    depthM: cellsD * CELL,
    maxHeightM: 6.2,
  };
}

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
    silhouetteTag: "frontier-ossuary-chapel",
    boundsMeters: [2.44, 2.86, 2.74],
    plinthWidth: 2.34,
    plinthDepth: 2.46,
    plinthHeight: 0.22,
    plinthOffsetX: 0.02,
    plinthOffsetZ: 0.04,
    stepCount: 2,
    stepReachZ: 1.42,
    naveCenterX: 0.14,
    naveCenterZ: -0.02,
    naveWidth: 1.48,
    naveDepth: 1.66,
    naveWallHeight: 1.14,
    naveRoofHeight: 1.06,
    hasRearApse: false,
    apseRadius: 0,
    apseHeight: 0,
    apseOffsetZ: 0,
    hasSideChapel: false,
    sideChapelCenterX: 0,
    sideChapelWidth: 0,
    sideChapelDepth: 0,
    sideChapelHeight: 0,
    sideChapelRoofHeight: 0,
    naveButtressPairs: 2,
    hasPinnacles: false,
    gatehouseStage: "sealed-lintel-portal",
    gateCenterX: 0.14,
    gateFrontZ: 1.06,
    gateWidth: 0.88,
    gateDepth: 0.38,
    gateWallHeight: 1.34,
    gateParapetHeight: 0.16,
    portalVoidWidth: 0.44,
    portalVoidHeight: 0.94,
    portalVoidDepth: 0.30,
    portalArchTiers: 1,
    hasPortcullis: false,
    crownReliefScale: 0.32,
    reliquaryStage: "corner-ossuary-base",
    towerCenterX: -0.70,
    towerCenterZ: -0.66,
    towerBaseSize: 0.66,
    towerShaftRadius: 0.27,
    towerShaftTopY: 1.66,
    crownBaseY: 1.66,
    crownTotalTopY: 2.16,
    hasBrokenCrownTop: false,
    flyingButtressCount: 0,
    brazierCount: 0,
    bannerCount: 0,
    weatheringStage: 1,
    smokeOrigin: [-0.70, 2.22, -0.66],
  },
  2: {
    level: 2,
    id: "citadel.lv2",
    silhouetteTag: "gatehouse-of-the-watch",
    boundsMeters: [2.64, 3.84, 2.94],
    plinthWidth: 2.52,
    plinthDepth: 2.74,
    plinthHeight: 0.26,
    plinthOffsetX: 0.00,
    plinthOffsetZ: 0.06,
    stepCount: 2,
    stepReachZ: 1.48,
    naveCenterX: 0.18,
    naveCenterZ: -0.04,
    naveWidth: 1.50,
    naveDepth: 1.54,
    naveWallHeight: 1.30,
    naveRoofHeight: 1.14,
    hasRearApse: false,
    apseRadius: 0,
    apseHeight: 0,
    apseOffsetZ: 0,
    hasSideChapel: false,
    sideChapelCenterX: 0,
    sideChapelWidth: 0,
    sideChapelDepth: 0,
    sideChapelHeight: 0,
    sideChapelRoofHeight: 0,
    naveButtressPairs: 2,
    hasPinnacles: false,
    gatehouseStage: "projecting-watch-gatehouse",
    gateCenterX: 0.18,
    gateFrontZ: 1.24,
    gateWidth: 0.96,
    gateDepth: 0.66,
    gateWallHeight: 1.72,
    gateParapetHeight: 0.22,
    portalVoidWidth: 0.48,
    portalVoidHeight: 1.12,
    portalVoidDepth: 0.50,
    portalArchTiers: 2,
    hasPortcullis: true,
    crownReliefScale: 0.38,
    reliquaryStage: "watch-spire-offset",
    towerCenterX: -0.76,
    towerCenterZ: -0.70,
    towerBaseSize: 0.74,
    towerShaftRadius: 0.33,
    towerShaftTopY: 2.92,
    crownBaseY: 2.92,
    crownTotalTopY: 3.84,
    hasBrokenCrownTop: false,
    flyingButtressCount: 0,
    brazierCount: 2,
    bannerCount: 0,
    weatheringStage: 1,
    smokeOrigin: [0.74, 2.72, -0.56],
  },
  3: {
    level: 3,
    id: "citadel.lv3",
    silhouetteTag: "cathedral-keep",
    boundsMeters: [2.84, 4.68, 3.04],
    plinthWidth: 2.74,
    plinthDepth: 2.90,
    plinthHeight: 0.30,
    plinthOffsetX: 0.00,
    plinthOffsetZ: 0.02,
    stepCount: 3,
    stepReachZ: 1.54,
    naveCenterX: 0.18,
    naveCenterZ: -0.02,
    naveWidth: 1.54,
    naveDepth: 1.44,
    naveWallHeight: 1.66,
    naveRoofHeight: 1.28,
    hasRearApse: true,
    apseRadius: 0.54,
    apseHeight: 1.56,
    apseOffsetZ: -0.92,
    hasSideChapel: false,
    sideChapelCenterX: 0,
    sideChapelWidth: 0,
    sideChapelDepth: 0,
    sideChapelHeight: 0,
    sideChapelRoofHeight: 0,
    naveButtressPairs: 3,
    hasPinnacles: true,
    gatehouseStage: "fortified-portcullis-gate",
    gateCenterX: 0.18,
    gateFrontZ: 1.30,
    gateWidth: 1.04,
    gateDepth: 0.76,
    gateWallHeight: 1.90,
    gateParapetHeight: 0.26,
    portalVoidWidth: 0.52,
    portalVoidHeight: 1.26,
    portalVoidDepth: 0.58,
    portalArchTiers: 2,
    hasPortcullis: true,
    crownReliefScale: 0.44,
    reliquaryStage: "sanctuary-lantern-tower",
    towerCenterX: -0.78,
    towerCenterZ: -0.72,
    towerBaseSize: 0.82,
    towerShaftRadius: 0.37,
    towerShaftTopY: 3.48,
    crownBaseY: 3.48,
    crownTotalTopY: 4.68,
    hasBrokenCrownTop: false,
    flyingButtressCount: 1,
    brazierCount: 2,
    bannerCount: 1,
    weatheringStage: 2,
    smokeOrigin: [0.80, 3.10, -0.54],
  },
  4: {
    level: 4,
    id: "citadel.lv4",
    silhouetteTag: "ossuary-bastion",
    boundsMeters: [3.08, 5.42, 3.12],
    plinthWidth: 2.98,
    plinthDepth: 3.00,
    plinthHeight: 0.34,
    plinthOffsetX: 0.04,
    plinthOffsetZ: -0.02,
    stepCount: 3,
    stepReachZ: 1.56,
    naveCenterX: 0.18,
    naveCenterZ: -0.02,
    naveWidth: 1.54,
    naveDepth: 1.42,
    naveWallHeight: 2.00,
    naveRoofHeight: 1.32,
    hasRearApse: true,
    apseRadius: 0.58,
    apseHeight: 1.88,
    apseOffsetZ: -0.94,
    hasSideChapel: true,
    sideChapelCenterX: 1.08,
    sideChapelWidth: 0.76,
    sideChapelDepth: 0.96,
    sideChapelHeight: 2.04,
    sideChapelRoofHeight: 0.94,
    naveButtressPairs: 3,
    hasPinnacles: true,
    gatehouseStage: "pylon-barbican-gatehouse",
    gateCenterX: 0.18,
    gateFrontZ: 1.34,
    gateWidth: 1.08,
    gateDepth: 0.82,
    gateWallHeight: 2.02,
    gateParapetHeight: 0.30,
    portalVoidWidth: 0.54,
    portalVoidHeight: 1.38,
    portalVoidDepth: 0.66,
    portalArchTiers: 3,
    hasPortcullis: true,
    crownReliefScale: 0.50,
    reliquaryStage: "first-broken-crown",
    towerCenterX: -0.80,
    towerCenterZ: -0.74,
    towerBaseSize: 0.86,
    towerShaftRadius: 0.40,
    towerShaftTopY: 3.92,
    crownBaseY: 3.92,
    crownTotalTopY: 5.42,
    hasBrokenCrownTop: true,
    flyingButtressCount: 1,
    brazierCount: 2,
    bannerCount: 2,
    weatheringStage: 2,
    smokeOrigin: [1.14, 3.24, -0.34],
  },
  5: {
    level: 5,
    id: "citadel.lv5",
    silhouetteTag: "sovereign-citadel",
    boundsMeters: [3.16, 6.12, 3.18],
    plinthWidth: 3.08,
    plinthDepth: 3.06,
    plinthHeight: 0.38,
    plinthOffsetX: 0.04,
    plinthOffsetZ: -0.02,
    stepCount: 3,
    stepReachZ: 1.59,
    naveCenterX: 0.18,
    naveCenterZ: -0.02,
    naveWidth: 1.56,
    naveDepth: 1.44,
    naveWallHeight: 2.28,
    naveRoofHeight: 1.38,
    hasRearApse: true,
    apseRadius: 0.60,
    apseHeight: 2.16,
    apseOffsetZ: -0.96,
    hasSideChapel: true,
    sideChapelCenterX: 1.09,
    sideChapelWidth: 0.78,
    sideChapelDepth: 1.04,
    sideChapelHeight: 2.34,
    sideChapelRoofHeight: 1.04,
    naveButtressPairs: 4,
    hasPinnacles: true,
    gatehouseStage: "sovereign-void-barbican",
    gateCenterX: 0.18,
    gateFrontZ: 1.38,
    gateWidth: 1.14,
    gateDepth: 0.90,
    gateWallHeight: 2.16,
    gateParapetHeight: 0.36,
    portalVoidWidth: 0.58,
    portalVoidHeight: 1.48,
    portalVoidDepth: 0.74,
    portalArchTiers: 3,
    hasPortcullis: true,
    crownReliefScale: 0.56,
    reliquaryStage: "sovereign-broken-crown",
    towerCenterX: -0.82,
    towerCenterZ: -0.76,
    towerBaseSize: 0.90,
    towerShaftRadius: 0.42,
    towerShaftTopY: 4.30,
    crownBaseY: 4.30,
    crownTotalTopY: 6.12,
    hasBrokenCrownTop: true,
    flyingButtressCount: 2,
    brazierCount: 4,
    bannerCount: 2,
    weatheringStage: 3,
    smokeOrigin: [1.18, 3.48, -0.36],
  },
};

export function getCitadelVisualSpec(level: number | undefined | null): CitadelLevelVisualSpec {
  return CITADEL_LEVEL_VARIANTS[clampCitadelLevel(level)];
}
