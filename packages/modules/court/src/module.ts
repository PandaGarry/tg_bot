/**
 * Модуль двора: экономика и застройка города.
 *
 * Шаг 2 замены court (решено 14.10): постройки — из каталога `@tdl/content-buildings`
 * (docs/design/buildings.md), центр двора — Цитадель, сетка растёт по полосам
 * Цитадели. Декор (фонарь, скамья, колодец, флаг) не трогаем — он не из каталога зданий.
 *
 * Модуль ничего не пишет в базу сам: строку своей таблицы он отдаёт
 * эффектом, снимок читает через store.
 */

import { defineCommand, defineModule, type EffectList, type JsonValue } from "@tdl/kernel";
import { buildingById, buildings } from "@tdl/content-buildings/catalog";
import { openCount } from "@tdl/content-buildings/layout";
import { z } from "zod";
import {
  CITADEL,
  MAX_GRID,
  cellsOf,
  citadelAnchor,
  defaultRoads,
  fitsGrid,
  gridSizeAt,
  levelCost,
  sizeOf,
  startGridSize,
} from "./grid.js";
import { strings } from "./strings.js";

/** Период производственного такта. */
const TICK_MS = 60_000;
/** Максимум построек, защита от абсурда. */
const MAX_BUILDINGS = 60;
/** Версия формата сетки: старые сохранения (до шага 2) сбрасываются при чтении. */
const GRID_VERSION = 2;

/** Декор двора: пятно, требование уровня Цитадели и цена. Не из каталога зданий. */
const DECOR: Record<string, { size: [number, number]; th: number; cost: Partial<Record<CourtResource, number>> }> = {
  lantern: { size: [1, 1], th: 1, cost: { wood: 10, gold: 5 } },
  bench: { size: [2, 1], th: 1, cost: { wood: 15 } },
  well: { size: [2, 2], th: 2, cost: { stone: 40, wood: 10 } },
  flag: { size: [1, 1], th: 1, cost: { wood: 20, gold: 10 } },
};
const DECOR_SIZES: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(DECOR).map(([id, def]) => [id, def.size]),
);

/** Постройки, которые можно ставить: каталог без Цитадели и без зданий с нераспределённой ценой (Таверна). */
const PLACEABLE_BUILDINGS = buildings.filter((b) => b.id !== CITADEL && !b.costOpen).map((b) => b.id);
const PLACEABLE = [...PLACEABLE_BUILDINGS, ...Object.keys(DECOR)];

/** Пределы хранения до модификаторов. Погреба нет: склад единственный (решено 14.10). */
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

const coord = () => z.number().int().min(0).max(MAX_GRID - 1);

const zEmpty = z.object({}).strict();
const zPlace = z
  .object({
    type: z.enum(PLACEABLE as [string, ...string[]]),
    x: coord(),
    z: coord(),
  })
  .strict();
const zMove = z
  .object({
    type: z.enum([CITADEL, ...PLACEABLE] as [string, ...string[]]),
    fromX: coord(),
    fromZ: coord(),
    toX: coord(),
    toZ: coord(),
  })
  .strict();
const zRoad = z
  .object({
    x: coord(),
    z: coord(),
    remove: z.boolean().default(false),
    moveFrom: z.object({ x: coord(), z: coord() }).optional(),
  })
  .strict();
