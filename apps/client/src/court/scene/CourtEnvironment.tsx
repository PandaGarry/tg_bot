/**
 * Статическое и живое окружение двора: земля со снегом и сугробами, гравийная
 * дорожка, ворота, частокол, ёлки, луг и птицы.
 *
 * Исправления Slice B1 без изменения визуала:
 * - удалены захардкоженные + 6.5 в Ground: клетка вычисляется из grid.size
 *   через worldToCell(x, z, gridSize);
 * - 26 ShapeGeometry снежных пятен очищаются на размонтировании (с безопасным
 *   пересозданием при двойном монтировании в React StrictMode).
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LanternFlame } from "../buildings/legacy/LegacyBuildings.js";
import { COURT_MATERIALS, getRoadPebbleMaterialSpec } from "../materials/MaterialRegistry.js";
import { ACCENT_COLORS, C } from "../materials/palette.js";
import { footprintKeys, gridToWorld, worldToCell, type CourtGridLite } from "./gridMath.js";

const PLOT = 7.7; // половина площадки (14 клеток по 1.1)
const GATE_HALF = 1.5;

/** Детерминированный генератор: раскладка одинакова между кадрами и устройствами. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SnowPatch {
  x: number;
  z: number;
  rot: number;
  geom: THREE.ShapeGeometry;
}

function createSnowPatches(): SnowPatch[] {
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
}

function disposeSnowPatches(patches: readonly SnowPatch[]): void {
  for (const patch of patches) {
    patch.geom.userData.__tdlDisposed = true;
    patch.geom.dispose();
  }
}

// ---------- земля ----------
// Высоты слоёв разведены с запасом (земля 0.08 → тропа 0.105 → снег 0.14),
// иначе на телефонах с мелким depth-буфером снег «мигает» (z-fighting, круг 9).
export function Ground({ grid }: { grid: CourtGridLite | null }) {
  const [patches, setPatches] = useState<SnowPatch[]>(() => createSnowPatches());

  useEffect(() => {
    let active = patches;
    if (active.some((patch) => patch.geom.userData.__tdlDisposed)) {
      active = createSnowPatches();
      setPatches(active);
    }
    return () => {
      disposeSnowPatches(active);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gridSize = grid?.size ?? 14;
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
      const { x: cx, z: cz } = worldToCell(x, z, gridSize);
      if (roads.some((road) => road.x === cx && road.z === cz)) continue;
      if (occupied.has(`${cx}:${cz}`)) continue;
      out.push({ x, z, s: 0.7 + r() * 1.1, rot: r() * Math.PI });
    }
    return out;
  }, [roads, occupied, gridSize]);

  const debris = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; kind: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 64 && guard++ < 400) {
      const x = (r() * 2 - 1) * (PLOT - 0.5);
      const z = (r() * 2 - 1) * (PLOT - 0.5);
      const { x: cx, z: cz } = worldToCell(x, z, gridSize);
      if (roads.some((road) => road.x === cx && road.z === cz)) continue;
      if (occupied.has(`${cx}:${cz}`)) continue;
      out.push({ x, z, kind: r() > 0.55 ? 1 : 0, s: 0.04 + r() * 0.06, rot: r() * Math.PI });
    }
    return out;
  }, [roads, occupied, gridSize]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial {...COURT_MATERIALS.snowOuter} />
      </mesh>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[PLOT * 2 + 0.4, 0.16, PLOT * 2 + 0.4]} />
        <meshStandardMaterial {...COURT_MATERIALS.dirt} />
      </mesh>
      {patches.map((p, i) => (
        <mesh key={i} geometry={p.geom} rotation-x={-Math.PI / 2} rotation-z={p.rot} position={[p.x, 0.14, p.z]} receiveShadow>
          {/* двухтонный снег: пятна чуть различаются оттенком — фактура вместо плоскости */}
          <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.snowPatchLight : COURT_MATERIALS.snowPatchAlt)} />
        </mesh>
      ))}
      {/* сугробы-валики у края площадки */}
      {drifts.map((d, i) => (
        <mesh key={`d${i}`} position={[d.x, 0.1, d.z]} rotation-y={d.rot} scale={[d.s, 0.3, d.s * 0.7]} castShadow receiveShadow>
          <sphereGeometry args={[0.8, 10, 8]} />
          <meshStandardMaterial {...COURT_MATERIALS.snowDrift} />
        </mesh>
      ))}
      {/* мелкая фактура земли: камешки и жухлая трава — площадка не «пластиковая» */}
      {debris.map((d, i) =>
        d.kind === 0 ? (
          <mesh key={`st${i}`} position={[d.x, 0.11, d.z]} rotation-y={d.rot} castShadow>
            <dodecahedronGeometry args={[d.s, 0]} />
            <meshStandardMaterial {...(i % 3 ? COURT_MATERIALS.pebbleMuted : COURT_MATERIALS.pebbleWarm)} />
          </mesh>
        ) : (
          <mesh key={`gr${i}`} position={[d.x, 0.16, d.z]} rotation-y={d.rot}>
            <coneGeometry args={[d.s * 0.6, d.s * 3.2, 5]} />
            <meshStandardMaterial {...COURT_MATERIALS.grassDry} />
          </mesh>
        ),
      )}
    </group>
  );
}

