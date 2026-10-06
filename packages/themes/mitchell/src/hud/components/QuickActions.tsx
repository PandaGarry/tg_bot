import styles from "./QuickActions.module.css";
import type { HudActionButton } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Столбец круглых быстрых кнопок справа (собрать, помощь, события, почта) — А/Б.
 */
export function QuickActions({ actions }: { actions: HudActionButton[] }) {
  if (actions.length === 0) return null;
  return (
    <div className={styles.quick}>
      {actions.map((a) => {
        const tone = a.tone ?? "dark";
        const cls =
          tone === "green" ? styles.green :
          tone === "blue" ? styles.blue :
          tone === "red" ? styles.red :
          styles.dark;
        return (
          <button
            type="button"
            key={a.id}
            className={`${styles.btn} ${cls}`}
            title={a.label}
            onClick={a.onClick}
            disabled={!a.onClick}
          >
            <span>{a.icon}</span>
            <Badge badge={a.badge} />
          </button>
        );
      })}
    </div>
  );
}
