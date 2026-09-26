/**
 * Подготовка базы для тестов пакета. Общий файл: адрес кладётся в файл,
 * потому что рабочие процессы тестов не видят переменных главного процесса.
 */

import { ensureTestDb } from "./testing.js";

/** Что вернуть vitest, если базу подняли мы: её надо погасить после прогона. */
export type Teardown = () => Promise<void>;

export function makeSetup(name: string): () => Promise<Teardown | undefined> {
  return async () => {
    const db = await ensureTestDb(name);
    process.env.TDL_TEST_DB_URL = db.url;
    process.stdout.write(`[tests] база ${db.database}: ${db.url.replace(/:[^:@/]+@/, ":***@")}\n`);
    if (!db.started) return undefined;
    return async () => {
      await db.stop();
    };
  };
}

export default makeSetup("common");
