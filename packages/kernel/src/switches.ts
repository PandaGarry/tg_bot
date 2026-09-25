/**
 * Переключатели единиц. Одно место, где решается, что включено сейчас:
 * вид модуля, состояние модуля от оператора, идущее окно расписания и точечный запрет.
 *
 * Порядок силы: точечный запрет > запрет модуля > расписание > объявленное состояние.
 */

import type { ModuleDefinition } from "./module.js";
import type { ModuleId, ModuleState } from "./types.js";
import { LANES, type LaneId, type UnitDecl, type UnitId, type UnitRole } from "./units.js";
import type { PlannedWindow } from "./schedule.js";

/** Полное имя единицы: «модуль.единица». Оно же ключ переключателя. */
export function unitKey(moduleId: ModuleId, unitId: UnitId): string {
  return `${moduleId}.${unitId}`;
}

export function splitUnitKey(key: string): { moduleId: ModuleId; unitId: UnitId } | null {
  const dot = key.indexOf(".");
  if (dot <= 0 || dot === key.length - 1) return null;
  return { moduleId: key.slice(0, dot), unitId: key.slice(dot + 1) };
}

/**
 * Карантин единицы: ядро само убрало её с расчёта после сбоя.
 * `until` — когда ядро попробует вернуть; ноль и `needsOperator` — ждёт оператора.
 */
export interface Quarantine {
  failures: number;
  /** Когда ядро попробует вернуть единицу. Ноль — само не вернётся. */
  until: number;
  /** Нужен оператор: лечение не помогло, дальше только человек. */
  needsOperator?: boolean;
  /** Что случилось: строка для панели и журнала. */
  lastError?: string;
}

/** Воля оператора: состояние, срок и причина. */
export interface Override {
  state: ModuleState;
  /** Момент, когда переключатель снимается сам. Ноль или нет — держится. */
  until?: number;
  /** Короткая причина для журнала и панели. */
  reason?: string;
  /** Модуль закрыт не оператором, а объявлением сборки: ждёт своего шага плана. */
  fromDeclaration?: boolean;
}

export type SwitchReason =
  /** Классическая механика: работает, пока её не тронул оператор. */
  | "core"
  /** Окно расписания открыто: событие идёт. */
  | "window"
  /** Событие ждёт своего окна. */
  | "between-windows"
  /** У единицы нет расписания: живёт по воле модуля. */
  | "always-on"
  /** Оператор переключил единицу вручную. */
  | "operator"
  /** Модуль закрыт: его единицы молчат вместе с ним. */
  | "module-off"
  /** Оператор закрыл с причиной и сроком: карантин. */
  | "quarantine"
  /** Уступила место: в полосе «ровно одна» сейчас включена другая единица. */
  | "yielded"
  /** Модуль закрыт по рождению мира: ждёт своего шага плана. */
  | "module-closed";

export interface UnitState {
  moduleId: ModuleId;
  unitId: UnitId;
  /** «модуль.единица»: ключ для базы, журнала и панели. */
  key: string;
  role: UnitRole;
  titleKey: string;
  lane: LaneId | null;
  state: ModuleState;
  reason: SwitchReason;
  /** Идущее окно единицы, если оно есть: панель показывает даже закрытое событие. */
  window?: { key: string; start: number; stop: number };
  /** Когда снимется запрет: операторский или карантинный. */
  until?: number;
  /** Записка оператора: короткая строка, почему он это сделал. */
  note?: string;
  /** Сколько сбоев привело к карантину. */
  failures?: number;
  /** Что случилось: короткая строка для панели оператора. */
  lastError?: string;
  /** Кому уступила: ключ единицы, которая сейчас включена в полосе. */
  yieldedTo?: string;
  /** Живёт по этой единице модуля: состояние взято у неё, а не своё. */
  followsKey?: string;
}

