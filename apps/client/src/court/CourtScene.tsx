/**
 * Сцена двора в клиенте (этап A, направление B — живой 3D).
 *
 * Тёплый low-poly в палитре Bone-Wood №05: Ратуша, частокол с воротами,
 * снег, ели, овцы, дым, флажок. Камера игровая: пан, зум, свободный поворот
 * с ограничениями. Инстансинг и предел dpr — под слабые телефоны TG Mini App.
 * Без WebGL — запасной кадр и подсказка (решение круга 8).
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

const PLOT = 7.7; // половина площадки (14 клеток по 1.1)
const GATE_HALF = 1.5;

/** Палитра Bone-Wood №05: тёплое дерево, кость, тёплый снег. */
const C = {
  sky: "#c3d3da",
  fogFar: "#c3d3da",
  snowOuter: "#f7f4ec",
  snowPatch: "#f3efe4",
  dirt: "#8a6544",
  path: "#b08a5c",
  log: "#6d4a2c",
  logTip: "#7d5735",
  gate: "#5d4229",
  banner: "#d9c9a6",
  stone: "#a09a8c",
  wall: "#7b5236",
  beam: "#4a3320",
  roof: "#f7f3e8",
  door: "#352417",
  window: "#2e2013",
  frame: "#d9c9a6",
  fir1: "#2f5540",
  fir2: "#3a6047",
  firTip: "#eef3ea",
  trunk: "#5d4530",
  rock: "#b9b2a4",
  wool: "#f1ead9",
  sheepHead: "#2c2622",
  flag: "#b3402f",
  smoke: "#efe9dd",
} as const;

/** Детерминированный генератор: раскладка одинакова между кадрами и устройствами. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---------- камера: пан, зум, свободный поворот с ограничениями ----------
// Желаемое состояние меняют жесты, текущее догоняет его с демпфированием —
// камера идёт плавно, без «кадрового» ощущения (замечание заказчика, круг 9).
function CameraRig() {
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

// ---------- земля ----------
// Высоты слоёв разведены с запасом (земля 0.08 → тропа 0.105 → снег 0.14),
// иначе на телефонах с мелким depth-буфером снег «мигает» (z-fighting, круг 9).
function Ground({ grid }: { grid: CourtGridLite | null }) {
  const patches = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 26 }, () => {
      const m = 10 + Math.floor(r() * 5);
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2;
        const rad = (0.5 + r() * 1.1) * (0.7 + r() * 0.6);
        pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
      }
      return {
        x: (r() * 2 - 1) * (PLOT - 1),
        z: (r() * 2 - 1) * (PLOT - 1),
        rot: r() * Math.PI,
        geom: new THREE.ShapeGeometry(new THREE.Shape(pts), 6),
      };
    });
  }, []);
  const roads = grid?.roads ?? [];
  const occupied = useMemo(() => (grid ? footprintKeys(grid) : new Set<string>()), [grid]);
  const drifts = useMemo(() => {
    const r = rng(41);
    const out: { x: number; z: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 10 && guard++ < 60) {
      const a = r() * Math.PI * 2;
      const d = PLOT - 0.8 - r() * 1.5;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      // сугробы не растут на дороге и под постройками
      const cx = Math.round(x / CELL + 6.5);
      const cz = Math.round(z / CELL + 6.5);
      if (roads.some((road) => road.x === cx && road.z === cz)) continue;
      if (occupied.has(`${cx}:${cz}`)) continue;
      out.push({ x, z, s: 0.7 + r() * 1.1, rot: r() * Math.PI });
    }
    return out;
  }, [roads, occupied]);
  const debris = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; kind: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 64 && guard++ < 400) {
      const x = (r() * 2 - 1) * (PLOT - 0.5);
      const z = (r() * 2 - 1) * (PLOT - 0.5);
      const cx = Math.round(x / CELL + 6.5);
      const cz = Math.round(z / CELL + 6.5);
      if (roads.some((road) => road.x === cx && road.z === cz)) continue;
      if (occupied.has(`${cx}:${cz}`)) continue;
      out.push({ x, z, kind: r() > 0.55 ? 1 : 0, s: 0.04 + r() * 0.06, rot: r() * Math.PI });
    }
    return out;
  }, [roads, occupied]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={C.snowOuter} roughness={1} />
      </mesh>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[PLOT * 2 + 0.4, 0.16, PLOT * 2 + 0.4]} />
        <meshStandardMaterial color={C.dirt} roughness={1} />
      </mesh>
      {patches.map((p, i) => (
        <mesh key={i} geometry={p.geom} rotation-x={-Math.PI / 2} rotation-z={p.rot} position={[p.x, 0.14, p.z]} receiveShadow>
          {/* двухтонный снег: пятна чуть различаются оттенком — фактура вместо плоскости */}
          <meshStandardMaterial color={i % 2 ? C.snowPatch : "#eae1cd"} roughness={1} />
        </mesh>
      ))}
      {/* сугробы-валики у края площадки */}
      {drifts.map((d, i) => (
        <mesh key={`d${i}`} position={[d.x, 0.1, d.z]} rotation-y={d.rot} scale={[d.s, 0.3, d.s * 0.7]} castShadow receiveShadow>
          <sphereGeometry args={[0.8, 10, 8]} />
          <meshStandardMaterial color={C.snowPatch} roughness={1} flatShading />
        </mesh>
      ))}
      {/* мелкая фактура земли: камешки и жухлая трава — площадка не «пластиковая» */}
      {debris.map((d, i) =>
        d.kind === 0 ? (
          <mesh key={`st${i}`} position={[d.x, 0.11, d.z]} rotation-y={d.rot} castShadow>
            <dodecahedronGeometry args={[d.s, 0]} />
            <meshStandardMaterial color={i % 3 ? "#8f8878" : "#a39a88"} roughness={1} flatShading />
          </mesh>
        ) : (
          <mesh key={`gr${i}`} position={[d.x, 0.16, d.z]} rotation-y={d.rot}>
            <coneGeometry args={[d.s * 0.6, d.s * 3.2, 5]} />
            <meshStandardMaterial color="#77804a" roughness={1} flatShading />
          </mesh>
        ),
      )}
    </group>
  );
}

// ---------- каменная дорожка: лента-основание и плиты поверх снежного слоя (круг 20).
// Высоты: снег 0.14 → лента 0.17 → плиты 0.17–0.24. Кривая известна Ground'у,
// чтобы сугробы не прорастали сквозь дорогу. У ворот лента расширяется «воронкой».
// Клетка двора: 14 × 1.1 = 15.4 — ровно площадка PLOT (модуль хранит размер сетки).
const CELL = 1.1;
/** Клетка сетки → мир: сетка центрирована, край упирается в частокол. */
function gridToWorld(g: number, size: number): number {
  return (g - (size - 1) / 2) * CELL;
}
/** Пятна построек [ширина, глубина] — копия FOOTPRINT модуля court (сервер — власть). */
const FOOTVIEW: Record<string, [number, number]> = {
  townhall: [3, 3],
  cottage: [2, 2],
  farm: [2, 2],
  sawmill: [2, 2],
  quarry: [2, 2],
  mine: [2, 2],
  barracks: [2, 2],
  lantern: [1, 1],
  bench: [2, 1],
  well: [2, 2],
  flag: [1, 1],
  road: [1, 1],
};

/** Мир → клетка сетки. */
function worldToCell(wx: number, wz: number, size: number) {
  return {
    x: Math.round(wx / CELL + (size - 1) / 2),
    z: Math.round(wz / CELL + (size - 1) / 2),
  };
}

/** Занятые постройками клетки (переносимую можно пропустить). */
function footprintKeys(grid: CourtGridLite, skip?: { x: number; z: number }): Set<string> {
  const set = new Set<string>();
  for (const b of grid.buildings) {
    if (skip && b.x === skip.x && b.z === skip.z) continue;
    const [w, h] = FOOTVIEW[b.type] ?? [1, 1];
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    for (let dx = -halfW; dx < w - halfW; dx++) {
      for (let dz = -halfH; dz < h - halfH; dz++) set.add(`${b.x + dx}:${b.z + dz}`);
    }
  }
  return set;
}

/** Постройка, чьё пятно накрывает клетку (для долгого нажатия). */
function buildingAt(grid: CourtGridLite, cx: number, cz: number) {
  for (const b of grid.buildings) {
    const [w, h] = FOOTVIEW[b.type] ?? [1, 1];
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    if (cx >= b.x - halfW && cx < b.x - halfW + w && cz >= b.z - halfH && cz < b.z - halfH + h) return b;
  }
  return null;
}

/**
 * Гравийная дорога: плита на клетку — тёмное основание и россыпь мелких
 * камешков (детерминированно по клетке). Дорога — данные игрока: кладётся
 * и убирается тапом (команда court.road), узор складывается сам.
 */
