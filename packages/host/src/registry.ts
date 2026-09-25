/**
 * Загрузка реестра модулей. Реестр сгенерирован сборкой и лежит в репозитории:
 * ядро имён модулей не знает, хост берёт их из реестра.
 */

import { buildRegistry, type ModuleDefinition, type ModuleRegistry } from "@tdl/kernel";
import { modules } from "@tdl/modules";

/** Добавочные модули: тесты поднимают свой мир с проверочным модулем сборки. */
export function loadRegistry(extra: readonly ModuleDefinition[] = []): ModuleRegistry {
  return buildRegistry([...modules, ...extra]);
}
