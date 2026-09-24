/**
 * Симуляция мира. Один процесс = один писатель на мир (single-writer-per-world),
 * вся логика — в «редьюсерах» поверх SQLite. Никаких тиков в 100 мс: ресурсы
 * считаются лениво, а тик (500 мс) разбирает только события с наступившим временем.
 */
import {
  BUILDING_KEYS,
  CAMP_GARRISON,
  CAMP_LOOT,
  CAMP_LEVELS,
  KVK_TOWN_HALL_REQUIRED,
  MIGRATION_COOLDOWN_SEC,
  NODE_INFO,
  RESOURCE_KEYS,
  START_BUILDINGS,
  START_RESOURCES,
  TERRAIN_INFO,
  WELL_EMBER_PER_MINUTE,
  WORLD_SIZE,
  accrue,
  armyPower,
  buildingCost,
  buildingTime,
  canAfford,
  canUpgrade,
  estimateOdds,
  gatherSeconds,
  generateMap,
  lootCapacity,
  missingResources,
  pay,
  playerPower,
  productionPerSecond,
  resolveBattle,
  spawnCandidates,
  storageCap,
  terrainAt,
  travelSeconds,
  unitCost,
  unitTrainTime,
} from '@ashfall/rules';
import type {
  BuildingKey,
  EntityKind,
  HouseKey,
  MarchKind,
  ResourceKey,
  Resources,
  Troops,
  UnitKey,
  WorldKind,
} from '@ashfall/rules';
import type {
  BuildingView,
  EntityView,
  LeaderRow,
  MarchView,
  Patch,
  PlayerView,
  ReportView,
  Snapshot,
  Toast,
  WorldInfo,
} from '@ashfall/shared';
import { TERRAIN_CODES } from '@ashfall/rules';
import {
  db,
  newId,
  q,
  q1,
  run,
  seedWorlds,
  type EntityRow,
  type MarchRow,
  type PlayerRow,
  type WorldRow,
} from './db';

seedWorlds();

/** Жар за единицу мощи убитых: PvP весомее, PvE не должен кормить в одиночку. */
const EMBER_PER_KILLED_POWER = { pve: 0.03, well: 0.06, pvp: 0.12 } as const;

/* ─────────────────  Шина событий  ───────────────── */

type WorldSink = (worldId: number, patch: Patch) => void;
type PlayerSink = (playerId: string, patch: Patch) => void;

const worldSinks: WorldSink[] = [];
const playerSinks: PlayerSink[] = [];

export function onWorldPatch(fn: WorldSink): void {
  worldSinks.push(fn);
}
export function onPlayerPatch(fn: PlayerSink): void {
  playerSinks.push(fn);
}

function emitWorld(worldId: number, patch: Patch): void {
  for (const fn of worldSinks) fn(worldId, patch);
}
function emitPlayer(playerId: string, patch: Patch): void {
  for (const fn of playerSinks) fn(playerId, patch);
}
function toast(playerId: string, kind: Toast['kind'], text: string): void {
  emitPlayer(playerId, { now: Date.now(), toasts: [{ kind, text }] });
}

/* ─────────────────  Миры  ───────────────── */

const mapCache = new Map<number, string>();

export function getWorld(id: number): WorldRow {
  const w = q1<WorldRow>('SELECT * FROM worlds WHERE id = ?', id);
  if (!w) throw new Error(`Нет мира ${id}`);
  return w;
}

export function listWorlds(): WorldInfo[] {
  return q<WorldRow & { players: number }>(
    `SELECT w.*, (SELECT COUNT(*) FROM players p WHERE p.world_id = w.id AND p.x >= 0) AS players
     FROM worlds w ORDER BY w.id`,
  ).map((w) => ({
    id: w.id,
    kind: w.kind as WorldKind,
    name: w.name,
    size: w.size,
    seed: w.seed,
    players: w.players,
    requiresTownHall: w.requires_town_hall,
  }));
}

export function worldMapBase64(worldId: number): string {
  const cached = mapCache.get(worldId);
  if (cached) return cached;
  const w = getWorld(worldId);
  const bytes = generateMap(w.seed, w.kind as WorldKind, w.size);
  const b64 = Buffer.from(bytes).toString('base64');
  mapCache.set(worldId, b64);
  return b64;
}

export function isBuildableTile(worldId: number, x: number, y: number): boolean {
  const w = getWorld(worldId);
  if (x < 1 || y < 1 || x >= w.size - 1 || y >= w.size - 1) return false;
  return TERRAIN_INFO[terrainAt(w.seed, w.kind as WorldKind, x, y)].buildable;
}

/* ─────────────────  Игрок: чтение  ───────────────── */

export function loadPlayer(id: string): PlayerRow {
  const p = q1<PlayerRow>('SELECT * FROM players WHERE id = ?', id);
  if (!p) throw new Error('Игрок не найден');
  return p;
}

export function loadBuildings(
  playerId: string,
): Map<BuildingKey, { level: number; upgradingTo: number | null; finishAt: number | null }> {
  const rows = q<{ key: string; level: number; upgrading_to: number | null; finish_at: number | null }>(
    'SELECT key, level, upgrading_to, finish_at FROM buildings WHERE player_id = ?',
    playerId,
  );
  const map = new Map<
    BuildingKey,
    { level: number; upgradingTo: number | null; finishAt: number | null }
  >();
  for (const r of rows) {
    map.set(r.key as BuildingKey, {
      level: r.level,
      upgradingTo: r.upgrading_to ?? null,
      finishAt: r.finish_at ?? null,
    });
  }
  return map;
}

function buildingLevels(playerId: string): Partial<Record<BuildingKey, number>> {
  const out: Partial<Record<BuildingKey, number>> = {};
  for (const [key, v] of loadBuildings(playerId)) out[key] = v.level;
  return out;
}

export function loadTroops(playerId: string): Troops {
  const t = q1<{ infantry: number; archers: number; cavalry: number }>(
    'SELECT * FROM troops WHERE player_id = ?',
    playerId,
  );
  return t
    ? { infantry: t.infantry, archers: t.archers, cavalry: t.cavalry }
    : { infantry: 0, archers: 0, cavalry: 0 };
}

function saveTroops(playerId: string, troops: Troops): void {
  run(
    `INSERT INTO troops (player_id, infantry, archers, cavalry) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET infantry = excluded.infantry,
       archers = excluded.archers, cavalry = excluded.cavalry`,
    playerId,
    troops.infantry,
    troops.archers,
    troops.cavalry,
  );
}

/** Ленивое начисление ресурсов: вызывается перед любым чтением/изменением кошелька. */
export function accruePlayer(row: PlayerRow, now: number): {
  resources: Resources;
  rates: Resources;
  cap: number;
} {
  const levels = buildingLevels(row.id);
  const rates = productionPerSecond(levels, row.house as HouseKey);
  const cap = storageCap(levels.warehouse ?? 1);
  const current: Resources = {
    food: row.food,
    wood: row.wood,
    stone: row.stone,
    iron: row.iron,
    ember: row.ember,
  };
  const result = accrue(current, rates, row.last_tick || now, now, cap);
  run(
    'UPDATE players SET food = ?, wood = ?, stone = ?, iron = ?, last_tick = ? WHERE id = ?',
    result.resources.food,
    result.resources.wood,
    result.resources.stone,
    result.resources.iron,
    result.updatedAt,
    row.id,
  );
  return { resources: result.resources, rates, cap };
}

export function refreshPower(playerId: string): number {
  const power = playerPower(buildingLevels(playerId), loadTroops(playerId));
  run('UPDATE players SET power = ? WHERE id = ?', power, playerId);
  return power;
}

