import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_SIZE } from '@ashfall/rules';

const here = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.ASHFALL_DATA
  ? resolve(process.env.ASHFALL_DATA)
  : resolve(here, '../../../data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(resolve(DATA_DIR, 'ashfall.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  nick TEXT NOT NULL UNIQUE,
  house TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS worlds (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  requires_town_hall INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  world_id INTEGER NOT NULL,
  nick TEXT NOT NULL,
  house TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT -1,
  y INTEGER NOT NULL DEFAULT -1,
  food REAL NOT NULL DEFAULT 0,
  wood REAL NOT NULL DEFAULT 0,
  stone REAL NOT NULL DEFAULT 0,
  iron REAL NOT NULL DEFAULT 0,
  ember REAL NOT NULL DEFAULT 0,
  last_tick INTEGER NOT NULL DEFAULT 0,
  kvk_ember REAL NOT NULL DEFAULT 0,
  power INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  migrate_ready_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  player_id TEXT NOT NULL,
  key TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  upgrading_to INTEGER,
  finish_at INTEGER,
  PRIMARY KEY (player_id, key)
);

CREATE TABLE IF NOT EXISTS troops (
  player_id TEXT PRIMARY KEY,
  infantry INTEGER NOT NULL DEFAULT 0,
  archers INTEGER NOT NULL DEFAULT 0,
  cavalry INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  count INTEGER NOT NULL,
  finish_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  world_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT,
  resource TEXT,
  amount REAL,
  node_updated_at INTEGER,
  infantry INTEGER NOT NULL DEFAULT 0,
  archers INTEGER NOT NULL DEFAULT 0,
  cavalry INTEGER NOT NULL DEFAULT 0,
  occupied_by TEXT,
  occupied_at INTEGER,
  garrison_ready_at INTEGER,
  power INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marches (
  id TEXT PRIMARY KEY,
  world_id INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  phase TEXT NOT NULL,
  from_x INTEGER NOT NULL,
  from_y INTEGER NOT NULL,
  to_x INTEGER NOT NULL,
  to_y INTEGER NOT NULL,
  target_id TEXT,
  infantry INTEGER NOT NULL DEFAULT 0,
  archers INTEGER NOT NULL DEFAULT 0,
  cavalry INTEGER NOT NULL DEFAULT 0,
  depart_at INTEGER NOT NULL,
  arrive_at INTEGER NOT NULL,
  cargo_food REAL,
  cargo_wood REAL,
  cargo_stone REAL,
  cargo_iron REAL,
  cargo_ember REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  world_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS intel (
  player_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  scouted_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entities_world ON entities(world_id);
CREATE INDEX IF NOT EXISTS idx_players_world ON players(world_id);
CREATE INDEX IF NOT EXISTS idx_marches_arrive ON marches(arrive_at);
CREATE INDEX IF NOT EXISTS idx_training_finish ON training(finish_at);
CREATE INDEX IF NOT EXISTS idx_buildings_finish ON buildings(finish_at);
`);

export const WORLD_DEFS = [
  { id: 1, kind: 'home', name: 'К-1 · Северный Пепел', seed: 1337, requiresTownHall: 0 },
  { id: 2, kind: 'home', name: 'К-2 · Угольный Предел', seed: 2048, requiresTownHall: 0 },
  { id: 3, kind: 'kvk', name: 'Пылающий предел (KvK)', seed: 555, requiresTownHall: 3 },
] as const;

export function seedWorlds(): void {
  const existing = q1<{ c: number }>('SELECT COUNT(*) AS c FROM worlds');
  if ((existing?.c ?? 0) >= WORLD_DEFS.length) return;
  for (const w of WORLD_DEFS) {
    run(
      'INSERT OR REPLACE INTO worlds (id, kind, name, size, seed, requires_town_hall) VALUES (?, ?, ?, ?, ?, ?)',
      w.id,
      w.kind,
      w.name,
      WORLD_SIZE,
      w.seed,
      w.requiresTownHall,
    );
  }
}

/* ─────────────────  Утилиты запросов  ───────────────── */

export function q<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function q1<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): { changes: number } {
  const res = db.prepare(sql).run(...(params as never[])) as { changes: number };
  return res;
}

export function newId(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export interface PlayerRow {
  id: string;
  account_id: string;
  world_id: number;
  nick: string;
  house: string;
  x: number;
  y: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
  ember: number;
  last_tick: number;
  kvk_ember: number;
  power: number;
  is_bot: number;
  migrate_ready_at: number;
  created_at: number;
}

export interface EntityRow {
  id: string;
  world_id: number;
  kind: string;
  x: number;
  y: number;
  level: number;
  owner_id: string | null;
  resource: string | null;
  amount: number | null;
  node_updated_at: number | null;
  infantry: number;
  archers: number;
  cavalry: number;
  occupied_by: string | null;
  occupied_at: number | null;
  garrison_ready_at: number | null;
  power: number;
  created_at: number;
}

export interface MarchRow {
  id: string;
  world_id: number;
  player_id: string;
  kind: string;
  phase: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  target_id: string | null;
  infantry: number;
  archers: number;
  cavalry: number;
  depart_at: number;
  arrive_at: number;
  cargo_food: number | null;
  cargo_wood: number | null;
  cargo_stone: number | null;
  cargo_iron: number | null;
  cargo_ember: number | null;
  created_at: number;
}

export interface WorldRow {
  id: number;
  kind: string;
  name: string;
  size: number;
  seed: number;
  requires_town_hall: number;
}
