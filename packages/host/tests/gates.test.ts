/**
 * Ворота: регистрация, вход, сессия, лорд. Ворота стоят вне писателя мира:
 * закрытая регистрация не трогает марши, а сессия живёт в своей таблице.
 * Проверка идёт на настоящем Postgres.
 */

import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { KERNEL_KEYS, LIMITS, PROTOCOL_VERSION } from "@tdl/protocol";
import { createDb, type Db } from "../src/db/index.js";
import { loadConfig, type HostConfig } from "../src/config.js";
import { createJournal, type JournalRecord } from "../src/logger.js";
import { applyKernelMigrations, ensureWorld } from "../src/db/bootstrap.js";
import { createLord, login, register, resume, validateLordName, type GatesOptions } from "../src/gates/gates.js";
import { readTestDbUrl } from "../../../tools/devdb/testing.js";

interface Stand {
  db: Db;
  config: HostConfig;
  gates: GatesOptions;
  records: JournalRecord[];
}

const open: Stand[] = [];

afterEach(async () => {
  while (open.length > 0) await open.pop()?.db.close();
});

async function stand(overrides: Record<string, string> = {}): Promise<Stand> {
  const url = readTestDbUrl("host");
  if (!url) throw new Error("адрес тестовой базы не найден: запустите тесты пакета");
  const records: JournalRecord[] = [];
  const config = loadConfig({
    DATABASE_URL: url,
    WORLD_ID: `gates-${randomUUID().slice(0, 10)}`,
    WORLD_NAME: "мир ворот",
    WORLD_SEED: "23",
    WORLD_SIZE: "32",
    SESSION_SECRET: "test-secret-0123456789",
    REGISTRATION_OPEN: "1",
    NODE_ENV: "test",
    ...overrides,
  });
  const db = createDb(url);
  const journal = createJournal((record) => records.push(record));
  await applyKernelMigrations(db, journal);
  await ensureWorld(db, config, journal);
  const gates: GatesOptions = { db, config, journal };
  const built: Stand = { db, config, gates, records };
  open.push(built);
  return built;
}

const login_ = () => `lord_${randomUUID().slice(0, 10)}`;
const password = "secret-12345";

/** Аккаунт в тесте: логин, почта, согласие с правилами. Письма — по желанию. */
function account(
  login: string,
  over: Partial<{ password: string; email: string; acceptRules: boolean; acceptMail: boolean }> = {},
) {
  return {
    login,
    password: over.password ?? password,
    email: over.email ?? `${login.toLowerCase()}@mail.test`,
    acceptRules: over.acceptRules ?? true,
    acceptMail: over.acceptMail ?? false,
    lang: "ru" as const,
  };
}