function RoadTiles({ roads, size }: { roads: { x: number; z: number }[]; size: number }) {
  const tiles = useMemo(
    () =>
      roads.map((road) => {
        const r = rng(1000 + road.x * 31 + road.z * 7);
        const stones = Array.from({ length: 16 }, () => ({
          dx: (r() - 0.5) * 0.9,
          dz: (r() - 0.5) * 0.9,
          s: 0.03 + r() * 0.05,
          y: 0.185 + r() * 0.035,
          rot: r() * Math.PI,
          c: ["#b3a17f", "#9c8767", "#a89a82", "#8a7a5e", "#c2b193"][Math.floor(r() * 5) % 5]!,
        }));
        const cobbles = Array.from({ length: 3 }, () => ({
          dx: (r() - 0.5) * 0.72,
          dz: (r() - 0.5) * 0.72,
          s: 0.09 + r() * 0.05,
          rot: r() * Math.PI,
        }));
        const sand = Array.from({ length: 4 }, () => ({
          dx: (r() - 0.5) * 0.95,
          dz: (r() - 0.5) * 0.95,
          s: 0.05 + r() * 0.06,
        }));
        return {
          key: `${road.x}:${road.z}`,
          cx: gridToWorld(road.x, size),
          cz: gridToWorld(road.z, size),
          stones,
          cobbles,
          sand,
        };
      }),
    [roads, size],
  );
  return (
    <group>
      {tiles.map((tile) => (
        <group key={tile.key} position={[tile.cx, 0, tile.cz]}>
          {/* утоптанный грунт вокруг: плита не выглядит наклейкой */}
          <mesh position-y={0.155} rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[0.58, 10]} />
            <meshStandardMaterial color="#97794e" roughness={1} />
          </mesh>
          <mesh position-y={0.162} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[1.06, 1.06]} />
            <meshStandardMaterial color="#7d6444" roughness={1} />
          </mesh>
          {tile.sand.map((s, i) => (
            <mesh key={`sa${i}`} position={[s.dx, 0.168, s.dz]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[s.s, 6]} />
              <meshStandardMaterial color="#c2a97a" roughness={1} />
            </mesh>
          ))}
          {tile.stones.map((st, i) => (
            <mesh key={`s${i}`} position={[st.dx, st.y, st.dz]} rotation-y={st.rot} castShadow>
              <dodecahedronGeometry args={[st.s, 0]} />
              <meshStandardMaterial color={st.c} roughness={1} flatShading />
            </mesh>
          ))}
          {tile.cobbles.map((cb, i) => (
            <mesh key={`c${i}`} position={[cb.dx, 0.19, cb.dz]} rotation-y={cb.rot} castShadow receiveShadow>
              <cylinderGeometry args={[cb.s, cb.s * 1.12, 0.035, 7]} />
              <meshStandardMaterial color={i % 2 ? "#a8977c" : "#93826a"} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Ворота двора: башни-срубы, закрытые створы с крестом нашивок, крыша, фонарь. */
function Gatehouse() {
  return (
    <group>
      {/* башни по сторонам проёма: квадратные срубы с пояском и снежной крышей */}
      {[-1, 1].map((s) => (
        <group key={s} position={[7.7, 0, s * 1.66]}>
          <mesh position-y={1.15} castShadow receiveShadow>
            <boxGeometry args={[0.64, 2.3, 0.64]} />
            <meshStandardMaterial color={C.gate} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={2.34} castShadow>
            <boxGeometry args={[0.74, 0.1, 0.74]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0.34, 1.45, 0]} castShadow>
            <boxGeometry args={[0.06, 0.34, 0.16]} />
            <meshStandardMaterial color="#241a10" roughness={1} />
          </mesh>
          <mesh position-y={2.78} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.56, 0.56, 4]} />
            <meshStandardMaterial color={C.roof} roughness={0.85} flatShading />
          </mesh>
          <mesh position-y={3.1} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.26, 0.18, 4]} />
            <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
          </mesh>
        </group>
      ))}
      {/* створы распахнуты к башням: полотно на петле, проход по центру свободен */}
      {[-1, 1].map((s) => (
        <group key={`leaf${s}`} position={[7.66, 0, s * 1.3]} rotation-y={s * 1.4}>
          <mesh position={[0, 0.82, s * 0.65]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 1.6, 1.3]} />
            <meshStandardMaterial color="#5d4229" roughness={0.95} flatShading />
          </mesh>
          {[0.22, 1.08].map((z) => (
            <mesh key={z} position={[0.035, 0.82, s * (0.65 - z)]} castShadow>
              <boxGeometry args={[0.07, 1.66, 0.11]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0.08, 1.06, s * 0.65]} rotation-y={Math.PI / 2}>
            <boxGeometry args={[0.02, 0.09, 1.24]} />
            <meshStandardMaterial color="#3d2c1a" roughness={0.8} metalness={0.25} />
          </mesh>
          <mesh position={[0.1, 0.86, s * 0.62]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.08, 0.02, 6, 14]} />
            <meshStandardMaterial color="#f0c866" metalness={0.55} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* перемычка между башнями и ступенчатый фронтон: над проездом не нависает */}
      <mesh position={[7.7, 2.52, 0]} castShadow>
        <boxGeometry args={[0.72, 0.26, 2.68]} />
        <meshStandardMaterial color={C.logTip} roughness={0.95} />
      </mesh>
      <mesh position={[7.7, 2.78, 0]} castShadow>
        <boxGeometry args={[0.66, 0.24, 2.6]} />
        <meshStandardMaterial color={C.gate} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[7.7, 3.02, 0]} castShadow>
        <boxGeometry args={[0.56, 0.22, 2.2]} />
        <meshStandardMaterial color={C.gate} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[7.7, 3.24, 0]} castShadow>
        <boxGeometry args={[0.44, 0.2, 1.8]} />
        <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[7.7, 3.36, 0]}>
        <boxGeometry args={[0.3, 0.06, 1.66]} />
        <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
      </mesh>
      {/* фонарь под перемычкой — тёплая точка у входа */}
      <group position={[7.4, 0, 0]}>
        <mesh position={[0.09, 2.34, 0]}>
          <boxGeometry args={[0.18, 0.05, 0.05]} />
          <meshStandardMaterial color={C.beam} roughness={0.9} />
        </mesh>
        <LanternFlame y={2.2} />
        <mesh position-y={2.36}>
          <coneGeometry args={[0.13, 0.1, 4]} />
          <meshStandardMaterial color={C.beam} roughness={0.9} flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Palisade() {
  const logs = useMemo(() => {
    const r = rng(11);
    const pts: { x: number; z: number; h: number; tilt: number }[] = [];
    const step = 0.5;
    const j = () => (r() * 2 - 1);
    for (let t = -PLOT; t <= PLOT + 0.001; t += step) {
      pts.push({ x: t, z: PLOT, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
      pts.push({ x: t, z: -PLOT, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
      pts.push({ x: -PLOT, z: t, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
      if (Math.abs(t) >= GATE_HALF) pts.push({ x: PLOT, z: t, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
    }
    return pts;
  }, []);
  const body = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const tone = new THREE.Color();
    logs.forEach((p, i) => {
      d.position.set(p.x, 0.08 + p.h / 2, p.z);
      d.rotation.set(p.tilt, 0, p.tilt);
      d.updateMatrix();
      body.current.setMatrixAt(i, d.matrix);
      d.position.y = 0.08 + p.h + 0.08;
      d.updateMatrix();
      caps.current.setMatrixAt(i, d.matrix);
      // лёгкая тональная рябь по брёвнам: частокол читается деревом, а не пластиком
      body.current.setColorAt(i, tone.set(C.log).offsetHSL(0, i % 2 ? 0.01 : -0.01, ((i * 7) % 5) * 0.013 - 0.026));
    });
    body.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true;
  }, [logs]);
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, logs.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.115, 0.8, 6]} />
        <meshStandardMaterial color={C.log} roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, logs.length]} castShadow>
        <coneGeometry args={[0.115, 0.2, 6]} />
        <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
      </instancedMesh>
      {/* горизонтальные прожилины: ограда читается частоколом, а не частыми гвоздями */}
      {[-PLOT, PLOT].map((edge) => (
        <group key={`rail${edge}`}>
          {[0.32, 0.56].map((h) => (
            <mesh key={h} position={[0, h, edge]} castShadow>
              <boxGeometry args={[PLOT * 2, 0.05, 0.07]} />
              <meshStandardMaterial color={C.logTip} roughness={0.95} />
            </mesh>
          ))}
          {[0.32, 0.56].map((h) => (
            <mesh key={`z${h}`} position={[edge, h, 0]} castShadow>
              <boxGeometry args={[0.07, 0.05, PLOT * 2]} />
              <meshStandardMaterial color={C.logTip} roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
      {/* ворота-башня на восточной грани */}
      <Gatehouse />
      {/* угловые башенки: по три бревна со снежными шапками */}
      {[
        [-PLOT, -PLOT],
        [PLOT, -PLOT],
        [-PLOT, PLOT],
        [PLOT, PLOT],
      ].map(([cx, cz], i) => (
        <group key={`c${i}`} position={[cx!, 0, cz!]}>
          <mesh position-y={0.62} castShadow>
            <cylinderGeometry args={[0.13, 0.16, 1.15, 7]} />
            <meshStandardMaterial color={C.gate} roughness={0.95} flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, 0.5, -s * 0.16]} castShadow>
              <cylinderGeometry args={[0.085, 0.1, 0.9, 6]} />
              <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
            </mesh>
          ))}
          <mesh position-y={1.28} castShadow>
            <coneGeometry args={[0.18, 0.26, 7]} />
            <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- Ратуша: основание, сруб, крыша, окна, крыльцо, труба, дым, флажок ----------
/** Знамя на крыше Ратуши (уровень 3+): волнуется тем же ветром, что на воротах. */
function RoofBanner({ y = 3.55, s = 1 }: { y?: number; s?: number }) {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mesh = flag.current;
    if (!mesh) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 7 + t * 6) * 0.05 * (x + 0.3));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={[0, y, 0]} scale={s}>
      <mesh position-y={0.35} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
        <meshStandardMaterial color={C.beam} roughness={0.9} />
      </mesh>
      <mesh ref={flag} position={[0.33, 0.52, 0]}>
        <planeGeometry args={[0.56, 0.34, 8, 1]} />
        <meshStandardMaterial color={C.flag} side={THREE.DoubleSide} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

// ---------- постройки игрока: модель по типу, тёплая палитра игры ----------

/** Модель постройки: базой в y=0, размер по пятну клетки (CELL 1.1). */
// ---------- анимации построек: дым, мельница, пила, фонарь, полотнище ----------

/** Дым из трубы: редкие клубы, поднимаются и тают. */
function Smoke({ x, y, z, count = 5 }: { x: number; y: number; z: number; count?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.2 + i / count) % 1;
      m.position.set(x + Math.sin((p + i) * 5) * 0.1, y + p * 1.8, z + Math.cos((p + i) * 4) * 0.08);
      m.scale.setScalar(0.4 + p * 1.4);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.38 * (1 - p);
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color={C.smoke} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** Ветряк фермы: четыре лопасти, медленный ровный ход. */
function Windmill({ x, z }: { x: number; z: number }) {
  const rotor = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    rotor.current.rotation.z = clock.elapsedTime * 1.1;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.48} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.96, 6]} />
        <meshStandardMaterial color={C.beam} roughness={0.9} />
      </mesh>
      <group position-y={1.02} rotation-y={Math.PI / 2}>
        <group ref={rotor}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.27, Math.sin((k * Math.PI) / 2) * 0.27, 0]} rotation-z={(k * Math.PI) / 2} castShadow>
              <planeGeometry args={[0.52, 0.13]} />
              <meshStandardMaterial color={C.frame} side={THREE.DoubleSide} roughness={0.85} flatShading />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Пила лесопилки: компактный диск, ровный ход с лёгким биением реза. */
function SawBlade({ x, y, z }: { x: number; y: number; z: number }) {
  const spin = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    spin.current.rotation.z = t * 1.7;
    spin.current.position.y = Math.sin(t * 5.2) * 0.022;
  });
  return (
    <group position={[x, y, z]}>
      <group ref={spin}>
        <mesh rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.21, 0.21, 0.02, 16]} />
          <meshStandardMaterial color="#9aa0a6" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 8]} />
        <meshStandardMaterial color={C.beam} roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Бадья каменоломни: висит на воротах и чуть покачивается. */
function Bucket({ x, y, z }: { x: number; y: number; z: number }) {
  const sway = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    sway.current.rotation.x = Math.sin(clock.elapsedTime * 1.4) * 0.09;
    sway.current.rotation.z = Math.cos(clock.elapsedTime * 1.1) * 0.06;
  });
  return (
    <group position={[x, y, z]}>
      <group ref={sway}>
        <mesh position-y={-0.19}>
          <cylinderGeometry args={[0.009, 0.009, 0.3, 5]} />
          <meshStandardMaterial color="#4a3320" roughness={1} />
        </mesh>
        <mesh position-y={-0.4} castShadow>
          <boxGeometry args={[0.15, 0.13, 0.15]} />
          <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Фонарь: тёплый свет чуть дышит. */
function LanternFlame({ y }: { y: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.emissiveIntensity = 0.85 + Math.sin(clock.elapsedTime * 7) * 0.25;
  });
  return (
    <mesh position-y={y} castShadow>
      <boxGeometry args={[0.17, 0.22, 0.17]} />
      <meshStandardMaterial ref={mat} color="#8a6a3a" emissive="#ffcf7a" emissiveIntensity={0.85} roughness={0.6} />
    </mesh>
  );
}

