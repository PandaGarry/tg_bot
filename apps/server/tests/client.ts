/**
 * Клиент сокета для тестов: то же, что браузер, — вход, лорд, команды, патчи.
 * Общий файл: тесты сокета, напора и живучести говорят одним клиентом.
 */

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { PROTOCOL_VERSION, type ServerMessage } from "@tdl/protocol";
import type { BootedServer } from "../src/boot.js";

/** Клиент сокета: копит сообщения и ждёт нужное. */
export class Client {
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: { match: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void }[] = [];
  /** Последний снимок вида: он же уходит клиенту при входе. */
  lastView: Record<string, unknown> | null = null;
  /** Обещание кода закрытия: тесты ждут отключения медленного клиента. */
  readonly closed: Promise<number>;

  constructor(private readonly socket: WebSocket) {
    this.closed = new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      if (message.t === "state") this.lastView = message.view as Record<string, unknown>;
      const index = this.waiters.findIndex((waiter) => waiter.match(message));
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        waiter?.resolve(message);
        return;
      }
      this.queue.push(message);
    });
  }

  static async open(url: string): Promise<Client> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    return new Client(socket);
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  /** Сырые байты: так проверяется мусор вместо JSON. */
  sendRaw(text: string): void {
    this.socket.send(text);
  }

  /** Код закрытия соединения: null, пока оно живо. */
  closeCode(): number | null {
    return this.socket.readyState === WebSocket.CLOSED ? 1006 : null;
  }

  /** Перестаёт читать: так ведёт себя вкладка, ушедшая в фон. */
  pauseReading(): void {
    this.socket.pause();
  }

  /** Возвращается к чтению: клиент снова принимает патчи. */
  resumeReading(): void {
    this.socket.resume();
  }

  /** Ждёт сообщение по признаку. Тип ответа задаёт вызывающий: поля он знает сам. */
  next<T = ServerMessage>(match: (message: ServerMessage) => boolean, timeoutMs = 15_000): Promise<T> {
    const index = this.queue.findIndex(match);
    if (index >= 0) {
      const [message] = this.queue.splice(index, 1);
      return Promise.resolve(message as T);
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const at = this.waiters.findIndex((waiter) => waiter.resolve === settle);
        if (at >= 0) this.waiters.splice(at, 1);
        reject(new Error(`сообщение не пришло за ${timeoutMs} мс; в очереди: ${JSON.stringify(this.queue)}`));
      }, timeoutMs);
      const settle = (message: ServerMessage): void => {
        clearTimeout(timer);
        resolve(message as T);
      };
      this.waiters.push({ match, resolve: settle });
    });
  }

  close(): void {
    this.socket.close();
  }
}

export async function registerLord(client: Client, name: string): Promise<void> {
  await client.next((message) => message.t === "ready");
  await client.next((message) => message.t === "auth");
  client.send({
    t: "lord.create",
    protocolVersion: PROTOCOL_VERSION,
    token: tokenOf(client),
    name,
    portrait: "portrait-1",
    bannerSign: "skull",
    bannerColor: "bone",
    type: "bone",
  });
}

const tokens = new WeakMap<Client, string>();

export function tokenOf(client: Client): string {
  const token = tokens.get(client);
  if (!token) throw new Error("токен ещё не пришёл");
  return token;
}

/** Регистрация нового лорда: готовый клиент и его снимок вида. */
export async function newLord(booted: BootedServer, login: string, name: string): Promise<Client> {
  const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
  const auth = client.next((message) => message.t === "auth");
  const tokenPromise = auth.then((message) => {
    if (message.t === "auth") tokens.set(client, message.token);
    return message;
  });
  client.send({
    t: "auth.register",
    protocolVersion: PROTOCOL_VERSION,
    login,
    password: "secret-12345",
    email: `${login}@mail.test`,
    acceptRules: true,
    acceptMail: false,
    lang: "ru",
  });
  const first = await tokenPromise;
  if (!(first.t === "auth" && first.needsLord)) throw new Error("ворота не ответили ожиданием лорда");
  const ready = await client.next((message) => message.t === "ready");
  if (!(ready.t === "ready" && ready.modules.includes("_probe"))) throw new Error("сервер не объявил модули в ready");
  client.send({
    t: "lord.create",
    protocolVersion: PROTOCOL_VERSION,
    token: tokenOf(client),
    name,
    portrait: "portrait-1",
    bannerSign: "skull",
    bannerColor: "bone",
    type: "bone",
  });
  const entered = await client.next((message) => message.t === "auth");
  if (!(entered.t === "auth" && !entered.needsLord)) throw new Error("лорд не создан: ворота снова просят лорда");
  await client.next((message) => message.t === "state");
  return client;
}

/** Снимок вида, который клиент уже получил. */
export function viewOf(client: Client): {
  world: { size: number; now: number; downtimeMs: number };
  me: { id: string; name: string; clanId: string | null } | null;
  stock: Record<string, number>;
  modules: Record<string, unknown>;
} {
  if (!client.lastView) throw new Error("снимок вида ещё не пришёл");
  return client.lastView as unknown as {
    world: { size: number; now: number; downtimeMs: number };
    me: { id: string; name: string; clanId: string | null } | null;
    stock: Record<string, number>;
    modules: Record<string, unknown>;
  };
}

/** Вход по готовому токену: то же соединение, что у браузера при возврате. */
export async function openWithToken(booted: BootedServer, token: string): Promise<Client> {
  const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
  client.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: "ru" });
  await client.next((message) => message.t === "auth");
  await client.next((message) => message.t === "state");
  return client;
}

export function commandMessage(commandId: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    t: "command",
    protocolVersion: PROTOCOL_VERSION,
    requestId: `req-${randomUUID().slice(0, 8)}`,
    idempotencyKey: `key-${randomUUID()}`,
    command: { id: commandId, payload },
  };
}
