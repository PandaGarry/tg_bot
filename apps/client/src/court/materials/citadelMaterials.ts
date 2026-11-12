/**
 * Процедурные PBR-текстуры (DataTexture) и семейства материалов Цитадели (TDL-ARCH-006).
 *
 * Ноль внешних скачиваний и ноль новых зависимостей: тайловые карты альбедо
 * и рельефа (bumpMap) детерминированно строятся в памяти на чистом Uint8Array,
 * привязаны к жизненному циклу смонтированного <CitadelBuilding /> (чистый
 * dispose на unmount + безопасное пересоздание в React StrictMode).
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
  readonly agedBronze: string;
  readonly boneIvory: string;
  readonly hearthGlow: string;
  readonly flameGlow: string;
  readonly necroticBase: string;
  readonly necroticGlow: string;
  readonly bannerCloth: string;
  readonly ashSmoke: string;
}

export const CITADEL_PALETTE: CitadelMaterialPalette = {
  basaltBase: "#474a50",
  basaltMortar: "#26282c",
  stoneDressed: "#6d6a63",
  timberBlackened: "#38281d",
  roofSlate: "#2d333c",
  forgedIron: "#272a30",
  agedBronze: "#947439",
  boneIvory: "#b6aa92",
  hearthGlow: "#e07e26",
  flameGlow: "#ff9533",
  necroticBase: "#246652",
  necroticGlow: "#36b888",
  bannerCloth: "#6b1f1c",
  ashSmoke: "#8d8882",
};

const TEX_SIZE = 128;

function hash2d(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
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
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
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
}

/** Генерирует тайловую карту кладки тёмного базальта (альбедо + рельеф). */
export function buildBasaltAshlarMaps(size = TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rows = 8;
  const cols = 4;
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
      const isMortar = localY < 2 || localX < 2;
      const blockVar = (hash2d(col, row, 17) - 0.5) * 26;
      const grain = (hash2d(x, y, 29) - 0.5) * 14;
      const topHighlight = localY >= 2 && localY < 4 ? 10 : 0;
      const bottomShadow = localY >= rowH - 2 ? -10 : 0;

      const idx = (y * size + x) * 4;
      if (isMortar) {
        albedo[idx] = clampByte(34 + grain * 0.4);
        albedo[idx + 1] = clampByte(36 + grain * 0.4);
        albedo[idx + 2] = clampByte(41 + grain * 0.4);
        albedo[idx + 3] = 255;
        const b = clampByte(55 + grain * 0.5);
        bump[idx] = b;
        bump[idx + 1] = b;
        bump[idx + 2] = b;
        bump[idx + 3] = 255;
      } else {
        const baseR = 72 + blockVar + grain + topHighlight + bottomShadow;
        const baseG = 75 + blockVar + grain + topHighlight + bottomShadow;
        const baseB = 82 + blockVar + grain + topHighlight + bottomShadow;
        albedo[idx] = clampByte(baseR);
        albedo[idx + 1] = clampByte(baseG);
        albedo[idx + 2] = clampByte(baseB);
        albedo[idx + 3] = 255;
        const b = clampByte(175 + blockVar * 0.8 + grain * 1.4 + topHighlight * 2);
        bump[idx] = b;
        bump[idx + 1] = b;
        bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует тайловую карту тёсаного известняка для цоколей, углов и контрфорсов. */
export function buildDressedStoneMaps(size = TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rows = 4;
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
      const isMortar = localY < 2 || localX < 2;
      const blockVar = (hash2d(col, row, 43) - 0.5) * 18;
      const mineral = (hash2d(x, y, 59) - 0.5) * 16;
      const strata = Math.sin((y / size) * Math.PI * 10) * 5;
      const idx = (y * size + x) * 4;
      if (isMortar) {
        albedo[idx] = 54;
        albedo[idx + 1] = 52;
        albedo[idx + 2] = 49;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 68;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(111 + blockVar + mineral + strata);
        albedo[idx + 1] = clampByte(107 + blockVar + mineral + strata);
        albedo[idx + 2] = clampByte(99 + blockVar + mineral + strata);
        albedo[idx + 3] = 255;
        const b = clampByte(178 + mineral * 1.4 + strata * 2);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует тайловую карту почерневшего дуба (волокна + стыки досок). */
export function buildTimberMaps(size = TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const planks = 6;
  const plankW = size / planks;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const plank = Math.floor(x / plankW);
      const localX = x - plank * plankW;
      const seam = localX < 1.8;
      const plankVar = (hash2d(plank, 1, 71) - 0.5) * 14;
      const fiber = Math.sin((x + hash2d(plank, Math.floor(y / 6), 83) * 3) * 1.3) * 7 + (hash2d(x, y, 91) - 0.5) * 10;
      const idx = (y * size + x) * 4;
      if (seam) {
        albedo[idx] = 24;
        albedo[idx + 1] = 17;
        albedo[idx + 2] = 12;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 42;
        bump[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(74 + plankVar + fiber);
        albedo[idx + 1] = clampByte(52 + plankVar * 0.72 + fiber * 0.72);
        albedo[idx + 2] = clampByte(37 + plankVar * 0.55 + fiber * 0.55);
        albedo[idx + 3] = 255;
        const b = clampByte(166 + fiber * 2.2);
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует тайловую карту сланцевой черепицы (ряды с нахлёстом и кромкой). */
export function buildSlateRoofMaps(size = TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rows = 8;
  const cols = 6;
  const rowH = size / rows;
  const colW = size / cols;

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const stagger = (row % 2) * (colW * 0.5);
    const overlapDarken = localY < 2.2 ? -18 : localY > rowH - 2 ? 9 : 0;
    for (let x = 0; x < size; x++) {
      const sx = (x + stagger) % size;
      const col = Math.floor(sx / colW);
      const localX = sx - col * colW;
      const gap = localX < 1.6;
      const tileVar = (hash2d(col, row, 107) - 0.5) * 18;
      const speckle = (hash2d(x, y, 121) - 0.5) * 10;
      const idx = (y * size + x) * 4;
      if (gap) {
        albedo[idx] = 22;
        albedo[idx + 1] = 25;
        albedo[idx + 2] = 30;
        albedo[idx + 3] = 255;
        bump[idx] = bump[idx + 1] = bump[idx + 2] = 52;
        bump[idx + 3] = 255;
      } else {
        const slopeGrad = ((localY / rowH) - 0.5) * 14;
        albedo[idx] = clampByte(52 + tileVar + speckle + overlapDarken + slopeGrad);
        albedo[idx + 1] = clampByte(59 + tileVar + speckle + overlapDarken + slopeGrad);
        albedo[idx + 2] = clampByte(71 + tileVar + speckle + overlapDarken + slopeGrad);
        albedo[idx + 3] = 255;
        const b = clampByte(145 + (localY / rowH) * 65 + speckle * 1.3 + (localY < 2.2 ? -55 : 0));
        bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
        bump[idx + 3] = 255;
      }
    }
  }
  return { albedo, bump };
}

/** Генерирует тайловую карту кованого железа (следы ковки). */
export function buildForgedIronMaps(size = TEX_SIZE): TexturePixelMaps {
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pit = (hash2d(Math.floor(x / 3), Math.floor(y / 3), 137) - 0.5) * 18;
      const grain = (hash2d(x, y, 149) - 0.5) * 12;
      const idx = (y * size + x) * 4;
      albedo[idx] = clampByte(41 + pit * 0.6 + grain * 0.5);
      albedo[idx + 1] = clampByte(44 + pit * 0.6 + grain * 0.5);
      albedo[idx + 2] = clampByte(50 + pit * 0.6 + grain * 0.5);
      albedo[idx + 3] = 255;
      const b = clampByte(155 + pit * 2 + grain);
      bump[idx] = bump[idx + 1] = bump[idx + 2] = b;
      bump[idx + 3] = 255;
    }
  }
  return { albedo, bump };
}

/** Генерирует тканную текстуру боевого знамени (тёмная кайма и фактура полотна). */
export function buildBannerClothMap(size = TEX_SIZE): Uint8Array {
  const albedo = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const borderY = y < 8 || y > size - 9;
    for (let x = 0; x < size; x++) {
      const borderX = x < 7 || x > size - 8;
      const weave = ((x + y) % 2 === 0 ? 4 : -4) + (hash2d(x, y, 173) - 0.5) * 12;
      const idx = (y * size + x) * 4;
      if (borderY || borderX) {
        albedo[idx] = clampByte(48 + weave * 0.6);
        albedo[idx + 1] = clampByte(35 + weave * 0.5);
        albedo[idx + 2] = clampByte(24 + weave * 0.4);
        albedo[idx + 3] = 255;
      } else {
        albedo[idx] = clampByte(112 + weave);
        albedo[idx + 1] = clampByte(32 + weave * 0.5);
        albedo[idx + 2] = clampByte(29 + weave * 0.5);
        albedo[idx + 3] = 255;
      }
    }
  }
  return albedo;
}

export interface CitadelTextureSet {
  readonly basaltMap: THREE.DataTexture;
  readonly basaltBump: THREE.DataTexture;
  readonly dressedMap: THREE.DataTexture;
  readonly dressedBump: THREE.DataTexture;
  readonly timberMap: THREE.DataTexture;
  readonly timberBump: THREE.DataTexture;
  readonly slateMap: THREE.DataTexture;
  readonly slateBump: THREE.DataTexture;
  readonly ironMap: THREE.DataTexture;
  readonly ironBump: THREE.DataTexture;
  readonly bannerMap: THREE.DataTexture;
}

export function createCitadelTextureSet(): CitadelTextureSet {
  const basalt = buildBasaltAshlarMaps();
  const dressed = buildDressedStoneMaps();
  const timber = buildTimberMaps();
  const slate = buildSlateRoofMaps();
  const iron = buildForgedIronMaps();
  const banner = buildBannerClothMap();

  return {
    basaltMap: makeDataTexture(basalt.albedo, TEX_SIZE, THREE.SRGBColorSpace, 2, 2),
    basaltBump: makeDataTexture(basalt.bump, TEX_SIZE, THREE.NoColorSpace, 2, 2),
    dressedMap: makeDataTexture(dressed.albedo, TEX_SIZE, THREE.SRGBColorSpace, 2, 1.5),
    dressedBump: makeDataTexture(dressed.bump, TEX_SIZE, THREE.NoColorSpace, 2, 1.5),
    timberMap: makeDataTexture(timber.albedo, TEX_SIZE, THREE.SRGBColorSpace, 2, 1),
    timberBump: makeDataTexture(timber.bump, TEX_SIZE, THREE.NoColorSpace, 2, 1),
    slateMap: makeDataTexture(slate.albedo, TEX_SIZE, THREE.SRGBColorSpace, 2, 2),
    slateBump: makeDataTexture(slate.bump, TEX_SIZE, THREE.NoColorSpace, 2, 2),
    ironMap: makeDataTexture(iron.albedo, TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
    ironBump: makeDataTexture(iron.bump, TEX_SIZE, THREE.NoColorSpace, 1, 1),
    bannerMap: makeDataTexture(banner, TEX_SIZE, THREE.SRGBColorSpace, 1, 1),
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
    color: "#c87124",
    emissive: CITADEL_PALETTE.hearthGlow,
    emissiveIntensity: 0.78,
    roughness: 0.35,
  } as const;
}

export function createBrazierFlameMaterialProps() {
  return {
    color: "#d97a26",
    emissive: CITADEL_PALETTE.flameGlow,
    emissiveIntensity: 1.05,
    roughness: 0.3,
  } as const;
}

export function createNecroticCrystalMaterialProps() {
  return {
    color: CITADEL_PALETTE.necroticBase,
    emissive: CITADEL_PALETTE.necroticGlow,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.15,
  } as const;
}

export function createAshSmokeMaterialProps() {
  return {
    color: CITADEL_PALETTE.ashSmoke,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  } as const;
}
