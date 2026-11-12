/**
 * Игровая камера двора: панорамирование, зум колесом/щипком, ограниченный
 * свободный поворот (ПКМ или Shift) и экспоненциальное демпфирование.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export function CourtCamera() {
  const { camera, gl } = useThree();
  const want = useRef({
    target: new THREE.Vector3(0, 0, 0),
    az: Math.PI / 4,
    pol: 0.98,
    dist: 24,
  });
  const cur = useRef({
    target: new THREE.Vector3(0, 0, 0),
    az: Math.PI / 4,
    pol: 0.98,
    dist: 24,
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    // без этого Safari порывается скроллить/зумить страницу вместо сцены —
    // отсюда были обрывы и pointercancel при панораме (круг 11)
    el.style.touchAction = "none";
    const s = want.current;
    const down = (e: PointerEvent) => {
      if (pointers.current.size >= 2) return; // третий палец не участвует
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch.current = 0;
    };
    const pan = (dx: number, dy: number) => {
      // пан: чувствительность подобрана под палец (круг 9)
      const k = s.dist * 0.0022; // круг 12: пан медленнее и комфортнее
      const fwd = new THREE.Vector3(-Math.sin(s.az), 0, -Math.cos(s.az));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      s.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
      s.target.x = THREE.MathUtils.clamp(s.target.x, -6, 6);
      s.target.z = THREE.MathUtils.clamp(s.target.z, -6, 6);
    };
    const orbit = (dx: number, dy: number) => {
      // свободный поворот с ограничениями (решение круга 8)
      s.az = THREE.MathUtils.clamp(s.az + dx * 0.005, Math.PI / 4 - 0.9, Math.PI / 4 + 0.9);
      s.pol = THREE.MathUtils.clamp(s.pol + dy * 0.004, 0.78, 1.25);
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      // все коалесцированные сэмплы кадра: без «ступенек» на 120 Гц-экранах
      const batch = e.getCoalescedEvents?.() ?? [];
      const samples = batch.length ? batch : [e as PointerEvent];
      for (const ev of samples) {
        const dx = ev.clientX - prev.x;
        const dy = ev.clientY - prev.y;
        prev.x = ev.clientX;
        prev.y = ev.clientY;
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          if (a && b) {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch.current > 0 && d > 0) s.dist = THREE.MathUtils.clamp(s.dist * (pinch.current / d), 7, 45);
            pinch.current = d;
          }
        } else if (ev.buttons & 2 || ev.shiftKey) {
          orbit(dx, dy);
        } else {
          pan(dx, dy);
        }
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      pinch.current = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      want.current.dist = THREE.MathUtils.clamp(want.current.dist * (1 + e.deltaY * 0.0012), 7, 45);
    };
    const ctx = (e: Event) => e.preventDefault();
    // iOS Safari норовит обработать щипок как зум страницы — гасим системные жесты
    const gesture = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", ctx);
    el.addEventListener("gesturestart", gesture);
    el.addEventListener("gesturechange", gesture);
    el.addEventListener("gestureend", gesture);
    el.addEventListener("dblclick", ctx);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", ctx);
      el.removeEventListener("gesturestart", gesture);
      el.removeEventListener("gesturechange", gesture);
      el.removeEventListener("gestureend", gesture);
      el.removeEventListener("dblclick", ctx);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const w = want.current, c = cur.current;
    // экспоненциальное демпфирование: плавно при любом fps
    const k = 1 - Math.exp(-14 * Math.min(dt, 0.05));
    c.target.lerp(w.target, k);
    c.az += (w.az - c.az) * k;
    c.pol += (w.pol - c.pol) * k;
    c.dist += (w.dist - c.dist) * k;
    const sp = Math.sin(c.pol), cp = Math.cos(c.pol);
    camera.position.set(
      c.target.x + c.dist * sp * Math.sin(c.az),
      c.target.y + c.dist * cp,
      c.target.z + c.dist * sp * Math.cos(c.az),
    );
    camera.lookAt(c.target);
  });
  return null;
}
