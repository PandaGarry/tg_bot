import styles from "./MarchesPanel.module.css";
import type { HudMarchSlot } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Слоты маршей/разведки справа (категория Г): пустые слоты рисуются серыми и
 * неинтерактивными; активные — яркие, с бейджем/таймером.
 */
export function MarchesPanel({ slots, onSlotClick }: { slots: HudMarchSlot[]; onSlotClick?: (id: string) => void }) {
  if (slots.length === 0) return null;
  return (
    <div className={styles.marches}>
      {slots.map((s) => (
        <button
          type="button"
          key={s.id}
          className={`${styles.slot}${s.active ? "" : ` ${styles.slotEmpty}`}`}
          onClick={s.active ? () => onSlotClick?.(s.id) : undefined}
          disabled={!s.active}
          title={s.active ? "Активный марш" : "Свободный слот"}
        >
          <span className={styles.ph}>{s.icon}</span>
          {s.active && s.timeLeft ? <span className={styles.time}>{s.timeLeft}</span> : null}
          <Badge badge={s.badge} />
        </button>
      ))}
    </div>
  );
}
