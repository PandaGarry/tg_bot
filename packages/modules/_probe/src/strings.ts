/** Словари пробного модуля: ключ есть в обоих языках или его нет нигде. */

export const strings = {
  ru: {
    "resource.probe_dust": "Пробная пыль",
    "probe.panel.title": "Пробный модуль",
    "probe.panel.level": "Уровень",
    "probe.panel.ticks": "Тактов",
    "probe.poke": "Толкнуть",
    "probe.hush": "Погасить модуль",
    "probe.report.tick": "Пробный такт: пыли {amount}",
    "probe.report.poke": "Проба записана",
    "probe.hushed": "Пробный модуль погашен",
  },
  en: {
    "resource.probe_dust": "Probe dust",
    "probe.panel.title": "Probe module",
    "probe.panel.level": "Level",
    "probe.panel.ticks": "Ticks",
    "probe.poke": "Poke",
    "probe.hush": "Disable module",
    "probe.report.tick": "Probe tick: dust {amount}",
    "probe.report.poke": "Probe recorded",
    "probe.hushed": "Probe module is off",
  },
} as const;

export type ProbeStringKey = keyof typeof strings.ru;
