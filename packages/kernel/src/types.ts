/**
 * Общие типы ядра. Ядро не знает имён ресурсов, зданий и модулей:
 * всё, что относится к игре, объявляет модуль.
 */

export type ModuleId = string;
export type ResourceId = string;

export type Lang = "ru" | "en";
export type Strings = Record<string, string>;

/** Состояние модуля на мир. */
export type ModuleState = "enabled" | "disabled";

/**
 * Вид модуля: решает, кто может его гасить.
 * core — основная механика: только карантин и сервисное выключение с причиной;
 * timed — временное событие: ядро по расписанию, оператор вручную;
 * seasonal — порá года: ядро по расписанию, оператор вручную.
 */
export type ModuleKind = "core" | "timed" | "seasonal";

export const MODULE_KINDS = ["core", "timed", "seasonal"] as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Фазы ядра. Новой фазы у модуля нет. */
export const PHASES = [
  "production",
  "limit",
  "price",
  "march_speed",
  "strike",
  "defense",
  "build_speed",
  "gather",
] as const;

export type Phase = (typeof PHASES)[number];

/** Гнёзда оболочки. Модуль вида кладёт в них панель или слой. */
export const SHELL_SLOTS = [
  "boot.language",
  "boot.slides",
  "creation.steps",
  "hud.resources",
  "nav.primary",
  "court.view",
  "map.layers",
  "report.rows",
  "lord.panel",
  "sheet",
] as const;

export type SlotId = (typeof SHELL_SLOTS)[number];

/** Каналы журнала. Один файл на всё не используется. */
export const JOURNAL_CHANNELS = ["audit", "sim", "security", "access", "app"] as const;

export type JournalChannel = (typeof JOURNAL_CHANNELS)[number];

/** Клетка карты. */
export interface TileRef {
  x: number;
  y: number;
}

/** Часы мира и постоянные числа мира. */
export interface WorldFacts {
  id: string;
  name: string;
  seed: number;
  /** Сторона квадрата карты в клетках. */
  size: number;
  /** Число зон от центра. */
  zones: number;
  /** Зона шрама ямы. */
  zonePit: number;
  /** Зона столицы. */
  zoneCapital: number;
  /** Мировое время шага. Часы мира стоят, пока процесс не работает. */
  now: number;
  /** Сколько миллисекунд мир стоял всего. */
  downtimeMs: number;
}

/** Кто действует. */
export interface ActorFacts {
  id: string;
  worldId: string;
  name: string;
  clanId: string | null;
  isBot: boolean;
  /** Тип лорда: Плоть, Кость или Спора. Бонус типа читают модификаторы. */
  type?: string;
}

/** Снимок склада: ресурс → целое число. */
export type StockSnapshot = Readonly<Record<ResourceId, number>>;

/** Порядок строк в словаре одинаков: ключ есть в обоих языках или его нет нигде. */
export function stringsProblems(moduleId: ModuleId, ru: Strings, en: Strings): string[] {
  const problems: string[] = [];
  const ruKeys = Object.keys(ru).sort();
  const enKeys = Object.keys(en).sort();
  for (const key of ruKeys) {
    if (!Object.hasOwn(en, key)) problems.push(`${moduleId}: ключ ${key} есть в ru и нет в en`);
    if (ru[key] === "") problems.push(`${moduleId}: пустой текст ru.${key}`);
  }
  for (const key of enKeys) {
    if (!Object.hasOwn(ru, key)) problems.push(`${moduleId}: ключ ${key} есть в en и нет в ru`);
    if (en[key] === "") problems.push(`${moduleId}: пустой текст en.${key}`);
  }
  return problems;
}

/** id модуля: латиница, цифры, дефис. */
export function isModuleId(value: string): boolean {
  return /^_?[a-z][a-z0-9-]*$/.test(value);
}
