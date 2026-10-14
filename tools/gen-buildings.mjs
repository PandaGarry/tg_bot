// Генератор каталога зданий: читает docs/balance/ladders.md и docs/design/buildings.md
// и пишет packages/modules/buildings/src/catalog.gen.ts.
// Правки в catalog.gen.ts затираются: правьте документы и запускайте `pnpm gen:buildings`.
// Проверка `pnpm check` сравнивает файл с результатом генерации (дрейф = ошибка).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LADDERS = resolve(ROOT, "docs/balance/ladders.md");
const CATALOG_DOC = resolve(ROOT, "docs/design/buildings.md");
export const OUT = resolve(ROOT, "packages/modules/buildings/src/catalog.gen.ts");

// Соответствие: id → имя в документе и заголовок лестницы в ladders.md.
// Таверна — без лестницы (решено 10.10: 1 уровень, стоимость не назначена).
const BUILDINGS = [
  { id: "citadel", ru: "Цитадель", section: "Цитадель (§3)" },
  { id: "wall", ru: "Стена", section: "Стена (4.1)" },
  { id: "warehouse", ru: "Склад", section: "Склад (4.2)" },
  { id: "infirmary", ru: "Лазарет", section: "Лазарет (4.3)" },
  { id: "academy", ru: "Академия", section: "Академия (4.4)" },
  { id: "clan-hall", ru: "Зал клана", section: "Зал клана (4.5)" },
  { id: "tavern", ru: "Таверна", section: null },
  { id: "watchtower", ru: "Надзорная вышка", section: "Надзорная вышка (4.7)" },
  { id: "forge", ru: "Кузница", section: "Кузница (4.8)" },
  { id: "trade-post", ru: "Торговый пост", section: "Торговый пост (4.9)" },
  { id: "barracks", ru: "Казарма", section: "Казарма (4.10)" },
  { id: "range", ru: "Стрельбище", section: "Стрельбище (4.11)" },
  { id: "stable", ru: "Конюшня", section: "Конюшня (4.12)" },
  { id: "siege-yard", ru: "Осадный двор", section: "Осадный двор (4.13)" },
  { id: "sawmill", ru: "Лесопилка", section: "Лесопилка (4.14)" },
  { id: "pen", ru: "Загон", section: "Загон (4.15)" },
  { id: "quarry", ru: "Каменоломня", section: "Каменоломня (4.16)" },
  { id: "mine", ru: "Рудник", section: "Рудник (4.17)" },
  { id: "farm", ru: "Ферма", section: "Ферма (4.18)" },
];

const UNIT_SECONDS = { с: 1, м: 60, ч: 3600, д: 86400 };

/** «1 ч 7 м» → секунды; «старт» → 0. */
export function parseDuration(text) {
  const t = text.trim();
  if (t === "старт") return 0;
  let total = 0;
  let found = false;
  for (const [, n, u] of t.matchAll(/(\d+)\s*(с|м|ч|д)/g)) {
    total += Number(n) * UNIT_SECONDS[u];
    found = true;
  }
  if (!found) throw new Error(`не разобрано время: «${text}»`);
  return total;
}

const toInt = (s) => {
  const n = Number(s.replace(/\s/g, "").replace(/\u00a0/g, ""));
  if (!Number.isFinite(n)) throw new Error(`не число: «${s}»`);
  return n;
};

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function sectionsOf(md) {
  const out = new Map();
  for (const part of md.split(/^## /m).slice(1)) {
    const title = part.split("\n", 1)[0].trim();
    out.set(title, part.split("\n").slice(1));
  }
  return out;
}

/** Строки таблицы уровней: «| 1 | 0 | 0 | 0 | старт | 0 | эффект |». */
function levelRows(lines) {
  return lines.filter((l) => /^\| \d+ \|/.test(l)).map(cells);
}

/** Таблица зданий из buildings.md: старт, макс. уровень, сумма силы и доля. */
function catalogTable(md) {
  const map = new Map();
  for (const line of md.split("\n")) {
    if (!/^\| \d+ \| /.test(line)) continue;
    const c = cells(line);
    if (c.length !== 10) continue;
    const ru = c[1];
    const startRaw = c[3];
    const start = startRaw === "—" ? 1 : Number(startRaw.match(/^\d+/)?.[0]);
    map.set(ru, {
      maxLevel: Number(c[2]),
      startCitadel: start,
      powerTotal: c[8] === "—" ? null : toInt(c[8]),
      powerShare: c[9] === "—" ? null : c[9],
    });
  }
  return map;
}

export function buildCatalog() {
  const ladders = sectionsOf(readFileSync(LADDERS, "utf8"));
  const table = catalogTable(readFileSync(CATALOG_DOC, "utf8"));
  const entries = BUILDINGS.map((b) => {
    const meta = table.get(b.ru);
    if (!meta) throw new Error(`${b.ru}: нет строки в buildings.md`);
    if (!b.section) {
      // Таверна: только постройка, уровней нет.
      return { id: b.id, ru: b.ru, ...meta, maxLevel: 1, levels: [], costOpen: true };
    }
    const lines = ladders.get(b.section);
    if (!lines) throw new Error(`${b.ru}: нет раздела «${b.section}» в ladders.md`);
    const rows = levelRows(lines);
    if (rows.length !== meta.maxLevel) {
      throw new Error(`${b.ru}: строк ${rows.length}, макс. уровень ${meta.maxLevel}`);
    }
    const levels = rows.map((r, i) => {
      const level = toInt(r[0]);
      if (level !== i + 1) throw new Error(`${b.ru}: уровни не по порядку на строке ${i + 1}`);
      return {
        level,
        wood: toInt(r[1]),
        stone: toInt(r[2]),
        metal: toInt(r[3]),
        seconds: parseDuration(r[4]),
        power: toInt(r[5]),
        effect: r[r.length - 1],
      };
    });
    return { id: b.id, ru: b.ru, ...meta, levels, costOpen: false };
  });
  return entries;
}

const q = (s) => JSON.stringify(s);

export function render(entries) {
  const lines = [];
  lines.push("// Сгенерировано tools/gen-buildings.mjs из docs/balance/ladders.md и docs/design/buildings.md.");
  lines.push("// Правки затираются: правьте документы и запустите `pnpm gen:buildings`.");
  lines.push("");
  lines.push("import type { BuildingDef } from \"./types.js\";");
  lines.push("");
  lines.push("export const BUILDINGS: readonly BuildingDef[] = [");
  for (const e of entries) {
    lines.push("  {");
    lines.push(`    id: ${q(e.id)},`);
    lines.push(`    ru: ${q(e.ru)},`);
    lines.push(`    maxLevel: ${e.maxLevel},`);
    lines.push(`    startCitadel: ${e.startCitadel},`);
    lines.push(`    powerTotal: ${e.powerTotal === null ? "null" : e.powerTotal},`);
    lines.push(`    powerShare: ${e.powerShare === null ? "null" : q(e.powerShare)},`);
    lines.push(`    costOpen: ${e.costOpen},`);
    if (e.levels.length === 0) {
      lines.push("    levels: [],");
    } else {
      lines.push("    levels: [");
      for (const l of e.levels) {
        lines.push(
          `      { level: ${l.level}, wood: ${l.wood}, stone: ${l.stone}, metal: ${l.metal}, seconds: ${l.seconds}, power: ${l.power}, effect: ${q(l.effect)} },`,
        );
      }
      lines.push("    ],");
    }
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

// Запуск как скрипт: записать файл.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, render(buildCatalog()));
  console.log(`каталог зданий записан: ${OUT}`);
}