/** Ткань на ветру: общий узел для знамён построек и ворот. */
function WaveCloth({
  w,
  h,
  color,
  position,
  rotationY = 0,
}: {
  w: number;
  h: number;
  color: string;
  position: [number, number, number];
  rotationY?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const pos = mesh.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 7 + t * 6) * 0.05 * (x + w / 2));
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh ref={mesh} position={position} rotation-y={rotationY} castShadow>
      <planeGeometry args={[w, h, 8, 1]} />
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.85} flatShading />
    </mesh>
  );
}

// ---------- модели построек: каждая собрана под своё пятно, ничего не вылезает ----------

/** Тёплый фундамент-подстил под 2×2 постройку. */
function Pad({ w = 1.86, h = 1.86, color = "#7d5c3c" }: { w?: number; h?: number; color?: string }) {
  return (
    <mesh position-y={0.04} receiveShadow>
      <boxGeometry args={[w, 0.08, h]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
}

/** Угловые балки фахверка: стены не «пластиковые». */
function CornerBeams({ y, size, hgt }: { y: number; size: number; hgt: number }) {
  const s = size / 2;
  return (
    <>
      {[
        [-s, -s],
        [s, -s],
        [-s, s],
        [s, s],
      ].map(([bx, bz], i) => (
        <mesh key={i} position={[bx!, y, bz!]} castShadow>
          <boxGeometry args={[0.09, hgt, 0.09]} />
          <meshStandardMaterial color={C.beam} roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

/** Снежная шапка на пирамидальной крыше. */
function RoofSnow({ y, r }: { y: number; r: number }) {
  return (
    <mesh position-y={y} rotation-y={Math.PI / 4} castShadow>
      <coneGeometry args={[r, r * 0.5, 4]} />
      <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
    </mesh>
  );
}

function BuildingBody({ type, level }: { type: string; level: number }) {
  const stage = THREE.MathUtils.clamp(Math.floor(level || 1), 1, 5);
  return (
    <group scale={1 + (stage - 1) * 0.025}>
      <BuildingModel type={type} />
      <BuildingStage type={type} stage={stage} />
    </group>
  );
}

function BuildingModel({ type }: { type: string }) {
  switch (type) {
    // жилой дом 2×2: каменный цоколь, фахверк, пирамидальная крыша, труба с дымом
    case "cottage":
      return (
        <group>
          <Pad />
          <mesh position-y={0.18} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.2, 1.5]} />
            <meshStandardMaterial color={C.stone} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={0.67} castShadow receiveShadow>
            <boxGeometry args={[1.36, 0.78, 1.36]} />
            <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
          </mesh>
          <CornerBeams y={0.67} size={1.38} hgt={0.8} />
          {/* дверь с рамой и окно с цветником */}
          <mesh position={[0.33, 0.5, 0.68]}>
            <boxGeometry args={[0.42, 0.64, 0.05]} />
            <meshStandardMaterial color={C.frame} roughness={0.9} />
          </mesh>
          <mesh position={[0.33, 0.47, 0.71]}>
            <boxGeometry args={[0.3, 0.54, 0.05]} />
            <meshStandardMaterial color={C.door} roughness={0.95} />
          </mesh>
          <group position={[-0.33, 0.78, 0.68]}>
            <mesh>
              <boxGeometry args={[0.36, 0.36, 0.05]} />
              <meshStandardMaterial color={C.frame} roughness={0.9} />
            </mesh>
            <mesh position-z={0.03}>
              <boxGeometry args={[0.26, 0.26, 0.05]} />
              <meshStandardMaterial color={C.window} roughness={0.5} />
            </mesh>
            <mesh position-y={-0.24}>
              <boxGeometry args={[0.4, 0.09, 0.1]} />
              <meshStandardMaterial color="#6f5238" roughness={1} />
            </mesh>
            {[[-0.12, 0], [0, 0.02], [0.12, 0]].map(([fx, fy], i) => (
              <mesh key={i} position={[fx!, -0.17 + fy!, 0]}>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshStandardMaterial color={C.flag} roughness={0.8} flatShading />
              </mesh>
            ))}
          </group>
          {/* крыша со снегом и каменная труба */}
          <mesh position-y={1.39} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.1, 0.62, 4]} />
            <meshStandardMaterial color={C.roof} roughness={0.85} flatShading />
          </mesh>
          <RoofSnow y={1.72} r={0.5} />
          <mesh position={[0.52, 1.15, -0.3]} castShadow>
            <boxGeometry args={[0.2, 0.6, 0.2]} />
            <meshStandardMaterial color={C.stone} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0.52, 1.48, -0.3]}>
            <boxGeometry args={[0.26, 0.06, 0.26]} />
            <meshStandardMaterial color="#8f8878" roughness={0.95} flatShading />
          </mesh>
          <Smoke x={0.52} y={1.6} z={-0.3} />
          {/* сложенные у стены дрова */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.56, 0.13 + (i === 2 ? 0.12 : 0), 0.5 + (i === 2 ? -0.09 : i * 0.14)]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 0.44, 7]} />
              <meshStandardMaterial color={i % 2 ? C.log : C.logTip} roughness={0.95} flatShading />
            </mesh>
          ))}
        </group>
      );
    // ферма 2×2: борозды со всходами, сарай, ветряк, оградка
    case "farm":
      return (
        <group>
          <Pad w={1.9} h={1.9} color="#6f5238" />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, 0.075, -0.7 + i * 0.35]} receiveShadow>
              <boxGeometry args={[1.72, 0.02, 0.12]} />
              <meshStandardMaterial color="#5d4430" roughness={1} />
            </mesh>
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={`s${i}`} position={[-0.6 + (i % 3) * 0.6, 0.15, -0.62 + Math.floor(i / 3) * 1.05 + (i % 2) * 0.1]}>
              <coneGeometry args={[0.05, 0.16, 5]} />
              <meshStandardMaterial color="#7fae5a" roughness={1} flatShading />
            </mesh>
          ))}
          {/* сарай в углу поля */}
          <group position={[-0.52, 0, -0.5]}>
            <mesh position-y={0.32} castShadow receiveShadow>
              <boxGeometry args={[0.74, 0.52, 0.64]} />
              <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
            </mesh>
            <mesh position-y={0.75} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.62, 0.34, 4]} />
              <meshStandardMaterial color={C.flag} roughness={0.9} flatShading />
            </mesh>
            <RoofSnow y={0.95} r={0.28} />
            <mesh position={[0, 0.2, 0.33]}>
              <boxGeometry args={[0.24, 0.34, 0.04]} />
              <meshStandardMaterial color={C.door} roughness={0.95} />
            </mesh>
          </group>
          <Windmill x={0.6} z={0.55} />
          {/* оградка по переднему краю */}
          {[-0.72, -0.24, 0.24, 0.72].map((fx) => (
            <mesh key={`f${fx}`} position={[fx, 0.16, 0.9]} castShadow>
              <boxGeometry args={[0.05, 0.22, 0.05]} />
              <meshStandardMaterial color={C.logTip} roughness={0.95} />
            </mesh>
          ))}
          <mesh position={[0, 0.24, 0.9]}>
            <boxGeometry args={[1.66, 0.03, 0.035]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} />
          </mesh>
        </group>
      );
    // пилорама 2×2: сарай, крутящийся пильный диск, штабель брёвен, доски
    case "sawmill":
      return (
        <group>
          <Pad />
          <group position={[-0.33, 0, -0.28]}>
            <mesh position-y={0.39} castShadow receiveShadow>
              <boxGeometry args={[1.05, 0.66, 0.95]} />
              <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
            </mesh>
            <CornerBeams y={0.39} size={1.07} hgt={0.68} />
            <mesh position-y={0.99} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.92, 0.42, 4]} />
              <meshStandardMaterial color={C.roof} roughness={0.85} flatShading />
            </mesh>
            <RoofSnow y={1.24} r={0.4} />
          </group>
          <SawBlade x={0.28} y={0.52} z={0.14} />
          {/* штабель: три внизу, две сверху */}
          {[0, 1, 2].map((i) => (
            <mesh key={`l${i}`} position={[0.62, 0.1, -0.18 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial color={i % 2 ? C.log : C.logTip} roughness={0.95} flatShading />
            </mesh>
          ))}
          {[0, 1].map((i) => (
            <mesh key={`t${i}`} position={[0.62, 0.26, -0.08 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial color={C.log} roughness={0.95} flatShading />
            </mesh>
          ))}
          {/* свежие доски у сарая */}
          <mesh position={[0.42, 0.3, -0.62]} rotation-z={0.32} castShadow>
            <boxGeometry args={[0.5, 0.03, 0.14]} />
            <meshStandardMaterial color="#c89a62" roughness={0.9} />
          </mesh>
          <mesh position={[0.56, 0.26, -0.7]} rotation-z={-0.28} castShadow>
            <boxGeometry args={[0.44, 0.03, 0.12]} />
            <meshStandardMaterial color="#b98f58" roughness={0.9} />
          </mesh>
        </group>
      );
    // каменоломня 2×2: скала, вороты с бадьёй, штабель блоков
    case "quarry":
      return (
        <group>
          <Pad color="#8f8878" />
          <mesh position={[-0.28, 0.28, -0.28]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#a8a091" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.32, 0.2, -0.4]} rotation-y={0.8} castShadow>
            <dodecahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color={C.rock} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.02, 0.17, 0.12]} rotation-y={1.9} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial color="#a8a091" roughness={1} flatShading />
          </mesh>
          {/* деревянные вороты: нога, перекладина, верёвка, бадья */}
          <mesh position={[0.42, 0.4, 0.5]} rotation-z={0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0.68, 0.4, 0.5]} rotation-z={-0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0.55, 0.8, 0.5]} castShadow>
            <boxGeometry args={[0.36, 0.05, 0.05]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <Bucket x={0.55} y={0.78} z={0.5} />
          {/* блоки ровным штабелем */}
          {[0, 1, 2].map((i) => (
            <mesh key={`b${i}`} position={[-0.55, 0.12 + (i === 2 ? 0.21 : 0), 0.52 + (i === 2 ? -0.1 : (i - 0.5) * 0.24)]} rotation-y={i * 0.4} castShadow>
              <boxGeometry args={[0.21, 0.21, 0.21]} />
              <meshStandardMaterial color={i % 2 ? "#b9b2a4" : "#a8a091"} roughness={0.95} flatShading />
            </mesh>
          ))}
        </group>
      );
    // рудник 2×2: гора, крепь портала, рельсы и вагонетка
    case "mine":
      return (
        <group>
          <Pad color="#77664e" />
          <mesh position={[0, 0.28, -0.1]} scale={[1.15, 0.6, 0.95]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color="#6b5a45" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.55, 0.16, -0.45]} rotation-y={0.7} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial color="#5d4e3c" roughness={1} flatShading />
          </mesh>
          {/* крепь и чёрный провал */}
          <mesh position={[-0.2, 0.26, 0.62]} castShadow>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0.2, 0.26, 0.62]} castShadow>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.55, 0.62]} castShadow>
            <boxGeometry args={[0.6, 0.09, 0.09]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0.63]}>
            <boxGeometry args={[0.36, 0.42, 0.05]} />
            <meshStandardMaterial color="#1c130b" roughness={1} />
          </mesh>
          {/* рельсы со шпалами и вагонетка */}
          {[-0.09, 0.09].map((rx) => (
            <mesh key={rx} position={[rx, 0.06, 0.28]}>
              <boxGeometry args={[0.03, 0.02, 0.8]} />
              <meshStandardMaterial color="#8a7a5e" roughness={0.9} metalness={0.2} />
            </mesh>
          ))}
          {[0.02, 0.28, 0.54].map((rz) => (
            <mesh key={`w${rz}`} position={[0, 0.045, rz]}>
              <boxGeometry args={[0.3, 0.02, 0.045]} />
              <meshStandardMaterial color="#5d4430" roughness={1} />
            </mesh>
          ))}
          <group position={[0, 0.16, 0.34]}>
            <mesh castShadow>
              <boxGeometry args={[0.26, 0.16, 0.19]} />
              <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
            </mesh>
            {[[-0.1, -0.07], [0.1, -0.07], [-0.1, 0.07], [0.1, 0.07]].map(([wx, wz], i) => (
              <mesh key={i} position={[wx!, -0.09, wz!]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
            ))}
            <mesh position={[0, 0.1, 0]} castShadow>
              <dodecahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial color="#a89a82" roughness={1} flatShading />
            </mesh>
          </group>
        </group>
      );
    // казарма 2×2: каменное основание, красная крыша, знамя, стойка оружия
    case "barracks":
      return (
        <group>
          <Pad />
          <mesh position-y={0.18} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.32, 1.12]} />
            <meshStandardMaterial color="#a09a8c" roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={0.64} castShadow receiveShadow>
            <boxGeometry args={[1.36, 0.6, 0.98]} />
            <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
          </mesh>
          <CornerBeams y={0.64} size={1.38} hgt={0.62} />
          <mesh position-y={1.24} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.08, 0.52, 4]} />
            <meshStandardMaterial color={C.flag} roughness={0.9} flatShading />
          </mesh>
          <RoofSnow y={1.54} r={0.46} />
          <mesh position={[-0.3, 0.44, 0.5]}>
            <boxGeometry args={[0.34, 0.5, 0.05]} />
            <meshStandardMaterial color={C.door} roughness={0.95} />
          </mesh>
          <group position={[0.28, 0.68, 0.5]}>
            <mesh>
              <boxGeometry args={[0.34, 0.34, 0.05]} />
              <meshStandardMaterial color={C.frame} roughness={0.9} />
            </mesh>
            <mesh position-z={0.03}>
              <boxGeometry args={[0.24, 0.24, 0.05]} />
              <meshStandardMaterial color={C.window} roughness={0.5} />
            </mesh>
          </group>
          {/* знамя на стене — волнуется */}
          <WaveCloth w={0.26} h={0.38} color={C.flag} position={[-0.66, 0.66, 0.52]} />
          {/* стойка: два копья и щит */}
          {[-0.04, 0.04].map((ox) => (
            <mesh key={ox} position={[0.66 + ox, 0.44, 0.44 - Math.abs(ox)]} rotation-z={0.12 + (ox < 0 ? -0.05 : 0.05)} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.8, 6]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
          ))}
          {[-0.04, 0.04].map((ox) => (
            <mesh key={`h${ox}`} position={[0.66 + ox * 1.4, 0.88, 0.44 - Math.abs(ox)]}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0.66, 0.6, 0.56]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 12]} />
            <meshStandardMaterial color="#8a6a3a" roughness={0.85} />
          </mesh>
        </group>
      );
    // колодец 2×2: сруб, ворот с ручкой, ведро, крыша
    case "well":
      return (
        <group>
          <Pad w={1.8} h={1.8} />
          <mesh position-y={0.17} castShadow receiveShadow>
            <cylinderGeometry args={[0.44, 0.5, 0.34, 9]} />
            <meshStandardMaterial color={C.stone} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={0.35}>
            <cylinderGeometry args={[0.37, 0.37, 0.03, 9]} />
            <meshStandardMaterial color="#1c130b" roughness={1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.58, 0.06, Math.sin((i / 5) * Math.PI * 2) * 0.58]} rotation-y={i} castShadow>
              <dodecahedronGeometry args={[0.07, 0]} />
              <meshStandardMaterial color={i % 2 ? "#a8a091" : "#8f8878"} roughness={1} flatShading />
            </mesh>
          ))}
          {/* ворот */}
          <mesh position={[-0.3, 0.5, 0]} rotation-z={0.34} castShadow>
            <boxGeometry args={[0.06, 1.0, 0.06]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0.3, 0.5, 0]} rotation-z={-0.34} castShadow>
            <boxGeometry args={[0.06, 1.0, 0.06]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.56, 8]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0.32, 0.86, 0.07]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, 0.14, 6]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.34, 5]} />
            <meshStandardMaterial color="#4a3320" roughness={1} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.13, 0.12, 0.13]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={1.24} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.62, 0.36, 4]} />
            <meshStandardMaterial color={C.roof} roughness={0.85} flatShading />
          </mesh>
          <RoofSnow y={1.46} r={0.27} />
        </group>
      );
    // скамейка 2×1: спинка, подлокотники, резные ножки
    case "bench":
      return (
        <group>
          <Pad w={1.86} h={0.86} />
          <mesh position-y={0.3} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.06, 0.32]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, 0.47, -0.15]} rotation-x={-0.12} castShadow>
            <boxGeometry args={[1.0, 0.28, 0.05]} />
            <meshStandardMaterial color={C.logTip} roughness={0.95} flatShading />
          </mesh>
          {[-0.46, 0.46].map((bx) => (
            <group key={bx} position={[bx, 0, 0]}>
              <mesh position-y={0.14} castShadow>
                <boxGeometry args={[0.06, 0.28, 0.3]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
              <mesh position-y={0.42} castShadow>
                <boxGeometry args={[0.06, 0.05, 0.3]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      );
    // фонарь 1×1: каменное основание, живой огонёк
    case "lantern":
      return (
        <group>
          <mesh position-y={0.05} castShadow receiveShadow>
            <cylinderGeometry args={[0.17, 0.2, 0.1, 8]} />
            <meshStandardMaterial color={C.stone} roughness={0.95} flatShading />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2 + 0.5) * 0.26, 0.05, Math.sin((i / 3) * Math.PI * 2 + 0.5) * 0.26]} rotation-y={i} castShadow>
              <dodecahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial color="#8f8878" roughness={1} flatShading />
            </mesh>
          ))}
          <mesh position-y={0.47} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.74, 6]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} />
          </mesh>
          <LanternFlame y={0.95} />
          <mesh position-y={1.12}>
            <coneGeometry args={[0.15, 0.12, 4]} />
            <meshStandardMaterial color={C.beam} roughness={0.9} flatShading />
          </mesh>
        </group>
      );
    // знамя 1×1: каменный постамент и полотнище
    case "flag":
      return (
        <group>
          <mesh position-y={0.05} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.19, 0.1, 8]} />
            <meshStandardMaterial color={C.stone} roughness={0.95} flatShading />
          </mesh>
          <RoofBannerSmall />
        </group>
      );
    default:
      return null;
  }
}

