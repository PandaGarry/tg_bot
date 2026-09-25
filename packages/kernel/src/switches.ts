/**
 * Переключатели единиц. Одно место, где решается, что включено сейчас:
 * вид модуля, состояние модуля от оператора, идущее окно расписания и точечный запрет.
 *
 * Порядок силы: точечный запрет > запрет модуля > расписание > объявленное состояние.
 */

import type { ModuleDefinition } from "./module.js";
import type { ModuleId, ModuleState } from "./types.js";
import type { LaneId, UnitDecl, UnitId, UnitRole } from "./units.js";
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
  /** Когда снимется операторский запрет. */
  until?: number;
}

export interface SwitchInput {
  definitions: readonly ModuleDefinition[];
  /** План окон: считается ядром расписания. */
  windows: readonly PlannedWindow[];
  /** Состояние каждого модуля сборки: объявленное или выставленное оператором. */
  modules?: ReadonlyMap<ModuleId, Override>;
  /** Точечные запреты единиц: ключ «модуль.единица». */
  units?: ReadonlyMap<string, Override>;
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

    if (overrideInForce(override, now)) {
      // 1. Точечный запрет: сильнее всего остального.
      state.state = override!.state;
      state.reason = override!.reason ? "quarantine" : "operator";
      if (override!.until) state.until = override!.until;
    } else if (!moduleOn) {
      // 2. Модуль закрыт: его единицы молчат, но окно видно панели.
      state.state = "disabled";
      state.reason = moduleOverride?.reason
        ? "quarantine"
        : moduleOverride?.fromDeclaration
          ? "module-closed"
          : "module-off";
      if (moduleOverride?.until) state.until = moduleOverride.until;
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
