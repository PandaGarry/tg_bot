/**
 * Единица внутри модуля. Модуль — каталог кода, единица — то, что гасят
 * точечно: механика, событие, порá года, вид, дорожка пропуска.
 *
 * Единица принадлежит ровно одному модулю; чужая команда её не трогает.
 * Работает единица, только если включён и модуль, и она сама.
 */

import type { ModuleId, ModuleState } from "./types.js";

export type UnitId = string;

/** Полоса: правила совместной жизни окон. Полосы общие на всю сборку. */
export type LaneId = "daily" | "weekly" | "monthly" | "feast" | "hourly" | "season";

/** Пора года: по ней фильтруются повседневные окна. */
export type SeasonId = "spring" | "summer" | "autumn" | "winter";

/** Что за единица. Вид решает, кому её можно гасить и как она включается. */
export type UnitRole =
  /** Механика двора, карты, марша, боя: основной слой. */
  | "mechanic"
  /** Событие: праздник, неделя, день, часовое окно. */
  | "event"
  /** Порá года: ровно одна включена во всём мире. */
  | "season"
  /** Вид игры: палитра, слои, оформление. */
  | "look"
  /** Дорожка пропуска: награды за игру в сезоне. */
  | "pass";

/** Повтор окна. Время — по часам мира, то есть по серверным часам мира. */
export type WindowRepeat =
  | { kind: "daily" }
  | { kind: "weekly"; /** 0 — понедельник, 6 — воскресенье. */ weekday: number }
  | { kind: "monthly"; /** День месяца 1–28, чтобы не спорить с короткими месяцами. */ day: number }
  | { kind: "yearly"; month: number; day: number }
  /** Подвижный праздник: считается, а не записывается. Сейчас это Пасха. */
  | { kind: "movable"; feast: "easter"; offsetDays: number }
  | { kind: "once"; /** Год UTC-часов мира. */ year: number; month: number; day: number };

/** Точное окно: известны дата, время и длина. Праздники и поры года. */
export interface WindowDecl {
  repeat: WindowRepeat;
  /** Час и минута по часам мира, «18:00». */
  at: string;
  /** Длина окна. У пор года задаётся рубеж `until`: зима разной длины в високосный год. */
  lengthMs: number;
  /** Рубеж конца окна: «1.06». Длина тогда считается до стыка, а не числом. */
  until?: { month: number; day: number };
}

/** Пул повседневных окон: из него ядро выбирает по дате, без случайности процесса. */
export interface RotationDecl {
  lane: LaneId;
  /** Вес выбора: чем больше, тем чаще единица выпадает. */
  weight: number;
  /** Не выпадать чаще, чем раз в столько дней. */
  cooldownDays: number;
  /** Час и минута начала окна по часам мира. */
  at: string;
  lengthMs: number;
  /** Только эти месяцы. Пусто — все. */
  months?: readonly number[];
  /** Только эти поры года. Пусто — все. */
  seasons?: readonly SeasonId[];
  /** Выбор идёт только в эти дни недели (0 — понедельник). Пусто — любой день. */
  weekdays?: readonly number[];
}

export interface UnitDecl {
  id: UnitId;
  role: UnitRole;
  /** Имя для панели: ключ словаря, не строка. */
  titleKey: string;
  /** Состояние на новом мире. У событий и пор года — disabled. */
  defaultState?: ModuleState;
  /** Полоса: правила совместной жизни окон. */
  lane?: LaneId;
  /** Точные даты. */
  window?: WindowDecl;
  /** Пул повседневных окон. */
  rotation?: RotationDecl;
  /**
   * Живёт по этой единице модуля: та включена — включена и эта, та погасла —
   * гаснет и она. Так вид поры года идёт за самой порой: одна воля, одно
   * состояние, и в панели видно, откуда оно взялось.
   */
  follows?: UnitId;
}

