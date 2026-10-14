import type { Application } from "pixi.js";

export type TickCallback = (deltaTime: number) => void;

/**
 * Одиночный подписчик на кадры: передаёт deltaTime каждому колбэку.
 * Возвращает функцию отписки. Используется сценами и анимациями
 * (вместо самописных setInterval/raf — правило из AGENTS.md).
 */
export function setupTicker(app: Application, callbacks: TickCallback[]): () => void {
  const onTick = ({ deltaTime }: { deltaTime: number }): void => {
    for (const callback of callbacks) callback(deltaTime);
  };
  app.ticker.add(onTick);
  return () => app.ticker.remove(onTick);
}
