/**
 * Хроника: слова хрониста остаются у игрока. Слайды вступления и первые
 * фразы двора не пропадают — их можно перечитать. Хроника живёт на устройстве:
 * сервер о ней не знает, склад и сроки от неё не зависят.
 */

import { useSyncExternalStore } from "react";

export interface ChronicleEntry {
  /** Ключ словаря: текст переводится на текущий язык, а не хранится строкой. */
  key: string;
  /** Раздел: вступление или слова хрониста во дворе. */
  kind: "intro" | "narrator";
  /** Когда запись появилась: мировые часы или часы устройства. */
  at: number;
}

const KEY = "tdl.chronicle";
const listeners = new Set<() => void>();
let entries: ChronicleEntry[] | null = null;

function load(): ChronicleEntry[] {
  if (entries) return entries;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ChronicleEntry[]) : [];
    entries = Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.key === "string") : [];
  } catch {
    entries = [];
  }
  return entries;
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    // Приватный режим: хроника живёт до обновления страницы.
  }
}

export function chronicleEntries(): ChronicleEntry[] {
  return load();
}

/** Запись добавляется один раз: повторный вход не повторяет слова хрониста. */
export function addChronicle(key: string, kind: ChronicleEntry["kind"], at = Date.now()): boolean {
  const list = load();
  if (list.some((entry) => entry.key === key)) return false;
  list.push({ key, kind, at });
  save();
  for (const listener of listeners) listener();
  return true;
}

export function hasChronicle(key: string): boolean {
  return load().some((entry) => entry.key === key);
}

export function clearChronicle(): void {
  entries = [];
  save();
  for (const listener of listeners) listener();
}

export function subscribeChronicle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChronicle(): ChronicleEntry[] {
  return useSyncExternalStore(subscribeChronicle, chronicleEntries, chronicleEntries);
}

/** Тексты вступления: порядок задан 03-first-session.md. */
export const INTRO_KEYS = [
  "shell.slide.1",
  "shell.slide.2",
  "shell.slide.3",
  "shell.slide.4",
  "shell.slide.5",
  "shell.slide.6",
  "shell.slide.7",
  "shell.slide.8",
] as const;

/** Хроника вступления: пишется один раз, когда слайды отпускают игрока. */
export function writeIntro(at = Date.now()): void {
  let added = false;
  for (const key of INTRO_KEYS) added = addChronicle(key, "intro", at) || added;
  if (added) for (const listener of listeners) listener();
}
