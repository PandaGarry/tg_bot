import styles from "./PlacingHint.module.css";

/**
 * Всплывающая подсказка во время постановки здания на сетку.
 */
export function PlacingHint({
  label,
  onCancel,
}: {
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className={styles.hint} role="status">
      <span>Ставим: {label} · коснитесь сетки</span>
      <button type="button" className={styles.cancel} onClick={onCancel} aria-label="Отменить">✕</button>
    </div>
  );
}
