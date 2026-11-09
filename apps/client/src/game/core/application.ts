import { Application } from "pixi.js";
import { setupResize } from "./resize.js";

/**
 * Pixi-приложение сцены: один экземпляр на весь клиент.
 * Canvas живёт в контейнере (#pixi-root) и лежит под React-HUD (#hud-root).
 *
 * preference: "webgl" — 2D-спрайт-сцене WebGPU ничего не даёт, а WebGL
 * предсказуемее в мобильных webview (см. doc 27, риски).
 */
class GameApp {
  private app: Application | null = null;
  private unsubscribeResize: (() => void) | null = null;

  get ready(): boolean {
    return this.app !== null;
  }

  get instance(): Application | null {
    return this.app;
  }

  async init(container: HTMLElement): Promise<void> {
    if (this.app) return;
    const app = new Application();
    await app.init({
      preference: "webgl",
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      // На ретины выше 2x пиксели просто тратим: спрайты не становятся детальнее.
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    container.appendChild(app.canvas);
    this.unsubscribeResize = setupResize(app);
    this.app = app;
    console.info("[Pixi] Initialized");
  }

  destroy(): void {
    if (!this.app) return;
    this.unsubscribeResize?.();
    this.unsubscribeResize = null;
    // Текстуры принадлежат глобальному PIXI.Assets и переживают remount приложения.
    // Уничтожение Texture здесь оставит Assets и наш кэш со ссылками на мёртвые объекты.
    this.app.destroy(true, { children: true, texture: false, textureSource: false });
    this.app = null;
  }
}

export const gameApp = new GameApp();
