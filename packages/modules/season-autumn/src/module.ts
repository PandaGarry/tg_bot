/**
 * Порá года: осень: урожай, окна сбора длиннее.
 *
 * Полоса `season` держит «ровно одна включена»: весна, лето, осень и зима
 * стыкуются встык, без дыр и без наложений. Вид игры — единица `look`.
 */

import { defineModule } from "@tdl/kernel";

export const season_autumnModule = defineModule({
  id: "season-autumn",
  version: 1,
  kind: "seasonal",
  content: {
    strings: {
      ru: {
        "season-autumn.name": "Осень",
        "season-autumn.look": "Вид осень",
      },
      en: {
        "season-autumn.name": "Autumn",
        "season-autumn.look": "Autumn look",
      },
    },
  },
  units: [
    {
      id: "autumn",
      role: "season",
      titleKey: "season-autumn.name",
      defaultState: "disabled",
      lane: "season",
      window: {
        repeat: { kind: "yearly", month: 9, day: 1 },
        at: "00:00",
        lengthMs: 92 * 86_400_000,
        until: { month: 12, day: 1 },
      },
    },
    {
      // Вид поры: гнёзда оболочки и палитра. Расписания у вида нет, и своей
      // воли тоже: он идёт за самой порой — включили зиму, включился и вид.
      id: "look",
      role: "look",
      titleKey: "season-autumn.look",
      defaultState: "disabled",
      follows: "autumn",
    },
  ],
});

export default season_autumnModule;
