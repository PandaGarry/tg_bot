/**
 * Расписание. Модуль не запускает себя: он объявляет окна, а ядро считает
 * план и гасит/включает единицы. Расчёт чистый и повторяемый: один и тот же
 * день даёт один и тот же план, поэтому календарь можно напечатать заранее.
 *
 * Все времена — по часам мира (серверное время мира), а не по часам игрока:
 * часовые пояса игроков на расписание не влияют.
 */

import type { ModuleDefinition } from "./module.js";
import type { ModuleId } from "./types.js";
import {
  LANES,
  daysInMonth,
  seasonOfMonth,
  type LaneId,
  type RotationDecl,
  type SeasonId,
  type UnitDecl,
  type UnitId,
  type UnitRole,
  type WindowDecl,
  type WindowRepeat,
} from "./units.js";

const DAY_MS = 86_400_000;

/** Сколько дней до начала промежутка ядро всё равно считает: стык года и длинные окна. */
const WARMUP_DAYS = 400;

/** Точка отсчёта круговорота повседневных окон. План устойчив: якорь не плывёт. */
export const SCHEDULE_ANCHOR_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

export interface PlannedWindow {
  moduleId: ModuleId;
  unitId: UnitId;
  lane: LaneId | null;
  role: UnitRole;
  /** Ключ окна: «единица:начало». Повтор окна невозможен. */
  key: string;
  start: number;
  stop: number;
  source: "window" | "rotation";
}

export interface PlanOptions {
  modules: readonly ModuleDefinition[];
  /** Начало плана: мировое время. */
  from: number;
  /** Конец плана: мировое время. */
  to: number;
  /** Сдвиг часов мира от UTC в минутах: серверное время мира. */
  tzOffsetMin: number;
  /** Зерно мира: выбор повседневных окон. */
  seed: number;
  anchorMs?: number;
  /**
   * Примерка поры года: пока оператор держит включённой не ту пору, что на
   * календаре, содержимое повседневных окон берётся по его поре. Дни вне
   * промежутка живут по календарю — это примерка, а не новый календарь.
   */
  seasonOverride?: { season: SeasonId; fromMs: number; toMs: number };
}

export interface SkipNote {
  moduleId: ModuleId;
  unitId: UnitId;
  lane: LaneId;
  dayIndex: number;
  reason: "lane-busy" | "lane-gap" | "lane-month" | "lane-day" | "cooldown";
}

interface LaneState {
  intervals: { start: number; stop: number; unitId: UnitId; moduleId: ModuleId }[];
  lastUnit: UnitId | null;
  lastStop: number;
  monthCount: Map<string, number>;
  dayCount: Map<number, number>;
}

function dayIndex(ms: number, tzOffsetMin: number): number {
  return Math.floor((ms + tzOffsetMin * 60_000) / DAY_MS);
}

function dayStartMs(index: number, tzOffsetMin: number): number {
  return index * DAY_MS - tzOffsetMin * 60_000;
}