const LARGE_BUILDINGS = new Set(["cottage", "farm", "sawmill", "quarry", "mine", "barracks", "well"]);
/** Фракционное знамя на постройке: тонкое древко, ткань, костяной наконечник. */
function StageBanner({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position-y={0.55} castShadow>
        <cylinderGeometry args={[0.018, 0.024, 1.1, 6]} />
        <meshStandardMaterial color={C.beam} roughness={0.9} />
      </mesh>
      <WaveCloth w={0.22} h={0.3} color={C.flag} position={[0.13, 0.92, 0]} />
      <mesh position-y={1.12}>
        <coneGeometry args={[0.045, 0.1, 4]} />
        <meshStandardMaterial color="#d8ae62" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Золотой навершник — завершающий силуэт пятой ступени. */
function StageCrown({ y, z = -0.12, scale = 1 }: { y: number; z?: number; scale?: number }) {
  return (
    <group position={[0, y, z]} scale={scale}>
      <mesh position-y={0.06} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color={C.beam} roughness={0.85} flatShading />
      </mesh>
      <mesh position-y={0.15}>
        <boxGeometry args={[0.56, 0.05, 0.56]} />
        <meshStandardMaterial color="#d8ae62" metalness={0.4} roughness={0.45} flatShading />
      </mesh>
      <mesh position-y={0.4} castShadow>
        <coneGeometry args={[0.17, 0.46, 5]} />
        <meshStandardMaterial color="#8b6132" roughness={0.8} flatShading />
      </mesh>
      <mesh position-y={0.68}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color="#f0c866" metalness={0.55} roughness={0.32} />
      </mesh>
    </group>
  );
}

/** Видимые ступени развития каждой постройки следуют за уровнем Цитадели. */
function BuildingStage({ type, stage }: { type: string; stage: number }) {
  if (LARGE_BUILDINGS.has(type)) {
    return (
      <group>
        {stage >= 2 ? (
          <group>
            <mesh position-y={0.12} receiveShadow>
              <boxGeometry args={[1.78, 0.08, 1.78]} />
              <meshStandardMaterial color="#aaa396" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.17, 0.91]} castShadow>
              <boxGeometry args={[0.58, 0.1, 0.22]} />
              <meshStandardMaterial color="#9a948a" roughness={0.95} flatShading />
            </mesh>
          </group>
        ) : null}
        {stage >= 3 ? (
          <group>
            {[-0.76, 0.76].flatMap((x) => [-0.76, 0.76].map((z) => (
              <mesh key={`${x}:${z}`} position={[x, 0.31, z]} castShadow>
                <boxGeometry args={[0.16, 0.36, 0.16]} />
                <meshStandardMaterial color="#c2b9a8" roughness={0.9} flatShading />
              </mesh>
            )))}
            <mesh position={[0, 0.25, 0.91]}>
              <boxGeometry args={[0.66, 0.045, 0.035]} />
              <meshStandardMaterial color="#d8ae62" metalness={0.35} roughness={0.5} />
            </mesh>
          </group>
        ) : null}
        {type === "cottage" && stage >= 3 ? (
          <group position={[0, 1.4, -0.23]}>
            <mesh position-y={0.1} castShadow>
              <boxGeometry args={[0.48, 0.3, 0.38]} />
              <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, 0.31, 0.19]}>
              <boxGeometry args={[0.26, 0.18, 0.04]} />
              <meshStandardMaterial color={C.window} roughness={0.5} />
            </mesh>
            <mesh position-y={0.34} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.38, 0.3, 4]} />
              <meshStandardMaterial color={C.flag} roughness={0.85} flatShading />
            </mesh>
          </group>
        ) : null}
        {type === "farm" && stage >= 2 ? (
          <group>
            {Array.from({ length: stage + 1 }, (_, i) => (
              <mesh key={`crop-${i}`} position={[-0.66 + (i % 4) * 0.42, 0.18, -0.63 + Math.floor(i / 4) * 0.36]}>
                <coneGeometry args={[0.045, 0.17 + stage * 0.025, 5]} />
                <meshStandardMaterial color={i % 2 ? "#879c56" : "#9cae64"} roughness={1} flatShading />
              </mesh>
            ))}
          </group>
        ) : null}
        {type === "farm" && stage >= 4 ? (
          <group position={[0.48, 0, -0.55]}>
            <mesh position-y={0.43} castShadow>
              <cylinderGeometry args={[0.24, 0.28, 0.75, 8]} />
              <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
            </mesh>
            <mesh position-y={0.86} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.34, 0.3, 4]} />
              <meshStandardMaterial color={C.flag} roughness={0.85} flatShading />
            </mesh>
            <RoofSnow y={1.02} r={0.2} />
          </group>
        ) : null}
        {type === "sawmill" && stage >= 4 ? (
          <group>
            <mesh position={[0.72, 0.54, -0.56]} castShadow>
              <boxGeometry args={[0.07, 0.92, 0.07]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
            <mesh position={[0.49, 1.0, -0.56]} castShadow>
              <boxGeometry args={[0.52, 0.07, 0.07]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
            <mesh position={[0.3, 0.79, -0.56]} rotation-z={0.26}>
              <cylinderGeometry args={[0.014, 0.014, 0.42, 5]} />
              <meshStandardMaterial color="#c89a62" roughness={0.8} />
            </mesh>
          </group>
        ) : null}
        {type === "quarry" && stage >= 4 ? (
          <group>
            {[-0.58, -0.18].map((x) => (
              <mesh key={x} position={[x, 0.58, -0.62]} castShadow>
                <boxGeometry args={[0.07, 1.0, 0.07]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
            ))}
            <mesh position={[-0.38, 1.08, -0.62]} castShadow>
              <boxGeometry args={[0.48, 0.07, 0.07]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
            <mesh position={[-0.38, 0.7, -0.62]}>
              <cylinderGeometry args={[0.015, 0.015, 0.62, 5]} />
              <meshStandardMaterial color="#a58b64" roughness={0.9} />
            </mesh>
          </group>
        ) : null}
        {type === "mine" && stage >= 4 ? (
          <group>
            {[-0.36, 0.36].map((x) => (
              <mesh key={x} position={[x, 0.92, 0.56]} castShadow>
                <boxGeometry args={[0.08, 1.44, 0.08]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
            ))}
            <mesh position={[0, 1.62, 0.56]} castShadow>
              <boxGeometry args={[0.82, 0.09, 0.09]} />
              <meshStandardMaterial color={C.beam} roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.42, 0.56]}>
              <cylinderGeometry args={[0.17, 0.17, 0.06, 10]} />
              <meshStandardMaterial color="#c1b39b" metalness={0.35} roughness={0.5} />
            </mesh>
          </group>
        ) : null}
        {type === "barracks" && stage >= 4 ? (
          <group position={[0, 1.12, -0.25]}>
            <mesh position-y={0.27} castShadow>
              <boxGeometry args={[0.58, 0.54, 0.56]} />
              <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
            </mesh>
            <mesh position-y={0.62} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.46, 0.32, 4]} />
              <meshStandardMaterial color={C.flag} roughness={0.85} flatShading />
            </mesh>
            <RoofSnow y={0.81} r={0.2} />
          </group>
        ) : null}
        {type === "cottage" && stage >= 4 ? <StageBanner x={0} z={0.78} scale={0.68} /> : null}
        {type === "cottage" && stage >= 5 ? <StageCrown y={1.72} scale={0.56} /> : null}
        {type === "farm" && stage >= 5 ? <StageCrown y={1.0} z={-0.55} scale={0.42} /> : null}
        {type === "sawmill" && stage >= 5 ? (
          <mesh position={[0.49, 1.1, -0.53]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.18, 0.035, 6, 12]} />
            <meshStandardMaterial color="#d8ae62" metalness={0.55} roughness={0.34} />
          </mesh>
        ) : null}
        {type === "quarry" && stage >= 5 ? (
          <mesh position={[-0.38, 1.15, -0.58]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.18, 0.035, 6, 12]} />
            <meshStandardMaterial color="#d8ae62" metalness={0.5} roughness={0.38} />
          </mesh>
        ) : null}
        {type === "mine" && stage >= 5 ? (
          <group position={[0, 1.25, 0.58]}>
            <StageBanner x={0} z={0} scale={0.5} />
          </group>
        ) : null}
        {type === "barracks" && stage >= 5 ? <StageBanner x={0} z={0.68} scale={0.7} /> : null}
        {type === "well" && stage >= 4 ? (
          <group position={[0, 1.32, 0]}>
            <mesh position-y={0.18} castShadow>
              <boxGeometry args={[0.44, 0.36, 0.44]} />
              <meshStandardMaterial color={C.wall} roughness={0.9} flatShading />
            </mesh>
            <mesh position-y={0.43} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.36, 0.26, 4]} />
              <meshStandardMaterial color={C.flag} roughness={0.82} flatShading />
            </mesh>
            <RoofSnow y={0.57} r={0.2} />
          </group>
        ) : null}
        {type === "well" && stage >= 5 ? <StageCrown y={1.86} scale={0.48} /> : null}
      </group>
    );
  }

  if (type === "lantern") {
    return (
      <group>
        {stage >= 2 ? (
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.26, 0.31, 0.12, 8]} />
            <meshStandardMaterial color="#aaa396" roughness={0.9} flatShading />
          </mesh>
        ) : null}
        {stage >= 3 ? (
          <group>
            {[-0.3, 0.3].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <mesh position-y={0.66} castShadow>
                  <cylinderGeometry args={[0.025, 0.035, 1.18, 6]} />
                  <meshStandardMaterial color={C.beam} roughness={0.85} />
                </mesh>
                <LanternFlame y={1.24} />
              </group>
            ))}
          </group>
        ) : null}
        {stage >= 4 ? (
          <group>
            <mesh position-y={1.34} castShadow>
              <boxGeometry args={[0.84, 0.08, 0.36]} />
              <meshStandardMaterial color="#8b6132" roughness={0.8} flatShading />
            </mesh>
            <mesh position-y={1.42}>
              <coneGeometry args={[0.46, 0.22, 4]} />
              <meshStandardMaterial color="#d8ae62" metalness={0.35} roughness={0.45} flatShading />
            </mesh>
          </group>
        ) : null}
        {stage >= 5 ? <StageCrown y={1.5} /> : null}
      </group>
    );
  }

  if (type === "bench") {
    return (
      <group>
        {stage >= 2 ? (
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[1.56, 0.12, 0.7]} />
            <meshStandardMaterial color="#aaa396" roughness={0.95} flatShading />
          </mesh>
        ) : null}
        {stage >= 3 ? (
          <group>
            {[-0.4, 0.4].map((x) => (
              <mesh key={x} position={[x, 0.72, -0.15]}>
                <octahedronGeometry args={[0.09, 0]} />
                <meshStandardMaterial color="#d8ae62" metalness={0.4} roughness={0.4} />
              </mesh>
            ))}
          </group>
        ) : null}
        {stage >= 4 ? (
          <group>
            {[-0.72, 0.72].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <mesh position-y={0.62} castShadow>
                  <cylinderGeometry args={[0.025, 0.035, 1.08, 6]} />
                  <meshStandardMaterial color={C.beam} roughness={0.9} />
                </mesh>
                <mesh position-y={1.1}>
                  <sphereGeometry args={[0.11, 8, 8]} />
                  <meshStandardMaterial color="#9b6731" emissive="#ffcb70" emissiveIntensity={0.65} roughness={0.5} />
                </mesh>
              </group>
            ))}
          </group>
        ) : null}
        {stage >= 5 ? (
          <group>
            {[-0.68, 0.68].map((x) => [-0.3, 0.3].map((z) => (
              <mesh key={`${x}:${z}`} position={[x, 1.36, z]} castShadow>
                <boxGeometry args={[0.05, 1.18, 0.05]} />
                <meshStandardMaterial color={C.beam} roughness={0.9} />
              </mesh>
            )))}
            <mesh position-y={1.9} castShadow>
              <boxGeometry args={[1.5, 0.08, 0.78]} />
              <meshStandardMaterial color={C.wall} roughness={0.9} flatShading />
            </mesh>
            <mesh position-y={2.08} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.78, 0.32, 4]} />
              <meshStandardMaterial color={C.roof} roughness={0.8} flatShading />
            </mesh>
          </group>
        ) : null}
      </group>
    );
  }

  if (type === "flag") {
    return (
      <group>
        {stage >= 2 ? (
          <mesh position-y={0.12}>
            <boxGeometry args={[0.44, 0.12, 0.44]} />
            <meshStandardMaterial color="#aaa396" roughness={0.9} flatShading />
          </mesh>
        ) : null}
        {stage >= 3 ? <StageBanner x={-0.22} z={0.08} scale={0.48} /> : null}
        {stage >= 4 ? <StageBanner x={0.22} z={-0.08} scale={0.48} /> : null}
        {stage >= 5 ? <StageCrown y={0.94} z={-0.2} /> : null}
      </group>
    );
  }

  return null;
}

