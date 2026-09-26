/**
 * Снос схемы базы разработки: pnpm db:reset
 * Мир поднимется заново, миграции применятся при старте. Рабочую базу так
 * трогать нельзя, поэтому нужен явный флаг TDL_ALLOW_DB_RESET=1 (его ставит npm-скрипт).
 */

import { Client } from "pg";
import { devDbUrl } from "./index.js";

const url = process.env.DATABASE_URL ?? devDbUrl();
const database = new URL(url).pathname.replace(/^\//, "");
if (process.env.TDL_ALLOW_DB_RESET !== "1") {
  process.stdout.write(
    `Отказ: сброс схемы базы «${database}» требует TDL_ALLOW_DB_RESET=1 (его ставит pnpm db:reset).\n`,
  );
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
for (const schema of ["public", "drizzle"]) {
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
}
await client.query("CREATE SCHEMA public");
await client.end();
process.stdout.write(`Схема базы «${database}» очищена. Мир поднимется заново.\n`);
