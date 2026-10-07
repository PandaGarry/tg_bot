/**
 * ЕДИНСТВЕННАЯ связь Pixi-сцены (src/game/) и React-HUD (src/ui/).
 * Прямых вызовов методов между слоями нет — только события.
 * Без зависимостей: простая карта слушателей.
 */

export interface TileClick {
  x: number;
  z: number;
}

export interface BuildingClick {
  id: string;
  type: string;
}

export interface CameraMoved {
  x: number;
  y: number;
  zoom: number;
}

/** Состояние двора из серверного вида/патча (детализируется в этапе 2). */
export interface StateUpdate {
  court: unknown;
}

/** Кнопка HUD просит действие: net.ts шлёт его серверу. */
export interface HudAction {
  action: string;
  payload?: unknown;
}

export interface BridgeEvents {
  "tile:click": TileClick;
  "building:click": BuildingClick;
  "camera:moved": CameraMoved;
  "state:update": StateUpdate;
  "hud:action": HudAction;
}

type EventName = keyof BridgeEvents;

class Bridge {
  private listeners = new Map<EventName, Set<(payload: never) => void>>();

  /** Подписаться; возвращает функцию отписки. */
  on<K extends EventName>(name: K, callback: (payload: BridgeEvents[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    const wrapped = callback as (payload: never) => void;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  /** Подать событие. Без слушателей — тихо (этапы идут последовательно). */
  emit<K extends EventName>(name: K, payload: BridgeEvents[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const listener of set) {
      (listener as (payload: BridgeEvents[K]) => void)(payload);
    }
  }
}

export const bridge = new Bridge();
