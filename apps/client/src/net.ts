/**
 * Связь с миром: один сокет. Старый клиент команды не шлёт, пока не обновится:
 * версия протокола проверяется на входе.
 */

import {
  PROTOCOL_VERSION,
  zServerMessage,
  type ClientMessage,
  type JsonValue,
} from "@tdl/protocol";
import { store } from "./store.js";

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;
let counter = 0;

function url(): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}/socket`;
}

function send(message: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function requestId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function idempotencyKey(commandId: string): string {
  return `${commandId}:${requestId()}`;
}

export function sendCommand(commandId: string, payload: JsonValue = {}): void {
  const state = store.get();
  send({
    t: "command",
    protocolVersion: PROTOCOL_VERSION,
    requestId: requestId(),
    idempotencyKey: idempotencyKey(commandId),
    command: { id: commandId, payload },
  });
  void state;
}

export function sendViewport(x: number, y: number, w: number, h: number): void {
  send({ t: "viewport", protocolVersion: PROTOCOL_VERSION, x, y, w, h });
}

export function connect(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  store.setStatus("connecting");
  const next = new WebSocket(url());
  socket = next;

  next.addEventListener("open", () => {
    store.setStatus("online");
    const token = store.get().auth?.token;
    if (token) {
      send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: store.get().lang });
    }
    if (pingTimer) window.clearInterval(pingTimer);
    pingTimer = window.setInterval(() => send({ t: "ping", protocolVersion: PROTOCOL_VERSION }), 20_000);
  });

  next.addEventListener("message", (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(event.data));
    } catch {
      return;
    }
    const message = zServerMessage.safeParse(parsed);
    if (!message.success) return;
    const data = message.data;
    switch (data.t) {
      case "auth":
        store.setAuth(
          { needsLord: data.needsLord, token: data.token, accountId: data.accountId },
          data.token,
        );
        break;
      case "state":
        store.applyState(data.view, data.serverNow);
        break;
      case "patch":
        store.applyPatch(data.ops, data.serverNow);
        break;
      case "report":
        store.addReport((data.report as { rows?: never[] }).rows ?? [], data.serverNow);
        break;
      case "error":
        store.addError(data.key, data.params);
        break;
      case "ready":
        // Способности мира: клиент показывает только открытые узлы.
        store.setReady({ modules: data.modules, resources: data.resources });
        break;
      case "pong":
        break;
    }
  });

  next.addEventListener("close", () => {
    store.setStatus("offline");
    if (pingTimer) window.clearInterval(pingTimer);
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => connect(), 2_000);
  });

  next.addEventListener("error", () => {
    next.close();
  });
}

export function register(login: string, password: string): void {
  send({ t: "auth.register", protocolVersion: PROTOCOL_VERSION, login, password, lang: store.get().lang });
}

export function login(login: string, password: string): void {
  send({ t: "auth.login", protocolVersion: PROTOCOL_VERSION, login, password, lang: store.get().lang });
}

export function createLord(input: {
  name: string;
  portrait: string;
  bannerSign: string;
  bannerColor: string;
  type: "flesh" | "bone" | "spore";
}): void {
  const token = store.get().auth?.token;
  if (!token) return;
  send({ t: "lord.create", protocolVersion: PROTOCOL_VERSION, token, ...input });
}
