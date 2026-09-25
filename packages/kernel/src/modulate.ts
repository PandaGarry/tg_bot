/**
 * Модификаторы. Фазы ядра фиксированы. Модуль объявляет фазу, приоритет и функцию.
 * Расчёт детерминирован: порядок задаёт приоритет, затем порядок модулей, затем id.
 */

import type { ActorFacts, ModuleId, Phase, ResourceId, StockSnapshot, WorldFacts } from "./types.js";

export interface ModifierInput {
  resource?: ResourceId;
  building?: { id: string; level: number };
  point?: { kind: string; level: number; zone: number };
  troop?: { kind: string; tier: number; count: number };
  zone?: number;
  subject?: "lord" | "court" | "world";
  /** Числа, которые модуль передал сам: уровни, грейды, дни. */
  values?: Readonly<Record<string, number>>;
}

/** mul — доля: 0.1 значит плюс десять процентов. */
export interface ModifierOutcome {
  add?: number;
  mul?: number;
}

export interface ModifierEnv {
  world: WorldFacts;
  actor?: ActorFacts;
  stock: StockSnapshot;
  /** Свои факты модуля. Чужих здесь нет. */
  facts?: Readonly<Record<string, number>>;
  /**
   * Факты по модулям. Ядро отдаёт каждому модификатору только его строку:
   * чужой модуль своих чисел здесь не видит.
   */
  factsByModule?: Readonly<Record<ModuleId, Readonly<Record<string, number>>>>;
}

export interface ModifierDecl {
  id: string;
  phase: Phase;
  priority: number;
  apply(input: ModifierInput, env: ModifierEnv): ModifierOutcome;
}

export interface ModifierSource {
  moduleId: ModuleId;
  modifiers: readonly ModifierDecl[];
}

export interface ModifierPart {
  moduleId: ModuleId;
  modifierId: string;
  add: number;
  mul: number;
  before: number;
  after: number;
}

export interface ModulationDetails {
  value: number;
  parts: ModifierPart[];
}

export interface ModulationRequest {
  phase: Phase;
  base: number;
  input?: ModifierInput;
  sources: readonly ModifierSource[];
  env: ModifierEnv;
}

function ordered(sources: readonly ModifierSource[], phase: Phase): { moduleId: ModuleId; decl: ModifierDecl }[] {
  const rows: { moduleId: ModuleId; decl: ModifierDecl }[] = [];
  sources.forEach((source, moduleIndex) => {
    for (const decl of source.modifiers) {
      if (decl.phase !== phase) continue;
      rows.push({ moduleId: source.moduleId, decl, moduleIndex } as never);
    }
  });
  const withIndex = rows.map((row, index) => ({ row, index }));
  withIndex.sort((a, b) => {
    if (a.row.decl.priority !== b.row.decl.priority) return a.row.decl.priority - b.row.decl.priority;
    return a.index - b.index;
  });
  return withIndex.map((entry) => entry.row);
}

/** Полный расчёт с разбором по источникам: строки отчёта берутся отсюда. */
export function modulateDetailed(request: ModulationRequest): ModulationDetails {
  const { phase, base, input = {}, sources, env } = request;
  const parts: ModifierPart[] = [];
  let value = base;
  for (const { moduleId, decl } of ordered(sources, phase)) {
    const before = value;
    const ownEnv: ModifierEnv = { ...env, facts: env.factsByModule?.[moduleId] ?? env.facts ?? {} };
    const outcome = decl.apply(input, ownEnv);
    const add = Number.isFinite(outcome.add) ? (outcome.add as number) : 0;
    const mul = Number.isFinite(outcome.mul) ? (outcome.mul as number) : 0;
    // Модификатор, который ничего не меняет, в расчёт не входит: иначе
    // «это не мой ресурс» означало бы предел 0 и пустой склад.
    // Явный ноль объявляется парой add: 0, mul: -1.
    if (add === 0 && mul === 0) continue;
    value = (value + add) * (1 + mul);
    parts.push({ moduleId, modifierId: decl.id, add, mul, before, after: value });
  }
  return { value, parts };
}

/** Одно число: фаза применена ко всем модификаторам включённых модулей. */
export function modulate(request: ModulationRequest): number {
  return modulateDetailed(request).value;
}

/** Предел не уходит в минус и не становится дробным. */
export function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
