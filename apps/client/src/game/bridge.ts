/**
 * ЕДИНСТВЕННАЯ связь Pixi-сцены (src/game/) и React-HUD (src/ui/).
 * Прямых вызовов методов между слоями нет — только события.
 * Без зависимостей: простая карта слушателей.
 */

import type { CourtCell, CourtSceneMode, CourtState } from "../shared/court.js";

export interface TileClick extends CourtCell {}

export interface BuildingClick extends CourtCell {
  id: string;
  type: string;
}

export interface CameraMoved {
  x: number;
  y: number;
  zoom: number;
}

/** Авторитетный снимок двора из серверного view/patch. */
export interface StateUpdate {
  court: CourtState;
}

/** Кнопка HUD просит действие: React переводит его в команду @tdl/protocol. */
export interface HudAction {
  action: string;
  payload?: unknown;
}

export interface BridgeEvents {
  "tile:click": TileClick;
  "building:click": BuildingClick;
  "camera:moved": CameraMoved;
  "state:update": StateUpdate;
  "scene:mode": CourtSceneMode;
  "hud:action": HudAction;
}

type EventName = keyof BridgeEvents;

class Bridge {
  private listeners = new Map<EventName, Set<(payload: never) => void>>();
  /** Сцена может загрузиться после React: последние снимок и режим должны дойти до неё. */
  private latest = new Map<EventName, unknown>();

  /** Подписаться; возвращает функцию отписки. */
  on<K extends EventName>(name: K, callback: (payload: BridgeEvents[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    const wrapped = callback as (payload: never) => void;
    set.add(wrapped);
    const latest = this.latest.get(name);
    if (latest !== undefined) callback(latest as BridgeEvents[K]);
    return () => {
      set.delete(wrapped);
    };
  }

  /** Подать событие. Без слушателей — тихо (этапы идут последовательно). */
  emit<K extends EventName>(name: K, payload: BridgeEvents[K]): void {
    if (name === "state:update" || name === "scene:mode") this.latest.set(name, payload);
    const set = this.listeners.get(name);
    if (!set) return;
    for (const listener of set) {
      (listener as (payload: BridgeEvents[K]) => void)(payload);
    }
  }
}

export const bridge = new Bridge();
