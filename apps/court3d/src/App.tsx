/**
 * Круг 8 · 3D-проба сцены двора. День.
 *
 * Процедурный стилизованный low-poly двор: Ратуша, частокол с воротами, снег,
 * ели, валуны, овцы у загона, дым из трубы, флажок. Камера игровая: панорама,
 * зум, ограниченный поворот — как в живых 3D-SLG. Всё инстансируется, чтобы
 * уложиться в слабые телефоны Telegram Mini App.
 *
 * Это проба для сравнения с 2D-прототипом круга 7 (docs/game/ui/court/),
 * а не финальная сцена: числа и модуль двора придут из шага 4.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ---------- параметры сцены ----------
const PLOT = 7.7; // половина площадки (14 клеток по 1.1)
const GATE_HALF = 1.5; // полуширина проезда ворот

/** Детерминированный генератор, чтобы раскладка была одинаковой между кадрами. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- камера ----------
type CamPreset = { target: [number, number, number]; az: number; pol: number; dist: number };
const PRESETS: Record<string, CamPreset> = {
  overview: { target: [0, 0, 0], az: Math.PI / 4, pol: 0.98, dist: 27 },
  near: { target: [0, 1.0, 0.5], az: Math.PI / 4, pol: 1.06, dist: 13.5 },
  gate: { target: [0, 0.4, 6.2], az: Math.PI / 4 + 0.4, pol: 1.16, dist: 11 },
};

function CameraRig() {
  const { camera, gl } = useThree();
  const preset = useMemo(() => {
    const name = new URLSearchParams(location.search).get("cam") ?? "overview";
    return PRESETS[name] ?? PRESETS.overview!;
  }, []);
  const st = useRef({
    target: new THREE.Vector3(...preset.target),
    az: preset.az,
    pol: preset.pol,
    dist: preset.dist,
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = st.current;
      if (pointers.current.size === 2) {
        // щипок: зум
        const [a, b] = [...pointers.current.values()];
        if (a && b) {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const last = (el as unknown as { pinch?: number }).pinch;
          if (last) s.dist = THREE.MathUtils.clamp(s.dist * (last / d), 9, 40);
          (el as unknown as { pinch?: number }).pinch = d;
        }
        return;
      }
      if (e.buttons & 2 || e.shiftKey) {
        s.az = THREE.MathUtils.clamp(s.az + dx * 0.005, Math.PI / 4 - 0.7, Math.PI / 4 + 0.7);
        s.pol = THREE.MathUtils.clamp(s.pol + dy * 0.004, 0.78, 1.25);
      } else {
        const k = s.dist * 0.0016;
        const fwd = new THREE.Vector3(-Math.sin(s.az), 0, -Math.cos(s.az));
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        s.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
        s.target.x = THREE.MathUtils.clamp(s.target.x, -6, 6);
        s.target.z = THREE.MathUtils.clamp(s.target.z, -6, 6);
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      (el as unknown as { pinch?: number }).pinch = undefined;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = st.current;
      s.dist = THREE.MathUtils.clamp(s.dist * (1 + e.deltaY * 0.0012), 9, 40);
    };
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", ctx);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", ctx);
    };
  }, [gl]);

  useFrame(() => {
    const s = st.current;
    const sp = Math.sin(s.pol), cp = Math.cos(s.pol);
    camera.position.set(
      s.target.x + s.dist * sp * Math.sin(s.az),
      s.target.y + s.dist * cp,
      s.target.z + s.dist * sp * Math.cos(s.az),
    );
    camera.lookAt(s.target);
  });
  return null;
}

// ---------- земля ----------
function Ground() {
  const patches = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 26 }, () => ({
      x: (r() * 2 - 1) * (PLOT - 1),
      z: (r() * 2 - 1) * (PLOT - 1),
      s: 0.5 + r() * 1.4,
      rot: r() * Math.PI,
    }));
  }, []);
  return (
    <group>
      {/* снег снаружи */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#f2f7ff" roughness={1} />
      </mesh>
      {/* земля площадки */}
      <mesh position-y={0.0} receiveShadow castShadow>
        <boxGeometry args={[PLOT * 2 + 0.4, 0.16, PLOT * 2 + 0.4]} />
        <meshStandardMaterial color="#7d5f43" roughness={1} />
      </mesh>
      {/* тропинки крестом */}
      <mesh position-y={0.09} receiveShadow>
        <boxGeometry args={[1.0, 0.05, PLOT * 2 - 0.2]} />
        <meshStandardMaterial color="#a5825a" roughness={1} />
      </mesh>
      <mesh position-y={0.09} receiveShadow>
        <boxGeometry args={[PLOT * 2 - 0.2, 0.05, 1.0]} />
        <meshStandardMaterial color="#a5825a" roughness={1} />
      </mesh>
      {/* снежные заплески на площадке */}
      {patches.map((p, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} rotation-z={p.rot} position={[p.x, 0.115, p.z]} receiveShadow>
          <circleGeometry args={[p.s, 10]} />
          <meshStandardMaterial color="#e9f1fc" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- частокол с воротами ----------
function Palisade() {
  const logs = useMemo(() => {
    const r = rng(11);
    const pts: { x: number; z: number; h: number; tilt: number }[] = [];
    const step = 0.5;
    const side = (fixed: "x" | "z", gate: boolean) => {
      for (let t = -PLOT; t <= PLOT + 0.001; t += step) {
        if (gate && Math.abs(t) < GATE_HALF) continue;
        const j = () => (r() * 2 - 1);
        if (fixed === "z") pts.push({ x: t, z: PLOT, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
        else pts.push({ x: PLOT, z: t, h: 0.8 + j() * 0.08, tilt: j() * 0.04 });
      }
    };
    side("z", true); // юг с воротами
    side("z", false); // север
    side("x", false); // восток
    for (let t = -PLOT + step; t <= PLOT - step; t += step) {
      const j = () => (r() * 2 - 1);
      pts.push({ x: -PLOT, z: t, h: 0.8 + j() * 0.08, tilt: j() * 0.04 }); // запад
    }
    return pts;
  }, []);
  const body = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    logs.forEach((p, i) => {
      d.position.set(p.x, 0.08 + p.h / 2, p.z);
      d.rotation.set(p.tilt, 0, p.tilt);
      d.scale.setScalar(1);
      d.updateMatrix();
      body.current.setMatrixAt(i, d.matrix);
      d.position.y = 0.08 + p.h + 0.08;
      d.updateMatrix();
      caps.current.setMatrixAt(i, d.matrix);
    });
    body.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
  }, [logs]);
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, logs.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.115, 0.8, 6]} />
        <meshStandardMaterial color="#6a4a30" roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, logs.length]} castShadow>
        <coneGeometry args={[0.115, 0.2, 6]} />
        <meshStandardMaterial color="#7d5a3a" roughness={0.95} flatShading />
      </instancedMesh>
      {/* ворота: столбы, перекладина, знамя */}
      {[-GATE_HALF, GATE_HALF].map((x) => (
        <mesh key={x} position={[x, 0.88, PLOT]} castShadow>
          <cylinderGeometry args={[0.13, 0.17, 1.7, 7]} />
          <meshStandardMaterial color="#5d4229" roughness={0.95} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.66, PLOT]} castShadow>
        <boxGeometry args={[GATE_HALF * 2 + 0.5, 0.22, 0.22]} />
        <meshStandardMaterial color="#5d4229" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.32, PLOT + 0.2]} castShadow>
        <planeGeometry args={[0.8, 0.55]} />
        <meshStandardMaterial color="#d9c9a6" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------- Ратуша ----------