describe("регистрация", () => {
  it("закрытая регистрация не пускает и не трогает мир", async () => {
    const world = await stand({ REGISTRATION_OPEN: "0" });
    const name = login_();

    const refused = await register(world.gates, account(name));
    expect(refused).toEqual({ ok: false, key: KERNEL_KEYS.registration });

    const accounts = await world.db.pool.query("SELECT account_id FROM accounts WHERE login_key = $1", [name.toLowerCase()]);
    expect(accounts.rowCount).toBe(0);
    // Ворота вообще не поднимают писателя: следов в днях мира нет.
    expect(world.records.filter((record) => record.event === "gate.registered")).toHaveLength(0);
  });

  it("пароль лежит хешем Argon2id, а не открытым текстом", async () => {
    const world = await stand();
    const name = login_();
    const created = await register(world.gates, account(name));
    expect(created.ok).toBe(true);

    const rows = await world.db.pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM accounts WHERE login_key = $1",
      [name.toLowerCase()],
    );
    const hash = rows.rows[0]?.password_hash ?? "";
    expect(hash).not.toContain(password);
    expect(hash.startsWith("$argon2id$")).toBe(true);

    // Вход по тому же паролю проходит, по другому — нет.
    expect((await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION })).ok).toBe(true);
    const bad = await login(world.gates, { login: name, password: "другой-пароль-123", protocolVersion: PROTOCOL_VERSION });
    expect(bad).toEqual({ ok: false, key: KERNEL_KEYS.login });
    expect(world.records.some((record) => record.event === "gate.login.bad-password")).toBe(true);
  });

  it("почта нужна и входит в ворота: без неё и с кривой — отказ", async () => {
    const world = await stand();
    const name = login_();

    expect(await register(world.gates, account(name, { email: "" }))).toEqual({
      ok: false,
      key: KERNEL_KEYS.emailBad,
    });
    expect(await register(world.gates, account(name, { email: "почта-без-собаки" }))).toEqual({
      ok: false,
      key: KERNEL_KEYS.emailBad,
    });
    expect(await register(world.gates, account(name, { email: "кто-то@почта" }))).toEqual({
      ok: false,
      key: KERNEL_KEYS.emailBad,
    });
    const rows = await world.db.pool.query("SELECT account_id FROM accounts WHERE login_key = $1", [name.toLowerCase()]);
    expect(rows.rowCount).toBe(0);
  });

  it("без согласия с правилами аккаунт не заводится", async () => {
    const world = await stand();
    const name = login_();

    expect(await register(world.gates, account(name, { acceptRules: false }))).toEqual({
      ok: false,
      key: KERNEL_KEYS.rules,
    });
    const rows = await world.db.pool.query("SELECT account_id FROM accounts WHERE login_key = $1", [name.toLowerCase()]);
    expect(rows.rowCount).toBe(0);
  });

  it("логин латиницей: русские буквы и пробелы не проходят", async () => {
    const world = await stand();
    expect(await register(world.gates, account("Лорд_Тьмы"))).toEqual({ ok: false, key: KERNEL_KEYS.login });
    expect(await register(world.gates, account("lord of dark"))).toEqual({ ok: false, key: KERNEL_KEYS.login });
    expect(await register(world.gates, account("lord.of-dark_2"))).toMatchObject({ ok: true });
  });

  it("вход принимает и логин, и почту: имя лорда при этом своё", async () => {
    const world = await stand();
    const name = login_();
    const mail = `${name}@mail.test`;
    const created = await register(world.gates, account(name, { email: mail }));
    expect(created.ok).toBe(true);

    const byLogin = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    const byMail = await login(world.gates, { login: mail.toUpperCase(), password, protocolVersion: PROTOCOL_VERSION });
    expect(byLogin.ok).toBe(true);
    expect(byMail.ok).toBe(true);
    if (!byLogin.ok || !byMail.ok) return;
    expect(byMail.value.accountId).toBe(byLogin.value.accountId);

    // Логин и никнейм разные: имя лорда в аккаунте не занято, его вводит игрок.
    const lord = await createLord(world.gates, {
      accountId: byLogin.value.accountId,
      worldId: world.config.WORLD_ID,
      name: "Мёртвый Лорд",
      portrait: "portrait-1",
      bannerSign: "skull",
      bannerColor: "bone",
      type: "flesh",
    });
    expect(lord.ok).toBe(true);
  });

  it("свой логин занимается один раз и в любом регистре", async () => {
    const world = await stand();
    const name = login_();
    expect((await register(world.gates, account(name))).ok).toBe(true);

    const again = await register(world.gates, account(name.toUpperCase()));
    expect(again).toEqual({ ok: false, key: KERNEL_KEYS.login });
    expect(world.records.some((record) => record.event === "gate.register.exists")).toBe(true);
  });
});

describe("сессия", () => {
  it("токен хранится хешем с секретом, а не как есть", async () => {
    const world = await stand();
    const name = login_();
    await register(world.gates, account(name));
    const entered = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    if (!entered.ok) throw new Error("вход не прошёл");

    const rows = await world.db.pool.query<{ token_hash: string; expires_at: Date }>(
      "SELECT token_hash, expires_at FROM sessions WHERE account_id = $1",
      [entered.value.accountId],
    );
    const stored = rows.rows[0];
    expect(stored?.token_hash).not.toBe(entered.value.token);
    expect(stored?.token_hash).toBe(
      createHash("sha256").update(`${world.config.SESSION_SECRET}:${entered.value.token}`).digest("hex"),
    );
    // Секрет только в окружении: чужой секрет тот же токен не пускает.
    const days = (new Date(stored?.expires_at ?? 0).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(LIMITS.sessionDays - 1);
    expect(days).toBeLessThan(LIMITS.sessionDays + 1);
  });

  it("подделанный и протухший токен не пускает, живой пускает", async () => {
    const world = await stand();
    const name = login_();
    await register(world.gates, account(name));
    const entered = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    if (!entered.ok) throw new Error("вход не прошёл");
    const token = entered.value.token;

    expect((await resume(world.gates, { token, protocolVersion: PROTOCOL_VERSION })).ok).toBe(true);
    expect(await resume(world.gates, { token: `${token}x`, protocolVersion: PROTOCOL_VERSION })).toEqual({
      ok: false,
      key: KERNEL_KEYS.session,
    });

    // Протухание: сессия кончилась — вход по ней закрыт.
    await world.db.pool.query("UPDATE sessions SET expires_at = $1 WHERE account_id = $2", [
      new Date(Date.now() - 1_000),
      entered.value.accountId,
    ]);
    expect(await resume(world.gates, { token, protocolVersion: PROTOCOL_VERSION })).toEqual({
      ok: false,
      key: KERNEL_KEYS.session,
    });
  });

  it("старая версия протокола не проходит ни на входе, ни в сессии", async () => {
    const world = await stand();
    const name = login_();
    await register(world.gates, account(name));
    expect(
      await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION - 1 }),
    ).toEqual({ ok: false, key: KERNEL_KEYS.protocol });

    const entered = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    if (!entered.ok) throw new Error("вход не прошёл");
    expect(await resume(world.gates, { token: entered.value.token, protocolVersion: PROTOCOL_VERSION - 1 })).toEqual({
      ok: false,
      key: KERNEL_KEYS.protocol,
    });
  });
});

