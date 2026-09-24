import { MARCH_BASE_SPEED, NODE_INFO, TERRAIN_INFO } from './constants';
import { armyCapacity, armySpeed, houseGatherBonus } from './economy';
import { distance, terrainAt } from './map';
import type { HouseKey, ResourceKey, Troops, WorldKind } from './types';
import { troopsTotal } from './types';

export const MIN_MARCH_SECONDS = 6;

/** Средняя проходимость маршрута: берём 5 проб, чтобы рельеф реально влиял на ETA. */
export function routeSpeedFactor(
  seed: number,
  kind: WorldKind,
  size: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  let sum = 0;
  const samples = 5;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const x = Math.round(fromX + (toX - fromX) * t);
    const y = Math.round(fromY + (toY - fromY) * t);
    const terrain = terrainAt(seed, kind, clamp(x, 0, size - 1), clamp(y, 0, size - 1));
    sum += TERRAIN_INFO[terrain].speed;
  }
  return sum / samples;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function travelSeconds(args: {
  seed: number;
  kind: WorldKind;
  size: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  troops: Troops;
  house: HouseKey;
}): number {
  const dist = distance(args.fromX, args.fromY, args.toX, args.toY);
  const speed = armySpeed(args.troops, args.house);
  if (speed <= 0) return 0;
  const factor = routeSpeedFactor(
    args.seed,
    args.kind,
    args.size,
    args.fromX,
    args.fromY,
    args.toX,
    args.toY,
  );
  const seconds = dist / (MARCH_BASE_SPEED * speed * factor);
  return Math.max(MIN_MARCH_SECONDS, Math.round(seconds));
}

/** Сколько войско унесёт с узла/из города. */
export function lootCapacity(troops: Troops, house: HouseKey): number {
  return armyCapacity(troops) * (1 + houseGatherBonus(house));
}

export function gatherSeconds(args: {
  resource: ResourceKey;
  available: number;
  troops: Troops;
  house: HouseKey;
}): { amount: number; seconds: number } {
  const amount = Math.min(args.available, lootCapacity(args.troops, args.house));
  if (amount <= 0) return { amount: 0, seconds: 0 };
  const rate = Math.max(10, 12 * Math.sqrt(Math.max(1, troopsTotal(args.troops)))) *
    (1 + houseGatherBonus(args.house)) *
    (NODE_INFO[args.resource]?.rate ?? 0.3) *
    3.2;
  return { amount: Math.floor(amount), seconds: Math.max(6, Math.round(amount / rate)) };
}
