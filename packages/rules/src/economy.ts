import {
  BUILDING_BASE,
  BUILDING_NAMES,
  COST_GROWTH,
  HOUSE_BONUS,
  MAX_BUILDING_LEVEL,
  RESOURCE_BASE_RATE,
  START_RESOURCES,
  TIME_GROWTH,
  UNITS,
} from './constants';
import {
  BUILDING_KEYS,
  RESOURCE_KEYS,
  UNIT_KEYS,
  emptyResources,
  type BuildingKey,
  type HouseKey,
  type ResourceKey,
  type Resources,
  type Troops,
  type UnitKey,
} from './types';

/** Стоимость апгрейда ДО уровня `level` (level >= 2). */
export function buildingCost(key: BuildingKey, level: number): Resources {
  const base = BUILDING_BASE[key].cost;
  const mult = Math.pow(COST_GROWTH, level - 2);
  const out = emptyResources();
  for (const [res, amount] of Object.entries(base) as [ResourceKey, number][]) {
    out[res] = Math.round(amount * mult);
  }
  return out;
}

/** Длительность апгрейда ДО уровня `level`, секунды. */
export function buildingTime(key: BuildingKey, level: number): number {
  return Math.round(BUILDING_BASE[key].time * Math.pow(TIME_GROWTH, level - 2));
}

export function maxLevelFor(key: BuildingKey, townHallLevel: number): number {
  return key === 'town_hall' ? MAX_BUILDING_LEVEL : townHallLevel;
}

export function canUpgrade(
  key: BuildingKey,
  currentLevel: number,
  townHallLevel: number,
): { ok: boolean; reason?: string } {
  if (key !== 'town_hall' && currentLevel >= townHallLevel) {
    return {
      ok: false,
      reason: `Сначала подними ${BUILDING_NAMES.town_hall} до уровня ${currentLevel + 1}`,
    };
  }
  if (currentLevel >= MAX_BUILDING_LEVEL) return { ok: false, reason: 'Максимальный уровень' };
  return { ok: true };
}

/** Производство ресурса в секунду: линейно от уровня здания + бонус дома (если есть). */
export function productionPerSecond(
  buildings: Partial<Record<BuildingKey, number>>,
  house: HouseKey = 'order',
): Resources {
  const out = emptyResources();
  for (const key of BUILDING_KEYS) {
    const produces = BUILDING_BASE[key].produces;
    const level = buildings[key] ?? 0;
    if (!produces || level <= 0) continue;
    const base = RESOURCE_BASE_RATE[produces];
    // нелинейность: каждый следующий уровень чуть выгоднее предыдущего
    out[produces] += base * level * (1 + 0.06 * (level - 1));
  }
  if (house === 'trade') {
    for (const r of RESOURCE_KEYS) out[r] *= 1 + HOUSE_BONUS.tradeGather * 0.5;
  }
  return out;
}

export function storageCap(warehouseLevel: number): number {
  return Math.round(2000 * Math.pow(1.85, Math.max(0, warehouseLevel - 1)));
}

/** «Ленивое» начисление: ресурсы считаются по прошедшему времени, а не тиками. */
export function accrue(
  current: Resources,
  rates: Resources,
  lastTick: number,
  now: number,
  cap: number,
): { resources: Resources; updatedAt: number; capped: boolean } {
  const dt = Math.max(0, (now - lastTick) / 1000);
  if (dt <= 0) return { resources: { ...current }, updatedAt: lastTick, capped: false };
  const out = { ...current };
  let capped = false;
  for (const r of RESOURCE_KEYS) {
    if (r === 'ember') continue; // жар не течёт сам по себе
    const value = out[r] + rates[r] * dt;
    const limit = r === 'food' || r === 'wood' || r === 'stone' || r === 'iron' ? cap : Infinity;
    out[r] = Math.min(value, limit);
    if (value > limit) capped = true;
  }
  return { resources: out, updatedAt: now, capped };
}

export function canAfford(have: Resources, cost: Partial<Resources>): boolean {
  for (const [res, amount] of Object.entries(cost) as [ResourceKey, number][]) {
    if ((have[res] ?? 0) < amount - 1e-6) return false;
  }
  return true;
}

export function missingResources(have: Resources, cost: Partial<Resources>): Resources {
  const out = emptyResources();
  for (const [res, amount] of Object.entries(cost) as [ResourceKey, number][]) {
    const diff = amount - (have[res] ?? 0);
    if (diff > 0) out[res] = Math.ceil(diff);
  }
  return out;
}

export function pay(have: Resources, cost: Partial<Resources>): Resources {
  const out = { ...have };
  for (const [res, amount] of Object.entries(cost) as [ResourceKey, number][]) {
    out[res] = Math.max(0, out[res] - amount);
  }
  return out;
}

/* ─────────────────  ВОЙСКО  ───────────────── */

export function unitCost(key: UnitKey): Resources {
  const c = UNITS[key].cost;
  return { food: c.food, wood: c.wood, stone: c.stone, iron: c.iron, ember: c.ember };
}

export function unitTrainTime(key: UnitKey, barracksLevel: number): number {
  return UNITS[key].time / (1 + 0.09 * (Math.max(1, barracksLevel) - 1));
}

export function armyCost(troops: Troops): Resources {
  const out = emptyResources();
  for (const key of UNIT_KEYS) {
    const n = troops[key];
    if (n <= 0) continue;
    const c = unitCost(key);
    for (const r of RESOURCE_KEYS) out[r] += c[r] * n;
  }
  return out;
}

export function armyPower(troops: Troops): number {
  let p = 0;
  for (const key of UNIT_KEYS) p += troops[key] * UNITS[key].power;
  return Math.round(p);
}

export function armyCapacity(troops: Troops): number {
  let c = 0;
  for (const key of UNIT_KEYS) c += troops[key] * UNITS[key].capacity;
  return c;
}

/** Армия медленнейшего отряда; пустая армия не идёт. */
export function armySpeed(troops: Troops, house: HouseKey): number {
  let speed = Infinity;
  let any = false;
  for (const key of UNIT_KEYS) {
    if (troops[key] > 0) {
      speed = Math.min(speed, UNITS[key].speed);
      any = true;
    }
  }
  if (!any) return 0;
  return speed * (house === 'clans' ? 1 + HOUSE_BONUS.clansSpeed : 1);
}

export function houseDefenseBonus(house: HouseKey): number {
  return house === 'order' ? HOUSE_BONUS.orderDefense : 0;
}

export function houseGatherBonus(house: HouseKey): number {
  return house === 'trade' ? HOUSE_BONUS.tradeGather : 0;
}

/** Мощь игрока: здания + войско. Показывается в рейтинге. */
export function playerPower(
  buildings: Partial<Record<BuildingKey, number>>,
  troops: Troops,
): number {
  let p = 0;
  for (const key of BUILDING_KEYS) p += (buildings[key] ?? 0) * 25;
  return Math.round(p + armyPower(troops));
}

export function startingResources(): Resources {
  return { ...START_RESOURCES };
}