export interface SwitchInput {
  definitions: readonly ModuleDefinition[];
  /** План окон: считается ядром расписания. */
  windows: readonly PlannedWindow[];
  /** Состояние каждого модуля сборки: объявленное или выставленное оператором. */
  modules?: ReadonlyMap<ModuleId, Override>;
  /** Точечные запреты единиц: ключ «модуль.единица». */
  units?: ReadonlyMap<string, Override>;
  /** Карантин ядра: ключ «модуль.единица» или имя модуля целиком. */
  quarantined?: ReadonlyMap<string, Quarantine>;
  now: number;
}

/** Объявленные единицы сборки в порядке модулей. */
export function declaredUnits(
  definitions: readonly ModuleDefinition[],
): { moduleId: ModuleId; kind: ModuleDefinition["kind"]; unit: UnitDecl }[] {
  const list: { moduleId: ModuleId; kind: ModuleDefinition["kind"]; unit: UnitDecl }[] = [];
  for (const definition of definitions) {
    for (const unit of definition.units ?? []) list.push({ moduleId: definition.id, kind: definition.kind, unit });
  }
  return list;
}

/** Карантин ещё держит единицу: срок не вышел или нужен оператор. */
export function quarantineInForce(quarantine: Quarantine | undefined, now: number): boolean {
  if (!quarantine) return false;
  if (quarantine.needsOperator) return true;
  return quarantine.until <= 0 || quarantine.until > now;
}

/** Переключатель ещё в силе: время снятия не наступило. */
export function overrideInForce(override: Override | undefined, now: number): boolean {
  if (!override) return false;
  if (override.until === undefined || override.until <= 0) return true;
  return override.until > now;
}

/**
 * Состояние модуля на этот миг: запрет со сроком снимается сам,
 * иначе закрытый на час модуль остался бы закрыт навсегда.
 */
export function moduleIsOn(override: Override | undefined, now: number): boolean {
  if (!override) return true;
  if (override.state === "enabled") return true;
  if (override.until === undefined || override.until <= 0) return false;
  return override.until <= now;
}

