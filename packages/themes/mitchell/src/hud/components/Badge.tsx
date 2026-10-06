import type { ReactNode } from "react";
import styles from "./Badge.module.css";
import type { HudEventBadge } from "../types.js";

/**
 * Универсальный бейдж (счётчик / восклицательный знак / алерт).
 * Если badge.kind === "none" — ничего не рендерит (элемент скрыт по умолчанию).
 */
export function Badge({ badge }: { badge: HudEventBadge | undefined }) {
  if (!badge || badge.kind === "none") return null;

  const classes = [styles.badge];
  let children: React.ReactNode = null;

  switch (badge.kind) {
    case "count":
      children = badge.value > 99 ? "99+" : badge.value;
      break;
    case "alert":
      classes.push(styles.alert, styles.exclamation);
      break;
    case "exclamation":
      classes.push(styles.exclamation);
      if (badge.color === "purple") classes.push(styles.purple);
      else if (badge.color === "green") classes.push(styles.green);
      else if (badge.color === "red") classes.push(styles.red);
      break;
  }

  return <span className={classes.join(" ")}>{children}</span>;
}
