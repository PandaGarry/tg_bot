/**
 * Применение эффектов. Ядро пишет всё одной транзакцией: сбой откатывает
 * и склад, и срок, и запись в журнал. Модуль в базу не пишет.
 */

import {
  mergeStockEffects,
  normalizeLimit,
  gatheredAmount,
  type ActorFacts,
  type Effect,
  type FailEffect,
  type JsonValue,
  type ModuleId,
  type RowsDeleteEffect,
  type RowsUpsertEffect,
  type PatchOp,
  type PatchRoute,
  type ReportRow,
  type ResourceId,
  type TileRef,
} from "@tdl/kernel";
import { KERNEL_KEYS, zPatch } from "@tdl/protocol";
import { CommandRejected } from "../db/index.js";
import type { Journal } from "../logger.js";
import type { QueryClient } from "./store.js";

export interface AppliedPatch {
  route: PatchRoute;
  ops: PatchOp[];
}

export interface AppliedReport {
  id: string;
  kind: string;
  rows: ReportRow[];
}

export interface ApplyResult {
  patches: AppliedPatch[];
  reports: AppliedReport[];
  /** Сколько ресурса не влезло в предел склада. */
  clamped: { holderId: string; resource: ResourceId; kept: number; limit: number }[];
  disabledModules: ModuleId[];
}

/** Строка служебного расхождения: пишется в той же транзакции, что и мир. */
export interface SimFact {
  reason: string;
  actorId: string | null;
  deadlineId: string | null;
  claimed: JsonValue;
  computed: JsonValue;
  extra: JsonValue;
}

export interface ApplyParams {
  client: QueryClient;
  /** Таблицы, объявленные модулем: в чужие ядро писать не даёт. */
  tablesOf(moduleId: ModuleId): ReadonlySet<string>;
  worldId: string;
  now: number;
  moduleId: ModuleId;
  actor: ActorFacts | null;
  journal: Journal;
  requestId: string;
  commandId: string | null;
  idempotencyKey: string;
  /** Предел склада: считается фазой limit. null — предела нет. */
  limitOf(holderId: string, resource: ResourceId): number | null | Promise<number | null>;
  /**
   * Куда складываются расхождения. Отказ откатывает игровую транзакцию,
   * а след отказа пишется после отката: поэтому строки копятся здесь.
   */
  simFacts: SimFact[];
}

const REPORT_KEEP = 100;

function failOf(effects: readonly Effect[]): FailEffect | null {
  for (const effect of effects) {
    if (effect.kind === "error") return effect;
  }
  return null;
}

function holderOf(target: string | undefined, actor: ActorFacts | null): string {
  return target ?? actor?.id ?? "world";
}

function integer(value: number, what: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new CommandRejected(KERNEL_KEYS.generic, {
      channel: "sim",
      params: { what },
    });
  }
  return value;
}

interface SimDetail {
  claimed?: JsonValue;
  computed?: JsonValue;
  deadlineId?: string;
  actorId?: string;
  extra?: JsonValue;
}

