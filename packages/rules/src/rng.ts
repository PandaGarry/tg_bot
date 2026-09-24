/** Детерминированный PRNG: одинаковый результат на клиенте, сервере и в тестах. */

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromParts(...parts: (string | number)[]): Rng {
  return mulberry32(hashString(parts.join(':')));
}

/** Значение шума в диапазоне [0,1) для «бесконечной» карты без хранения тайлов. */
export function valueNoise2D(seed: number, x: number, y: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x * 374761393), 668265263);
  h = Math.imul(h ^ (y * 668265263), 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Сглаженный шум (билинейная интерполяция решётки) — даёт «материки», а не соль-перец. */
export function smoothNoise2D(seed: number, x: number, y: number, scale: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const n00 = valueNoise2D(seed, x0, y0);
  const n10 = valueNoise2D(seed, x0 + 1, y0);
  const n01 = valueNoise2D(seed, x0, y0 + 1);
  const n11 = valueNoise2D(seed, x0 + 1, y0 + 1);
  const a = n00 * (1 - tx) + n10 * tx;
  const b = n01 * (1 - tx) + n11 * tx;
  return a * (1 - ty) + b * ty;
}
