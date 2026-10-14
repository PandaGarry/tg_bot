/** Один уровень здания из лестницы docs/balance/ladders.md. */
export interface BuildingLevel {
  level: number;
  /** Стоимость уровня: дерево, камень, металл (без золота, §0.1). */
  wood: number;
  stone: number;
  metal: number;
  /** Время постройки уровня, секунды. Уровень 1 — «старт» = 0. */
  seconds: number;
  /** Сила уровня (стоимость уровня / 35 в рамках доли здания, §11). */
  power: number;
  /** Эффект уровня — текст из лестницы, как в документе. */
  effect: string;
}

/** Здание каталога: из buildings.md (роль, старт, предел, сила) и ladders.md (уровни). */
export interface BuildingDef {
  id: string;
  ru: string;
  /** Размер в клетках сетки двора (buildings.md, решено 14.10): ширина × глубина. */
  footprint: { w: number; h: number };
  maxLevel: number;
  /** Уровень Цитадели, с которого здание открывается. */
  startCitadel: number;
  /** Сумма силы по всем уровням; null — не назначено (Таверна). */
  powerTotal: number | null;
  /** Доля силы в общей силе построек (§11), строкой как в документе. */
  powerShare: string | null;
  /** true — стоимость и эффект ещё не назначены (Таверна). */
  costOpen: boolean;
  levels: readonly BuildingLevel[];
}
