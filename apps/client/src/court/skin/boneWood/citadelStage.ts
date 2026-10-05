/** Число видов Цитадели: смена каждые 5 уровней (1–5, 6–10, 11–15, 16–20, 21–25). */
export const CITADEL_TIERS = 5;

/** Стадия внешнего вида (1…5) по уровню здания; мусор и выход за границы безопасно ужимаются. */
export function citadelStage(level: number): number {
  const n = Number.isFinite(level) ? level : 1;
  return Math.min(CITADEL_TIERS, Math.max(1, Math.ceil(n / 5)));
}
