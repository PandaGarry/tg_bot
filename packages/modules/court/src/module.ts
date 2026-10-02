/**
 * Модуль двора: экономика и застройка города.
 *
 * Шаг C1 (фундамент): шесть ресурсов двора (мясо, дерево, камень, металл,
 * грибы-в-погребе, золото), сетка двора с Ратушей в центре и медленное
 * производство по такту. Постройки ставятся командой, вид построек —
 * обязанность сцены двора, а не этого модуля.
 *
 * Модуль ничего не пишет в базу сам: строку своей таблицы он отдаёт
 * эффектом, снимок читает через store.
 */

import { defineCommand, defineModule, type EffectList, type JsonValue } from "@tdl/kernel";
import { z } from "zod";
import { strings } from "./strings.js";

/** Сетка двора в клетках: 14×14 сейчас, расширяемо до 22×22. */
const GRID_SIZE = 14;
/** Центр сетки — здесь стоит Ратуша. */
const CENTER = Math.floor(GRID_SIZE / 2);
/** Период производственного такта. */
const TICK_MS = 60_000;
/** Максимум построек, защита от абсурда. */
const MAX_BUILDINGS = 60;

/** Вкладки режима строительства. */
type BuildTab = "economy" | "military" | "decor";

/**
 * Каталог построек: пятно [ширина, глубина] в клетках, вкладка, требование
 * и цена. Здания открываются постепенно — уровнем Ратуши (прокачка) и позже
 * расширением территории; всё, что не открыто, видно с замком.
 */
const CATALOG: Record<
  string,
  { size: [number, number]; tab: BuildTab; th: number; cost: Partial<Record<CourtResource, number>> }
> = {
  // экономика — жилые и хозяйские дома в один ряд: 2×2
  cottage: { size: [2, 2], tab: "economy", th: 1, cost: { wood: 50, stone: 20 } },
  farm: { size: [2, 2], tab: "economy", th: 1, cost: { wood: 60, stone: 30 } },
  sawmill: { size: [2, 2], tab: "economy", th: 2, cost: { wood: 80, stone: 40 } },
  quarry: { size: [2, 2], tab: "economy", th: 2, cost: { wood: 60, stone: 80 } },
  mine: { size: [2, 2], tab: "economy", th: 3, cost: { wood: 90, stone: 60, metal: 30 } },
  // военные
  barracks: { size: [2, 2], tab: "military", th: 3, cost: { wood: 150, stone: 120, metal: 40 } },
  // украшения — игрок ставит их сам, сцена ничего не приносит
  lantern: { size: [1, 1], tab: "decor", th: 1, cost: { wood: 10, gold: 5 } },
  bench: { size: [2, 1], tab: "decor", th: 1, cost: { wood: 15 } },
  well: { size: [2, 2], tab: "decor", th: 2, cost: { stone: 40, wood: 10 } },
  flag: { size: [1, 1], tab: "decor", th: 1, cost: { wood: 20, gold: 10 } },
};

const PLACEABLE = Object.keys(CATALOG).filter((id) => id !== "townhall");

/** Сколько клетки занимает постройка: [ширина, глубина]. */
const FOOTPRINT: Record<string, [number, number]> = {
  townhall: [3, 3],
  ...Object.fromEntries(PLACEABLE.map((id) => [id, CATALOG[id]?.size ?? ([1, 1] as [number, number])])),
};

/** Цена улучшения Ратуши: индекс — целевой уровень. */
const TH_COSTS: (Partial<Record<CourtResource, number>> | undefined)[] = [
  undefined,
  undefined,
  { wood: 300, stone: 250, gold: 50 },
  { wood: 600, stone: 500, metal: 100, gold: 150 },
  { wood: 1200, stone: 900, metal: 250, gold: 400 },
  { wood: 2400, stone: 1800, metal: 500, gold: 1000 },
];
/** Максимальный уровень Ратуши сейчас. */
const TH_MAX = TH_COSTS.length - 1;

/** Пределы хранения до модификаторов: склад и погреб отдельно. */
const LIMIT_BASE: Record<string, number> = {
  meat: 5_000,
  wood: 5_000,
  stone: 5_000,
  metal: 3_000,
  mushrooms: 2_000,
  gold: 100_000,
};

/** Прирост за такт до модификаторов: скромно, баланс придёт с постройками. */
const PRODUCTION_BASE: Record<CourtResource, number> = {
  meat: 10,
  wood: 12,
  stone: 8,
  metal: 4,
  mushrooms: 6,
  gold: 2,
};

