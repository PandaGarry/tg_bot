import type { CourtCamera, CameraPoint } from "./camera.js";

interface PointerTrack extends CameraPoint {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  moved: boolean;
}

interface PinchStart {
  distance: number;
  zoom: number;
  center: CameraPoint;
}

const TAP_MAX_MS = 200;
const DRAG_THRESHOLD = 6;

/** Pointer-контроллер: tap, drag, wheel-зум и двухпальцевый pinch. */
export class CourtInput {
  private readonly pointers = new Map<number, PointerTrack>();
  private pinchStart: PinchStart | null = null;
  private readonly previousTouchAction: string;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerUpBound: (event: PointerEvent) => void;
  private readonly onPointerCancelBound: (event: PointerEvent) => void;
  private readonly onWheelBound: (event: WheelEvent) => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: CourtCamera,
    private readonly onTap: (point: CameraPoint) => void,
    private readonly onHover: (point: CameraPoint) => void,
  ) {
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";

    this.onPointerDownBound = (event) => this.onPointerDown(event);
    this.onPointerMoveBound = (event) => this.onPointerMove(event);
    this.onPointerUpBound = (event) => this.onPointerUp(event);
    this.onPointerCancelBound = (event) => this.onPointerCancel(event);
    this.onWheelBound = (event) => this.onWheel(event);

    canvas.addEventListener("pointerdown", this.onPointerDownBound);
    canvas.addEventListener("pointermove", this.onPointerMoveBound);
    canvas.addEventListener("pointerup", this.onPointerUpBound);
    canvas.addEventListener("pointercancel", this.onPointerCancelBound);
    canvas.addEventListener("wheel", this.onWheelBound, { passive: false });
  }

  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDownBound);
    this.canvas.removeEventListener("pointermove", this.onPointerMoveBound);
    this.canvas.removeEventListener("pointerup", this.onPointerUpBound);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancelBound);
    this.canvas.removeEventListener("wheel", this.onWheelBound);
    this.canvas.style.touchAction = this.previousTouchAction;
    this.pointers.clear();
    this.pinchStart = null;
  }

  private onPointerDown(event: PointerEvent): void {
    const point = this.toScreenPoint(event);
    const track: PointerTrack = {
      ...point,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      startedAt: performance.now(),
      moved: false,
    };
    this.pointers.set(event.pointerId, track);
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Некоторые webview закрывают событие до установки capture; обычный drag всё ещё работает.
    }

    if (this.pointers.size >= 2) {
      this.pinchStart = this.measurePinch();
      for (const pointer of this.pointers.values()) pointer.moved = true;
    }
  }

  private onPointerMove(event: PointerEvent): void {
    const point = this.toScreenPoint(event);
    this.onHover(point);
    const track = this.pointers.get(event.pointerId);
    if (!track) return;

    track.x = point.x;
    track.y = point.y;

    if (this.pointers.size >= 2) {
      if (!this.pinchStart) this.pinchStart = this.measurePinch();
      const next = this.measurePinch();
      if (!this.pinchStart || !next) return;
      this.camera.panBy(next.center.x - this.pinchStart.center.x, next.center.y - this.pinchStart.center.y);
      const ratio = next.distance / Math.max(1, this.pinchStart.distance);
      this.camera.zoomAt(next.center, this.pinchStart.zoom * ratio);
      this.pinchStart = { distance: next.distance, zoom: this.camera.currentZoom, center: next.center };
      return;
    }

    const dxFromStart = point.x - track.startX;
    const dyFromStart = point.y - track.startY;
    if (!track.moved && Math.hypot(dxFromStart, dyFromStart) >= DRAG_THRESHOLD) track.moved = true;
    if (track.moved) {
      this.camera.panBy(point.x - track.lastX, point.y - track.lastY);
    }
    track.lastX = point.x;
    track.lastY = point.y;
  }

  private onPointerUp(event: PointerEvent): void {
    const point = this.toScreenPoint(event);
    const track = this.pointers.get(event.pointerId);
    const wasMultiTouch = this.pointers.size > 1 || this.pinchStart !== null;
    if (track && !wasMultiTouch && !track.moved && performance.now() - track.startedAt <= TAP_MAX_MS) {
      if (Math.hypot(point.x - track.startX, point.y - track.startY) < DRAG_THRESHOLD) this.onTap(point);
    }

    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    // После pinch оставшийся палец не должен превратиться в tap.
    if (this.pointers.size === 1) this.pointers.values().next().value!.moved = true;
  }

  private onPointerCancel(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.pinchStart = null;
    for (const pointer of this.pointers.values()) pointer.moved = true;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const point = this.toScreenPoint(event);
    this.camera.zoomAt(point, this.camera.currentZoom * Math.exp(-event.deltaY * 0.0012));
  }

  private toScreenPoint(event: PointerEvent | WheelEvent): CameraPoint {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || 1;
    const height = rect.height || this.canvas.clientHeight || 1;
    return {
      x: ((event.clientX - rect.left) / width) * this.canvas.clientWidth,
      y: ((event.clientY - rect.top) / height) * this.canvas.clientHeight,
    };
  }

  private measurePinch(): PinchStart | null {
    if (this.pointers.size < 2) return null;
    const [first, second] = [...this.pointers.values()];
    if (!first || !second) return null;
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    return {
      distance: Math.hypot(first.x - second.x, first.y - second.y),
      zoom: this.camera.currentZoom,
      center,
    };
  }
}
