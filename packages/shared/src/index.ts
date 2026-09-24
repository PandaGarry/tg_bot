/** Общий контракт между клиентом и сервером: view-модели + сообщения. Только типы. */
import type {
  BuildingKey,
  EntityKind,
  HouseKey,
  MarchKind,
  MarchPhase,
  ResourceKey,
  Resources,
  TerrainKind,
  Troops,
  UnitKey,
  WorldKind,
} from '@ashfall/rules';

export interface WorldInfo {
  id: number;
  kind: WorldKind;
  name: string;
  size: number;
  seed: number;
  players: number;
  /** Минимальный уровень ратуши для переселения (0 — без условия). */
  requiresTownHall: number;
}

export interface BuildingView {
  key: BuildingKey;
  level: number;
  upgradingTo: number | null;
  finishAt: number | null;
}

export interface TrainingView {
  unit: UnitKey;
  count: number;
  finishAt: number;
}

export interface MarchView {
  id: string;
  kind: MarchKind;
  phase: MarchPhase;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetId: string | null;
  troops: Troops;
  departAt: number;
  arriveAt: number;
  returnAt: number | null;
  cargo: Resources | null;
  ownerId: string;
  ownerNick: string | null;
  targetKind: EntityKind | null;
}

export interface PlayerView {
  id: string;
  nick: string;
  house: HouseKey;
  worldId: number;
  x: number;
  y: number;
  resources: Resources;
  rates: Resources;
  storageCap: number;
  power: number;
  kvkEmber: number;
  buildings: BuildingView[];
  troops: Troops;
  training: TrainingView[];
  marches: MarchView[];
  marchSlots: number;
  migrateReadyAt: number;
  isBot: boolean;
}

export interface EntityView {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  level: number;
  ownerId: string | null;
  ownerNick: string | null;
  house: HouseKey | null;
  /** Для залежей. */
  resource: ResourceKey | null;
  amount: number | null;
  /** Для чужого города/лагеря — null, пока не разведан. */
  garrison: Troops | null;
  power: number;
  /** Жар-колодец: чей и сколько жара накоплено за сезон. */
  emberRate: number | null;
  lastScoutedAt: number | null;
}

export interface ReportView {
  id: string;
  type: 'battle' | 'gather' | 'scout' | 'kvk' | 'system';
  createdAt: number;
  read: number;
  title: string;
  data: Record<string, unknown>;
}

export interface LeaderRow {
  id: string;
  nick: string;
  house: HouseKey;
  worldId: number;
  worldName: string;
  power: number;
  kvkEmber: number;
  isBot: boolean;
}

export interface Snapshot {
  now: number;
  world: WorldInfo;
  worlds: WorldInfo[];
  player: PlayerView;
  entities: EntityView[];
  map: string; // base64, 1 байт на тайл
  terrainLegend: TerrainKind[];
  leaders: LeaderRow[];
  reports: ReportView[];
  entityCount: number;
}

export interface Patch {
  now: number;
  player?: PlayerView;
  entities?: EntityView[];
  removedEntities?: string[];
  marches?: MarchView[];
  removedMarches?: string[];
  leaders?: LeaderRow[];
  reports?: ReportView[];
  toasts?: Toast[];
  worldPlayers?: { worldId: number; players: number }[];
}

export interface Toast {
  kind: 'info' | 'success' | 'danger' | 'warning';
  text: string;
}

/* ─────────────────  Команды (клиент → сервер)  ───────────────── */

export type Command =
  | { op: 'register'; nick: string; house: HouseKey }
  | { op: 'foundCity'; x: number; y: number }
  | { op: 'upgrade'; building: BuildingKey }
  | { op: 'train'; unit: UnitKey; count: number }
  | { op: 'march'; kind: MarchKind; targetId: string; troops: Troops }
  | { op: 'marchTile'; kind: MarchKind; x: number; y: number; troops: Troops }
  | { op: 'recall'; marchId: string }
  | { op: 'migrate'; worldId: number; x: number; y: number }
  | { op: 'leaderboard'; scope: 'world' | 'kvk' }
  | { op: 'markReportsRead' };

export type CommandName = Command['op'];

/* ─────────────────  Сообщения  ───────────────── */

export type ClientMessage =
  | { t: 'auth'; token: string | null }
  | { t: 'cmd'; id: number; cmd: Command };

export type ServerMessage =
  | { t: 'auth'; ok: boolean; token?: string; nick?: string; error?: string }
  | { t: 'snapshot'; snapshot: Snapshot }
  | { t: 'patch'; patch: Patch }
  | { t: 'res'; id: number; ok: boolean; error?: string }
  | { t: 'fatal'; error: string };

export function isCommand(value: unknown): value is Command {
  return typeof value === 'object' && value !== null && typeof (value as Command).op === 'string';
}

/** Клиенту и серверу удобно брать доменные типы из одного места. */
export type {
  BuildingKey,
  EntityKind,
  HouseKey,
  MarchKind,
  MarchPhase,
  ResourceKey,
  Resources,
  Troops,
  UnitKey,
  WorldKind,
} from '@ashfall/rules';