function monthKey(index: number, tzOffsetMin: number): string {
  const parts = partsOf(index, tzOffsetMin);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

/** Начало дня месяца `at` (0–1439 минут) по часам мира. */
function atMs(index: number, at: number, tzOffsetMin: number): number {
  return dayStartMs(index, tzOffsetMin) + at * 60_000;
}

function minutesOf(at: string): number {
  const [hours, minutes] = at.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Случайность плана: одна и та же на входе — один и тот же выбор. */
export function hash32(...parts: (string | number)[]): number {
  let value = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    value ^= 0x2f;
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/** Пасха по григорианскому календарю (Меёс/Джонс/Батчер). Дата одна на весь мир. */
export function easterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

interface DayParts {
  year: number;
  month: number;
  day: number;
  /** 0 — понедельник, 6 — воскресенье. */
  weekday: number;
}

/**
 * Календарные части местного дня. Номер дня `index` отсчитывается по местным
 * суткам, поэтому и части берутся с местной полуночи, а не с UTC-полуночи,
 * иначе окна по точным датам уезжают на сутки.
 */
function partsOf(index: number, tzOffsetMin: number): DayParts {
  // Местная полночь, прочитанная как UTC: компоненты даты — это календарь мира.
  const date = new Date(dayStartMs(index, tzOffsetMin) + tzOffsetMin * 60_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: (date.getUTCDay() + 6) % 7,
  };
}

function occurs(repeat: WindowRepeat, parts: DayParts): boolean {
  switch (repeat.kind) {
    case "movable": {
      const easter = easterDate(parts.year);
      const shifted = new Date(Date.UTC(parts.year, easter.month - 1, easter.day + repeat.offsetDays));
      return (
        shifted.getUTCMonth() + 1 === parts.month &&
        shifted.getUTCDate() === parts.day &&
        shifted.getUTCFullYear() === parts.year
      );
    }
    case "daily":
      return true;
    case "weekly":
      return parts.weekday === repeat.weekday;
    case "monthly":
      return parts.day === repeat.day;
    case "yearly":
      return parts.month === repeat.month && parts.day === repeat.day;
    case "once":
      return parts.year === repeat.year && parts.month === repeat.month && parts.day === repeat.day;
  }
}

/** Конец окна: длина или стык с рубежом (у пор года — ровно до следующей поры). */
function stopOf(window: WindowDecl, index: number, tzOffsetMin: number): number {
  const start = atMs(index, minutesOf(window.at), tzOffsetMin);
  if (!window.until) return start + window.lengthMs;
  const parts = partsOf(index, tzOffsetMin);
  const repeat = window.repeat as { month: number; day: number };
  const crosses =
    window.until.month < repeat.month || (window.until.month === repeat.month && window.until.day <= repeat.day);
  const targetYear = crosses ? parts.year + 1 : parts.year;
  const span = Math.round(
    (Date.UTC(targetYear, window.until.month - 1, window.until.day) -
      Date.UTC(parts.year, parts.month - 1, parts.day)) /
      DAY_MS,
  );
  return dayStartMs(index + span, tzOffsetMin);
}

function monthCountWithin(state: LaneState, key: string): number {
  return state.monthCount.get(key) ?? 0;
}

/** Кладёт окно в полосу, если правила полосы это позволяют. Иначе — причина отказа. */
function addWindow(
  state: LaneState,
  window: { start: number; stop: number; unitId: UnitId; moduleId: ModuleId },
  lane: LaneId,
  index: number,
  month: string,
): SkipNote["reason"] | null {
  const rules = LANES[lane];
  if (monthCountWithin(state, month) >= rules.maxPerMonth) return "lane-month";
  if ((state.dayCount.get(index) ?? 0) >= rules.maxPerDay) return "lane-day";
  for (const other of state.intervals) {
    if (window.start < other.stop && other.start < window.stop) return "lane-busy";
    const gap = window.start >= other.stop ? window.start - other.stop : other.start - window.stop;
    if (rules.minGapMs > 0 && gap < rules.minGapMs) return "lane-gap";
  }
  state.intervals.push(window);
  state.intervals.sort((left, right) => left.start - right.start);
  state.lastUnit = window.unitId;
  state.lastStop = window.stop;
  state.dayCount.set(index, (state.dayCount.get(index) ?? 0) + 1);
  state.monthCount.set(month, monthCountWithin(state, month) + 1);
  return null;
}

interface PoolCandidate {
  unit: UnitDecl;
  moduleId: ModuleId;
}

/** План окон: точные даты идут первыми, повседневные окна выбираются после них. */
export function planWindows(options: PlanOptions): { windows: PlannedWindow[]; skipped: SkipNote[] } {
  const tz = options.tzOffsetMin;
  const anchorMs = options.anchorMs ?? SCHEDULE_ANCHOR_MS;
  const anchorIndex = dayIndex(anchorMs, tz);
  const fromIndex = dayIndex(options.from, tz);
  const toIndex = dayIndex(options.to, tz);
  // Разогрев: окна, начавшиеся до запрошенного промежутка, должны быть видны как идущие,
  // иначе на стыке года «пропадает» зима. Год разогрева длиннее любого окна сборки.
  const startIndex = Math.min(anchorIndex, fromIndex) - WARMUP_DAYS;
  const lanes = new Map<LaneId, LaneState>();
  const laneOf = (id: LaneId): LaneState => {
    const existing = lanes.get(id);
    if (existing) return existing;
    const created: LaneState = {
      intervals: [],
      lastUnit: null,
      lastStop: 0,
      monthCount: new Map(),
      dayCount: new Map(),
    };
    lanes.set(id, created);
    return created;
  };

  const windows: PlannedWindow[] = [];
  const skipped: SkipNote[] = [];
  const cooldownUntil = new Map<UnitId, number>();

  // Пул повседневных окон: модуль, единица, объявление.
  const pools = new Map<LaneId, { moduleId: ModuleId; unit: UnitDecl }[]>();
  const declared: { moduleId: ModuleId; unit: UnitDecl }[] = [];
  for (const definition of options.modules) {
    for (const unit of definition.units ?? []) {
      declared.push({ moduleId: definition.id, unit });
      if (unit.rotation) {
        const list = pools.get(unit.rotation.lane) ?? [];
        list.push({ moduleId: definition.id, unit });
        pools.set(unit.rotation.lane, list);
      }
    }
  }

  const push = (moduleId: ModuleId, unit: UnitDecl, start: number, stop: number, source: PlannedWindow["source"]): void => {
    if (stop <= options.from || start >= options.to) return;
    windows.push({
      moduleId,
      unitId: unit.id,
      lane: unit.lane ?? null,
      role: unit.role,
      key: scheduleKey(unit.id, start),
      start,
      stop,
      source,
    });
  };

  for (let index = startIndex; index <= toIndex; index += 1) {
    const parts = partsOf(index, tz);
    // 1. Точные окна: праздники, поры года, большое событие месяца.
    for (const { moduleId, unit } of declared) {
      const window = unit.window;
      if (!window || !occurs(window.repeat, parts)) continue;
      const start = atMs(index, minutesOf(window.at), tz);
      const stop = stopOf(window, index, tz);
      if (unit.lane) {
        const state = laneOf(unit.lane);
        const reason = addWindow(state, { start, stop, unitId: unit.id, moduleId }, unit.lane, index, monthKey(index, tz));
        if (reason) {
          skipped.push({ moduleId, unitId: unit.id, lane: unit.lane, dayIndex: index, reason });
          continue;
        }
      }
      push(moduleId, unit, start, stop, "window");
    }

    // 2. Повседневные окна: выбираются по дате, без случайности процесса.
    for (const [lane, pool] of pools) {
      const state = laneOf(lane);
      const month = monthKey(index, tz);
      if (monthCountWithin(state, month) >= LANES[lane].maxPerMonth) continue;
      const dayIndexValue = index;
      const parts4 = parts;
      const season = seasonForDay(parts4.month, dayStartMs(index, tz), options.seasonOverride);
      const fits = ({ unit }: { unit: UnitDecl }): boolean => {
        const rotation = unit.rotation as RotationDecl;
        if (rotation.weekdays && !rotation.weekdays.includes(parts4.weekday)) return false;
        if (rotation.months && !rotation.months.includes(parts4.month)) return false;
        if (rotation.seasons && !rotation.seasons.includes(season)) return false;
        return true;
      };
      let candidates = pool.filter((entry) => fits(entry) && (cooldownUntil.get(entry.unit.id) ?? 0) <= index);
      if (candidates.length === 0 && LANES[lane].requireWindow) {
        // Полоса не терпит пустого дня: берём того, чей кулдаун кончился раньше всех.
        candidates = pool
          .filter(fits)
          .sort(
            (left, right) =>
              (cooldownUntil.get(left.unit.id) ?? 0) - (cooldownUntil.get(right.unit.id) ?? 0) ||
              left.unit.id.localeCompare(right.unit.id),
          );
      }
      if (candidates.length === 0) continue;
      // Вчерашнюю единицу не повторяем, если есть выбор.
      const preferred = candidates.filter(({ unit }) => unit.id !== state.lastUnit);
      const from = preferred.length > 0 ? preferred : candidates;
      const total = from.reduce((sum, { unit }) => sum + (unit.rotation?.weight ?? 1), 0);
      let roll = hash32(options.seed, lane, index, from.length) % total;
      let chosen: PoolCandidate = from[0] as PoolCandidate;
      for (const candidate of from) {
        const weight = candidate.unit.rotation?.weight ?? 1;
        if (roll < weight) {
          chosen = candidate;
          break;
        }
        roll -= weight;
      }
      const rotation = chosen.unit.rotation as RotationDecl;
      const start = atMs(index, minutesOf(rotation.at), tz);
      const stop = start + rotation.lengthMs;
      const reason = addWindow(
        laneOf(lane),
        { start, stop, unitId: chosen.unit.id, moduleId: chosen.moduleId },
        lane,
        dayIndexValue,
        month,
      );
      if (reason) {
        skipped.push({ moduleId: chosen.moduleId, unitId: chosen.unit.id, lane, dayIndex: dayIndexValue, reason });
        continue;
      }
      cooldownUntil.set(chosen.unit.id, index + rotation.cooldownDays);
      push(chosen.moduleId, chosen.unit, start, stop, "rotation");
    }
  }

  windows.sort((left, right) => left.start - right.start || left.unitId.localeCompare(right.unitId));
  return { windows, skipped };
}

export function scheduleKey(unitId: UnitId, start: number): string {
  return `${unitId}:${start}`;
}

/** Какие окна идут в этот миг. Ядро гасит и включает единицы по этому списку. */
export function windowsActiveAt(windows: readonly PlannedWindow[], at: number): PlannedWindow[] {
  return windows.filter((window) => window.start <= at && at < window.stop);
}

/** Какие окна кончились в промежутке: их единицы гасятся. */
export function windowsEndedBetween(
  windows: readonly PlannedWindow[],
  from: number,
  to: number,
): PlannedWindow[] {
  return windows.filter((window) => window.stop > from && window.stop <= to);
}

/** Какие окна начались в промежутке: их единицы включаются. */
export function windowsStartedBetween(
  windows: readonly PlannedWindow[],
  from: number,
  to: number,
): PlannedWindow[] {
  return windows.filter((window) => window.start > from && window.start <= to);
}

/** Проверка расписаний при сборке: полосы, пробелы, покрытие пор года. */
export function planProblems(options: PlanOptions, year: number): string[] {
  const problems: string[] = [];
  const from = Date.UTC(year, 0, 1);
  const to = Date.UTC(year + 1, 0, 1);
  const { windows } = planWindows({ ...options, from, to });

  const byLane = new Map<LaneId, PlannedWindow[]>();
  for (const window of windows) {
    if (!window.lane) continue;
    const list = byLane.get(window.lane) ?? [];
    list.push(window);
    byLane.set(window.lane, list);
  }

  for (const [lane, list] of byLane) {
    const rules = LANES[lane];
    let previousStop = -Infinity;
    let previousUnit = "";
    for (const window of [...list].sort((left, right) => left.start - right.start)) {
      if (rules.minGapMs > 0 && previousStop > -Infinity) {
        const gap = window.start - previousStop;
        if (gap < rules.minGapMs) {
          problems.push(
            `полоса ${lane}: окно ${window.unitId} начинается через ${Math.round(gap / DAY_MS)} дн. после ${previousUnit}, а нужно ${Math.round(rules.minGapMs / DAY_MS)} дн.`,
          );
        }
      }
      if (window.start < previousStop && !rules.exactlyOne) {
        problems.push(`полоса ${lane}: окна ${previousUnit} и ${window.unitId} накладываются`);
      }
      previousStop = Math.max(previousStop, window.stop);
      previousUnit = window.unitId;
    }
  }

  // Ровно одна включённая единица: каждый день года покрыт ровно один раз.
  for (const [lane, rules] of Object.entries(LANES)) {
    if (!rules.exactlyOne) continue;
    const list = byLane.get(lane as LaneId) ?? [];
    if (list.length === 0) continue;
    for (let day = from; day < to; day += DAY_MS) {
      const active = list.filter((window) => window.start <= day && day < window.stop);
      if (active.length !== 1) {
        problems.push(
          `полоса ${lane}: в ${new Date(day).toISOString().slice(0, 10)} идёт ${active.length} окон вместо одного`,
        );
        break;
      }
    }
  }

  return problems;
}

/** Начало суток мира, в которые попадает миг: нужно примерке поры года. */
export function dayStartOf(ms: number, tzOffsetMin: number): number {
  return dayStartMs(dayIndex(ms, tzOffsetMin), tzOffsetMin);
}

/** Поры года по дате: нужна модулям вида и наполнению пулов. */
export function seasonAt(ms: number, tzOffsetMin: number): SeasonId {
  return seasonOfMonth(partsOf(dayIndex(ms, tzOffsetMin), tzOffsetMin).month);
}

/**
 * Пора года для дня плана: календарь, а на время примерки — пора оператора.
 * Считается по началу суток, поэтому день не может попасть в две поры.
 */
function seasonForDay(
  month: number,
  dayStart: number,
  override?: { season: SeasonId; fromMs: number; toMs: number },
): SeasonId {
  if (override && dayStart >= override.fromMs && dayStart < override.toMs) return override.season;
  return seasonOfMonth(month);
}

export function daysInMonthOf(month: number): number {
  return daysInMonth(month);
}
