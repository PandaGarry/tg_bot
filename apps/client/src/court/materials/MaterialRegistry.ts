/**
 * Централизованный реестр определений материалов двора (Slice B1).
 *
 * Все цвета, roughness, metalness, opacity, side, depthWrite и flatShading
 * перенесены из CourtScene.tsx 1:1 без изменения жизненного цикла экземпляров:
 * R3F продолжает владеть созданием и очисткой материалов на уровне <mesh>,
 * поэтому анимированные материалы (дым, пыль, огонёк фонаря) остаются
 * изолированными и исключены утечки/преждевременные dispose при переключении
 * вкладок и в React StrictMode.
 *
 * Follow-up (Slice B2+): при переходе к пулу общих THREE.Material вынести
 * изменяемые opacity/emissiveIntensity в отдельные uniform/per-instance слои
 * и привязать жизненный цикл пула к конкретному <Canvas>/WebGLRenderer.
 */

import * as THREE from "three";
import { ACCENT_COLORS, C } from "./palette.js";

export interface StandardMaterialSpec {
  readonly color: string;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly flatShading?: boolean;
  readonly side?: THREE.Side;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly depthWrite?: boolean;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
}

export interface BasicMaterialSpec {
  readonly color?: string;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly depthWrite?: boolean;
}

export interface LineMaterialSpec {
  readonly color: string;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly depthWrite?: boolean;
}

