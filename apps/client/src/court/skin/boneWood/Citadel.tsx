import type { CitadelProps } from "../types.js";
import { citadelStage } from "./citadelStage.js";
import { STAGES } from "./citadel/stages.js";

export { CITADEL_TIERS, citadelStage } from "./citadelStage.js";

/** Цитадель: центр двора, пятно 3×3 клетки, вход на +x. Растёт материалом и высотой, а не площадью. */
export function Citadel({ level, banner }: CitadelProps) {
  const Stage = STAGES[citadelStage(level) - 1]!;
  return <Stage banner={banner} />;
}
