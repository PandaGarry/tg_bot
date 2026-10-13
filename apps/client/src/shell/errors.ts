/**
 * Ошибки для окон входа, регистрации и создания лорда.
 * Ядро отдаёт ключи `kernel.*` с игровым тоном («Не пустили»), на экран игрока они не выходят:
 * здесь каждый ключ переводится в спокойную фразу из словаря оболочки `shell.err.*`.
 * Протокол и ядро не меняются.
 */

import { useState } from "react";
import type { Locale } from "@tdl/protocol";
import { translator } from "../i18n/index.js";
import { useStore } from "../useStore.js";

const MAP: Record<string, string> = {
  "kernel.login.failed": "shell.err.login-failed",
  "kernel.registration.closed": "shell.err.registration-closed",
  "kernel.lord.name-taken": "shell.err.name-taken",
  "kernel.lord.name-bad": "shell.err.name-bad",
  "kernel.account.email-bad": "shell.err.email-bad",
  "kernel.account.rules": "shell.err.rules",
  "kernel.connection.lost": "shell.err.connection-lost",
  "kernel.session.expired": "shell.err.session-expired",
  "kernel.session.rate": "shell.err.rate",
  "kernel.busy": "shell.err.busy",
  "kernel.protocol.outdated": "shell.err.outdated",
  "kernel.world.private": "shell.err.closed",
};

/** Ключ отказа ядра → текст для игрока на текущем языке. Неизвестный ключ — общая фраза, а не сырой текст. */
export function friendlyError(lang: Locale, key: string | undefined): string {
  const t = translator(lang);
  if (!key) return t("shell.err.generic");
  const mapped = MAP[key];
  return mapped ? t(mapped) : t("shell.err.generic");
}

/**
 * Последний отказ ядра, появившийся уже после открытия экрана.
 * Старые ошибки из прошлых попыток не показываются при входе на экран.
 */
export function useFreshError(): { key: string; at: number } | null {
  const state = useStore();
  const [since] = useState(() => Date.now());
  const last = state.errors[0];
  return last && last.at >= since ? { key: last.key, at: last.at } : null;
}
