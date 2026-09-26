/**
 * Порá года: весна: талая вода, длинные переходы.
 *
 * Полоса `season` держит «ровно одна включена»: весна, лето, осень и зима
 * стыкуются встык, без дыр и без наложений. Вид игры — единица `look`.
 */

import { defineModule } from "@tdl/kernel";

export const season_springModule = defineModule({
  id: "season-spring",
  version: 1,
  kind: "seasonal",
  content: {
    strings: {
      ru: {
        "season-spring.name": "Весна",
        "season-spring.look": "Вид весна",
      },
      en: {
        "season-spring.name": "Spring",
        "season-spring.look": "Spring look",
      },
    },
  },
  units: [
    {
      id: "spring",
      role: "season",
      titleKey: "season-spring.name",
      defaultState: "disabled",
      lane: "season",
      window: {
        repeat: { kind: "yearly", month: 3, day: 1 },
        at: "00:00",
        lengthMs: 92 * 86_400_000,
        until: { month: 6, day: 1 },
      },
    },
    {
      // Вид поры: гнёзда оболочки и палитра. Расписания у вида нет, и своей
      // воли тоже: он идёт за самой порой — включили зиму, включился и вид.
      id: "look",
      role: "look",
      titleKey: "season-spring.look",
      defaultState: "disabled",
      follows: "spring",
    },
  ],
});

export default season_springModule;
