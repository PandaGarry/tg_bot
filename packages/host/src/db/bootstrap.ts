/**
 * Подъём мира: миграции ядра, миграции модулей, строка мира.
 * Миграция модуля либо проходит до открытия мира, либо мир не открывается.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ModuleDefinition, ModuleRegistry } from "@tdl/kernel";
import type { Db } from "./index.js";
import type { HostConfig } from "../config.js";
import type { Journal } from "../logger.js";
import type { WorldRow } from "./schema.js";

/** Папка миграций ядра: рядом с пакетом, путь можно переопределить окружением. */
export function resolveMigrationsDir(): string {
  const candidates = [
    process.env.KERNEL_MIGRATIONS_DIR,
    // Рядом с собранным сервером: сборка кладёт миграции в dist/drizzle.
    fileURLToPath(new URL("./drizzle", import.meta.url)),
    fileURLToPath(new URL("../../drizzle", import.meta.url)),
    fileURLToPath(new URL("../drizzle", import.meta.url)),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("не найдена папка миграций ядра: собрать drizzle-kit generate");
}

/**
 * Замок миграций: один на базу, а не на мир. Миры на общем узле поднимаются
 * разом, и без замка они строят схему наперегонки — это уже ловилось на живом
 * запуске шести миров (падение на CREATE TABLE).
 */
const MIGRATION_LOCK_KEY = 0x54444c31;

export async function applyKernelMigrations(db: Db, journal: Journal): Promise<void> {
  const folder = resolveMigrationsDir();
  // Замок держится отдельным соединением: миграция идёт своими.
  const lock = await db.pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await migrate(db.orm, { migrationsFolder: folder });
  } finally {
    await lock.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
    lock.release();
  }
  journal.write({ channel: "app", event: "kernel.migrated", detail: { folder } });
}

/** Строка мира заводится один раз. Зерно, размер и зоны мира дальше не меняются. */
export async function ensureWorld(db: Db, config: HostConfig, journal: Journal): Promise<WorldRow> {
  await db.pool.query(
    `INSERT INTO worlds (world_id, name, seed, size, zones, zone_pit, zone_capital)
     VALUES ($1, $2, $3, $4, 5, 4, 5)
     ON CONFLICT (world_id) DO NOTHING`,
    [config.WORLD_ID, config.WORLD_NAME, config.WORLD_SEED, config.WORLD_SIZE],
  );
  const rows = await db.pool.query(`SELECT * FROM worlds WHERE world_id = $1`, [config.WORLD_ID]);
  const raw = rows.rows[0] as
    | {
        world_id: string;
        name: string;
        seed: string | number;
        size: number;
        zones: number;
        zone_pit: number;
        zone_capital: number;
        clock_offset_ms: string | number;
        created_at: Date;
      }
    | undefined;
  if (!raw) throw new Error(`мир ${config.WORLD_ID} не заведён`);
  // Сырой запрос отдаёт имена колонок: приводим строку к виду схемы.
  const row: WorldRow = {
    id: raw.world_id,
    name: raw.name,
    seed: Number(raw.seed),
    size: raw.size,
    zones: raw.zones,
    zonePit: raw.zone_pit,
    zoneCapital: raw.zone_capital,
    clockOffsetMs: Number(raw.clock_offset_ms),
    createdAt: raw.created_at,
  };
  journal.write({ channel: "app", worldId: row.id, event: "world.ready", detail: { seed: row.seed, size: row.size } });
  return row;
}

/**
 * Состояние модуля на мир. Новый модуль получает своё состояние по умолчанию,
 * существующий сохраняет своё: включить и выключить его может админ.
 */
export async function syncModuleStates(
  db: Db,
  registry: ModuleRegistry | { modules: readonly ModuleDefinition[] },
  worldId: string,
): Promise<void> {
  for (const def of registry.modules) {
    await db.pool.query(
      `INSERT INTO module_states (world_id, module_id, state, version)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (world_id, module_id) DO NOTHING`,
      [worldId, def.id, def.defaultState ?? "enabled"],
    );
  }
}

/**
 * Миграции модулей: недостающие ступени применяются одной транзакцией
 * до открытия мира. Полуприменённой схемы нет.
 */
export async function applyModuleMigrations(
  db: Db,
  registry: { modules: readonly ModuleDefinition[] },
  worldId: string,
  journal: Journal,
): Promise<void> {
  for (const def of registry.modules) {
    const migrations = [...(def.server?.migrations ?? [])].sort((a, b) => a.to - b.to);
    const current = await db.pool.query<{ version: number }>(
      `SELECT version FROM module_states WHERE world_id = $1 AND module_id = $2`,
      [worldId, def.id],
    );
    const from = Number(current.rows[0]?.version ?? 0);
    const pending = migrations.filter((migration) => migration.to > from);
    if (pending.length === 0) continue;
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      for (const migration of pending) {
        await client.query(migration.sql);
      }
      await client.query(`UPDATE module_states SET version = $3 WHERE world_id = $1 AND module_id = $2`, [
        worldId,
        def.id,
        pending[pending.length - 1]?.to ?? from,
      ]);
      await client.query("COMMIT");
      journal.write({
        channel: "app",
        worldId,
        moduleId: def.id,
        event: "module.migrated",
        detail: { from, to: pending[pending.length - 1]?.to ?? from, steps: pending.length },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new Error(`миграция модуля ${def.id} не прошла: ${String(error)}`);
    } finally {
      client.release();
    }
  }
}