/** Малое знамя-украшение: волнуется на ветру. */
function RoofBannerSmall() {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const mesh = flag.current;
    if (!mesh) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 8 + t * 6.5) * 0.05 * (x + 0.24));
    }
    pos.needsUpdate = true;
  });
  return (
    <group>
      <mesh position-y={0.5} castShadow>
        <cylinderGeometry args={[0.028, 0.035, 1.0, 6]} />
        <meshStandardMaterial color={C.beam} roughness={0.9} />
      </mesh>
      <mesh ref={flag} position={[0.26, 0.82, 0]}>
        <planeGeometry args={[0.44, 0.28, 8, 1]} />
        <meshStandardMaterial color={C.flag} side={THREE.DoubleSide} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

/** Появление постройки: мягкий «встаёт на место» с лёгким превышением. */
function Popped({ x, z, children }: { x: number; z: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - start.current) / 0.4);
    const ease = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    ref.current.scale.setScalar(0.55 + 0.45 * ease + Math.sin(t * Math.PI) * 0.08);
  });
  return (
    <group ref={ref} position={[x, 0.08, z]}>
      {children}
    </group>
  );
}

/** Все постройки игрока из сетки модуля. */
function Buildings({ grid, level }: { grid: CourtGridLite; level: number }) {
  return (
    <>
      {grid.buildings.map((b) => {
        if (b.type === "townhall") return null; // Ратуша — отдельная живая модель
        const [w, h] = FOOTVIEW[b.type] ?? [1, 1];
        const cx = gridToWorld(b.x - Math.floor(w / 2) + (w - 1) / 2, grid.size);
        const cz = gridToWorld(b.z - Math.floor(h / 2) + (h - 1) / 2, grid.size);
        return (
          <Popped key={`${b.type}:${b.x}:${b.z}`} x={cx} z={cz}>
            <BuildingBody type={b.type} level={level} />
          </Popped>
        );
      })}
    </>
  );
}

