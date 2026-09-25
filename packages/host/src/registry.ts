/**
 * Загрузка реестра модулей. Реестр сгенерирован сборкой и лежит в репозитории:
 * ядро имён модулей не знает, хост берёт их из реестра.
 */

import { buildRegistry, type ModuleRegistry } from "@tdl/kernel";
import { modules } from "@tdl/modules";

export function loadRegistry(): ModuleRegistry {
  return buildRegistry(modules);
}
