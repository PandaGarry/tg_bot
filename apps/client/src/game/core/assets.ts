import { Assets, type Texture } from "pixi.js";

const loaded = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();

/**
 * Текстуры — только через PIXI.Assets (правило из AGENTS.md):
 * без new Image() и без <img> под сцену.
 *
 * Спрайты зданий/земли — плоские PNG из конвейера `pnpm icons`, поэтому
 * атласы пока не нужны. Если спрайтов станет сотни — добавим загрузку
 * .json-манифеста атласа в этот же модуль (кэш уже общий).
 */
export function loadTexture(name: string, url: string): Promise<Texture> {
  const cached = loaded.get(name);
  if (cached) return Promise.resolve(cached);

  // Несколько объектов одного типа могут запросить один PNG в одном кадре.
  // Держим общий Promise, чтобы не запускать повторные сетевые/декодирующие работы.
  const inFlight = pending.get(name);
  if (inFlight) return inFlight;

  let request: Promise<Texture>;
  request = Assets.load<Texture>(url)
    .then((texture) => {
      loaded.set(name, texture);
      return texture;
    })
    .finally(() => {
      // Не удаляем более новый запрос, если реализация когда-либо будет заменена.
      if (pending.get(name) === request) pending.delete(name);
    });
  pending.set(name, request);
  return request;
}

export function getTexture(name: string): Texture | undefined {
  return loaded.get(name);
}
