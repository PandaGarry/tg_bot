/**
 * Карта не хранится в базе: она целиком выводится из seed'а мира (детерминированный шум).
 * Это и есть та самая экономия, которая позволяет держать мир на 96×96 (9216 тайлов)
 * без таблицы тайлов и без затрат на память.
 */
import { smoothNoise2D, valueNoise2D, rngFromParts } from './rng';
import type { TerrainKind, WorldKind } from './types';

export const TERRAIN_CODES: TerrainKind[] = [
  'plains',
  'forest',
  'hills',
  'mountain',
  'water',
  'ash',
];

export const TERRAIN_CODE: Record<TerrainKind, number> = {
  plains: 0,
  forest: 1,
  hills: 2,
  mountain: 3,
  water: 4,
  ash: 5,
};

export function terrainAt(seed: number, kind: WorldKind, x: number, y: number): TerrainKind {
  const n =
    smoothNoise2D(seed, x, y, 26) * 0.58 +
    smoothNoise2D(seed + 977, x, y, 11) * 0.3 +
    valueNoise2D(seed + 4231, x, y) * 0.12;

  if (kind === 'kvk') {
    if (n < 0.24) return 'water';
    if (n < 0.4) return 'ash';
    if (n < 0.62) return 'ash';
    if (n < 0.8) return 'hills';
    return 'mountain';
  }
  if (n < 0.27) return 'water';
  if (n < 0.47) return 'plains';
  if (n < 0.66) return 'forest';
  if (n < 0.82) return 'hills';
  return 'mountain';
}

/** Карта целиком: по одному байту на тайл (удобно гонять по сети в base64). */
export function generateMap(seed: number, kind: WorldKind, size: number): Uint8Array {
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y * size + x] = TERRAIN_CODE[terrainAt(seed, kind, x, y)];
    }
  }
  return out;
}

export function terrainFromCode(code: number): TerrainKind {
  return TERRAIN_CODES[code] ?? 'plains';
}

/** Кандидаты для стартовых городов игроков: ровная земля, не у края карты. */
export function* spawnCandidates(
  seed: number,
  kind: WorldKind,
  size: number,
): Generator<{ x: number; y: number }> {
  const rng = rngFromParts('spawn', seed, kind);
  const margin = 4;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const x = margin + Math.floor(rng() * (size - margin * 2));
    const y = margin + Math.floor(rng() * (size - margin * 2));
    const t = terrainAt(seed, kind, x, y);
    if (t === 'water' || t === 'mountain') continue;
    yield { x, y };
  }
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
