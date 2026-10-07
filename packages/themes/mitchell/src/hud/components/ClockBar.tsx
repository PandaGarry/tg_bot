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
        <button
          type="button"
          className={styles.iconBtn}
          title={soundOn ? "Звук вкл." : "Звук выкл."}
          aria-label={soundOn ? "Звук включён" : "Звук выключен"}
          onClick={onSoundToggle}
        >
          <span className={styles.controlIcon} aria-hidden="true">{soundOn ? "🔊" : "🔇"}</span>
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title="Меню и настройки"
          aria-label="Меню и настройки"
          aria-haspopup="menu"
          aria-controls="court-navigation-menu"
          onClick={onSettings}
        >
          <span className={styles.controlIcon} aria-hidden="true">⚙</span>
        </button>
      </div>
    </div>
  );
}
