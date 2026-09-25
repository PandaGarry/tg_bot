/**
 * Сборка гнёзд. Оболочка держит место, модуль вида кладёт в него панель.
 * Ширину модуль не считает.
 */

import type { ComponentType, ReactNode } from "react";
import type { JsonValue, Locale, SlotId, SlotPropsMap, WorldViewBase } from "@tdl/protocol";
import { sendCommand } from "./net.js";
import { translator } from "./i18n/index.js";
import { views } from "@tdl/modules/views";
import { store } from "./store.js";

export function slotProps<K extends SlotId>(
  moduleId: string,
  view: WorldViewBase,
  lang: Locale,
  serverNow: number,
  extra: Partial<SlotPropsMap[K]> = {},
): SlotPropsMap[K] {
  const t = translator(lang, moduleId);
  return {
    lang,
    view,
    serverNow,
    send: (commandId: string, payload?: JsonValue) => sendCommand(commandId, payload ?? {}),
    t,
    module: <T = JsonValue,>() => (view.modules?.[moduleId] ?? null) as T,
    ...extra,
  } as SlotPropsMap[K];
}

export interface SlotRenderProps {
  slot: SlotId;
  view: WorldViewBase;
  lang: Locale;
  serverNow: number;
  extra?: Record<string, unknown>;
  empty?: ReactNode;
}

export function Slot({ slot, view, lang, serverNow, extra, empty = null }: SlotRenderProps): ReactNode {
  const rendered = views.map((moduleView) => {
    const component = moduleView.slots?.[slot] as ComponentType<Record<string, unknown>> | undefined;
    if (!component) return null;
    const Component = component;
    const props = slotProps(moduleView.id, view, lang, serverNow, (extra ?? {}) as Partial<SlotPropsMap[SlotId]>);
    return <Component key={`${moduleView.id}:${slot}`} {...(props as unknown as Record<string, unknown>)} />;
  });
  const filled = rendered.some((node) => node !== null);
  return <>{filled ? rendered : empty}</>;
}

/** Гнездо заполнено, если вид есть и модуль открыт в этом мире. */
export function hasSlot(slot: SlotId): boolean {
  const open = store.get().ready?.modules;
  return views.some(
    (moduleView) => Boolean(moduleView.slots?.[slot]) && (open === undefined || open.includes(moduleView.id)),
  );
}