const zRemove = z
  .object({
    type: z.enum(Object.keys(DECOR) as [string, ...string[]]),
    x: coord(),
    z: coord(),
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
  /** Версия формата сетки (GRID_VERSION). */
  v: number;
  [key: string]: JsonValue;
}

interface CourtState {
  starter: number;
  /** Уровень Цитадели (имя поля сохранено от Ратуши, см. DECISIONS 14.10). */
  townhallLevel: number;
  grid: CourtGrid | null;
}

function defaultGrid(): CourtGrid {
  const size = startGridSize();
  const anchor = citadelAnchor(size);
  return {
    size,
    buildings: [{ type: CITADEL, x: anchor.x, z: anchor.z }],
    roads: defaultRoads(size).map((road) => ({ ...road })),
    v: GRID_VERSION,
  };
}

function stateOf(state: unknown): CourtState {
  const value = (state ?? {}) as Partial<CourtState>;
  const grid = value.grid;
  // Старый формат (до шага 2) — не читаем: двор начинается заново, уровень Цитадели 1.
  const current = grid && Array.isArray(grid.buildings) && grid.v === GRID_VERSION;
  if (!current) {
    return { starter: Number(value.starter ?? 0), townhallLevel: 1, grid: null };
  }
  return {
    starter: Number(value.starter ?? 0),
    townhallLevel: Number(value.townhallLevel ?? 1),
    grid: {
      size: Number(grid.size),
      buildings: grid.buildings,
      roads: Array.isArray(grid.roads) ? grid.roads : [],
      v: GRID_VERSION,
    },
  };
}

/** Патч-операция над строкой вида. */
interface StockOp {
  op: "add";
  path: string;
  value: number;
}

type Cost = Partial<Record<CourtResource, number>>;

/** Хватает ли ресурсов на покупку (склад читается из контекста команды). */
function canAfford(stock: Readonly<Record<string, number>>, cost: Cost): boolean {
  return (Object.entries(cost) as [CourtResource, number][]).every(
    ([resource, amount]) => (stock[resource] ?? 0) >= amount,
  );
}

/** Эффекты оплаты: списываем ресурсы со склада (хост отклонит нехватку). */
function payEffects(cost: Cost, holderId: string): EffectList {
  return (Object.entries(cost) as [CourtResource, number][]).map(([resource, amount]) => ({
    kind: "stock" as const,
    resource,
    delta: -amount,
    target: holderId,
  }));
}

/** Патч-операции оплаты: вычитание в строке ресурсов вида. */
function payOps(cost: Cost): StockOp[] {
  return (Object.entries(cost) as [CourtResource, number][]).map(([resource, amount]) => ({
    op: "add" as const,
    path: `stock.${resource}`,
    value: -amount,
  }));
}

function gridOf(state: unknown): CourtGrid {
  return stateOf(state).grid ?? defaultGrid();
}

/** Клетки дорог набором «x:z». */
function roadKeys(roads: CourtRoad[]): Set<string> {
  return new Set(roads.map((road) => `${road.x}:${road.z}`));
}

/** Клетки, занятые постройками с учётом их пятна. */
function footprintOf(buildings: CourtBuilding[]): Set<string> {
  const cells = new Set<string>();
  for (const building of buildings) {
    for (const key of cellsOf(building.x, building.z, sizeOf(building.type, DECOR_SIZES))) cells.add(key);
  }
  return cells;
}

function countOf(type: string, buildingsList: CourtBuilding[]): number {
  return buildingsList.filter((b) => b.type === type).length;
}

/**
 * Цена постановки или `null`, если постройка сейчас не открыта.
 * Здание — по лимиту уровня Цитадели; декор — по порогу уровня.
 */
function placementCost(type: string, citadel: number, buildingsList: CourtBuilding[]): Cost | null {
  const decor = DECOR[type];
  if (decor) return citadel >= decor.th ? decor.cost : null;
  const def = buildingById(type);
  if (!def) return null;
  if (openCount(def, citadel) <= countOf(type, buildingsList)) return null;
  return levelCost(type, 1);
}

/** Сохранение сетки: одна строка на двор, как и раньше. */
function gridRow(holderId: string, level: number, grid: CourtGrid, now: number) {
  return {
    kind: "rows.upsert" as const,
    table: "court_holder",
    key: { holder_id: holderId },
    value: { starter: 1, townhall_level: level, grid, updated_at_ms: now },
  };
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
      { id: "mushrooms", storage: "warehouse" },
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
      {
        // Шаг 2 замены court: сохранённые дворы сбрасываются (решено 14.10). Запасы не трогаем.
        to: 3,
        sql: `UPDATE court_holder SET grid = NULL, townhall_level = 1`,
      },
    ],
    snapshot: async ({ store, actor }): Promise<JsonValue> => {
      const holderId = actor?.id ?? "world";
      const rows = await store.read<{ starter: number; grid: CourtGrid | null; townhall_level: number }>(
        `SELECT starter, grid, townhall_level FROM court_holder WHERE world_id = $1 AND holder_id = $2`,
        [holderId],
      );
      const state = stateOf({ ...rows[0], grid: rows[0]?.grid, townhallLevel: rows[0]?.townhall_level });
      const grid = state.grid ?? defaultGrid();
      // Уровень лорда растёт вместе с Цитаделью; сила — видимый итог прогресса двора.
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
              ops: [
                { op: "set", path: "modules.court.grid", value: grid },
                { op: "set", path: "modules.court.townhallLevel", value: stateOf(ctx.state).townhallLevel },
                ...stockOps,
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
      }),
      defineCommand({
        id: "court.place",
        input: zPlace,
        handle: (ctx, input): EffectList => {
          const holderId = ctx.actor?.id ?? "world";
          const grid = gridOf(ctx.state);
          const level = stateOf(ctx.state).townhallLevel;
          const cost = placementCost(input.type, level, grid.buildings);
          if (!cost) return [];
          if (!canAfford(ctx.stock, cost)) return [];
          if (grid.buildings.length >= MAX_BUILDINGS) return [];
          const size = sizeOf(input.type, DECOR_SIZES);
          if (!fitsGrid(input.x, input.z, size, grid.size)) return [];
          const busy = footprintOf(grid.buildings);
          const roads = roadKeys(grid.roads);
          for (const key of cellsOf(input.x, input.z, size)) {
            if (busy.has(key) || roads.has(key)) return [];
          }
          const next: CourtGrid = {
            ...grid,
            buildings: [...grid.buildings, { type: input.type, x: input.x, z: input.z }],
          };
          return [
            gridRow(holderId, level, next, ctx.now),
            ...payEffects(cost, holderId),
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [{ op: "set", path: "modules.court.grid", value: next }, ...payOps(cost)],
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
          const size = sizeOf(input.type, DECOR_SIZES);
          if (!fitsGrid(input.toX, input.toZ, size, grid.size)) return [];
          const others = grid.buildings.filter((_, i) => i !== index);
          const busy = footprintOf(others);
          const roads = roadKeys(grid.roads);
          for (const key of cellsOf(input.toX, input.toZ, size)) {
            if (busy.has(key) || roads.has(key)) return [];
          }
          const next: CourtGrid = {
            ...grid,
            buildings: [...others, { type: input.type, x: input.toX, z: input.toZ }],
          };
          return [
            gridRow(holderId, stateOf(ctx.state).townhallLevel, next, ctx.now),
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
          // Сносится только декор: здания и Цитадель не убираются
          if (!DECOR[input.type]) return [];
          const grid = gridOf(ctx.state);
          const index = grid.buildings.findIndex(
            (b) => b.type === input.type && b.x === input.x && b.z === input.z,
          );
          if (index < 0) return [];
          const next: CourtGrid = {
            ...grid,
            buildings: grid.buildings.filter((_, i) => i !== index),
          };
          return [
            gridRow(holderId, stateOf(ctx.state).townhallLevel, next, ctx.now),
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
          const next: CourtGrid = { ...grid, roads };
          return [
            gridRow(holderId, stateOf(ctx.state).townhallLevel, next, ctx.now),
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
          const cost = levelCost(CITADEL, target);
          if (!cost || target > (buildingById(CITADEL)?.maxLevel ?? 0)) return [];
          if (!canAfford(ctx.stock, cost)) return [];
          const grid = gridOf(ctx.state);
          // сетка растёт по полосам Цитадели и не уменьшается
          const next: CourtGrid = { ...grid, size: gridSizeAt(target, grid.size) };
          return [
            gridRow(holderId, target, next, ctx.now),
            ...payEffects(cost, holderId),
            {
              kind: "patch",
              route: { kind: "actor" },
              ops: [
                { op: "set", path: "modules.court.townhallLevel", value: target },
                { op: "set", path: "modules.court.grid", value: next },
                ...payOps(cost),
              ],
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
