/**
 * Контракт модуля. Модуль не запускает себя и не держит свой таймер:
 * ядро вызывает обработчик по команде или по наступившему сроку.
 */

import type { EffectList } from "./effects.js";
import type { UnitDecl, UnitId } from "./units.js";
import type { ModulationDetails, ModifierDecl, ModifierInput } from "./modulate.js";
import type {
  ActorFacts,
  JsonObject,
  JsonValue,
  ModuleId,
  ModuleKind,
  ModuleState,
  Phase as PhaseType,
  ResourceId,
  SlotId,
  StockSnapshot,
  Strings,
  WorldFacts,
} from "./types.js";

/** Схема входа. Zod подходит сюда по форме. */
export interface Validator<T> {
  parse(input: unknown): T;
}

/**
 * Чтение своих таблиц. Писать нельзя: запись идёт только через эффекты.
 * Запрос всегда с параметрами, строка от игрока в SQL не склеивается.
 */
export interface ModuleStore {
  read<T = JsonObject>(sql: string, params?: readonly JsonValue[]): Promise<T[]>;
}

/** Ресурс двора. Предел считает фаза `limit`, а не ядро. */
export interface ResourceDecl {
  id: ResourceId;
  /** warehouse — склад, cellar — погреб. Грибы лежат отдельно. */
  storage: "warehouse" | "cellar";
}

/** Чтение своих сроков. Чужие сроки модулю не видны. */
export type DeadlineReader = () => Promise<DeadlineRow[]>;

export interface FactsEnv {
  world: WorldFacts;
  actor: ActorFacts | null;
  stock: StockSnapshot;
  state: JsonValue;
  now: number;
}

export interface SnapshotContext {
  world: WorldFacts;
  actor: ActorFacts | null;
  now: number;
  store: ModuleStore;
  /** Сроки этого модуля: для таймеров на экране. */
  deadlines: DeadlineReader;
}

/** Общая часть контекста обработчика. */
export interface HandlerBase {
  world: WorldFacts;
  /** Кто действует. У срока мира действующего может не быть. */
  actor: ActorFacts | null;
  now: number;
  requestId: string;
  idempotencyKey: string;
  stock: StockSnapshot;
  /** Своё состояние: то, что вернул снимок этого модуля. */
  state: JsonValue;
  /** Свои факты: чужих здесь нет. */
  facts: Readonly<Record<string, number>>;
  store: ModuleStore;
  /** Сроки этого модуля: для таймеров на экране. */
  deadlines: DeadlineReader;
  /** Применить модификаторы включённых модулей. Расчёт живёт в ядре. */
  modulate(phase: PhaseType, base: number, input?: ModifierInput): number;
  modulateDetailed(phase: PhaseType, base: number, input?: ModifierInput): ModulationDetails;
}

export interface CommandContext extends HandlerBase {}

export interface DeadlineRow {
  id: string;
  owner: ModuleId;
  wakeAt: number;
  key: string;
  payload: JsonValue;
  /** Единица, которой принадлежит срок: по ней работает карантин. */
  unitId?: UnitId;
}

export interface DeadlineContext extends HandlerBase {
  deadline: DeadlineRow;
}

export interface CommandDecl<Input = JsonObject> {
  /** Полный id команды: «модуль.действие». */
  id: string;
  /** Единица, которой принадлежит команда. Выключенная единица отказывает. */
  unit?: UnitId;
  input: Validator<Input>;
  handle(ctx: CommandContext, input: Input): EffectList | Promise<EffectList>;
}

/** Стирает тип входа в списке команд модуля, сохраняя проверку у автора. */
export function defineCommand<Input>(decl: CommandDecl<Input>): CommandDecl<JsonObject> {
  return decl as unknown as CommandDecl<JsonObject>;
}

export interface ResolverDecl {
  id: string;
  /** Что считает резолвер: бой, сбор, обучение. */
  kind: "combat" | "gather" | "training" | "build" | "research";
}

export interface ScheduleDecl {
  id: string;
  /** Что делает срок. Обработчик получает payload и возвращает эффекты. */
  kind: string;
}

export interface SlotDecl {
  slot: SlotId;
  id: string;
  order?: number;
}

export interface MapLayerDecl {
  id: string;
  order: number;
}

export interface ModuleMigration {
  /** Версия модуля, на которую переводит миграция. Только вперёд. */
  to: number;
  sql: string;
}

export interface ModuleServer {
  commands?: readonly CommandDecl<JsonObject>[];
  /** Таблицы модуля. Ключ каждой строки содержит world_id. */
  tables?: readonly string[];
  migrations?: readonly ModuleMigration[];
  /** Снимок своего состояния: читает только свои таблицы. */
  snapshot?: (ctx: SnapshotContext) => JsonValue | Promise<JsonValue>;
  /** Числа из своего состояния. Ключ → функция над снимком. */
  facts?: Readonly<Record<string, (state: JsonValue, env: FactsEnv) => number>>;
}

export interface ModuleClient {
  slots?: readonly SlotDecl[];
  mapLayers?: readonly MapLayerDecl[];
}

export interface ModuleDefinition {
  id: ModuleId;
  version: number;
  /** Вид модуля: основная механика, временное событие или порá года. */
  kind: ModuleKind;
  depends?: readonly ModuleId[];
  /** Единицы: то, что гасят точечно. Механики, события, поры года, вид, дорожка. */
  units?: readonly UnitDecl[];
  /** Состояние на новый мир. Сезонное событие ставится выключенным. */
  defaultState?: ModuleState;
  content?: {
    strings: { ru: Strings; en: Strings };
  };
  rules?: {
    resources?: readonly ResourceDecl[];
    modifiers?: readonly ModifierDecl[];
    resolvers?: readonly ResolverDecl[];
    schedules?: readonly ScheduleDecl[];
  };
  server?: ModuleServer;
  client?: ModuleClient;
  /** Вызов по сроку, владельцем которого записан этот модуль. */
  onDeadline?: (ctx: DeadlineContext) => EffectList | Promise<EffectList>;
}

export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return definition;
}

/** Строка состояния модуля на мир. */
export interface WorldModuleState {
  worldId: string;
  moduleId: ModuleId;
  state: ModuleState;
  version: number;
}
