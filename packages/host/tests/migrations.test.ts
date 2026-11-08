/** Регрессия: миграции изолированы по миру и сериализованы между процессами. */
import type { ModuleDefinition } from "@tdl/kernel";
import { describe, expect, it } from "vitest";
import { applyModuleMigrations, syncModuleStates } from "../src/db/bootstrap.js";
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
});
