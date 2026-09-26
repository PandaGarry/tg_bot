/**
 * Пул соединений и транзакции. Соединение не на игрока: пул один на процесс.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export interface Db {
  pool: Pool;
  orm: Database;
  schema: typeof schema;
  close(): Promise<void>;
}

/**
 * Размер пула. По умолчанию 10, но мирам на одном узле его задают окружением:
 * у базы свой предел соединений, и сто миров по десять в него не влезут.
 */
export function poolMaxFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.PG_POOL_MAX ?? "");
  if (!Number.isFinite(value) || value < 1) return 10;
  return Math.min(50, Math.floor(value));
}

export function createDb(connectionString: string, options: { max?: number } = {}): Db {
  const pool = new Pool({
    connectionString,
    max: options.max ?? poolMaxFromEnv(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "tdl-host",
  });
  const orm = drizzle(pool, { schema });
  return {
    pool,
    orm,
    schema,
    close: () => pool.end(),
  };
}

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function withTransaction<T>(db: Db, run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.orm.transaction(async (tx) => run(tx));
}

/** Ошибка, при которой транзакция откатывается целиком. */
export class CommandRejected extends Error {
  readonly effectsKey: string;
  readonly params?: Record<string, string | number>;
  readonly channel: "audit" | "sim" | "security" | "app";

  constructor(
    key: string,
    options: { params?: Record<string, string | number>; channel?: "audit" | "sim" | "security" | "app" } = {},
  ) {
    super(key);
    this.name = "CommandRejected";
    this.effectsKey = key;
    this.params = options.params;
    this.channel = options.channel ?? "sim";
  }
}

/** Старый процесс после подъёма нового писать не может: он выходит. */
export class StaleWriter extends Error {
  constructor(worldId: string) {
    super(`Право писателя мира ${worldId} перешло другому процессу`);
    this.name = "StaleWriter";
  }
}
