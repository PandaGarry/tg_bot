/**
 * Набор общих «кирпичей» визуала двора: размеры сетки, палитра, процедурные
 * поверхности, генератор случайных чисел. Скины (см. types.ts) строятся из них
 * и не знают ни о сервере, ни о правилах игры.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/** Клетка двора: 14 × 1.1 = 15.4 — ровно площадка PLOT (модуль хранит размер сетки). */
export const CELL = 1.1;
export const PLOT = 7.7; // половина площадки (14 клеток по 1.1)
export const GATE_HALF = 1.5;

/** Палитра Bone-Wood №05: тёплое дерево, кость, тёплый снег. */
export const C = {
  sky: "#c3d3da",
  fogFar: "#c3d3da",
  snowOuter: "#f7f4ec",
  snowPatch: "#f3efe4",
  dirt: "#8a6544",
  path: "#b08a5c",
  log: "#6d4a2c",
  logTip: "#7d5735",
  gate: "#5d4229",
  banner: "#d9c9a6",
  stone: "#a09a8c",
  wall: "#7b5236",
  beam: "#4a3320",
  roof: "#f7f3e8",
  door: "#352417",
  window: "#2e2013",
  frame: "#d9c9a6",
  fir1: "#2f5540",
  fir2: "#3a6047",
  firTip: "#eef3ea",
  trunk: "#5d4530",
  rock: "#b9b2a4",
  wool: "#f1ead9",
  sheepHead: "#2c2622",
  flag: "#b3402f",
  smoke: "#efe9dd",
} as const;

export type SurfaceKind = "wood" | "soil" | "stone" | "snow";
export type SurfaceMaps = { color: THREE.DataTexture; bump: THREE.DataTexture };

/** Deterministic procedural maps add grain and surface relief without adding scene props. */
export function makeSurfaceMaps(kind: SurfaceKind, seed: number): SurfaceMaps {
  const size = 128;
  const colorData = new Uint8Array(size * size * 4);
  const bumpData = new Uint8Array(size * size * 4);
  const random = rng(seed);
  const tint: Record<SurfaceKind, [number, number, number]> = {
    wood: [1, 0.96, 0.89],
    soil: [1, 0.94, 0.84],
    stone: [0.97, 0.985, 1],
    snow: [0.96, 0.985, 1],
  };
  // The first pass was nearly invisible on phones: boost broad grain while
  // keeping snow softer than wood and soil so the low-poly palette stays clear.
  const amount: Record<SurfaceKind, number> = {
    wood: 0.055,
    soil: 0.06,
    stone: 0.05,
    snow: 0.028,
  };
  const noiseAmount = kind === "snow" ? 0.034 : 0.05;
  const baseShade = kind === "snow" ? 0.97 : 0.94;
  const reliefScale = kind === "wood" ? 48 : kind === "stone" ? 44 : kind === "soil" ? 40 : 26;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let structure: number;
      if (kind === "wood") {
        structure = Math.sin((x + Math.sin(y * 0.08) * 3) * 0.42) + Math.sin(y * 0.11 + x * 0.025) * 0.3;
      } else if (kind === "stone") {
        structure = Math.sin(x * 0.13 + Math.sin(y * 0.09) * 2.1) + Math.cos(y * 0.17 + x * 0.035);
      } else if (kind === "soil") {
        structure = Math.sin(x * 0.09 + Math.sin(y * 0.07) * 1.7) + Math.cos(y * 0.12 - x * 0.04);
      } else {
        structure = Math.sin(x * 0.14 + Math.cos(y * 0.11) * 1.3) + Math.cos(y * 0.16 + x * 0.03);
      }
      const noise = random() - 0.5;
      const shade = THREE.MathUtils.clamp(baseShade + structure * amount[kind] + noise * noiseAmount, 0.76, 1);
      const relief = THREE.MathUtils.clamp(128 + structure * reliefScale + noise * 46, 48, 208);
      const index = (y * size + x) * 4;
      colorData[index] = Math.round(255 * shade * tint[kind][0]);
      colorData[index + 1] = Math.round(255 * shade * tint[kind][1]);
      colorData[index + 2] = Math.round(255 * shade * tint[kind][2]);
      colorData[index + 3] = 255;
      bumpData[index] = relief;
      bumpData[index + 1] = relief;
      bumpData[index + 2] = relief;
      bumpData[index + 3] = 255;
    }
  }

  const color = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.magFilter = THREE.LinearFilter;
  color.minFilter = THREE.LinearMipmapLinearFilter;
  color.generateMipmaps = true;
  color.anisotropy = 4;
  color.needsUpdate = true;

  const bump = new THREE.DataTexture(bumpData, size, size, THREE.RGBAFormat);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.magFilter = THREE.LinearFilter;
  bump.minFilter = THREE.LinearMipmapLinearFilter;
  bump.generateMipmaps = true;
  bump.anisotropy = 4;
  bump.needsUpdate = true;
  return { color, bump };
}

export const SURFACE = {
  wood: makeSurfaceMaps("wood", 161),
  soil: makeSurfaceMaps("soil", 411),
  stone: makeSurfaceMaps("stone", 731),
  snow: makeSurfaceMaps("snow", 919),
} satisfies Record<SurfaceKind, SurfaceMaps>;

/** Детерминированный генератор: раскладка одинакова между кадрами и устройствами. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function LanternFlame({ y }: { y: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.emissiveIntensity = 0.85 + Math.sin(clock.elapsedTime * 7) * 0.25;
  });
  return (
    <mesh position-y={y} castShadow>
      <boxGeometry args={[0.17, 0.22, 0.17]} />
      <meshStandardMaterial ref={mat} color="#8a6a3a" emissive="#ffcf7a" emissiveIntensity={0.85} roughness={0.6} />
    </mesh>
  );
}
