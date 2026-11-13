/**
 * Процедурные PBR-текстуры (DataTexture) и палитра материалов Цитадели TDL-ARCH-006 R2.
 *
 * Калибровка специально под реальный масштаб и дистанцию игровой камеры (~24 м):
 * - крупная каменная кладка (4-5 рядов на тайл, выраженные тёмные швы, широкие фаски);
 * - тёпло-холодная средне-светлая палитра камня (не сливается в чёрное пятно);
 * - чёткое разведение сланца кровли, крупноплашечного мореного дуба и блестящего кованого железа;
 * - кость и состаренная бронза зарезервированы только под Broken Ossuary Crown и реликварий;
 * - на штандартах нанесён единый символ фракции Broken Ossuary Crown.
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

export interface CitadelMaterialPalette {
  readonly stoneMain: string;
  readonly stoneDressed: string;
  readonly stoneDarkPlinth: string;
  readonly slateRoof: string;
  readonly timberOak: string;
  readonly forgedIron: string;
  readonly ironRust: string;
  readonly boneIvory: string;
  readonly agedBronze: string;
  readonly portalVoid: string;
  readonly hearthGlow: string;
  readonly flameGlow: string;
  readonly necroticBase: string;
  readonly necroticGlow: string;
  readonly bannerCloth: string;
  readonly bannerTrim: string;
  readonly ashSmoke: string;
}

export const CITADEL_PALETTE: CitadelMaterialPalette = {
  stoneMain: "#868178",
  stoneDressed: "#a69e8f",
  stoneDarkPlinth: "#595651",
  slateRoof: "#394557",
  timberOak: "#6b472b",
  forgedIron: "#3a404a",
  ironRust: "#6d3e28",
  boneIvory: "#d4c7aa",
  agedBronze: "#987943",
  portalVoid: "#100f13",
  hearthGlow: "#e6862a",
  flameGlow: "#ffa042",
  necroticBase: "#1e6e58",
  necroticGlow: "#35cf95",
  bannerCloth: "#6b1b1c",
  bannerTrim: "#a48344",
  ashSmoke: "#918c84",
};

export const CITADEL_TEX_SIZE = 256;

function hash2d(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy, seed);
  const b = hash2d(ix + 1, iy, seed);
  const c = hash2d(ix, iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}

function makeDataTexture(
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeatX: number,
  repeatY: number,
  wrapS: THREE.Wrapping = THREE.RepeatWrapping,
  wrapT: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = wrapS;
  tex.wrapT = wrapT;
  tex.repeat.set(repeatX, repeatY);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export interface TexturePixelMaps {
  readonly albedo: Uint8Array;
  readonly bump: Uint8Array;
  readonly roughness?: Uint8Array;
}

/**
 * Крупная крепостная кладка стен (macro block scale для читаемости с 24 м):
 * 5 выраженных рядов по высоте и 3 крупных блока в ряду, широкие скосы-фаски,
 * чередование тёплых известняковых и холодных базальтовых блоков, глубокие швы.
 */
