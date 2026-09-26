/**
 * Тексты клиента. Ключ ядра и ключ оболочки живут в своих словарях,
 * ключ модуля приходит из словаря модуля. Неизвестный ключ показывается
 * общей фразой, а не сырой строкой.
 */

import { kernelStrings } from "@tdl/protocol";
import type { Locale } from "@tdl/protocol";
import { shellStrings } from "./shell.js";
import { views } from "@tdl/modules/views";

type Dict = Record<string, string>;

const FALLBACK = { ru: "Действие не выполнено", en: "The action was not done" } as const;

function format(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

export function translator(lang: Locale, moduleId?: string) {
  const moduleDicts: Record<string, Dict> = {};
  for (const view of views) {
    moduleDicts[view.id] = (view.strings?.[lang] ?? {}) as Dict;
  }
  return (key: string, params?: Record<string, string | number>): string => {
    if (moduleId) {
      const own = moduleDicts[moduleId]?.[key];
      if (own) return format(own, params);
    }
    const kernelDict = kernelStrings[lang] as Dict;
    if (kernelDict[key]) return format(kernelDict[key] as string, params);
    const shellDict = shellStrings[lang] as Dict;
    if (shellDict[key]) return format(shellDict[key] as string, params);
    for (const dict of Object.values(moduleDicts)) {
      if (dict[key]) return format(dict[key] as string, params);
    }
    return FALLBACK[lang];
  };
}

export function moduleStrings(moduleId: string, lang: Locale): Dict {
  const view = views.find((candidate) => candidate.id === moduleId);
  return (view?.strings?.[lang] ?? {}) as Dict;
}

/** Состояние связи — ключ словаря, а не собранная строка. */
export function statusKey(status: "offline" | "connecting" | "online"): "shell.status.offline" | "shell.status.online" {
  return status === "online" ? "shell.status.online" : "shell.status.offline";
}
