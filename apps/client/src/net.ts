import type { ClientMessage, Command, Patch, ServerMessage, Snapshot } from '@ashfall/shared';
import { state } from './store';

type Listeners = {
  snapshot: ((s: Snapshot) => void)[];
  patch: ((p: Patch) => void)[];
  auth: ((ok: boolean, error?: string) => void)[];
  open: (() => void)[];
};

const listeners: Listeners = { snapshot: [], patch: [], auth: [], open: [] };
let ws: WebSocket | null = null;
let cmdId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let reconnectTimer: number | null = null;

export function on<K extends keyof Listeners>(event: K, fn: Listeners[K][number]): void {
  (listeners[event] as unknown[]).push(fn);
}

function emit<K extends keyof Listeners>(event: K, ...args: unknown[]): void {
  for (const fn of listeners[event] as ((...a: unknown[]) => void)[]) fn(...args);
}

/**
 * Базовый адрес сервера. По умолчанию — тот же origin, что и страница,
 * но игру можно открыть и отдельным файлом (из окна предпросмотра, с диска,
 * из нативной обёртки): тогда адрес задают через ?server= или глобальную
 * переменную __ASHFALL_SERVER__.
 */
function serverBase(): string {
  const search = new URLSearchParams(location.search).get('server');
  const stored = (() => {
    try {
      return localStorage.getItem('ashfall.server');
    } catch {
      return null;
    }
  })();
  const override =
    search ??
    stored ??
    ((globalThis as Record<string, unknown>).__ASHFALL_SERVER__ as string | undefined);
  const base = override ?? location.origin;
  if (!/^https?:\/\//i.test(base)) throw new Error('Задай адрес сервера: ?server=https://…');
  return base.replace(/\/$/, '');
}

function wsUrl(): string {
  const url = new URL(serverBase());
  return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}/ws`;
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    state.connecting = false;
    send({ t: 'auth', token: state.token });
    emit('open');
  };
  ws.onclose = () => {
    state.connecting = true;
    scheduleReconnect();
  };
  ws.onerror = () => {
    state.connecting = true;
  };
  ws.onmessage = (ev) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(ev.data as string) as ServerMessage;
    } catch {
      return;
    }
    if (msg.t === 'snapshot') emit('snapshot', msg.snapshot);
    else if (msg.t === 'patch') emit('patch', msg.patch);
    else if (msg.t === 'auth') {
      if (msg.ok && msg.token) {
        state.token = msg.token;
        localStorage.setItem('ashfall.token', msg.token);
      }
      emit('auth', msg.ok, msg.error);
    } else if (msg.t === 'res') {
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        msg.ok ? waiter.resolve(msg) : waiter.reject(new Error(msg.error ?? 'отклонено'));
      }
    }
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
}

/** Позволяет UI сменить адрес сервера на ходу (например, из окна предпросмотра). */
export function setServerBase(url: string): void {
  try {
    localStorage.setItem('ashfall.server', url.replace(/\/$/, ''));
  } catch {
    /* приватный режим — просто перезагружаем с параметром */
  }
  const next = new URL(location.href);
  next.searchParams.set('server', url.replace(/\/$/, ''));
  location.href = next.toString();
}

export function send(msg: ClientMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

export function cmd(command: Command): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = cmdId++;
    pending.set(id, { resolve: () => resolve(), reject });
    send({ t: 'cmd', id, cmd: command });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('сервер не ответил'));
      }
    }, 15_000);
  });
}

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, `${serverBase()}/`).toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
