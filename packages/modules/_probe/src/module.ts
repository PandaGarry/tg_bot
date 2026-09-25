/**
 * Пробный модуль. Проверка фундамента: новый ресурс и модификатор фазы
 * появляются без правки ядра, а после удаления каталога и пересборки
 * реестра новые миры этого ресурса не имеют.
 *
 * Модуль ничего не пишет в базу сам: строку своей таблицы он отдаёт
 * эффектом, снимок читает через store.
 */

import { defineCommand, defineModule, type JsonObject } from "@tdl/kernel";
import { z } from "zod";
import { strings } from "./strings.js";

/** Период пробного срока. Число техническое: на баланс игры не влияет. */
const TICK_MS = 5 * 60_000;
/** Сколько пыли даёт один такт до модификаторов. */
const TICK_BASE = 50;
/** Сколько пыли даёт кнопка пробы. */
const POKE_BASE = 25;
/** Предел склада пробного модуля: постоянная полка, чтобы обрезка была видна. */
const LIMIT_BASE = 500;

const zEmpty = z.object({}).strict();
const zPoke = z.object({ steps: z.number().int().min(1).max(50).default(1) }).strict();

interface ProbeState {
  level: number;
  ticks: number;
}

function stateOf(state: unknown): ProbeState {
  const value = (state ?? {}) as Partial<ProbeState>;
  return { level: Number(value.level ?? 0), ticks: Number(value.ticks ?? 0) };
}

const tickDeadlineId = (holderId: string): string => `probe.tick:${holderId}`;

const probe = defineModule({
  id: "_probe",
  version: 1,
  kind: "core",
  content: { strings },
  rules: {
    resources: [{ id: "probe_dust", storage: "warehouse" }],
    modifiers: [
      {
        id: "probe_limit",
        phase: "limit",
        priority: 10,
        apply: (input, env) => {
          if (input.resource !== "probe_dust") return {};
          return { add: LIMIT_BASE };
        },
      },
      {
        id: "probe_production",
        phase: "production",
        priority: 10,
        apply: (input) => (input.resource === "probe_dust" ? { mul: 0.1 } : {}),
      },
    ],
  },
  server: {
    tables: ["probe_state"],
    migrations: [
      {
        to: 1,
        sql: `CREATE TABLE IF NOT EXISTS probe_state (
          world_id text NOT NULL,
          holder_id text NOT NULL,
          level integer NOT NULL DEFAULT 0,
          ticks integer NOT NULL DEFAULT 0,
          updated_at_ms bigint NOT NULL DEFAULT 0,
          PRIMARY KEY (world_id, holder_id)
        )`,
      },
    ],
    snapshot: async ({ store, actor }) => {
      const holderId = actor?.id ?? "world";
      const rows = await store.read<{ level: number; ticks: number }>(
        `SELECT level, ticks FROM probe_state WHERE world_id = $1 AND holder_id = $2`,
        [holderId],
      );
      const row = rows[0];
      return { level: Number(row?.level ?? 0), ticks: Number(row?.ticks ?? 0), holderId };
    },
    facts: {
      level: (state: unknown) => stateOf(state).level,
      ticks: (state: unknown) => stateOf(state).ticks,
    },
    commands: [
      defineCommand({
        id: "_probe.poke",
        input: zPoke,
        handle: (ctx, input) => {
          const state = stateOf(ctx.state);
          const production = Math.round(ctx.modulate("production", POKE_BASE * input.steps, { resource: "probe_dust" }));
          const level = state.level + input.steps;
          const holderId = ctx.actor?.id ?? "world";
          return [
            {
              kind: "rows.upsert",
              table: "probe_state",
              key: { holder_id: holderId },
              value: { level, ticks: state.ticks, updated_at_ms: ctx.now },
            },
            { kind: "stock", resource: "probe_dust", delta: production, target: holderId },
            {
              kind: "report",
              id: holderId,
              reportKind: "probe",
              rows: [{ key: "probe.report.poke", params: { amount: production } }],
            },
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [
                { op: "set", path: "modules._probe.level", value: level },
                { op: "add", path: "stock.probe_dust", value: production },
              ],
            },
            { kind: "journal", channel: "audit", event: "probe.poke", entity: holderId, detail: { level } },
            {
              kind: "deadline.set",
              id: tickDeadlineId(holderId),
              wakeAt: ctx.now + TICK_MS,
              key: tickDeadlineId(holderId),
              payload: { holderId, level },
            },
          ];
        },
      }),
      defineCommand({
        id: "_probe.hush",
        input: zEmpty,
        handle: (ctx) => [
          { kind: "journal", channel: "audit", event: "probe.hush" },
          { kind: "disable", module: "_probe" },
          {
            kind: "report",
            id: ctx.actor?.id ?? "world",
            reportKind: "probe",
            rows: [{ key: "probe.hushed" }],
          },
        ],
      }),
    ],
  },
  client: {
    slots: [{ slot: "sheet", id: "probe.sheet", order: 900 }],
  },
  onDeadline: async (ctx) => {
    const payload = (ctx.deadline.payload ?? {}) as JsonObject;
    const holderId = String(payload.holderId ?? ctx.actor?.id ?? "world");
    const state = stateOf(
      (
        await ctx.store.read<{ level: number; ticks: number }>(
          `SELECT level, ticks FROM probe_state WHERE world_id = $1 AND holder_id = $2`,
          [holderId],
        )
      )[0],
    );
    // Такт считается через фазу производства: модификатор виден в числе.
    const production = Math.round(ctx.modulate("production", TICK_BASE, { resource: "probe_dust", subject: "court" }));
    return [
      {
        kind: "rows.upsert",
        table: "probe_state",
        key: { holder_id: holderId },
        value: { level: state.level, ticks: state.ticks + 1, updated_at_ms: ctx.now },
      },
      { kind: "stock", resource: "probe_dust", delta: production, target: holderId },
      {
        kind: "report",
        id: holderId,
        reportKind: "probe",
        rows: [{ key: "probe.report.tick", params: { amount: production } }],
      },
      {
        kind: "patch",
        route: { kind: "actor", id: holderId },
        ops: [
          { op: "set", path: "modules._probe.ticks", value: state.ticks + 1 },
          { op: "add", path: "stock.probe_dust", value: production },
        ],
      },
      {
        kind: "deadline.set",
        id: tickDeadlineId(holderId),
        wakeAt: ctx.now + TICK_MS,
        key: tickDeadlineId(holderId),
        payload: { holderId },
      },
    ];
  },
});

export default probe;
