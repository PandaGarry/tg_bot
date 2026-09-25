/**
 * Живучесть контура: протухшая сессия, второй процесс на том же мире,
 * перезапуск под нагрузкой. Мир не должен ни терять команды, ни двоить их,
 * ни пускать второго писателя в тот же склад.
 */

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, type HostConfig } from "@tdl/host";
import { KERNEL_KEYS, PROTOCOL_VERSION } from "@tdl/protocol";
import { bootServer, type BootedServer } from "../src/boot.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";
import { kitModule } from "../../../packages/host/tests/kit.js";
import { Client, commandMessage, newLord, openWithToken, tokenOf, viewOf } from "./client.js";

const booted: BootedServer[] = [];

afterEach(async () => {
  while (booted.length > 0) await booted.pop()?.stop("test");
});

/** Настройки мира как из окружения: тест подменяет отдельные ключи. */
function envOf(worldId: string, overrides: Record<string, string> = {}): Record<string, string> {
  const url = readTestDbUrl("server");
  if (!url) throw new Error("адрес тестовой базы не найден: запустите тесты пакета");
  return {
    DATABASE_URL: url,
    WORLD_ID: worldId,
    WORLD_NAME: "мир живучести",
    WORLD_SEED: "17",
    WORLD_SIZE: "32",
    SESSION_SECRET: "test-secret-0123456789",
    REGISTRATION_OPEN: "1",
    PORT: "0",
    HOST: "127.0.0.1",
    NODE_ENV: "test",
    ...overrides,
  };
}

function testConfig(worldId: string): HostConfig {
  return loadConfig(envOf(worldId));
}

async function boot(worldId: string, sendBufferBytes?: number): Promise<BootedServer> {
  const server = await bootServer({
    config: testConfig(worldId),
    serveClient: false,
    sendBufferBytes,
    extraModules: [kitModule()],
  });
  booted.push(server);
  return server;
}

async function marksOf(server: BootedServer, lordId: string): Promise<number> {
  const rows = await server.db.pool.query<{ marks: number }>(
    `SELECT level AS marks FROM probe_state WHERE world_id = $1 AND holder_id = $2`,
    [server.worldId, lordId],
  );
  return Number(rows.rows[0]?.marks ?? 0);
}

/** Сколько единиц пыли лежит у лорда. */
async function dustOf(server: BootedServer, lordId: string): Promise<number> {
  const rows = await server.db.pool.query<{ amount: string }>(
    `SELECT amount FROM stock WHERE world_id = $1 AND holder_id = $2 AND resource_id = 'probe_dust'`,
    [server.worldId, lordId],
  );
  return Number(rows.rows[0]?.amount ?? 0);
}

describe("сессия и ворота", () => {
  it("протухший токен не пускает, живой пускает", async () => {
    const server = await boot(`live-${randomUUID().slice(0, 10)}`);
    const client = await newLord(server, `lord_${randomUUID().slice(0, 8)}`, `Старый ${randomUUID().slice(0, 4)}`);
    const token = tokenOf(client);
    client.close();

    await server.db.pool.query(`UPDATE sessions SET expires_at = now() - interval '1 day' WHERE lord_id IS NOT NULL`);
    const expired = await Client.open(`ws://127.0.0.1:${server.port}/socket`);
    expired.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: "ru" });
    const error = await expired.next<{ t: "error"; key: string }>((message) => message.t === "error");
    expect(error.key).toBe(KERNEL_KEYS.session);
    expired.close();
  });
});

describe("второй процесс на том же мире", () => {
  it("первый забирает право, второй продолжает, первый замолкает", async () => {
    const worldId = `one-${randomUUID().slice(0, 10)}`;
    const first = await boot(worldId);
    const second = await boot(worldId);
    expect(second.service.stats().epoch).toBe(first.service.stats().epoch + 1);

    // Первый процесс пытается писать: право уже не его.
    const client = await newLord(first, `lord_${randomUUID().slice(0, 8)}`, `Первый ${randomUUID().slice(0, 4)}`);
    const lordId = viewOf(client).me?.id ?? "";
    client.send(commandMessage("_probe.poke", { steps: 3 }));
    const error = await client.next<{ t: "error"; key: string }>((message) => message.t === "error", 8_000);
    expect(["kernel.command.stale", "kernel.failed"]).toContain(error.key);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(first.service.lostLease).toBe(true);
    expect(first.service.isStopped).toBe(true);
    expect(await dustOf(second, lordId)).toBe(0);

    // Второй процесс живёт своей жизнью: тот же лорд, новая сессия.
    const fresh = await Client.open(`ws://127.0.0.1:${second.port}/socket`);
    fresh.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token: tokenOf(client), lang: "ru" });
    await fresh.next((message) => message.t === "auth");
    await fresh.next((message) => message.t === "state");
    fresh.send(commandMessage("_probe.poke", { steps: 3 }));
    const patch = await fresh.next((message) => message.t === "patch");
    expect(patch.t).toBe("patch");
    expect(await dustOf(second, lordId)).toBeGreaterThan(0);
    expect(second.service.stats().failures).toBe(0);
    fresh.close();
    client.close();
  });
});

