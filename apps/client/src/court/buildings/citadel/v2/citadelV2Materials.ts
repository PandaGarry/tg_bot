/**
 * Процедурные PBR-текстуры (DataTexture) и семейства материалов Цитадели (TDL-ARCH-006 v2).
 *
 * Ноль внешних скачиваний и ноль новых зависимостей: тайловые карты 256×256
 * (albedo, bumpMap, roughnessMap, alphaMap для рваных знамён, а также карты
 * выветренной кости, сажи/копоти и проржавевшего кованого железа) строятся
 * детерминированно в памяти на чистом Uint8Array и корректно освобождаются
 * при размонтировании (включая React StrictMode).
 *
 * Анимированные материалы (дым, пламя жаровен, некротический кристалл)
 * намеренно не разделяются между экземплярами: каждый анимируемый меш владеет
 * собственным экземпляром <meshStandardMaterial>.
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

export interface CitadelMaterialPalette {
  readonly basaltBase: string;
  readonly basaltMortar: string;
  readonly stoneDressed: string;
  readonly timberBlackened: string;
  readonly roofSlate: string;
  readonly forgedIron: string;
  readonly ironRust: string;
  readonly agedBronze: string;
  readonly boneIvory: string;
  readonly sootChar: string;
  readonly hearthGlow: string;
  readonly flameGlow: string;
  readonly necroticBase: string;
  readonly necroticGlow: string;
  readonly bannerCloth: string;
  readonly bannerGold: string;
  readonly ashSmoke: string;
}

export const CITADEL_PALETTE: CitadelMaterialPalette = {
  basaltBase: "#46494f",
  basaltMortar: "#202226",
  stoneDressed: "#726c61",
  timberBlackened: "#35251a",
  roofSlate: "#2d343e",
  forgedIron: "#282c33",
  ironRust: "#5d3524",
  agedBronze: "#9d7b3d",
  boneIvory: "#bfb298",
  sootChar: "#1d1b1a",
  hearthGlow: "#e48329",
  flameGlow: "#ff9938",
  necroticBase: "#1e6752",
  necroticGlow: "#34cc92",
  bannerCloth: "#6b1b1a",
  bannerGold: "#b58d42",
  ashSmoke: "#847f78",
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
 * Генерирует тайловую карту кладки тёмного готического базальта 256×256:
 * разнородные блоки, сколы углов, трещины, вертикальные потёки копоти и лишайник у швов.
 */
