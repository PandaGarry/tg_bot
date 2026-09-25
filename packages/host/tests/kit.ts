/**
 * Сборочные модули для проверки ядра. Ядро не знает имён игры: имена команд,
 * ресурсов и таблиц здесь выдуманы, и это доказывает, что правил в ядре нет.
 * Каждый модуль показывает ровно один край контракта.
 */

import { defineCommand, defineModule, type Effect, type ModuleDefinition } from "@tdl/kernel";
import { z } from "zod";

const strings = { ru: { "kit.note": "проверка" }, en: { "kit.note": "probe" } };

const zNone = z.object({}).strict();
const zCount = z.object({ count: z.number().int().min(1).max(1_000) }).strict();
const zHolder = z.object({ holder: z.string().min(1).max(64) }).strict();
const zDeadline = z
  .object({
    id: z.string().min(1).max(64),
    key: z.string().min(1).max(64),
    inMs: z.number().int().min(1).max(86_400_000),
  })
  .strict();
const zDeadlineMode = z.object({ mode: z.enum(["ok", "throw", "refuse"]) }).strict();
const zTiles = z.object({ tiles: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1).max(10) }).strict();
const zBigPatch = z.object({ bytes: z.number().int().min(1).max(200_000) }).strict();
const zReport = z
  .object({
    id: z.string().min(1).max(64).optional(),
    kind: z.string().min(1).max(32),
    /** Ключ строки: пустая строка проверяет фильтр ядра. */
    rowKey: z.string().max(64).optional(),
  })
  .strict();

