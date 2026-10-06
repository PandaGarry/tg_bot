import styles from "./TopBar.module.css";
import type { HudLord } from "../types.js";

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)}B` :
  n >= 1_000_000     ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` :
  n >= 1_000         ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` :
  String(n);

/**
 * Компактный профиль в левом верхнем углу: круглый матово-стеклянный
 * аватар с тонкой светлой обводкой, рядом БЕЛЫМ тонким шрифтом мощи,
 * под ними тонкая синяя полоса XP. Бейдж уровня в углу аватара.
 * Flat low-poly — никаких текстур/завитушек.
 */
export function LordCard({ lord }: { lord: HudLord }) {
  return (
    <div className={styles.lord}>
      <span className={styles.avatar} style={lord.bannerColor ? { background: lord.bannerColor } : undefined}>
        {lord.avatarNode ?? lord.name.charAt(0)}
      </span>
      <span className={styles.lordInfo}>
        <span className={styles.lordName}><b>{lord.name}</b></span>
        <span className={styles.lordPower}>
          <span className={styles.icPower}>⚔</span>
          <b>{fmt(lord.power)}</b>
        </span>
        <span className={styles.lordXp}><i style={{ width: "62%" }} /></span>
      </span>
      <span className={styles.lordBadges}>
        <span className={styles.buff}>{lord.level}</span>
      </span>
    </div>
  );
}
