import styles from "./TopBar.module.css";
import type { HudLord } from "../types.js";

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)}B` :
  n >= 1_000_000     ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` :
  n >= 1_000         ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` :
  String(n);

/**
 * Top-left player profile: 48px avatar, overlaid 16px level badge, power
 * and an optional VIP badge. No XP strip or fabricated VIP value on the HUD.
 */
export function LordCard({ lord }: { lord: HudLord }) {
  return (
    <div className={styles.lord}>
      <span className={styles.avatar} style={lord.bannerColor ? { background: lord.bannerColor } : undefined}>
        {lord.avatarNode ?? lord.name.charAt(0)}
        <span className={styles.lordBadges}>
          <span className={styles.buff}>{lord.level}</span>
        </span>
      </span>
      <span className={styles.lordInfo}>
        <span className={styles.lordName}><b>{lord.name}</b></span>
        <span className={styles.lordPower}>
          <span className={styles.icPower} aria-hidden="true">⚔</span>
          <b>{fmt(lord.power)}</b>
          {typeof lord.vipLevel === "number" && lord.vipLevel > 0 ? (
            <span className={styles.lordVip} aria-label={`VIP ${lord.vipLevel}`} title={`VIP ${lord.vipLevel}`}>
              <span className={styles.lordVipIcon} aria-hidden="true">♛</span>
              <span className={styles.lordVipValue}>{lord.vipLevel}</span>
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}
