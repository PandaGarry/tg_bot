import { Assets, type Texture } from "pixi.js";

const loaded = new Map<string, Texture>();

/**
 * Текстуры — только через PIXI.Assets (правило из AGENTS.md):
 * без new Image() и без <img> под сцену.
 *
 * Спрайты зданий/земли — плоские PNG из конвейера `pnpm icons`, поэтому
 * атласы пока не нужны. Если спрайтов станет сотни — добавим загрузку
 * .json-манифеста атласа в этот же модуль (кэш уже общий).
 */
export async function loadTexture(name: string, url: string): Promise<Texture> {
  const cached = loaded.get(name);
  if (cached) return cached;
  const texture = await Assets.load<Texture>(url);
  loaded.set(name, texture);
  return texture;
}

export function getTexture(name: string): Texture | undefined {
  return loaded.get(name);
}
