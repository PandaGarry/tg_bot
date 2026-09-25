/**
 * Сквозная проверка контура: ворота, сокет, команда, патч, отчёт.
 * Мир поднимается как в бою — bootServer на настоящем Postgres и своём порту,
 * клиент говорит по тому же протоколу, что и браузер.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { loadConfig, type HostConfig } from "@tdl/host";
import { KERNEL_KEYS, PROTOCOL_VERSION, type ServerMessage } from "@tdl/protocol";
import { bootServer, type BootedServer } from "../src/boot.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";

const WORLD_SIZE = 32;

function testConfig(overrides: Record<string, string> = {}): HostConfig {
  const url = readTestDbUrl("server");
  if (!url) throw new Error("адрес тестовой базы не найден: запустите тесты пакета");
  return loadConfig({
    DATABASE_URL: url,
    WORLD_ID: `srv-${randomUUID().slice(0, 12)}`,
    WORLD_NAME: "мир проверки",
    WORLD_SEED: "11",
    WORLD_SIZE: String(WORLD_SIZE),
    SESSION_SECRET: "test-secret-0123456789",
    REGISTRATION_OPEN: "1",
    PORT: "0",
    HOST: "127.0.0.1",
    NODE_ENV: "test",
    ...overrides,
  });
}

/** Клиент сокета: копит сообщения и ждёт нужное. */
class Client {
  private readonly queue: ServerMessage[] = [];
  private readonly waiters: { match: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void }[] = [];
  /** Последний снимок вида: он же уходит клиенту при входе. */
  lastView: Record<string, unknown> | null = null;

  constructor(private readonly socket: WebSocket) {
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

async function registerLord(client: Client, name: string): Promise<void> {
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

function tokenOf(client: Client): string {
  const token = tokens.get(client);
  if (!token) throw new Error("токен ещё не пришёл");
  return token;
}

/** Регистрация нового лорда: готовый клиент и его снимок вида. */
async function newLord(booted: BootedServer, login: string, name: string): Promise<Client> {
  const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
  const auth = client.next((message) => message.t === "auth");
  const tokenPromise = auth.then((message) => {
    if (message.t === "auth") tokens.set(client, message.token);
    return message;
  });
  client.send({ t: "auth.register", protocolVersion: PROTOCOL_VERSION, login, password: "secret-12345", lang: "ru" });
  const first = await tokenPromise;
  expect(first.t === "auth" && first.needsLord).toBe(true);
  const ready = await client.next((message) => message.t === "ready");
  expect(ready.t === "ready" && ready.modules).toContain("_probe");
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
  expect(entered.t === "auth" && entered.needsLord).toBe(false);
  await client.next((message) => message.t === "state");
  return client;
}

/** Снимок вида, который клиент уже получил. */
function viewOf(client: Client): {
  world: { size: number; now: number; downtimeMs: number };
  me: { name: string } | null;
  stock: Record<string, number>;
  modules: Record<string, unknown>;
} {
  if (!client.lastView) throw new Error("снимок вида ещё не пришёл");
  return client.lastView as unknown as {
    world: { size: number; now: number; downtimeMs: number };
    me: { name: string } | null;
    stock: Record<string, number>;
    modules: Record<string, unknown>;
  };
}

describe("сокет и ворота", () => {
  let booted: BootedServer;

  beforeAll(async () => {
    booted = await bootServer({ config: testConfig(), serveClient: false });
  }, 60_000);

  afterAll(async () => {
    await booted.stop("test");
  });

  it("регистрация пускает в мир, создание лорда даёт снимок", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, "Первый лорд");
    const view = viewOf(client);
    expect(view.world.size).toBe(WORLD_SIZE);
    expect(view.world.now).toBeGreaterThan(0);
    client.close();
  });

  it("старая версия протокола не проходит даже до ворот", async () => {
    const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    client.send({ t: "auth.login", protocolVersion: PROTOCOL_VERSION - 1, login: "nobody", password: "secret-12345", lang: "ru" });
    const error = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.protocol);
    client.close();
  });

  it("имя лорда занимается один раз и в любом регистре", async () => {
    const taken = `Лорд ${randomUUID().slice(0, 6)}`;
    const first = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, taken);
    first.close();

    const second = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    const auth = second.next((message) => message.t === "auth");
    second.send({ t: "auth.register", protocolVersion: PROTOCOL_VERSION, login: `lord_${randomUUID().slice(0, 8)}`, password: "secret-12345", lang: "ru" });
    const message = await auth;
    expect(message.t).toBe("auth");
    const token = message.t === "auth" ? message.token : "";
    second.send({
      t: "lord.create",
      protocolVersion: PROTOCOL_VERSION,
      token,
      name: taken.toUpperCase(),
      portrait: "portrait-2",
      bannerSign: "bell",
      bannerColor: "moss",
      type: "flesh",
    });
    const error = await second.next<{ t: "error"; key: string }>((message_) => message_.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.nameTaken);
    second.close();
  });