/** Пыль постановки: короткий веер комков под ногами новой постройки. */
function Dust({ x, z, onDone }: { x: number; z: number; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = (clock.elapsedTime - start.current) / 0.7;
    if (t >= 1) {
      onDone();
      return;
    }
    ref.current.children.forEach((m, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = 0.15 + t * 0.85;
      m.position.set(Math.cos(a) * r, 0.1 + t * (0.35 + (i % 3) * 0.12), Math.sin(a) * r);
      m.scale.setScalar(0.5 + t * 1.3);
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat) mat.opacity = 0.55 * (1 - t);
    });
  });
  return (
    <group ref={ref} position={[x, 0.08, z]}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.09, 6, 6]} />
          <meshStandardMaterial color="#c9b591" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
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
      <lineBasicMaterial color="#f0e6d2" transparent opacity={0.25} depthWrite={false} />
    </lineSegments>
  );
}

/**
 * Слой стройки: призрак постройки под пальцем и тап по клетке.
 * Тап отличаем от панорамы: если палец уехал больше 8px — это поворот камеры.
 */
/**
 * Ввод двора: тап ставит выбранную постройку или двигает подтверждаемую,
 * тап кладёт/убирает плиту дороги, долгое нажатие (0.55 с) поднимает
 * постройку для переноски — включая Ратушу (забор вне сетки и не трогается).
 * Тап отличаем от панорамы порогом 8px.
 */