async function writeSimRows(params: ApplyParams, facts: readonly SimFact[]): Promise<void> {
  for (const fact of facts) {
    await params.client.query(
      `INSERT INTO sim_rejections (world_id, actor_id, module_id, deadline_id, request_id, reason, claimed, computed, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.worldId,
        fact.actorId,
        params.moduleId,
        fact.deadlineId,
        params.requestId,
        fact.reason,
        fact.claimed === undefined ? null : JSON.stringify(fact.claimed),
        fact.computed === undefined ? null : JSON.stringify(fact.computed),
        JSON.stringify({ commandId: params.commandId, idempotencyKey: params.idempotencyKey, extra: fact.extra ?? null }),
      ],
    );
  }
}

/** Расхождение: журнал сразу, строка — вместе с транзакцией шага. */
function noteSim(params: ApplyParams, reason: string, detail: SimDetail = {}): void {
  params.simFacts.push({
    reason,
    actorId: detail.actorId ?? params.actor?.id ?? null,
    deadlineId: detail.deadlineId ?? null,
    claimed: detail.claimed ?? null,
    computed: detail.computed ?? null,
    extra: detail.extra ?? null,
  });
  params.journal.write({
    channel: "sim",
    worldId: params.worldId,
    actorId: params.actor?.id,
    moduleId: params.moduleId,
    requestId: params.requestId,
    event: reason,
    detail: detail.extra ?? null,
  });
}

const IDENT = /^[a-z][a-z0-9_]*$/;

function asParam(value: JsonValue | undefined): unknown {
  if (value === undefined) return null;
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

/** Строки таблицы модуля: имена колонок проверяются, значения идут параметрами. */
async function applyRowsUpsert(params: ApplyParams, effect: RowsUpsertEffect): Promise<void> {
  const allowed = params.tablesOf(params.moduleId);
  if (!allowed.has(effect.table)) {
    noteSim(params, "rows.table", { claimed: effect.table });
    throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
  }
  const keyColumns = Object.keys(effect.key);
  if (keyColumns.length === 0) {
    noteSim(params, "rows.key", { claimed: effect.table });
    throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
  }
  const valueColumns = Object.keys(effect.value).filter((column) => !keyColumns.includes(column));
  for (const column of [...keyColumns, ...valueColumns]) {
    if (!IDENT.test(column) || column === "world_id") {
      noteSim(params, "rows.column", { claimed: column, extra: { table: effect.table } });
      throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
    }
  }
  const columns = ["world_id", ...keyColumns, ...valueColumns];
  const values = [
    params.worldId,
    ...keyColumns.map((column) => asParam(effect.key[column])),
    ...valueColumns.map((column) => asParam(effect.value[column])),
  ];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const conflict = ["world_id", ...keyColumns];
  const updates = valueColumns.map((column) => `${column} = EXCLUDED.${column}`);
  const sql = `INSERT INTO ${effect.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
    ON CONFLICT (${conflict.join(", ")}) DO UPDATE SET ${updates.length > 0 ? updates.join(", ") : "world_id = EXCLUDED.world_id"}`;
  await params.client.query(sql, values);
}

async function applyRowsDelete(params: ApplyParams, effect: RowsDeleteEffect): Promise<void> {
  const allowed = params.tablesOf(params.moduleId);
  const keyColumns = Object.keys(effect.key);
  for (const column of [effect.table, ...keyColumns]) {
    if (!IDENT.test(column) || column === "world_id") {
      noteSim(params, "rows.column", { claimed: column });
      throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
    }
  }
  if (!allowed.has(effect.table) || keyColumns.length === 0) {
    noteSim(params, "rows.table", { claimed: effect.table });
    throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
  }
  const where = ["world_id = $1", ...keyColumns.map((column, index) => `${column} = $${index + 2}`)];
  await params.client.query(`DELETE FROM ${effect.table} WHERE ${where.join(" AND ")}`, [
    params.worldId,
    ...keyColumns.map((column) => asParam(effect.key[column])),
  ]);
}

/** Отчёт: строки уходят игроку и ложатся в базу, старые вытесняются. */
async function pushReport(
  params: ApplyParams,
  result: ApplyResult,
  report: { id: string; kind: string; rows: ReportRow[] },
): Promise<void> {
  const rows = report.rows.filter((row) => row.key.length > 0);
  if (rows.length === 0) return;
  result.reports.push({ id: report.id, kind: report.kind, rows });
  await params.client.query(
    `INSERT INTO reports (world_id, lord_id, kind, at_ms, body) VALUES ($1, $2, $3, $4, $5)`,
    [params.worldId, report.id, report.kind, params.now, JSON.stringify({ rows })],
  );
  // Отчёт хранится не бесконечно: 100 последних на игрока.
  await params.client.query(
    `DELETE FROM reports WHERE world_id = $1 AND lord_id = $2 AND id NOT IN (
       SELECT id FROM reports WHERE world_id = $1 AND lord_id = $2 ORDER BY id DESC LIMIT $3
     )`,
    [params.worldId, report.id, REPORT_KEEP],
  );
}

/** Склад: ресурсы целые, минус невозможен, предел обрезает. */
async function applyStock(
  params: ApplyParams,
  deltas: readonly { holderId: string; resource: ResourceId; delta: number }[],
  result: ApplyResult,
): Promise<void> {
  for (const delta of deltas) {
    if (delta.delta === 0) continue;
    integer(delta.delta, "stock.delta");
    const written = await params.client.query(
      `INSERT INTO stock (world_id, holder_id, resource_id, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (world_id, holder_id, resource_id)
       DO UPDATE SET amount = stock.amount + EXCLUDED.amount
       RETURNING amount`,
      [params.worldId, delta.holderId, delta.resource, delta.delta],
    );
    const amount = Number(written.rows[0]?.amount ?? 0);
    if (amount < 0) {
      throw new CommandRejected(KERNEL_KEYS.insufficient, {
        params: { resource: delta.resource },
        channel: "sim",
      });
    }
    const limit = await params.limitOf(delta.holderId, delta.resource);
    if (limit !== null && amount > limit) {
      const kept = normalizeLimit(limit);
      await params.client.query(
        `UPDATE stock SET amount = $4 WHERE world_id = $1 AND holder_id = $2 AND resource_id = $3`,
        [params.worldId, delta.holderId, delta.resource, kept],
      );
      result.clamped.push({ holderId: delta.holderId, resource: delta.resource, kept, limit });
      noteSim(params, "stock.clamped", {
        actorId: delta.holderId,
        claimed: amount,
        computed: { kept, limit },
      });
    }
  }
}

export async function applyEffects(params: ApplyParams, effects: readonly Effect[]): Promise<ApplyResult> {
  const fail = failOf(effects);
  if (fail) {
    throw new CommandRejected(fail.key, { params: fail.params, channel: "audit" });
  }

  const result: ApplyResult = { patches: [], reports: [], clamped: [], disabledModules: [] };

  // Склад одним куском: один ресурс — одна строка.
  const stockEffects = effects.filter((effect) => effect.kind === "stock");
  if (stockEffects.length > 0) {
    const merged = mergeStockEffects(stockEffects);
    await applyStock(
      params,
      merged.map((effect) => ({
        holderId: holderOf(effect.target, params.actor),
        resource: effect.resource,
        delta: effect.delta,
      })),
      result,
    );
  }

  for (const effect of effects) {
    switch (effect.kind) {
      case "stock":
        break;

      case "rows.upsert": {
        await applyRowsUpsert(params, effect);
        break;
      }

      case "rows.delete": {
        await applyRowsDelete(params, effect);
        break;
      }

      case "gather.start": {
        if (!Number.isFinite(effect.speedPerHour) || effect.speedPerHour < 0) {
          noteSim(params, "gather.start.speed", { claimed: effect.speedPerHour });
          throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
        }
        integer(effect.startedAtMs, "gather.startedAtMs");
        integer(effect.stockLeft, "gather.stockLeft");
        integer(effect.capacity, "gather.capacity");
        await params.client.query(
          `INSERT INTO gathers (gather_id, world_id, module_id, holder_id, resource_id, speed_per_hour, started_at_ms, stock_left, capacity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (world_id, gather_id) DO UPDATE SET
             module_id = EXCLUDED.module_id,
             holder_id = EXCLUDED.holder_id,
             resource_id = EXCLUDED.resource_id,
             speed_per_hour = EXCLUDED.speed_per_hour,
             started_at_ms = EXCLUDED.started_at_ms,
             stock_left = EXCLUDED.stock_left,
             capacity = EXCLUDED.capacity`,
          [
            effect.id,
            params.worldId,
            params.moduleId,
            holderOf(effect.target, params.actor),
            effect.resource,
            effect.speedPerHour,
            effect.startedAtMs,
            effect.stockLeft,
            effect.capacity,
          ],
        );
        break;
      }

      case "gather.claim": {
        integer(effect.endedAtMs, "gather.endedAtMs");
        integer(effect.stockLeftNow, "gather.stockLeftNow");
        const row = (
          await params.client.query(
            `SELECT holder_id, resource_id, speed_per_hour, started_at_ms, stock_left, capacity
             FROM gathers WHERE world_id = $1 AND gather_id = $2`,
            [params.worldId, effect.id],
          )
        ).rows[0];
        if (!row) {
          noteSim(params, "gather.claim.missing", { claimed: effect.id });
          break;
        }
        const startedAtMs = Number(row.started_at_ms);
        const speed = Number(row.speed_per_hour);
        const stockLeftAtStart = Number(row.stock_left);
        const capacity = Number(row.capacity);
        const resource = String(row.resource_id);
        const holderId = effect.target ?? String(row.holder_id);
        const stockLeftNow = Math.max(0, Math.floor(effect.stockLeftNow));
        // Остаток точки берётся меньший из двух: точка могла отдать часть другому маршу.
        const computed = gatheredAmount(
          speed,
          Math.max(0, effect.endedAtMs - startedAtMs),
          Math.min(stockLeftAtStart, stockLeftNow),
          capacity,
        );
        await params.client.query(`DELETE FROM gathers WHERE world_id = $1 AND gather_id = $2`, [
          params.worldId,
          effect.id,
        ]);
        if (effect.claimed !== undefined && effect.claimed !== computed) {
          noteSim(params, "gather.claim.mismatch", {
            actorId: holderId,
            claimed: effect.claimed,
            computed: { amount: computed, speed, startedAtMs, endedAtMs: effect.endedAtMs },
          });
        }
        if (computed > 0) {
          await applyStock(params, [{ holderId, resource, delta: computed }], result);
          await pushReport(params, result, {
            id: holderId,
            kind: "gather",
            rows: [{ key: "kernel.report.gathered", params: { resource, amount: computed } }],
          });
        }
        break;
      }

      case "gather.cancel": {
        await params.client.query(`DELETE FROM gathers WHERE world_id = $1 AND gather_id = $2`, [
          params.worldId,
          effect.id,
        ]);
        break;
      }

      case "deadline.set": {
        const wakeAt = effect.wakeAt;
        if (!Number.isSafeInteger(wakeAt)) throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
        if (effect.id.length === 0 || effect.key.length === 0) {
          throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
        }
        if (wakeAt <= params.now) {
          // Срок в прошлом крутил бы проход без конца. Событие проводится сразу.
          noteSim(params, "deadline.past", { claimed: wakeAt, computed: params.now });
          throw new CommandRejected(KERNEL_KEYS.generic, { channel: "sim" });
        }
        // Ключ идемпотентности уникален на мир: тот же срок не встаёт второй строкой.
        await params.client.query(
          `DELETE FROM deadlines WHERE world_id = $1 AND key = $2 AND id <> $3`,
          [params.worldId, effect.key, effect.id],
        );
        await params.client.query(
          `INSERT INTO deadlines (id, world_id, owner, wake_at_ms, key, payload, created_at_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (world_id, id) DO UPDATE SET
             owner = EXCLUDED.owner,
             wake_at_ms = EXCLUDED.wake_at_ms,
             key = EXCLUDED.key,
             payload = EXCLUDED.payload`,
          [
            effect.id,
            params.worldId,
            params.moduleId,
            wakeAt,
            effect.key,
            effect.payload === undefined ? null : JSON.stringify(effect.payload),
            params.now,
          ],
        );
        break;
      }

      case "deadline.cancel": {
        await params.client.query(`DELETE FROM deadlines WHERE world_id = $1 AND id = $2 AND owner = $3`, [
          params.worldId,
          effect.id,
          params.moduleId,
        ]);
        break;
      }

      case "journal": {
        params.journal.write({
          channel: effect.channel,
          worldId: params.worldId,
          actorId: params.actor?.id,
          moduleId: params.moduleId,
          requestId: params.requestId,
          event: effect.event,
          entity: effect.entity,
          detail: effect.detail,
        });
        if (effect.channel === "audit") {
          await params.client.query(
            `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, entity, outcome, idempotency_key, detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              params.worldId,
              params.actor?.id ?? null,
              params.moduleId,
              params.requestId,
              params.commandId,
              effect.entity ?? null,
              effect.event,
              params.idempotencyKey,
              effect.detail === undefined ? null : JSON.stringify(effect.detail),
            ],
          );
        }
        if (effect.channel === "sim") {
          noteSim(params, effect.event, { claimed: effect.detail });
        }
        break;
      }

      case "report": {
        await pushReport(params, result, {
          id: effect.id ?? params.actor?.id ?? "world",
          kind: effect.reportKind,
          rows: effect.rows,
        });
        break;
      }

      case "patch": {
        const parsed = zPatch.safeParse({ route: effect.route, ops: effect.ops });
        if (!parsed.success) {
          noteSim(params, "patch.invalid", { claimed: effect.route.kind });
          break;
        }
        result.patches.push(parsed.data as AppliedPatch);
        break;
      }

      case "disable": {
        await params.client.query(
          `UPDATE module_states SET state = 'disabled' WHERE world_id = $1 AND module_id = $2`,
          [params.worldId, effect.module],
        );
        result.disabledModules.push(effect.module);
        params.journal.write({
          channel: "audit",
          worldId: params.worldId,
          moduleId: effect.module,
          requestId: params.requestId,
          event: "module.disabled",
        });
        await params.client.query(
          `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, entity, outcome, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            params.worldId,
            params.actor?.id ?? null,
            effect.module,
            params.requestId,
            params.commandId,
            effect.module,
            "module.disabled",
            params.idempotencyKey,
          ],
        );
        break;
      }

      case "error":
        break;
    }
  }

  // Строки расхождений ложатся той же транзакцией, что и изменение мира.
  await writeSimRows(params, params.simFacts);
  return result;
}

/** Клетки, которых касается патч: по ним считается, кому его отправлять. */
export function tilesOfPatches(patches: readonly AppliedPatch[]): TileRef[] {
  const seen = new Map<string, TileRef>();
  for (const patch of patches) {
    if (patch.route.kind !== "tiles") continue;
    for (const tile of patch.route.tiles) seen.set(`${tile.x},${tile.y}`, tile);
  }
  return [...seen.values()];
}