/** Состояние всех единиц сборки на этот миг. */
export function unitStates(input: SwitchInput): UnitState[] {
  const { definitions, windows, now } = input;
  const states: UnitState[] = [];

  // Идущие окна: по одному на единицу, самое длинное из открытых.
  const active = new Map<string, PlannedWindow>();
  for (const window of windows) {
    if (!(window.start <= now && now < window.stop)) continue;
    const key = unitKey(window.moduleId, window.unitId);
    const existing = active.get(key);
    if (!existing || window.stop > existing.stop) active.set(key, window);
  }

  // Полоса «ровно одна единица»: если оператор включил в ней единицу, соседи
  // уступают, пока его воля в силе. Мир не спорит сам с собой, а примерка сезона
  // не оставляет две поры года разом.
  const winners = new Map<LaneId, { key: string; until?: number }>();
  for (const { moduleId, kind, unit } of declaredUnits(definitions)) {
    if (kind !== "seasonal" && !unit.lane) continue;
    if (!unit.lane || !LANES[unit.lane].exactlyOne) continue;
    const override = input.units?.get(unitKey(moduleId, unit.id));
    if (!override || override.state !== "enabled" || !overrideInForce(override, now)) continue;
    const key = unitKey(moduleId, unit.id);
    const existing = winners.get(unit.lane);
    // Сильнее та воля, что дольше: без срока — навсегда, иначе поздний срок.
    const weight = override.until === undefined || override.until <= 0 ? Number.POSITIVE_INFINITY : override.until;
    const existingWeight = existing === undefined ? -1 : (existing.until ?? Number.POSITIVE_INFINITY);
    if (!existing || weight > existingWeight || (weight === existingWeight && key < existing.key)) {
      winners.set(unit.lane, { key, ...(override.until ? { until: override.until } : {}) });
    }
  }

  const byKey = new Map<string, UnitState>();
  for (const { moduleId, kind, unit } of declaredUnits(definitions)) {
    const key = unitKey(moduleId, unit.id);
    const declared = unit.defaultState ?? "enabled";
    const window = active.get(key);
    const override = input.units?.get(key);
    const moduleOverride = input.modules?.get(moduleId);
    const moduleOn = moduleIsOn(moduleOverride, now);

    const state: UnitState = {
      moduleId,
      unitId: unit.id,
      key,
      role: unit.role,
      titleKey: unit.titleKey,
      lane: unit.lane ?? null,
      state: "enabled",
      reason: "core",
    };

    const quarantine = input.quarantined?.get(key) ?? input.quarantined?.get(moduleId);
    const winner = unit.lane && LANES[unit.lane].exactlyOne ? winners.get(unit.lane) : undefined;
    // Уступает только тот, кто без перебивки был бы включён: «лето зимой» — это
    // законный отдых по календарю, а не уступка, и панель не должна звать его уступкой.
    const wouldBeOn =
      (override !== undefined && override.state === "enabled" && overrideInForce(override, now)) ||
      window !== undefined ||
      (unit.window === undefined && unit.rotation === undefined && (unit.defaultState ?? "enabled") === "enabled");
    if (winner && winner.key !== key && wouldBeOn) {
      // 1. Полоса «ровно одна»: сосед уступил воле оператора и виден панели.
      //    Это сильнее даже собственной воли: две поры года разом мир не показывает.
      state.state = "disabled";
      state.reason = "yielded";
      state.yieldedTo = winner.key;
      if (winner.until) state.until = winner.until;
    } else if (overrideInForce(override, now)) {
      // 2. Воля оператора: сильнее календаря и вида модуля.
      state.state = override!.state;
      state.reason = "operator";
      if (override!.until) state.until = override!.until;
      if (override!.reason) state.note = override!.reason;
    } else if (quarantineInForce(quarantine, now)) {
      // 3. Карантин: ядро убрало сбойную единицу с расчёта и лечит её само.
      state.state = "disabled";
      state.reason = "quarantine";
      if (quarantine!.until > now) state.until = quarantine!.until;
      state.failures = quarantine!.failures;
      if (quarantine!.lastError) state.lastError = quarantine!.lastError;
    } else if (!moduleOn) {
      // 4. Модуль закрыт: его единицы молчат, но окно видно панели.
      state.state = "disabled";
      state.reason = moduleOverride?.fromDeclaration ? "module-closed" : "module-off";
      if (moduleOverride?.until) state.until = moduleOverride.until;
      if (moduleOverride?.reason) state.note = moduleOverride.reason;
    } else if (kind === "core") {
      // 3. Классика работает, пока оператор не сказал иначе.
      state.state = declared;
      state.reason = "core";
    } else if (unit.window || unit.rotation) {
      // 4. У единицы с расписанием состояние решает окно, а не объявление.
      state.state = window ? "enabled" : "disabled";
      state.reason = window ? "window" : "between-windows";
    } else {
      // 5. Единицы без расписания живут по воле модуля.
      state.state = declared;
      state.reason = "always-on";
    }

    if (window) state.window = { key: window.key, start: window.start, stop: window.stop };
    states.push(state);
    byKey.set(key, state);
  }

  // Спутники: вид поры года повторяет саму пору, а не решает сам.
  for (const { moduleId, unit } of declaredUnits(definitions)) {
    if (!unit.follows) continue;
    const key = unitKey(moduleId, unit.id);
    const own = byKey.get(key);
    const source = byKey.get(unitKey(moduleId, unit.follows));
    if (!own || !source) continue;
    own.state = source.state;
    own.reason = source.reason;
    own.followsKey = source.key;
    own.until = source.until;
    own.note = source.note;
    own.window = source.window;
    own.yieldedTo = source.yieldedTo;
    own.failures = source.failures;
    own.lastError = source.lastError;
  }

  return states.sort((left, right) => left.key.localeCompare(right.key));
}

/** Живой ли план: если горизонт кончается, ядро должно пересчитать окна заранее. */
export function planIsFresh(windows: readonly PlannedWindow[], now: number, marginMs: number): boolean {
  let last = -Infinity;
  for (const window of windows) if (window.stop > last) last = window.stop;
  return last - marginMs > now;
}

/** Самые дальние сроки плана: видно, до какого дня он посчитан. */
export function planHorizon(windows: readonly PlannedWindow[]): number {
  let last = 0;
  for (const window of windows) if (window.stop > last) last = window.stop;
  return last;
}
