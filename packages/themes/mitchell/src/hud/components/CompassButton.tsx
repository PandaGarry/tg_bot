import styles from "./CompassButton.module.css";

/**
 * Золотой компас-роза в левом нижнем углу — открывает карту мира.
 * Категория А (постоянный).
 */
export function CompassButton({ onClick, label = "Карта мира" }: { onClick?: () => void; label?: string }) {
  return (
    <button type="button" className={styles.btn} title={label} onClick={onClick}>
      <span className={styles.rose} aria-hidden>
        <span className={styles.n}>N</span>
        <span className={styles.s}>S</span>
        <span className={styles.w}>W</span>
        <span className={styles.e}>E</span>
        <span className={styles.cross} />
      </span>
    </button>
  );
}
