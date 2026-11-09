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
  private initPromise: Promise<void> | null = null;
  private initGeneration = 0;
  private unsubscribeResize: (() => void) | null = null;

  get ready(): boolean {
    return this.app !== null;
  }

  get instance(): Application | null {
    return this.app;
  }

  init(container: HTMLElement): Promise<void> {
    if (this.app) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    const generation = this.initGeneration;
    const app = new Application();

    // Сначала публикуем общий Promise, затем синхронно запускаем app.init().
    // Это сохраняет немедленный вызов Pixi и исключает TDZ при sync throw.
    let resolvePending!: () => void;
    let rejectPending!: (error: unknown) => void;
    const pending = new Promise<void>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    this.initPromise = pending;

    void (async (): Promise<void> => {
      try {
        await app.init({
          preference: "webgl",
          resizeTo: container,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          // На ретинах выше 2x пиксели просто тратим: спрайты не становятся детальнее.
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });

        // destroy() мог быть вызван, пока Pixi выполнял асинхронную инициализацию.
        if (generation !== this.initGeneration) {
          app.destroy(true, { children: true, texture: false, textureSource: false });
          return;
        }

        container.appendChild(app.canvas);
        this.unsubscribeResize = setupResize(app);
        this.app = app;
        console.info("[Pixi] Initialized");
      } catch (error) {
        // Освобождаем частично созданный renderer и разрешаем безопасный retry.
        app.destroy(true, { children: true, texture: false, textureSource: false });
        throw error;
      } finally {
        if (this.initPromise === pending) this.initPromise = null;
      }
    })().then(resolvePending, rejectPending);

    return pending;
  }

  destroy(): void {
    // Инвалидируем pending init и разрешаем новому mount начать собственную инициализацию.
    // Старый renderer будет уничтожен, когда его асинхронная init завершится.
    this.initGeneration++;
    this.initPromise = null;
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
