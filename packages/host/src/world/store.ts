/**
 * Чтение своих таблиц модулем. Только чтение и только внутри транзакции шага:
 * модуль не открывает своё соединение и не пишет в базу.
 * Первый параметр запроса — world_id, ядро подставляет его само.
 */

import type { ModuleStore } from "@tdl/kernel";
import type { JsonObject, JsonValue } from "@tdl/kernel";

/** Умеет только то, что нужно чтению: запрос и параметры. */
export interface QueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: JsonObject[] }>;
}

const READ_START = /^\s*(?:--[^\n]*\n\s*)*(select|with)\b/i;

export class StoreViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreViolation";
  }
}

/**
 * Проверка запроса модуля. Пишущие запросы, склейка строк и несколько
 * команд в одной строке не проходят.
 */
export function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (trimmed.includes(";")) {
    throw new StoreViolation("в запросе модуля больше одной команды");
  }
  if (!READ_START.test(trimmed)) {
    throw new StoreViolation("модуль читает только свои таблицы: запрос начинается с select или with");
  }
  if (!/\$1\b/.test(trimmed)) {
    throw new StoreViolation("в запросе модуля нет $1: первым параметром идёт world_id");
  }
}

export function createModuleStore(client: QueryClient, worldId: string, moduleId: string): ModuleStore {
  return {
    async read<T = JsonObject>(sql: string, params: readonly JsonValue[] = []): Promise<T[]> {
      assertReadOnly(sql);
      const result = await client.query(sql, [worldId, ...params]);
      return result.rows as T[];
    },
  };
}

/** Запись из модуля невозможна: журнал попытки уходит в канал security. */
export const MODULE_ID_TAG = Symbol.for("tdl.module");
export type TaggedStore = { [MODULE_ID_TAG]?: string; moduleId?: string };

export function storeModuleId(store: ModuleStore): string | undefined {
  return (store as TaggedStore)[MODULE_ID_TAG];
}
