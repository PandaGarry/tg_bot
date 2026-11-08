/** Регрессия: миграции изолированы по миру и сериализованы между процессами. */
import type { ModuleDefinition } from "@tdl/kernel";
import { describe, expect, it } from "vitest";
import { applyModuleMigrations, bootstrapWorld, syncModuleStates } from "../src/db/bootstrap.js";
import { createJournal } from "../src/logger.js";
import { createTestWorld } from "./harness.js";

describe("изоляция миграций миров", () => {
  it("сброс формата двора ограничен world_id текущей миграции", async () => {
    const first = await createTestWorld();
    const second = await createTestWorld();
    try {
      await first.db.pool.query(
        `INSERT INTO court_holder (world_id, holder_id, starter, grid, updated_at_ms, townhall_level)
         VALUES ($1, 'holder-first', 1, '{"legacy":"first"}'::jsonb, 1, 4),
                ($2, 'holder-second', 1, '{"legacy":"second"}'::jsonb, 1, 5)`,
        [first.id, second.id],
      );
      await first.db.pool.query(
        "UPDATE module_states SET version = 2 WHERE module_id = 'court' AND world_id = ANY($1)",
        [[first.id, second.id]],
      );

      await applyModuleMigrations(first.db, first.registry, first.id, createJournal(() => undefined));

      const rows = await first.db.pool.query<{
        world_id: string;
        grid: unknown;
        townhall_level: number;
      }>(
        "SELECT world_id, grid, townhall_level FROM court_holder WHERE holder_id IN ('holder-first', 'holder-second') ORDER BY holder_id",
      );
      const byWorld = new Map(rows.rows.map((row) => [row.world_id, row]));
      expect(byWorld.get(first.id)).toMatchObject({ grid: null, townhall_level: 1 });
      expect(byWorld.get(second.id)).toMatchObject({
        grid: { legacy: "second" },
        townhall_level: 5,
      });

      // Второй мир применяет ту же ступень только к своим данным.
      await applyModuleMigrations(second.db, second.registry, second.id, createJournal(() => undefined));
      const finalRows = await first.db.pool.query<{ world_id: string; grid: unknown; townhall_level: number }>(
        "SELECT world_id, grid, townhall_level FROM court_holder WHERE holder_id IN ('holder-first', 'holder-second') ORDER BY holder_id",
      );
      const finalByWorld = new Map(finalRows.rows.map((row) => [row.world_id, row]));
      expect(finalByWorld.get(second.id)).toMatchObject({ grid: null, townhall_level: 1 });
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("двойной конкурентный запуск не применяет одну миграцию дважды", async () => {
    const world = await createTestWorld();
    try {
      await world.db.pool.query(
        `CREATE TABLE IF NOT EXISTS migration_race_probe (
          world_id text NOT NULL,
          module_id text NOT NULL
        )`,
      );
      await world.db.pool.query("DELETE FROM migration_race_probe WHERE world_id = $1", [world.id]);

      const definition: ModuleDefinition = {
        id: "migration-race",
        version: 1,
        kind: "core",
        server: {
          migrations: [
            {
              to: 1,
              // Пауза расширяет окно гонки, чтобы тест ловил чтение версии до lock.
              sql: `SELECT pg_sleep(0.15);
                    INSERT INTO migration_race_probe (world_id, module_id)
                    VALUES (current_setting('tdl.world_id', true), 'migration-race')`,
            },
          ],
        },
      };
      const registry = { modules: [definition] };
      await syncModuleStates(world.db, registry, world.id);

      const events: string[] = [];
      const journal = createJournal((record) => events.push(record.event));
      await Promise.all([
        applyModuleMigrations(world.db, registry, world.id, journal),
        applyModuleMigrations(world.db, registry, world.id, journal),
      ]);

      const rows = await world.db.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM migration_race_probe WHERE world_id = $1 AND module_id = 'migration-race'",
        [world.id],
      );
      expect(Number(rows.rows[0]?.count)).toBe(1);
      expect(events.filter((event) => event === "module.migrated")).toHaveLength(1);
    } finally {
      await world.db.pool.query("DELETE FROM migration_race_probe WHERE world_id = $1", [world.id]).catch(() => undefined);
      await world.close();
    }
  });

  it("полный bootstrap сериализуется одним замком от ядра до миграций модулей", async () => {
    const definition: ModuleDefinition = {
      id: "migration-bootstrap-race",
      version: 1,
      kind: "core",
      content: {
        strings: {
          ru: { "migration-bootstrap-race.name": "Проверка миграций" },
          en: { "migration-bootstrap-race.name": "Migration probe" },
        },
      },
      server: {
        migrations: [
          {
            to: 1,
            sql: `SELECT pg_sleep(0.15);
                  CREATE TABLE IF NOT EXISTS migration_bootstrap_probe (
                    world_id text NOT NULL,
                    module_id text NOT NULL
                  );
                  INSERT INTO migration_bootstrap_probe (world_id, module_id)
                  VALUES (current_setting('tdl.world_id', true), 'migration-bootstrap-race')`,
          },
        ],
      },
    };
    const world = await createTestWorld({ extraModules: [definition] });
    try {
      await world.db.pool.query(
        "UPDATE module_states SET version = 0 WHERE world_id = $1 AND module_id = $2",
        [world.id, definition.id],
      );
      await world.db.pool.query("DELETE FROM migration_bootstrap_probe WHERE world_id = $1", [world.id]);

      const events: string[] = [];
      const journal = createJournal((record) => events.push(record.event));
      const [first, second] = await Promise.all([
        bootstrapWorld(world.db, world.config, world.registry, journal),
        bootstrapWorld(world.db, world.config, world.registry, journal),
      ]);

      expect(first.id).toBe(world.id);
      expect(second.id).toBe(world.id);
      const rows = await world.db.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM migration_bootstrap_probe WHERE world_id = $1 AND module_id = $2",
        [world.id, definition.id],
      );
      expect(Number(rows.rows[0]?.count)).toBe(1);
      expect(events.filter((event) => event === "module.migrated")).toHaveLength(1);
    } finally {
      await world.db.pool.query("DELETE FROM migration_bootstrap_probe WHERE world_id = $1", [world.id]).catch(() => undefined);
      await world.close();
    }
  });
});

describe("email uniqueness migration", () => {
  it("allows multiple accounts without email and rejects duplicate non-empty email", async () => {
    const world = await createTestWorld();
    try {
      const insert = (suffix: string, email: string, emailKey: string) =>
        world.db.pool.query(
          `INSERT INTO accounts (account_id, login, login_key, email, email_key, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`email-test-${world.id}-${suffix}`, `email-test-${suffix}`, `email-test-${world.id}-${suffix}`, email, emailKey, "test-hash"],
        );
      await insert("empty-1", "", "");
      await insert("empty-2", "", "");
      const uniqueEmail = `same-${world.id}@example.com`;
      await insert("filled-1", uniqueEmail, uniqueEmail);
      let duplicateCode: string | undefined;
      try {
        await insert("filled-2", uniqueEmail, uniqueEmail);
      } catch (error) {
        duplicateCode = (error as { code?: string }).code;
      }
      expect(duplicateCode).toBe("23505");
    } finally {
      await world.close();
    }
  });
});
