/**
 * Контракт вида. Оболочка держит гнёзда, модуль вида кладёт в них панель
 * или слой карты. Ширину модуль не считает — это работа оболочки.
 */

import type { ComponentType } from "react";
import type { JsonValue, ModuleId, Strings } from "@tdl/kernel";
import type { Locale } from "./version.js";

export interface WorldViewBase {
  world: {
    id: string;
    name: string;
    size: number;
    zones: number;
    zonePit: number;
    zoneCapital: number;
    /** Мировое время на момент отправки. */
    now: number;
    /** Сколько мир стоял всего. */
    downtimeMs: number;
  };
  me: {
    id: string;
    name: string;
    portrait: string;
    bannerSign: string;
    bannerColor: string;
    type: string;
    clanId: string | null;
  } | null;
  stock: Record<string, number>;
  /** Состояние вида каждого модуля: чужих данных здесь нет. */
  modules: Record<ModuleId, JsonValue>;
}

/** Рисование слоя карты. Оболочка владеет Pixi, модуль только просит. */
export interface MapDrawApi {
  tileSize: number;
  scale: number;
  width: number;
  height: number;
  visible: { x: number; y: number; w: number; h: number };
  project(x: number, y: number): { sx: number; sy: number };
  mark(kind: string, x: number, y: number, options?: { tint?: number; label?: string; badge?: string }): void;
  fill(x: number, y: number, options?: { color?: number; alpha?: number }): void;
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options?: { color?: number; width?: number; alpha?: number; dashed?: boolean },
  ): void;
  /** Клетка под пальцем или курсором. */
  selected?: { x: number; y: number };
}

export interface SlotPropsBase {
  lang: Locale;
  view: WorldViewBase;
  /** Мировое время с сервера: срок на клиенте и сервере один. */
  serverNow: number;
  /** Отправка команды. Клиент не прибавляет ресурсы сам. */
  send(commandId: string, payload?: JsonValue): void;
  /** Ключ словаря этого модуля. */
  t(key: string, params?: Record<string, string | number>): string;
  /** Состояние вида этого модуля. */
  module<T = JsonValue>(): T;
}

export interface BootLanguageProps extends SlotPropsBase {
  setLang(lang: Locale): void;
}

export interface BootSlidesProps extends SlotPropsBase {
  /** Пропуск доступен со второго слайда. */
  canSkip: boolean;
  onDone(): void;
}

export interface CreationProps extends SlotPropsBase {
  /** Кнопка «Занять двор». */
  onDone(): void;
}

export interface NavProps extends SlotPropsBase {
  route: string;
  go(route: string): void;
}

export interface ReportProps extends SlotPropsBase {
  report: JsonValue;
}

export interface SheetProps extends SlotPropsBase {
  opened: boolean;
  open(): void;
  close(): void;
}

export interface SlotPropsMap {
  "boot.language": BootLanguageProps;
  "boot.slides": BootSlidesProps;
  "creation.steps": CreationProps;
  "hud.resources": SlotPropsBase;
  "nav.primary": NavProps;
  "court.view": SlotPropsBase;
  "map.layers": SlotPropsBase & { draw: MapDrawApi };
  "report.rows": ReportProps;
  "lord.panel": SlotPropsBase;
  sheet: SheetProps;
}

export type SlotId = keyof SlotPropsMap;

export interface MapLayerDecl {
  id: string;
  order: number;
  /** Оболочка вызывает рисование, когда слой виден. */
  paint(draw: MapDrawApi, props: SlotPropsBase): void;
}

export interface ModuleView {
  id: ModuleId;
  slots?: Partial<{ [K in SlotId]: ComponentType<SlotPropsMap[K]> }>;
  mapLayers?: MapLayerDecl[];
  /** Словари модуля: те же ключи, что у сервера. */
  strings?: { ru: Strings; en: Strings };
}

export function defineView(view: ModuleView): ModuleView {
  return view;
}