export function buildWallAshlarMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const rows = 5;
  const rowH = size / rows;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const cols = row % 2 === 0 ? 3 : 4;
    const colW = size / cols;
    const stagger = ((row * 31) % cols) * (colW * 0.48);

    for (let x = 0; x < size; x++) {
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;

      const edgeJitter = (valueNoise(x, y, 8, 311) - 0.5) * 3.0;
      const effY = localY + edgeJitter * 0.6;
      const effX = localX + edgeJitter * 0.6;
      const isMortar = effY < 4.0 || effX < 4.0;

      // Крупные сколы кромки (macro chips) вместо мелкой пыли
      const chipSeed = hash2d(col, row, 409);
      const cornerDist = Math.min(localX, colW - localX) + Math.min(localY, rowH - localY);
      const isChipped = chipSeed > 0.58 && cornerDist < 10.5 && valueNoise(x, y, 5, 421) > 0.42;

      // Тёпло-холодная вариация каждого каменного блока
      const warmCold = (hash2d(col, row, 19) - 0.5) * 26;
      const blockTone = (hash2d(col, row, 37) - 0.5) * 38;
      const broadMineral = (valueNoise(x, y, 16, 53) - 0.5) * 20;
      const bevelTop = !isMortar && effY < 8.5 ? 20 : 0;
      const bevelLeft = !isMortar && effX < 7.5 ? 12 : 0;
      const bevelBot = !isMortar && effY > rowH - 5.5 ? -18 : 0;
      const bevelRight = !isMortar && effX > colW - 4.5 ? -12 : 0;

      // Мягкие широкие дождевые потёки у швов
      const rainStreak = Math.max(0, valueNoise(x * 1.4, y * 0.25, 22, 607) - 0.60) * 1.5;

      const idx = (y * size + x) * 4;
      if (isMortar) {
        albedo[idx] = 44;
        albedo[idx + 1] = 43;
        albedo[idx + 2] = 42;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 34;
        bump[idx + 3] = 255;
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 248;
        roughness[idx + 3] = 255;
      } else {
        const chipDark = isChipped ? -22 : 0;
        const base = 132 + blockTone + broadMineral + bevelTop + bevelLeft + bevelBot + bevelRight + chipDark - rainStreak * 28;
        // Тёплый известняк смещён к золотисто-серому, холодный камень — к сланцево-серому
        const r = base + warmCold * 0.45;
        const g = base + warmCold * 0.15;
        const b = base - warmCold * 0.55;
        albedo[idx] = clampByte(r);
        albedo[idx + 1] = clampByte(g);
        albedo[idx + 2] = clampByte(b);
        albedo[idx + 3] = 255;

        const bumpVal =
          176 +
          blockTone * 0.4 +
          broadMineral * 1.4 +
          bevelTop * 1.8 +
          bevelLeft * 1.2 +
          (isChipped ? -58 : 0);
        const bb = clampByte(bumpVal);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = bb;
        bump[idx + 3] = 255;

        const roughVal = clampByte(202 + (isChipped ? 32 : 0) + rainStreak * 28 - bevelTop * 1.1);
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = roughVal;
        roughness[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump, roughness };
}

/**
 * Тёсаный светлый камень для контрфорсов, обрамления портала, архивольтов и цоколей:
 * более ровный, светлее стен на ~18-22%, с глубокими стыками плит.
 */
export function buildDressedStoneMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const rows = 4;
  const cols = 2;
  const rowH = size / rows;
  const colW = size / cols;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const stagger = (row % 2) * (colW * 0.5);
    for (let x = 0; x < size; x++) {
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;
      const jitter = (valueNoise(x, y, 7, 91) - 0.5) * 2.4;
      const isMortar = localY + jitter < 3.4 || localX + jitter < 3.4;

      const blockVar = (hash2d(col, row, 43) - 0.5) * 20;
      const strata = (valueNoise(x, y, 18, 59) - 0.5) * 16;
      const bevel = !isMortar && localY < 7.0 ? 14 : !isMortar && localY > rowH - 4.5 ? -12 : 0;

      const idx = (y * size + x) * 4;
      if (isMortar) {
        albedo[idx] = 66;
        albedo[idx + 1] = 63;
        albedo[idx + 2] = 59;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 48;
        bump[idx + 3] = 255;
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 244;
        roughness[idx + 3] = 255;
      } else {
        const d = blockVar + strata + bevel;
        albedo[idx] = clampByte(166 + d);
        albedo[idx + 1] = clampByte(158 + d);
        albedo[idx + 2] = clampByte(143 + d * 0.9);
        albedo[idx + 3] = 255;
        const b = clampByte(184 + strata * 1.5 + bevel * 1.6);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
        const r = clampByte(192 - bevel * 0.8);
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = r;
        roughness[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump, roughness };
}

/**
 * Грубый выветренный старый дуб для ворот и балок (крупные толстые плахи,
 * глубокие щели, продольное волокно и редкие железные заклёпки).
 */
export function buildTimberMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const planks = 4;
  const plankW = size / planks;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const plank = Math.floor(x / plankW);
      const localX = x - plank * plankW;
      const seam = localX < 3.6;
      const plankVar = (hash2d(plank, 3, 71) - 0.5) * 20;
      const warp = valueNoise(x, y, 22, 73) * 5.0;
      const grain = Math.sin((x * 0.65 + warp) * 1.1) * 11 + (valueNoise(x * 0.5, y * 0.15, 10, 91) - 0.5) * 12;
      const bevel = !seam && localX < 8 ? 8 : !seam && localX > plankW - 5 ? -9 : 0;

      const nailY = y % 84;
      const isNail =
        Math.hypot(localX - plankW * 0.24, nailY - 16) < 3.4 ||
        Math.hypot(localX - plankW * 0.76, nailY - 16) < 3.4;

      const idx = (y * size + x) * 4;
      if (seam) {
        albedo[idx] = 24;
        albedo[idx + 1] = 16;
        albedo[idx + 2] = 11;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 28;
        bump[idx + 3] = 255;
      } else if (isNail) {
        albedo[idx] = 62;
        albedo[idx + 1] = 66;
        albedo[idx + 2] = 74;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 242;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(107 + plankVar + grain + bevel);
        albedo[idx + 1] = clampByte(71 + plankVar * 0.74 + grain * 0.72 + bevel);
        albedo[idx + 2] = clampByte(43 + plankVar * 0.52 + grain * 0.55 + bevel);
        albedo[idx + 3] = 255;
        const b = clampByte(166 + grain * 2.2 + bevel * 1.5);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/**
 * Прохладный сланцевый кровельный камень (крупные пластины с чёткими швами
 * нахлёста, заметной разницей тонов и скошенными кромками).
 */
export function buildSlateRoofMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rows = 6;
  const cols = 5;
  const rowH = size / rows;
  const colW = size / cols;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const stagger = (row % 2) * (colW * 0.5);

    for (let x = 0; x < size; x++) {
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;
      const tipShift = Math.abs(localX / colW - 0.5) * 8.0;
      const effY = localY + tipShift;
      const gap = localX < 2.8 || effY < 3.4;

      const tileVar = (hash2d(col, row, 107) - 0.5) * 28;
      const slopeShade = (localY / rowH - 0.5) * 22;
      const lightEdge = !gap && localY < 8 ? 14 : 0;

      const idx = (y * size + x) * 4;
      if (gap) {
        albedo[idx] = 24;
        albedo[idx + 1] = 29;
        albedo[idx + 2] = 38;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 38;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(58 + tileVar + slopeShade + lightEdge);
        albedo[idx + 1] = clampByte(70 + tileVar + slopeShade + lightEdge);
        albedo[idx + 2] = clampByte(89 + tileVar + slopeShade + lightEdge);
        albedo[idx + 3] = 255;
        const b = clampByte(142 + (localY / rowH) * 76 + tileVar * 0.4);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/**
 * Кованое железо с молотковыми гранями и лёгкой ржавчиной (управляемый металлический блик).
 */
export function buildForgedIronMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hammer = (valueNoise(x, y, 8, 137) - 0.5) * 26;
      const rustMask = Math.max(0, valueNoise(x, y, 28, 151) - 0.68) * 2.5;
      const idx = (y * size + x) * 4;

      albedo[idx] = clampByte(58 + hammer * 0.5 + rustMask * 56);
      albedo[idx + 1] = clampByte(63 + hammer * 0.5 + rustMask * 22);
      albedo[idx + 2] = clampByte(73 + hammer * 0.5 + rustMask * 6);
      albedo[idx + 3] = 255;

      const b = clampByte(160 + hammer * 2.1);
      bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
      bump[idx + 3] = 255;

      const r = clampByte(88 + rustMask * 115 - hammer * 1.1);
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = r;
      roughness[idx + 3] = 255;
    }
  }
  return { albedo, bump, roughness };
}

/** Древняя выветренная кость — только для эмблемы Broken Ossuary Crown и короны реликвария. */
export function buildAgedBoneMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const age = (valueNoise(x, y, 20, 223) - 0.5) * 24;
      const striation = Math.sin(x * 0.35 + valueNoise(x, y, 12, 229) * 3.0) * 5;
      const grime = Math.max(0, 1 - y / (size * 0.35)) * -20;
      const idx = (y * size + x) * 4;
      albedo[idx] = clampByte(212 + age + striation + grime);
      albedo[idx + 1] = clampByte(199 + age * 0.9 + striation + grime);
      albedo[idx + 2] = clampByte(170 + age * 0.8 + striation + grime * 1.1);
      albedo[idx + 3] = 255;
      const b = clampByte(172 + striation * 2.2 + age * 0.6);
      bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
      bump[idx + 3] = 255;
    }
  }
  return { albedo, bump };
}

