import styles from "./QueuesList.module.css";
import type { HudQueueItem } from "../types.js";
import { Badge } from "./Badge.js";

/**
 * Список активных очередей (стройка / тренировка / исследование) — категория Г.
 * Если список пуст — не рендерит блок вообще (а не пустую плашку).
 * Индикация готовности: при progress >= 1 превращаем бейдж в «!» и подсвечиваем.
 */
export function QueuesList({ queues, onSpeedUp }: { queues: HudQueueItem[]; onSpeedUp?: (id: string) => void }) {
  if (queues.length === 0) return null;
  return (
    <div className={styles.queues}>
      {queues.map((q) => {
        const icClass =
          q.kind === "build" ? styles.icBuild :
          q.kind === "train" ? styles.icTrain :
          styles.icResearch;
        const fillClass =
          q.kind === "build" ? styles.fillBuild :
          q.kind === "train" ? styles.fillTrain :
          styles.fillResearch;
        const done = q.progress >= 1;
        return (
          <div className={styles.queue} key={q.id}>
            <span className={`${styles.ic} ${icClass}`}>{q.icon}</span>
            <div className={styles.name}>{q.label}</div>
            <div className={styles.bar} aria-label={`Прогресс ${Math.round(q.progress * 100)}%`}>
              <i className={fillClass} style={{ width: `${Math.min(1, Math.max(0, q.progress)) * 100}%` }} />
            </div>
            <div className={styles.time}>{done ? "Готово" : q.timeLeft}</div>
            {q.canSpeedUp && !done ? (
              <button type="button" className={styles.speedUp} title="Ускорить" onClick={() => onSpeedUp?.(q.id)}>⚡</button>
            ) : null}
            {done ? (
              <Badge badge={{ kind: "alert" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