export function playerView(playerId: string, now: number): PlayerView {
  const row = loadPlayer(playerId);
  const { resources, rates, cap } = accruePlayer(row, now);
  const buildingsMap = loadBuildings(playerId);
  const buildings: BuildingView[] = BUILDING_KEYS.map((key) => {
    const b = buildingsMap.get(key);
    return {
      key,
      level: b?.level ?? 0,
      upgradingTo: b?.upgradingTo ?? null,
      finishAt: b?.finishAt ?? null,
    };
  });
  const troops = loadTroops(playerId);
  const training = q<{ unit: string; count: number; finish_at: number }>(
    'SELECT unit, count, finish_at FROM training WHERE player_id = ? ORDER BY finish_at',
    playerId,
  ).map((t) => ({ unit: t.unit as UnitKey, count: t.count, finishAt: t.finish_at }));

  const marches = q<MarchRow>(
    'SELECT * FROM marches WHERE player_id = ? ORDER BY created_at',
    playerId,
  ).map((m) => marchView(m));

  const thLevel = buildingsMap.get('town_hall')?.level ?? 1;

  return {
    id: row.id,
    nick: row.nick,
    house: row.house as HouseKey,
    worldId: row.world_id,
    x: row.x,
    y: row.y,
    resources,
    rates,
    storageCap: cap,
    power: row.power,
    kvkEmber: row.kvk_ember,
    buildings,
    troops,
    training,
    marches,
    marchSlots: 1 + Math.floor(thLevel / 2),
    migrateReadyAt: row.migrate_ready_at,
    isBot: row.is_bot === 1,
  };
}

function marchView(m: MarchRow): MarchView {
  const owner = q1<{ nick: string }>('SELECT nick FROM players WHERE id = ?', m.player_id);
  const target = m.target_id
    ? q1<{ kind: string }>('SELECT kind FROM entities WHERE id = ?', m.target_id)
    : undefined;
  const cargo =
    m.cargo_food === null
      ? null
      : {
          food: m.cargo_food ?? 0,
          wood: m.cargo_wood ?? 0,
          stone: m.cargo_stone ?? 0,
          iron: m.cargo_iron ?? 0,
          ember: m.cargo_ember ?? 0,
        };
  return {
    id: m.id,
    kind: m.kind as MarchKind,
    phase: m.phase as 'outbound' | 'returning',
    fromX: m.from_x,
    fromY: m.from_y,
    toX: m.to_x,
    toY: m.to_y,
    targetId: m.target_id,
    troops: { infantry: m.infantry, archers: m.archers, cavalry: m.cavalry },
    departAt: m.depart_at,
    arriveAt: m.arrive_at,
    returnAt: null,
    cargo,
    ownerId: m.player_id,
    ownerNick: owner?.nick ?? null,
    targetKind: (target?.kind as EntityKind) ?? null,
  };
}

/* ─────────────────  Сущности карты  ───────────────── */

interface EntityJoinRow extends EntityRow {
  nick: string | null;
  owner_house: string | null;
  owner_power: number | null;
}

function loadEntities(worldId: number): EntityJoinRow[] {
  return q<EntityJoinRow>(
    `SELECT e.*, p.nick AS nick, p.house AS owner_house, p.power AS owner_power
     FROM entities e LEFT JOIN players p ON p.id = e.owner_id
     WHERE e.world_id = ?`,
    worldId,
  );
}

function entityView(r: EntityJoinRow): EntityView {
  const kind = r.kind as EntityKind;
  const troops = { infantry: r.infantry, archers: r.archers, cavalry: r.cavalry };
  const hasTroops = troops.infantry + troops.archers + troops.cavalry > 0;
  return {
    id: r.id,
    kind,
    x: r.x,
    y: r.y,
    level: r.level,
    ownerId: r.owner_id,
    ownerNick: r.nick,
    house: (r.owner_house as HouseKey) ?? null,
    resource: (r.resource as ResourceKey) ?? null,
    amount: r.amount,
    // гарнизон города скрыт: узнаётся разведкой (отчёт), гарнизон лагеря/колодца виден
    garrison: kind === 'city' ? null : hasTroops ? troops : null,
    power: kind === 'city' ? (r.owner_power ?? 0) : armyPower(troops),
    emberRate: kind === 'well' ? WELL_EMBER_PER_MINUTE : null,
    lastScoutedAt: null,
  };
}

const entitySig = new Map<number, Map<string, string>>();

/** Дифф по миру: клиентам уезжают только изменившиеся сущности. */
export function diffEntities(worldId: number): { changed: EntityView[]; removed: string[] } {
  const rows = loadEntities(worldId);
  const cache = entitySig.get(worldId) ?? new Map<string, string>();
  const changed: EntityView[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const view = entityView(row);
    const sig = JSON.stringify(view);
    seen.add(row.id);
    if (cache.get(row.id) !== sig) {
      cache.set(row.id, sig);
      changed.push(view);
    }
  }
  const removed: string[] = [];
  for (const id of [...cache.keys()]) {
    if (!seen.has(id)) {
      cache.delete(id);
      removed.push(id);
    }
  }
  entitySig.set(worldId, cache);
  return { changed, removed };
}

export function entitiesOf(worldId: number): EntityView[] {
  return loadEntities(worldId).map(entityView);
}

/* ─────────────────  Отчёты и рейтинг  ───────────────── */

export function addReport(
  playerId: string,
  worldId: number,
  type: ReportView['type'],
  title: string,
  data: Record<string, unknown>,
): void {
  const id = newId('r');
  const now = Date.now();
  run(
    'INSERT INTO reports (id, player_id, world_id, type, title, data, created_at, read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    id,
    playerId,
    worldId,
    type,
    title,
    JSON.stringify(data),
    now,
  );
  emitPlayer(playerId, { now, reports: listReports(playerId) });
}

export function listReports(playerId: string): ReportView[] {
  return q<{
    id: string;
    type: string;
    title: string;
    data: string;
    created_at: number;
    read: number;
  }>('SELECT id, type, title, data, created_at, read FROM reports WHERE player_id = ? ORDER BY created_at DESC LIMIT 40', playerId).map(
    (r) => ({
      id: r.id,
      type: r.type as ReportView['type'],
      title: r.title,
      data: JSON.parse(r.data) as Record<string, unknown>,
      createdAt: r.created_at,
      read: r.read,
    }),
  );
}

export function leaders(scope: 'world' | 'kvk', worldId: number): LeaderRow[] {
  const worldName = getWorld(worldId).name;
  if (scope === 'kvk') {
    return q<{
      id: string;
      nick: string;
      house: string;
      world_id: number;
      power: number;
      kvk_ember: number;
      is_bot: number;
    }>(
      `SELECT id, nick, house, world_id, power, kvk_ember, is_bot FROM players
       WHERE kvk_ember > 0 ORDER BY kvk_ember DESC LIMIT 25`,
    ).map((p) => ({
      id: p.id,
      nick: p.nick,
      house: p.house as HouseKey,
      worldId: p.world_id,
      worldName: p.world_id === worldId ? worldName : getWorld(p.world_id).name,
      power: p.power,
      kvkEmber: p.kvk_ember,
      isBot: p.is_bot === 1,
    }));
  }
  return q<{
    id: string;
    nick: string;
    house: string;
    world_id: number;
    power: number;
    kvk_ember: number;
    is_bot: number;
  }>(
    `SELECT id, nick, house, world_id, power, kvk_ember, is_bot FROM players
     WHERE world_id = ? AND x >= 0 ORDER BY power DESC LIMIT 25`,
    worldId,
  ).map((p) => ({
    id: p.id,
    nick: p.nick,
    house: p.house as HouseKey,
    worldId: p.world_id,
    worldName,
    power: p.power,
    kvkEmber: p.kvk_ember,
    isBot: p.is_bot === 1,
  }));
}

