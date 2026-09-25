/**
 * Реестр модулей и проверка контракта. Сборка сканирует каталоги модулей,
 * собирает реестр и падает, если контракт сломан.
 */

import { PHASES, isModuleId, stringsProblems, type JsonObject, type ModuleId, type Phase, SHELL_SLOTS, type SlotId } from "./types.js";
import type { CommandDecl, ModuleDefinition } from "./module.js";
import type { ModifierDecl } from "./modulate.js";

export class RegistryError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Контракт модулей сломан:\n- ${problems.join("\n- ")}`);
    this.name = "RegistryError";
    this.problems = problems;
  }
}

function checkIdShape(id: ModuleId): string[] {
  if (!isModuleId(id)) return [`${id}: id модуля только латиница, цифры и дефис`];
  return [];
}

function checkDepends(def: ModuleDefinition, ids: Set<ModuleId>): string[] {
  const problems: string[] = [];
  for (const dep of def.depends ?? []) {
    if (dep === def.id) problems.push(`${def.id}: модуль зависит от себя`);
    else if (!ids.has(dep)) problems.push(`${def.id}: зависимость ${dep} отсутствует в сборке`);
  }
  // Цикл по depends проверяется отдельно: он ломает порядок загрузки.
  return problems;
}

export function registryProblems(definitions: readonly ModuleDefinition[]): string[] {
  const problems: string[] = [];
  const ids = new Set<ModuleId>();

  for (const def of definitions) {
    problems.push(...checkIdShape(def.id));
    if (ids.has(def.id)) problems.push(`${def.id}: id занят`);
    ids.add(def.id);
    if (!Number.isInteger(def.version) || def.version < 1) {
      problems.push(`${def.id}: версия начинается с 1 и только растёт`);
    }
    const strings = def.content?.strings;
    if (!strings) problems.push(`${def.id}: нет словарей ru и en`);
    else problems.push(...stringsProblems(def.id, strings.ru, strings.en));
  }

  for (const def of definitions) problems.push(...checkDepends(def, ids));

  // Цикл в depends: обход в глубину.
  const state = new Map<ModuleId, "open" | "done">();
  const visit = (def: ModuleDefinition, path: ModuleId[]): void => {
    if (state.get(def.id) === "done") return;
    if (state.get(def.id) === "open") {
      problems.push(`${def.id}: цикл в depends (${[...path, def.id].join(" → ")})`);
      return;
    }
    state.set(def.id, "open");
    for (const depId of def.depends ?? []) {
      const dep = definitions.find((candidate) => candidate.id === depId);
      if (dep) visit(dep, [...path, def.id]);
    }
    state.set(def.id, "done");
  };
  for (const def of definitions) visit(def, []);

  // Команды: id уникален на всю сборку.
  const commandIds = new Map<string, ModuleId>();
  for (const def of definitions) {
    for (const command of def.server?.commands ?? []) {
      const owner = commandIds.get(command.id);
      if (owner) problems.push(`${def.id}: команда ${command.id} уже объявлена модулем ${owner}`);
      else commandIds.set(command.id, def.id);
      problems.push(...checkCommand(def.id, command));
    }
    for (const table of def.server?.tables ?? []) {
      if (!/^[a-z][a-z0-9_]*$/.test(table)) problems.push(`${def.id}: имя таблицы ${table} только строчная латиница и подчёркивание`);
    }
    let previous = 0;
    for (const migration of def.server?.migrations ?? []) {
      if (!Number.isInteger(migration.to) || migration.to <= previous) {
        problems.push(`${def.id}: миграции только вперёд, ступень ${migration.to} не растёт`);
      }
      previous = migration.to;
    }
  }

  // Модификаторы: одна фаза и один приоритет у двух модификаторов — отказ сборки.
  const byPhase = new Map<Phase, Map<number, string[]>>();
  const modifierIds = new Set<string>();
  for (const def of definitions) {
    for (const modifier of def.rules?.modifiers ?? []) {
      problems.push(...checkModifier(def.id, modifier));
      const key = `${def.id}.${modifier.id}`;
      if (modifierIds.has(key)) problems.push(`${def.id}: модификатор ${modifier.id} объявлен дважды`);
      modifierIds.add(key);
      const phaseMap = byPhase.get(modifier.phase) ?? new Map<number, string[]>();
      const list = phaseMap.get(modifier.priority) ?? [];
      list.push(key);
      phaseMap.set(modifier.priority, list);
      byPhase.set(modifier.phase, phaseMap);
    }
  }
  for (const [phase, priorities] of byPhase) {
    for (const [priority, list] of priorities) {
      if (list.length > 1) {
        problems.push(`фаза ${phase}, приоритет ${priority}: приоритет занят (${list.join(", ")})`);
      }
    }
  }

  // Ресурсы: один id объявлен одним модулем.
  const resourceOwners = new Map<string, ModuleId>();
  for (const def of definitions) {
    for (const resource of def.rules?.resources ?? []) {
      const owner = resourceOwners.get(resource.id);
      if (owner) problems.push(`${def.id}: ресурс ${resource.id} уже объявлен модулем ${owner}`);
      else resourceOwners.set(resource.id, def.id);
      if (resource.storage !== "warehouse" && resource.storage !== "cellar") {
        problems.push(`${def.id}: у ресурса ${resource.id} не назван склад`);
      }
    }
  }

  // Гнёзда: только из списка оболочки.
  const slots = new Set<SlotId>(SHELL_SLOTS);
  for (const def of definitions) {
    for (const slot of def.client?.slots ?? []) {
      if (!slots.has(slot.slot)) problems.push(`${def.id}: гнездо ${slot.slot} не из списка оболочки`);
    }
  }

  return problems;
}

function checkCommand(moduleId: ModuleId, command: CommandDecl<JsonObject>): string[] {
  const problems: string[] = [];
  if (!command.id.includes(".")) problems.push(`${moduleId}: id команды «${command.id}» без имени модуля впереди`);
  if (typeof command.input?.parse !== "function") problems.push(`${moduleId}: команда ${command.id} без схемы входа`);
  if (typeof command.handle !== "function") problems.push(`${moduleId}: команда ${command.id} без обработчика`);
  return problems;
}

function checkModifier(moduleId: ModuleId, modifier: ModifierDecl): string[] {
  const problems: string[] = [];
  if (!PHASES.includes(modifier.phase)) problems.push(`${moduleId}: фазы ${modifier.phase} в ядре нет`);
  if (!Number.isInteger(modifier.priority)) problems.push(`${moduleId}: приоритет модификатора ${modifier.id} не целое`);
  if (typeof modifier.apply !== "function") problems.push(`${moduleId}: модификатор ${modifier.id} без функции`);
  return problems;
}

export interface ModuleRegistry {
  readonly modules: readonly ModuleDefinition[];
  readonly byId: ReadonlyMap<ModuleId, ModuleDefinition>;
  /** Порядок загрузки: зависимости раньше зависимых. */
  readonly order: readonly ModuleId[];
}

/** Собирает реестр и роняет сборку на сломанном контракте. */
export function buildRegistry(definitions: readonly ModuleDefinition[]): ModuleRegistry {
  const problems = registryProblems(definitions);
  if (problems.length > 0) throw new RegistryError(problems);
  const byId = new Map<ModuleId, ModuleDefinition>();
  for (const def of definitions) byId.set(def.id, def);
  const order: ModuleId[] = [];
  const seen = new Set<ModuleId>();
  const visit = (def: ModuleDefinition): void => {
    if (seen.has(def.id)) return;
    for (const depId of def.depends ?? []) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    seen.add(def.id);
    order.push(def.id);
  };
  for (const def of definitions) visit(def);
  return { modules: definitions, byId, order };
}