export function buildBasaltAshlarMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const rows = 10;
  const rowH = size / rows;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const cols = row % 3 === 0 ? 5 : 4;
    const colW = size / cols;
    const stagger = ((row * 37) % cols) * (colW * 0.45);
    // вертикальный профиль выветривания/копоти (усиление сажи сверху и сырости снизу)
    const verticalWeather = Math.sin((y / size) * Math.PI * 2) * 0.5 + 0.5;

    for (let x = 0; x < size; x++) {
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;

      const jitterEdge = (valueNoise(x, y, 6, 311) - 0.5) * 3.2;
      const effY = localY + jitterEdge * 0.55;
      const effX = localX + jitterEdge * 0.55;
      const isMortar = effY < 2.6 || effX < 2.6;

      // скол угла у части камней
      const chipSeed = hash2d(col, row, 409);
      const cornerDist = Math.min(localX, colW - localX) + Math.min(localY, rowH - localY);
      const isChipped = chipSeed > 0.62 && cornerDist < 6.5 && hash2d(x, y, 419) > 0.25;

      // трещины по блоку
      const crackNoise = Math.abs(valueNoise(x + col * 19, y + row * 11, 14, 503) - 0.5);
      const hasCrack = hash2d(col, row, 521) > 0.55 && crackNoise < 0.024 && !isMortar;

      // потёки копоти и дождевой сажи (вертикальные полосы)
      const sootStreak = Math.max(0, valueNoise(x * 1.9, y * 0.22, 18, 601) - 0.56) * 2.2;
      // лёгкий зеленовато-серый лишайник возле швов
      const mossPatch =
        (localY < 6 || localY > rowH - 5) && valueNoise(x, y, 10, 701) > 0.68 ? 1 : 0;

      const blockVar = (hash2d(col, row, 17) - 0.5) * 34;
      const coarse = (valueNoise(x, y, 10, 29) - 0.5) * 24;
      const micro = (hash2d(x, y, 89) - 0.5) * 14;
      const bevelTop = !isMortar && effY < 5.2 ? 12 : 0;
      const bevelBot = !isMortar && effY > rowH - 3.6 ? -13 : 0;

      const idx = (y * size + x) * 4;
      if (isMortar) {
        const m = clampByte(27 + micro * 0.45 + mossPatch * 7);
        albedo[idx] = m;
        albedo[idx + 1] = clampByte(m + 2 + mossPatch * 9);
        albedo[idx + 2] = clampByte(m + 5);
        albedo[idx + 3] = 255;
        const b = clampByte(40 + micro * 0.5);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 248;
        roughness[idx + 3] = 255;
      } else {
        const damageDarken = (isChipped ? -20 : 0) + (hasCrack ? -24 : 0) - sootStreak * 36 - verticalWeather * 8;
        const r = 74 + blockVar + coarse + micro + bevelTop + bevelBot + damageDarken + mossPatch * 4;
        const g = 77 + blockVar + coarse + micro + bevelTop + bevelBot + damageDarken + mossPatch * 10;
        const bCol = 85 + blockVar + coarse + micro + bevelTop + bevelBot + damageDarken;
        albedo[idx] = clampByte(r);
        albedo[idx + 1] = clampByte(g);
        albedo[idx + 2] = clampByte(bCol);
        albedo[idx + 3] = 255;

        const bumpVal =
          178 +
          blockVar * 0.65 +
          coarse * 1.6 +
          micro * 1.1 +
          bevelTop * 1.9 +
          (isChipped ? -48 : 0) +
          (hasCrack ? -65 : 0);
        const bb = clampByte(bumpVal);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = bb;
        bump[idx + 3] = 255;

        const roughVal = clampByte(206 + (isChipped ? 30 : 0) + (hasCrack ? 36 : 0) + sootStreak * 35 - bevelTop * 1.2);
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = roughVal;
        roughness[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump, roughness };
}

/**
 * Генерирует карту выветренного тёсаного камня для цоколей, архивольтов, вимпергов,
 * контрфорсов и рустов с потёками времени, сколами и трещинами.
 */
export function buildDressedStoneMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const rows = 5;
  const cols = 3;
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
      const edgeNoise = (valueNoise(x, y, 5, 91) - 0.5) * 2.2;
      const isMortar = localY + edgeNoise < 2.3 || localX + edgeNoise < 2.3;

      const blockVar = (hash2d(col, row, 43) - 0.5) * 22;
      const mineral = (valueNoise(x, y, 12, 59) - 0.5) * 20;
      const strata = Math.sin((y / size) * Math.PI * 14 + valueNoise(x, y, 16, 61) * 2.5) * 6;
      const soot = Math.max(0, valueNoise(x * 1.6, y * 0.28, 22, 617) - 0.55) * 2.4;
      const pit = hash2d(x, y, 631) > 0.965 ? -18 : 0;
      const crack =
        hash2d(col, row, 641) > 0.6 && Math.abs(valueNoise(x + col * 11, y, 15, 643) - 0.5) < 0.02 ? -24 : 0;

      const idx = (y * size + x) * 4;
      if (isMortar) {
        albedo[idx] = 44;
        albedo[idx + 1] = 42;
        albedo[idx + 2] = 39;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 56;
        bump[idx + 3] = 255;
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 248;
        roughness[idx + 3] = 255;
      } else {
        const d = blockVar + mineral + strata - soot * 40 + pit + crack;
        albedo[idx] = clampByte(115 + d);
        albedo[idx + 1] = clampByte(110 + d);
        albedo[idx + 2] = clampByte(101 + d);
        albedo[idx + 3] = 255;
        const b = clampByte(182 + mineral * 1.5 + strata * 2 + pit * 2 + crack * 2.5);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
        const r = clampByte(202 + soot * 36 - pit * 1.4 - crack * 1.4);
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = r;
        roughness[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump, roughness };
}

/** Генерирует карту старого обожжённого дуба с сучками, растрескиванием и железными гвоздями. */
export function buildTimberMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const planks = 6;
  const plankW = size / planks;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const plank = Math.floor(x / plankW);
      const localX = x - plank * plankW;
      const seam = localX < 2.2;
      const plankVar = (hash2d(plank, 1, 71) - 0.5) * 16;
      const warp = valueNoise(x, y, 16, 73) * 4.5;
      const fiber = Math.sin((x + warp) * 1.15) * 8 + (hash2d(x, y, 91) - 0.5) * 10;
      const charEdge = Math.max(0, 1 - Math.abs(localX - plankW * 0.5) / (plankW * 0.5));
      const charDarken = (1 - charEdge) * -10;
      // шляпки кованых гвоздей на планках
      const nailY = y % 64;
      const isNail =
        Math.hypot(localX - plankW * 0.22, nailY - 12) < 2.6 ||
        Math.hypot(localX - plankW * 0.78, nailY - 12) < 2.6;

      const idx = (y * size + x) * 4;
      if (seam) {
        albedo[idx] = 19;
        albedo[idx + 1] = 14;
        albedo[idx + 2] = 10;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 36;
        bump[idx + 3] = 255;
      } else if (isNail) {
        albedo[idx] = 38;
        albedo[idx + 1] = 40;
        albedo[idx + 2] = 45;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 232;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(70 + plankVar + fiber + charDarken);
        albedo[idx + 1] = clampByte(49 + plankVar * 0.72 + fiber * 0.7 + charDarken * 0.8);
        albedo[idx + 2] = clampByte(35 + plankVar * 0.55 + fiber * 0.55 + charDarken * 0.6);
        albedo[idx + 3] = 255;
        const b = clampByte(160 + fiber * 2.4);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует готическую заострённую сланцевую черепицу с нахлёстом, сколами и мхом. */
export function buildSlateRoofMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rows = 10;
  const cols = 8;
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
      // заострённая нижняя кромка готической сланцевой плитки
      const tipShift = Math.abs(localX / colW - 0.5) * 6;
      const effY = localY + tipShift;
      const gap = localX < 1.8 || effY < 2.2;
      const tileVar = (hash2d(col, row, 107) - 0.5) * 24;
      const speckle = (hash2d(x, y, 121) - 0.5) * 11;
      const missingCorner = hash2d(col, row, 129) > 0.84 && localX > colW - 6 && localY > rowH - 6;
      const moss = valueNoise(x, y, 14, 131) > 0.72 && localY < 7 ? 1 : 0;
      const slopeGrad = (localY / rowH - 0.5) * 16;

      const idx = (y * size + x) * 4;
      if (gap || missingCorner) {
        albedo[idx] = 20;
        albedo[idx + 1] = 23;
        albedo[idx + 2] = 28;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 44;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(50 + tileVar + speckle + slopeGrad + moss * 6);
        albedo[idx + 1] = clampByte(57 + tileVar + speckle + slopeGrad + moss * 14);
        albedo[idx + 2] = clampByte(69 + tileVar + speckle + slopeGrad + moss * 3);
        albedo[idx + 3] = 255;
        const b = clampByte(142 + (localY / rowH) * 70 + speckle * 1.4);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует карту старого кованого железа с молотковыми вмятинами и следами ржавчины. */
export function buildForgedIronMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pit = (valueNoise(x, y, 5, 137) - 0.5) * 24;
      const grain = (hash2d(x, y, 149) - 0.5) * 12;
      const rustMask = Math.max(0, valueNoise(x, y, 24, 151) - 0.62) * 2.6;
      const idx = (y * size + x) * 4;

      albedo[idx] = clampByte(41 + pit * 0.6 + grain * 0.5 + rustMask * 52);
      albedo[idx + 1] = clampByte(44 + pit * 0.6 + grain * 0.5 + rustMask * 20);
      albedo[idx + 2] = clampByte(51 + pit * 0.6 + grain * 0.5 + rustMask * 6);
      albedo[idx + 3] = 255;

      const b = clampByte(155 + pit * 2.2 + grain);
      bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
      bump[idx + 3] = 255;

      const r = clampByte(105 + rustMask * 115 - pit * 1.1);
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = r;
      roughness[idx + 3] = 255;
    }
  }
  return { albedo, bump, roughness };
}

