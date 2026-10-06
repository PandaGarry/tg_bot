import styles from "./ChatPanel.module.css";
import type { HudChatLine } from "../types.js";

/**
 * Мини-чат (3 строки) над компасом — категория А, но при отсутствии сообщений
 * может быть скрыт передачей пустого массива.
 */
export function ChatPanel({ lines }: { lines: HudChatLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className={styles.chat} aria-live="polite">
      {lines.slice(-3).map((l, i) => (
        <div className={styles.line} key={i}>
          <span className={styles.name} style={l.authorColor ? { color: l.authorColor } : undefined}>
            {l.author}:
          </span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}
