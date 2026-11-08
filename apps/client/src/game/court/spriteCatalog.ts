/**
 * Общий, не зависящий от Pixi каталог арта двора.
 * React HUD и Pixi runtime используют одни и те же asset IDs.
 */
export interface BuildingSpriteDefinition {
  file: string;
  width: number;
  height: number;
  patch: number;
  tipX: number;
  tipY: number;
}

export const BUILDING_SPRITES: Readonly<Record<string, BuildingSpriteDefinition>> = {
  citadel: { file: "a-01", width: 591, height: 567, patch: 585, tipX: 295, tipY: 563 },
  sawmill: { file: "d-01", width: 605, height: 517, patch: 600, tipX: 302, tipY: 513 },
  quarry: { file: "a-03", width: 394, height: 325, patch: 388, tipX: 197, tipY: 321 },
  farm: { file: "b-01", width: 593, height: 371, patch: 588, tipX: 296, tipY: 367 },
  pen: { file: "b-02", width: 517, height: 361, patch: 512, tipX: 310, tipY: 357 },
  warehouse: { file: "c-03", width: 464, height: 543, patch: 459, tipX: 232, tipY: 539 },
  barracks: { file: "b-03", width: 613, height: 505, patch: 608, tipX: 306, tipY: 501 },
  infirmary: { file: "c-02", width: 514, height: 496, patch: 509, tipX: 257, tipY: 492 },
};

export function buildingSpriteUrl(type: string): string | undefined {
  const asset = BUILDING_SPRITES[type];
  return asset ? `/court/sprites/${asset.file}.png` : undefined;
}