/** Геральдическое знамя со знаком Broken Ossuary Crown (три восходящих ребра + вертикальная ость). */
export function buildBannerClothMap(size = CITADEL_TEX_SIZE): Uint8Array {
  const albedo = new Uint8Array(size * size * 4);
  const cx = size * 0.45;
  const cy = size * 0.50;

  for (let y = 0; y < size; y++) {
    const borderY = y < 12 || y > size - 13;
    const ny = (y - cy) / (size * 0.38); // -1..1
    for (let x = 0; x < size; x++) {
      const borderX = x < 10 || x > size - 11;
      const weave = ((x + y) % 2 === 0 ? 4 : -4) + (valueNoise(x, y, 10, 173) - 0.5) * 10;
      const nx = (x - cx) / (size * 0.34);

      // Знак Broken Ossuary Crown (ориентирован по горизонтали знамени: вверх = -nx или -ny; полотно широкое по X, высокое по Y)
      // На висящем с вертикального древка знамени x=0 у древка, x=size к хвосту; рисунок вертикален в Y (верх Y = size)
      const up = -(y - cy) / (size * 0.34); // + вверх в UV
      const side = (x - cx) / (size * 0.30);
      const inSpine = Math.abs(side) < 0.08 && Math.abs(up) < 0.88;
      const inLeftRib = Math.abs(side - (-0.42 + up * 0.14)) < 0.12 && up > -0.45 && up < 0.72;
      const inRightRib = Math.abs(side - (0.42 - up * 0.14)) < 0.12 && up > -0.45 && up < 0.72;
      const inBackRib = Math.abs(side) < 0.15 && up > 0.32 && up < 0.86;
      const inVoid = Math.abs(side) < 0.28 && up > -0.35 && up < 0.48 && !inSpine;

      const idx = (y * size + x) * 4;
      if (borderY || borderX) {
        albedo[idx] = clampByte(58 + weave * 0.5);
        albedo[idx + 1] = clampByte(46 + weave * 0.4);
        albedo[idx + 2] = clampByte(28 + weave * 0.3);
        albedo[idx + 3] = 255;
      } else if (inSpine) {
        albedo[idx] = clampByte(152 + weave);
        albedo[idx + 1] = clampByte(156 + weave);
        albedo[idx + 2] = clampByte(168 + weave);
        albedo[idx + 3] = 255;
      } else if (inLeftRib || inRightRib || inBackRib) {
        albedo[idx] = clampByte(210 + weave * 0.6);
        albedo[idx + 1] = clampByte(192 + weave * 0.6);
        albedo[idx + 2] = clampByte(144 + weave * 0.5);
        albedo[idx + 3] = 255;
      } else if (inVoid) {
        albedo[idx] = 26;
        albedo[idx + 1] = 16;
        albedo[idx + 2] = 18;
        albedo[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(112 + weave + ny * 4 + nx * 2);
        albedo[idx + 1] = clampByte(28 + weave * 0.5);
        albedo[idx + 2] = clampByte(28 + weave * 0.5);
        albedo[idx + 3] = 255;
      }
    }
  }
  return albedo;
}

/** Альфа-маска «ласточкина хвоста» боевого знамени. */
export function buildBannerAlphaMap(size = CITADEL_TEX_SIZE): Uint8Array {
  const alpha = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ny = y / (size - 1);
    const vNotch = 1 - Math.abs(ny - 0.5) * 2;
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const fray = (valueNoise(x, y, 10, 733) - 0.5) * 0.06;
      const cutThreshold = 0.96 - vNotch * 0.24 + fray;
      const visible = nx < cutThreshold ? 255 : 0;
      const idx = (y * size + x) * 4;
      alpha[idx] = alpha[idx + 1] = alpha[idx + 2] = visible;
      alpha[idx + 3] = 255;
    }
  }
  return alpha;
}