export const COURT_MATERIALS = {
  // Окружение и земля
  snowOuter: { color: C.snowOuter, roughness: 1 },
  dirt: { color: C.dirt, roughness: 1 },
  snowPatchLight: { color: C.snowPatch, roughness: 1 },
  snowPatchAlt: { color: ACCENT_COLORS.snowAlt, roughness: 1 },
  snowDrift: { color: C.snowPatch, roughness: 1, flatShading: true },
  pebbleMuted: { color: ACCENT_COLORS.pebbleMuted, roughness: 1, flatShading: true },
  pebbleWarm: { color: ACCENT_COLORS.pebbleWarm, roughness: 1, flatShading: true },
  grassDry: { color: ACCENT_COLORS.grassDry, roughness: 1, flatShading: true },

  // Дорога
  roadWear: { color: ACCENT_COLORS.roadWear, roughness: 1 },
  roadBed: { color: ACCENT_COLORS.roadBed, roughness: 1 },
  roadSand: { color: ACCENT_COLORS.roadSand, roughness: 1 },
  roadCobbleLight: { color: ACCENT_COLORS.roadCobbleLight, roughness: 1, flatShading: true },
  roadCobbleDark: { color: ACCENT_COLORS.roadCobbleDark, roughness: 1, flatShading: true },

  // Ворота и частокол
  gateBody: { color: C.gate, roughness: 0.95, flatShading: true },
  gateTipFlat: { color: C.logTip, roughness: 0.95, flatShading: true },
  gateTip: { color: C.logTip, roughness: 0.95 },
  gateSlit: { color: ACCENT_COLORS.gateSlit, roughness: 1 },
  gateRoof: { color: C.roof, roughness: 0.85, flatShading: true },
  snowCap: { color: ACCENT_COLORS.snowCap, roughness: 0.8, flatShading: true },
  gateLeaf: { color: ACCENT_COLORS.gateLeaf, roughness: 0.95, flatShading: true },
  gateBeam: { color: C.beam, roughness: 0.9 },
  gateBeamFlat: { color: C.beam, roughness: 0.9, flatShading: true },
  gateStrap: { color: ACCENT_COLORS.gateStrap, roughness: 0.8, metalness: 0.25 },
  gateRing: { color: ACCENT_COLORS.goldTrim, metalness: 0.55, roughness: 0.35 },
  palisadeBody: { color: C.log, roughness: 0.95, flatShading: true },
  palisadeCap: { color: C.logTip, roughness: 0.95, flatShading: true },
  palisadeRail: { color: C.logTip, roughness: 0.95 },

  // Лес, птицы, луг
  treeTrunk: { color: C.trunk, roughness: 1, flatShading: true },
  treeFir1: { color: C.fir1, roughness: 1, flatShading: true },
  treeFir2: { color: C.fir2, roughness: 1, flatShading: true },
  treeFirTip: { color: C.firTip, roughness: 1, flatShading: true },
  birdWing: { color: ACCENT_COLORS.birdWing, roughness: 0.9, side: THREE.DoubleSide },
  meadowBush: { color: ACCENT_COLORS.bush, roughness: 0.95, flatShading: true },
  meadowStump: { color: C.trunk, roughness: 0.95, flatShading: true },
  meadowStumpTop: { color: C.frame, roughness: 0.9 },

  // Ратуша (CitadelLegacy)
  citadelPodium: { color: ACCENT_COLORS.citadelPodium, roughness: 0.95, flatShading: true },
  citadelStep: { color: ACCENT_COLORS.citadelStep, roughness: 0.95, flatShading: true },
  citadelStoneFlat: { color: C.stone, roughness: 0.9, flatShading: true },
  citadelQuoin: { color: ACCENT_COLORS.citadelQuoin, roughness: 0.9, flatShading: true },
  citadelArch: { color: ACCENT_COLORS.goldTrim, metalness: 0.45, roughness: 0.4 },
  citadelDoor: { color: ACCENT_COLORS.citadelDoor, roughness: 0.9 },
  citadelFrame: { color: C.frame, roughness: 0.85 },
  citadelWindow: { color: C.window, roughness: 0.5 },
  citadelWall: { color: C.wall, roughness: 0.95, flatShading: true },
  citadelCornice: { color: C.beam, roughness: 0.9, flatShading: true },
  citadelCorniceSnow: { color: ACCENT_COLORS.snowCap, roughness: 0.85, flatShading: true },
  citadelUpperFrame: { color: ACCENT_COLORS.goldTrim, metalness: 0.4, roughness: 0.45 },
  citadelClockTower: { color: ACCENT_COLORS.citadelStep, roughness: 0.9, flatShading: true },
  citadelGoldBelt: { color: ACCENT_COLORS.goldTrim, metalness: 0.55, roughness: 0.35, flatShading: true },
  citadelRoof: { color: ACCENT_COLORS.citadelRoof, roughness: 0.85, flatShading: true },
  citadelRoofSnow: { color: ACCENT_COLORS.snowCap, roughness: 0.8, flatShading: true },
  citadelSpire: { color: ACCENT_COLORS.goldTrim, metalness: 0.6, roughness: 0.3 },
  citadelSmoke: { color: C.smoke, transparent: true, opacity: 0.4, depthWrite: false },
  bannerPole: { color: C.beam, roughness: 0.9 },
  bannerCloth: { color: C.flag, side: THREE.DoubleSide, roughness: 0.85, flatShading: true },

  // Постройки и VFX (LegacyBuildings)
  smokePuff: { color: C.smoke, transparent: true, opacity: 0.35, depthWrite: false },
  windmillSail: { color: C.frame, side: THREE.DoubleSide, roughness: 0.85, flatShading: true },
  sawBlade: { color: ACCENT_COLORS.sawSteel, metalness: 0.65, roughness: 0.35 },
  sawHub: { color: C.beam, roughness: 0.6, metalness: 0.3 },
  rope: { color: ACCENT_COLORS.ropeDark, roughness: 1 },
  lanternFlame: {
    color: ACCENT_COLORS.lanternBody,
    emissive: ACCENT_COLORS.lanternGlow,
    emissiveIntensity: 0.85,
    roughness: 0.6,
  },
  cornerBeam: { color: C.beam, roughness: 0.95 },
  stoneBuilding: { color: C.stone, roughness: 0.95, flatShading: true },
  wallBuilding: { color: C.wall, roughness: 0.95, flatShading: true },
  frameBuilding: { color: C.frame, roughness: 0.9 },
  doorBuilding: { color: C.door, roughness: 0.95 },
  windowBuilding: { color: C.window, roughness: 0.5 },
  flowerBox: { color: ACCENT_COLORS.padFarm, roughness: 1 },
  flowerPetals: { color: C.flag, roughness: 0.8, flatShading: true },
  roofFlat: { color: C.roof, roughness: 0.85, flatShading: true },
  roofRed: { color: C.flag, roughness: 0.9, flatShading: true },
  logBody: { color: C.log, roughness: 0.95, flatShading: true },
  logTipFlat: { color: C.logTip, roughness: 0.95, flatShading: true },
  logTipSmooth: { color: C.logTip, roughness: 0.95 },
  furrow: { color: ACCENT_COLORS.furrow, roughness: 1 },
  sprout: { color: ACCENT_COLORS.sprout, roughness: 1, flatShading: true },
  plankWarm: { color: ACCENT_COLORS.plankWarm, roughness: 0.9 },
  plankMid: { color: ACCENT_COLORS.plankMid, roughness: 0.9 },
  rockWarm: { color: ACCENT_COLORS.stoneWarm, roughness: 1, flatShading: true },
  rockCool: { color: C.rock, roughness: 1, flatShading: true },
  blockLight: { color: ACCENT_COLORS.stoneLight, roughness: 0.95, flatShading: true },
  blockDark: { color: ACCENT_COLORS.stoneWarm, roughness: 0.95, flatShading: true },
  mineSlope: { color: ACCENT_COLORS.mineSlope, roughness: 1, flatShading: true },
  mineRock: { color: ACCENT_COLORS.mineRock, roughness: 1, flatShading: true },
  minePit: { color: ACCENT_COLORS.minePit, roughness: 1 },
  mineRail: { color: ACCENT_COLORS.mineRail, roughness: 0.9, metalness: 0.2 },
  mineOre: { color: ACCENT_COLORS.mineOre, roughness: 1, flatShading: true },
  barracksBase: { color: ACCENT_COLORS.barracksBase, roughness: 0.95, flatShading: true },
  spearTip: { color: ACCENT_COLORS.sawSteel, metalness: 0.6, roughness: 0.35 },
  shieldWood: { color: ACCENT_COLORS.shieldGold, roughness: 0.85 },
  dustPuff: { color: ACCENT_COLORS.dust, transparent: true, opacity: 0.5, depthWrite: false },
} as const satisfies Record<string, StandardMaterialSpec>;