describe("занятый порт", () => {
  it("второй процесс на том же порту не забирает право писателя", async () => {
    const worldId = `port-${randomUUID().slice(0, 8)}`;
    const first = await boot(worldId);
    const lord = await newLord(first, `lord_${randomUUID().slice(0, 8)}`, `Портовый ${randomUUID().slice(0, 4)}`);
    const epoch = first.service.stats().epoch;

    // Второй процесс того же мира метит на тот же порт.
    const second = await bootServer({
      config: loadConfig(envOf(worldId, { PORT: String(first.port) })),
      serveClient: false,
    }).catch((error: unknown) => error);
    expect(second).toBeInstanceOf(Error);
    expect(String(second)).toContain("EADDRINUSE");

    // Мир остался у первого: право писателя не отобрано, команды идут.
    expect(first.service.stats().epoch).toBe(epoch);
    lord.send(commandMessage("_probe.poke", { steps: 1 }));
    const patch = await lord.next<{ t: "patch" }>((message) => message.t === "patch");
    expect(patch.t).toBe("patch");
    expect(viewOf(lord).me?.name).toBeDefined();
    lord.close();
  });
});

describe("медленный клиент", () => {
  it("не копит память мира: соединение закрывается, клиент переподключается", async () => {
    // Предел меньше одного большого патча: проверка не зависит от буферов ядра.
    const server = await boot(`slow-${randomUUID().slice(0, 8)}`, 8_192);
    const client = await newLord(server, `lord_${randomUUID().slice(0, 8)}`, "Медленный лорд");
    const token = tokenOf(client);
    client.pauseReading();

    client.send(commandMessage("_kit.big-patch", { bytes: 64_000 }));
    for (let step = 0; step < 100 && server.slowClientCount() === 0; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Мир закрыл медленное соединение и убрал его из своих.
    expect(server.slowClientCount()).toBe(1);
    expect(server.connections()).toBe(0);
    const journal = server.records.filter((record) => record.event === "net.slow-client");
    expect(journal).toHaveLength(1);
    expect(journal[0]?.detail).toMatchObject({ limit: 8_192 });

    // Клиент возвращается к чтению: он получил приказ закрыться и заходит заново.
    client.resumeReading();
    const code = await Promise.race([
      client.closed,
      new Promise<number>((resolve) => setTimeout(() => resolve(-1), 5_000)),
    ]);
    expect(code).toBe(1013);
    const back = await openWithToken(server, token);
    expect(viewOf(back).me?.name).toBe("Медленный лорд");

    // Обычный патч в предел влезает: читающий клиент не отключается.
    back.send(commandMessage("_kit.mark", { count: 1 }));
    const patch = await back.next<{ t: "patch" }>((message) => message.t === "patch");
    expect(patch.t).toBe("patch");
    expect(server.slowClientCount()).toBe(1);
    expect(server.connections()).toBe(1);
    back.close();
  });
});

describe("перезапуск под нагрузкой", () => {
  it("сколько команд применено, столько и ответов: ни потерь, ни двойной выдачи", async () => {
    const worldId = `restart-${randomUUID().slice(0, 10)}`;
    const first = await boot(worldId);
    const client = await newLord(first, `lord_${randomUUID().slice(0, 8)}`, `Живучий ${randomUUID().slice(0, 4)}`);
    const me = viewOf(client).me;
    const token = tokenOf(client);
    if (!me) throw new Error("лорд не создан");
    const actor = { id: me.id, worldId, name: me.name, clanId: null, isBot: false };

    // Двадцать команд разом и сразу плановая остановка: часть успеет, часть нет.
    const outcomes = Array.from({ length: 20 }, () =>
      first.service.submitCommand({
        actor,
        commandId: "_probe.poke",
        payload: { steps: 1 },
        requestId: `req-${randomUUID().slice(0, 8)}`,
        idempotencyKey: `key-${randomUUID()}`,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    await first.stop("плановый перезапуск");
    const answers = await Promise.all(outcomes);
    const applied = answers.filter((answer) => answer.status === "ok" && !answer.repeat).length;
    expect(applied).toBeGreaterThan(0);

    // Мир поднимается заново на том же месте: применено ровно столько, сколько ответили «ок».
    const restarted = await boot(worldId);
    expect(restarted.service.stats().epoch).toBeGreaterThan(first.service.stats().epoch);
    // Уровень пробы — счётчик применённых команд: ни одна не потерялась и не удвоилась.
    const dust = await dustOf(restarted, actor.id);
    expect(dust).toBeGreaterThan(0);
    expect(dust).toBeLessThanOrEqual(500);
    expect(await marksOf(restarted, actor.id)).toBe(applied);
    expect(restarted.service.stats().failures).toBe(0);

    // Тот же лорд продолжает с того же места, счёт не сбит.
    const back = await Client.open(`ws://127.0.0.1:${restarted.port}/socket`);
    back.send({ t: "auth.token", protocolVersion: PROTOCOL_VERSION, token, lang: "ru" });
    await back.next((message) => message.t === "auth");
    await back.next((message) => message.t === "state");
    back.send(commandMessage("_probe.poke", { steps: 1 }));
    await back.next((message) => message.t === "patch");
    expect(await dustOf(restarted, actor.id)).toBeGreaterThanOrEqual(dust);
    expect(await marksOf(restarted, actor.id)).toBe(applied + 1);
    back.close();
    client.close();
  });
});
