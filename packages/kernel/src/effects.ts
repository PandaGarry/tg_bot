/**
 * Эффекты. Модуль не пишет в базу: он возвращает список эффектов,
 * ядро применяет их одной транзакцией.
 */

import type { JsonObject, JsonValue, JournalChannel, ModuleId, ResourceId, TileRef } from "./types.js";
import type { UnitId } from "./units.js";

/** Изменение склада. Ресурсы целые. */
export interface StockEffect {
  kind: "stock";
  resource: ResourceId;
  delta: number;
  /** Замок или мир, чей это склад. По умолчанию — замок действующего. */
  target?: string;
}

/** Дополнительные строки отчёта: игрок видит обычный отчёт, не служебный. */
export interface ReportEffect {
  kind: "report";
  /** Кому уходит отчёт. По умолчанию — действующему. */
  id?: string;
  /** Вид отчёта: «сбор», «бой», «проба». Строка словаря модуля. */
  reportKind: string;
  rows: ReportRow[];
}

export interface ReportRow {
  /** Ключ словаря модуля. */
  key: string;
  params?: Record<string, string | number>;
}

/** Поставить срок. `wakeAt` — мировое время. */
export interface SetDeadlineEffect {
  kind: "deadline.set";
  /** Постоянный id строки срока. Повторная постановка того же id обновляет срок. */
  id: string;
  wakeAt: number;
  /** Ключ идемпотентности: повторный вызов не создаёт второе событие. */
  key: string;
  payload?: JsonValue;
  /** Единица, которой принадлежит срок: карантин замораживает её работу. */
  unit?: UnitId;
}

/**
 * Начало отрезка сбора. Скорость и время записывает ядро:
 * сумму сбора модуль не называет.
 */
export interface GatherStartEffect {
  kind: "gather.start";
  id: string;
  resource: ResourceId;
  speedPerHour: number;
  startedAtMs: number;
  /** Запас точки в момент занятия. */
  stockLeft: number;
  /** Грузоподъёмность отряда. */
  capacity: number;
  target?: string;
}

/** Конец отрезка сбора. Сумму считает ядро по записанным скорости и времени. */
export interface GatherClaimEffect {
  kind: "gather.claim";
  id: string;
  endedAtMs: number;
  /** Остаток точки на момент конца: бой или конец сбора. */
  stockLeftNow: number;
  /** Что назвал модуль. В начисление не идёт, расхождение уходит в sim. */
  claimed?: number;
  target?: string;
}

/** Сбор прерван без выдачи: точка исчезла, отряд погиб. */
export interface GatherCancelEffect {
  kind: "gather.cancel";
  id: string;
}

/** Снять срок. Ненаступивший или уже проведённый — не ошибка. */
export interface CancelDeadlineEffect {
  kind: "deadline.cancel";
  id: string;
}

/** Событие для журнала. Клиенту уходит только ключ словаря. */
export interface JournalEventEffect {
  kind: "journal";
  channel: JournalChannel;
  event: string;
  entity?: string;
  detail?: JsonValue;
}

/**
 * Кусок патча. Маршрут обязателен: патч собирается под получателя,
 * общего патча «всему миру» нет.
 */
export interface PatchEffect {
  kind: "patch";
  route: PatchRoute;
  ops: PatchOp[];
}

export type PatchRoute =
  /** Только действующему: его склад, его замок, его отчёты. */
  | { kind: "actor"; id?: string }
  /** Владельцу клетки и тем, кто смотрит эти клетки. */
  | { kind: "tiles"; tiles: TileRef[] }
  /** Клану действующего. */
  | { kind: "clan" };

export interface PatchOp {
  op: "set" | "del" | "add";
  /** Путь в состоянии вида: «stock.meat», «tile.12.34». */
  path: string;
  value?: JsonValue;
}

/**
 * Запись строки в таблицу модуля. Ядро пишет только в таблицы, объявленные
 * этим модулем, и только с параметрами: сырого SQL от модуля нет.
 * `world_id` ядро подставляет само.
 */
export interface RowsUpsertEffect {
  kind: "rows.upsert";
  table: string;
  /** Ключ строки: колонки без world_id. */
  key: JsonObject;
  /** Значения: колонки без world_id. */
  value: JsonObject;
}

/** Удаление строки таблицы модуля по ключу. */
export interface RowsDeleteEffect {
  kind: "rows.delete";
  table: string;
  key: JsonObject;
}

/**
 * Модуль гасит себя сам: так живёт сезонное событие. Только себя: чужой
 * выключатель ядро отвергает, иначе один модуль правил бы расчёт другого.
 * Включение обратно — дело оператора или админа, у модуля такого пути нет:
 * выключенный модуль не получает ни команды, ни срока.
 */
export interface DisableModuleEffect {
  kind: "disable";
  module: ModuleId;
  /** Единица внутри модуля: гасим механику, а не всю систему. Пусто — модуль целиком. */
  unit?: UnitId;
}

/** Отказ ключом. Ключ должен быть в словаре модуля. */
export interface FailEffect {
  kind: "error";
  key: string;
  params?: Record<string, string | number>;
}

export type Effect =
  | StockEffect
  | ReportEffect
  | DisableModuleEffect
  | RowsUpsertEffect
  | RowsDeleteEffect
  | GatherStartEffect
  | GatherClaimEffect
  | GatherCancelEffect
  | SetDeadlineEffect
  | CancelDeadlineEffect
  | JournalEventEffect
  | PatchEffect
  | DisableModuleEffect
  | FailEffect;

export type EffectList = readonly Effect[];
