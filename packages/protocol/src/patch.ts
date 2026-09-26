/**
 * Патч вида. Патч собирается отдельно для получателя: чужой склад,
 * чужой состав марша и чужой гарнизон в чужой патч не попадают.
 */

import { z } from "zod";
import type { JsonValue, TileRef } from "@tdl/kernel";

/** Типы ядра, которыми пользуется и клиент: одни имена на обеих сторонах. */
export type { JsonObject, JsonValue, PatchOp, ReportRow, TileRef } from "@tdl/kernel";

export const zTile = z.object({ x: z.number().int(), y: z.number().int() });

export const zJsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(zJsonValue),
    z.record(z.string(), zJsonValue),
  ]),
) as z.ZodType<JsonValue>;

export const zPatchRoute = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("actor"), id: z.string().optional() }),
  z.object({ kind: z.literal("tiles"), tiles: z.array(zTile) }),
  z.object({ kind: z.literal("clan") }),
]);

export const zPatchOp = z.object({
  op: z.enum(["set", "del", "add"]),
  path: z.string().min(1).max(200),
  value: zJsonValue.optional(),
});

export const zPatch = z.object({
  route: zPatchRoute,
  ops: z.array(zPatchOp).max(500),
});

export type WirePatchOp = z.infer<typeof zPatchOp>;

/** Разбор пути: «modules.court.buildings.wood.level» → части. */
export function splitPath(path: string): string[] {
  return path.split(".").filter((part) => part.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Применяет операции к состоянию вида. Одна и та же функция на сервере
 * (для смотра админа) и на клиенте, поэтому поведение совпадает.
 */
export function applyOps<T extends Record<string, JsonValue>>(state: T, ops: readonly WirePatchOp[]): T {
  const root: Record<string, JsonValue> = structuredClone(state);
  for (const op of ops) {
    const parts = splitPath(op.path);
    if (parts.length === 0) continue;
    let cursor: Record<string, JsonValue> = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index] as string;
      const next = cursor[part];
      if (!isPlainObject(next)) {
        if (op.op === "del") {
          cursor = {};
          break;
        }
        const created: Record<string, JsonValue> = {};
        cursor[part] = created;
        cursor = created;
      } else {
        cursor = next;
      }
    }
    const last = parts[parts.length - 1] as string;
    if (op.op === "del") {
      delete cursor[last];
    } else if (op.op === "add") {
      const current = cursor[last];
      cursor[last] = typeof current === "number" && typeof op.value === "number" ? current + op.value : op.value ?? null;
    } else {
      cursor[last] = op.value ?? null;
    }
  }
  return root as T;
}

/** Клетки, которых касается патч: по ним считается, кому его отправлять. */
export function tilesOf(routes: readonly { kind: string; tiles?: TileRef[] }[]): TileRef[] {
  const seen = new Map<string, TileRef>();
  for (const route of routes) {
    for (const tile of route.tiles ?? []) seen.set(`${tile.x},${tile.y}`, tile);
  }
  return [...seen.values()];
}
