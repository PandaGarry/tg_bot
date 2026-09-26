/**
 * Запуск местной базы: pnpm dev:db
 * Процесс держит Postgres 18 до остановки. Миграции применяет мир при подъёме.
 */

import { startDevDb } from "./index.js";

const db = await startDevDb();
process.stdout.write(`Postgres готов: ${db.url}\n`);
process.stdout.write("Миграции применятся при подъёме мира. Остановка — Ctrl+C.\n");

const stop = async (): Promise<void> => {
  await db.stop();
  process.exit(0);
};

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
