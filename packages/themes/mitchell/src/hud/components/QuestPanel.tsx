import { useState } from "react";
import styles from "./QuestPanel.module.css";
import type { HudQuestChapter, HudEventBadge } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Квестовая панель: в свёрнутом виде — золотая иконка свитка у левого края
 * с бейджем непрочитанных/активных заданий. По клику разворачивается панель
 * с главой и списком задач. Повторный клик (или клик по крестику/стрелке) сворачивает.
 *
 * Если quest не передан — вообще ничего не рендерим.
 */
export function QuestPanel({
  quest,
  badge,
  onPrev,
  onNext,
  defaultOpen = false,
}: {
  quest?: HudQuestChapter;
  /** Бейдж на иконке свитка (кол-во незавершённых заданий / алерт). */
  badge?: HudEventBadge;
  onPrev?: () => void;
  onNext?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  if (!quest) return null;

  if (!open) {
    return (
      <button
        type="button"
        className={styles.icon}
        onClick={() => setOpen(true)}
        title="Задания главы"
        aria-label="Открыть задания главы"
      >
        📜
        {quest.canNext ? <span className={styles.arrow} aria-hidden>›</span> : null}
        <Badge badge={badge} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.icon}
        onClick={() => setOpen(false)}
        title="Свернуть задания"
        aria-label="Свернуть задания главы"
        aria-expanded={true}
      >
        📜
      </button>
      <aside className={styles.panel} role="dialog" aria-label="Задания главы">
        <div className={styles.head}>
          <span>{quest.title}</span>
          <span>
            <button type="button" className={styles.nav} disabled={!quest.canPrev} onClick={onPrev} aria-label="Предыдущая">‹</button>
            <button type="button" className={styles.nav} disabled={!quest.canNext} onClick={onNext} aria-label="Следующая">›</button>
          </span>
        </div>
        <ul className={styles.list}>
          {quest.items.map((it, idx) => (
            <li key={idx}>
              {it.done ? (
                <>
                  <span className={styles.done}>✓ {it.progress ?? ""}</span>
                  <span className={styles.doneText}>{it.text}</span>
                </>
              ) : (
                <>
                  {it.progress ? <span className={styles.prog}>({it.progress})</span> : null}
                  <span className={styles.todo}>{it.text}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
