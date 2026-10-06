import styles from "./SceneBubbles.module.css";
import type { HudSceneBubble } from "../types.js";

/**
 * Слой пузырей-событий поверх 3D-сцены — категория В.
 * Рендерится ТОЛЬКО если есть элементы в массиве bubbles.
 * По умолчанию pointer-events отключен, но интерактивные пузыри
 * (collect, upgrade, attack) можно кликать — они вызывают bubble.onClick.
 */
export function SceneBubbles({ bubbles }: { bubbles: HudSceneBubble[] }) {
  if (bubbles.length === 0) return null;
  return (
    <div className={styles.layer} aria-hidden={false}>
      {bubbles.map((b) => {
        const cls =
          b.kind === "build" ? styles.build :
          b.kind === "upgrade" ? styles.upgrade :
          b.kind === "idle" ? styles.idle :
          b.kind === "help" ? styles.help :
          b.kind === "attack" ? styles.attack :
          styles.collect;
        const isClickable = Boolean(b.onClick);
        return (
          <button
            type="button"
            key={b.id}
            className={`${styles.bubble} ${cls}`}
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={isClickable ? b.onClick : undefined}
            disabled={!isClickable}
            title={b.label}
            aria-label={b.label ?? b.kind}
          >
            <span>{b.icon ?? defaultIcon(b.kind)}</span>
            {b.kind === "build" ? <span className={styles.ring} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

function defaultIcon(kind: HudSceneBubble["kind"]) {
  switch (kind) {
    case "build":   return "🔨";
    case "upgrade": return "↑";
    case "idle":    return "z";
    case "collect": return "✊";
    case "help":    return "🤝";
    case "attack":  return "⚔";
  }
}
