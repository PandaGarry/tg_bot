import styles from "./TopBar.module.css";
import type { HudLord } from "../types.js";

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)}B` :
  n >= 1_000_000     ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` :
  n >= 1_000         ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` :
  String(n);

/**
 * Карточка лорда в левом углу топбара (аватар, имя, клан-тег, мощь, уровень, бафф).
 */
export function LordCard({ lord }: { lord: HudLord }) {
  return (
    <div className={styles.lord}>
      <span className={styles.avatar} style={lord.bannerColor ? { background: lord.bannerColor } : undefined}>
        {lord.avatarNode ?? lord.name.charAt(0)}
      </span>
      <span className={styles.lordInfo}>
        <span className={styles.lordName}>
          <b>{lord.name}</b>
          {lord.clanTag ? <small className={styles.lordTag}>[{lord.clanTag}]</small> : null}
        </span>
        <span className={styles.lordPower}>
          <span className={styles.icPower}>⚔</span>
          <b>{fmt(lord.power)}</b>
        </span>
      </span>
      <span className={styles.lordBadges}>
        <span className={styles.buff} title={`Уровень ${lord.level}`}>{lord.level}</span>
        {lord.buffActive ? <span className={styles.buff} title="Активный бафф">↑</span> : null}
      </span>
    </div>
  );
}
