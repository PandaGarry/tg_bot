import type { CitadelProps } from "../types.js";
import { STAGES } from "./citadel/stages.js";

/** Число видов Цитадели: смена каждые 5 уровней (1–5, 6–10, 11–15, 16–20, 21–25). */
export const CITADEL_TIERS = 5;

/** Стадия внешнего вида по уровню здания. */
export function citadelStage(level: number): number {
  return Math.min(CITADEL_TIERS, Math.max(1, Math.ceil((Number.isFinite(level) ? level : 1) / 5)));
}

/** Цитадель: центр двора, пятно 3×3 клетки, вход на +x. Растёт материалом и высотой, а не площадью. */
export function Citadel({ level, banner }: CitadelProps) {
  const Stage = STAGES[citadelStage(level) - 1]!;
  return <Stage banner={banner} />;
}