/* ─────────────────  Снапшот  ───────────────── */

export function snapshotFor(playerId: string, now: number): Snapshot {
  const player = playerView(playerId, now);
  const worldId = player.worldId;
  return {
    now,
    world: listWorlds().find((w) => w.id === worldId)!,
    worlds: listWorlds(),
    player,
    entities: entitiesOf(worldId),
    map: worldMapBase64(worldId),
    terrainLegend: TERRAIN_CODES,
    leaders: leaders(worldId === 3 ? 'kvk' : 'world', worldId),
    reports: listReports(playerId),
    entityCount: entitiesOf(worldId).length,
  };
}

/* ─────────────────  Команды  ───────────────── */

export class CommandError extends Error {}

export function registerPlayer(nick: string, house: HouseKey): { token: string; playerId: string } {
  const clean = nick.trim().slice(0, 18);
  if (clean.length < 2) throw new CommandError('Имя короче двух символов');
  if (!/^[\p{L}\p{N}_ \-]+$/u.test(clean)) {
    throw new CommandError('В имени только буквы, цифры, пробел, дефис и подчёркивание');
  }
  const existing = q1<{ id: string; token: string }>('SELECT id, token FROM accounts WHERE nick = ?', clean);
  if (existing) {
    const p = q1<{ id: string }>('SELECT id FROM players WHERE account_id = ?', existing.id);
    if (p) return { token: existing.token, playerId: p.id };
  }

  const token = newId('t') + newId();
  const accountId = newId('a');
  const playerId = newId('p');
  const now = Date.now();

  // мир с наименьшим числом живых городов
  const target = q<{ id: number; c: number }>(
    `SELECT w.id, (SELECT COUNT(*) FROM players p WHERE p.world_id = w.id AND p.x >= 0 AND p.is_bot = 0) AS c
     FROM worlds w WHERE w.kind = 'home' ORDER BY c ASC, w.id ASC LIMIT 1`,
  )[0];

  run(
    'INSERT INTO accounts (id, token, nick, house, created_at) VALUES (?, ?, ?, ?, ?)',
    accountId,
    token,
    clean,
    house,
    now,
  );
  run(
    `INSERT INTO players (id, account_id, world_id, nick, house, x, y, food, wood, stone, iron,
      last_tick, power, is_bot, created_at) VALUES (?, ?, ?, ?, ?, -1, -1, ?, ?, ?, ?, ?, 0, 0, ?)`,
    playerId,
    accountId,
    target.id,
    clean,
    house,
    START_RESOURCES.food,
    START_RESOURCES.wood,
    START_RESOURCES.stone,
    START_RESOURCES.iron,
    now,
    now,
  );
  for (const key of BUILDING_KEYS) {
    run(
      'INSERT INTO buildings (player_id, key, level, upgrading_to, finish_at) VALUES (?, ?, ?, NULL, NULL)',
      playerId,
      key,
      START_BUILDINGS[key] ?? 1,
    );
  }
  saveTroops(playerId, { infantry: 0, archers: 0, cavalry: 0 });
  refreshPower(playerId);
  addReport(
    playerId,
    target.id,
    'system',
    'Добро пожаловать в Эшфолл',
    {
      text:
        'Пепел ещё не осел, а твой обоз уже в пути. Выбери место для города — от него зависит, сколько колодцев ты увидишь с порога.',
    },
  );
  return { token, playerId };
}

export function playerByToken(token: string): PlayerRow | undefined {
  const acc = q1<{ id: string }>('SELECT id FROM accounts WHERE token = ?', token);
  if (!acc) return undefined;
  return q1<PlayerRow>('SELECT * FROM players WHERE account_id = ?', acc.id);
}

export function foundCity(playerId: string, x: number, y: number): void {
  const p = loadPlayer(playerId);
  if (p.x >= 0) throw new CommandError('Город уже основан');
  if (!isBuildableTile(p.world_id, x, y)) throw new CommandError('Здесь город не построить');
  const occupied = q1<{ id: string }>(
    'SELECT id FROM entities WHERE world_id = ? AND x = ? AND y = ?',
    p.world_id,
    x,
    y,
  );
  if (occupied) throw new CommandError('Тайл занят');
  const tooClose = q1<{ id: string }>(
    'SELECT id FROM entities WHERE world_id = ? AND ABS(x - ?) <= 1 AND ABS(y - ?) <= 1',
    p.world_id,
    x,
    y,
  );
  if (tooClose) throw new CommandError('Слишком близко к соседу: нужен зазор в один тайл');

  run('UPDATE players SET x = ?, y = ? WHERE id = ?', x, y, playerId);
  run(
    `INSERT INTO entities (id, world_id, kind, x, y, level, owner_id, power, created_at)
     VALUES (?, ?, 'city', ?, ?, ?, ?, ?, ?)`,
    newId('e'),
    p.world_id,
    x,
    y,
    buildingLevels(playerId).town_hall ?? 1,
    playerId,
    p.power,
    Date.now(),
  );
  refreshPower(playerId);
  emitWorld(p.world_id, { now: Date.now(), ...diffEntities(p.world_id) });
}

export function upgradeBuilding(playerId: string, key: BuildingKey): void {
  const now = Date.now();
  const row = loadPlayer(playerId);
  const { resources } = accruePlayer(row, now);
  const buildings = loadBuildings(playerId);
  const current = buildings.get(key);
  const level = current?.level ?? 0;
  const thLevel = buildings.get('town_hall')?.level ?? 1;

  if (current?.upgradingTo) throw new CommandError('Уже улучшается');
  const allowed = canUpgrade(key, level, thLevel);
  if (!allowed.ok) throw new CommandError(allowed.reason ?? 'Нельзя');

  const target = level + 1;
  const cost = buildingCost(key, target);
  if (!canAfford(resources, cost)) {
    const miss = missingResources(resources, cost);
    const parts = RESOURCE_KEYS.filter((r) => miss[r] > 0).map((r) => `${r}:${miss[r]}`);
    throw new CommandError(`Не хватает ресурсов (${parts.join(', ')})`);
  }

  const after = pay(resources, cost);
  const duration = buildingTime(key, target);
  run(
    'UPDATE players SET food = ?, wood = ?, stone = ?, iron = ? WHERE id = ?',
    after.food,
    after.wood,
    after.stone,
    after.iron,
    playerId,
  );
  run(
    'UPDATE buildings SET upgrading_to = ?, finish_at = ? WHERE player_id = ? AND key = ?',
    target,
    now + duration * 1000,
    playerId,
    key,
  );
  emitPlayer(playerId, { now, player: playerView(playerId, now) });
}

export function trainUnits(playerId: string, unit: UnitKey, count: number): void {
  if (!Number.isFinite(count) || count <= 0) throw new CommandError('Неверное число');
  const n = Math.min(500, Math.floor(count));
  const now = Date.now();
  const row = loadPlayer(playerId);
  const { resources } = accruePlayer(row, now);
  const buildings = loadBuildings(playerId);
  const barracks = buildings.get('barracks')?.level ?? 1;
  const cost = unitCost(unit);
  const total: Record<string, number> = {};
  for (const r of RESOURCE_KEYS) total[r] = cost[r as ResourceKey] * n;
  if (!canAfford(resources, total as Partial<Resources>)) {
    throw new CommandError('Не хватает ресурсов на обучение');
  }
  const after = pay(resources, total as Partial<Resources>);
  run(
    'UPDATE players SET food = ?, wood = ?, stone = ?, iron = ? WHERE id = ?',
    after.food,
    after.wood,
    after.stone,
    after.iron,
    playerId,
  );

  // очередь: каждый батч — своя строка со временем готовности
  const perUnit = unitTrainTime(unit, barracks);
  const lastFinish = q1<{ finish_at: number }>(
    'SELECT MAX(finish_at) AS finish_at FROM training WHERE player_id = ?',
    playerId,
  );
  const start = Math.max(now, lastFinish?.finish_at ?? 0);
  run(
    'INSERT INTO training (id, player_id, unit, count, finish_at) VALUES (?, ?, ?, ?, ?)',
    newId('tr'),
    playerId,
    unit,
    n,
    start + perUnit * n * 1000,
  );
  emitPlayer(playerId, { now, player: playerView(playerId, now) });
}

