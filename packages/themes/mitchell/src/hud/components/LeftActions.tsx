import styles from "./LeftActions.module.css";
import type { HudActionButton } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Вертикальный столбец квадратных кнопок слева (стройка, задания, рабочие) — категория А/Б.
 * Кнопки всегда видны; бейджи — по данным.
 */
export function LeftActions({ actions }: { actions: HudActionButton[] }) {
  return (
    <nav className={styles.actions} aria-label="Быстрые действия слева">
      {actions.map((a) => (
        <button
          type="button"
          key={a.id}
          className={styles.sq}
          title={a.label}
          onClick={a.onClick}
          disabled={!a.onClick}
        >
          <span className={styles.icon} aria-hidden="true">{a.icon}</span>
          <Badge badge={a.badge} />
        </button>
      ))}
    </nav>
  );
}