/** Стартовый набор нового лорда. */
const STARTER: Record<CourtResource, number> = {
  meat: 600,
  wood: 600,
  stone: 400,
  metal: 200,
  mushrooms: 300,
  gold: 100,
};

const RESOURCES = ["meat", "wood", "stone", "metal", "mushrooms", "gold"] as const;
type CourtResource = (typeof RESOURCES)[number];

const zEmpty = z.object({}).strict();
/** Поворот постройки в четвертях оборота: 0 — вход на восток; нечётный поворот меняет местами ширину и глубину пятна. */
const zRot = z.number().int().min(0).max(3).default(0);
const zPlace = z
  .object({
    type: z.enum(PLACEABLE as [string, ...string[]]),
    x: z.number().int().min(0).max(GRID_SIZE - 1),
    z: z.number().int().min(0).max(GRID_SIZE - 1),
    rot: zRot,
  })
  .strict();
const zMove = z
  .object({
    type: z.enum(["townhall", ...PLACEABLE] as [string, ...string[]]),
    fromX: z.number().int().min(0).max(GRID_SIZE - 1),
    fromZ: z.number().int().min(0).max(GRID_SIZE - 1),
    toX: z.number().int().min(0).max(GRID_SIZE - 1),
    toZ: z.number().int().min(0).max(GRID_SIZE - 1),
    rot: zRot,
  })
  .strict();
const zRoad = z
  .object({
    x: z.number().int().min(0).max(GRID_SIZE - 1),
    z: z.number().int().min(0).max(GRID_SIZE - 1),
    remove: z.boolean().default(false),
    moveFrom: z
      .object({ x: z.number().int().min(0).max(GRID_SIZE - 1), z: z.number().int().min(0).max(GRID_SIZE - 1) })
      .optional(),
  })
  .strict();
const zRemove = z
  .object({
    type: z.enum(["townhall", ...PLACEABLE] as [string, ...string[]]),
    x: z.number().int().min(0).max(GRID_SIZE - 1),
    z: z.number().int().min(0).max(GRID_SIZE - 1),
  })
  .strict();

interface CourtBuilding {
  type: string;
  x: number;
  z: number;
  [key: string]: JsonValue;
}

/** Плита дороги: клетка двора. */
interface CourtRoad {
  x: number;
  z: number;
  [key: string]: JsonValue;
}

interface CourtGrid {
  size: number;
  buildings: CourtBuilding[];
  roads: CourtRoad[];
  [key: string]: JsonValue;
}

/** Стартовая дорога: от ворот (восток) до крыльца Ратуши. */
const ROAD_SEED: CourtRoad[] = Array.from({ length: 5 }, (_, i) => ({ x: 9 + i, z: 7 }));

interface CourtState {
  starter: number;
  townhallLevel: number;
  grid: CourtGrid | null;
}

function stateOf(state: unknown): CourtState {
  const value = (state ?? {}) as Partial<CourtState>;
  const grid = value.grid;
  return {
    starter: Number(value.starter ?? 0),
    townhallLevel: Number(value.townhallLevel ?? 1),
    grid:
      grid && Array.isArray(grid.buildings)
        ? {
            size: Number(grid.size ?? GRID_SIZE),
            buildings: grid.buildings,
            roads: Array.isArray(grid.roads) ? grid.roads : [],
          }
        : null,
  };
}

/** Патч-операция над строкой вида. */
interface StockOp {
  op: "add";
  path: string;
  value: number;
}

/** Хватает ли ресурсов на покупку (склад читается из контекста команды). */
function canAfford(stock: Readonly<Record<string, number>>, cost: Partial<Record<CourtResource, number>>): boolean {
  return (Object.entries(cost) as [CourtResource, number][]).every(
    ([resource, amount]) => (stock[resource] ?? 0) >= amount,
  );
}

/** Эффекты оплаты: списываем ресурсы со склада (хост отклонит нехватку). */
function payEffects(cost: Partial<Record<CourtResource, number>>, holderId: string): EffectList {
  return (Object.entries(cost) as [CourtResource, number][]).map(([resource, amount]) => ({
    kind: "stock" as const,
    resource,
    delta: -amount,
    target: holderId,
  }));
}

/** Патч-операции оплаты: вычитание в строке ресурсов вида. */
function payOps(cost: Partial<Record<CourtResource, number>>): StockOp[] {
  return (Object.entries(cost) as [CourtResource, number][]).map(([resource, amount]) => ({
    op: "add" as const,
    path: `stock.${resource}`,
    value: -amount,
  }));
}