/**
 * Гравийная дорога: плита на клетку — тёмное основание и россыпь мелких
 * камешков (детерминированно по клетке). Дорога — данные игрока: кладётся
 * и убирается тапом (команда court.road), узор складывается сам.
 */
export function RoadTiles({ roads, size }: { roads: { x: number; z: number }[]; size: number }) {
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
          c: ACCENT_COLORS.roadPebbles[Math.floor(r() * 5) % 5]!,
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
            <meshStandardMaterial {...COURT_MATERIALS.roadWear} />
          </mesh>
          <mesh position-y={0.162} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[1.06, 1.06]} />
            <meshStandardMaterial {...COURT_MATERIALS.roadBed} />
          </mesh>
          {tile.sand.map((s, i) => (
            <mesh key={`sa${i}`} position={[s.dx, 0.168, s.dz]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[s.s, 6]} />
              <meshStandardMaterial {...COURT_MATERIALS.roadSand} />
            </mesh>
          ))}
          {tile.stones.map((st, i) => (
            <mesh key={`s${i}`} position={[st.dx, st.y, st.dz]} rotation-y={st.rot} castShadow>
              <dodecahedronGeometry args={[st.s, 0]} />
              <meshStandardMaterial {...getRoadPebbleMaterialSpec(st.c)} />
            </mesh>
          ))}
          {tile.cobbles.map((cb, i) => (
            <mesh key={`c${i}`} position={[cb.dx, 0.19, cb.dz]} rotation-y={cb.rot} castShadow receiveShadow>
              <cylinderGeometry args={[cb.s, cb.s * 1.12, 0.035, 7]} />
              <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.roadCobbleLight : COURT_MATERIALS.roadCobbleDark)} />
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
            <meshStandardMaterial {...COURT_MATERIALS.gateBody} />
          </mesh>
          <mesh position-y={2.34} castShadow>
            <boxGeometry args={[0.74, 0.1, 0.74]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateTipFlat} />
          </mesh>
          <mesh position={[0.34, 1.45, 0]} castShadow>
            <boxGeometry args={[0.06, 0.34, 0.16]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateSlit} />
          </mesh>
          <mesh position-y={2.78} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.56, 0.56, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateRoof} />
          </mesh>
          <mesh position-y={3.1} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.26, 0.18, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.snowCap} />
          </mesh>
        </group>
      ))}
      {/* створы распахнуты к башням: полотно на петле, проход по центру свободен */}
      {[-1, 1].map((s) => (
        <group key={`leaf${s}`} position={[7.66, 0, s * 1.3]} rotation-y={s * 1.4}>
          <mesh position={[0, 0.82, s * 0.65]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 1.6, 1.3]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateLeaf} />
          </mesh>
          {[0.22, 1.08].map((z) => (
            <mesh key={z} position={[0.035, 0.82, s * (0.65 - z)]} castShadow>
              <boxGeometry args={[0.07, 1.66, 0.11]} />
              <meshStandardMaterial {...COURT_MATERIALS.gateBeam} />
            </mesh>
          ))}
          <mesh position={[0.08, 1.06, s * 0.65]} rotation-y={Math.PI / 2}>
            <boxGeometry args={[0.02, 0.09, 1.24]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateStrap} />
          </mesh>
          <mesh position={[0.1, 0.86, s * 0.62]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.08, 0.02, 6, 14]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateRing} />
          </mesh>
        </group>
      ))}
      {/* перемычка между башнями и ступенчатый фронтон: над проездом не нависает */}
      <mesh position={[7.7, 2.52, 0]} castShadow>
        <boxGeometry args={[0.72, 0.26, 2.68]} />
        <meshStandardMaterial {...COURT_MATERIALS.gateTip} />
      </mesh>
      <mesh position={[7.7, 2.78, 0]} castShadow>
        <boxGeometry args={[0.66, 0.24, 2.6]} />
        <meshStandardMaterial {...COURT_MATERIALS.gateBody} />
      </mesh>
      <mesh position={[7.7, 3.02, 0]} castShadow>
        <boxGeometry args={[0.56, 0.22, 2.2]} />
        <meshStandardMaterial {...COURT_MATERIALS.gateBody} />
      </mesh>
      <mesh position={[7.7, 3.24, 0]} castShadow>
        <boxGeometry args={[0.44, 0.2, 1.8]} />
        <meshStandardMaterial {...COURT_MATERIALS.gateTipFlat} />
      </mesh>
      <mesh position={[7.7, 3.36, 0]}>
        <boxGeometry args={[0.3, 0.06, 1.66]} />
        <meshStandardMaterial {...COURT_MATERIALS.snowCap} />
      </mesh>
      {/* фонарь под перемычкой — тёплая точка у входа */}
      <group position={[7.4, 0, 0]}>
        <mesh position={[0.09, 2.34, 0]}>
          <boxGeometry args={[0.18, 0.05, 0.05]} />
          <meshStandardMaterial {...COURT_MATERIALS.gateBeam} />
        </mesh>
        <LanternFlame y={2.2} />
        <mesh position-y={2.36}>
          <coneGeometry args={[0.13, 0.1, 4]} />
          <meshStandardMaterial {...COURT_MATERIALS.gateBeamFlat} />
        </mesh>
      </group>
    </group>
  );
}

