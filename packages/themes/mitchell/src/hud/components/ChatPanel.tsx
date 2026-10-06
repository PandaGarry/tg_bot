import { useState } from "react";
import styles from "./ChatPanel.module.css";
import type { HudChatLine } from "../types.js";

/**
 * Мини-чат. По брифу VR-промта: убираем большое окно слева внизу,
 * оставляем ОДНУ маленькую иконку (облачко/свиток), которая открывает
 * список сообщений только при нажатии. Без постоянного оверлея на сцене.
 */
export function ChatPanel({ lines }: { lines: HudChatLine[] }) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <>
      <button
        type="button"
        className={styles.icon}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Свернуть чат" : "Открыть чат"}
        aria-expanded={open}
        title="Чат"
      >
        💬
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Чат">
          {lines.slice(-5).map((l, i) => (
            <div className={styles.line} key={i}>
              <span className={styles.name} style={l.authorColor ? { color: l.authorColor } : undefined}>
                {l.author}:
              </span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
