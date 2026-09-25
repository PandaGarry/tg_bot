/**
 * Большое событие месяца: десять дней — семь на подготовку и три на главное окно.
 * Модуль стоит выключенным, пока нет столицы (шаг 10): включается вместе с ней.
 */

import { defineModule } from "@tdl/kernel";

const DAY_MS = 86_400_000;

export const monthWindowModule = defineModule({
  id: "month-window",
  version: 1,
  kind: "timed",
  defaultState: "disabled",
  content: {
    strings: {
      ru: { "month-window.capital": "Десять дней столицы" },
      en: { "month-window.capital": "Ten Days of the Capital" },
    },
  },
  units: [
    {
      id: "capital-ten-day",
      role: "event",
      titleKey: "month-window.capital",
      defaultState: "disabled",
      lane: "monthly",
      window: { repeat: { kind: "monthly", day: 1 }, at: "00:00", lengthMs: 10 * DAY_MS },
    },
  ],
});

export default monthWindowModule;
