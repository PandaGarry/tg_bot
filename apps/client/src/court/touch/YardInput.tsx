/**
 * Ввод двора одним контроллером: камера (панорама, щипок, поворот двумя пальцами), выбор здания,
 * перенос перетаскиванием и призрак постройки. Всё на DOM-событиях холста и лучах сцены:
 * здания находятся по телам-коробкам, а не по невидимой плоскости земли.
 *
 * Жесты одним пальцем:
 *  - постройка под пальцем: тап — выбрать, удержание {@link TOUCH.longPressMs} мс — поднять и тащить;
 *  - призрак (новая или поднятая постройка): тащить за призрак (с запасом вокруг него), тап — перенести призрак;
 *  - режим постройки без призрака: призрак следует за пальцем, отпускание ставит его;
 *  - пустое место: панорама после порога {@link TOUCH.slop} px, тап снимает выбор.
 * Двумя пальцами: щипок — зум, сдвиг — панорама, поворот — вращение камеры.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import {
  centerOfBuilding,
  footprintKeys,
  gridToWorld,
  sizeFor,
  worldToCell,
  type CourtGridLite,
  type CourtPending,
  type CourtSelection,
  type CourtTool,
} from "../grid.js";
import { CELL } from "../skin/kit.js";
import {
  TOUCH,
  bodyHeight,
  edgeScroll,
  fits,
  liftFor,
  pickBuilding,
  rectContains,
  rectOf,
  slopFor,
  twistDelta,
  type PickBody,
} from "./gesture.js";
import { haptic } from "./haptics.js";

/** Желаемое состояние камеры: жесты меняют его, `CameraRig` догоняет с демпфированием. */
export interface CamState {
  target: THREE.Vector3;
  az: number;
  pol: number;
  dist: number;
}

const AZ0 = Math.PI / 4;
export const CAM_LIMITS = { az: 1.2, polMin: 0.78, polMax: 1.25, distMin: 7, distMax: 45, pan: 6 } as const;

interface Props {
  grid: CourtGridLite;
  tool: CourtTool;
  pending: CourtPending | null;
  selected: CourtSelection | null;
  thLevel: number;
  camera: MutableRefObject<CamState>;
  onTarget: (x: number, z: number) => void;
  onValid: (ok: boolean) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number, rot: number) => void;
  onSelect: (sel: CourtSelection | null) => void;
  /** Модель постройки для призрака в руках (скин рисует, ввод только показывает). */
  renderModel: (type: string) => ReactNode;
  /** Подъём оказался тапом (поток событий задержался): вернуть здание на место. */
  onCancelPickup: () => void;
}

type Mode = "idle" | "press" | "pan" | "ghost" | "two";
interface Pt {
  x: number;
  y: number;
  type: string;
}

const clamp = THREE.MathUtils.clamp;

