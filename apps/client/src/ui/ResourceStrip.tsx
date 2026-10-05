import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";

const RESOURCES = [
  { id: "meat", image: "meat", key: "shell.hud.meat" },
  { id: "wood", image: "wood", key: "shell.hud.wood" },
  { id: "stone", image: "stone", key: "shell.hud.stone" },
  { id: "metal", image: "metal", key: "shell.hud.metal" },
  { id: "mushrooms", image: "mushroom", key: "shell.hud.mushrooms" },
  { id: "gold", image: "gold", key: "shell.hud.gold" },
] as const;

export function formatAmount(value: number, lang: Locale): string {
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  return new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

export function ResourceStrip({
  stock,
  lang,
  className = "",
}: {
  stock: Record<string, number>;
  lang: Locale;
  className?: string;
}) {
  const t = translator(lang);
  return (
    <div className={`hud-res ${className}`.trim()} role="group" aria-label={t("shell.hud.resources")}>
      {RESOURCES.map(({ id, image, key }) => {
        const amount = Number(stock[id] ?? 0);
        const label = t(key);
        return (
          <div
            className={`chip${id === "gold" ? " chip-gold" : ""}`}
            key={id}
            title={`${label}: ${formatAmount(amount, lang)}`}
            aria-label={`${label}: ${formatAmount(amount, lang)}`}
            data-resource={id}
          >
            <span className="ic"><img className="hud-ic" src={`icons/${image}.png`} alt="" /></span>
            <b>{formatAmount(amount, lang)}</b>
          </div>
        );
      })}
    </div>
  );
}
