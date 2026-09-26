/**
 * Порá года: лето: сухой тракт, быстрый марш по своим клеткам.
 *
 * Полоса `season` держит «ровно одна включена»: весна, лето, осень и зима
 * стыкуются встык, без дыр и без наложений. Вид игры — единица `look`.
 */

import { defineModule } from "@tdl/kernel";

export const season_summerModule = defineModule({
  id: "season-summer",
  version: 1,
  kind: "seasonal",
  content: {
    strings: {
      ru: {
        "season-summer.name": "Лето",
        "season-summer.look": "Вид лето",
      },
      en: {
        "season-summer.name": "Summer",
        "season-summer.look": "Summer look",
      },
    },
  },
  units: [
    {
      id: "summer",
      role: "season",
      titleKey: "season-summer.name",
      defaultState: "disabled",
      lane: "season",
      window: {
        repeat: { kind: "yearly", month: 6, day: 1 },
        at: "00:00",
        lengthMs: 92 * 86_400_000,
        until: { month: 9, day: 1 },
      },
    },
    {
      // Вид поры: гнёзда оболочки и палитра. Расписания у вида нет, и своей
      // воли тоже: он идёт за самой порой — включили зиму, включился и вид.
      id: "look",
      role: "look",
      titleKey: "season-summer.look",
      defaultState: "disabled",
      follows: "summer",
    },
  ],
});

export default season_summerModule;
