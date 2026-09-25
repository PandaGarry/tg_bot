/**
 * Часовые окна: то, что в жанре живёт час-два внутри суток, а не целый день.
 * Ночная стража, обоз, сокровищница. Не больше двух в сутки и не ближе часа
 * друг к другу — правила полосы, а не модуля.
 */

import { defineModule } from "@tdl/kernel";

const HOUR_MS = 3_600_000;

export const hourWindowModule = defineModule({
  id: "hour-window",
  version: 1,
  kind: "timed",
  content: {
    strings: {
      ru: {
        "hour-window.watch-night": "Ночная стража",
        "hour-window.caravan": "Обоз",
        "hour-window.reliquary": "Сокровищница",
      },
      en: {
        "hour-window.watch-night": "Night Watch",
        "hour-window.caravan": "The Caravan",
        "hour-window.reliquary": "The Reliquary",
      },
    },
  },
  units: [
    {
      id: "watch-night",
      role: "event",
      titleKey: "hour-window.watch-night",
      defaultState: "disabled",
      lane: "hourly",
      rotation: { lane: "hourly", weight: 3, cooldownDays: 2, at: "18:00", lengthMs: HOUR_MS },
    },
    {
      id: "caravan",
      role: "event",
      titleKey: "hour-window.caravan",
      defaultState: "disabled",
      lane: "hourly",
      rotation: { lane: "hourly", weight: 2, cooldownDays: 2, at: "20:00", lengthMs: HOUR_MS },
    },
    {
      id: "reliquary",
      role: "event",
      titleKey: "hour-window.reliquary",
      defaultState: "disabled",
      lane: "hourly",
      rotation: { lane: "hourly", weight: 2, cooldownDays: 2, at: "22:00", lengthMs: HOUR_MS },
    },
  ],
});

export default hourWindowModule;
