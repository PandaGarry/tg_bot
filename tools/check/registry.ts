/**
 * Проверка реестра модулей. Сломанный контракт роняет сборку:
 * занятый id, отсутствующая зависимость, ключ только в одном языке,
 * чужое гнездо, два модификатора одной фазы с одним приоритетом.
 */

import { buildRegistry, registryProblems, type ModuleDefinition } from "@tdl/kernel";
import { modules } from "@tdl/modules";
import { KERNEL_KEYS, kernelStrings } from "@tdl/protocol";

const problems: string[] = [...registryProblems(modules as ModuleDefinition[])];

// Каждое объявленное слово для игрока должно лежать в обоих языках,
// включая слова ядра: клиент показывает отказ по ключу.
for (const key of Object.values(KERNEL_KEYS)) {
  const ru = (kernelStrings.ru as Record<string, string>)[key];
  const en = (kernelStrings.en as Record<string, string>)[key];
  if (!ru) problems.push(`ядро: ключ ${key} без русского текста`);
  if (!en) problems.push(`ядро: ключ ${key} без английского текста`);
}

if (problems.length === 0) {
  const registry = buildRegistry(modules as ModuleDefinition[]);
  console.log(
    `реестр в порядке: ${registry.modules.length} модул(ей), порядок загрузки — ${registry.order.join(" → ")}`,
  );
} else {
  console.error(`Контракт модулей сломан:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