/** Модуль краёв: ошибки, отказы, чужие таблицы, сроки. */
export function kitModule(overrides: { id?: string; onDeadline?: ModuleDefinition["onDeadline"] } = {}): ModuleDefinition {
  return defineModule({
    id: overrides.id ?? "_kit",
    version: 1,
    content: { strings },
    rules: { resources: [{ id: "kit_dust", storage: "warehouse" }] },
    server: {
      tables: ["kit_state"],
      migrations: [
        {
          to: 1,
          sql: `CREATE TABLE IF NOT EXISTS kit_state (
            world_id text NOT NULL,
            holder_id text NOT NULL,
            marks integer NOT NULL DEFAULT 0,
            PRIMARY KEY (world_id, holder_id)
          )`,
        },
      ],
      snapshot: async ({ store, actor }) => {
        const rows = await store.read<{ marks: number }>(
          `SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = $2`,
          [actor?.id ?? "world"],
        );
        return { marks: Number(rows[0]?.marks ?? 0) };
      },
      commands: [
        defineCommand({
          id: "_kit.mark",
          input: zCount,
          handle: (ctx, input) => {
            const holderId = ctx.actor?.id ?? "world";
            return [
              {
                kind: "rows.upsert",
                table: "kit_state",
                key: { holder_id: holderId },
                value: { marks: input.count },
              },
              { kind: "stock", resource: "kit_dust", delta: input.count },
              { kind: "patch", route: { kind: "actor" }, ops: [{ op: "set", path: "modules._kit.marks", value: input.count }] },
            ];
          },
        }),
        // Маршруты патчей: игроку, плиткам, клану. Ядро решает, кому что уходит.
        defineCommand({
          id: "_kit.tile-touch",
          input: zTiles,
          handle: (_, input) => [
            { kind: "patch", route: { kind: "tiles", tiles: input.tiles }, ops: [{ op: "set", path: "tiles.kit", value: input.tiles.length }] },
          ],
        }),
        defineCommand({
          id: "_kit.clan-touch",
          input: zNone,
          handle: () => [{ kind: "patch", route: { kind: "clan" }, ops: [{ op: "set", path: "clan.kit", value: 1 }] }],
        }),
        // Большой патч: проверка предела буфера отправки у медленного клиента.
        defineCommand({
          id: "_kit.big-patch",
          input: zBigPatch,
          handle: (_, input) => [
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules._kit.blob", value: "x".repeat(input.bytes) }],
            },
          ],
        }),
        defineCommand({
          id: "_kit.actor-touch",
          input: zHolder,
          handle: (_, input) => [
            { kind: "patch", route: { kind: "actor", id: input.holder }, ops: [{ op: "set", path: "modules._kit.marks", value: 7 }] },
          ],
        }),
        defineCommand({
          id: "_kit.report",
          input: zReport,
          handle: (_, input) => [
            { kind: "report", id: input.id, reportKind: input.kind, rows: [{ key: input.rowKey ?? "kit.note" }] },
          ],
        }),
        defineCommand({
          id: "_kit.crash",
          input: zNone,
          handle: () => {
            throw new Error("модуль сломался");
          },
        }),
        defineCommand({
          id: "_kit.refuse",
          input: zNone,
          handle: () => [
            { kind: "stock", resource: "kit_dust", delta: 100 },
            { kind: "error", key: "kit.note" },
          ],
        }),
        defineCommand({
          id: "_kit.foreign-table",
          input: zNone,
          handle: () => [
            { kind: "rows.upsert", table: "probe_state", key: { holder_id: "x" }, value: { level: 1 } },
          ],
        }),
        defineCommand({
          id: "_kit.world-column",
          input: zNone,
          handle: () => [
            { kind: "rows.upsert", table: "kit_state", key: { world_id: "чужой" }, value: { marks: 1 } },
          ],
        }),
        defineCommand({
          id: "_kit.bad-column",
          input: zNone,
          handle: () => [
            { kind: "rows.upsert", table: "kit_state", key: { "holder_id; drop table stock": "x" }, value: { marks: 1 } },
          ],
        }),
        defineCommand({
          id: "_kit.spend",
          input: zCount,
          handle: (ctx, input) => [{ kind: "stock", resource: "kit_dust", delta: -Math.abs(input.count) }],
        }),
        defineCommand({
          id: "_kit.gift",
          input: zHolder,
          handle: (_, input) => [{ kind: "stock", resource: "probe_dust", delta: 20_000, target: input.holder }],
        }),
        defineCommand({
          id: "_kit.bad-patch",
          input: zNone,
          handle: () => [
            { kind: "patch", route: { kind: "actor" }, ops: [{ op: "set", path: "", value: 1 }] },
            { kind: "stock", resource: "kit_dust", delta: 1 },
          ],
        }),
        defineCommand({
          id: "_kit.plan",
          input: zDeadline,
          handle: (ctx, input) => [{ kind: "deadline.set", id: input.id, key: input.key, wakeAt: ctx.now + input.inMs, payload: {} }],
        }),
        defineCommand({
          id: "_kit.cancel",
          input: zDeadline,
          handle: (_, input) => [{ kind: "deadline.cancel", id: input.id }],
        }),
        defineCommand({
          id: "_kit.step",
          input: zNone,
          handle: async (ctx) => {
            // Чтение своей таблицы в транзакции шага: прибавление с подсчётом.
            const holderId = ctx.actor?.id ?? "world";
            const rows = await ctx.store.read<{ marks: number }>(
              `SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = $2`,
              [holderId],
            );
            const marks = Number(rows[0]?.marks ?? 0) + 1;
            return [
              { kind: "rows.upsert", table: "kit_state", key: { holder_id: holderId }, value: { marks } },
              { kind: "stock", resource: "kit_dust", delta: 1 },
              { kind: "patch", route: { kind: "actor" }, ops: [{ op: "add", path: "stock.kit_dust", value: 1 }] },
            ];
          },
        }),
        // Попытка погасить соседа: ядро обязано это отвергнуть.
        defineCommand({
          id: "_kit.off-probe",
          input: zNone,
          handle: () => [{ kind: "disable", module: "_probe" }],
        }),
        defineCommand({
          id: "_kit.off",
          input: zNone,
          handle: () => [{ kind: "disable", module: "_kit" }],
        }),
        defineCommand({
          id: "_kit.plan-mode",
          input: zDeadlineMode,
          handle: (ctx, input) => [
            {
              kind: "deadline.set",
              id: `kit.${input.mode}`,
              key: `kit.${input.mode}`,
              wakeAt: ctx.now + 1_000,
              payload: { mode: input.mode },
            },
          ],
        }),
      ],
    },
    onDeadline: overrides.onDeadline ?? (async (ctx) => {
      const payload = (ctx.deadline.payload ?? {}) as { mode?: string };
      if (payload.mode === "throw") throw new Error("срок сломался");
      if (payload.mode === "refuse") return [{ kind: "error", key: "kit.note" }];
      if (payload.mode === "count") {
        const rows = await ctx.store.read<{ marks: number }>(
          `SELECT marks FROM kit_state WHERE world_id = $1 AND holder_id = $2`,
          ["world"],
        );
        const marks = Number(rows[0]?.marks ?? 0) + 1;
        return [
          { kind: "journal", channel: "audit", event: "kit.deadline", entity: ctx.deadline.id },
          { kind: "rows.upsert", table: "kit_state", key: { holder_id: "world" }, value: { marks } },
        ];
      }
      return [
        { kind: "journal", channel: "audit", event: "kit.deadline", entity: ctx.deadline.id },
        {
          kind: "rows.upsert",
          table: "kit_state",
          key: { holder_id: "world" },
          value: { marks: 1 },
        },
        { kind: "stock", resource: "kit_dust", delta: 5 },
        { kind: "patch", route: { kind: "actor", id: ctx.actor?.id ?? "world" }, ops: [{ op: "add", path: "stock.kit_dust", value: 5 }] },
      ] satisfies Effect[];
    }),
  });
}

/**
 * Модуль с дурным чтением: снимок пробует писать и забывает первым
 * параметром world_id. Ядро обязано отказать и не пустить это в базу.
 */
export function badReadModule(): ModuleDefinition {
  return defineModule({
    id: "_badread",
    version: 1,
    content: { strings },
    server: {
      tables: ["read_state"],
      migrations: [
        {
          to: 1,
          sql: `CREATE TABLE IF NOT EXISTS read_state (
            world_id text NOT NULL,
            holder_id text NOT NULL,
            marks integer NOT NULL DEFAULT 0,
            PRIMARY KEY (world_id, holder_id)
          )`,
        },
      ],
      snapshot: async ({ store, actor }) => {
        // Пишущий запрос: ядро пропускать не должно.
        await store.read(`DELETE FROM read_state WHERE world_id = $1`);
        // Второй запрос без $1: world_id не подставлен.
        await store.read(`SELECT marks FROM read_state WHERE holder_id = $2`, [actor?.id ?? "world"]);
        return { marks: 1 };
      },
      commands: [
        defineCommand({ id: "_badread.poke", input: zNone, handle: () => [] }),
      ],
    },
  });
}

/** Второй модуль: проверка границ между модулями и занятых id. */
export function otherKitModule(): ModuleDefinition {
  return defineModule({
    id: "_other",
    version: 1,
    content: { strings },
    server: {
      commands: [
        defineCommand({ id: "_other.poke", input: zNone, handle: () => [] }),
      ],
    },
  });
}