export function Palisade() {
  const logs = useMemo(() => {
    const r = rng(11);
    const pts: { x: number; z: number; h: number; tilt: number }[] = [];
    const step = 0.5;
    const j = () => r() * 2 - 1;
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
        <meshStandardMaterial {...COURT_MATERIALS.palisadeBody} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, logs.length]} castShadow>
        <coneGeometry args={[0.115, 0.2, 6]} />
        <meshStandardMaterial {...COURT_MATERIALS.palisadeCap} />
      </instancedMesh>
      {/* горизонтальные прожилины: ограда читается частоколом, а не частыми гвоздями */}
      {[-PLOT, PLOT].map((edge) => (
        <group key={`rail${edge}`}>
          {[0.32, 0.56].map((h) => (
            <mesh key={h} position={[0, h, edge]} castShadow>
              <boxGeometry args={[PLOT * 2, 0.05, 0.07]} />
              <meshStandardMaterial {...COURT_MATERIALS.palisadeRail} />
            </mesh>
          ))}
          {[0.32, 0.56].map((h) => (
            <mesh key={`z${h}`} position={[edge, h, 0]} castShadow>
              <boxGeometry args={[0.07, 0.05, PLOT * 2]} />
              <meshStandardMaterial {...COURT_MATERIALS.palisadeRail} />
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
            <meshStandardMaterial {...COURT_MATERIALS.gateBody} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, 0.5, -s * 0.16]} castShadow>
              <cylinderGeometry args={[0.085, 0.1, 0.9, 6]} />
              <meshStandardMaterial {...COURT_MATERIALS.gateTipFlat} />
            </mesh>
          ))}
          <mesh position-y={1.28} castShadow>
            <coneGeometry args={[0.18, 0.26, 7]} />
            <meshStandardMaterial {...COURT_MATERIALS.snowCap} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- ели и валуны инстансами ----------
export function Trees() {
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
        <meshStandardMaterial {...COURT_MATERIALS.treeTrunk} />
      </instancedMesh>
      <instancedMesh ref={c1} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.0, 1.3, 7]} />
        <meshStandardMaterial {...COURT_MATERIALS.treeFir1} />
      </instancedMesh>
      <instancedMesh ref={c2} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.78, 1.05, 7]} />
        <meshStandardMaterial {...COURT_MATERIALS.treeFir2} />
      </instancedMesh>
      <instancedMesh ref={c3} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 0.85, 7]} />
        <meshStandardMaterial {...COURT_MATERIALS.treeFirTip} />
      </instancedMesh>
    </group>
  );
}

// ---------- птицы: три галочки кружат над двором и машут крыльями ----------
export function Birds() {
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
        <meshStandardMaterial {...COURT_MATERIALS.birdWing} />
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
export function MeadowLife() {
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
            <meshStandardMaterial {...COURT_MATERIALS.meadowBush} />
          </mesh>
        ) : (
          <group key={i} position={[it.x, 0, it.z]} rotation-y={it.rot} scale={it.s}>
            <mesh position-y={0.12} castShadow>
              <cylinderGeometry args={[0.16, 0.2, 0.24, 7]} />
              <meshStandardMaterial {...COURT_MATERIALS.meadowStump} />
            </mesh>
            <mesh position-y={0.245}>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 7]} />
              <meshStandardMaterial {...COURT_MATERIALS.meadowStumpTop} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

export function CourtEnvironment({ grid }: { grid: CourtGridLite | null }) {
  return (
    <>
      <Ground grid={grid} />
      <RoadTiles roads={grid?.roads ?? []} size={grid?.size ?? 14} />
      <Palisade />
      <Trees />
      <MeadowLife />
      <Birds />
    </>
  );
}