export type CourtMaterialId = keyof typeof COURT_MATERIALS;

export function getStandardMaterialSpec(id: CourtMaterialId): StandardMaterialSpec {
  return COURT_MATERIALS[id];
}

export const INTERACTION_MATERIALS = {
  gridLine: {
    color: ACCENT_COLORS.gridLine,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  } satisfies LineMaterialSpec,
  raycastHidden: {
    transparent: true,
    opacity: 0,
    depthWrite: false,
  } satisfies BasicMaterialSpec,
} as const;

export function getPadMaterialSpec(color: string): StandardMaterialSpec {
  return { color, roughness: 1, flatShading: true };
}

export function getWaveClothMaterialSpec(color: string): StandardMaterialSpec {
  return { color, side: THREE.DoubleSide, roughness: 0.85, flatShading: true };
}

export function getRoadPebbleMaterialSpec(color: string): StandardMaterialSpec {
  return { color, roughness: 1, flatShading: true };
}

export function getGhostPlaneMaterialSpec(color: string): BasicMaterialSpec {
  return { color, transparent: true, opacity: 0.5, depthWrite: false };
}

export function getGhostBoxMaterialSpec(color: string): BasicMaterialSpec {
  return { color, transparent: true, opacity: 0.16, depthWrite: false };
}
