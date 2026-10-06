import styles from "./QuestPanel.module.css";
import type { HudQuestChapter } from "../types.js";

/**
 * Панель текущей главы/квестов (категория А — постоянная плашка в левой верхней части).
 */
export function QuestPanel({
  quest,
  onPrev,
  onNext,
}: {
  quest?: HudQuestChapter;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  if (!quest) return null;
  return (
    <aside className={styles.panel}>
      <span className={styles.scroll} aria-hidden>📜</span>
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
  );
}
