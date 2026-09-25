// Сгенерировано tools/gen-registry.mjs. Правки затираются: запустите pnpm gen.

import type { ModuleDefinition } from "@tdl/kernel";
import probe from "@tdl/module-probe/module";

/** Все модули сборки. Порядок загрузки считает ядро по depends. */
export const modules: ModuleDefinition[] = [
  probe,
];

/** Имена модулей сборки: по ним проверяются границы пакетов. */
export const moduleIds: string[] = ["_probe"];
