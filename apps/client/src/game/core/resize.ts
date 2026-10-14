import type { Application } from "pixi.js";

/**
 * resizeTo уже следит за размером контейнера. Остаток — iOS: после
 * поворота экрана контейнер может отозваться с задержкой, поэтому при
 * orientationchange принудительно синхронизируем размер рендерера.
 */
export function setupResize(app: Application): () => void {
  const sync = (): void => {
    const el = app.canvas.parentElement;
    if (el) app.renderer.resize(el.clientWidth, el.clientHeight);
  };
  window.addEventListener("orientationchange", sync);
  return () => window.removeEventListener("orientationchange", sync);
}
