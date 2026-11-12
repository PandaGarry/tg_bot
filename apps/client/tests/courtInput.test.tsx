/**
 * Регрессионные тесты контроллера указателя двора:
 * - правая кнопка (удержание >= 550 мс и перетаскивание) никогда не запускает перенос и тап;
 * - левое долгое нажатие и touch-долгое нажатие сохраняют перенос (550 мс);
 * - перетаскивание > 8px, мультитач, pointercancel, pointerleave и dispose/unmount отменяют таймер.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCourtInputController, DRAG_THRESHOLD_PX, HOLD_PICKUP_MS } from "../src/court/scene/courtInput.js";

describe("courtInput pointer controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("левое удержание 550 мс запускает перенос (onHold), отпускание после него не тапает", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({
      pointerId: 1,
      button: 0,
      buttons: 1,
      pointerType: "mouse",
      clientX: 300,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });

    vi.advanceTimersByTime(HOLD_PICKUP_MS - 1);
    expect(onHold).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledWith({ x: 7, z: 7 });

    ctrl.onPointerUp({
      pointerId: 1,
      button: 0,
      clientX: 300,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("стационарное удержание правой кнопки мыши (700+ мс) НИКОГДА не запускает перенос и тап", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({
      pointerId: 1,
      button: 2,
      buttons: 2,
      pointerType: "mouse",
      clientX: 300,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });

    expect(ctrl.hasPendingTimer()).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(onHold).not.toHaveBeenCalled();

    ctrl.onPointerUp({
      pointerId: 1,
      button: 2,
      clientX: 300,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("перетаскивание правой кнопкой (орбита) и средняя кнопка не запускают перенос или тап", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({
      pointerId: 1,
      button: 2,
      buttons: 2,
      pointerType: "mouse",
      clientX: 400,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });
    ctrl.onPointerMove({ pointerId: 1, buttons: 2, clientX: 480, clientY: 280 });
    vi.advanceTimersByTime(1000);
    ctrl.onPointerUp({ pointerId: 1, button: 2, clientX: 480, clientY: 280, cell: { x: 8, z: 7 } });

    ctrl.onPointerDown({
      pointerId: 1,
      button: 1,
      buttons: 4,
      pointerType: "mouse",
      clientX: 400,
      clientY: 300,
      cell: { x: 7, z: 7 },
    });
    vi.advanceTimersByTime(1000);
    ctrl.onPointerUp({ pointerId: 1, button: 1, clientX: 400, clientY: 300, cell: { x: 7, z: 7 } });

    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("быстрый левый клик и touch-долгое нажатие сохраняют прежнее поведение", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    // Быстрый клик
    ctrl.onPointerDown({
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
      cell: { x: 3, z: 4 },
    });
    vi.advanceTimersByTime(120);
    ctrl.onPointerUp({
      pointerId: 1,
      button: 0,
      clientX: 103,
      clientY: 102,
      cell: { x: 3, z: 4 },
    });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 3, z: 4 });
    expect(onHold).not.toHaveBeenCalled();

    // Touch-удержание
    ctrl.onPointerDown({
      pointerId: 10,
      button: 0,
      pointerType: "touch",
      clientX: 200,
      clientY: 250,
      cell: { x: 7, z: 7 },
    });
    vi.advanceTimersByTime(HOLD_PICKUP_MS);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledWith({ x: 7, z: 7 });
  });

  it("сдвиг > 8px отменяет таймер переноса и не вызывает тап", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
      cell: { x: 5, z: 5 },
    });
    ctrl.onPointerMove({
      pointerId: 1,
      buttons: 1,
      clientX: 100 + DRAG_THRESHOLD_PX + 1,
      clientY: 100,
    });
    expect(ctrl.hasPendingTimer()).toBe(false);
    vi.advanceTimersByTime(1000);
    ctrl.onPointerUp({
      pointerId: 1,
      button: 0,
      clientX: 100 + DRAG_THRESHOLD_PX + 1,
      clientY: 100,
      cell: { x: 5, z: 5 },
    });

    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("второй палец (мультитач), pointercancel, pointerleave, правый аккорд и dispose снимают таймер", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    // 1) Мультитач (щипок: второй палец за пределами или внутри сетки)
    ctrl.onPointerDown({ pointerId: 1, button: 0, pointerType: "touch", clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });
    expect(ctrl.hasPendingTimer()).toBe(true);
    ctrl.onGlobalPointerDown(2);
    expect(ctrl.hasPendingTimer()).toBe(false);
    vi.advanceTimersByTime(1000);
    ctrl.onGlobalPointerEnd(1);
    ctrl.onGlobalPointerEnd(2);

    // 2) pointercancel
    ctrl.onPointerDown({ pointerId: 3, button: 0, pointerType: "touch", clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });
    ctrl.onPointerCancel(3);
    expect(ctrl.hasPendingTimer()).toBe(false);

    // 3) pointerleave + отпускание за пределами сетки (window pointerup)
    ctrl.onPointerDown({ pointerId: 4, button: 0, pointerType: "mouse", clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });
    ctrl.onPointerLeave(4);
    expect(ctrl.hasPendingTimer()).toBe(false);
    ctrl.onGlobalPointerEnd(4);

    // 4) Зажали левую, затем добавили правую кнопку мыши
    ctrl.onPointerDown({ pointerId: 5, button: 0, buttons: 1, pointerType: "mouse", clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });
    ctrl.onPointerMove({ pointerId: 5, buttons: 3, clientX: 100, clientY: 100 });
    expect(ctrl.hasPendingTimer()).toBe(false);
    ctrl.onPointerUp({ pointerId: 5, button: 0, clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });

    // 5) Размонтирование (dispose) до истечения 550 мс
    ctrl.onPointerDown({ pointerId: 6, button: 0, pointerType: "mouse", clientX: 100, clientY: 100, cell: { x: 7, z: 7 } });
    expect(ctrl.hasPendingTimer()).toBe(true);
    ctrl.dispose();
    expect(ctrl.hasPendingTimer()).toBe(false);
    vi.advanceTimersByTime(1000);

    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("потеря фокуса (cancelAll) и повторная инициализация после leave не блокируют следующий клик", () => {
    const onHold = vi.fn(() => true);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({ pointerId: 1, button: 0, pointerType: "mouse", clientX: 100, clientY: 100, cell: { x: 2, z: 2 } });
    ctrl.cancelAll();
    expect(ctrl.hasPendingTimer()).toBe(false);

    ctrl.onPointerDown({ pointerId: 1, button: 0, pointerType: "mouse", clientX: 100, clientY: 100, cell: { x: 2, z: 2 } });
    vi.advanceTimersByTime(100);
    ctrl.onPointerUp({ pointerId: 1, button: 0, clientX: 100, clientY: 100, cell: { x: 2, z: 2 } });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 2, z: 2 });
  });

  it("удержание на пустой клетке (onHold -> false) не запускает тап при отпускании", () => {
    const onHold = vi.fn(() => false);
    const onTap = vi.fn();
    const ctrl = createCourtInputController({ onHold, onTap });

    ctrl.onPointerDown({ pointerId: 1, button: 0, clientX: 100, clientY: 100, cell: { x: 1, z: 1 } });
    vi.advanceTimersByTime(HOLD_PICKUP_MS);
    expect(onHold).toHaveBeenCalledTimes(1);
    ctrl.onPointerUp({ pointerId: 1, button: 0, clientX: 100, clientY: 100, cell: { x: 1, z: 1 } });
    expect(onTap).not.toHaveBeenCalled();
  });
});