export interface CitadelTextureSet {
  readonly wallMap: THREE.DataTexture;
  readonly wallBump: THREE.DataTexture;
  readonly wallRoughness: THREE.DataTexture;
  readonly dressedMap: THREE.DataTexture;
  readonly dressedBump: THREE.DataTexture;
  readonly dressedRoughness: THREE.DataTexture;
  readonly timberMap: THREE.DataTexture;
  readonly timberBump: THREE.DataTexture;
  readonly slateMap: THREE.DataTexture;
  readonly slateBump: THREE.DataTexture;
  readonly ironMap: THREE.DataTexture;
  readonly ironBump: THREE.DataTexture;
  readonly ironRoughness: THREE.DataTexture;
  readonly boneMap: THREE.DataTexture;
  readonly boneBump: THREE.DataTexture;
  readonly bannerMap: THREE.DataTexture;
  readonly bannerAlpha: THREE.DataTexture;
}

export function createCitadelTextureSet(): CitadelTextureSet {
  const wall = buildWallAshlarMaps();
  const dressed = buildDressedStoneMaps();
  const timber = buildTimberMaps();
  const slate = buildSlateRoofMaps();
  const iron = buildForgedIronMaps();
  const bone = buildAgedBoneMaps();
  const banner = buildBannerClothMap();
  const bannerAlpha = buildBannerAlphaMap();

  return {
    wallMap: makeDataTexture(wall.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.15, 1.05),
    wallBump: makeDataTexture(wall.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.15, 1.05),
    wallRoughness: makeDataTexture(wall.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.15, 1.05),
    dressedMap: makeDataTexture(dressed.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.1, 1.0),
    dressedBump: makeDataTexture(dressed.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.1, 1.0),
    dressedRoughness: makeDataTexture(dressed.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.1, 1.0),
    timberMap: makeDataTexture(timber.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.0, 1.0),
    timberBump: makeDataTexture(timber.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.0, 1.0),
    slateMap: makeDataTexture(slate.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.2, 1.1),
    slateBump: makeDataTexture(slate.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.2, 1.1),
    ironMap: makeDataTexture(iron.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
    ironBump: makeDataTexture(iron.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    ironRoughness: makeDataTexture(iron.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    boneMap: makeDataTexture(bone.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
    boneBump: makeDataTexture(bone.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    bannerMap: makeDataTexture(banner, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping),
    bannerAlpha: makeDataTexture(bannerAlpha, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping),
  };
}

export function disposeCitadelTextureSet(set: CitadelTextureSet): void {
  const textures = Object.values(set) as THREE.DataTexture[];
  for (const tex of textures) {
    tex.userData.__tdlDisposed = true;
    tex.dispose();
  }
}

export function useCitadelTextureSet(): CitadelTextureSet {
  const [set, setTextureSet] = useState<CitadelTextureSet>(() => createCitadelTextureSet());

  useEffect(() => {
    let active = set;
    if ((Object.values(active) as THREE.DataTexture[]).some((t) => t.userData.__tdlDisposed)) {
      active = createCitadelTextureSet();
      setTextureSet(active);
    }
    return () => {
      disposeCitadelTextureSet(active);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return set;
}

/** Изолированные фабрики для анимируемых материалов (собственный экземпляр на меш). */
export function createHearthWindowMaterialProps() {
  return {
    color: "#cb7526",
    emissive: CITADEL_PALETTE.hearthGlow,
    emissiveIntensity: 0.72,
    roughness: 0.36,
  } as const;
}

export function createBrazierFlameMaterialProps() {
  return {
    color: "#e2882c",
    emissive: CITADEL_PALETTE.flameGlow,
    emissiveIntensity: 1.05,
    roughness: 0.28,
  } as const;
}

export function createNecroticCrystalMaterialProps() {
  return {
    color: CITADEL_PALETTE.necroticBase,
    emissive: CITADEL_PALETTE.necroticGlow,
    emissiveIntensity: 0.92,
    roughness: 0.22,
    metalness: 0.24,
  } as const;
}

export function createAshSmokeMaterialProps() {
  return {
    color: CITADEL_PALETTE.ashSmoke,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  } as const;
}
