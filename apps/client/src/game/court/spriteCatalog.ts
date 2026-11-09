/**
 * Общий, не зависящий от Pixi каталог арта двора.
 * React HUD и Pixi runtime используют одни и те же asset IDs.
 */
export interface BuildingSpriteDefinition {
  file: string;
  extension?: "png" | "svg";
  width: number;
  height: number;
  patch: number;
  tipX: number;
  tipY: number;
}

export const BUILDING_SPRITES: Readonly<Record<string, BuildingSpriteDefinition>> = {
  citadel: { file: "citadel-imperial-stage-01", extension: "svg", width: 512, height: 512, patch: 286, tipX: 256, tipY: 500 },
  sawmill: { file: "sawmill-imperial-stage-01", extension: "svg", width: 512, height: 448, patch: 300, tipX: 256, tipY: 427 },
  quarry: { file: "a-03", width: 394, height: 325, patch: 388, tipX: 197, tipY: 321 },
  farm: { file: "farm-imperial-stage-01", extension: "svg", width: 512, height: 448, patch: 300, tipX: 256, tipY: 427 },
  pen: { file: "b-02", width: 517, height: 361, patch: 512, tipX: 310, tipY: 357 },
  warehouse: { file: "warehouse-imperial-stage-01", extension: "svg", width: 512, height: 512, patch: 348, tipX: 256, tipY: 500 },
  barracks: { file: "barracks-imperial-stage-01", extension: "svg", width: 512, height: 512, patch: 348, tipX: 256, tipY: 500 },
  infirmary: { file: "c-02", width: 514, height: 496, patch: 509, tipX: 257, tipY: 492 },
};

export function buildingSpriteUrl(type: string): string | undefined {
  const asset = BUILDING_SPRITES[type];
  return asset ? `/court/sprites/${asset.file}.${asset.extension ?? "png"}` : undefined;
}


/**
 * Полный остаток production-art по утверждённому каталогу зданий.
 * Эти IDs намеренно не имеют prototype PNG: не подменять их случайными иконками.
 */
export const BUILDING_ART_BACKLOG = [
  { id: "academy", priority: "P1", kit: "research academy; five stages; original semantics must be defined independently of legacy web sprite" },
  { id: "wall", priority: "P0", kit: "straight, corner, gate, tower; 5 silhouette stages" },
  { id: "clan-hall", priority: "P1", kit: "clan assembly hall; 5 stages" },
  { id: "tavern", priority: "P2", kit: "single-level tavern" },
  { id: "watchtower", priority: "P0", kit: "scout tower; 5 stages" },
  { id: "forge", priority: "P1", kit: "blacksmith forge; 5 stages" },
  { id: "trade-post", priority: "P1", kit: "caravan exchange post; 5 stages" },
  { id: "range", priority: "P1", kit: "ranged troop training; 5 stages" },
  { id: "stable", priority: "P1", kit: "cavalry stable; 5 stages" },
  { id: "siege-yard", priority: "P1", kit: "siege workshop; 5 stages" },
  { id: "mine", priority: "P1", kit: "ore mine; 5 stages" },
] as const;

/** Декор двора пока рисуется fallback-примитивами; каждому ID нужен production asset. */
export const COURT_DECOR_ART_BACKLOG = ["lantern", "bench", "well", "flag", "road"] as const;