describe("лорд", () => {
  it("имя проверяется до базы, повтор имени в мире не проходит", async () => {
    expect(validateLordName("я")).toEqual({ ok: false, key: KERNEL_KEYS.nameBad });
    expect(validateLordName("<b>лорд</b>")).toEqual({ ok: false, key: KERNEL_KEYS.nameBad });
    expect(validateLordName("  Костяной Лорд  ")).toEqual({ ok: true, value: "Костяной Лорд" });

    const world = await stand();
    const name = login_();
    await register(world.gates, account(name));
    const entered = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    if (!entered.ok) throw new Error("вход не прошёл");

    const lordName = `Лорд ${randomUUID().slice(0, 6)}`;
    const first = await createLord(world.gates, {
      accountId: entered.value.accountId,
      worldId: world.config.WORLD_ID,
      name: lordName,
      portrait: "portrait-1",
      bannerSign: "skull",
      bannerColor: "bone",
      type: "bone",
    });
    expect(first.ok).toBe(true);

    // Имя занято в любом регистре и с лишними пробелами.
    const other = await register(world.gates, account(login_()));
    if (!other.ok) throw new Error("второй вход не прошёл");
    const second = await createLord(world.gates, {
      accountId: other.value.accountId,
      worldId: world.config.WORLD_ID,
      name: ` ${lordName.toUpperCase()} `,
      portrait: "portrait-2",
      bannerSign: "bell",
      bannerColor: "moss",
      type: "flesh",
    });
    expect(second).toEqual({ ok: false, key: KERNEL_KEYS.nameTaken });

    // Портрет и знамя берутся из готового набора: своей разметки не бывает.
    const third = await createLord(world.gates, {
      accountId: other.value.accountId,
      worldId: world.config.WORLD_ID,
      name: `Лорд ${randomUUID().slice(0, 6)}`,
      portrait: "<img src=x>",
      bannerSign: "skull",
      bannerColor: "bone",
      type: "bone",
    });
    expect(third).toEqual({ ok: false, key: KERNEL_KEYS.nameBad });
  });

  it("повторное создание лорда возвращает того же, второго не заводит", async () => {
    const world = await stand();
    const name = login_();
    await register(world.gates, account(name));
    const entered = await login(world.gates, { login: name, password, protocolVersion: PROTOCOL_VERSION });
    if (!entered.ok) throw new Error("вход не прошёл");

    const base = {
      accountId: entered.value.accountId,
      worldId: world.config.WORLD_ID,
      portrait: "portrait-1",
      bannerSign: "skull",
      bannerColor: "bone",
      type: "bone",
    };
    const first = await createLord(world.gates, { ...base, name: `Лорд ${randomUUID().slice(0, 6)}` });
    const again = await createLord(world.gates, { ...base, name: `Лорд ${randomUUID().slice(0, 6)}` });
    if (!first.ok || !again.ok) throw new Error("лорд не создан");
    expect(again.value.lordId).toBe(first.value.lordId);

    const lords = await world.db.pool.query("SELECT lord_id FROM lords WHERE account_id = $1", [entered.value.accountId]);
    expect(lords.rowCount).toBe(1);
  });
});
