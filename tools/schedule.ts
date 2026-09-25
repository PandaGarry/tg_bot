/**
 * Отчёт по расписанию сборки: что и когда идёт. Даты печатаются по часам мира.
 * Запуск: pnpm schedule [--days 90] [--from 2026-12-01] [--tz 180]
 */

import { planWindows, unitStates, type ModuleDefinition } from "@tdl/kernel";
import { modules } from "@tdl/modules";

// Ключи понимаются и как «--days 90», и как «--days=90».
const args = new Map<string, string>();
const rawArgs = process.argv.slice(2);
for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index] ?? "";
  if (!raw.startsWith("--")) continue;
  const [key, inline] = raw.replace(/^--/, "").split("=");
  if (!key) continue;
  const next = rawArgs[index + 1];
  if (inline !== undefined && inline !== "") args.set(key, inline);
  else if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else args.set(key, "");
}

const days = Math.max(1, Number(args.get("days") ?? 30));
const tz = Number(args.get("tz") ?? process.env.TDL_TZ_OFFSET_MIN ?? 180);
const seed = Number(args.get("seed") ?? process.env.TDL_SCHEDULE_SEED ?? 1541);
const fromArg = args.get("from");
const from = fromArg ? Date.parse(`${fromArg}T00:00:00Z`) : Date.now();
if (Number.isNaN(from)) throw new Error(`не разобрать дату: ${fromArg}`);

const to = from + days * 86_400_000;
const { windows, skipped } = planWindows({ modules, from, to, tzOffsetMin: tz, seed });

const pad = (value: string | number, width: number): string => String(value).padEnd(width);
const local = (ms: number): string => new Date(ms + tz * 60_000).toISOString().slice(0, 16).replace("T", " ");
const dayOf = (ms: number): string => new Date(ms + tz * 60_000).toISOString().slice(0, 10);

console.log(
  `расписание на ${days} дн. с ${dayOf(from)} по ${dayOf(to)} (часы мира, сдвиг ${tz / 60} ч), окон: ${windows.length}`,
);
console.log("");
console.log(`${pad("начало", 17)}${pad("конец", 17)}${pad("полоса", 9)}${pad("модуль", 18)}${pad("единица", 26)}источник`);
for (const window of windows.slice(0, 400)) {
  console.log(
    pad(local(window.start), 17) +
      pad(local(window.stop), 17) +
      pad(window.lane ?? "—", 9) +
      pad(window.moduleId, 18) +
      pad(window.unitId, 26) +
      window.source,
  );
}
if (windows.length > 400) console.log(`… ещё ${windows.length - 400} окон`);

const byUnit = new Map<string, number>();
for (const window of windows) byUnit.set(`${window.moduleId}.${window.unitId}`, (byUnit.get(`${window.moduleId}.${window.unitId}`) ?? 0) + 1);
console.log("");
console.log("окон по единицам:");
for (const [key, count] of [...byUnit.entries()].sort()) console.log(`  ${pad(key, 34)}${count}`);

// Нагрузка по суткам: сколько окон начинается и сколько идёт разом.
// Один взгляд — и видно, не захламлён ли день событиями.
{
  const startsByDay = new Map<string, number>();
  const lanesByDay = new Map<string, Set<string>>();
  for (const window of windows) {
    if (window.start < from || window.start >= to) continue;
    const day = dayOf(window.start);
    startsByDay.set(day, (startsByDay.get(day) ?? 0) + 1);
    const lanes = lanesByDay.get(day) ?? new Set<string>();
    lanes.add(window.lane ?? "—");
    lanesByDay.set(day, lanes);
  }
  const totalDays = Math.max(1, Math.round((to - from) / 86_400_000));
  let emptyDays = 0;
  let maxDay = 0;
  let sum = 0;
  const histogram = new Map<number, number>();
  for (let index = 0; index < totalDays; index += 1) {
    const day = dayOf(from + index * 86_400_000);
    const count = startsByDay.get(day) ?? 0;
    if (count === 0) emptyDays += 1;
    maxDay = Math.max(maxDay, count);
    sum += count;
    histogram.set(count, (histogram.get(count) ?? 0) + 1);
  }
  // Одновременность: разворачиваем окна в края и считаем накопление.
  const edges: { at: number; delta: number; lane: string }[] = [];
  for (const window of windows) {
    edges.push({ at: window.start, delta: 1, lane: window.lane ?? "—" });
    edges.push({ at: window.stop, delta: -1, lane: window.lane ?? "—" });
  }
  edges.sort((left, right) => left.at - right.at || left.delta - right.delta);
  let live = 0;
  let maxLive = 0;
  let maxLiveAt = from;
  const liveByLane = new Map<string, number>();
  const maxByLane = new Map<string, number>();
  for (const edge of edges) {
    live += edge.delta;
    liveByLane.set(edge.lane, (liveByLane.get(edge.lane) ?? 0) + edge.delta);
    const lanePeak = liveByLane.get(edge.lane) ?? 0;
    if (lanePeak > (maxByLane.get(edge.lane) ?? 0)) maxByLane.set(edge.lane, lanePeak);
    if (live > maxLive) {
      maxLive = live;
      maxLiveAt = edge.at;
    }
  }
  console.log("");
  console.log("нагрузка:");
  console.log(`  окон начинается за сутки: в среднем ${(sum / totalDays).toFixed(1)}, самое большее ${maxDay}`);
  console.log(`  дней без начала окна: ${emptyDays} из ${totalDays} (законный день без событий)`);
  console.log(`  одновременно идёт окон: не больше ${maxLive} (${local(maxLiveAt)})`);
  console.log(
    "  по числу окон в сутки: " +
      [...histogram.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([count, daysCount]) => `${count} — ${daysCount} дн.`)
        .join(", "),
  );
  console.log(
    "  полос разом не больше: " +
      [...maxByLane.entries()]
        .sort()
        .map(([lane, peak]) => `${lane} ${peak}`)
        .join(", "),
  );
}

if (skipped.length > 0) {
  const reasons = new Map<string, number>();
  for (const note of skipped) reasons.set(note.reason, (reasons.get(note.reason) ?? 0) + 1);
  console.log("");
  console.log("пропуски полос (окна, которым не хватило места):");
  for (const [reason, count] of [...reasons.entries()].sort()) console.log(`  ${pad(reason, 14)}${count}`);
}

const moduleDefaults = new Map(
  (modules as readonly ModuleDefinition[]).map((definition) => [
    definition.id,
    {
      state: definition.defaultState ?? ("enabled" as const),
      ...(definition.defaultState === "disabled" ? { fromDeclaration: true } : {}),
    },
  ]),
);
const states = unitStates({ definitions: modules as readonly ModuleDefinition[], windows, modules: moduleDefaults, now: from });
const on = states.filter((unit) => unit.state === "enabled");
console.log("");
console.log(`на ${local(from)} включено единиц: ${on.length}`);
for (const unit of on) console.log(`  ${pad(unit.key, 34)}${unit.reason}`);