function CourtInput({
  grid,
  tool,
  pending,
  onTarget,
  onRoad,
  onPickup,
}: {
  grid: CourtGridLite;
  tool: { kind: "place"; type: string } | { kind: "road" } | null;
  pending: { type: string; x: number; z: number; from?: { x: number; z: number } } | null;
  onTarget: (x: number, z: number) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number) => void;
}) {
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const down = useRef<{ x: number; y: number; cell: { x: number; z: number } } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const size = grid.size;

  const roads = useMemo(() => new Set(grid.roads.map((r) => `${r.x}:${r.z}`)), [grid]);
  const busy = useMemo(() => footprintKeys(grid, pending?.from), [grid, pending]);
  const [viewW, viewH] = FOOTVIEW[pending?.type ?? (tool?.kind === "place" ? tool.type : "")] ?? [1, 1];
  const halfW = Math.floor(viewW / 2);
  const halfH = Math.floor(viewH / 2);

  const free = (gx: number, gz: number): boolean => {
    for (let dx = -halfW; dx < viewW - halfW; dx++) {
      for (let dz = -halfH; dz < viewH - halfH; dz++) {
        const x = gx + dx;
        const z = gz + dz;
        if (x < 0 || z < 0 || x > size - 1 || z > size - 1) return false;
        const key = `${x}:${z}`;
        if (busy.has(key) || roads.has(key)) return false;
      }
    }
    return true;
  };

  const centerOf = (cell: { x: number; z: number }) => ({
    wx: gridToWorld(cell.x - halfW + (viewW - 1) / 2, size),
    wz: gridToWorld(cell.z - halfH + (viewH - 1) / 2, size),
  });

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const ghost = pending
    ? { valid: true, ...centerOf(pending) }
    : hover && tool?.kind === "place"
      ? { valid: free(hover.x, hover.z), ...centerOf(hover) }
      : null;
  const ghostColor = pending ? "#d9b25a" : ghost?.valid ? "#7fae5a" : "#c25438";

  return (
    <group>
      {tool || pending ? <GridOverlay size={size} /> : null}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.22}
        onPointerMove={(e) => {
          const d = down.current;
          if (d && Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > 8) clearTimer();
          setHover(worldToCell(e.point.x, e.point.z, size));
        }}
        onPointerDown={(e) => {
          const cell = worldToCell(e.point.x, e.point.z, size);
          down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, cell };
          held.current = false;
          clearTimer();
          // долгое нажатие: поднять постройку для переноски
          timer.current = setTimeout(() => {
            timer.current = null;
            const d = down.current;
            down.current = null;
            if (!d || pending || tool) return;
            const hit = buildingAt(grid, d.cell.x, d.cell.z);
            if (hit) {
              held.current = true;
              onPickup(hit.type, hit.x, hit.z);
              return;
            }
            // на постройке пусто — может, это плита дороги
            if (roads.has(`${d.cell.x}:${d.cell.z}`)) {
              held.current = true;
              onPickup("road", d.cell.x, d.cell.z);
            }
          }, 550);
        }}
        onPointerUp={(e) => {
          clearTimer();
          const d = down.current;
          down.current = null;
          if (!d || held.current) {
            held.current = false;
            return;
          }
          if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > 8) return;
          const cell = worldToCell(e.point.x, e.point.z, size);
          if (pending) {
            if (free(cell.x, cell.z)) onTarget(cell.x, cell.z);
          } else if (tool?.kind === "place") {
            if (free(cell.x, cell.z)) onTarget(cell.x, cell.z);
          } else if (tool?.kind === "road") {
            onRoad(cell.x, cell.z, roads.has(`${cell.x}:${cell.z}`));
          }
        }}
        onPointerLeave={() => {
          clearTimer();
          down.current = null;
        }}
      >
        <planeGeometry args={[size * CELL, size * CELL]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {ghost ? (
        <group position={[ghost.wx, 0.2, ghost.wz]}>
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[viewW * CELL - 0.08, viewH * CELL - 0.08]} />
            <meshBasicMaterial color={ghostColor} transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh position-y={0.5}>
            <boxGeometry args={[viewW * CELL - 0.2, 1.0, viewH * CELL - 0.2]} />
            <meshBasicMaterial color={ghostColor} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function TownHall({ level = 1, grid }: { level?: number; grid: CourtGridLite }) {
  // клетка Ратуши — из данных: перенос долгим нажатием двигает и модель
  const at = grid.buildings.find((b) => b.type === "townhall") ?? { x: 7, z: 7 };
  const smoke = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.22 + i / 6) % 1;
      m.position.set(0.85 + Math.sin((p + i) * 5) * 0.1, 2.75 + p * 2.2, -0.75);
      m.scale.setScalar(0.5 + p * 1.6);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.4 * (1 - p);
    });
  });
  return (
    // Главное здание двора: каменный подиум с крыльцом, тёплый камень первого
    // этажа, деревянный второй, часовая башня со шпилём. Масштаб 0.8 — Ратуша
    // выше и богаче рядовых построек, но не подавляет их; растёт с уровнем.
    // Дверь и крыльцо — на восток, к воротам (круг 21).
    <group
      position={[gridToWorld(at.x, grid.size), 0.08, gridToWorld(at.z, grid.size)]}
      scale={0.8 * (1 + 0.05 * (level - 1))}
      rotation-y={Math.PI / 2}
    >
      {/* подиум и широкое крыльцо */}
      <mesh position-y={0.17} castShadow receiveShadow>
        <boxGeometry args={[2.9, 0.34, 2.9]} />
        <meshStandardMaterial color="#9a948a" roughness={0.95} flatShading />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.3 - i * 0.1, 1.56 + i * 0.22]} castShadow receiveShadow>
          <boxGeometry args={[1.3 - i * 0.12, 0.1, 0.26]} />
          <meshStandardMaterial color="#aaa396" roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* первый этаж — тёплый камень со светлыми угловыми квадрами */}
      <mesh position-y={0.95} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 2.5]} />
        <meshStandardMaterial color={C.stone} roughness={0.9} flatShading />
      </mesh>
      {[
        [-1.12, -1.12],
        [1.12, -1.12],
        [-1.12, 1.12],
        [1.12, 1.12],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.95, z!]} castShadow>
          <boxGeometry args={[0.3, 1.24, 0.3]} />
          <meshStandardMaterial color="#b8b1a2" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* фасад: дверь с золотой аркой, два окна */}
      <mesh position={[0, 0.62, 1.24]}>
        <boxGeometry args={[0.74, 1.18, 0.05]} />
        <meshStandardMaterial color="#f0c866" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.6, 1.29]} castShadow>
        <boxGeometry args={[0.58, 1.1, 0.06]} />
        <meshStandardMaterial color="#4a3320" roughness={0.9} />
      </mesh>
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 1.05, 1.26]}>
          <mesh>
            <boxGeometry args={[0.34, 0.44, 0.06]} />
            <meshStandardMaterial color={C.frame} roughness={0.85} />
          </mesh>
          <mesh position-z={0.03}>
            <boxGeometry args={[0.24, 0.34, 0.05]} />
            <meshStandardMaterial color={C.window} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* второй этаж — дерево, карниз со снегом */}
      <mesh position-y={1.92} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.86, 2.1]} />
        <meshStandardMaterial color={C.wall} roughness={0.95} flatShading />
      </mesh>
      <mesh position-y={2.4} castShadow>
        <boxGeometry args={[2.26, 0.12, 2.26]} />
        <meshStandardMaterial color={C.beam} roughness={0.9} flatShading />
      </mesh>
      <mesh position-y={2.5}>
        <boxGeometry args={[2.3, 0.07, 2.3]} />
        <meshStandardMaterial color="#fbf8f0" roughness={0.85} flatShading />
      </mesh>
      {/* окна второго этажа: золотые рамы */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 1.95, 1.08]}>
          <mesh>
            <boxGeometry args={[0.4, 0.5, 0.05]} />
            <meshStandardMaterial color="#f0c866" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position-z={0.03}>
            <boxGeometry args={[0.3, 0.4, 0.05]} />
            <meshStandardMaterial color={C.window} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* часовая башня с окном */}
      <mesh position-y={3.0} castShadow>
        <boxGeometry args={[1.15, 1.4, 1.15]} />
        <meshStandardMaterial color="#aaa396" roughness={0.9} flatShading />
      </mesh>
      <group position={[0, 3.3, 0.58]}>
        <mesh>
          <boxGeometry args={[0.34, 0.42, 0.06]} />
          <meshStandardMaterial color="#f0c866" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position-z={0.04}>
          <boxGeometry args={[0.24, 0.32, 0.05]} />
          <meshStandardMaterial color={C.window} roughness={0.5} />
        </mesh>
      </group>
      {/* уровень 2+: золотой пояс башни */}
      {level >= 2 ? (
        <mesh position-y={2.54}>
          <boxGeometry args={[1.24, 0.09, 1.24]} />
          <meshStandardMaterial color="#f0c866" metalness={0.55} roughness={0.35} flatShading />
        </mesh>
      ) : null}
      {/* шатёр: тёплая черепица, снег, золочёный шпиль */}
      <mesh position-y={4.02} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.05, 0.95, 4]} />
        <meshStandardMaterial color="#5a4434" roughness={0.85} flatShading />
      </mesh>
      <mesh position-y={4.33} rotation-y={Math.PI / 4}>
        <coneGeometry args={[0.62, 0.34, 4]} />
        <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
      </mesh>
      <mesh position-y={4.8}>
        <coneGeometry args={[0.09, 0.34, 6]} />
        <meshStandardMaterial color="#f0c866" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* уровень 3+: знамя на башне */}
      {level >= 3 ? <RoofBanner y={4.52} s={0.9} /> : null}
      {/* уровень 4+: четыре защитные башенки меняют силуэт Цитадели */}
      {level >= 4 ? (
        <group>
          {[-0.98, 0.98].flatMap((x) => [-0.98, 0.98].map((z) => (
            <group key={`${x}:${z}`}>
              <mesh position={[x, 2.82, z]} castShadow receiveShadow>
                <boxGeometry args={[0.44, 0.72, 0.44]} />
                <meshStandardMaterial color="#aaa396" roughness={0.9} flatShading />
              </mesh>
              <mesh position={[x, 3.25, z]} rotation-y={Math.PI / 4} castShadow>
                <coneGeometry args={[0.34, 0.34, 4]} />
                <meshStandardMaterial color="#5a4434" roughness={0.85} flatShading />
              </mesh>
              <mesh position={[x, 3.43, z]} rotation-y={Math.PI / 4}>
                <coneGeometry args={[0.2, 0.12, 4]} />
                <meshStandardMaterial color="#fbf8f0" roughness={0.8} flatShading />
              </mesh>
            </group>
          )))}
        </group>
      ) : null}
      {/* уровень 5: позолоченный карниз и парные штандарты завершают двор */}
      {level >= 5 ? (
        <group>
          <mesh position-y={2.64}>
            <boxGeometry args={[2.42, 0.07, 2.42]} />
            <meshStandardMaterial color="#d8ae62" metalness={0.5} roughness={0.38} flatShading />
          </mesh>
          <group position={[-0.98, 2.92, 1.12]}>
            <StageBanner x={0} z={0} scale={0.62} />
          </group>
          <group position={[0.98, 2.92, 1.12]}>
            <StageBanner x={0} z={0} scale={0.62} />
          </group>
        </group>
      ) : null}
      {/* труба с дымом */}
      <mesh position={[0.85, 2.6, -0.75]} castShadow>
        <boxGeometry args={[0.3, 0.7, 0.3]} />
        <meshStandardMaterial color={C.stone} roughness={0.9} flatShading />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => { smoke.current[i] = m; }}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color={C.smoke} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- ели и валуны инстансами ----------
