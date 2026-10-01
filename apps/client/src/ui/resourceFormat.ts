import type { Locale } from "@tdl/protocol";

const UNITS: Record<Locale, readonly { threshold: number; suffix: string }[]> = {
  ru: [
    { threshold: 1_000_000_000, suffix: "млрд" },
    { threshold: 1_000_000, suffix: "млн" },
    { threshold: 1_000, suffix: "к" },
  ],
  en: [
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" },
  ],
};

export type CompactResourceParts = { value: string; suffix: string };

/** Число и единица отдельно: короткий суффикс можно набрать мельче на узком экране. */
export function formatCompactResourceParts(value: number, locale: Locale): CompactResourceParts {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  const sign = amount < 0 ? "−" : "";
  const absolute = Math.abs(amount);
  const units = UNITS[locale];
  if (absolute < 1_000) return { value: `${sign}${absolute}`, suffix: "" };

  let unitIndex = units.findIndex(({ threshold }) => absolute >= threshold);
  if (unitIndex < 0) return { value: `${sign}${absolute}`, suffix: "" };

  let scaled = absolute / units[unitIndex]!.threshold;
  let decimals = scaled < 100 ? 1 : 0;
  let rounded = Number(scaled.toFixed(decimals));

  // Не показываем «1000к»: повышаем разряд после округления.
  if (rounded >= 1_000 && unitIndex > 0) {
    unitIndex -= 1;
    scaled = absolute / units[unitIndex]!.threshold;
    decimals = scaled < 100 ? 1 : 0;
    rounded = Number(scaled.toFixed(decimals));
  }

  const formatted = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(rounded);
  return { value: `${sign}${formatted}`, suffix: units[unitIndex]!.suffix };
}

/** Короткая запись целиком — для логики, тестов и подписей. */
export function formatCompactResource(value: number, locale: Locale): string {
  const { value: compact, suffix } = formatCompactResourceParts(value, locale);
  return `${compact}${suffix}`;
}

/** Точное локализованное целое — по нажатию и для программ чтения с экрана. */
export function formatExactResource(value: number, locale: Locale): string {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}
