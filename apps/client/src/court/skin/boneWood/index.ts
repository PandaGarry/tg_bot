import { WINTER } from "../kit.js";
import type { CourtSkin } from "../types.js";
import { Fence } from "./Fence.js";
import { Gate } from "./Gate.js";
import { Ground } from "./Ground.js";
import { Road } from "./Road.js";
import { Trees } from "./Trees.js";

/** Базовый скин: тёплое дерево, кость и снег (палитра Bone-Wood №05). */
export const boneWood: CourtSkin = {
  id: "bone-wood",
  name: "Кость и дерево",
  gateTiers: 3,
  Ground,
  Fence,
  Gate,
  Road,
  Trees,
  season: WINTER,
};
