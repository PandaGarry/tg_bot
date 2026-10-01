import type { Locale } from "@tdl/protocol";

const UNITS = [
  { threshold: 1_000_000_000, suffix: "B" },
  { threshold: 1_000_000, suffix: "M" },
  { threshold: 1_000, suffix: "K" },
] as const;

/** Compact resource amounts for the always-visible six-icon HUD row. */
export function formatCompactResource(value: number): string {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  const sign = amount < 0 ? "−" : "";
  const absolute = Math.abs(amount);
  if (absolute < 1_000) return `${sign}${absolute}`;

  let unitIndex = UNITS.findIndex(({ threshold }) => absolute >= threshold);
  if (unitIndex < 0) return `${sign}${absolute}`;

  let scaled = absolute / UNITS[unitIndex]!.threshold;
  let decimals = scaled < 100 ? 1 : 0;
  let rounded = Number(scaled.toFixed(decimals));

  // Avoid awkward results such as 1000K: promote to the next unit after rounding.
  if (rounded >= 1_000 && unitIndex > 0) {
    unitIndex -= 1;
    scaled = absolute / UNITS[unitIndex]!.threshold;
    decimals = scaled < 100 ? 1 : 0;
    rounded = Number(scaled.toFixed(decimals));
  }

  const shortValue = decimals === 1 ? rounded.toFixed(1).replace(/\.0$/, "") : String(rounded);
  return `${sign}${shortValue}${UNITS[unitIndex]!.suffix}`;
}

/** Full, localized integer shown on tap and exposed to assistive technology. */
export function formatExactResource(value: number, locale: Locale): string {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}