/** Генерирует текстуру выветренной древней кости (оссуарий, рога, черепа). */
export function buildAgedBoneMaps(size = CITADEL_TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pore = (hash2d(x, y, 211) - 0.5) * 14;
      const age = (valueNoise(x, y, 18, 223) - 0.5) * 26;
      const crack = Math.abs(valueNoise(x, y * 0.5, 14, 227) - 0.5) < 0.022 ? -28 : 0;
      const grime = Math.max(0, 1 - y / (size * 0.45)) * -26;
      const idx = (y * size + x) * 4;
      albedo[idx] = clampByte(192 + age + pore + crack + grime);
      albedo[idx + 1] = clampByte(179 + age * 0.9 + pore + crack + grime);
      albedo[idx + 2] = clampByte(153 + age * 0.8 + pore + crack + grime * 1.1);
      albedo[idx + 3] = 255;
      const b = clampByte(168 + pore * 1.6 + crack * 2.4);
      bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
      bump[idx + 3] = 255;
    }
  }
  return { albedo, bump };
}

/** Генерирует тканную текстуру боевого геральдического знамени с эмблемой и сажей. */
export function buildBannerClothMap(size = CITADEL_TEX_SIZE): Uint8Array {
  const albedo = new Uint8Array(size * size * 4);
  const cx = size * 0.5;
  const cy = size * 0.46;

  for (let y = 0; y < size; y++) {
    const borderY = y < 10 || y > size - 11;
    const soot = Math.max(0, valueNoise(0, y, 26, 307) - 0.5) * 24;
    for (let x = 0; x < size; x++) {
      const borderX = x < 9 || x > size - 10;
      const weave = ((x + y) % 2 === 0 ? 4 : -4) + (hash2d(x, y, 173) - 0.5) * 14;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      // готический крест + геральдический ромб ордена в центре полотна
      const inDiamond = dx * 1.15 + dy * 0.95 < size * 0.24 && dx * 1.15 + dy * 0.95 > size * 0.17;
      const inCross = (dx < size * 0.032 && dy < size * 0.28) || (dy < size * 0.032 && dx < size * 0.22);
      const isEmblem = inDiamond || inCross;

      const idx = (y * size + x) * 4;
      if (borderY || borderX) {
        albedo[idx] = clampByte(54 + weave * 0.6 - soot * 0.5);
        albedo[idx + 1] = clampByte(42 + weave * 0.5 - soot * 0.5);
        albedo[idx + 2] = clampByte(25 + weave * 0.4 - soot * 0.4);
        albedo[idx + 3] = 255;
      } else if (isEmblem) {
        albedo[idx] = clampByte(178 + weave * 0.7 - soot);
        albedo[idx + 1] = clampByte(142 + weave * 0.6 - soot);
        albedo[idx + 2] = clampByte(68 + weave * 0.5 - soot * 0.7);
        albedo[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(110 + weave - soot);
        albedo[idx + 1] = clampByte(28 + weave * 0.5 - soot * 0.5);
        albedo[idx + 2] = clampByte(26 + weave * 0.5 - soot * 0.5);
        albedo[idx + 3] = 255;
      }
    }
  }
  return albedo;
}

/** Альфа-маска рваного «ласточкина хвоста» боевого знамени. */
export function buildBannerAlphaMap(size = CITADEL_TEX_SIZE): Uint8Array {
  const alpha = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ny = y / (size - 1);
    const vNotch = 1 - Math.abs(ny - 0.5) * 2; // 1 в центре по вертикали, 0 у краёв
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const fray = (valueNoise(x, y, 8, 733) - 0.5) * 0.08;
      // вырез ласточкиного хвоста на правом конце (nx > 0.72) + лёгкая бахрома
      const cutThreshold = 0.96 - vNotch * 0.22 + fray;
      const visible = nx < cutThreshold ? 255 : 0;
      const idx = (y * size + x) * 4;
      alpha[idx] = alpha[idx + 1] = alpha[idx + 2] = visible;
      alpha[idx + 3] = 255;
    }
  }
  return alpha;
}

