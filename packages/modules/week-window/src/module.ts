/**
 * Событие недели. Шесть дней, понедельник — суббота; воскресенье свободно.
 * Тема недели выбирается по кругу, без повторов подряд.
 */

import { defineModule } from "@tdl/kernel";

const DAY_MS = 86_400_000;

export const weekWindowModule = defineModule({
  id: "week-window",
  version: 1,
  kind: "timed",
  content: {
    strings: {
      ru: {
        "week-window.harvest": "Неделя урожая",
        "week-window.forge": "Неделя кузни",
        "week-window.hunt": "Неделя охоты",
        "week-window.tithe": "Неделя десятины",
      },
      en: {
        "week-window.harvest": "Week of Harvest",
        "week-window.forge": "Week of the Forge",
        "week-window.hunt": "Week of the Hunt",
        "week-window.tithe": "Week of the Tithe",
      },
    },
  },
  units: [
    {
      id: "harvest-week",
      role: "event",
      titleKey: "week-window.harvest",
      defaultState: "disabled",
      lane: "weekly",
      rotation: { lane: "weekly", weight: 2, cooldownDays: 12, at: "00:00", lengthMs: 6 * DAY_MS, weekdays: [0] },
    },
    {
      id: "forge-week",
      role: "event",
      titleKey: "week-window.forge",
      defaultState: "disabled",
      lane: "weekly",
      rotation: { lane: "weekly", weight: 2, cooldownDays: 12, at: "00:00", lengthMs: 6 * DAY_MS, weekdays: [0] },
    },
    {
      id: "hunt-week",
      role: "event",
      titleKey: "week-window.hunt",
      defaultState: "disabled",
      lane: "weekly",
      rotation: { lane: "weekly", weight: 2, cooldownDays: 12, at: "00:00", lengthMs: 6 * DAY_MS, weekdays: [0] },
    },
    {
      id: "tithe-week",
      role: "event",
      titleKey: "week-window.tithe",
      defaultState: "disabled",
      lane: "weekly",
      rotation: { lane: "weekly", weight: 1, cooldownDays: 12, at: "00:00", lengthMs: 6 * DAY_MS, weekdays: [0] },
    },
  ],
});

export default weekWindowModule;
