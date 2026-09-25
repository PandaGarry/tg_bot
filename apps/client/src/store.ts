/**
 * Состояние клиента. Клиент не прибавляет ресурсы сам: склад приходит
 * патчем от ядра, а отчёт — строкой отчёта.
 */

import { applyOps, type JsonValue, type Locale, type PatchOp, type ReportRow, type WorldViewBase } from "@tdl/protocol";

export interface ClientState {
  status: "offline" | "connecting" | "online";
  view: WorldViewBase | null;
  lang: Locale;
  auth: { needsLord: boolean; token: string | null; accountId: string | null } | null;
  ready: { modules: string[]; resources: string[] } | null;
  reports: { rows: ReportRow[]; at: number }[];
  errors: { key: string; params?: Record<string, string | number>; at: number }[];
  patches: number;
  /** serverNow − Date.now(): срок на клиенте и сервере один. */
  clockOffset: number;
}

const STORAGE_KEY = "tdl.token";
const LANG_KEY = "tdl.lang";

export function storedToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Приватный режим браузера: токен живёт до обновления.
  }
}

export function storedLang(): Locale {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return value === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}

export function storeLang(lang: Locale): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // не критично
  }
}

export class Store {
  private state: ClientState = {
    status: "offline",
    view: null,
    lang: storedLang(),
    auth: null,
    ready: null,
    reports: [],
    errors: [],
    patches: 0,
    clockOffset: 0,
  };

  private listeners = new Set<() => void>();

  get(): ClientState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  setStatus(status: ClientState["status"]): void {
    this.set({ status });
  }

  setLang(lang: Locale): void {
    storeLang(lang);
    this.set({ lang });
  }

  setReady(ready: { modules: string[]; resources: string[] }): void {
    this.set({ ready });
  }

  setAuth(auth: ClientState["auth"], token?: string | null): void {
    if (token !== undefined) storeToken(token);
    this.set({ auth, ...(token !== undefined ? { auth: auth ? { ...auth, token } : null } : {}) });
  }

  applyState(view: JsonValue, serverNow: number): void {
    this.set({ view: view as unknown as WorldViewBase, clockOffset: serverNow - Date.now() });
  }

  applyPatch(ops: PatchOp[], serverNow: number): void {
    if (!this.state.view) return;
    const next = applyOps(this.state.view as unknown as Record<string, JsonValue>, ops);
    this.set({
      view: next as unknown as WorldViewBase,
      patches: this.state.patches + 1,
      clockOffset: serverNow - Date.now(),
    });
  }

  addReport(rows: ReportRow[], serverNow: number): void {
    const reports = [{ rows, at: serverNow }, ...this.state.reports].slice(0, 50);
    this.set({ reports, clockOffset: serverNow - Date.now() });
  }

  addError(key: string, params?: Record<string, string | number>): void {
    const errors = [{ key, params, at: Date.now() }, ...this.state.errors].slice(0, 20);
    this.set({ errors });
  }

  /** Мировое время на клиенте: срок считается от часов сервера. */
  worldNow(): number {
    return Date.now() + this.state.clockOffset;
  }
}

export const store = new Store();
