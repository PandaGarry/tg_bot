/**
 * Проверка календаря сборки: полосы, пробелы, покрытие пор года.
 * Запускается из `pnpm check` — план строится на 2027 год целиком.
 */

import { planProblems, planWindows, type ModuleDefinition } from "@tdl/kernel";
import { modules } from "@tdl/modules";

const YEARS = [2026, 2027, 2028];
const TZ = Number(process.env.TDL_TZ_OFFSET_MIN ?? 180);
const SEED = Number(process.env.TDL_SCHEDULE_SEED ?? 1541);

const problems: string[] = [];
for (const year of YEARS) {
  const yearProblems = planProblems({ modules, from: 0, to: 0, tzOffsetMin: TZ, seed: SEED }, year);
  for (const problem of yearProblems) problems.push(`${year}: ${problem}`);
}

// В сборке должен быть ровно один модуль каждой поры года.
const seasonal = modules.filter((module: ModuleDefinition) => module.kind === "seasonal");
if (seasonal.length !== 4) problems.push(`пор года в сборке ${seasonal.length}, а нужно четыре`);

const planned = planWindows({
  modules,
  from: Date.UTC(2027, 0, 1),
  to: Date.UTC(2028, 0, 1),
  tzOffsetMin: TZ,
  seed: SEED,
});

if (problems.length > 0) {
  console.error("Календарь сломан:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

const byLane = new Map<string, number>();
for (const window of planned.windows) byLane.set(window.lane ?? "—", (byLane.get(window.lane ?? "—") ?? 0) + 1);
const summary = [...byLane.entries()].map(([lane, count]) => `${lane} ${count}`).join(", ");

console.log(`календарь в порядке: ${modules.length} модул(ей), годы ${YEARS.join("/")}, окон на 2027 — ${planned.windows.length} (${summary})`);
