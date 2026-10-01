import { boneWood } from "./boneWood/index.js";
import type { CourtSkin } from "./types.js";

export type { CourtSkin, GateProps, GroundProps } from "./types.js";

/** Все доступные скины. Новый скин — новая папка и одна запись здесь. */
export const SKINS: Record<string, CourtSkin> = {
  [boneWood.id]: boneWood,
};

export const DEFAULT_SKIN_ID = boneWood.id;

/** Неизвестный или не купленный идентификатор безопасно откатывается на скин по умолчанию. */
export function getSkin(id: string | null | undefined): CourtSkin {
  return (id ? SKINS[id] : undefined) ?? boneWood;
}
