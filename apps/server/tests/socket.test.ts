/**
 * Сквозная проверка контура: ворота, сокет, команда, патч, отчёт.
 * Мир поднимается как в бою — bootServer на настоящем Postgres и своём порту,
 * клиент говорит по тому же протоколу, что и браузер.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, type HostConfig } from "@tdl/host";
import { KERNEL_KEYS, PROTOCOL_VERSION } from "@tdl/protocol";
import { bootServer, type BootedServer } from "../src/boot.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";
import { Client, commandMessage, newLord, openWithToken, tokenOf, viewOf } from "./client.js";

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

  it("выход отзывает сессию: тем же токеном в мир уже не войти", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, "Ушедший лорд");
    const token = tokenOf(client);
    // Токен до выхода работает: это та же сессия, что открылась при регистрации.
    const alive = await openWithToken(booted, token);
    alive.close();

    const out = client.next((message) => message.t === "out");
    client.send({ t: "auth.logout", protocolVersion: PROTOCOL_VERSION, token });
    const answer = await out;
    expect(answer.t === "out" && answer.ok).toBe(true);

    // После выхода токен мёртв: сервер не пускает по нему ни в сокете, ни в мире.
    const again = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    again.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: "ru" });
    const refused = await again.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(refused.key).toBe(KERNEL_KEYS.session);
    again.close();
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
    const secondLogin = `lord_${randomUUID().slice(0, 8)}`;
    second.send({
      t: "auth.register",
      protocolVersion: PROTOCOL_VERSION,
      login: secondLogin,
      password: "secret-12345",
      email: `${secondLogin}@mail.test`,
      acceptRules: true,
      acceptMail: false,
      lang: "ru",
    });
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
    const lordLogin = `lord_${randomUUID().slice(0, 8)}`;
    client.send({
      t: "auth.register",
      protocolVersion: PROTOCOL_VERSION,
      login: lordLogin,
      password: "secret-12345",
      email: `${lordLogin}@mail.test`,
      acceptRules: true,
      acceptMail: false,
      lang: "ru",
    });
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

describe("напор на сокет", () => {
  let booted: BootedServer;

  beforeAll(async () => {
    booted = await bootServer({ config: testConfig(), serveClient: false });
  }, 60_000);

  afterAll(async () => {
    await booted.stop("test");
  });

  it("соединения разных лордов не путают патчи", async () => {
    const first = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Напор ${randomUUID().slice(0, 4)}`);
    const second = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Тихий ${randomUUID().slice(0, 4)}`);
    const firstSessions = [first, await openWithToken(booted, tokenOf(first)), await openWithToken(booted, tokenOf(first))];
    const secondSession = await openWithToken(booted, tokenOf(second));

    first.send(commandMessage("_probe.poke", { steps: 2 }));
    const patches = await Promise.all(firstSessions.map((client) => client.next((message) => message.t === "patch")));
    expect(patches).toHaveLength(3);
    for (const patch of patches) {
      expect(patch.t === "patch" && patch.ops.some((op) => op.path === "stock.probe_dust")).toBe(true);
    }
    // Второй лорд жил своей жизнью: чужих патчей он не видел.
    await expect(secondSession.next((message) => message.t === "patch", 700)).rejects.toThrow();
    const quietView = viewOf(secondSession);
    const loudView = viewOf(firstSessions[0] as Client);
    expect(quietView.stock.probe_dust ?? 0).toBe(0);
    expect(loudView.stock.probe_dust ?? 0).toBeGreaterThan(0);

    for (const client of [...firstSessions, secondSession, second]) client.close();
  });

  it("частота команд считается на соединение и не наказывает соседа", async () => {
    const noisy = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Шумный ${randomUUID().slice(0, 4)}`);
    const neighbour = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Сосед ${randomUUID().slice(0, 4)}`);
    for (let index = 0; index < 25; index += 1) noisy.send(commandMessage("_probe.poke", { steps: 1 }));
    const rate = await noisy.next<{ t: "error"; key: string }>(
      (message) => message.t === "error" && message.key === KERNEL_KEYS.rate,
    );
    expect(rate.key).toBe(KERNEL_KEYS.rate);

    // Сосед в тот же миг отправил одну команду: её принимают.
    neighbour.send(commandMessage("_probe.poke", { steps: 1 }));
    const patch = await neighbour.next((message) => message.t === "patch");
    expect(patch.t).toBe("patch");
    noisy.close();
    neighbour.close();
  });

  it("мусор вместо JSON не рвёт соединение", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Мусор ${randomUUID().slice(0, 4)}`);
    client.sendRaw("это не json");
    const error = await client.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.badInput);
    // Соединение живо: следующая команда проходит.
    client.send(commandMessage("_probe.poke", { steps: 1 }));
    const patch = await client.next((message) => message.t === "patch");
    expect(patch.t).toBe("patch");
    client.close();
  });

  it("слишком большое сообщение не роняет мир", async () => {
    const client = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Великан ${randomUUID().slice(0, 4)}`);
    client.send(commandMessage("_probe.poke", { steps: 1, blob: "я".repeat(20_000) }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Мир продолжает отвечать: живой сокет и health.
    const fresh = await Client.open(`ws://127.0.0.1:${booted.port}/socket`);
    fresh.send({ t: "ping", protocolVersion: PROTOCOL_VERSION });
    const pong = await fresh.next((message) => message.t === "pong");
    expect(pong.t).toBe("pong");
    const health = await fetch(`http://127.0.0.1:${booted.port}/api/health`);
    const body = (await health.json()) as { ok: boolean; stats: { failures: number } };
    expect(body.ok).toBe(true);
    expect(body.stats.failures).toBe(0);
    fresh.close();
    client.close();
  });

  it("десять команд с пяти соединений проходят без потерь", async () => {
    const lord = await newLord(booted, `lord_${randomUUID().slice(0, 8)}`, `Поток ${randomUUID().slice(0, 4)}`);
    const token = tokenOf(lord);
    const sessions = [lord, ...(await Promise.all(Array.from({ length: 4 }, () => openWithToken(booted, token))))];
    const before = viewOf(sessions[0] as Client).stock.probe_dust ?? 0;
    const perSession = 5;
    for (const session of sessions) {
      for (let index = 0; index < perSession; index += 1) session.send(commandMessage("_probe.poke", { steps: 1 }));
    }
    // Ждём по последнему патчу на каждом соединении.
    const patches = await Promise.all(
      sessions.map((session) => session.next((message) => message.t === "patch" && message.ops.length > 0)),
    );
    expect(patches).toHaveLength(sessions.length);
    const wait = sessions[0] as Client;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const after = viewOf(wait).stock.probe_dust ?? before;
    expect(after).toBeGreaterThan(before);
    expect(booted.service.lostLease).toBe(false);
    expect(booted.service.stats().failures).toBe(0);
    for (const session of sessions) session.close();
  });
});