export function YardInput(props: Props) {
  const { camera, gl } = useThree();
  const P = useRef(props);
  P.current = props;
  const { grid, tool, pending, selected, thLevel } = props;

  const [hot, setHot] = useState<CourtSelection | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; z: number } | null>(null);

  const S = useRef({
    pts: new Map<number, Pt>(),
    mode: "idle" as Mode,
    id: -1,
    sx: 0,
    sy: 0,
    px: 0,
    py: 0,
    cx: 0,
    cy: 0,
    moved: false,
    orbit: false,
    timer: null as ReturnType<typeof setTimeout> | null,
    hit: null as CourtSelection | null,
    /** Время нажатия по часам событий и по часам страницы; поднято ли здание таймером. */
    downStamp: 0,
    downAt: 0,
    byTimer: false,
    rearmed: false,
    delta: { x: 0, z: 0 },
    last: null as { x: number; z: number } | null,
    two: null as [{ x: number; y: number }, { x: number; y: number }] | null,
    /** Пересчитать призрак под текущим пальцем (когда вид едет сам). */
    refresh: null as (() => void) | null,
  });

  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2), []);
  const caster = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const roads = useMemo(() => new Set(grid.roads.map((r) => `${r.x}:${r.z}`)), [grid]);
  const busy = useMemo(() => footprintKeys(grid, pending?.from), [grid, pending?.from]);
  const bodies = useMemo<PickBody[]>(() => {
    const stage = clamp(Math.ceil(thLevel / 5), 1, 5);
    return grid.buildings.map((b) => ({
      type: b.type,
      x: b.x,
      z: b.z,
      rot: b.rot ?? 0,
      height: bodyHeight(b.type, stage),
    }));
  }, [grid, thLevel]);

  const view = useRef({ roads, busy, bodies });
  view.current = { roads, busy, bodies };

  // допустимо ли положение постройки в руках: красный призрак не даёт подтвердить
  const pendingOk = useMemo(() => {
    if (!pending) return true;
    return fits(rectOf(pending.x, pending.z, sizeFor(pending.type, pending.rot)), grid.size, busy, roads);
  }, [pending, grid.size, busy, roads]);
  useEffect(() => {
    P.current.onValid(pendingOk);
  }, [pendingOk]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const s = S.current;

    const rayAt = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      caster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1)), camera);
      return caster.ray;
    };
    /** Клетка под точкой экрана (с подъёмом вверх на `lift` px) или null, если луч не достаёт земли. */
    const cellAt = (x: number, y: number, lift = 0) => {
      const hit = rayAt(x, y - lift).intersectPlane(ground, tmp);
      if (!hit) return null;
      const size = P.current.grid.size;
      const c = worldToCell(hit.x, hit.z, size);
      return { x: clamp(c.x, 0, size - 1), z: clamp(c.z, 0, size - 1) };
    };
    const clearTimer = () => {
      if (s.timer !== null) {
        clearTimeout(s.timer);
        s.timer = null;
      }
    };

    const cam = () => P.current.camera.current;
    const pan = (dx: number, dy: number) => {
      const c = cam();
      const k = c.dist * 0.0022;
      const fwd = new THREE.Vector3(-Math.sin(c.az), 0, -Math.cos(c.az));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      c.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
      c.target.x = clamp(c.target.x, -CAM_LIMITS.pan, CAM_LIMITS.pan);
      c.target.z = clamp(c.target.z, -CAM_LIMITS.pan, CAM_LIMITS.pan);
    };
    const orbit = (dx: number, dy: number) => {
      const c = cam();
      c.az = clamp(c.az + dx * 0.005, AZ0 - CAM_LIMITS.az, AZ0 + CAM_LIMITS.az);
      c.pol = clamp(c.pol + dy * 0.004, CAM_LIMITS.polMin, CAM_LIMITS.polMax);
    };

    /** Призрак следует за пальцем: клетка под пальцем (выше него) плюс захваченное смещение. */
    const updateGhost = (x: number, y: number) => {
      const type = s.pts.get(s.id)?.type ?? "mouse";
      const lc = cellAt(x, y, liftFor(type));
      if (!lc) return;
      const size = P.current.grid.size;
      const nx = clamp(lc.x + s.delta.x, 0, size - 1);
      const nz = clamp(lc.z + s.delta.z, 0, size - 1);
      if (s.last && s.last.x === nx && s.last.z === nz) return;
      s.last = { x: nx, z: nz };
      if (P.current.pending) P.current.onTarget(nx, nz);
      else setDragGhost({ x: nx, z: nz });
    };

    s.refresh = () => {
      const pt = s.pts.get(s.id);
      if (pt) updateGhost(pt.x, pt.y);
    };

    const pickAt = (x: number, y: number): CourtSelection | null => {
      const b = pickBuilding(
        rayAt(x, y),
        view.current.bodies,
        (body) => centerOfBuilding(body, P.current.grid.size),
        sizeFor,
        CELL,
      );
      return b ? { type: b.type, x: b.x, z: b.z, rot: b.rot } : null;
    };

    const startTwo = () => {
      clearTimer();
      setHot(null);
      setDragGhost(null);
      s.mode = "two";
      const [a, b] = [...s.pts.values()];
      s.two = a && b ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : null;
    };

    const pickup = () => {
      s.timer = null;
      const h = s.hit;
      if (s.mode !== "press" || !h) return;
      // страница могла «зависнуть» на тяжёлом кадре: событие отпускания уже ждёт в очереди, а таймер сработал первым.
      // Даём очереди один ход, прежде чем поднимать здание
      if (!s.rearmed && performance.now() - s.downAt > TOUCH.longPressMs + 40) {
        s.rearmed = true;
        s.timer = setTimeout(pickup, 90);
        return;
      }
      s.byTimer = true;
      haptic("pickup");
      setHot(null);
      const type = s.pts.get(s.id)?.type ?? "mouse";
      P.current.onPickup(h.type, h.x, h.z, h.rot);
      s.mode = "ghost";
      s.last = { x: h.x, z: h.z };
      const lc = cellAt(s.cx, s.cy, liftFor(type));
      s.delta = lc ? { x: h.x - lc.x, z: h.z - lc.z } : { x: 0, z: 0 };
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 1) return;
      if (s.pts.size >= 2) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* указатель мог уже исчезнуть */
      }
      s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (s.pts.size === 2) {
        startTwo();
        return;
      }
      s.id = e.pointerId;
      s.sx = s.px = s.cx = e.clientX;
      s.sy = s.py = s.cy = e.clientY;
      s.moved = false;
      s.hit = null;
      s.last = null;
      s.delta = { x: 0, z: 0 };
      s.orbit = e.pointerType === "mouse" && (e.button === 2 || e.shiftKey);
      s.downStamp = e.timeStamp;
      s.downAt = performance.now();
      s.byTimer = false;
      s.rearmed = false;
      clearTimer();
      const p = P.current;
      if (s.orbit) {
        s.mode = "pan";
        return;
      }
      if (p.pending) {
        const fingerCell = cellAt(e.clientX, e.clientY);
        const r = rectOf(p.pending.x, p.pending.z, sizeFor(p.pending.type, p.pending.rot));
        if (fingerCell && rectContains(r, fingerCell.x, fingerCell.z, TOUCH.halo)) {
          // взяли призрак: он не прыгает, а едет с пальцем от текущего места
          s.mode = "ghost";
          s.last = { x: p.pending.x, z: p.pending.z };
          const lc = cellAt(e.clientX, e.clientY, liftFor(e.pointerType));
          s.delta = lc ? { x: p.pending.x - lc.x, z: p.pending.z - lc.z } : { x: 0, z: 0 };
          haptic("select");
        } else {
          s.mode = "pan";
        }
        return;
      }
      if (p.tool?.kind === "place") {
        s.mode = "ghost";
        updateGhost(e.clientX, e.clientY);
        return;
      }
      if (p.tool?.kind === "road") {
        s.mode = "pan";
        return;
      }
      const body = pickAt(e.clientX, e.clientY);
      if (body) {
        s.mode = "press";
        s.hit = body;
        setHot(body);
        s.timer = setTimeout(pickup, TOUCH.longPressMs);
        return;
      }
      const cell = cellAt(e.clientX, e.clientY);
      if (cell && view.current.roads.has(`${cell.x}:${cell.z}`)) {
        s.mode = "press";
        s.hit = { type: "road", x: cell.x, z: cell.z, rot: 0 };
        s.timer = setTimeout(pickup, TOUCH.longPressMs);
        return;
      }
      s.mode = "pan";
    };

    const two = () => {
      const pair = [...s.pts.values()];
      const [a, b] = pair;
      const prev = s.two;
      if (!a || !b || !prev) return;
      const d0 = Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y);
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      const c = cam();
      if (d0 > 0 && d1 > 0) c.dist = clamp(c.dist * (d0 / d1), CAM_LIMITS.distMin, CAM_LIMITS.distMax);
      pan((a.x + b.x) / 2 - (prev[0].x + prev[1].x) / 2, (a.y + b.y) / 2 - (prev[0].y + prev[1].y) / 2);
      const tw = twistDelta(prev[0], prev[1], a, b);
      c.az = clamp(c.az + tw, AZ0 - CAM_LIMITS.az, AZ0 + CAM_LIMITS.az);
      s.two = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    };

    const move = (e: PointerEvent) => {
      const pt = s.pts.get(e.pointerId);
      if (!pt) {
        // мышь без нажатия: призрак следует за курсором в режиме постройки
        if (e.pointerType === "mouse" && P.current.tool?.kind === "place" && !P.current.pending) {
          const c = cellAt(e.clientX, e.clientY);
          if (c) setDragGhost(c);
        }
        return;
      }
      const batch = e.getCoalescedEvents?.() ?? [];
      const samples = batch.length ? batch : [e];
      for (const ev of samples) {
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        if (s.mode === "two") {
          two();
          continue;
        }
        if (e.pointerId !== s.id) continue;
        s.cx = ev.clientX;
        s.cy = ev.clientY;
        const far = Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) > slopFor(pt.type);
        if (s.mode === "press") {
          if (far) {
            clearTimer();
            setHot(null);
            s.mode = "pan";
            s.moved = true;
            s.px = ev.clientX;
            s.py = ev.clientY;
          }
        } else if (s.mode === "pan") {
          if (!s.moved && far) {
            s.moved = true;
            s.px = ev.clientX;
            s.py = ev.clientY;
          } else if (s.moved) {
            const dx = ev.clientX - s.px;
            const dy = ev.clientY - s.py;
            s.px = ev.clientX;
            s.py = ev.clientY;
            if (s.orbit) orbit(dx, dy);
            else pan(dx, dy);
          }
        } else if (s.mode === "ghost") {
          if (far) s.moved = true;
          updateGhost(ev.clientX, ev.clientY);
        }
      }
    };

    const finish = (e: PointerEvent) => {
      if (!s.pts.has(e.pointerId)) return;
      const cancelled = e.type === "pointercancel";
      const pt = s.pts.get(e.pointerId)!;
      s.pts.delete(e.pointerId);
      if (s.mode === "two") {
        const rest = [...s.pts.entries()][0];
        if (rest) {
          // оставшийся палец продолжает панораму, но не считается тапом
          s.mode = "pan";
          s.id = rest[0];
          s.moved = true;
          s.px = rest[1].x;
          s.py = rest[1].y;
        } else {
          s.mode = "idle";
        }
        return;
      }
      if (e.pointerId !== s.id) return;
      clearTimer();
      const p = P.current;
      if (s.mode === "press") {
        setHot(null);
        if (!cancelled && s.hit && s.hit.type !== "road") {
          p.onSelect(s.hit);
          haptic("select");
        }
      } else if (s.mode === "pan") {
        if (!cancelled && !s.moved && !s.orbit) {
          const cell = cellAt(e.clientX, e.clientY);
          if (cell) {
            if (p.pending) p.onTarget(cell.x, cell.z);
            else if (p.tool?.kind === "road") p.onRoad(cell.x, cell.z, view.current.roads.has(`${cell.x}:${cell.z}`));
            else if (p.selected) p.onSelect(null);
          }
        }
      } else if (s.mode === "ghost" && s.byTimer && !cancelled && e.timeStamp - s.downStamp < TOUCH.longPressMs - 30) {
        // физически это был короткий тап: подъём случился из-за задержки потока событий — отменяем его
        setDragGhost(null);
        p.onCancelPickup();
        if (s.hit && s.hit.type !== "road") p.onSelect(s.hit);
      } else if (s.mode === "ghost") {
        if (!cancelled && !p.pending && p.tool?.kind === "place") {
          const c = s.last ?? cellAt(e.clientX, e.clientY, liftFor(pt.type));
          if (c) p.onTarget(c.x, c.z);
        }
        setDragGhost(null);
        if (!cancelled) haptic("drop");
      }
      s.mode = "idle";
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = cam();
      c.dist = clamp(c.dist * (1 + e.deltaY * 0.0012), CAM_LIMITS.distMin, CAM_LIMITS.distMax);
    };
    const stop = (e: Event) => e.preventDefault();
    const leave = () => {
      if (!s.pts.size) setDragGhost(null);
    };

    // только dev: автотест касанием (tools/shots/touch.ts) переводит клетки в пиксели и читает состояние
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__yardProject = (gx: number, gz: number, y = 0) => {
        const r = el.getBoundingClientRect();
        const v = new THREE.Vector3(gridToWorld(gx, P.current.grid.size), y, gridToWorld(gz, P.current.grid.size)).project(camera);
        return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
      };
      w.__yardState = () => ({ pending: P.current.pending, selected: P.current.selected, az: P.current.camera.current.az });
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", stop);
    el.addEventListener("gesturestart", stop);
    el.addEventListener("gesturechange", stop);
    el.addEventListener("gestureend", stop);
    el.addEventListener("dblclick", stop);
    return () => {
      clearTimer();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", stop);
      el.removeEventListener("gesturestart", stop);
      el.removeEventListener("gesturechange", stop);
      el.removeEventListener("gestureend", stop);
      el.removeEventListener("dblclick", stop);
    };
  }, [gl, camera, caster, ground, tmp]);

  // автопрокрутка у края экрана и пересчёт клетки под пальцем, пока вид едет
  useFrame((_, dt) => {
    const s = S.current;
    if (s.mode !== "ghost") return;
    const pt = s.pts.get(s.id);
    if (!pt) return;
    const r = gl.domElement.getBoundingClientRect();
    const es = edgeScroll(pt.x - r.left, pt.y - r.top, r.width, r.height);
    if (!es.x && !es.y) return;
    const c = P.current.camera.current;
    const k = c.dist * 0.0022 * 520 * Math.min(dt, 0.05);
    const fwd = new THREE.Vector3(-Math.sin(c.az), 0, -Math.cos(c.az));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    c.target.addScaledVector(right, es.x * k).addScaledVector(fwd, -es.y * k);
    c.target.x = clamp(c.target.x, -CAM_LIMITS.pan, CAM_LIMITS.pan);
    c.target.z = clamp(c.target.z, -CAM_LIMITS.pan, CAM_LIMITS.pan);
    // клетка под пальцем меняется вместе с видом
    s.refresh?.();
  });

  const place = tool?.kind === "place" ? tool.type : null;
  const ghost = pending
    ? { type: pending.type, x: pending.x, z: pending.z, rot: pending.rot, valid: pendingOk }
    : dragGhost && place
      ? {
          type: place,
          x: dragGhost.x,
          z: dragGhost.z,
          rot: 0,
          valid: fits(rectOf(dragGhost.x, dragGhost.z, sizeFor(place, 0)), grid.size, busy, roads),
        }
      : null;

  return (
    <group>
      {tool || pending ? <GridOverlay size={grid.size} /> : null}
      {ghost ? <Ghost {...ghost} gridSize={grid.size} model={props.renderModel(ghost.type)} /> : null}
      {!pending && selected ? <Highlight b={selected} gridSize={grid.size} color="#f2d27a" strong /> : null}
      {!pending && hot ? <Highlight b={hot} gridSize={grid.size} color="#fff0c0" /> : null}
    </group>
  );
}

