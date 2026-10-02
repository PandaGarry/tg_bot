/**
 * Вибро-отклик: Telegram Mini App (`HapticFeedback`), иначе `navigator.vibrate` (Android).
 * Отключается ключом `tdl.haptics = "off"` в localStorage (позже — в настройках).
 */

/**
 * Подключает Telegram Web App API, **только внутри Telegram** и **не блокируя загрузку**: скрипт добавляется
 * динамически с `async`. Вне Telegram (браузер, тесты) ничего не грузится.
 */
export function initTelegram(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const w = window as unknown as { Telegram?: unknown; TelegramWebviewProxy?: unknown };
  const inTelegram = Boolean(w.TelegramWebviewProxy) || /tgWebApp/i.test(location.hash) || /tgWebApp/i.test(location.search);
  if (!inTelegram || w.Telegram || document.querySelector("script[data-tg-api]")) return;
  const s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.async = true;
  s.dataset.tgApi = "1";
  s.onerror = () => s.remove(); // нет сети до telegram.org — вибро просто не будет, игра работает
  document.head.appendChild(s);
}

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
