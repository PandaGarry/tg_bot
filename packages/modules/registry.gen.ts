// Сгенерировано tools/gen-registry.mjs. Правки затираются: запустите pnpm gen.

import type { ModuleDefinition } from "@tdl/kernel";
import probe from "@tdl/module-probe/module";
import day_window from "@tdl/module-day-window/module";
import holiday from "@tdl/module-holiday/module";
import hour_window from "@tdl/module-hour-window/module";
import month_window from "@tdl/module-month-window/module";
import season_autumn from "@tdl/module-season-autumn/module";
import season_spring from "@tdl/module-season-spring/module";
import season_summer from "@tdl/module-season-summer/module";
import season_winter from "@tdl/module-season-winter/module";
import week_window from "@tdl/module-week-window/module";

/** Все модули сборки. Порядок загрузки считает ядро по depends. */
export const modules: ModuleDefinition[] = [
  probe,
  day_window,
  holiday,
  hour_window,
  month_window,
  season_autumn,
  season_spring,
  season_summer,
  season_winter,
  week_window,
];

/** Имена модулей сборки: по ним проверяются границы пакетов. */
export const moduleIds: string[] = ["_probe", "day-window", "holiday", "hour-window", "month-window", "season-autumn", "season-spring", "season-summer", "season-winter", "week-window"];
