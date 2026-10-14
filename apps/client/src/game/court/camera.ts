import type { Container } from "pixi.js";
import { bridge } from "../bridge.js";
import { boardBounds, TILE_HEIGHT, TILE_WIDTH } from "./isometric.js";

const MIN_ZOOM = 0.85;
const MAX_ZOOM = 2.2;
const COURT_VIEW_MAX_WIDTH = 820;

export interface CameraPoint {
  x: number;
  y: number;
}

/** Панорамирование и масштаб сцены; центр доски остаётся в координатах (0, 0). */
export class CourtCamera {
  private screenWidth = 0;
  private screenHeight = 0;
  private viewportWidth = 0;
  private centerX = 0;
  private centerY = 0;
  private size = 14;
  private fitScale = 1;
  private zoom = 1;
  private interacted = false;

  constructor(private readonly root: Container) {}

  resize(screenWidth: number, screenHeight: number, size: number): void {
    if (screenWidth <= 0 || screenHeight <= 0 || size <= 0) return;
    const sizeChanged = this.size !== size;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.viewportWidth = Math.min(screenWidth, COURT_VIEW_MAX_WIDTH);
    this.centerX = screenWidth / 2;
    this.centerY = screenHeight * (screenHeight < 440 ? 0.52 : 0.55);
    this.size = size;

    const bounds = boardBounds(size);
    const availableWidth = Math.max(140, this.viewportWidth - 36);
    // Свободное место под верхний HUD, левую/правую панели, ленту и нижний док.
    const reservedHeight = screenHeight < 440 ? 108 : 238;
    const availableHeight = Math.max(130, screenHeight - reservedHeight);
    this.fitScale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height) * 0.96;

    if (!this.interacted || sizeChanged) {
      this.zoom = 1;
      this.root.position.set(this.centerX, this.centerY);
    }
    this.applyScale();
    this.clampPosition();
  }

  panBy(dx: number, dy: number): void {
    this.interacted = true;
    this.root.position.set(this.root.x + dx, this.root.y + dy);
    this.clampPosition();
    this.publish();
  }

  /** Установить приближение вокруг указателя, не сдвигая точку под ним. */
  zoomAt(point: CameraPoint, requestedZoom: number): void {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedZoom));
    if (Math.abs(nextZoom - this.zoom) < 0.001) return;

    const localX = (point.x - this.root.x) / this.root.scale.x;
    const localY = (point.y - this.root.y) / this.root.scale.y;
    this.zoom = nextZoom;
    this.applyScale();
    this.root.position.set(point.x - localX * this.root.scale.x, point.y - localY * this.root.scale.y);
    this.interacted = true;
    this.clampPosition();
    this.publish();
  }

  /** Камерный экранный пиксель → локальная координата изометрической доски. */
  toLocal(point: CameraPoint): CameraPoint {
    return {
      x: (point.x - this.root.x) / this.root.scale.x,
      y: (point.y - this.root.y) / this.root.scale.y,
    };
  }

  get currentZoom(): number {
    return this.zoom;
  }

  private applyScale(): void {
    const scale = this.fitScale * this.zoom;
    this.root.scale.set(scale);
  }

  private clampPosition(): void {
    if (this.screenWidth <= 0 || this.screenHeight <= 0) return;
    const scale = this.root.scale.x;
    const halfWidth = (this.size * TILE_WIDTH * scale) / 2;
    const halfHeight = (this.size * TILE_HEIGHT * scale) / 2;
    const left = (this.screenWidth - this.viewportWidth) / 2;
    const right = left + this.viewportWidth;
    const margin = 18;

    if (halfWidth * 2 <= this.viewportWidth - margin * 2) {
      this.root.x = this.centerX;
    } else {
      this.root.x = clamp(this.root.x, right - margin - halfWidth, left + margin + halfWidth);
    }

    if (halfHeight * 2 <= this.screenHeight - margin * 2) {
      // Чуть смещаем доску вниз, чтобы не спорила с карточкой лорда.
      this.root.y = this.centerY;
    } else {
      this.root.y = clamp(this.root.y, this.screenHeight - margin - halfHeight, margin + halfHeight);
    }
  }

  private publish(): void {
    bridge.emit("camera:moved", { x: this.root.x, y: this.root.y, zoom: this.zoom });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
