/**
 * Писатель мира. Ядро вызывает модуль только по команде или по наступившему
 * сроку, собирает снимок и применяет эффекты одной транзакцией.
 * Второго писателя на мир быть не может: право писателя — эпоха в базе.
 */

import {
  modulateDetailed,
  normalizeLimit,
  type ActorFacts,
  type CommandDecl,
  type CommandContext,
  type DeadlineContext,
  type DeadlineRow,
  type HandlerBase,
  type JsonObject,
  type JsonValue,
  type ModuleDefinition,
  type ModuleId,
  type ModuleState,
  type ModifierInput,
  type ModifierSource,
  type Phase,
  type ReportRow,
  type ResourceDecl,
  type ResourceId,
  type Effect,
  type Override,
  type PlannedWindow,
  type StockSnapshot,
  type TileRef,
  type UnitState,
  moduleIsOn,
  planHorizon,
  planIsFresh,
  planWindows,
  quarantineInForce,
  unitStates,
  windowsActiveAt,
  windowsEndedBetween,
  windowsStartedBetween,
  type Quarantine,
  type SkipNote,
} from "@tdl/kernel";
import { KERNEL_KEYS } from "@tdl/protocol";
import type { PoolClient } from "pg";
import { CommandRejected, StaleWriter, type Db } from "../db/index.js";
import type { Journal } from "../logger.js";
import {
  applyEffects,
  tilesOfPatches,
  type AppliedPatch,
  type AppliedReport,
  type ApplyResult,
  type SimFact,
} from "./effects.js";
import { createModuleStore } from "./store.js";
import { WorldClock, type Clock } from "./clock.js";
import type { WorldRow } from "../db/schema.js";

export interface ViewSink {
  patch(actorId: string, ops: AppliedPatch["ops"], serverNow: number): void;
  tiles(tiles: TileRef[], ops: AppliedPatch["ops"], serverNow: number, actorId: string): void;
  clan(clanId: string, ops: AppliedPatch["ops"], serverNow: number): void;
  error(actorId: string, key: string, params?: Record<string, string | number>): void;
  report(actorId: string, kind: string, rows: ReportRow[], serverNow: number): void;
}

/** На сколько дней вперёд считается план окон сборки. */
export const PLAN_HORIZON_DAYS = 120;
/** За сколько до конца плана его пересчитывают, чтобы окна не пропали. */
export const PLAN_REFRESH_MARGIN_MS = 7 * 86_400_000;
/** Как часто писатель снимает просроченные запреты и карантины. */
export const SWEEP_EVERY_MS = 5_000;
/** Сколько сбоев подряд за окно приводит к карантину. */
export const QUARANTINE_STRIKES = 3;
/** Окно счёта сбоев: дальше счёт начинается заново. */
export const STRIKE_WINDOW_MS = 60_000;
/** Обработчик дольше этого — уже сбой: игрок ждёт, значит что-то не так. */
export const SLOW_COMMAND_MS = 250;
/** Лечение с отступом: 60 с, 5 мин, 30 мин. Дальше нужен оператор. */
export const QUARANTINE_BACKOFF_MS = [60_000, 300_000, 1_800_000] as const;
/** Час спокойной работы забывает прошлые волны лечения. */
export const EPISODE_WINDOW_MS = 3_600_000;
/** Через сколько миллисекунд состояния единиц считаются устаревшими. */
export const SWITCHES_FRESH_MS = 1_000;

/** Сколько команд может ждать прохода. Дальше очередь не растёт: отказ сразу. */
export const QUEUE_LIMIT = 5_000;

/**
 * Сколько команда может стоять в очереди. Дальше её никто не ждёт: игрок
 * получил бы ответ через десятки секунд, а такой ответ уже бесполезен.
 */
export const QUEUE_WAIT_MS = 2_000;

/**
 * Сколько миллисекунд один проход отдаёт срокам. Документ архитектуры:
 * «пакет сроков не держит цикл событий дольше 50 мс», остаток — на следующий
 * проход, чтобы сокеты не ждали чужую пачку.
 */
const DEADLINE_BUDGET_MS = 50;

export type CommandOutcome =
  | { status: "ok"; repeat: boolean }
  | { status: "error"; key: string; params?: Record<string, string | number> };

interface QueuedCommand {
  /** Когда команда встала в очередь: по этим часам считается её срок. */
  queuedAtMs: number;
  actor: ActorFacts;
  commandId: string;
  payload: unknown;
  requestId: string;
  idempotencyKey: string;
  resolve(outcome: CommandOutcome): void;
}

/** Сколько наступивших сроков берётся одним запросом. */
const DEADLINE_BATCH = 16;

/** После стольких ошибок срок снимается: сломанный модуль не держит писателя. */
const MAX_DEADLINE_ATTEMPTS = 5;

interface TxContext {
  client: PoolClient;
}

export interface ActorProfile {
  portrait: string;
  bannerSign: string;
  bannerColor: string;
  type: string;
}

export interface ServiceOptions {
  db: Db;
  /** Портрет, знамя и тип лорда: лежат во внешней базе, не в снимке шага. */
  profileOf?: (actorId: string) => Promise<ActorProfile | null>;
  journal: Journal;
  registry: { order: readonly ModuleId[]; byId: ReadonlyMap<ModuleId, ModuleDefinition> };
  world: WorldRow;
  sink: ViewSink;
  processId: string;
  /** Часы сервера: в мире настоящие, в тестах подменяются. */
  calendar?: Clock;
  /** Пакет сроков не держит цикл дольше 50 мс. */
  stepBudgetMs?: number;
  pulseIntervalMs?: number;
  /** Сколько команда может ждать прохода: дальше отказ «команда устарела». */
  queueWaitMs?: number;
  now?: () => number;
  /** Отступы лечения: по умолчанию 60 с, 5 мин, 30 мин. */
  quarantineBackoffMs?: readonly number[];
  /** Порог «обработчик повис»: по умолчанию 250 мс. */
  slowCommandMs?: number;
  /** Сколько сбоев подряд приводит к карантину: по умолчанию три. */
  quarantineStrikes?: number;
  /** Окно счёта сбоев: по умолчанию минута. */
  strikeWindowMs?: number;
}

/** След сбоя: сколько раз и когда. В памяти, в базу попадает только карантин. */
interface StrikeRecord {
  /** Моменты сбоев: считаем только те, что попали в окно. */
  at: number[];
}

interface PreparedFacts {
  factsByModule: Record<ModuleId, Record<string, number>>;
  stock: StockSnapshot;
}

export class WorldService {
  readonly worldId: string;
  private readonly db: Db;
  private readonly journal: Journal;
  private readonly order: readonly ModuleId[];
  private readonly byId: ReadonlyMap<ModuleId, ModuleDefinition>;
  private readonly sink: ViewSink;
  private readonly processId: string;
  private readonly profileOf?: (actorId: string) => Promise<ActorProfile | null>;
  private readonly stepBudgetMs: number;
  private readonly deadlineBudgetMs: number;
  private readonly pulseIntervalMs: number;
  private readonly queueWaitMs: number;

  private readonly moduleStates = new Map<ModuleId, ModuleState>();
  /** Операторские запреты по модулям: срок и причина. */
  private readonly moduleOverrides = new Map<ModuleId, Override>();
  /** Операторские переключатели единиц: ключ «модуль.единица». */
  private readonly unitOverrides = new Map<string, Override>();
  /** План окон расписания и миг, на который он посчитан. */
  private planWindows: PlannedWindow[] = [];
  /** Состояния единиц на миг: пересчитываются, когда план устарел или время ушло. */
  private switchStates: UnitState[] = [];
  /** До какого мига посчитанные состояния единиц ещё верны. */
  private switchesValidUntilMs = 0;
  /** Когда в прошлый раз снимали просроченные запреты: не чаще раза в 5 с. */
  private sweepAtMs = 0;
  /** Здоровье единиц: сбои, карантин, нужда в операторе. */
  private readonly health = new Map<string, Quarantine & { moduleId: ModuleId; unitId: string | null; atMs: number }>();
  /** Следы сбоев в памяти: в базу попадает только состоявшийся карантин. */
  private readonly strikes = new Map<string, StrikeRecord>();
  /**
   * Волны лечения: сколько раз единицу уже лечили. Память держится после возврата,
   * иначе счёт начинался бы заново и замок «нужен оператор» не наступал бы никогда.
   */
  private readonly episodes = new Map<string, { count: number; at: number }>();
  /** Сроки, о заморозке которых уже сказано в журнале. */
  private readonly postponedNoted = new Set<string>();
  /** Какие окна расписания были открыты на прошлом шаге: для журнала старт/стоп. */
  private activeWindowKeys = new Set<string>();
  /** Счётчики расписания: сколько окон догнали и сколько пропустили. */
  private scheduleResumed = 0;
  private scheduleContinued = 0;
  private scheduleMissed = 0;
  private quarantines = 0;
  /** Пропуски полос из последнего плана: видны в /api/health. */
  private planSkipped: SkipNote[] = [];
  private readonly quarantineBackoffMs: readonly number[];
  private readonly slowCommandMs: number;
  private readonly quarantineStrikes: number;
  private readonly strikeWindowMs: number;
  private readonly queue: QueuedCommand[] = [];
  private readonly factsCache = new Map<string, PreparedFacts>();
  private readonly snapshots = new Map<string, JsonValue>();

  private world: WorldRow;
  /** Часы календаря: окна, сроки оператора, карантин. */
  private readonly calendar: Clock;
  /** Часы хода мира: сроки игроков. */
  private clockValue: WorldClock;
  private epoch = 0;
  private pumping = false;
  private stopped = false;
  /** Сбой шага: сколько раз подряд и до какого времени держим паузу. */
  private stepFailures = 0;
  private quietUntilMs = 0;
  /** Право писателя ушло другому процессу: этот выходит. */
  private leaseLost = false;
  private timer: NodeJS.Timeout | null = null;
  private pulseTimer: NodeJS.Timeout | null = null;
  private lastRejections = 0;
  /** Счётчики прохода: видны в /api/health и в замерочном прогоне. */
  private steps = 0;
  private deadlinesDone = 0;
  private commandsDone = 0;
  private lastStepMs = 0;
  /** Сколько длилась фаза сроков: по документу она не держит цикл дольше 50 мс. */
  private lastDeadlineMs = 0;
  /** Лаг сроков: сколько прошло от наступления до проведения. */
  private deadlineLagLastMs = 0;
  private deadlineLagMaxMs = 0;
  private deadlineLagSumMs = 0;
  private overflowed = 0;
  /** Команды, которым отказано по сроку годности в очереди. */
  private dropped = 0;

