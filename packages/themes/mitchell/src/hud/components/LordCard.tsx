import styles from "./TopBar.module.css";
import type { HudLord } from "../types.js";

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)}B` :
  n >= 1_000_000     ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` :
  n >= 1_000         ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` :
  String(n);

/**
 * Лорд в левом верхнем углу: большой золотой круглый портрет,
 * рядом БЕЛЫМ жирным цифра мощи (⚔ 1.1K), под ней тонкая синяя полоса XP.
 * Имя на главном экране НЕ показывается (как в VR). Бейдж уровня
 * наложен на портрет снизу-справа.
 */
export function LordCard({ lord }: { lord: HudLord }) {
  return (
    <div className={styles.lord}>
      <span className={styles.avatar} style={lord.bannerColor ? { background: lord.bannerColor } : undefined}>
        {lord.avatarNode ?? lord.name.charAt(0)}
      </span>
      <span className={styles.lordInfo}>
        {/* Имя скрыто на главном экране — оно только в профиле (VR pattern).
            Оставляем в DOM для accessibility/data, но display:none в CSS. */}
        <span className={styles.lordName}>
          <b>{lord.name}</b>
          {lord.clanTag ? <small className={styles.lordTag}>[{lord.clanTag}]</small> : null}
        </span>
        <span className={styles.lordPower}>
          <span className={styles.icPower}>⚔</span>
          <b>{fmt(lord.power)}</b>
        </span>
        <span className={styles.lordXp}><i style={{ width: "62%" }} /></span>
      </span>
      <span className={styles.lordBadges}>
        <span className={styles.buff} title={`Уровень ${lord.level}`}>{lord.level}</span>
      </span>
    </div>
  );
}