/** Сетка по умолчанию: пустой двор с Ратушей в центре. */
function defaultGrid(): CourtGrid {
  return { size: GRID_SIZE, buildings: [{ type: "townhall", x: CENTER, z: CENTER }], roads: ROAD_SEED };
}

function gridOf(state: unknown): CourtGrid {
  return stateOf(state).grid ?? defaultGrid();
}

/** Клетки дорог набором «x:z». */
function roadKeys(roads: CourtRoad[]): Set<string> {
  return new Set(roads.map((road) => `${road.x}:${road.z}`));
}

/** Пятно постройки с учётом поворота: при нечётном повороте ширина и глубина меняются местами. */
function sizeFor(type: string, rot: unknown): [number, number] {
  const [w, h] = FOOTPRINT[type] ?? [1, 1];
  return Number(rot ?? 0) % 2 === 1 ? [h, w] : [w, h];
}

/** Клетки, занятые постройками с учётом их пятна. */
function footprintOf(buildings: CourtBuilding[]): Set<string> {
  const cells = new Set<string>();
  for (const building of buildings) {
    const [w, h] = sizeFor(building.type, building.rot);
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    for (let dx = -halfW; dx < w - halfW; dx += 1) {
      for (let dz = -halfH; dz < h - halfH; dz += 1) {
        cells.add(`${building.x + dx}:${building.z + dz}`);
      }
    }
  }
  return cells;
}

const tickDeadlineId = (holderId: string): string => `court.tick:${holderId}`;

