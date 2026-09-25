/**
 * Порá года: зима: короткий день, окна боя короче.
 *
 * Полоса `season` держит «ровно одна включена»: весна, лето, осень и зима
 * стыкуются встык, без дыр и без наложений. Вид игры — единица `look`.
 */

import { defineModule } from "@tdl/kernel";

export const season_winterModule = defineModule({
  id: "season-winter",
  version: 1,
  kind: "seasonal",
  content: {
    strings: {
      ru: {
        "season-winter.name": "Зима",
        "season-winter.look": "Вид зима",
      },
      en: {
        "season-winter.name": "Winter",
        "season-winter.look": "Winter look",
      },
    },
  },
  units: [
    {
      id: "winter",
      role: "season",
      titleKey: "season-winter.name",
      defaultState: "disabled",
      lane: "season",
      window: {
        repeat: { kind: "yearly", month: 12, day: 1 },
        at: "00:00",
        lengthMs: 92 * 86_400_000,
        until: { month: 3, day: 1 },
      },
    },
    {
      // Вид поры: гнёзда оболочки и палитра. Расписания у вида нет.
      id: "look",
      role: "look",
      titleKey: "season-winter.look",
      defaultState: "disabled",
    },
  ],
});

export default season_winterModule;
