/**
 * Контроллер указателя для сетки двора:
 * - только первичный (левый / touch / pen, button === 0) одиночный указатель запускает таймер 550 мс;
 * - правая или средняя кнопка мыши, а также удержание/перетаскивание правой кнопкой
 *   никогда не запускают перенос и не срабатывают как тап;
 * - перемещение > 8px, второй палец (мультитач/щипок), pointercancel, pointerleave,
 *   потеря фокуса или размонтирование сбрасывают таймер без утечек.
 */

import type { CourtGridCell } from "./gridMath.js";

export const HOLD_PICKUP_MS = 550;
export const DRAG_THRESHOLD_PX = 8;

export interface CourtPointerDownEvent {
  pointerId: number;
  button: number;
  buttons?: number;
  pointerType?: string;
  clientX: number;
  clientY: number;
  cell: CourtGridCell;
}

export interface CourtPointerMoveEvent {
  pointerId: number;
  buttons?: number;
  clientX: number;
  clientY: number;
}

export interface CourtPointerUpEvent {
  pointerId: number;
  button: number;
  clientX: number;
  clientY: number;
  cell: CourtGridCell;
}

export interface CourtInputCallbacks {
  /** Возвращает true, если долгое нажатие действительно подняло объект для переноса. */
  onHold: (cell: CourtGridCell) => boolean;
  onTap: (cell: CourtGridCell) => void;
  holdMs?: number;
  moveThresholdPx?: number;
}

export interface CourtInputController {
  onPointerDown(ev: CourtPointerDownEvent): void;
  onPointerMove(ev: CourtPointerMoveEvent): void;
  onPointerUp(ev: CourtPointerUpEvent): void;
  onPointerCancel(pointerId?: number): void;
  onPointerLeave(pointerId?: number): void;
  onGlobalPointerDown(pointerId: number): void;
  onGlobalPointerEnd(pointerId: number): void;
  cancelAll(): void;
  dispose(): void;
  hasPendingTimer(): boolean;
}

export function createCourtInputController(callbacks: CourtInputCallbacks): CourtInputController {
  const holdMs = callbacks.holdMs ?? HOLD_PICKUP_MS;
  const threshold = callbacks.moveThresholdPx ?? DRAG_THRESHOLD_PX;

  const activePointers = new Set<number>();
  let down: { pointerId: number; x: number; y: number; cell: CourtGridCell } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let held = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const resetPress = () => {
    clearTimer();
    down = null;
    held = false;
  };

  return {
    onPointerDown(ev) {
      // Только левая кнопка мыши или основной контакт touch/pen (button === 0).
      if (ev.button !== 0 || (ev.buttons !== undefined && (ev.buttons & 2) !== 0)) {
        resetPress();
        return;
      }
      activePointers.add(ev.pointerId);
      // Мультитач (например, щипок) сразу гасит долгое нажатие.
      if (activePointers.size > 1) {
        resetPress();
        return;
      }
      clearTimer();
      held = false;
      down = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, cell: ev.cell };
      timer = setTimeout(() => {
        timer = null;
        const current = down;
        down = null;
        if (!current || activePointers.size > 1) return;
        if (callbacks.onHold(current.cell)) {
          held = true;
        }
      }, holdMs);
    },

    onPointerMove(ev) {
      const current = down;
      if (!current || current.pointerId !== ev.pointerId) return;
      if (ev.buttons !== undefined && (ev.buttons & 2) !== 0) {
        resetPress();
        return;
      }
      if (Math.hypot(ev.clientX - current.x, ev.clientY - current.y) > threshold) {
        clearTimer();
      }
    },

    onPointerUp(ev) {
      // Непервичная кнопка (например, отпускание правой кнопки после орбиты) не тапает и не чистит левый pointerId.
      if (ev.button !== 0) {
        return;
      }
      activePointers.delete(ev.pointerId);
      clearTimer();
      const current = down;
      down = null;
      if (!current || current.pointerId !== ev.pointerId || held) {
        held = false;
        return;
      }
      if (Math.hypot(ev.clientX - current.x, ev.clientY - current.y) > threshold) return;
      callbacks.onTap(current.cell);
    },

    onPointerCancel(pointerId) {
      if (pointerId !== undefined) activePointers.delete(pointerId);
      else activePointers.clear();
      resetPress();
    },

    onPointerLeave(pointerId) {
      if (pointerId === undefined || (down && down.pointerId === pointerId)) {
        resetPress();
      }
    },

    onGlobalPointerDown(pointerId) {
      activePointers.add(pointerId);
      if (activePointers.size > 1) {
        resetPress();
      }
    },

    onGlobalPointerEnd(pointerId) {
      activePointers.delete(pointerId);
      if (down && down.pointerId === pointerId) {
        resetPress();
      }
    },

    cancelAll() {
      activePointers.clear();
      resetPress();
    },

    dispose() {
      activePointers.clear();
      resetPress();
    },

    hasPendingTimer() {
      return timer !== null;
    },
  };
}
