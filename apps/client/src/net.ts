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

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
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
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
