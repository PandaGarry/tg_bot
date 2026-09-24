/** Базовые доменные типы. Не зависят ни от сервера, ни от клиента. */

export type ResourceKey = 'food' | 'wood' | 'stone' | 'iron' | 'ember';
export type Resources = Record<ResourceKey, number>;

export type BuildingKey =
  | 'town_hall'
  | 'farm'
  | 'lumber'
  | 'quarry'
  | 'mine'
  | 'barracks'
  | 'wall'
  | 'warehouse'
  | 'watchtower';

export type UnitKey = 'infantry' | 'archers' | 'cavalry';
export type Troops = Record<UnitKey, number>;

export type HouseKey = 'order' | 'clans' | 'trade';

export type TerrainKind = 'plains' | 'forest' | 'hills' | 'mountain' | 'water' | 'ash';

export type EntityKind = 'city' | 'camp' | 'node' | 'well';

export type MarchKind = 'attack' | 'gather' | 'scout' | 'occupy' | 'reinforce';
export type MarchPhase = 'outbound' | 'returning';

export type WorldKind = 'home' | 'kvk';

export const RESOURCE_KEYS: ResourceKey[] = ['food', 'wood', 'stone', 'iron', 'ember'];
export const BUILDABLE_RESOURCES: ResourceKey[] = ['food', 'wood', 'stone', 'iron'];
export const BUILDING_KEYS: BuildingKey[] = [
  'town_hall',
  'farm',
  'lumber',
  'quarry',
  'mine',
  'barracks',
  'wall',
  'warehouse',
  'watchtower',
];
export const UNIT_KEYS: UnitKey[] = ['infantry', 'archers', 'cavalry'];

export function emptyResources(): Resources {
  return { food: 0, wood: 0, stone: 0, iron: 0, ember: 0 };
}

export function emptyTroops(): Troops {
  return { infantry: 0, archers: 0, cavalry: 0 };
}

export function troopsTotal(t: Troops): number {
  return t.infantry + t.archers + t.cavalry;
}
