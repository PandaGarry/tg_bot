import styles from "./TopBar.module.css";
import type { HudResource } from "../types.js";

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)}B` :
  n >= 1_000_000     ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` :
  n >= 1_000         ? `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K` :
  String(n);

/**
 * Панель ресурсов в центре топбара.
 * Кнопка "+" отображается только если хотя бы у одного ресурса canRecharge=true
 * (ставится на первую такую запись, по дизайну — у золота/гемов).
 */
export function ResourceBar({
  resources,
  idleWorkers,
  onRecharge,
}: {
  resources: HudResource[];
  idleWorkers?: { free: number; total: number };
  onRecharge?: () => void;
}) {
  return (
    <div className={styles.resources}>
      {idleWorkers ? (
        <span className={styles.res} title="Свободные работники/армия">
          <span className={styles.resIc}>👷</span>
          <b>{idleWorkers.free}/{idleWorkers.total}</b>
        </span>
      ) : null}
      {resources.map((r) => (
        <span
          key={r.id}
          className={`${styles.res}${r.accentColor === "gem" ? ` ${styles.resGem}` : ""}`}
          title={r.label}
        >
          <span className={styles.resIc}>{r.icon}</span>
          <b>{fmt(r.amount)}</b>
        </span>
      ))}
      {onRecharge ? (
        <button type="button" className={styles.resPlus} title="Пополнить" onClick={onRecharge}>+</button>
      ) : null}
    </div>
  );
}
