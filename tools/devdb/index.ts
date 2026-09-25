/**
 * Местный Postgres для разработки и тестов. На бою база управляемая,
 * здесь — распакованные бинарники из npm, тот же драйвер и те же миграции.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface DevDbOptions {
  databaseDir?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Куда писать журнал сервера базы. Молчание — тишина. */
  quiet?: boolean;
}

export interface DevDb {
  url: string;
  stop(): Promise<void>;
}

export function devDbUrl(options: DevDbOptions = {}): string {
  const port = options.port ?? Number(process.env.TDL_DB_PORT ?? 55432);
  const user = options.user ?? "tdl";
  const password = options.password ?? "tdl";
  const database = options.database ?? "tdl";
  return `postgres://${user}:${password}@127.0.0.1:${port}/${database}`;
}

export async function startDevDb(options: DevDbOptions = {}): Promise<DevDb> {
  const databaseDir = options.databaseDir ?? join(root, ".devdb", "pg");
  const port = options.port ?? Number(process.env.TDL_DB_PORT ?? 55432);
  const user = options.user ?? "tdl";
  const password = options.password ?? "tdl";
  const database = options.database ?? "tdl";
  await mkdir(dirname(databaseDir), { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user,
    password,
    authMethod: "scram-sha-256",
    persistent: true,
    onLog: options.quiet ? () => undefined : (message) => process.stdout.write(`[pg] ${message}\n`),
    onError: options.quiet ? () => undefined : (message) => process.stderr.write(`[pg] ${String(message)}\n`),
  });

  const initialised = existsSync(join(databaseDir, "PG_VERSION"));
  if (!initialised) await pg.initialise();
  await pg.start();

  try {
    await pg.createDatabase(database);
  } catch (error) {
    // База уже есть: это не ошибка.
    if (!String(error).toLowerCase().includes("already exists")) throw error;
  }

  return {
    url: `postgres://${user}:${password}@127.0.0.1:${port}/${database}`,
    stop: () => pg.stop(),
  };
}
