/**
 * Вибро-отклик: Telegram Mini App (`HapticFeedback`), иначе `navigator.vibrate` (Android).
 * Отключается ключом `tdl.haptics = "off"` в localStorage (позже — в настройках).
 */

export type HapticKind = "select" | "pickup" | "drop" | "rotate" | "error";

interface TgHaptic {
  impactOccurred?: (style: "light" | "medium" | "heavy") => void;
  selectionChanged?: () => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
}

function enabled(): boolean {
  try {
    return localStorage.getItem("tdl.haptics") !== "off";
  } catch {
    return true;
  }
}

export function haptic(kind: HapticKind): void {
  try {
    buzz(kind);
  } catch {
    /* отклик необязателен: сбой не должен ломать жест */
  }
}

function buzz(kind: HapticKind): void {
  if (typeof window === "undefined" || !enabled()) return;
  const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TgHaptic } } }).Telegram?.WebApp
    ?.HapticFeedback;
  if (tg) {
    if (kind === "select" || kind === "rotate") tg.selectionChanged?.();
    else if (kind === "pickup") tg.impactOccurred?.("medium");
    else if (kind === "drop") tg.impactOccurred?.("light");
    else tg.notificationOccurred?.("error");
    return;
  }
  const ms = kind === "pickup" ? 18 : kind === "error" ? 40 : 8;
  navigator.vibrate?.(ms);
}
