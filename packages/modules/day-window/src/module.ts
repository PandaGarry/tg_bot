/**
 * Окно дня. Одно событие в сутки, фон для игрока: сбор, стройка, обучение,
 * марш, стража. Выбор идёт по дате и поре года, поэтому календарь виден заранее.
 *
 * Числа — из docs/game/11-calendar.md. Здесь только объявления: награды
 * придут вместе с механиками, которым они нужны.
 */

import { defineModule } from "@tdl/kernel";

const DAY_MS = 86_400_000;

export const dayWindowModule = defineModule({
  id: "day-window",
  version: 1,
  kind: "timed",
  content: {
    strings: {
      ru: {
        "day-window.gather-day": "День сбора",
        "day-window.build-day": "День постройки",
        "day-window.train-day": "День обучения",
        "day-window.march-day": "День марша",
        "day-window.wall-day": "День стражи",
      },
      en: {
        "day-window.gather-day": "Day of Gathering",
        "day-window.build-day": "Day of Building",
        "day-window.train-day": "Day of Training",
        "day-window.march-day": "Day of Marching",
        "day-window.wall-day": "Day of the Watch",
      },
    },
  },
  units: [
    {
      id: "gather-day",
      role: "event",
      titleKey: "day-window.gather-day",
      defaultState: "disabled",
      lane: "daily",
      rotation: {
        lane: "daily",
        weight: 3,
        cooldownDays: 4,
        at: "12:00",
        lengthMs: DAY_MS,
        seasons: ["spring", "autumn"],
      },
    },
    {
      id: "build-day",
      role: "event",
      titleKey: "day-window.build-day",
      defaultState: "disabled",
      lane: "daily",
      rotation: { lane: "daily", weight: 3, cooldownDays: 4, at: "12:00", lengthMs: DAY_MS, seasons: ["spring", "summer"] },
    },
    {
      id: "train-day",
      role: "event",
      titleKey: "day-window.train-day",
      defaultState: "disabled",
      lane: "daily",
      rotation: { lane: "daily", weight: 3, cooldownDays: 4, at: "12:00", lengthMs: DAY_MS, seasons: ["summer", "autumn"] },
    },
    {
      id: "march-day",
      role: "event",
      titleKey: "day-window.march-day",
      defaultState: "disabled",
      lane: "daily",
      rotation: { lane: "daily", weight: 3, cooldownDays: 4, at: "12:00", lengthMs: DAY_MS },
    },
    {
      id: "wall-day",
      role: "event",
      titleKey: "day-window.wall-day",
      defaultState: "disabled",
      lane: "daily",
      rotation: { lane: "daily", weight: 2, cooldownDays: 4, at: "12:00", lengthMs: DAY_MS, seasons: ["autumn", "winter"] },
    },
  ],
});

export default dayWindowModule;
