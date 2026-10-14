/**
 * Варианты создания лорда: портреты, знаки, цвета знамени, типы, границы имени.
 * Значения совпадают с протоколом (createLord); имена ключей — в `i18n/shell.ts`.
 */

export const PORTRAITS = Array.from({ length: 10 }, (_, index) => `portrait-${index + 1}`);
export const SIGNS = ["skull", "bell", "tooth", "hand", "tower", "mushroom"] as const;
export const COLORS = ["bone", "moss", "ash", "blood", "iron", "wheat", "night", "rust"] as const;
export const TYPES = ["flesh", "bone", "spore"] as const;
export type LordType = (typeof TYPES)[number];

export const NAME_MIN = 2;
export const NAME_MAX = 18;

/** Цвет знамени для превью и для игры (HUD). */
export function swatch(name: string): string {
  const table: Record<string, string> = {
    bone: "#d8d2c4",
    moss: "#6b7a4a",
    ash: "#7d7a74",
    blood: "#7a2b28",
    iron: "#4a4f55",
    wheat: "#b08b4f",
    night: "#2b2f3a",
    rust: "#8a4b2a",
  };
  return table[name] ?? "#7d7a74";
}

export function portraitSrc(portrait: string): string {
  return `/portraits/${portrait}.jpg`;
}