/**
 * Свободные войска. Армия, ушедшая в марш, списывается из города в момент отправки —
 * поэтому «свободно» = «всё, что стоит в городе». Так исключается двойной учёт.
 */
function freeTroops(playerId: string): Troops {
  return loadTroops(playerId);
}

export function startMarch(
  playerId: string,
  args: { kind: MarchKind; targetId?: string; x?: number; y?: number; troops: Troops },
): void {
  const now = Date.now();
  const p = loadPlayer(playerId);
  if (p.x < 0) throw new CommandError('Сначала основа город');
  const world = getWorld(p.world_id);

  const target = args.targetId
    ? q1<EntityRow>('SELECT * FROM entities WHERE id = ? AND world_id = ?', args.targetId, p.world_id)
    : q1<EntityRow>(
        'SELECT * FROM entities WHERE world_id = ? AND x = ? AND y = ?',
        p.world_id,
        args.x,
        args.y,
      );

  let toX: number;
  let toY: number;
  if (target) {
    toX = target.x;
    toY = target.y;
  } else if (typeof args.x === 'number' && typeof args.y === 'number') {
    toX = args.x;
    toY = args.y;
  } else {
    throw new CommandError('Цель не найдена');
  }

  const requested: Troops = {
    infantry: Math.max(0, Math.floor(args.troops.infantry ?? 0)),
    archers: Math.max(0, Math.floor(args.troops.archers ?? 0)),
    cavalry: Math.max(0, Math.floor(args.troops.cavalry ?? 0)),
  };
  const totalRequested = requested.infantry + requested.archers + requested.cavalry;
  if (totalRequested <= 0) throw new CommandError('Нужно отправить хотя бы одного бойца');

  const available = freeTroops(playerId);
  for (const key of ['infantry', 'archers', 'cavalry'] as const) {
    if (requested[key] > available[key]) {
      throw new CommandError(`Нет столько свободных войск (${key})`);
    }
  }

  const marches = q<{ id: string }>('SELECT id FROM marches WHERE player_id = ?', playerId);
  const thLevel = buildingLevels(playerId).town_hall ?? 1;
  const slots = 1 + Math.floor(thLevel / 2);
  if (marches.length >= slots) throw new CommandError('Все марши уже в пути');

  if (target && target.owner_id === playerId && args.kind === 'attack') {
    throw new CommandError('Нельзя атаковать самого себя');
  }

  const travelling = travelSeconds({
    seed: world.seed,
    kind: world.kind as WorldKind,
    size: world.size,
    fromX: p.x,
    fromY: p.y,
    toX,
    toY,
    troops: requested,
    house: p.house as HouseKey,
  });
  if (travelling <= 0) throw new CommandError('Марш невозможен');

  let gatherTime = 0;
  let gatherAmount = 0;
  if (args.kind === 'gather' && target?.kind === 'node' && target.resource) {
    const g = gatherSeconds({
      resource: target.resource as ResourceKey,
      available: target.amount ?? 0,
      troops: requested,
      house: p.house as HouseKey,
    });
    gatherTime = g.seconds;
    gatherAmount = g.amount;
  }

  const home = loadTroops(playerId);
  saveTroops(playerId, {
    infantry: home.infantry - requested.infantry,
    archers: home.archers - requested.archers,
    cavalry: home.cavalry - requested.cavalry,
  });

  const marchId = newId('m');
  run(
    `INSERT INTO marches (id, world_id, player_id, kind, phase, from_x, from_y, to_x, to_y, target_id,
      infantry, archers, cavalry, depart_at, arrive_at, created_at)
     VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    marchId,
    p.world_id,
    playerId,
    args.kind,
    p.x,
    p.y,
    toX,
    toY,
    target?.id ?? null,
    requested.infantry,
    requested.archers,
    requested.cavalry,
    now,
    now + (travelling + gatherTime) * 1000,
    now,
  );

  emitPlayer(playerId, { now, player: playerView(playerId, now) });
  toast(
    playerId,
    'info',
    `Марш вышел: ${args.kind === 'gather' ? 'сбор' : args.kind === 'scout' ? 'разведка' : 'атака'} · ETA ${formatDuration(travelling + gatherTime)}`,
  );
  if (gatherAmount > 0 && target) {
    run('UPDATE entities SET amount = ? WHERE id = ?', Math.max(0, (target.amount ?? 0) - gatherAmount), target.id);
    emitWorld(p.world_id, { now, ...diffEntities(p.world_id) });
  }
}

export function recallMarch(playerId: string, marchId: string): void {
  const now = Date.now();
  const m = q1<MarchRow>('SELECT * FROM marches WHERE id = ? AND player_id = ?', marchId, playerId);
  if (!m) throw new CommandError('Марш не найден');
  if (m.phase === 'returning') throw new CommandError('Марш уже возвращается');
  const p = loadPlayer(playerId);
  const world = getWorld(p.world_id);
  const back = travelSeconds({
    seed: world.seed,
    kind: world.kind as WorldKind,
    size: world.size,
    fromX: m.to_x,
    fromY: m.to_y,
    toX: p.x,
    toY: p.y,
    troops: { infantry: m.infantry, archers: m.archers, cavalry: m.cavalry },
    house: p.house as HouseKey,
  });
  run(
    `UPDATE marches SET phase = 'returning', from_x = ?, from_y = ?, to_x = ?, to_y = ?,
      depart_at = ?, arrive_at = ? WHERE id = ?`,
    m.to_x,
    m.to_y,
    p.x,
    p.y,
    now,
    now + back * 1000,
    m.id,
  );
  emitPlayer(playerId, { now, player: playerView(playerId, now) });
}

export function migrate(playerId: string, worldId: number, x: number, y: number): void {
  const now = Date.now();
  const p = loadPlayer(playerId);
  const target = getWorld(worldId);
  if (worldId === p.world_id) throw new CommandError('Ты уже в этом мире');
  if (now < p.migrate_ready_at) {
    throw new CommandError(`Переселение откатывается ещё ${formatDuration((p.migrate_ready_at - now) / 1000)}`);
  }
  const th = buildingLevels(playerId).town_hall ?? 1;
  if (th < target.requires_town_hall) {
    throw new CommandError(`Нужна ратуша ${target.requires_town_hall} уровня`);
  }
  if (!isBuildableTile(worldId, x, y)) throw new CommandError('Здесь город не построить');
  const occupied = q1<{ id: string }>('SELECT id FROM entities WHERE world_id = ? AND x = ? AND y = ?', worldId, x, y);
  if (occupied) throw new CommandError('Тайл занят');
  const tooClose = q1<{ id: string }>(
    'SELECT id FROM entities WHERE world_id = ? AND ABS(x - ?) <= 1 AND ABS(y - ?) <= 1',
    worldId,
    x,
    y,
  );
  if (tooClose) throw new CommandError('Слишком близко к соседу');

  // армия в пути телепортируется домой, город переносится целиком
  const inFlight = q<MarchRow>("SELECT * FROM marches WHERE player_id = ? AND phase = 'outbound'", playerId);
  const troops = loadTroops(playerId);
  for (const m of inFlight) {
    troops.infantry += m.infantry;
    troops.archers += m.archers;
    troops.cavalry += m.cavalry;
  }
  saveTroops(playerId, troops);
  run('DELETE FROM marches WHERE player_id = ?', playerId);
  run('DELETE FROM entities WHERE owner_id = ? AND kind = ?', playerId, 'city');
  run(
    'UPDATE players SET world_id = ?, x = ?, y = ?, migrate_ready_at = ? WHERE id = ?',
    worldId,
    x,
    y,
    now + MIGRATION_COOLDOWN_SEC * 1000,
    playerId,
  );
  run(
    `INSERT INTO entities (id, world_id, kind, x, y, level, owner_id, power, created_at)
     VALUES (?, ?, 'city', ?, ?, ?, ?, ?, ?)`,
    newId('e'),
    worldId,
    x,
    y,
    th,
    playerId,
    p.power,
    now,
  );
  addReport(playerId, worldId, 'system', `Переселение в «${target.name}»`, {
    text:
      target.kind === 'kvk'
        ? 'Обоз перешёл Пылающий предел. Здесь жар течёт из колодцев, а соседи — не из твоего королевства.'
        : 'Обоз развернулся к другому королевству. Город, стены и войско переехали целиком.',
  });
  emitWorld(p.world_id, { now, ...diffEntities(p.world_id) });
  emitWorld(worldId, { now, ...diffEntities(worldId) });
}

/* ─────────────────  Тик мира  ───────────────── */

let lastBotTick = 0;
let lastCampTick = 0;
let lastLeaderTick = 0;

export function tick(now: number): void {
  completeBuildings(now);
  completeTraining(now);
  resolveArrivals(now);
  creditWells(now, now - lastBotTick);
  if (now - lastCampTick > 12_000) {
    respawnCamps(now);
    lastCampTick = now;
  }
  if (now - lastBotTick > 2_500) {
    growBots(now);
    lastBotTick = now;
  }
  if (now - lastLeaderTick > 6_000) {
    for (const w of listWorlds()) {
      emitWorld(w.id, { now, leaders: leaders(w.id === 3 ? 'kvk' : 'world', w.id) });
    }
    lastLeaderTick = now;
  }
}

function completeBuildings(now: number): void {
  const rows = q<{ player_id: string; key: string; upgrading_to: number }>(
    'SELECT player_id, key, upgrading_to FROM buildings WHERE finish_at IS NOT NULL AND finish_at <= ?',
    now,
  );
  for (const r of rows) {
    run(
      'UPDATE buildings SET level = ?, upgrading_to = NULL, finish_at = NULL WHERE player_id = ? AND key = ?',
      r.upgrading_to,
      r.player_id,
      r.key,
    );
    const worldId = loadPlayer(r.player_id).world_id;
    if (r.key === 'town_hall') {
      run(
        "UPDATE entities SET level = ? WHERE owner_id = ? AND kind = 'city'",
        r.upgrading_to,
        r.player_id,
      );
      emitWorld(worldId, { now, ...diffEntities(worldId) });
    }
    refreshPower(r.player_id);
    emitPlayer(r.player_id, { now, player: playerView(r.player_id, now) });
    toast(r.player_id, 'success', `Постройка завершена: ${r.key}`);
  }
}

function completeTraining(now: number): void {
  const rows = q<{ id: string; player_id: string; unit: string; count: number }>(
    'SELECT id, player_id, unit, count FROM training WHERE finish_at <= ?',
    now,
  );
  for (const r of rows) {
    const troops = loadTroops(r.player_id);
    troops[r.unit as UnitKey] += r.count;
    saveTroops(r.player_id, troops);
    run('DELETE FROM training WHERE id = ?', r.id);
    refreshPower(r.player_id);
    emitPlayer(r.player_id, { now, player: playerView(r.player_id, now) });
    toast(r.player_id, 'success', `Обучено: ${r.count} (${r.unit})`);
  }
}

function resolveArrivals(now: number): void {
  const rows = q<MarchRow>('SELECT * FROM marches WHERE arrive_at <= ? ORDER BY arrive_at', now);
  for (const m of rows) {
    try {
      if (m.phase === 'outbound') handleArrival(m, now);
      else handleReturn(m, now);
    } catch (err) {
      console.error('[march]', err);
      returnHome(m, now, { infantry: m.infantry, archers: m.archers, cavalry: m.cavalry });
    }
  }
}

function worldOf(m: MarchRow): WorldRow {
  return getWorld(m.world_id);
}

function returnHome(m: MarchRow, now: number, troops: Troops, cargo?: Partial<Resources>): void {
  const world = worldOf(m);
  const p = loadPlayer(m.player_id);
  const back = travelSeconds({
    seed: world.seed,
    kind: world.kind as WorldKind,
    size: world.size,
    fromX: m.to_x,
    fromY: m.to_y,
    toX: p.x,
    toY: p.y,
    troops,
    house: p.house as HouseKey,
  });
  run(
    `UPDATE marches SET phase = 'returning', infantry = ?, archers = ?, cavalry = ?,
      from_x = ?, from_y = ?, to_x = ?, to_y = ?, depart_at = ?, arrive_at = ?,
      cargo_food = ?, cargo_wood = ?, cargo_stone = ?, cargo_iron = ?, cargo_ember = ?
     WHERE id = ?`,
    troops.infantry,
    troops.archers,
    troops.cavalry,
    m.to_x,
    m.to_y,
    p.x,
    p.y,
    now,
    now + Math.max(3, back) * 1000,
    cargo?.food ?? 0,
    cargo?.wood ?? 0,
    cargo?.stone ?? 0,
    cargo?.iron ?? 0,
    cargo?.ember ?? 0,
    m.id,
  );
  emitPlayer(m.player_id, { now, player: playerView(m.player_id, now) });
}

function handleArrival(m: MarchRow, now: number): void {
  const p = loadPlayer(m.player_id);
  const troops: Troops = { infantry: m.infantry, archers: m.archers, cavalry: m.cavalry };
  const target = m.target_id ? q1<EntityRow>('SELECT * FROM entities WHERE id = ?', m.target_id) : undefined;

  if (!target) {
    // цель исчезла (лагерь разгромлен кем-то ещё) — домой
    returnHome(m, now, troops);
    toast(m.player_id, 'warning', 'Цель исчезла, марш возвращается');
    return;
  }

  if (m.kind === 'scout') {
    const info = scoutInfo(target);
    addReport(m.player_id, m.world_id, 'scout', `Разведка: ${info.title}`, info.data);
    returnHome(m, now, troops);
    toast(m.player_id, 'info', 'Разведка вернулась с донесением');
    return;
  }

  if (target.kind === 'node') {
    const amount = Math.min(
      target.amount ?? 0,
      lootCapacity(troops, p.house as HouseKey),
    );
    if (amount <= 0) {
      returnHome(m, now, troops);
      toast(m.player_id, 'warning', 'Залежь пуста');
      return;
    }
    run('UPDATE entities SET amount = ?, node_updated_at = ? WHERE id = ?', Math.max(0, (target.amount ?? 0) - amount), now, target.id);
    const cargo: Partial<Resources> = { [target.resource as ResourceKey]: amount };
    addReport(m.player_id, m.world_id, 'gather', `Сбор: ${amount} ${target.resource}`, {
      amount,
      resource: target.resource,
      x: target.x,
      y: target.y,
    });
    returnHome(m, now, troops, cargo);
    toast(m.player_id, 'success', `Собрано ${Math.round(amount)} ${target.resource}`);
    emitWorld(m.world_id, { now, ...diffEntities(m.world_id) });
    return;
  }

  if (target.kind === 'camp') {
    const defender: Troops = {
      infantry: target.infantry,
      archers: target.archers,
      cavalry: target.cavalry,
    };
    const result = resolveBattle({
      attacker: { troops, house: p.house as HouseKey },
      defender: { troops: defender },
      seed: `${m.id}:camp:${target.id}`,
      emberPerKilledPower: worldOf(m).kind === 'kvk' ? EMBER_PER_KILLED_POWER.pve : 0,
    });
    if (result.winner === 'attacker') {
      const loot = CAMP_LOOT[Math.min(6, target.level)] ?? CAMP_LOOT[1];
      const cargo: Partial<Resources> = {};
      for (const r of RESOURCE_KEYS) cargo[r] = loot[r] * 0.5 + loot[r] * 0.5;
      run('DELETE FROM entities WHERE id = ?', target.id);
      emitWorld(m.world_id, { now, ...diffEntities(m.world_id) });
      if (result.emberFromKills > 0) addEmber(m.player_id, result.emberFromKills);
      addReport(m.player_id, m.world_id, 'battle', `Лагерь мародёров (ур. ${target.level}) разгромлен`, {
        winner: true,
        target: 'camp',
        level: target.level,
        losses: result.attackerLosses,
        enemyLosses: result.defenderLosses,
        loot: cargo,
        ember: result.emberFromKills,
        x: target.x,
        y: target.y,
      });
      returnHome(m, now, result.attackerSurvivors, cargo);
      toast(m.player_id, 'success', `Лагерь разгромлен. Добыча везётся домой`);
    } else {
      addReport(m.player_id, m.world_id, 'battle', `Лагерь (ур. ${target.level}) устоял`, {
        winner: false,
        target: 'camp',
        level: target.level,
        losses: result.attackerLosses,
        enemyLosses: result.defenderLosses,
        loot: {},
        x: target.x,
        y: target.y,
      });
      run(
        'UPDATE entities SET infantry = ?, archers = ?, cavalry = ? WHERE id = ?',
        result.defenderSurvivors.infantry,
        result.defenderSurvivors.archers,
        result.defenderSurvivors.cavalry,
        target.id,
      );
      emitWorld(m.world_id, { now, ...diffEntities(m.world_id) });
      returnHome(m, now, result.attackerSurvivors);
      toast(m.player_id, 'danger', `Атака отбита. Потери: ${result.attackerLosses.infantry + result.attackerLosses.archers + result.attackerLosses.cavalry}`);
    }
    return;
  }

  if (target.kind === 'well') {
    const ready = (target.garrison_ready_at ?? 0) <= now;
    const guard: Troops = ready
      ? { infantry: target.infantry, archers: target.archers, cavalry: target.cavalry }
      : { infantry: 0, archers: 0, cavalry: 0 };
    if (ready && guard.infantry + guard.archers + guard.cavalry > 0) {
      const result = resolveBattle({
        attacker: { troops, house: p.house as HouseKey },
        defender: { troops: guard, wallLevel: target.level },
        seed: `${m.id}:well:${target.id}`,
        emberPerKilledPower: EMBER_PER_KILLED_POWER.well,
      });
      if (result.winner !== 'attacker') {
        run(
          'UPDATE entities SET infantry = ?, archers = ?, cavalry = ? WHERE id = ?',
          result.defenderSurvivors.infantry,
          result.defenderSurvivors.archers,
          result.defenderSurvivors.cavalry,
          target.id,
        );
        addReport(m.player_id, m.world_id, 'battle', 'Стражи Предела удержали колодец', {
          winner: false,
          target: 'well',
          losses: result.attackerLosses,
          enemyLosses: result.defenderLosses,
          loot: {},
          x: target.x,
          y: target.y,
        });
        returnHome(m, now, result.attackerSurvivors);
        toast(m.player_id, 'danger', 'Колодец не взят: стражи держат');
        emitWorld(m.world_id, { now, ...diffEntities(m.world_id) });
        return;
      }
      run('DELETE FROM marches WHERE id = ?', m.id);
      captureWell(target, m.player_id, result.attackerSurvivors, now, result.emberFromKills);
      emitPlayer(m.player_id, { now, player: playerView(m.player_id, now) });
      return;
    }
    run('DELETE FROM marches WHERE id = ?', m.id);
    captureWell(target, m.player_id, troops, now, 0);
    emitPlayer(m.player_id, { now, player: playerView(m.player_id, now) });
    return;
  }

  // город игрока
  const ownerId = target.owner_id;
  if (!ownerId) {
    returnHome(m, now, troops);
    return;
  }
  const defenderRow = loadPlayer(ownerId);
  const defenderTroops = loadTroops(ownerId);
  const wallLevel = buildingLevels(ownerId).wall ?? 1;
  const result = resolveBattle({
    attacker: { troops, house: p.house as HouseKey },
    defender: {
      troops: defenderTroops,
      wallLevel,
      house: defenderRow.house as HouseKey,
    },
    seed: `${m.id}:city:${target.id}:${target.infantry}`,
    emberPerKilledPower: worldOf(m).kind === 'kvk' ? EMBER_PER_KILLED_POWER.pvp : 0,
  });
  saveTroops(ownerId, result.defenderSurvivors);
  refreshPower(ownerId);

  let cargo: Partial<Resources> = {};
  if (result.winner === 'attacker') {
    const defenderWallet = accruePlayer(defenderRow, now).resources;
    const capacity = lootCapacity(troops, p.house as HouseKey);
    let remaining = capacity;
    for (const r of ['food', 'wood', 'stone', 'iron'] as ResourceKey[]) {
      const take = Math.min(remaining, defenderWallet[r] * 0.3);
      if (take > 1) {
        cargo[r] = Math.floor(take);
        remaining -= take;
      }
    }
    const after = { ...defenderWallet };
    for (const [res, amount] of Object.entries(cargo) as [ResourceKey, number][]) {
      after[res] = Math.max(0, after[res] - amount);
    }
    run(
      'UPDATE players SET food = ?, wood = ?, stone = ?, iron = ? WHERE id = ?',
      after.food,
      after.wood,
      after.stone,
      after.iron,
      ownerId,
    );
  }
  if (result.emberFromKills > 0) addEmber(m.player_id, result.emberFromKills);

  addReport(m.player_id, m.world_id, 'battle', `Атака на город ${defenderRow.nick}`, {
    winner: result.winner === 'attacker',
    target: 'city',
    defender: defenderRow.nick,
    losses: result.attackerLosses,
    enemyLosses: result.defenderLosses,
    loot: cargo,
    ember: result.emberFromKills,
    x: target.x,
    y: target.y,
  });
  addReport(ownerId, m.world_id, 'battle', `Твой город атаковал ${p.nick}`, {
    winner: result.winner === 'defender',
    target: 'city-defense',
    attacker: p.nick,
    losses: result.defenderLosses,
    enemyLosses: result.attackerLosses,
    loot: cargo,
    x: target.x,
    y: target.y,
  });
  if (result.winner === 'attacker') {
    toast(ownerId, 'danger', `Город атакован: ${p.nick} увёз добычу`);
  } else {
    toast(ownerId, 'success', `Атака ${p.nick} отбита`);
  }
  emitPlayer(ownerId, { now, player: playerView(ownerId, now) });
  returnHome(m, now, result.attackerSurvivors, cargo);
}

function captureWell(
  well: EntityRow,
  playerId: string,
  survivors: Troops,
  now: number,
  ember: number,
): void {
  run(
    'UPDATE entities SET owner_id = ?, occupied_at = ?, garrison_ready_at = ?, infantry = ?, archers = ?, cavalry = ? WHERE id = ?',
    playerId,
    now,
    now + 120_000,
    survivors.infantry,
    survivors.archers,
    survivors.cavalry,
    well.id,
  );
  // выжившие остаются гарнизоном колодца и не возвращаются домой
  if (ember > 0) addEmber(playerId, ember);
  const p = loadPlayer(playerId);
  addReport(playerId, well.world_id, 'kvk', 'Жар-колодец взят под контроль', {
    x: well.x,
    y: well.y,
    level: well.level,
    emberPerMinute: WELL_EMBER_PER_MINUTE * well.level,
    garrison: survivors,
  });
  toast(playerId, 'success', `Колодец (${well.x}, ${well.y}) твой: +${WELL_EMBER_PER_MINUTE * well.level} жара в минуту`);
  refreshPower(playerId);
  emitWorld(well.world_id, { now, ...diffEntities(well.world_id) });
  emitPlayer(playerId, { now, player: playerView(playerId, now) });
  void p;
}

function addEmber(playerId: string, amount: number): void {
  run('UPDATE players SET ember = ember + ?, kvk_ember = kvk_ember + ? WHERE id = ?', amount, amount, playerId);
}

let lastWellCredit = 0;

function creditWells(now: number, _dtMs: number): void {
  const dt = Math.min(60, Math.max(0, (now - lastWellCredit) / 1000));
  lastWellCredit = now;
  if (dt <= 0) return;
  const wells = q<EntityRow & { world_id: number }>(
    "SELECT * FROM entities WHERE kind = 'well' AND owner_id IS NOT NULL AND occupied_at IS NOT NULL",
  );
  if (wells.length === 0) return;
  const perPlayer = new Map<string, number>();
  for (const w of wells) {
    const gain = (WELL_EMBER_PER_MINUTE * w.level * dt) / 60;
    perPlayer.set(w.owner_id!, (perPlayer.get(w.owner_id!) ?? 0) + gain);
  }
  for (const [playerId, gain] of perPlayer) {
    if (gain < 0.01) continue;
    run('UPDATE players SET ember = ember + ?, kvk_ember = kvk_ember + ? WHERE id = ?', gain, gain, playerId);
    // жар — единственный ресурс, который клиент не может интерполировать сам
    emitPlayer(playerId, { now, player: playerView(playerId, now) });
  }
  // стражники колодца восстанавливаются по таймеру
  const ready = q<EntityRow>(
    'SELECT * FROM entities WHERE kind = ? AND garrison_ready_at IS NOT NULL AND garrison_ready_at <= ? AND infantry = 0 AND archers = 0 AND cavalry = 0',
    'well',
    now,
  );
  for (const w of ready) {
    const garrison = CAMP_GARRISON[Math.min(6, w.level + 2)] ?? CAMP_GARRISON[3];
    run(
      'UPDATE entities SET infantry = ?, archers = ?, cavalry = ? WHERE id = ?',
      garrison.infantry,
      garrison.archers,
      garrison.cavalry,
      w.id,
    );
    emitWorld(w.world_id, { now, ...diffEntities(w.world_id) });
  }
}

function handleReturn(m: MarchRow, now: number): void {
  const troops = loadTroops(m.player_id);
  troops.infantry += m.infantry;
  troops.archers += m.archers;
  troops.cavalry += m.cavalry;
  saveTroops(m.player_id, troops);
  const row = loadPlayer(m.player_id);
  const wallet = accruePlayer(row, now).resources;
  if (m.cargo_food || m.cargo_wood || m.cargo_stone || m.cargo_iron || m.cargo_ember) {
    run(
      'UPDATE players SET food = ?, wood = ?, stone = ?, iron = ? WHERE id = ?',
      wallet.food + (m.cargo_food ?? 0),
      wallet.wood + (m.cargo_wood ?? 0),
      wallet.stone + (m.cargo_stone ?? 0),
      wallet.iron + (m.cargo_iron ?? 0),
      m.player_id,
    );
  }
  run('DELETE FROM marches WHERE id = ?', m.id);
  refreshPower(m.player_id);
  emitPlayer(m.player_id, { now, player: playerView(m.player_id, now) });
  toast(m.player_id, 'info', 'Марш вернулся домой');
}

function scoutInfo(target: EntityRow): { title: string; data: Record<string, unknown> } {
  if (target.kind === 'city' && target.owner_id) {
    const troops = loadTroops(target.owner_id);
    const owner = loadPlayer(target.owner_id);
    const wallet = accruePlayer(owner, Date.now()).resources;
    return {
      title: `город ${owner.nick}`,
      data: {
        kind: 'city',
        nick: owner.nick,
        house: owner.house,
        power: owner.power,
        garrison: troops,
        resources: wallet,
        x: target.x,
        y: target.y,
      },
    };
  }
  if (target.kind === 'camp') {
    return {
      title: `лагерь (ур. ${target.level})`,
      data: {
        kind: 'camp',
        garrison: { infantry: target.infantry, archers: target.archers, cavalry: target.cavalry },
        loot: CAMP_LOOT[Math.min(6, target.level)],
        x: target.x,
        y: target.y,
      },
    };
  }
  if (target.kind === 'well') {
    return {
      title: `жар-колодец (ур. ${target.level})`,
      data: {
        kind: 'well',
        garrison: { infantry: target.infantry, archers: target.archers, cavalry: target.cavalry },
        owner: target.owner_id,
        emberPerMinute: WELL_EMBER_PER_MINUTE * target.level,
        x: target.x,
        y: target.y,
      },
    };
  }
  return {
    title: 'залежь',
    data: { kind: 'node', resource: target.resource, amount: target.amount, x: target.x, y: target.y },
  };
}

/* ─────────────────  Наполнение мира  ───────────────── */

const CAMP_TARGET: Record<number, number> = { 1: 110, 2: 110, 3: 80 };
const NODE_TARGET: Record<number, number> = { 1: 150, 2: 150, 3: 70 };
const WELL_TARGET: Record<number, number> = { 3: 22 };

function freeTile(worldId: number, taken: Set<string>, minDist = 3): { x: number; y: number } | null {
  const w = getWorld(worldId);
  const gen = spawnCandidates(w.seed + Math.floor(Math.random() * 100000), w.kind as WorldKind, w.size);
  for (let i = 0; i < 400; i++) {
    const { value } = gen.next();
    if (!value) break;
    if (!isBuildableTile(worldId, value.x, value.y)) continue;
    let ok = true;
    for (let dx = -minDist; dx <= minDist && ok; dx++) {
      for (let dy = -minDist; dy <= minDist && ok; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > minDist) continue;
        if (taken.has(`${value.x + dx}:${value.y + dy}`)) ok = false;
      }
    }
    if (ok) return value;
  }
  return null;
}

export function seedWorldContent(worldId: number): void {
  const existing = q1<{ c: number }>('SELECT COUNT(*) AS c FROM entities WHERE world_id = ?', worldId);
  if ((existing?.c ?? 0) > 0) return;
  const w = getWorld(worldId);
  const taken = new Set<string>();
  const now = Date.now();

  const bots = w.kind === 'kvk' ? 34 : 70;
  for (let i = 0; i < bots; i++) {
    const tile = freeTile(worldId, taken, 4);
    if (!tile) break;
    taken.add(`${tile.x}:${tile.y}`);
    createBot(worldId, tile.x, tile.y, w.kind === 'kvk');
  }

  for (let i = 0; i < (CAMP_TARGET[worldId] ?? 0); i++) {
    const tile = freeTile(worldId, taken, 3);
    if (!tile) break;
    taken.add(`${tile.x}:${tile.y}`);
    createCamp(worldId, tile.x, tile.y, now);
  }

  const resources: ResourceKey[] = ['food', 'wood', 'stone', 'iron'];
  for (let i = 0; i < (NODE_TARGET[worldId] ?? 0); i++) {
    const tile = freeTile(worldId, taken, 2);
    if (!tile) break;
    taken.add(`${tile.x}:${tile.y}`);
    const res = resources[i % resources.length];
    const info = NODE_INFO[res];
    run(
      `INSERT INTO entities (id, world_id, kind, x, y, level, resource, amount, node_updated_at, power, created_at)
       VALUES (?, ?, 'node', ?, ?, 1, ?, ?, ?, 0, ?)`,
      newId('e'),
      worldId,
      tile.x,
      tile.y,
      res,
      info.amount,
      now,
      now,
    );
  }

  for (let i = 0; i < (WELL_TARGET[worldId] ?? 0); i++) {
    const tile = freeTile(worldId, taken, 5);
    if (!tile) break;
    taken.add(`${tile.x}:${tile.y}`);
    createWell(worldId, tile.x, tile.y, now);
  }
}

function createCamp(worldId: number, x: number, y: number, now: number): void {
  const level = CAMP_LEVELS[Math.floor(Math.random() * (worldId === 3 ? 5 : 4))] ?? 1;
  const g = CAMP_GARRISON[level] ?? CAMP_GARRISON[1];
  run(
    `INSERT INTO entities (id, world_id, kind, x, y, level, infantry, archers, cavalry, power, created_at)
     VALUES (?, ?, 'camp', ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('e'),
    worldId,
    x,
    y,
    level,
    g.infantry,
    g.archers,
    g.cavalry,
    level * 120,
    now,
  );
}

function createWell(worldId: number, x: number, y: number, now: number): void {
  const level = 1 + Math.floor(Math.random() * 3);
  const g = CAMP_GARRISON[Math.min(6, level + 2)];
  run(
    `INSERT INTO entities (id, world_id, kind, x, y, level, infantry, archers, cavalry,
      garrison_ready_at, power, created_at)
     VALUES (?, ?, 'well', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('e'),
    worldId,
    x,
    y,
    level,
    g.infantry,
    g.archers,
    g.cavalry,
    now,
    level * 300,
    now,
  );
}

const BOT_NAMES = [
  'Седой Шлак', 'Пепельная Вдова', 'Кузнец Угрюм', 'Вольный Коготь', 'Госпожа Зари',
  'Третий Легион', 'Дом Треснувших', 'Северный Обоз', 'Ржавый Клинок', 'Тихий Огонь',
  'Костяной Ветер', 'Сталь Из Тлена', 'Дозорный Орден', 'Чёрная Теплица', 'Хмурый Холм',
  'Длань Пепла', 'Горн И Зола', 'Мёртвый Колос', 'Вьючный Клан', 'Светляки',
  'Гребень Ворона', 'Обугленный Двор', 'Ключница Жара', 'Сорок Печей', 'Сажа',
];

function createBot(worldId: number, x: number, y: number, strong: boolean): void {
  const id = newId('p');
  const now = Date.now();
  const nick = `${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]} ${1 + Math.floor(Math.random() * 99)}`;
  const house = (['order', 'clans', 'trade'] as HouseKey[])[Math.floor(Math.random() * 3)];
  const th = strong ? 3 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 5);
  run(
    `INSERT INTO players (id, account_id, world_id, nick, house, x, y, food, wood, stone, iron,
      last_tick, power, is_bot, created_at) VALUES (?, 'bot', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    id,
    worldId,
    nick,
    house,
    x,
    y,
    500 * th,
    500 * th,
    400 * th,
    200 * th,
    now,
    now,
  );
  let power = 0;
  const levels: Partial<Record<BuildingKey, number>> = {};
  for (const key of BUILDING_KEYS) {
    const lvl = key === 'town_hall' ? th : Math.max(1, Math.min(th, 1 + Math.floor(Math.random() * (th + 1))));
    levels[key] = lvl;
    power += lvl * 25;
    run(
      'INSERT INTO buildings (player_id, key, level, upgrading_to, finish_at) VALUES (?, ?, ?, NULL, NULL)',
      id,
      key,
      lvl,
    );
  }
  const troops: Troops = {
    infantry: Math.floor(Math.random() * 60 * th),
    archers: Math.floor(Math.random() * 40 * th),
    cavalry: Math.floor(Math.random() * 25 * th),
  };
  saveTroops(id, troops);
  power += armyPower(troops);
  run('UPDATE players SET power = ? WHERE id = ?', power, id);
  run(
    `INSERT INTO entities (id, world_id, kind, x, y, level, owner_id, power, created_at)
     VALUES (?, ?, 'city', ?, ?, ?, ?, ?, ?)`,
    newId('e'),
    worldId,
    x,
    y,
    th,
    id,
    power,
    now,
  );
}

function respawnCamps(now: number): void {
  for (const w of listWorlds()) {
    const target = CAMP_TARGET[w.id] ?? 0;
    const count = q1<{ c: number }>(
      "SELECT COUNT(*) AS c FROM entities WHERE world_id = ? AND kind = 'camp'",
      w.id,
    )?.c ?? 0;
    if (count >= target) continue;
    const taken = new Set<string>();
    for (const e of q<{ x: number; y: number }>('SELECT x, y FROM entities WHERE world_id = ?', w.id)) {
      taken.add(`${e.x}:${e.y}`);
    }
    const tile = freeTile(w.id, taken, 3);
    if (!tile) continue;
    createCamp(w.id, tile.x, tile.y, now);
    emitWorld(w.id, { now, ...diffEntities(w.id) });
  }
}

function growBots(now: number): void {
  const bots = q<PlayerRow>('SELECT * FROM players WHERE is_bot = 1');
  if (bots.length === 0) return;
  const bot = bots[Math.floor(Math.random() * bots.length)];
  const buildings = loadBuildings(bot.id);
  const th = buildings.get('town_hall')?.level ?? 1;
  if (Math.random() < 0.55) {
    const keys = BUILDING_KEYS.filter((k) => (buildings.get(k)?.level ?? 0) < th);
    if (keys.length > 0) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      run('UPDATE buildings SET level = level + 1 WHERE player_id = ? AND key = ?', bot.id, key);
    } else if (th < 10) {
      run('UPDATE buildings SET level = level + 1 WHERE player_id = ? AND key = ?', bot.id, 'town_hall');
      run("UPDATE entities SET level = level + 1 WHERE owner_id = ? AND kind = 'city'", bot.id);
      emitWorld(bot.world_id, { now, ...diffEntities(bot.world_id) });
    }
  } else {
    const troops = loadTroops(bot.id);
    const unit = (['infantry', 'archers', 'cavalry'] as UnitKey[])[Math.floor(Math.random() * 3)];
    const add = 5 + Math.floor(Math.random() * 20 * th);
    saveTroops(bot.id, { ...troops, [unit]: troops[unit] + add });
  }
  refreshPower(bot.id);
}

/* ─────────────────  Прочее  ───────────────── */

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m} м ${rest} с`;
  const h = Math.floor(m / 60);
  return `${h} ч ${m % 60} м`;
}

export function estimateAttack(playerId: string, entity: EntityView): number {
  const p = loadPlayer(playerId);
  const troops = freeTroops(playerId);
  const wall = entity.kind === 'city' && entity.ownerId ? buildingLevels(entity.ownerId).wall ?? 1 : 0;
  const house = entity.kind === 'city' && entity.ownerId ? (loadPlayer(entity.ownerId).house as HouseKey) : 'order';
  return estimateOdds(
    { troops, house: p.house as HouseKey },
    { troops: entity.garrison ?? { infantry: 0, archers: 0, cavalry: 0 }, wallLevel: wall, house },
  );
}

export { KVK_TOWN_HALL_REQUIRED };
export const dbHandle = db;