function TownHall() {
  const flag = useRef<THREE.Mesh>(null!);
  const smoke = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // флажок полощется
    const g = flag.current.geometry as THREE.PlaneGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 6 + t * 7) * 0.05 * (x + 0.45));
    }
    pos.needsUpdate = true;
    // дым поднимается и тает
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.22 + i / 6) % 1;
      m.position.set(0.85 + Math.sin((p + i) * 5) * 0.12, 3.1 + p * 2.4, -0.7);
      m.scale.setScalar(0.5 + p * 1.6);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.4 * (1 - p);
    });
  });
  return (
    <group position={[0, 0.08, 0]}>
      {/* каменное основание */}
      <mesh position-y={0.35} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.7, 3.0]} />
        <meshStandardMaterial color="#9aa2ac" roughness={0.9} flatShading />
      </mesh>
      {/* сруб */}
      <mesh position-y={1.4} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.4, 2.5]} />
        <meshStandardMaterial color="#7b5a3a" roughness={0.95} flatShading />
      </mesh>
      {/* угловые балки */}
      {[[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].map(([x, z], i) => (
        <mesh key={i} position={[x!, 1.4, z!]} castShadow>
          <boxGeometry args={[0.18, 1.45, 0.18]} />
          <meshStandardMaterial color="#4a3524" roughness={0.95} />
        </mesh>
      ))}
      {/* дверь */}
      <mesh position={[0, 0.62, 1.52]} castShadow>
        <boxGeometry args={[0.72, 1.05, 0.12]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.95} />
      </mesh>
      {/* снежная крыша */}
      <mesh position-y={2.85} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[2.25, 1.5, 4]} />
        <meshStandardMaterial color="#f6fbff" roughness={0.85} flatShading />
      </mesh>
      {/* труба и дым */}
      <mesh position={[0.85, 3.0, -0.7]} castShadow>
        <boxGeometry args={[0.36, 0.9, 0.36]} />
        <meshStandardMaterial color="#8b939d" roughness={0.9} flatShading />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { smoke.current[i] = m; }}
        >
          <sphereGeometry args={[0.17, 8, 8]} />
          <meshStandardMaterial color="#e8edf3" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      {/* флажок */}
      <mesh position={[-1.05, 3.9, 1.05]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 5]} />
        <meshStandardMaterial color="#4a3524" roughness={0.95} />
      </mesh>
      <mesh ref={flag} position={[-0.6, 4.4, 1.05]}>
        <planeGeometry args={[0.9, 0.5, 8, 1]} />
        <meshStandardMaterial color="#b3402f" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------- ели, валуны, овцы ----------
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
      if (z > 7 && Math.abs(x) < 3.5) continue; // дорога к воротам
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
    const set = (ref: THREE.InstancedMesh, dy: number) => (t: { x: number; z: number; s: number; rot: number }, i: number) => {
      d.position.set(t.x, dy * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.setScalar(t.s);
      d.updateMatrix();
      ref.setMatrixAt(i, d.matrix);
    };
    trees.forEach((t, i) => {
      set(trunk.current, 0.3)(t, i);
      set(c1.current, 1.1)(t, i);
      set(c2.current, 1.85)(t, i);
      set(c3.current, 2.5)(t, i);
    });
    [trunk, c1, c2, c3].forEach((ref) => { ref.current.instanceMatrix.needsUpdate = true; });
  }, [trees]);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.6, 6]} />
        <meshStandardMaterial color="#5d4530" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c1} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.0, 1.3, 7]} />
        <meshStandardMaterial color="#2e5540" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c2} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.78, 1.05, 7]} />
        <meshStandardMaterial color="#35604a" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={c3} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 0.85, 7]} />
        <meshStandardMaterial color="#e9f3fa" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

