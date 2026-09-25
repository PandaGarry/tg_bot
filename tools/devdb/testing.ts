/**
 * База для тестов. Каждому пакету — своя база вида tdl_test_<пакет>: прогон
 * сносит схему целиком, поэтому в чужую базу заходить нельзя и имя проверяется.
 *
 * Адрес берётся так:
 *   1. TDL_TEST_DB_URL — если задан, берём ровно его (имя всё равно проверяется);
 *   2. иначе TDL_TEST_SERVER_URL (или DATABASE_URL) как сервер, база — tdl_test_<пакет>;
 *   3. если сервера нет, поднимаем местный Postgres из tools/devdb (не на бою).
 *
 * Готовый адрес кладётся в файл .devdb/test-db-<пакет>-url: рабочие процессы
 * тестов живут отдельно от главного и переменных окружения не видят.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { devDbUrl, startDevDb, type DevDb } from "./index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface TestDb {
  url: string;
  /** Имя пакета, для которого готовилась база. */
  name: string;
  database: string;
  /** Подняли ли базу мы сами: чужую не гасим. */
  started: boolean;
  stop(): Promise<void>;
}

function urlPath(name: string): string {
  return join(root, ".devdb", `test-db-${name}-url`);
}

function databaseOf(url: string): string {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, "");
  if (database.length === 0) throw new Error(`в адресе нет имени базы: ${url}`);
  return database;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function canConnect(url: string): Promise<boolean> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Прогон роняет схему: чужую базу так трогать нельзя. */
function assertTestDatabase(database: string): void {
  if (/test/i.test(database) || process.env.TDL_TEST_ALLOW_DROP === "1") return;
  throw new Error(
    `база «${database}» не похожа на тестовую: имя обязано содержать test, ` +
      "иначе прогон мог бы снести рабочую схему (TDL_TEST_ALLOW_DROP=1 снимает проверку)",
  );
}

/** Чистая схема: тесты начинают с пустой базы, как новый мир. */
export async function resetSchema(url: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function ensureDatabase(serverUrl: string, database: string): Promise<void> {
  const adminUrl = withDatabase(serverUrl, process.env.TDL_TEST_ADMIN_DB ?? "postgres");
  let client: Client;
  try {
    client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 10_000 });
    await client.connect();
  } catch {
    // На внешнем сервере может не быть базы postgres: тогда пробуем сам адрес.
    if (await canConnect(withDatabase(serverUrl, database))) return;
    throw new Error(`нет доступа ни к ${adminUrl}, ни к базе ${database}`);
  }
  try {
    await client.query(`CREATE DATABASE "${database}"`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "42P04") throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** База для тестов пакета. Чужой процесс не трогаем, свою поднимаем. */
export async function ensureTestDb(name: string): Promise<TestDb> {
  const fixed = process.env.TDL_TEST_DB_URL;
  if (fixed) {
    const database = databaseOf(fixed);
    assertTestDatabase(database);
    await resetSchema(fixed);
    writeTestDbUrl(name, fixed);
    return { url: fixed, name, database, started: false, stop: async () => undefined };
  }

  const serverUrl = process.env.TDL_TEST_SERVER_URL ?? process.env.DATABASE_URL ?? devDbUrl();
  const database = `tdl_test_${name}`;
  assertTestDatabase(database);

  let started: DevDb | null = null;
  if (!(await canConnect(serverUrl))) {
    // Местный Postgres поднимаем только для местного адреса: чужой сервер мы не изобретаем.
    const mayStart = process.env.TDL_TEST_EMBEDDED === "1" || serverUrl === devDbUrl();
    if (!mayStart) {
      throw new Error(
        `Postgres недоступен по адресу ${serverUrl}. Поднимите базу или задайте TDL_TEST_DB_URL (TDL_TEST_EMBEDDED=1 поднимет местную)`,
      );
    }
    try {
      started = await startDevDb({ quiet: true });
    } catch {
      // Кто-то поднял его первым: это не ошибка, просто ещё раз проверим связь.
    }
    if (!(await canConnect(serverUrl))) throw new Error(`Postgres недоступен по адресу ${serverUrl}`);
  }

  await ensureDatabase(serverUrl, database);
  const url = withDatabase(serverUrl, database);
  await resetSchema(url);
  writeTestDbUrl(name, url);
  return {
    url,
    name,
    database,
    started: started !== null,
    stop: async () => {
      if (started) await started.stop();
    },
  };
}

/** Адрес тестовой базы кладётся в файл рядом с местными данными. */
export function writeTestDbUrl(name: string, url: string): void {
  const path = urlPath(name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${url}\n`, "utf8");
}

/** Адрес тестовой базы: окружение важнее файла. */
export function readTestDbUrl(name: string): string | null {
  if (process.env.TDL_TEST_DB_URL) return process.env.TDL_TEST_DB_URL;
  try {
    const value = readFileSync(urlPath(name), "utf8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
