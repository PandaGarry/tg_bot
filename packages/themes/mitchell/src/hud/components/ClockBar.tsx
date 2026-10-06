import styles from "./TopBar.module.css";

/**
 * Правая часть топбара: UTC-часы и иконки настроек/звука.
 * Иконки — постоянный хром (категория А), но имеют состояние on/off.
 */
export function ClockBar({
  utcClock,
  soundOn = true,
  onSoundToggle,
  onSettings,
}: {
  utcClock: string;
  soundOn?: boolean;
  onSoundToggle?: () => void;
  onSettings?: () => void;
}) {
  return (
    <div className={styles.topRight}>
      <span className={styles.clock}>{utcClock}</span>
      <div className={styles.settings}>
        <button type="button" className={styles.iconBtn} title={soundOn ? "Звук вкл." : "Звук выкл."} onClick={onSoundToggle}>
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button type="button" className={styles.iconBtn} title="Настройки" onClick={onSettings}>⚙</button>
      </div>
    </div>
  );
}