function Trees() {
  const trees = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; s: number; rot: number }[] = [];
    for (let i = 0; i < 64; i++) {
      const side = Math.floor(r() * 4);
      const t = (r() * 2 - 1) * 26;
      const d = 10 + r() * 16;
      const x = side === 0 ? t : side === 1 ? d : side === 2 ? t : -d;
      const z = side === 0 ? d : side === 1 ? t : side === 2 ? -d : t;
      if (z > 7 && Math.abs(x) < 3.5) continue;
      out.push({ x, z, s: 0.8 + r() * 0.6, rot: r() * Math.PI });
    }
    return out;
  }, []);
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const c1 = useRef<THREE.InstancedMesh>(null!);
  const c2 = useRef<THREE.InstancedMesh>(null!);
  const c3 = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const put = (ref: THREE.InstancedMesh, dy: number, t: (typeof trees)[number], i: number) => {
      d.position.set(t.x, dy * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.setScalar(t.s);
      d.updateMatrix();
      ref.setMatrixAt(i, d.matrix);
    };
    trees.forEach((t, i) => {
      put(trunk.current, 0.3, t, i);
      put(c1.current, 1.1, t, i);
      put(c2.current, 1.85, t, i);
      put(c3.current, 2.5, t, i);
    });
    [trunk, c1, c2, c3].forEach((ref) => { ref.current.instanceMatrix.needsUpdate = true; });
  }, [trees]);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.6, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c1} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.0, 1.3, 7]} />
        <meshStandardMaterial color={C.fir1} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c2} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.78, 1.05, 7]} />
        <meshStandardMaterial color={C.fir2} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c3} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 0.85, 7]} />
        <meshStandardMaterial color={C.firTip} roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

// ---------- птицы: три галочки кружат над двором и машут крыльями ----------
function Birds() {
  const birds = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.current.forEach((g, i) => {
      if (!g) return;
      const w = t * (0.22 + i * 0.045) + i * 2.1; // фаза орбиты
      const R = 14 + i * 2.2;
      g.position.set(Math.cos(w) * R, 10.2 + Math.sin(t * 0.8 + i * 1.3) * 0.7, Math.sin(w) * R * 0.8);
      g.rotation.y = -w - Math.PI / 2;
      const flap = Math.sin(t * 9 + i * 1.7) * 0.22;
      const [lw, rw] = g.children as THREE.Group[];
      if (lw) lw.rotation.z = 0.3 + flap; // постоянный V: издали «галочка», не доска
      if (rw) rw.rotation.z = -0.3 - flap;
    });
  });
  // узкое стреловидное крыло: издали читается птичкой, а не доской
  const wing = (s: number) => (
    <group>
      <mesh position-x={s * 0.14} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.3, 0.11]} />
        <meshStandardMaterial color="#55483c" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
  return (
    <>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(g) => { birds.current[i] = g; }} scale={0.7}>
          {wing(1)}
          {wing(-1)}
        </group>
      ))}
    </>
  );
}

// ---------- луг: кусты и пни между ёлок ----------
function MeadowLife() {
  const items = useMemo(() => {
    const r = rng(13);
    const out: { x: number; z: number; bush: boolean; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 9 && guard++ < 80) {
      const a = r() * Math.PI * 2;
      const d = 13 + r() * 16;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d * 0.72;
      if (Math.abs(x) < 9.6 && Math.abs(z) < 9.6) continue; // не на площадке
      out.push({ x, z, bush: r() > 0.45, s: 0.7 + r() * 0.7, rot: r() * Math.PI * 2 });
    }
    return out;
  }, []);
  return (
    <group>
      {items.map((it, i) =>
        it.bush ? (
          <mesh key={i} position={[it.x, 0.16 * it.s, it.z]} rotation-y={it.rot} scale={it.s} castShadow>
            <icosahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial color="#2c4c39" roughness={0.95} flatShading />
          </mesh>
        ) : (
          <group key={i} position={[it.x, 0, it.z]} rotation-y={it.rot} scale={it.s}>
            <mesh position-y={0.12} castShadow>
              <cylinderGeometry args={[0.16, 0.2, 0.24, 7]} />
              <meshStandardMaterial color={C.trunk} roughness={0.95} flatShading />
            </mesh>
            <mesh position-y={0.245}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 7]} />
              <meshStandardMaterial color={C.frame} roughness={0.9} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

// ---------- оболочка сцены: fallback и подсказка поворота ----------
/** Сетка двора из вида: то, что отдаёт модуль court. */
export interface CourtGridLite {
  size: number;
  buildings: { type: string; x: number; z: number }[];
  roads: { x: number; z: number }[];
}

export type CourtTool = { kind: "place"; type: string } | { kind: "road" } | null;

export interface CourtPending {
  type: string;
  x: number;
  z: number;
  from?: { x: number; z: number };
}

export function CourtScene({
  texts,
  grid,
  thLevel = 1,
  tool,
  pending,
  onTarget,
  onRoad,
  onPickup,
}: {
  texts: { rotate: string; nowebgl: string };
  grid: CourtGridLite | null;
  thLevel?: number;
  tool: CourtTool;
  pending: CourtPending | null;
  onTarget: (x: number, z: number) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number) => void;
}) {
  const [webgl] = useState(webglAvailable);
  // пыль постановки: краткие веера под новыми постройками
  const [bursts, setBursts] = useState<{ key: string; x: number; z: number }[]>([]);
  const prevKeys = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!grid) return;
    const keys = new Set(grid.buildings.map((b) => `${b.type}:${b.x}:${b.z}`));
    const prev = prevKeys.current;
    prevKeys.current = keys;
    if (!prev) return; // первая загрузка — просто рисуем двор
    const added = grid.buildings.find((b) => !prev.has(`${b.type}:${b.x}:${b.z}`));
    if (!added) return;
    const [w, h] = FOOTVIEW[added.type] ?? [1, 1];
    const x = gridToWorld(added.x - Math.floor(w / 2) + (w - 1) / 2, grid.size);
    const z = gridToWorld(added.z - Math.floor(h / 2) + (h - 1) / 2, grid.size);
    setBursts((list) => [...list, { key: `${added.type}:${added.x}:${added.z}:${Date.now()}`, x, z }]);
  }, [grid]);

  if (!webgl) {
    return (
      <div style={{ position: "absolute", inset: 0, background: `url(court-fallback.jpg) center / cover no-repeat, ${C.sky}` }}>
        <div className="court-note">{texts.nowebgl}</div>
      </div>
    );
  }
  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
        }}
        // near/far сжаты ради точности depth-буфера на мобильных (круг 9)
        camera={{ fov: 40, near: 2, far: 140, position: [17, 16, 17] }}
      >
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fogFar, 42, 100]} />
        <hemisphereLight args={["#e8f0fa", "#a08a6c", 0.9]} />
        <directionalLight
          color="#ffd9a0"
          intensity={2.0}
          position={[16, 22, 8]}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <CameraRig />
        <Ground grid={grid} />
        <RoadTiles roads={grid?.roads ?? []} size={grid?.size ?? 14} />
        <Palisade />
        <Buildings grid={grid ?? { size: 14, buildings: [], roads: [] }} level={thLevel} />
        <TownHall level={thLevel} grid={grid ?? { size: 14, buildings: [], roads: [] }} />
        {bursts.map((b) => (
          <Dust key={b.key} x={b.x} z={b.z} onDone={() => setBursts((list) => list.filter((e) => e.key !== b.key))} />
        ))}
        {grid ? (
          <CourtInput grid={grid} tool={tool} pending={pending} onTarget={onTarget} onRoad={onRoad} onPickup={onPickup} />
        ) : null}
        <Trees />
        <MeadowLife />
        <Birds />
      </Canvas>
    </div>
  );
}