  constructor(options: ServiceOptions) {
    this.db = options.db;
    this.journal = options.journal;
    this.order = options.registry.order;
    this.byId = options.registry.byId;
    this.sink = options.sink;
    this.processId = options.processId;
    this.profileOf = options.profileOf;
    this.stepBudgetMs = options.stepBudgetMs ?? 50;
    this.deadlineBudgetMs = Math.min(DEADLINE_BUDGET_MS, this.stepBudgetMs);
    this.pulseIntervalMs = options.pulseIntervalMs ?? 10_000;
    this.queueWaitMs = options.queueWaitMs ?? QUEUE_WAIT_MS;
    this.quarantineBackoffMs = options.quarantineBackoffMs ?? QUARANTINE_BACKOFF_MS;
    this.slowCommandMs = options.slowCommandMs ?? SLOW_COMMAND_MS;
    this.quarantineStrikes = options.quarantineStrikes ?? QUARANTINE_STRIKES;
    this.strikeWindowMs = options.strikeWindowMs ?? STRIKE_WINDOW_MS;
    this.world = options.world;
    this.worldId = options.world.id;
    this.calendar = options.calendar ?? { now: () => Date.now() };
    this.clockValue = new WorldClock({ offsetMs: options.world.clockOffsetMs, lastWorldAtMs: options.now?.() ?? Date.now() });
  }

  /** Подъём мира: право писателя, простой, модули, наступившие сроки. */
  static async open(options: ServiceOptions): Promise<WorldService> {
    const service = new WorldService(options);
    await service.reloadModuleStates();
    await service.reloadHealth();
    await service.takeLease();
    const downtime = await service.applyDowntime();
    // Простой: окна живут по календарю, поэтому промежуток простоя для них —
    // реальное время. Начавшиеся окна догоняются по правилам полосы, кончившиеся
    // уходят в журнал пропущенными. Сроки игроков при этом не сгорают: они идут
    // по ходу мира, а он на простое стоял.
    if (downtime > 0) {
      const calendarNow = service.calendarNow();
      await service.resumeSchedule(calendarNow - downtime, calendarNow);
    }
    await service.drainDeadlines();
    return service;
  }

  /** Приём команд открывается только после подъёма: сроки уже проведены. */
  start(): void {
    if (this.stopped || this.timer) return;
    this.timer = setInterval(() => void this.pump(), 20);
    this.pulseTimer = setInterval(() => void this.writePulse().catch((error) => this.onFatal(error)), this.pulseIntervalMs);
    void this.pump();
  }