/** Градиентная карта копоти и сажи (для арочных ниш над жаровнями и воротами). */
export function buildSootGradientMap(size = 128): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ny = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const horiz = Math.exp(-Math.pow((nx - 0.5) * 3.1, 2));
      const vert = Math.pow(1 - ny, 1.5);
      const noise = 0.72 + valueNoise(x, y, 10, 811) * 0.45;
      const soot = clampByte(255 * Math.min(1, horiz * vert * noise));
      const idx = (y * size + x) * 4;
      data[idx] = 18;
      data[idx + 1] = 17;
      data[idx + 2] = 16;
      data[idx + 3] = soot;
    }
  }
  return data;
}

export interface CitadelTextureSet {
  readonly basaltMap: THREE.DataTexture;
  readonly basaltBump: THREE.DataTexture;
  readonly basaltRoughness: THREE.DataTexture;
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
  readonly sootOverlay: THREE.DataTexture;
}

export function createCitadelTextureSet(): CitadelTextureSet {
  const basalt = buildBasaltAshlarMaps();
  const dressed = buildDressedStoneMaps();
  const timber = buildTimberMaps();
  const slate = buildSlateRoofMaps();
  const iron = buildForgedIronMaps();
  const bone = buildAgedBoneMaps();
  const banner = buildBannerClothMap();
  const bannerAlpha = buildBannerAlphaMap();
  const soot = buildSootGradientMap();

  return {
    basaltMap: makeDataTexture(basalt.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.6, 1.6),
    basaltBump: makeDataTexture(basalt.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.6, 1.6),
    basaltRoughness: makeDataTexture(basalt.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.6, 1.6),
    dressedMap: makeDataTexture(dressed.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.5, 1.2),
    dressedBump: makeDataTexture(dressed.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.5, 1.2),
    dressedRoughness: makeDataTexture(dressed.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.5, 1.2),
    timberMap: makeDataTexture(timber.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1.8, 1),
    timberBump: makeDataTexture(timber.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1.8, 1),
    slateMap: makeDataTexture(slate.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 2, 2),
    slateBump: makeDataTexture(slate.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 2, 2),
    ironMap: makeDataTexture(iron.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
    ironBump: makeDataTexture(iron.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    ironRoughness: makeDataTexture(iron.roughness!, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    boneMap: makeDataTexture(bone.albedo, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
    boneBump: makeDataTexture(bone.bump, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1),
    bannerMap: makeDataTexture(banner, CITADEL_TEX_SIZE, THREE.SRGBColorSpace, 1, 1, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping),
    bannerAlpha: makeDataTexture(bannerAlpha, CITADEL_TEX_SIZE, THREE.NoColorSpace, 1, 1, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping),
    sootOverlay: makeDataTexture(soot, 128, THREE.SRGBColorSpace, 1, 1, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping),
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

/** Изолированные фабрики для анимируемых материалов (без разделения между мешами). */
export function createHearthWindowMaterialProps() {
  return {
    color: "#cb7526",
    emissive: CITADEL_PALETTE.hearthGlow,
    emissiveIntensity: 0.78,
    roughness: 0.34,
  } as const;
}

export function createBrazierFlameMaterialProps() {
  return {
    color: "#dd7f28",
    emissive: CITADEL_PALETTE.flameGlow,
    emissiveIntensity: 1.08,
    roughness: 0.28,
  } as const;
}

export function createNecroticCrystalMaterialProps() {
  return {
    color: CITADEL_PALETTE.necroticBase,
    emissive: CITADEL_PALETTE.necroticGlow,
    emissiveIntensity: 0.92,
    roughness: 0.2,
    metalness: 0.22,
  } as const;
}

export function createAshSmokeMaterialProps() {
  return {
    color: CITADEL_PALETTE.ashSmoke,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  } as const;
}
