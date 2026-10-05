/**
 * Герб игрока на флаге Цитадели.
 *
 * Игрок не загружает картинку: он собирает герб из ограниченного набора (рисунок поля,
 * два цвета, позже — эмблема). Ядро хранит только маленькую запись `BannerSpec`
 * (несколько чисел и цветов из палитры), а скин рисует по ней ткань флага.
 * Так нет модерации чужих картинок, запись занимает считанные байты, а новые узоры,
 * цвета и эмблемы можно выдавать за ивенты и покупки.
 *
 * Эмблемы пока не рисуем: набор значков нужно согласовать отдельно.
 */

import * as THREE from "three";

export interface BannerSpec {
  /** Номер рисунка поля из PATTERNS. */
  pattern: number;
  /** Основной цвет ткани (hex из палитры). */
  field: string;
  /** Второй цвет рисунка (hex из палитры). */
  accent: string;
  /** Номер эмблемы или null, пока набор эмблем не утверждён. */
  emblem?: number | null;
}

/** Нейтральный флаг по умолчанию: серая ткань без рисунка (как на концептах). */
export const NEUTRAL_BANNER: BannerSpec = { pattern: 0, field: "#cfcac0", accent: "#8d887e", emblem: null };

type Painter = (g: CanvasRenderingContext2D, w: number, h: number, accent: string) => void;

/** Рисунки поля. Порядок менять нельзя: номер хранится у игрока. */
export const PATTERNS: readonly { id: string; paint: Painter }[] = [
  { id: "plain", paint: () => {} },
  { id: "split-h", paint: (g, w, h, a) => { g.fillStyle = a; g.fillRect(0, h / 2, w, h / 2); } },
  { id: "stripe-v", paint: (g, w, h, a) => { g.fillStyle = a; g.fillRect(w * 0.38, 0, w * 0.24, h); } },
  {
    id: "diagonal",
    paint: (g, w, h, a) => {
      g.fillStyle = a;
      g.beginPath(); g.moveTo(0, h); g.lineTo(w, 0); g.lineTo(w, h); g.closePath(); g.fill();
    },
  },
  {
    id: "border",
    paint: (g, w, h, a) => {
      g.strokeStyle = a; g.lineWidth = Math.min(w, h) * 0.12;
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    },
  },
  {
    id: "chevron",
    paint: (g, w, h, a) => {
      g.fillStyle = a;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.55, h / 2); g.lineTo(0, h); g.lineTo(0, h * 0.72); g.lineTo(w * 0.27, h / 2); g.lineTo(0, h * 0.28); g.closePath(); g.fill();
    },
  },
];

const cache = new Map<string, THREE.CanvasTexture>();

/** Текстура ткани по спецификации (кеш по ключу). Неверный рисунок откатывается на «plain». */
export function bannerTexture(spec: BannerSpec): THREE.CanvasTexture {
  const key = `${spec.pattern}|${spec.field}|${spec.accent}`;
  let hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const g = canvas.getContext("2d")!;
  g.fillStyle = spec.field;
  g.fillRect(0, 0, canvas.width, canvas.height);
  (PATTERNS[spec.pattern] ?? PATTERNS[0]!).paint(g, canvas.width, canvas.height, spec.accent);
  hit = new THREE.CanvasTexture(canvas);
  hit.colorSpace = THREE.SRGBColorSpace;
  hit.anisotropy = 4;
  cache.set(key, hit);
  return hit;
}