function Rocks() {
  const rocks = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 12 }, () => {
      const inside = r() < 0.4;
      const d = inside ? 6.5 + r() * 1.5 : 9 + r() * 12;
      const a = r() * Math.PI * 2;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.3 + r() * 0.6, rot: r() * Math.PI };
    });
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    rocks.forEach((p, i) => {
      d.position.set(p.x, 0.12 + p.s * 0.35, p.z);
      d.rotation.set(p.rot, p.rot * 2, 0);
      d.scale.set(p.s, p.s * 0.8, p.s);
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#b3bac4" roughness={0.95} flatShading />
    </instancedMesh>
  );
}

function Sheep({ position }: { position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null!);
  const phase = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    g.current.position.y = position[1] + Math.abs(Math.sin(clock.elapsedTime * 1.3 + phase)) * 0.02;
    g.current.rotation.y = Math.sin(clock.elapsedTime * 0.25 + phase) * 0.4;
  });
  return (
    <group ref={g} position={position}>
      <mesh position-y={0.24} castShadow>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial color="#f1ead9" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0.26]} castShadow>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#2c2622" roughness={1} />
      </mesh>
      {[[-0.12, 0.14], [0.12, 0.14], [-0.12, -0.14], [0.12, -0.14]].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.07, z!]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 5]} />
          <meshStandardMaterial color="#2c2622" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- приложение ----------
export function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          // киношный тонмаппинг: цвета богаче, снег не «серит»
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
        }}
        camera={{ fov: 40, near: 0.5, far: 220, position: [19, 17, 19] }}
      >
        <color attach="background" args={["#aecde8"]} />
        <fog attach="fog" args={["#aecde8", 48, 110]} />
        <hemisphereLight args={["#dfeeff", "#8d7f6a", 0.9]} />
        <directionalLight
          color="#ffdf9e"
          intensity={1.8}
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
        <Ground />
        <Palisade />
        <TownHall />
        <Trees />
        <Rocks />
        <Sheep position={[3.2, 0.08, 3.4]} />
        <Sheep position={[4.3, 0.08, 2.6]} />
        <Sheep position={[2.6, 0.08, 4.6]} />
      </Canvas>
      <div className="hud">
        <div className="plate">
          <b>Круг 8 · 3D-проба — двор, день</b>
          Процедурный стилизованный 3D: Ратуша, частокол с воротами, снег и ели. Камера живая, как в RoK.
        </div>
        <div className="hint">палец / левая кнопка — панорама · колесо / щипок — зум · правая кнопка / Shift — поворот</div>
      </div>
    </div>
  );
}
