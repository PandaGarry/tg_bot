import styles from "./EventBanner.module.css";
import type { HudEventBanner as HudEventBannerData } from "../types.js";

/**
 * Ивентовый баннер справа под топбаром (категория Г — условный).
 * Если eventBanner не передан — ничего не рендерит.
 */
export function EventBanner({ banner, onClick }: { banner?: HudEventBannerData; onClick?: () => void }) {
  if (!banner) return null;
  return (
    <button type="button" className={styles.banner} onClick={onClick} title={banner.title}>
      <span className={styles.icon}>{banner.icon}</span>
      {banner.isNew ? <span className={styles.new}>New</span> : null}
      <div className={styles.title}>{banner.title}</div>
      <div className={styles.timer}>{banner.timer}</div>
    </button>
  );
}