  it("токен продолжает пускать после переподключения", async () => {
    const login = `lord_${randomUUID().slice(0, 8)}`;
    const client = await newLord(booted, login, `Лорд ${randomUUID().slice(0, 6)}`);
    const token = tokenOf(client);
    client.close();

    const again = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    again.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: "ru" });
    const message = await again.next<{ t: "auth"; needsLord: boolean }>((message_) => message_.t === "auth");
    expect(message.needsLord).toBe(false);
    await again.next((message_) => message_.t === "state");
    const view = viewOf(again);
    expect(view.me?.name.length).toBeGreaterThan(1);
    again.close();
  });

  it("команда возвращает патч, отчёт и свежий склад", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Лорд ${randomUUID().slice(0, 6)}`);
    client.send({
      t: "command",
      protocolVersion: PROTOCOL_VERSION,
      requestId: `req-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `key-${randomUUID()}`,
      command: { id: "_probe.poke", payload: { steps: 3 } },
    });
    const patch = await client.next<{ t: "patch"; ops: { op: string; path: string; value?: unknown }[] }>(
      (message) => message.t === "patch",
    );
    const paths = patch.ops.map((op) => op.path);
    expect(paths).toContain("modules._probe.level");
    expect(paths).toContain("stock.probe_dust");

    const report = await client.next<{ t: "report"; report: { rows: { key: string }[] } }>(
      (message) => message.t === "report",
    );
    expect(report.report.rows[0]?.key).toBe("probe.report.poke");

    // Снимок, который уходит вместе с отчётом, обязан показывать уже
    // зафиксированный мир: иначе клиент откатит себе только что полученный патч.
    const fresh = viewOf(client);
    const added = patch.ops.find((op) => op.path === "stock.probe_dust")?.value ?? 0;
    expect(fresh.stock.probe_dust).toBe(Number(added));
    expect((fresh.modules as Record<string, { level?: number }>)._probe?.level).toBe(3);
    client.close();
  });

  it("неизвестная команда и плохой ввод отвечают ключом, а не исключением", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Лорд ${randomUUID().slice(0, 6)}`);
    client.send({
      t: "command",
      protocolVersion: PROTOCOL_VERSION,
      requestId: `req-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `key-${randomUUID()}`,
      command: { id: "_probe.nope", payload: {} },
    });
    const unknown = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(unknown.key).toBe(KERNEL_KEYS.unknown);

    client.send({
      t: "command",
      protocolVersion: PROTOCOL_VERSION,
      requestId: `req-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `key-${randomUUID()}`,
      command: { id: "_probe.poke", payload: { steps: 9999 } },
    });
    const bad = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(bad.key).toBe(KERNEL_KEYS.badInput);
    client.close();
  });

  it("частота команд ограничена", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Лорд ${randomUUID().slice(0, 6)}`);
    for (let index = 0; index < 25; index += 1) {
      client.send({
        t: "command",
        protocolVersion: PROTOCOL_VERSION,
        requestId: `req-${index}-${randomUUID().slice(0, 6)}`,
        idempotencyKey: `key-${randomUUID()}`,
        command: { id: "_probe.poke", payload: { steps: 1 } },
      });
    }
    const rate = await client.next<{ t: "error"; key: string }>(
      (message) => message.t === "error" && message.key === KERNEL_KEYS.rate,
    );
    expect(rate.key).toBe(KERNEL_KEYS.rate);
    client.close();
  });

  it("без лорда команда не проходит", async () => {
    const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    client.send({
      t: "command",
      protocolVersion: PROTOCOL_VERSION,
      requestId: `req-${randomUUID().slice(0, 8)}`,
      idempotencyKey: `key-${randomUUID()}`,
      command: { id: "_probe.poke", payload: { steps: 1 } },
    });
    const error = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.session);
    client.close();
  });
});

describe("закрытая регистрация", () => {
  let booted: BootedServer;

  beforeAll(async () => {
    booted = await bootServer({ config: testConfig({ REGISTRATION_OPEN: "0" }), serveClient: false });
  }, 60_000);

  afterAll(async () => {
    await booted.stop("test");
  });

  it("флаг закрывает ворота и не мешает живому миру", async () => {
    const client = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    client.send({ t: "auth.register", protocolVersion: PROTOCOL_VERSION, login: `lord_${randomUUID().slice(0, 8)}`, password: "secret-12345", lang: "ru" });
    const error = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.registration);
    // Мир при этом жив: health отвечает, сроки идут.
    const health = await fetch(`http://127.0.0.1:${booted.port}/api/health`);
    const body = (await health.json()) as { ok: boolean; ready: boolean; stats: { epoch: number } };
    expect(body.ok).toBe(true);
    expect(body.ready).toBe(true);
    expect(body.stats.epoch).toBeGreaterThan(0);
    client.close();
  });
});

