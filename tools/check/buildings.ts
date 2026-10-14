/**
 * Проверка каталога зданий: файл packages/modules/buildings/src/catalog.gen.ts
 * должен совпадать с результатом генерации из docs/balance/ladders.md и
 * docs/design/buildings.md. Дрейф — ошибка: правьте документы и запускайте
 * `pnpm gen:buildings`.
 */

import { readFileSync } from "node:fs";
import { buildCatalog, OUT, render } from "../gen-buildings.mjs";

const expected = render(buildCatalog());
const actual = readFileSync(OUT, "utf8");

if (expected !== actual) {
  console.error(
    "Каталог зданий разошёлся с документами: catalog.gen.ts не совпадает с генерацией.\n" +
      "Запустите `pnpm gen:buildings` и закоммитьте результат.",
  );
  process.exit(1);
}

console.log(`каталог зданий в порядке: ${buildCatalog().length} записей, файл совпадает с документами`);