/** Правила полосы. Одно место на всю игру: меняют числа здесь, модули не трогают. */
export interface LaneRules {
  /** Сколько окон полосы может идти одновременно. */
  maxAtOnce: number;
  /** Сколько окон полосы может начаться за сутки. */
  maxPerDay: number;
  /** Сколько окон полосы может начаться за месяц. */
  maxPerMonth: number;
  /** Просвет между окнами полосы. */
  minGapMs: number;
  /** Ровно одна единица полосы включена в любой миг. */
  exactlyOne?: boolean;
  /** Полоса не терпит пустого дня: если все на кулдауне, берётся самый давний. */
  requireWindow?: boolean;
}

/**
 * Полосы и их правила. Числа — календарные, из docs/game/11-calendar.md;
 * меняются здесь, а не в модулях.
 */
export const LANES: Readonly<Record<LaneId, LaneRules>> = {
  // Окно дня идёт всегда: это фон, а не событие.
  daily: { maxAtOnce: 1, maxPerDay: 1, maxPerMonth: 31, minGapMs: 0, requireWindow: true },
  // Выходные свободны от события недели.
  weekly: { maxAtOnce: 1, maxPerDay: 1, maxPerMonth: 5, minGapMs: 0 },
  // Большое событие месяца: подготовка и главное окно, не чаще раза в 14 дней.
  monthly: { maxAtOnce: 1, maxPerDay: 1, maxPerMonth: 1, minGapMs: 14 * 86_400_000 },
  // Праздники («feast»): окна 3–16 дней, не больше одного за раз, просвет не меньше недели.
  feast: { maxAtOnce: 1, maxPerDay: 1, maxPerMonth: 2, minGapMs: 7 * 86_400_000 },
  // Часовые окна: не больше двух в сутки, между ними не меньше часа.
  hourly: { maxAtOnce: 1, maxPerDay: 2, maxPerMonth: 62, minGapMs: 60 * 60_000 },
  // Поры года: ровно одна в любой миг, стык в стык.
  season: { maxAtOnce: 1, maxPerDay: 1, maxPerMonth: 1, minGapMs: 0, exactlyOne: true },
} as const;

export const LANE_IDS = Object.keys(LANES) as readonly LaneId[];

export function isLaneId(value: string): value is LaneId {
  return (LANE_IDS as readonly string[]).includes(value);
}

