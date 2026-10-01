import { useEffect, useRef, useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { formatCompactResourceParts, formatExactResource } from "./resourceFormat.js";

const RESOURCES = [
  { id: "meat", icon: "meat", label: "shell.hud.meat" },
  { id: "wood", icon: "wood", label: "shell.hud.wood" },
  { id: "stone", icon: "stone", label: "shell.hud.stone" },
  { id: "metal", icon: "metal", label: "shell.hud.metal" },
  { id: "mushrooms", icon: "mushroom", label: "shell.hud.mushrooms" },
  { id: "gold", icon: "gold", label: "shell.hud.gold" },
] as const;

/** The six-resource strip is shared by the court HUD and the other game screens. */
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
  const root = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <div
      ref={root}
      className={`hud-res ${className}`.trim()}
      role="group"
      aria-label={t("shell.hud.resources")}
    >
      {RESOURCES.map(({ id, icon, label }) => {
        const amount = Number(stock[id] ?? 0);
        const name = t(label);
        const exact = formatExactResource(amount, lang);
        const compact = formatCompactResourceParts(amount, lang);
        const exactLabel = `${name}: ${exact}`;
        const isExpanded = expanded === id;
        return (
          <button
            key={id}
            type="button"
            data-resource={id}
            className={`chip${id === "gold" ? " chip-gold" : ""}${isExpanded ? " is-open" : ""}`}
            aria-label={exactLabel}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? `resource-exact-${id}` : undefined}
            title={exactLabel}
            onClick={() => setExpanded((current) => (current === id ? null : id))}
          >
            <span className="ic-frame">
              <img className="hud-ic" src={`icons/${icon}.png`} alt="" />
            </span>
            <b>
              <span>{compact.value}</span>
              {compact.suffix ? <small>{compact.suffix}</small> : null}
            </b>
            {isExpanded ? (
              <span id={`resource-exact-${id}`} className="exact-value" role="status" aria-live="polite">
                {exactLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
