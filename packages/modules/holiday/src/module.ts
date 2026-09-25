/**
 * Мировые праздники. Только те, что празднуют по всему миру: Новый год и
 * Рождество, День святого Валентина, 8 марта, Пасха, летний фестиваль,
 * годовщина игры, Хеллоуин.
 *
 * Лунного Нового года и Дня благодарения здесь нет: они привязаны к региону.
 * Вернуть их можно одной строкой — заказчик просил «пока только классические».
 */

import { defineModule } from "@tdl/kernel";

const DAY_MS = 86_400_000;

export const holidayModule = defineModule({
  id: "holiday",
  version: 1,
  kind: "timed",
  content: {
    strings: {
      ru: {
        "holiday.new-year": "Новый год и Рождество",
        "holiday.valentine": "День святого Валентина",
        "holiday.womens-day": "Женский день",
        "holiday.easter": "Пасха",
        "holiday.summer": "Летний фестиваль",
        "holiday.anniversary": "Годовщина игры",
        "holiday.halloween": "Хеллоуин",
      },
      en: {
        "holiday.new-year": "New Year and Christmas",
        "holiday.valentine": "Valentine's Day",
        "holiday.womens-day": "Women's Day",
        "holiday.easter": "Easter",
        "holiday.summer": "Summer Festival",
        "holiday.anniversary": "Game Anniversary",
        "holiday.halloween": "Halloween",
      },
    },
  },
  units: [
    {
      id: "new-year",
      role: "event",
      titleKey: "holiday.new-year",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 12, day: 20 }, at: "00:00", lengthMs: 16 * DAY_MS, until: { month: 1, day: 5 } },
    },
    {
      id: "valentine",
      role: "event",
      titleKey: "holiday.valentine",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 2, day: 12 }, at: "00:00", lengthMs: 3 * DAY_MS },
    },
    {
      id: "womens-day",
      role: "event",
      titleKey: "holiday.womens-day",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 3, day: 6 }, at: "00:00", lengthMs: 4 * DAY_MS },
    },
    {
      // Пасха — подвижный праздник: окно открывается за пять дней до неё.
      id: "easter",
      role: "event",
      titleKey: "holiday.easter",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "movable", feast: "easter", offsetDays: -5 }, at: "00:00", lengthMs: 10 * DAY_MS },
    },
    {
      id: "summer-fest",
      role: "event",
      titleKey: "holiday.summer",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 6, day: 1 }, at: "00:00", lengthMs: 10 * DAY_MS },
    },
    {
      id: "anniversary",
      role: "event",
      titleKey: "holiday.anniversary",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 8, day: 1 }, at: "00:00", lengthMs: 10 * DAY_MS },
    },
    {
      id: "halloween",
      role: "event",
      titleKey: "holiday.halloween",
      defaultState: "disabled",
      lane: "feast",
      window: { repeat: { kind: "yearly", month: 10, day: 25 }, at: "00:00", lengthMs: 7 * DAY_MS },
    },
  ],
});

export default holidayModule;