const court = defineModule({
  id: "court",
  version: 1,
  kind: "core",
  content: { strings },
  rules: {
    resources: [
      { id: "meat", storage: "warehouse" },
      { id: "wood", storage: "warehouse" },
      { id: "stone", storage: "warehouse" },
      { id: "metal", storage: "warehouse" },
      { id: "mushrooms", storage: "cellar" },
      { id: "gold", storage: "warehouse" },
    ],
    modifiers: [
      {
        id: "court_limit",
        phase: "limit",
        priority: 20,
        apply: (input) => {
          if (input.resource === undefined) return {};
          const base = LIMIT_BASE[input.resource];
          return base === undefined ? {} : { add: base };
        },
      },
    ],
  },
  server: {
    tables: ["court_holder"],
    migrations: [
      {
        to: 1,
        sql: `CREATE TABLE IF NOT EXISTS court_holder (
          world_id text NOT NULL,
          holder_id text NOT NULL,
          starter integer NOT NULL DEFAULT 0,
          grid jsonb,
          updated_at_ms bigint NOT NULL DEFAULT 0,
          PRIMARY KEY (world_id, holder_id)
        )`,
      },
      {
        to: 2,
        sql: `ALTER TABLE court_holder ADD COLUMN IF NOT EXISTS townhall_level integer NOT NULL DEFAULT 1`,
      },
    ],
    snapshot: async ({ store, actor }): Promise<JsonValue> => {
      const holderId = actor?.id ?? "world";
      const rows = await store.read<{ starter: number; grid: CourtGrid | null; townhall_level: number }>(
        `SELECT starter, grid, townhall_level FROM court_holder WHERE world_id = $1 AND holder_id = $2`,
        [holderId],
      );
      const state = stateOf({ ...rows[0], townhallLevel: rows[0]?.townhall_level });
      const grid = state.grid ?? defaultGrid();
      // Уровень лорда растёт вместе с Ратушей; сила — видимый итог прогресса двора.
      const power = 120 * state.townhallLevel + 40 * (grid.buildings.length - 1) + 5 * grid.roads.length;
      return { starter: state.starter, townhallLevel: state.townhallLevel, level: state.townhallLevel, power, grid, holderId };
    },
    facts: {
      buildings: (state: unknown) => gridOf(state).buildings.length,
      courtSize: (state: unknown) => gridOf(state).size,
      townhallLevel: (state: unknown) => stateOf(state).townhallLevel,
    },
    commands: [
      defineCommand({
        id: "court.enter",
        input: zEmpty,
        handle: (ctx): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const grid = gridOf(ctx.state);
          const fresh = stateOf(ctx.state).starter === 0;
          const grants: EffectList = fresh
            ? RESOURCES.map((resource) => ({
                kind: "stock",
                resource,
                delta: STARTER[resource],
                target: holderId,
              }))
            : [];
          const stockOps = fresh
            ? RESOURCES.map((resource) => ({ op: "add" as const, path: `stock.${resource}`, value: STARTER[resource] }))
            : [];
          const report: EffectList = fresh
            ? [{ kind: "report", id: holderId, reportKind: "court", rows: [{ key: "court.report.welcome" }] }]
            : [];
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, grid, updated_at_ms: ctx.now },
            },
            ...grants,
            ...report,
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: grid }, ...stockOps],
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
      }),
      defineCommand({
        id: "court.place",
        input: zPlace,
        handle: (ctx, input): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const item = CATALOG[input.type];
          if (!item) return [];
          const grid = gridOf(ctx.state);
          const level = stateOf(ctx.state).townhallLevel;
          // Постройка ещё не открыта: уровень Ратуши не дотягивает.
          if (level < item.th) return [];
          if (!canAfford(ctx.stock, item.cost)) return [];
          if (grid.buildings.length >= MAX_BUILDINGS) return [];
          const [w, h] = sizeFor(input.type, input.rot);
          const halfW = Math.floor(w / 2);
          const halfH = Math.floor(h / 2);
          const fromX = -halfW;
          const toX = w - halfW - 1;
          const fromZ = -halfH;
          const toZ = h - halfH - 1;
          if (
            input.x + fromX < 0 ||
            input.z + fromZ < 0 ||
            input.x + toX > grid.size - 1 ||
            input.z + toZ > grid.size - 1
          ) {
            return [];
          }
          const busy = footprintOf(grid.buildings);
          const roads = roadKeys(grid.roads);
          for (let dx = fromX; dx <= toX; dx += 1) {
            for (let dz = fromZ; dz <= toZ; dz += 1) {
              const key = `${input.x + dx}:${input.z + dz}`;
              if (busy.has(key) || roads.has(key)) return [];
            }
          }
          const next: CourtGrid = {
            size: grid.size,
            buildings: [...grid.buildings, { type: input.type, x: input.x, z: input.z, ...(input.rot ? { rot: input.rot } : {}) }],
            roads: grid.roads,
          };
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, townhall_level: level, grid: next, updated_at_ms: ctx.now },
            },
            ...payEffects(item.cost, holderId),
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: next }, ...payOps(item.cost)],
            },
            {
              kind: "report",
              id: holderId,
              reportKind: "court",
              rows: [{ key: "court.report.placed", params: { building: `building.${input.type}` } }],
            },
            { kind: "journal", channel: "audit", event: "court.place", entity: holderId, detail: { ...input } },
          ];
        },
      }),
      defineCommand({
        id: "court.move",
        input: zMove,
        handle: (ctx, input): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const grid = gridOf(ctx.state);
          const index = grid.buildings.findIndex(
            (b) => b.type === input.type && b.x === input.fromX && b.z === input.fromZ,
          );
          if (index < 0) return [];
          const [w, h] = sizeFor(input.type, input.rot);
          const halfW = Math.floor(w / 2);
          const halfH = Math.floor(h / 2);
          const fromX = -halfW;
          const toX = w - halfW - 1;
          const fromZ = -halfH;
          const toZ = h - halfH - 1;
          if (
            input.toX + fromX < 0 ||
            input.toZ + fromZ < 0 ||
            input.toX + toX > grid.size - 1 ||
            input.toZ + toZ > grid.size - 1
          ) {
            return [];
          }
          const others = grid.buildings.filter((_, i) => i !== index);
          const busy = footprintOf(others);
          const roads = roadKeys(grid.roads);
          for (let dx = fromX; dx <= toX; dx += 1) {
            for (let dz = fromZ; dz <= toZ; dz += 1) {
              const key = `${input.toX + dx}:${input.toZ + dz}`;
              if (busy.has(key) || roads.has(key)) return [];
            }
          }
          const next: CourtGrid = {
            size: grid.size,
            buildings: [...others, { type: input.type, x: input.toX, z: input.toZ, ...(input.rot ? { rot: input.rot } : {}) }],
            roads: grid.roads,
          };
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, townhall_level: stateOf(ctx.state).townhallLevel, grid: next, updated_at_ms: ctx.now },
            },
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: next }],
            },
            { kind: "journal", channel: "audit", event: "court.move", entity: holderId, detail: { ...input } },
          ];
        },
      }),
      defineCommand({
        id: "court.remove",
        input: zRemove,
        handle: (ctx, input): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          // Сносится только декор: экономика, военные и Ратуша не убираются
          if (CATALOG[input.type]?.tab !== "decor") return [];
          const grid = gridOf(ctx.state);
          const index = grid.buildings.findIndex(
            (b) => b.type === input.type && b.x === input.x && b.z === input.z,
          );
          if (index < 0) return [];
          const next: CourtGrid = {
            size: grid.size,
            buildings: grid.buildings.filter((_, i) => i !== index),
            roads: grid.roads,
          };
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, townhall_level: stateOf(ctx.state).townhallLevel, grid: next, updated_at_ms: ctx.now },
            },
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: next }],
            },
            {
              kind: "report",
              id: holderId,
              reportKind: "court",
              rows: [{ key: "court.report.removed", params: { building: `building.${input.type}` } }],
            },
            { kind: "journal", channel: "audit", event: "court.remove", entity: holderId, detail: { ...input } },
          ];
        },
      }),
      defineCommand({
        id: "court.road",
        input: zRoad,
        handle: (ctx, input): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const grid = gridOf(ctx.state);
          const key = `${input.x}:${input.z}`;
          let roads: CourtRoad[];
          if (input.moveFrom) {
            // перенос плиты: убрать со старой клетки, положить на новую — одной командой
            const rest = grid.roads.filter(
              (road) => !(road.x === input.moveFrom!.x && road.z === input.moveFrom!.z),
            );
            if (rest.length === grid.roads.length) return [];
            if (roadKeys(rest).has(key) || footprintOf(grid.buildings).has(key)) return [];
            roads = [...rest, { x: input.x, z: input.z }];
          } else if (input.remove) {
            const rest = grid.roads.filter((road) => !(road.x === input.x && road.z === input.z));
            if (rest.length === grid.roads.length) return [];
            roads = rest;
          } else {
            if (roadKeys(grid.roads).has(key)) return [];
            // дорога не растёт под постройки
            if (footprintOf(grid.buildings).has(key)) return [];
            roads = [...grid.roads, { x: input.x, z: input.z }];
          }
          const next: CourtGrid = { size: grid.size, buildings: grid.buildings, roads };
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, townhall_level: stateOf(ctx.state).townhallLevel, grid: next, updated_at_ms: ctx.now },
            },
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: next }],
            },
            { kind: "journal", channel: "audit", event: "court.road", entity: holderId, detail: { ...input } },
          ];
        },
      }),
      defineCommand({
        id: "court.upgrade",
        input: zEmpty,
        handle: (ctx): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const level = stateOf(ctx.state).townhallLevel;
          const target = level + 1;
          const cost = TH_COSTS[target];
          if (target > TH_MAX || !cost) return [];
          if (!canAfford(ctx.stock, cost)) return [];
          return [
            {
              kind: "rows.upsert",
              table: "court_holder",
              key: { holder_id: holderId },
              value: { starter: 1, townhall_level: target, grid: gridOf(ctx.state), updated_at_ms: ctx.now },
            },
            ...payEffects(cost, holderId),
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.townhallLevel", value: target }, ...payOps(cost)],
            },
            {
              kind: "report",
              id: holderId,
              reportKind: "court",
              rows: [{ key: "court.report.upgraded", params: { level: target } }],
            },
            { kind: "journal", channel: "audit", event: "court.upgrade", entity: holderId, detail: { level: target } },
          ];
        },
      }),
    ],
  },
  client: {
    slots: [],
  },
  onDeadline: async (ctx): Promise<EffectList> => {
    const payload = (ctx.deadline.payload ?? {}) as { holderId?: string };
    const holderId = String(payload.holderId ?? ctx.actor?.id ?? "world");
    const production = RESOURCES.map((resource) => ({
      resource,
      amount: Math.round(ctx.modulate("production", PRODUCTION_BASE[resource], { resource, subject: "town" })),
    })).filter((entry) => entry.amount > 0);
    const effects: EffectList = [
      {
        kind: "patch",
        route: { kind: "actor", id: holderId },
        ops: production.map((entry) => ({ op: "add" as const, path: `stock.${entry.resource}`, value: entry.amount })),
      },
      ...production.map((entry) => ({
        kind: "stock" as const,
        resource: entry.resource,
        delta: entry.amount,
        target: holderId,
      })),
      {
        kind: "deadline.set",
        id: tickDeadlineId(holderId),
        wakeAt: ctx.now + TICK_MS,
        key: tickDeadlineId(holderId),
        payload: { holderId },
      },
    ];
    return effects;
  },
});

export default court;