/** Подсветка здания: выбранное — тёплая плашка с мягким пульсом, нажатое — бледная. */
function Highlight({ b, gridSize, color, strong }: { b: CourtSelection; gridSize: number; color: string; strong?: boolean }) {
  const [w, h] = sizeFor(b.type, b.rot);
  const { wx, wz } = centerOfBuilding(b, gridSize);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = (strong ? 0.3 : 0.2) + (strong ? 0.1 * Math.sin(clock.elapsedTime * 3.2) : 0);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[wx, 0.19, wz]} renderOrder={4}>
      <planeGeometry args={[w * CELL + 0.12, h * CELL + 0.12]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

/**
 * Постройка в руках: настоящая модель на цветной плашке (зелёная — можно, красная — нельзя).
 * Поворот виден сразу: модель плавно доворачивается к новому положению.
 */
function Ghost({
  type,
  x,
  z,
  rot,
  valid,
  gridSize,
  model,
}: {
  type: string;
  x: number;
  z: number;
  rot: number;
  valid: boolean;
  gridSize: number;
  model: ReactNode;
}) {
  const [rw, rh] = sizeFor(type, rot);
  const hw = Math.floor(rw / 2);
  const hh = Math.floor(rh / 2);
  const wx = gridToWorld(x - hw + (rw - 1) / 2, gridSize);
  const wz = gridToWorld(z - hh + (rh - 1) / 2, gridSize);
  const color = valid ? "#7fae5a" : "#c25438";
  const spin = useRef<THREE.Group>(null);
  const angle = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = spin.current;
    if (!g) return;
    const target = (-rot * Math.PI) / 2;
    if (angle.current === null) angle.current = target;
    // кратчайший путь к целевому углу
    const d = ((((target - angle.current + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    angle.current += d * (1 - Math.exp(-20 * Math.min(dt, 0.05)));
    g.rotation.y = angle.current;
  });
  return (
    <group position={[wx, 0.2, wz]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[rw * CELL - 0.08, rh * CELL - 0.08]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* модель нарисована входом на восток; на землю она встаёт так же, как постройки двора (y = 0.08) */}
      <group ref={spin} position-y={-0.12}>
        {model}
      </group>
    </group>
  );
}

/** Сетка двора: тонкие тёплые линии поверх площадки — только в режиме стройки. */
function GridOverlay({ size }: { size: number }) {
  const geom = useMemo(() => {
    const half = (size * CELL) / 2;
    const pts: number[] = [];
    for (let i = 0; i <= size; i++) {
      const p = -half + i * CELL;
      pts.push(p, 0, -half, p, 0, half, -half, 0, p, half, 0, p);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [size]);
  return (
    <lineSegments geometry={geom} position-y={0.185} renderOrder={5}>
      <lineBasicMaterial color="#d9b070" transparent opacity={0.4} depthWrite={false} />
    </lineSegments>
  );
}
