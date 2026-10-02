/**
 * Вибро-отклик через `navigator.vibrate` (там, где браузер его умеет).
 * Отключается ключом `tdl.haptics = "off"` в localStorage (позже — в настройках).
 */

export type HapticKind = "select" | "pickup" | "drop" | "rotate" | "error";

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
  if (typeof navigator === "undefined" || !enabled()) return;
  const ms = kind === "pickup" ? 18 : kind === "error" ? 40 : 8;
  navigator.vibrate?.(ms);
}