/** Разбор «18:30» в минуты от полуночи. null — строка не той формы. */
export function parseAt(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

/** Пора года по месяцу: границы календарные, из 11-calendar.md. */
export function seasonOfMonth(month: number): SeasonId {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * Проверка объявления единицы. Возвращает текст проблем: пусто — всё верно.
 * Имя модуля нужно только для понятного текста.
 */
export function unitProblems(moduleId: ModuleId, unit: UnitDecl): string[] {
  const problems: string[] = [];
  const where = `${moduleId}.${unit.id}`;
  if (!/^[a-z][a-z0-9-]*$/.test(unit.id)) problems.push(`${where}: id единицы только строчная латиница, цифры и дефис`);
  if (!unit.titleKey.includes(".")) problems.push(`${where}: имя для панели — ключ словаря вида «модуль.имя»`);
  if (unit.lane !== undefined && !isLaneId(unit.lane)) problems.push(`${where}: полосы ${unit.lane} в игре нет`);
  if (unit.window && unit.rotation) problems.push(`${where}: окно задано и датой, и пулом — выбрать одно`);
  if (!unit.window && !unit.rotation && unit.role !== "mechanic" && unit.role !== "look" && unit.role !== "pass") {
    problems.push(`${where}: у события нет ни даты, ни пула`);
  }
  if (unit.window) {
    const minutes = parseAt(unit.window.at);
    if (minutes === null) problems.push(`${where}: время окна «${unit.window.at}» не формы «ЧЧ:ММ»`);
    if (!Number.isFinite(unit.window.lengthMs) || unit.window.lengthMs <= 0) {
      problems.push(`${where}: длина окна должна быть положительной`);
    }
    if (unit.window.until) {
      const until = unit.window.until;
      if (!Number.isInteger(until.month) || until.month < 1 || until.month > 12) {
        problems.push(`${where}: месяца рубежа ${until.month} не бывает`);
      } else if (!Number.isInteger(until.day) || until.day < 1 || until.day > daysInMonth(until.month)) {
        problems.push(`${where}: дня рубежа ${until.day} в месяце ${until.month} не бывает`);
      }
      if (unit.window.repeat.kind !== "yearly") problems.push(`${where}: рубеж конца только у годового окна`);
    }
    problems.push(...repeatProblems(where, unit.window.repeat));
  }
  if (unit.rotation) {
    const r = unit.rotation;
    if (parseAt(r.at) === null) problems.push(`${where}: время пула «${r.at}» не формы «ЧЧ:ММ»`);
    if (!Number.isFinite(r.lengthMs) || r.lengthMs <= 0) problems.push(`${where}: длина окна пула должна быть положительной`);
    if (!Number.isInteger(r.weight) || r.weight <= 0) problems.push(`${where}: вес пула — целое больше нуля`);
    if (!Number.isInteger(r.cooldownDays) || r.cooldownDays < 0) problems.push(`${where}: кулдаун пула — целое не меньше нуля`);
    for (const month of r.months ?? []) {
      if (!Number.isInteger(month) || month < 1 || month > 12) problems.push(`${where}: месяца ${month} не бывает`);
    }
    for (const season of r.seasons ?? []) {
      if (!["spring", "summer", "autumn", "winter"].includes(season)) problems.push(`${where}: поры года ${season} нет`);
    }
    for (const weekday of r.weekdays ?? []) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) problems.push(`${where}: дня недели ${weekday} нет`);
    }
  }
  // Механика, вид и дорожка живут без расписания: их включает оператор.
  if ((unit.role === "mechanic" || unit.role === "look" || unit.role === "pass") && (unit.window || unit.rotation)) {
    problems.push(`${where}: роль ${unit.role} живёт без расписания`);
  }
  return problems;
}

function repeatProblems(where: string, repeat: WindowRepeat): string[] {
  const problems: string[] = [];
  const check = (month: number, day: number): void => {
    if (!Number.isInteger(month) || month < 1 || month > 12) problems.push(`${where}: месяца ${month} не бывает`);
    else if (!Number.isInteger(day) || day < 1 || day > daysInMonth(month)) {
      problems.push(`${where}: дня ${day} в месяце ${month} не бывает`);
    }
  };
  switch (repeat.kind) {
    case "daily":
      break;
    case "weekly":
      if (!Number.isInteger(repeat.weekday) || repeat.weekday < 0 || repeat.weekday > 6) {
        problems.push(`${where}: день недели ${repeat.weekday} вне 0–6`);
      }
      break;
    case "monthly":
      // День месяца держим до 28: короткие месяцы не спорят с расписанием.
      if (!Number.isInteger(repeat.day) || repeat.day < 1 || repeat.day > 28) {
        problems.push(`${where}: день месяца ${repeat.day} вне 1–28`);
      }
      break;
    case "yearly":
      check(repeat.month, repeat.day);
      break;
    case "movable":
      if (repeat.feast !== "easter") problems.push(`${where}: подвижного праздника ${repeat.feast} нет`);
      if (!Number.isInteger(repeat.offsetDays) || Math.abs(repeat.offsetDays) > 30) {
        problems.push(`${where}: сдвиг подвижного праздника ${repeat.offsetDays} вне -30…30`);
      }
      break;
    case "once":
      if (!Number.isInteger(repeat.year) || repeat.year < 2025 || repeat.year > 2100) {
        problems.push(`${where}: год ${repeat.year} вне 2025–2100`);
      }
      check(repeat.month, repeat.day);
      break;
  }
  return problems;
}
