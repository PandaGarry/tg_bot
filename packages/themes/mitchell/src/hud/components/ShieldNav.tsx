import styles from "./ShieldNav.module.css";
import type { HudActionButton } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Пятиугольная щитовая навигация в правом нижнем углу (А/Б).
 * Для кнопки «ещё» передавайте иконку в виде 4 точек через icon={<DotsIcon/>}.
 */
export function ShieldNav({ actions }: { actions: HudActionButton[] }) {
  if (actions.length === 0) return null;
  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {actions.map((a) => (
        <button
          type="button"
          key={a.id}
          className={styles.shield}
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

export function MenuDotsIcon() {
  return (
    <span className={styles.dots} aria-hidden>
      <i /><i /><i /><i />
    </span>
  );
}
