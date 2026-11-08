/** Регрессия: миграция двора не должна менять данные соседнего мира. */
import { describe, expect, it } from "vitest";
import { applyModuleMigrations } from "../src/db/bootstrap.js";
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
});