  /**
   * Плановая остановка: приём команд закрывается, текущая запись заканчивается,
   * пульс пишется в момент остановки. Дыра равна нулю.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.timer = null;
    this.pulseTimer = null;
    // Ждём текущий проход, чтобы запись закончилась сама.
    while (this.pumping) await new Promise((resolve) => setTimeout(resolve, 10));
    this.failPending();
    await this.writePulse().catch((error) => this.journal.write({ channel: "app", event: "pulse.failed", detail: String(error) }));
  }

  /** Сколько сроков уже наступило и лежит непроведённым: лаг виден снаружи. */
  async deadlineBacklog(): Promise<number> {
    const rows = await this.db.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM deadlines WHERE world_id = $1 AND wake_at_ms <= $2`,
      [this.worldId, this.now()],
    );
    return Number(rows.rows[0]?.n ?? 0);
  }

  /** Сколько команд ждёт прохода: нужно порту для ответа о нагрузке. */
  get pending(): number {
    return this.queue.length;
  }

  /** Право писателя потеряно: процесс обязан выйти, писать ему нельзя. */
  get lostLease(): boolean {
    return this.leaseLost;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  get worldFactsSnapshot(): WorldRow {
    return this.world;
  }

  stats(): {
    epoch: number;
    pending: number;
    rejections: number;
    failures: number;
    overflowed: number;
    dropped: number;
    steps: number;
    deadlinesDone: number;
    commandsDone: number;
    lastStepMs: number;
    lastDeadlineMs: number;
    deadlineLag: { last: number; max: number; avg: number };
    modulesEnabled: number;
    unitsEnabled: number;
    unitsQuarantined: number;
    unitsQuarantineLocked: number;
    windowsActive: number;
    windowsSkipped: number;
    scheduleResumed: number;
    scheduleContinued: number;
    scheduleMissed: number;
    planHorizonMs: number;
  } {
    return {
      epoch: this.epoch,
      pending: this.queue.length,
      rejections: this.lastRejections,
      failures: this.stepFailures,
      overflowed: this.overflowed,
      dropped: this.dropped,
      steps: this.steps,
      deadlinesDone: this.deadlinesDone,
      commandsDone: this.commandsDone,
      lastStepMs: Math.round(this.lastStepMs),
      lastDeadlineMs: Math.round(this.lastDeadlineMs),
      deadlineLag: {
        last: Math.round(this.deadlineLagLastMs),
        max: Math.round(this.deadlineLagMaxMs),
        avg: this.deadlinesDone === 0 ? 0 : Math.round(this.deadlineLagSumMs / this.deadlinesDone),
      },
      modulesEnabled: [...this.moduleStates.values()].filter((state) => state === "enabled").length,
      unitsEnabled: this.switches().filter((unit) => unit.state === "enabled").length,
      unitsQuarantined: this.quarantinesInForce().length,
      unitsQuarantineLocked: this.quarantinesInForce().filter((item) => item.needsOperator).length,
      windowsActive: windowsActiveAt(this.planWindows, this.calendarNow()).length,
      windowsSkipped: this.planSkipped.length,
      scheduleResumed: this.scheduleResumed,
      scheduleContinued: this.scheduleContinued,
      scheduleMissed: this.scheduleMissed,
      planHorizonMs: planHorizon(this.planWindows),
    };
  }

  /** Команда игрока встаёт в очередь писателя и обрабатывается в порядке прихода. */
  submitCommand(input: {
    actor: ActorFacts;
    commandId: string;
    payload: unknown;
    requestId: string;
    idempotencyKey: string;
  }): Promise<CommandOutcome> {
    if (this.stopped) return Promise.resolve({ status: "error", key: KERNEL_KEYS.stale });
    if (this.queue.length >= QUEUE_LIMIT) {
      // Очередь не растёт без предела: лучше отказ, чем память и задержка всем.
      this.overflowed += 1;
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: input.actor.id,
        requestId: input.requestId,
        event: "command.overflow",
        detail: { pending: this.queue.length, limit: QUEUE_LIMIT },
      });
      return Promise.resolve({ status: "error", key: KERNEL_KEYS.busy });
    }
    return new Promise((resolve) => {
      this.queue.push({ ...input, queuedAtMs: performance.now(), resolve });
    });
  }

  // --- модули -------------------------------------------------------------

  /**
   * Переключатель модуля. Единственный путь смены состояния снаружи:
   * кэш писателя и база меняются вместе, иначе модуль остался бы включённым
   * в памяти до следующего подъёма.
   */
  async setModuleState(
    moduleId: ModuleId,
    state: ModuleState,
    options: { until?: number; reason?: string } = {},
  ): Promise<void> {
    if (!this.byId.has(moduleId)) throw new Error(`модуль ${moduleId} не в сборке`);
    const value = state === "disabled" ? "disabled" : "enabled";
    const until = options.until && options.until > 0 ? Math.round(options.until) : 0;
    // Вернули модуль в строй без причины и срока — запись остаётся, но пустой:
    // состояние модуля живёт в той же строке, поэтому здесь только чистим срок и причину.
    await this.tx(async ({ client }) => {
      await client.query(
        `INSERT INTO module_states (world_id, module_id, state, version, until_ms, reason)
         VALUES ($1, $2, $3, 0, $4, $5)
         ON CONFLICT (world_id, module_id)
         DO UPDATE SET state = EXCLUDED.state, until_ms = EXCLUDED.until_ms, reason = EXCLUDED.reason`,
        [this.worldId, moduleId, value, until, options.reason ?? null],
      );
    });
    this.moduleStates.set(moduleId, value);
    if (value === "enabled") await this.clearQuarantineOf(moduleId, null);
    if (until > 0 || options.reason) {
      this.moduleOverrides.set(moduleId, {
        state: value,
        ...(until > 0 ? { until } : {}),
        ...(options.reason ? { reason: options.reason } : {}),
      });
    } else {
      this.moduleOverrides.delete(moduleId);
    }
    this.switchesValidUntilMs = 0;
    this.clearCaches();
    this.journal.write({
      channel: "app",
      worldId: this.worldId,
      event: `module.${value}`,
      detail: { moduleId, ...(until > 0 ? { until } : {}), ...(options.reason ? { reason: options.reason } : {}) },
    });
  }

  /**
   * Действующее состояние модуля: истекающий запрет считается уже снятым,
   * иначе «выключил на час» держалось бы до перезапуска мира.
   */
  private moduleIsEnabled(moduleId: ModuleId): boolean {
    const override = this.moduleOverrides.get(moduleId);
    if (override) return moduleIsOn(override, this.calendarNow());
    return this.moduleStates.get(moduleId) !== "disabled";
  }

  // --- здоровье единиц и карантин ----------------------------------------

  /** Ключ здоровья: единица «модуль.единица» или модуль целиком. */
  private scopeKeyOf(moduleId: ModuleId, unitId?: string | null): string {
    return unitId ? `${moduleId}.${unitId}` : moduleId;
  }

  /** Загрузка здоровья из базы: карантин переживает перезапуск мира. */
  private async reloadHealth(): Promise<void> {
    this.health.clear();
    const rows = await this.db.pool.query<{
      scope_key: string;
      module_id: string;
      unit_id: string | null;
      failures: number;
      until_ms: string | number;
      needs_operator: boolean;
      last_error: string | null;
      updated_at_ms: string | number;
    }>(`SELECT scope_key, module_id, unit_id, failures, until_ms, needs_operator, last_error, updated_at_ms FROM unit_health WHERE world_id = $1`, [
      this.worldId,
    ]);
    for (const row of rows.rows) {
      this.health.set(row.scope_key, {
        moduleId: row.module_id,
        unitId: row.unit_id,
        failures: Number(row.failures),
        until: Number(row.until_ms),
        needsOperator: Boolean(row.needs_operator),
        ...(row.last_error ? { lastError: row.last_error } : {}),
        atMs: Number(row.updated_at_ms),
      });
    }
  }

  /** Живой карантин: срок не вышел или ждём оператора. */
  quarantineFor(moduleId: ModuleId, unitId?: string | null): Quarantine | null {
    const now = this.calendarNow();
    const record = this.health.get(this.scopeKeyOf(moduleId, unitId));
    if (!record || !quarantineInForce(record, now)) return null;
    return record;
  }

  /** Все живые карантины: панель оператора и счётчики. */
  quarantinesInForce(): { scope: string; failures: number; until: number; needsOperator: boolean; lastError?: string }[] {
    const now = this.calendarNow();
    return [...this.health.entries()]
      .filter(([, record]) => quarantineInForce(record, now))
      .map(([scope, record]) => ({
        scope,
        failures: record.failures,
        until: record.until,
        needsOperator: Boolean(record.needsOperator),
        ...(record.lastError ? { lastError: record.lastError } : {}),
      }));
  }

  /** Карта карантинов для ядра переключателей: ключ — единица или модуль. */
  private quarantineMap(): Map<string, Quarantine> {
    const map = new Map<string, Quarantine>();
    const now = this.calendarNow();
    for (const [scope, record] of this.health) {
      if (!quarantineInForce(record, now)) continue;
      map.set(scope, record);
    }
    return map;
  }

  /**
   * Сбой единицы. Три удара подряд за окно или повисший обработчик —
   * карантин: единица уходит с расчёта, ядро лечит её с отступом.
   */
  private async recordFailure(
    moduleId: ModuleId,
    unitId: string | null,
    error: unknown,
    kind: "throw" | "slow" | "deadline",
  ): Promise<void> {
    const scope = this.scopeKeyOf(moduleId, unitId);
    const now = this.calendarNow();
    const message = String(error instanceof Error ? error.message : error).slice(0, 300);

    const record = this.strikes.get(scope) ?? { at: [] };
    record.at = record.at.filter((at) => now - at <= this.strikeWindowMs);
    record.at.push(now);
    this.strikes.set(scope, record);

    const enough = kind === "slow" || record.at.length >= this.quarantineStrikes;
    if (!enough) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId,
        event: "unit.strike",
        detail: { scope, strikes: record.at.length, kind, message },
      });
      return;
    }

    this.strikes.delete(scope);
    // Волна считается, пока сбои идут подряд; час спокойной работы всё забывает.
    const episode = this.episodes.get(scope);
    const fresh = episode && now - episode.at <= EPISODE_WINDOW_MS ? episode.count : 0;
    const failures = fresh + 1;
    this.episodes.set(scope, { count: failures, at: now });
    const backoff = this.quarantineBackoffMs[Math.min(failures - 1, this.quarantineBackoffMs.length - 1)] as number;
    const needsOperator = failures > this.quarantineBackoffMs.length;
    const entry = {
      moduleId,
      unitId,
      failures,
      until: needsOperator ? 0 : now + backoff,
      needsOperator,
      lastError: message,
      atMs: now,
    };
    this.health.set(scope, entry);
    this.quarantines += 1;

    await this.db.pool.query(
      `INSERT INTO unit_health (world_id, scope_key, module_id, unit_id, failures, until_ms, needs_operator, last_error, updated_at_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (world_id, scope_key) DO UPDATE SET
         failures = EXCLUDED.failures,
         until_ms = EXCLUDED.until_ms,
         needs_operator = EXCLUDED.needs_operator,
         last_error = EXCLUDED.last_error,
         updated_at_ms = EXCLUDED.updated_at_ms`,
      [this.worldId, scope, moduleId, unitId, failures, entry.until, needsOperator, message, now],
    );

    this.journal.write({
      channel: needsOperator ? "security" : "app",
      worldId: this.worldId,
      moduleId,
      event: needsOperator ? "unit.quarantine.locked" : "unit.quarantine",
      detail: {
        scope,
        failures,
        kind,
        message,
        ...(needsOperator ? { call: "оператор" } : { releaseAtMs: entry.until }),
      },
    });
    // Единица ушла с расчёта: состояния пересчитываются сразу.
    this.switchesValidUntilMs = 0;
  }

  /** Снять карантин: срок вышел — ядро само, иначе оператор. */
  private async releaseQuarantine(scope: string, by: "time" | "operator"): Promise<void> {
    if (!this.health.has(scope)) return;
    this.health.delete(scope);
    this.strikes.delete(scope);
    for (const note of [...this.postponedNoted]) {
      if (note.startsWith(`${scope}|`)) this.postponedNoted.delete(note);
    }
    await this.db.pool.query(`DELETE FROM unit_health WHERE world_id = $1 AND scope_key = $2`, [this.worldId, scope]);
    this.journal.write({ channel: "app", worldId: this.worldId, event: "unit.quarantine.release", detail: { scope, by } });
    this.switchesValidUntilMs = 0;
  }

  /** Оператор вернул единицу или модуль в строй: карантин снимается его волей. */
  private async clearQuarantineOf(moduleId: ModuleId, unitId?: string | null): Promise<void> {
    await this.releaseQuarantine(this.scopeKeyOf(moduleId, unitId ?? null), "operator");
    if (unitId) {
      // Карантин модуля держит и его единицы: воля оператора снимает и его.
      await this.releaseQuarantine(moduleId, "operator");
    }
    if (!unitId) {
      // Модуль вернули целиком: снимаем и карантины его единиц.
      for (const scope of [...this.health.keys()]) {
        if (scope.startsWith(`${moduleId}.`)) await this.releaseQuarantine(scope, "operator");
      }
    }
  }

  /** Лечение по сроку: вышел отступ — единица возвращается сама. */
  private async sweepQuarantine(): Promise<number> {
    const now = this.calendarNow();
    let released = 0;
    for (const [scope, record] of [...this.health]) {
      if (record.needsOperator) continue;
      if (record.until > now) continue;
      await this.releaseQuarantine(scope, "time");
      released += 1;
    }
    if (released > 0) this.postponedNoted.clear();
    return released;
  }

  /** Состояния модулей мира: смотр админа, панель и тесты. */
  statesOfModules(): { id: string; state: ModuleState; until?: number; reason?: string }[] {
    const now = this.calendarNow();
    return this.order
      .filter((id) => this.byId.has(id))
      .map((id) => {
        const override = this.moduleOverrides.get(id);
        const enabled = this.moduleIsEnabled(id);
        const inForce = override !== undefined && moduleIsOn(override, now) === false;
        return {
          id,
          state: enabled ? "enabled" : "disabled",
          ...(inForce && override?.until ? { until: override.until } : {}),
          ...(inForce && override?.reason ? { reason: override.reason } : {}),
        };
      });
  }

  /**
   * План окон расписания. Считается от якоря ядра, поэтому один и тот же день
   * всегда даёт один и тот же план; пересчитывается заранее, а не по концу.
   */
  schedulePlan(untilMs = 0): readonly PlannedWindow[] {
    const now = this.calendarNow();
    const wanted = Math.max(now + PLAN_HORIZON_DAYS * 86_400_000, untilMs);
    const covered = planHorizon(this.planWindows) >= wanted;
    if (this.planWindows.length === 0 || !covered || !planIsFresh(this.planWindows, now, PLAN_REFRESH_MARGIN_MS)) {
      const plan = planWindows({
        modules: [...this.byId.values()],
        from: now,
        to: wanted,
        tzOffsetMin: this.tzOffsetMin(),
        seed: Number(this.world.seed),
      });
      this.planWindows = plan.windows;
      this.planSkipped = plan.skipped;
      // Состояния пересчитываются вместе с планом: окна могли сдвинуться.
      this.switchesValidUntilMs = 0;
    }
    return this.planWindows;
  }

  /**
   * Тот же расчёт, но на любом промежутке и без кэша: он нужен догону, чтобы
   * увидеть окна, которых уже нет в плане от настоящего мига — те, что
   * начались и кончились, пока мир стоял.
   */
  private planOver(fromMs: number, toMs: number): readonly PlannedWindow[] {
    return planWindows({
      modules: [...this.byId.values()],
      from: fromMs,
      to: toMs,
      tzOffsetMin: this.tzOffsetMin(),
      seed: Number(this.world.seed),
    }).windows;
  }

  /**
   * Догон расписания после простоя. Правила по полосам:
   * точное окно (праздник, пора года) — догоняем, если оно ещё идёт;
   * повседневное (`rotation`) — не догоняем: вчерашнего дня не бывает;
   * кончившееся окно — пропуск, в журнал `schedule.skipped`.
   */
  async resumeSchedule(
    fromMs: number,
    toMs: number,
  ): Promise<{ resumed: string[]; continued: string[]; missed: string[] }> {
    // План от настоящего мига видит только идущие окна: окна, кончившиеся за
    // простой, в него уже не попадают. Поэтому промежуток считается отдельно,
    // и списки складываются по ключу окна.
    const gapFrom = Math.min(fromMs, toMs) - 86_400_000;
    const byKey = new Map<string, PlannedWindow>();
    for (const window of [...this.planOver(gapFrom, toMs), ...this.schedulePlan(toMs + 86_400_000)]) {
      byKey.set(window.key, window);
    }
    const windows = [...byKey.values()];
    const started = windowsStartedBetween(windows, fromMs, toMs);
    const ended = windowsEndedBetween(windows, fromMs, toMs);
    const now = toMs;
    const resumed: string[] = [];
    const continued: string[] = [];
    const missed: string[] = [];
    /**
     * Пропуски по единицам: за долгий простой их сотни, и построчный журнал
     * утонул бы. В журнал идёт итог, а точные ключи — в ответе и счётчиках.
     */
    const skipped = new Map<
      string,
      { moduleId: ModuleId; unitId: string; lane: string | null; count: number; reason: string; firstKey: string; lastKey: string }
    >();
    const noteSkipped = (window: PlannedWindow, reason: string): void => {
      missed.push(window.key);
      this.scheduleMissed += 1;
      const bucket = skipped.get(window.unitId) ?? {
        moduleId: window.moduleId,
        unitId: window.unitId,
        lane: window.lane,
        count: 0,
        reason,
        firstKey: window.key,
        lastKey: window.key,
      };
      bucket.count += 1;
      bucket.lastKey = window.key;
      skipped.set(window.unitId, bucket);
    };

    for (const window of started) {
      if (!this.moduleIsEnabled(window.moduleId)) {
        // Модуль закрыт: окно прошло мимо — догонять нечего, пока его не вернут.
        noteSkipped(window, "module.off");
        continue;
      }
      const rolling = window.source === "rotation";
      const remaining = window.stop - now;
      if (remaining <= 0) {
        // Окно началось и кончилось, пока мир стоял: игрок в нём не был.
        noteSkipped(window, rolling ? "downtime.rotation" : "downtime.ended");
        continue;
      }
      if (rolling) {
        // Повседневное окно догонять нельзя: вчерашнего дня не бывает.
        // Но если оно ещё идёт — оно просто продолжается, и игрок в нём участвует.
        continued.push(window.key);
        this.scheduleContinued += 1;
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          moduleId: window.moduleId,
          event: "schedule.continue",
          detail: { key: window.key, reason: "downtime.rotation", remainingMs: remaining },
        });
        continue;
      }
      resumed.push(window.key);
      this.scheduleResumed += 1;
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId: window.moduleId,
        event: "schedule.resume",
        detail: { key: window.key, unit: window.unitId, lane: window.lane, remainingMs: remaining },
      });
    }

    for (const window of ended) {
      if (started.some((other) => other.key === window.key)) continue;
      if (!this.moduleIsEnabled(window.moduleId)) continue;
      noteSkipped(window, "downtime.ended");
    }
    // Журнал не заваливаем: по простою подводим итог на каждую единицу.
    for (const note of [...skipped.values()]) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId: note.moduleId,
        event: "schedule.skipped",
        detail: {
          unit: note.unitId,
          lane: note.lane,
          count: note.count,
          reason: note.reason,
          firstKey: note.firstKey,
          lastKey: note.lastKey,
        },
      });
    }

    // Открытые окна берём на учёт: дальше ядро пишет старт и стоп как обычно.
    this.activeWindowKeys = new Set(windowsActiveAt(windows, now).map((window) => window.key));
    this.switchesValidUntilMs = 0;
    return { resumed, continued, missed };
  }

  /**
   * Журнал расписания: старт и стоп окон. Состояния считает ядро переключателей,
   * а журнал нужен модулям и оператору: видно, что началось и что кончилось.
   */
  private refreshScheduleJournal(): void {
    const now = this.calendarNow();
    const active = windowsActiveAt(this.schedulePlan(), now);
    const keys = new Set(active.map((window) => window.key));
    for (const window of active) {
      if (this.activeWindowKeys.has(window.key)) continue;
      this.activeWindowKeys.add(window.key);
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId: window.moduleId,
        event: "schedule.start",
        detail: { key: window.key, unit: window.unitId, lane: window.lane, stop: window.stop },
      });
    }
    for (const key of [...this.activeWindowKeys]) {
      if (keys.has(key)) continue;
      this.activeWindowKeys.delete(key);
      this.journal.write({ channel: "app", worldId: this.worldId, event: "schedule.stop", detail: { key } });
    }
  }

  /** Часовой сдвиг мира: у мира свои часы, расписание идёт по ним. */
  private tzOffsetMin(): number {
    return Number(process.env.TDL_TZ_OFFSET_MIN ?? 180);
  }

  /**
   * Что включено сейчас. Единицы с расписанием включаются и гаснут сами,
   * классика живёт до воли оператора, точечный запрет сильнее всего.
   */
  switches(): readonly UnitState[] {
    const windows = this.schedulePlan();
    const now = this.calendarNow();
    // Кэш живёт до ближайшего события: конца окна, срока запрета или срока свежести.
    if (this.switchStates.length > 0 && now < this.switchesValidUntilMs) return this.switchStates;
    const modules = this.moduleOverrideMap();
    this.switchStates = unitStates({
      definitions: [...this.byId.values()],
      windows,
      modules,
      units: this.unitOverrides,
      quarantined: this.quarantineMap(),
      now,
    });
    this.switchesValidUntilMs = now + SWITCHES_FRESH_MS;
    for (const override of [...modules.values(), ...this.unitOverrides.values()]) {
      if (override.until && override.until > now) {
        this.switchesValidUntilMs = Math.min(this.switchesValidUntilMs, override.until);
      }
    }
    for (const window of windows) {
      // Ближайший край окна меняет состояние: раньше него кэш держится.
      if (window.start > now) this.switchesValidUntilMs = Math.min(this.switchesValidUntilMs, window.start);
      if (window.stop > now) this.switchesValidUntilMs = Math.min(this.switchesValidUntilMs, window.stop);
    }
    return this.switchStates;
  }

  private moduleOverrideMap(): Map<ModuleId, Override> {
    const map = new Map<ModuleId, Override>();
    const now = this.calendarNow();
    for (const id of this.order) {
      if (!this.byId.has(id)) continue;
      // Истёкший запрет не отдаём: ядро переключателей и так считает его снятым,
      // а панель не должна показывать «выключен» у работающего модуля.
      const stored = this.moduleOverrides.get(id);
      if (stored && stored.until !== undefined && stored.until <= now) continue;
      const state = this.moduleStates.get(id) === "disabled" ? "disabled" : "enabled";
      const override = this.moduleOverrides.get(id);
      const fromDeclaration =
        !this.moduleOverrides.has(id) && state === "disabled" && this.byId.get(id)?.defaultState === "disabled";
      map.set(id, {
        state,
        ...(override?.until ? { until: override.until } : {}),
        ...(override?.reason ? { reason: override.reason } : {}),
        ...(fromDeclaration ? { fromDeclaration: true } : {}),
      });
    }
    return map;
  }

  /** Состояние единицы на этот миг: null — единицы нет в сборке. */
  unitStateOf(key: string): UnitState | null {
    return this.switches().find((unit) => unit.key === key) ?? null;
  }

  /** Состояние единиц модуля: панель оператора и проверки. */
  statesOfUnits(moduleId?: ModuleId): UnitState[] {
    const list = [...this.switches()];
    return moduleId ? list.filter((unit) => unit.moduleId === moduleId) : list;
  }

  /**
   * Точечный переключатель единицы. Срок и причина — необязательны:
   * без срока запрет держится, пока его не снимут.
   */
  async setUnitState(
    moduleId: ModuleId,
    unitId: string,
    state: ModuleState,
    options: { until?: number; reason?: string } = {},
  ): Promise<void> {
    const def = this.byId.get(moduleId);
    if (!def) throw new Error(`модуль ${moduleId} не в сборке`);
    if (!(def.units ?? []).some((unit) => unit.id === unitId)) {
      throw new Error(`единицы ${unitId} нет в модуле ${moduleId}`);
    }
    const value = state === "disabled" ? "disabled" : "enabled";
    const until = options.until && options.until > 0 ? Math.round(options.until) : 0;
    // «Включено без срока и причины» — это не запрет, а пустая запись: её не храним,
    // иначе таблица копила бы следы каждого касания оператора.
    const noop = value === "enabled" && until === 0 && !options.reason;
    await this.tx(async ({ client }) => {
      if (noop) {
        await client.query(`DELETE FROM unit_states WHERE world_id = $1 AND module_id = $2 AND unit_id = $3`, [
          this.worldId,
          moduleId,
          unitId,
        ]);
        return;
      }
      await client.query(
        `INSERT INTO unit_states (world_id, module_id, unit_id, state, version, until_ms, reason)
         VALUES ($1, $2, $3, $4, 0, $5, $6)
         ON CONFLICT (world_id, module_id, unit_id)
         DO UPDATE SET state = EXCLUDED.state, until_ms = EXCLUDED.until_ms, reason = EXCLUDED.reason`,
        [this.worldId, moduleId, unitId, value, until, options.reason ?? null],
      );
    });
    const key = `${moduleId}.${unitId}`;
    if (until === 0 && !options.reason && value === "enabled") {
      // Снятый запрет не оставляет следа: дальше решает расписание.
      this.unitOverrides.delete(key);
    } else {
      this.unitOverrides.set(key, { state: value, ...(until > 0 ? { until } : {}), ...(options.reason ? { reason: options.reason } : {}) });
    }
    if (value === "enabled") await this.clearQuarantineOf(moduleId, unitId);
    this.switchesValidUntilMs = 0;
    this.clearCaches();
    this.journal.write({
      channel: "app",
      worldId: this.worldId,
      moduleId,
      event: `unit.${value}`,
      detail: { key, ...(until > 0 ? { until } : {}), ...(options.reason ? { reason: options.reason } : {}) },
    });
  }

  private async reloadModuleStates(): Promise<void> {
    this.moduleStates.clear();
    this.moduleOverrides.clear();
    const rows = await this.db.pool.query<{
      module_id: string;
      state: string;
      until_ms: string | number | null;
      reason: string | null;
    }>(`SELECT module_id, state, until_ms, reason FROM module_states WHERE world_id = $1`, [this.worldId]);
    for (const row of rows.rows) {
      const state = row.state === "disabled" ? "disabled" : "enabled";
      this.moduleStates.set(row.module_id, state);
      const until = Number(row.until_ms ?? 0);
      if (until > 0 || row.reason) {
        this.moduleOverrides.set(row.module_id, {
          state,
          ...(until > 0 ? { until } : {}),
          ...(row.reason ? { reason: row.reason } : {}),
        });
      }
    }
    await this.reloadUnitStates();
  }

  /** Точечные переключатели единиц: записи есть только там, где вмешался оператор. */
  private async reloadUnitStates(): Promise<void> {
    this.unitOverrides.clear();
    const rows = await this.db.pool.query<{
      module_id: string;
      unit_id: string;
      state: string;
      until_ms: string | number | null;
      reason: string | null;
    }>(`SELECT module_id, unit_id, state, until_ms, reason FROM unit_states WHERE world_id = $1`, [this.worldId]);
    for (const row of rows.rows) {
      const until = Number(row.until_ms ?? 0);
      const override: Override = {
        state: row.state === "disabled" ? "disabled" : "enabled",
        ...(until > 0 ? { until } : {}),
        ...(row.reason ? { reason: row.reason } : {}),
      };
      // Просроченные записи не выбрасываем: ядро переключателей само считает их снятыми,
      // так что мир ведёт себя одинаково и до перезапуска, и после.
      this.unitOverrides.set(`${row.module_id}.${row.unit_id}`, override);
    }
  }

  private enabled(): ModuleDefinition[] {
    const list: ModuleDefinition[] = [];
    for (const id of this.order) {
      const def = this.byId.get(id);
      if (!def) continue;
      if (!this.moduleIsEnabled(id)) continue;
      list.push(def);
    }
    return list;
  }

  /** Таблицы модуля: во чужие ядро писать не даёт. */
  private tablesOf(moduleId: ModuleId): ReadonlySet<string> {
    const def = this.byId.get(moduleId);
    return new Set(def?.server?.tables ?? []);
  }

  private modifierSources(): ModifierSource[] {
    return this.enabled().map((def) => ({ moduleId: def.id, modifiers: def.rules?.modifiers ?? [] }));
  }

  /** Открытые модули: клиент по этому списку решает, какие гнёзда заполнены. */
  openModuleIds(): ModuleId[] {
    return this.enabled().map((def) => def.id);
  }

  /** Ресурсы, объявленные включёнными модулями. Отдельной колонки в ядре нет. */
  declaredResources(): ResourceDecl[] {
    const seen = new Map<ResourceId, ResourceDecl>();
    for (const def of this.enabled()) {
      for (const resource of def.rules?.resources ?? []) seen.set(resource.id, resource);
    }
    return [...seen.values()];
  }

  // --- мир ----------------------------------------------------------------

  private worldFacts(now: number) {
    return {
      id: this.world.id,
      name: this.world.name,
      seed: this.world.seed,
      size: this.world.size,
      zones: this.world.zones,
      zonePit: this.world.zonePit,
      zoneCapital: this.world.zoneCapital,
      now,
      downtimeMs: this.clockValue.offset,
    };
  }

  /**
   * Время сервера: по нему идёт календарь — окна событий, сроки оператора и
   * карантин. Оно настоящее и не стоит: событие, назначенное на 1 марта, идёт
   * 1 марта, даже если мир перед этим лежал сутки.
   */
  calendarNow(): number {
    return this.calendar.now();
  }

  /**
   * Ход мира: по нему идут сроки игроков (марш, стройка, сбор). Стоит, пока
   * процесс не работает, поэтому оставшиеся минуты на простое не сгорают.
   */
  now(): number {
    return this.clockValue.now();
  }

  private async takeLease(): Promise<void> {
    const result = await this.db.pool.query<{ epoch: string }>(
      `INSERT INTO writer_leases (world_id, epoch, holder, heartbeat_at)
       VALUES ($1, 1, $2, now())
       ON CONFLICT (world_id) DO UPDATE SET
         epoch = writer_leases.epoch + 1,
         holder = EXCLUDED.holder,
         heartbeat_at = now()
       RETURNING epoch`,
      [this.worldId, this.processId],
    );
    this.epoch = Number(result.rows[0]?.epoch ?? 1);
    this.journal.write({
      channel: "app",
      worldId: this.worldId,
      event: "writer.take",
      detail: { epoch: this.epoch, holder: this.processId },
    });
  }

  private async applyDowntime(): Promise<number> {
    const pulse = await this.db.pool.query<{ real_at_ms: string; world_at_ms: string }>(
      `SELECT real_at_ms, world_at_ms FROM world_pulse WHERE world_id = $1`,
      [this.worldId],
    );
    const row = pulse.rows[0];
    const nowReal = this.calendarNow();
    let downtimeMs = 0;
    if (row) {
      const realAt = Number(row.real_at_ms);
      const worldAt = Number(row.world_at_ms);
      downtimeMs = Math.max(0, nowReal - realAt);
      // Пульс — единственный источник правды: в нём сходятся и настоящие часы,
      // и ход мира на один миг. Сдвиг считаем из него, а не копим в базе:
      // испорченная запись не сдвинет мир назад и не заморозит его навсегда.
      const sane = worldAt > 0 && worldAt <= nowReal;
      if (sane) {
        this.clockValue = new WorldClock({ offsetMs: nowReal - worldAt, lastWorldAtMs: worldAt });
      } else {
        this.clockValue = new WorldClock({ offsetMs: this.world.clockOffsetMs, lastWorldAtMs: nowReal });
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          event: "pulse.suspect",
          detail: { realAtMs: realAt, worldAtMs: worldAt, downtimeMs },
        });
      }
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "world.resume",
        detail: { downtimeMs, worldAt: this.clockValue.now(), calendarNow: nowReal },
      });
    } else {
      this.clockValue = new WorldClock({ offsetMs: 0, lastWorldAtMs: nowReal });
    }
    this.world = { ...this.world, clockOffsetMs: this.clockValue.offset };
    await this.db.pool.query(`UPDATE worlds SET clock_offset_ms = $2 WHERE world_id = $1`, [
      this.worldId,
      this.clockValue.offset,
    ]);
    await this.writePulse();
    return downtimeMs;
  }

  /**
   * Пульс пишется в транзакции с проверкой права: старый процесс не имеет
   * права сдвинуть пульс, иначе простой следующего подъёма посчитается неверно.
   */
  private async writePulse(): Promise<void> {
    const worldAt = this.clockValue.now();
    await this.tx(async ({ client }) => {
      await client.query(
        `INSERT INTO world_pulse (world_id, real_at_ms, world_at_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (world_id) DO UPDATE SET real_at_ms = EXCLUDED.real_at_ms, world_at_ms = EXCLUDED.world_at_ms`,
        [this.worldId, Date.now(), worldAt],
      );
      await client.query(`UPDATE writer_leases SET heartbeat_at = now() WHERE world_id = $1 AND epoch = $2`, [
        this.worldId,
        this.epoch,
      ]);
    });
  }

  // --- транзакция ---------------------------------------------------------

  /**
   * Одна транзакция шага. Право писателя проверяется в начале под блокировкой:
   * старый процесс после подъёма нового писать не может.
   */
  private async tx<T>(run: (ctx: TxContext) => Promise<T>): Promise<T> {
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      const lease = await client.query<{ epoch: string; holder: string }>(
        `SELECT epoch, holder FROM writer_leases WHERE world_id = $1 FOR UPDATE`,
        [this.worldId],
      );
      const row = lease.rows[0];
      if (!row || Number(row.epoch) !== this.epoch || row.holder !== this.processId) {
        throw new StaleWriter(this.worldId);
      }
      const result = await run({ client });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Соединение уже мертво: откат не нужен.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private onFatal(error: unknown): void {
    if (error instanceof StaleWriter) {
      this.leaseLost = true;
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      if (this.pulseTimer) clearInterval(this.pulseTimer);
      this.timer = null;
      this.pulseTimer = null;
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        event: "writer.lost",
        detail: { epoch: this.epoch, holder: this.processId },
      });
      this.failPending();
      return;
    }
    // Сбой базы не должен превращаться в поток записей: пауза растёт, журнал не частит.
    this.stepFailures += 1;
    this.quietUntilMs = Date.now() + this.backoffMs();
    if (this.stepFailures === 1 || this.stepFailures % 20 === 0) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "world.error",
        detail: { failures: this.stepFailures, error: String(error) },
      });
    }
  }

  /** Пауза после сбоя: 25 мс, 50, 100… не больше пяти секунд. */
  private backoffMs(): number {
    const step = Math.min(this.stepFailures, 8);
    return Math.min(5_000, 25 * 2 ** step);
  }

  /** Очередь не висит: команда без ответа не должна ждать вечно. */
  private failPending(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.resolve({ status: "error", key: KERNEL_KEYS.generic });
    }
  }

  // --- снимок и факты -----------------------------------------------------

  private async stockOf(holderId: string, client?: PoolClient): Promise<StockSnapshot> {
    const rows = await (client ?? this.db.pool).query<{ resource_id: string; amount: string }>(
      `SELECT resource_id, amount FROM stock WHERE world_id = $1 AND holder_id = $2`,
      [this.worldId, holderId],
    );
    const stock: Record<ResourceId, number> = {};
    for (const resource of this.declaredResources()) stock[resource.id] = 0;
    for (const row of rows.rows) stock[row.resource_id] = Number(row.amount);
    return stock;
  }

  private syntheticActor(holderId: string): ActorFacts {
    return { id: holderId, worldId: this.worldId, name: "", clanId: null, isBot: false };
  }

  /** Снимок модуля: читает свои таблицы, чужих не видит. */
  private async snapshotFor(moduleId: ModuleId, actor: ActorFacts | null, client?: PoolClient): Promise<JsonValue> {
    const key = `${moduleId}|${actor?.id ?? "-"}`;
    const cached = this.snapshots.get(key);
    if (cached !== undefined) return cached;
    const def = this.byId.get(moduleId);
    if (!def?.server?.snapshot) {
      this.snapshots.set(key, null);
      return null;
    }
    const store = createModuleStore(client ?? this.db.pool, this.worldId, moduleId);
    const reader = async (): Promise<DeadlineRow[]> => {
      const rows = await (client ?? this.db.pool).query<{
        id: string;
        owner: string;
        wake_at_ms: string;
        key: string;
        payload: JsonValue | null;
      }>(
        `SELECT id, owner, wake_at_ms, key, payload FROM deadlines
         WHERE world_id = $1 AND owner = $2 ORDER BY wake_at_ms ASC`,
        [this.worldId, moduleId],
      );
      return rows.rows.map((row) => ({
        id: row.id,
        owner: row.owner,
        wakeAt: Number(row.wake_at_ms),
        key: row.key,
        payload: row.payload,
      }));
    };
    try {
      const state = await def.server.snapshot({
        world: this.worldFacts(this.now()),
        actor,
        now: this.now(),
        store,
        deadlines: reader,
      });
      const value = (state ?? null) as JsonValue;
      this.snapshots.set(key, value);
      return value;
    } catch (error) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId,
        event: "module.snapshot.failed",
        detail: String(error),
      });
      this.snapshots.set(key, null);
      return null;
    }
  }

  /**
   * Факты модулей для расчёта модификаторов: каждый модуль видит только свои.
   * Склад читается свежим всегда: снимок склада в памяти устаревает за шаг.
   */
  private async factsFor(holderId: string, client?: PoolClient): Promise<PreparedFacts> {
    const cached = this.factsCache.get(holderId);
    const stock = await this.stockOf(holderId, client);
    if (cached) return { factsByModule: cached.factsByModule, stock };
    const actor = holderId === "world" ? null : this.syntheticActor(holderId);
    const factsByModule: Record<ModuleId, Record<string, number>> = {};
    for (const def of this.enabled()) {
      const state = await this.snapshotFor(def.id, actor, client);
      const row: Record<string, number> = {};
      for (const [factKey, resolver] of Object.entries(def.server?.facts ?? {})) {
        try {
          const value = resolver(state, {
            world: this.worldFacts(this.now()),
            actor,
            stock,
            state,
            now: this.now(),
          });
          if (Number.isFinite(value)) row[factKey] = value;
        } catch (error) {
          this.journal.write({
            channel: "app",
            worldId: this.worldId,
            moduleId: def.id,
            event: "module.fact.failed",
            detail: String(error),
          });
        }
      }
      factsByModule[def.id] = row;
    }
    const prepared: PreparedFacts = { factsByModule, stock };
    this.factsCache.set(holderId, prepared);
    return prepared;
  }

  private clearCaches(): void {
    this.factsCache.clear();
    this.snapshots.clear();
  }

  private moderation(holderId: string, prepared: PreparedFacts) {
    return {
      modulate: (phase: Phase, base: number, input: ModifierInput = {}): number => {
        return modulateDetailed({
          phase,
          base,
          input,
          sources: this.modifierSources(),
          env: {
            world: this.worldFacts(this.now()),
            actor: holderId === "world" ? undefined : this.syntheticActor(holderId),
            stock: prepared.stock,
            factsByModule: prepared.factsByModule,
          },
        }).value;
      },
      modulateDetailed: (phase: Phase, base: number, input: ModifierInput = {}) =>
        modulateDetailed({
          phase,
          base,
          input,
          sources: this.modifierSources(),
          env: {
            world: this.worldFacts(this.now()),
            actor: holderId === "world" ? undefined : this.syntheticActor(holderId),
            stock: prepared.stock,
            factsByModule: prepared.factsByModule,
          },
        }),
    };
  }

  /**
   * Предел склада. Двор считается по своим фактам: чужой двор получает
   * свой предел, а не предел действующего. Нет фактов — читаем и считаем.
   */
  private async limitFor(
    holderId: string,
    resource: ResourceId,
    client?: PoolClient,
  ): Promise<number | null> {
    const holder = holderId;
    const facts = this.factsCache.get(holder) ?? (await this.factsFor(holder, client));
      const details = modulateDetailed({
        phase: "limit",
        base: 0,
        input: { resource, subject: "court" },
        sources: this.modifierSources(),
        env: {
          world: this.worldFacts(this.now()),
          actor: holder === "world" ? undefined : this.syntheticActor(holder),
          stock: facts.stock,
          factsByModule: facts.factsByModule,
        },
    });
    if (details.parts.length === 0) return null;
    return normalizeLimit(details.value);
  }

  private async handlerBase(
    moduleId: ModuleId,
    actor: ActorFacts | null,
    meta: { requestId: string; idempotencyKey: string; client?: PoolClient },
  ): Promise<HandlerBase> {
    const holderId = actor?.id ?? "world";
    const prepared = await this.factsFor(holderId, meta.client);
    const facts = prepared.factsByModule[moduleId] ?? {};
    const state = await this.snapshotFor(moduleId, actor, meta.client);
    const store = createModuleStore(meta.client ?? this.db.pool, this.worldId, moduleId);
    const deadlines = async (): Promise<DeadlineRow[]> => {
      const rows = await (meta.client ?? this.db.pool).query<{
        id: string;
        owner: string;
        wake_at_ms: string;
        key: string;
        payload: JsonValue | null;
      }>(
        `SELECT id, owner, wake_at_ms, key, payload FROM deadlines WHERE world_id = $1 AND owner = $2 ORDER BY wake_at_ms ASC`,
        [this.worldId, moduleId],
      );
      return rows.rows.map((row) => ({
        id: row.id,
        owner: row.owner,
        wakeAt: Number(row.wake_at_ms),
        key: row.key,
        payload: row.payload,
      }));
    };
    const modulation = this.moderation(holderId, prepared);
    return {
      world: this.worldFacts(this.now()),
      actor,
      now: this.now(),
      requestId: meta.requestId,
      idempotencyKey: meta.idempotencyKey,
      stock: prepared.stock,
      state,
      facts,
      store,
      deadlines,
      modulate: modulation.modulate,
      modulateDetailed: modulation.modulateDetailed,
    };
  }

  // --- проход писателя ----------------------------------------------------

  /** Один проход вручную: такты, тесты и служебные команды. */
  async pumpOnce(): Promise<void> {
    await this.pump();
  }

  /**
   * Снятие просроченных запретов: и модуль, и единица возвращаются сами.
   * Записи не копятся и в базе не врут: «выключил и забыл» невозможно.
   */
  private async sweepExpiredOverrides(): Promise<number> {
    const now = this.calendarNow();
    if (now - this.sweepAtMs < SWEEP_EVERY_MS) return 0;
    this.sweepAtMs = now;
    let restored = 0;
    const expiredModules: ModuleId[] = [];
    for (const [id, override] of this.moduleOverrides) {
      if (override.until !== undefined && override.until <= now) expiredModules.push(id);
    }
    const expiredUnits: string[] = [];
    for (const [key, override] of this.unitOverrides) {
      if (override.until !== undefined && override.until <= now) expiredUnits.push(key);
    }
    if (expiredModules.length === 0 && expiredUnits.length === 0) return 0;
    await this.tx(async ({ client }) => {
      for (const id of expiredModules) {
        // Возврат — в объявленное состояние, а не всегда во «включено»: модуль,
        // рождённый закрытым, ждёт своего шага плана, и временная воля оператора
        // не делает его вечным.
        await client.query(
          `UPDATE module_states SET state = $3, until_ms = 0, reason = NULL
           WHERE world_id = $1 AND module_id = $2`,
          [this.worldId, id, this.byId.get(id)?.defaultState ?? "enabled"],
        );
      }
      for (const key of expiredUnits) {
        const dot = key.indexOf(".");
        await client.query(`DELETE FROM unit_states WHERE world_id = $1 AND module_id = $2 AND unit_id = $3`, [
          this.worldId,
          key.slice(0, dot),
          key.slice(dot + 1),
        ]);
      }
    });
    for (const id of expiredModules) {
      this.moduleOverrides.delete(id);
      const declared = this.byId.get(id)?.defaultState ?? "enabled";
      this.moduleStates.set(id, declared);
      restored += 1;
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId: id,
        event: "module.service.restored",
        detail: { state: declared },
      });
    }
    for (const key of expiredUnits) {
      this.unitOverrides.delete(key);
      restored += 1;
      this.journal.write({ channel: "app", worldId: this.worldId, event: "unit.restored", detail: key });
    }
    if (restored > 0) this.switchesValidUntilMs = 0;
    return restored;
  }

  private async pump(): Promise<void> {
    if (this.stopped || this.pumping || Date.now() < this.quietUntilMs) return;
    this.pumping = true;
    this.clearCaches();
    // Просроченные запреты снимаются до работы шага: мир возвращается сам.
    await this.sweepExpiredOverrides();
    // Лечение карантина: вышел отступ — единица вернулась в расчёт.
    await this.sweepQuarantine();
    // Журнал расписания: старт и стоп окон.
    this.refreshScheduleJournal();
    const startedAt = performance.now();
    try {
      const stepEndsAt = startedAt + this.stepBudgetMs;
      // Сроки идут первыми, но не съедают весь бюджет: остаток — командам.
      const deadlineEndsAt = Math.min(startedAt + this.deadlineBudgetMs, stepEndsAt);
      while (!this.stopped && performance.now() < deadlineEndsAt) {
        const batch = await this.fetchDue(DEADLINE_BATCH);
        if (batch.length === 0) break;
        const { runnable, postponed } = this.splitQuarantined(batch);
        // Вся выборка ждёт лечения: крутить её в этом проходе нечего.
        if (runnable.length === 0 && postponed > 0) break;
        let worked = false;
        for (const row of runnable) {
          if (this.stopped || performance.now() >= deadlineEndsAt) break;
          await this.runDeadline(row);
          worked = true;
          this.deadlinesDone += 1;
          // Лаг: срок мог наступить раньше, чем его успели провести.
          const lag = Math.max(0, this.clockValue.now() - row.wakeAt);
          this.deadlineLagLastMs = lag;
          this.deadlineLagMaxMs = Math.max(this.deadlineLagMaxMs, lag);
          this.deadlineLagSumMs += lag;
          // Снимок, собранный до эффектов, устаревает за один шаг.
          this.clearCaches();
        }
        if (!worked) break;
      }
      this.lastDeadlineMs = performance.now() - startedAt;
      while (!this.stopped && this.queue.length > 0 && performance.now() < stepEndsAt) {
        const next = this.queue.shift();
        if (!next) break;
        if (performance.now() - next.queuedAtMs > this.queueWaitMs) {
          // Мир не успевает: честнее отказать, чем отвечать через полминуты.
          this.dropped += 1;
          if (this.dropped === 1 || this.dropped % 20 === 0) {
            this.journal.write({
              channel: "app",
              worldId: this.worldId,
              actorId: next.actor.id,
              requestId: next.requestId,
              event: "command.dropped",
              detail: { waitedMs: Math.round(performance.now() - next.queuedAtMs), dropped: this.dropped },
            });
          }
          next.resolve({ status: "error", key: KERNEL_KEYS.stale });
          continue;
        }
        try {
          next.resolve(await this.runCommand(next));
        } catch (error) {
          // Команда уже снята с очереди: ответ ей всё равно нужен.
          next.resolve({ status: "error", key: KERNEL_KEYS.generic });
          throw error;
        }
        this.commandsDone += 1;
        this.clearCaches();
      }
      this.stepFailures = 0;
      this.quietUntilMs = 0;
    } catch (error) {
      this.onFatal(error);
    } finally {
      this.steps += 1;
      this.lastStepMs = performance.now() - startedAt;
      this.pumping = false;
    }
  }

  /** Наступившие сроки проводятся до приёма команд. */
  private async drainDeadlines(): Promise<void> {
    this.clearCaches();
    const startedAt = performance.now();
    let taken = 0;
    for (;;) {
      const batch = await this.fetchDue(DEADLINE_BATCH);
      if (batch.length === 0) break;
      const { runnable, postponed } = this.splitQuarantined(batch);
      if (runnable.length === 0 && postponed > 0) break;
      for (const row of runnable) {
        await this.runDeadline(row);
        this.clearCaches();
        taken += 1;
      }
      if (performance.now() - startedAt > 30_000) {
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          event: "deadlines.drain.slow",
          detail: { taken },
        });
        break;
      }
    }
    if (taken > 0) {
      this.journal.write({ channel: "app", worldId: this.worldId, event: "deadlines.drained", detail: { taken } });
    }
  }

  /** Срок ждёт возврата единицы: в журнал — один раз на карантин. */
  private notePostponed(row: DeadlineRow, quarantine: Quarantine): void {
    const scope = this.scopeKeyOf(row.owner, row.unitId ?? null);
    const note = `${scope}|${row.key}`;
    if (this.postponedNoted.has(note)) return;
    this.postponedNoted.add(note);
    this.journal.write({
      channel: "app",
      worldId: this.worldId,
      moduleId: row.owner,
      event: "deadline.postponed",
      detail: { key: row.key, scope, until: quarantine.until, failures: quarantine.failures },
    });
  }

  /** Сроки карантинных единиц в работу не берутся: они ждут возврата. */
  private splitQuarantined(batch: DeadlineRow[]): { runnable: DeadlineRow[]; postponed: number } {
    const runnable: DeadlineRow[] = [];
    let postponed = 0;
    for (const row of batch) {
      const quarantine = this.quarantineFor(row.owner, row.unitId ?? null) ?? this.quarantineFor(row.owner, null);
      if (quarantine) {
        this.notePostponed(row, quarantine);
        postponed += 1;
      } else {
        runnable.push(row);
      }
    }
    return { runnable, postponed };
  }

  private async fetchDue(limit: number): Promise<DeadlineRow[]> {
    const owners = this.enabled().map((def) => def.id);
    if (owners.length === 0) return [];
    const rows = await this.db.pool.query<{
      id: string;
      owner: string;
      unit_id: string | null;
      wake_at_ms: string;
      key: string;
      payload: JsonValue | null;
    }>(
      `SELECT id, owner, unit_id, wake_at_ms, key, payload FROM deadlines
       WHERE world_id = $1 AND wake_at_ms <= $2 AND owner = ANY($3)
       ORDER BY wake_at_ms ASC, id ASC
       LIMIT $4`,
      [this.worldId, this.clockValue.now(), owners, limit],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      owner: row.owner,
      ...(row.unit_id ? { unitId: row.unit_id } : {}),
      wakeAt: Number(row.wake_at_ms),
      key: row.key,
      payload: row.payload,
    }));
  }

  /**
   * Один срок. Строка удаляется в той же транзакции, что и эффекты:
   * повторный проход не создаёт второе событие.
   */
  private async runDeadline(row: DeadlineRow): Promise<void> {
    const def = this.byId.get(row.owner);
    // Карантин единицы или модуля: срок не пропадает, работа ждёт возврата.
    const quarantine = this.quarantineFor(row.owner, row.unitId ?? null) ?? this.quarantineFor(row.owner, null);
    if (quarantine) {
      this.notePostponed(row, quarantine);
      return;
    }
    if (!def || !def.onDeadline) {
      await this.tx(async ({ client }) => {
        await client.query(`DELETE FROM deadlines WHERE world_id = $1 AND id = $2 AND wake_at_ms = $3`, [
          this.worldId,
          row.id,
          row.wakeAt,
        ]);
        await client.query(
          `INSERT INTO sim_rejections (world_id, module_id, deadline_id, reason) VALUES ($1, $2, $3, $4)`,
          [this.worldId, row.owner, row.id, "deadline.owner.missing"],
        );
      });
      return;
    }
    let postCommit: ApplyResult | null = null;
    const simFacts: SimFact[] = [];
    try {
      await this.tx(async ({ client }) => {
        const deleted = await client.query<{ id: string }>(
          `DELETE FROM deadlines WHERE world_id = $1 AND id = $2 AND wake_at_ms = $3 RETURNING id`,
          [this.worldId, row.id, row.wakeAt],
        );
        if (deleted.rowCount === 0) return;
        const base = await this.handlerBase(def.id, null, {
          requestId: `deadline:${row.id}`,
          idempotencyKey: row.key,
          client,
        });
        const ctx: DeadlineContext = { ...base, deadline: row };
        const effects = await def.onDeadline?.(ctx);
        const applied = await this.applyInTx(client, def.id, null, effects ?? [], {
          requestId: `deadline:${row.id}`,
          idempotencyKey: row.key,
          commandId: null,
          holderId: "world",
          simFacts,
        });
        postCommit = applied;
      });
      if (postCommit) await this.publish(postCommit, null);
    } catch (error) {
      if (error instanceof StaleWriter) throw error;
      const refused = error instanceof CommandRejected;
      const attempts = await this.countAttempt(row.id);
      // Модуль отказал — строка снимается. Ошибка модуля — строка пробуется
      // снова, но не бесконечно: иначе один сломанный срок держит писателя.
      const abandon = !refused && attempts >= MAX_DEADLINE_ATTEMPTS;
      const reason = refused ? "deadline.refused" : abandon ? "deadline.abandoned" : "deadline.failed";
      if (!refused) await this.recordFailure(def.id, row.unitId ?? null, error, "deadline");
      this.journal.write({
        channel: refused || abandon ? "sim" : "app",
        worldId: this.worldId,
        moduleId: def.id,
        event: reason,
        detail: { message: String(error instanceof Error ? error.message : error), attempts },
      });
      try {
        await this.tx(async ({ client }) => {
          if (refused || abandon) {
            await client.query(`DELETE FROM deadlines WHERE world_id = $1 AND id = $2`, [this.worldId, row.id]);
          } else {
            await client.query(`UPDATE deadlines SET attempts = attempts + 1 WHERE world_id = $1 AND id = $2`, [
              this.worldId,
              row.id,
            ]);
          }
          await client.query(
            `INSERT INTO sim_rejections (world_id, module_id, deadline_id, reason, detail) VALUES ($1, $2, $3, $4, $5)`,
            [
              this.worldId,
              def.id,
              row.id,
              reason,
              JSON.stringify({ message: String(error instanceof Error ? error.message : error), attempts }),
            ],
          );
          for (const fact of simFacts) {
            await client.query(
              `INSERT INTO sim_rejections (world_id, actor_id, module_id, deadline_id, request_id, reason, claimed, computed, detail)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                this.worldId,
                fact.actorId,
                def.id,
                row.id,
                `deadline:${row.id}`,
                fact.reason,
                fact.claimed === null ? null : JSON.stringify(fact.claimed),
                fact.computed === null ? null : JSON.stringify(fact.computed),
                JSON.stringify({ extra: fact.extra }),
              ],
            );
          }
        });
      } catch (writeError) {
        if (writeError instanceof StaleWriter) throw writeError;
        this.journal.write({
          channel: "app",
          worldId: this.worldId,
          event: "deadline.write.failed",
          detail: String(writeError),
        });
      }
    }
  }

  /** Сколько раз этот срок уже пробовали провести. */
  private async countAttempt(deadlineId: string): Promise<number> {
    const rows = await this.db.pool.query<{ attempts: number }>(
      `SELECT attempts FROM deadlines WHERE world_id = $1 AND id = $2`,
      [this.worldId, deadlineId],
    );
    return Number(rows.rows[0]?.attempts ?? 0);
  }

  /** Команда игрока: схема, право, идемпотентность, обработчик, эффекты. */
  private async runCommand(queued: QueuedCommand): Promise<CommandOutcome> {
    const moduleId = queued.commandId.split(".")[0] ?? "";
    const def = this.byId.get(moduleId);
    const decl = def?.server?.commands?.find((command) => command.id === queued.commandId);
    if (!def || !decl) {
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: queued.actor.id,
        requestId: queued.requestId,
        event: "command.unknown",
        detail: { commandId: queued.commandId },
      });
      return { status: "error", key: KERNEL_KEYS.unknown };
    }
    if (!this.moduleIsEnabled(moduleId)) {
      return { status: "error", key: KERNEL_KEYS.disabled };
    }
    // Команда принадлежит единице: точечный переключатель закрывает её сам.
    if (decl.unit) {
      const unit = this.unitStateOf(`${moduleId}.${decl.unit}`);
      if (!unit) {
        this.journal.write({
          channel: "security",
          worldId: this.worldId,
          actorId: queued.actor.id,
          moduleId,
          requestId: queued.requestId,
          event: "command.unknown",
          detail: { commandId: queued.commandId, unit: decl.unit },
        });
        return { status: "error", key: KERNEL_KEYS.unknown };
      }
      if (unit.state === "disabled") {
        const key =
          unit.reason === "between-windows"
            ? KERNEL_KEYS.betweenWindows
            : unit.reason === "quarantine"
              ? KERNEL_KEYS.quarantine
              : KERNEL_KEYS.disabled;
        this.journal.write({
          channel: "security",
          worldId: this.worldId,
          actorId: queued.actor.id,
          moduleId,
          requestId: queued.requestId,
          event: "command.unit.closed",
          detail: { commandId: queued.commandId, unit: unit.key, reason: unit.reason },
        });
        return { status: "error", key };
      }
    } else if (this.quarantineFor(moduleId, null)) {
      // У команды нет своей единицы: её держит карантин модуля целиком.
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: queued.actor.id,
        moduleId,
        requestId: queued.requestId,
        event: "command.unit.closed",
        detail: { commandId: queued.commandId, reason: "quarantine" },
      });
      return { status: "error", key: KERNEL_KEYS.quarantine };
    }
    const parsed = this.parseInput(decl, queued.payload);
    if (!parsed.ok) {
      this.journal.write({
        channel: "security",
        worldId: this.worldId,
        actorId: queued.actor.id,
        moduleId,
        requestId: queued.requestId,
        event: "command.schema",
        detail: { commandId: queued.commandId, problems: parsed.problems },
      });
      await this.writeSecurityRow(queued, "command.schema", parsed.problems);
      return { status: "error", key: KERNEL_KEYS.badInput };
    }

    let outcome: CommandOutcome = { status: "ok", repeat: false };
    let applied: ApplyResult | null = null;
    const simFacts: SimFact[] = [];
    /** Сколько занял обработчик: сторож судит по этому числу. */
    let slowMs = 0;
    try {
      await this.tx(async ({ client }) => {
        const inserted = await client.query(
          `INSERT INTO commands (world_id, idempotency_key, request_id, actor_id, module_id, command_id, outcome, at_ms)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
           ON CONFLICT (world_id, idempotency_key) DO NOTHING
           RETURNING idempotency_key`,
          [
            this.worldId,
            queued.idempotencyKey,
            queued.requestId,
            queued.actor.id,
            moduleId,
            queued.commandId,
            this.clockValue.now(),
          ],
        );
        if (inserted.rowCount === 0) {
          const previous = await client.query<{ outcome: string; error_key: string | null; command_id: string }>(
            `SELECT outcome, error_key, command_id FROM commands WHERE world_id = $1 AND idempotency_key = $2`,
            [this.worldId, queued.idempotencyKey],
          );
          const row = previous.rows[0];
          if (row && row.command_id !== queued.commandId) {
            // Ключ повтора принадлежит другой команде: это не повтор, а подмена.
            this.journal.write({
              channel: "security",
              worldId: this.worldId,
              actorId: queued.actor.id,
              moduleId,
              requestId: queued.requestId,
              event: "command.key-reuse",
              detail: { idempotencyKey: queued.idempotencyKey, stored: row.command_id },
            });
            outcome = { status: "error", key: KERNEL_KEYS.badInput };
            return;
          }
          await client.query(
            `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, outcome, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, 'repeat', $6)`,
            [this.worldId, queued.actor.id, moduleId, queued.requestId, queued.commandId, queued.idempotencyKey],
          );
          outcome =
            row?.outcome === "error"
              ? { status: "error", key: row.error_key ?? KERNEL_KEYS.generic }
              : { status: "ok", repeat: true };
          return;
        }

        const base = await this.handlerBase(moduleId, queued.actor, {
          requestId: queued.requestId,
          idempotencyKey: queued.idempotencyKey,
          client,
        });
        const ctx: CommandContext = base;
        // Сторож: обработчик дольше порога — команда откатывается, единица лечится.
        const handlerStartedAt = performance.now();
        const effects = await decl.handle(ctx, parsed.value as never);
        slowMs = performance.now() - handlerStartedAt;
        if (slowMs > this.slowCommandMs) {
          this.journal.write({
            channel: "sim",
            worldId: this.worldId,
            moduleId,
            actorId: queued.actor.id,
            requestId: queued.requestId,
            event: "sim.command.slow",
            detail: { commandId: queued.commandId, unit: decl.unit ?? null, ms: Math.round(slowMs) },
          });
          throw new CommandRejected(KERNEL_KEYS.busy, { channel: "sim" });
        }
        applied = await this.applyInTx(client, moduleId, queued.actor, effects, {
          requestId: queued.requestId,
          idempotencyKey: queued.idempotencyKey,
          commandId: queued.commandId,
          holderId: queued.actor.id,
          simFacts,
        });
        await client.query(
          `UPDATE commands SET outcome = 'ok' WHERE world_id = $1 AND idempotency_key = $2`,
          [this.worldId, queued.idempotencyKey],
        );
      });
    } catch (error) {
      if (error instanceof StaleWriter) throw error;
      if (error instanceof CommandRejected) {
        await this.recordRejection(queued, moduleId, error, simFacts);
        // Повисший обработчик — тоже сбой: единица идёт на лечение.
        if (slowMs > this.slowCommandMs) {
          await this.recordFailure(moduleId, decl.unit ?? null, `обработчик ${Math.round(slowMs)} мс`, "slow");
        }
        return { status: "error", key: error.effectsKey, params: error.params };
      }
      // Клиент не получает след исключения: только ключ словаря.
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        moduleId,
        actorId: queued.actor.id,
        requestId: queued.requestId,
        event: "command.failed",
        detail: String(error instanceof Error ? error.message : error),
      });
      await this.recordFailure(moduleId, decl.unit ?? null, error, "throw");
      await this.recordRejection(queued, moduleId, new CommandRejected(KERNEL_KEYS.generic), simFacts);
      return { status: "error", key: KERNEL_KEYS.generic };
    }
    if (applied) await this.publish(applied, queued.actor);
    return outcome;
  }

  private parseInput(
    decl: CommandDecl<JsonObject>,
    payload: unknown,
  ): { ok: true; value: unknown } | { ok: false; problems: string[] } {
    const validator = decl.input as unknown as {
      safeParse?: (input: unknown) => { success: boolean; data?: unknown; error?: unknown };
      parse?: (input: unknown) => unknown;
    };
    if (typeof validator.safeParse === "function") {
      const result = validator.safeParse(payload);
      if (result.success) return { ok: true, value: result.data };
      return { ok: false, problems: [String(result.error)] };
    }
    try {
      return { ok: true, value: validator.parse?.(payload) };
    } catch (error) {
      return { ok: false, problems: [String(error)] };
    }
  }

  private async writeSecurityRow(queued: QueuedCommand, event: string, problems: string[]): Promise<void> {
    await this.db.pool
      .query(
        `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, detail)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          this.worldId,
          queued.actor.id,
          queued.commandId.split(".")[0] ?? null,
          queued.requestId,
          event,
          JSON.stringify({ problems }),
        ],
      )
      .catch(() => undefined);
  }

  /** Отказ пишется отдельной короткой транзакцией после отката игровой. */
  private async recordRejection(
    queued: QueuedCommand,
    moduleId: ModuleId,
    error: CommandRejected,
    simFacts: readonly SimFact[] = [],
  ): Promise<void> {
    this.journal.write({
      channel: error.channel,
      worldId: this.worldId,
      actorId: queued.actor.id,
      moduleId,
      requestId: queued.requestId,
      event: error.effectsKey,
    });
    try {
      await this.tx(async ({ client }) => {
        await client.query(
          `INSERT INTO commands (world_id, idempotency_key, request_id, actor_id, module_id, command_id, outcome, error_key, at_ms)
           VALUES ($1, $2, $3, $4, $5, $6, 'error', $7, $8)
           ON CONFLICT (world_id, idempotency_key) DO UPDATE SET outcome = 'error', error_key = EXCLUDED.error_key`,
          [
            this.worldId,
            queued.idempotencyKey,
            queued.requestId,
            queued.actor.id,
            moduleId,
            queued.commandId,
            error.effectsKey,
            this.clockValue.now(),
          ],
        );
        await client.query(
          `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, detail)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            this.worldId,
            queued.actor.id,
            moduleId,
            queued.requestId,
            error.effectsKey,
            JSON.stringify({ channel: error.channel }),
          ],
        );
        for (const fact of simFacts) {
          await client.query(
            `INSERT INTO sim_rejections (world_id, actor_id, module_id, request_id, reason, claimed, computed, detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              this.worldId,
              fact.actorId ?? queued.actor.id,
              moduleId,
              queued.requestId,
              fact.reason,
              fact.claimed === null ? null : JSON.stringify(fact.claimed),
              fact.computed === null ? null : JSON.stringify(fact.computed),
              JSON.stringify({ commandId: queued.commandId, idempotencyKey: queued.idempotencyKey, extra: fact.extra }),
            ],
          );
        }
        await client.query(
          `INSERT INTO audit_log (world_id, actor_id, module_id, request_id, command_id, outcome, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            this.worldId,
            queued.actor.id,
            moduleId,
            queued.requestId,
            queued.commandId,
            error.effectsKey,
            queued.idempotencyKey,
          ],
        );
      });
    } catch (writeError) {
      this.journal.write({
        channel: "app",
        worldId: this.worldId,
        event: "rejection.write.failed",
        detail: String(writeError),
      });
    }
  }

  private async applyInTx(
    client: PoolClient,
    moduleId: ModuleId,
    actor: ActorFacts | null,
    effects: readonly Effect[],
    meta: {
      requestId: string;
      idempotencyKey: string;
      commandId: string | null;
      holderId: string;
      /** Сюда ядро кладёт расхождения: при откате их пишет отдельная транзакция. */
      simFacts?: SimFact[];
    },
  ): Promise<ApplyResult> {
    const prepared = await this.factsFor(meta.holderId, client);
    const limitOf = (holder: string, resource: ResourceId) => this.limitFor(holder, resource, client);
    const applied = await applyEffects(
      {
        client,
        tablesOf: (moduleId) => this.tablesOf(moduleId),
        worldId: this.worldId,
        now: this.clockValue.now(),
        moduleId,
        actor,
        journal: this.journal,
        requestId: meta.requestId,
        commandId: meta.commandId,
        idempotencyKey: meta.idempotencyKey,
        limitOf,
        simFacts: meta.simFacts ?? [],
      },
      effects,
    );
    return applied;
  }

  /**
   * Рассылка после коммита. Клиент не должен видеть изменение, которое может
   * откатиться, а снимок отчёта обязан читаться уже по зафиксированному миру:
   * поэтому кеши сбрасываются до рассылки, а не после.
   */
  private async publish(applied: ApplyResult, actor: ActorFacts | null): Promise<void> {
    this.clearCaches();
    const serverNow = this.clockValue.now();
    for (const patch of applied.patches) this.deliverPatch(patch, actor, serverNow);
    for (const report of applied.reports) this.sink.report(report.id, report.kind, report.rows, serverNow);
    this.lastRejections += applied.clamped.length;
    await this.afterCommit({ disabledModules: applied.disabledModules });
  }

  /**
   * Состояние модуля меняется после коммита: внутри транзакции база ещё
   * не видна другому соединению, и выключенный модуль получил бы вызов.
   */
  private async afterCommit(result: { disabledModules: ModuleId[] }): Promise<void> {
    if (result.disabledModules.length === 0) return;
    for (const moduleId of result.disabledModules) this.moduleStates.set(moduleId, "disabled");
    await this.reloadModuleStates();
    this.clearCaches();
  }

  private deliverPatch(patch: AppliedPatch, actor: ActorFacts | null, serverNow: number): void {
    switch (patch.route.kind) {
      case "actor": {
        const id = patch.route.id ?? actor?.id ?? "world";
        this.sink.patch(id, patch.ops, serverNow);
        break;
      }
      case "tiles": {
        this.sink.tiles(patch.route.tiles, patch.ops, serverNow, actor?.id ?? "world");
        break;
      }
      case "clan": {
        if (actor?.clanId) this.sink.clan(actor.clanId, patch.ops, serverNow);
        break;
      }
    }
  }

  tilesOfPatches(patches: readonly AppliedPatch[]): TileRef[] {
    return tilesOfPatches(patches);
  }

  /** Снимок вида игрока: мир, я, склад, состояния модулей. */
  async view(actor: ActorFacts | null): Promise<JsonValue> {
    const holderId = actor?.id ?? "world";
    const prepared = await this.factsFor(holderId);
    const modules: Record<string, JsonValue> = {};
    for (const def of this.enabled()) {
      modules[def.id] = await this.snapshotFor(def.id, actor);
    }
    const profile = actor && this.profileOf ? await this.profileOf(actor.id) : null;
    return {
      world: this.worldFacts(this.clockValue.now()),
      me: actor
        ? {
            id: actor.id,
            name: actor.name,
            clanId: actor.clanId,
            portrait: profile?.portrait ?? "",
            bannerSign: profile?.bannerSign ?? "",
            bannerColor: profile?.bannerColor ?? "",
            type: profile?.type ?? "",
          }
        : null,
      stock: prepared.stock,
      modules,
    };
  }

  /** Служебные данные для админской панели: строки отказов. */
  async rejections(limit = 50): Promise<JsonValue[]> {
    const rows = await this.db.pool.query(
      `SELECT id, ts, actor_id, module_id, reason, claimed, computed FROM sim_rejections
       WHERE world_id = $1 ORDER BY id DESC LIMIT $2`,
      [this.worldId, limit],
    );
    return rows.rows as JsonValue[];
  }
}
