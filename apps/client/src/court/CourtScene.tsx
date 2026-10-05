/**
 * Сцена двора в клиенте (этап A, направление B — живой 3D).
 *
 * Тёплый low-poly в палитре Bone-Wood №05: Цитадель, частокол с воротами,
 * снег, ели, овцы, дым, флажок. Камера игровая: пан, зум, свободный поворот
 * с ограничениями. Инстансинг и предел dpr — под слабые телефоны.
 * Без WebGL — запасной кадр и подсказка (решение круга 8).
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { getSkin } from "./skin/index.js";
import { C, CELL, SURFACE, LanternFlame, rng } from "./skin/kit.js";
import { centerOfBuilding, footprintKeys, gridToWorld, type CourtGridLite, type CourtPending, type CourtSelection, type CourtTool } from "./grid.js";
import { YardInput, type CamState } from "./touch/YardInput.js";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---------- камера: плавное догоняние желаемого состояния ----------
// Желаемое состояние меняют жесты (`touch/YardInput.tsx`), текущее догоняет его с демпфированием —
// камера идёт плавно, без «кадрового» ощущения (замечание заказчика, круг 9).
function CameraRig({ want }: { want: MutableRefObject<CamState> }) {
  const { camera } = useThree();
  const cur = useRef({ target: new THREE.Vector3(0, 0, 0), az: Math.PI / 4, pol: 0.98, dist: 24 });
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

// ---------- Цитадель: основание, сруб, крыша, окна, крыльцо, труба, дым, флажок ----------
/** Знамя на крыше Цитадели (уровень 3+): волнуется тем же ветром, что на воротах. */
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
        <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
        <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
          <meshStandardMaterial color="#554637" metalness={0.45} roughness={0.48} />
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
          <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Фонарь: тёплый свет чуть дышит. */

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
          <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.95} />
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
      <meshStandardMaterial color="#fbf8f0" map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.94} flatShading />
    </mesh>
  );
}

function BuildingBody({ type }: { type: string }) {
  switch (type) {
    // жилой дом 2×2: каменный цоколь, фахверк, пирамидальная крыша, труба с дымом
    case "cottage":
      return (
        <group>
          <Pad />
          <mesh position-y={0.18} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.2, 1.5]} />
            <meshStandardMaterial color={C.stone} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.024} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={0.67} castShadow receiveShadow>
            <boxGeometry args={[1.36, 0.78, 1.36]} />
            <meshStandardMaterial color={C.wall} map={SURFACE.soil.color} bumpMap={SURFACE.soil.bump} bumpScale={0.028} roughness={0.95} flatShading />
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
            <meshStandardMaterial color={C.roof} map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.85} flatShading />
          </mesh>
          <RoofSnow y={1.72} r={0.5} />
          <mesh position={[0.52, 1.15, -0.3]} castShadow>
            <boxGeometry args={[0.2, 0.6, 0.2]} />
            <meshStandardMaterial color={C.stone} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.024} roughness={0.95} flatShading />
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
              <meshStandardMaterial color={i % 2 ? C.log : C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.9} flatShading />
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
              <meshStandardMaterial color={C.wall} map={SURFACE.soil.color} bumpMap={SURFACE.soil.bump} bumpScale={0.028} roughness={0.95} flatShading />
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
              <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} />
            </mesh>
          ))}
          <mesh position={[0, 0.24, 0.9]}>
            <boxGeometry args={[1.66, 0.03, 0.035]} />
            <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} />
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
              <meshStandardMaterial color={C.wall} map={SURFACE.soil.color} bumpMap={SURFACE.soil.bump} bumpScale={0.028} roughness={0.95} flatShading />
            </mesh>
            <CornerBeams y={0.39} size={1.07} hgt={0.68} />
            <mesh position-y={0.99} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.92, 0.42, 4]} />
              <meshStandardMaterial color={C.roof} map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.85} flatShading />
            </mesh>
            <RoofSnow y={1.24} r={0.4} />
          </group>
          <SawBlade x={0.28} y={0.52} z={0.14} />
          {/* штабель: три внизу, две сверху */}
          {[0, 1, 2].map((i) => (
            <mesh key={`l${i}`} position={[0.62, 0.1, -0.18 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial color={i % 2 ? C.log : C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.9} flatShading />
            </mesh>
          ))}
          {[0, 1].map((i) => (
            <mesh key={`t${i}`} position={[0.62, 0.26, -0.08 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial color={C.log} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
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
            <meshStandardMaterial color={C.rock} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.03} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.02, 0.17, 0.12]} rotation-y={1.9} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial color="#a8a091" roughness={1} flatShading />
          </mesh>
          {/* деревянные вороты: нога, перекладина, верёвка, бадья */}
          <mesh position={[0.42, 0.4, 0.5]} rotation-z={0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0.68, 0.4, 0.5]} rotation-z={-0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0.55, 0.8, 0.5]} castShadow>
            <boxGeometry args={[0.36, 0.05, 0.05]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0.2, 0.26, 0.62]} castShadow>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.55, 0.62]} castShadow>
            <boxGeometry args={[0.6, 0.09, 0.09]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
              <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
            </mesh>
            {[[-0.1, -0.07], [0.1, -0.07], [-0.1, 0.07], [0.1, 0.07]].map(([wx, wz], i) => (
              <mesh key={i} position={[wx!, -0.09, wz!]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
                <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
            <meshStandardMaterial color={C.wall} map={SURFACE.soil.color} bumpMap={SURFACE.soil.bump} bumpScale={0.028} roughness={0.95} flatShading />
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
              <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
            <meshStandardMaterial color={C.stone} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.024} roughness={0.95} flatShading />
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
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0.3, 0.5, 0]} rotation-z={-0.34} castShadow>
            <boxGeometry args={[0.06, 1.0, 0.06]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.56, 8]} />
            <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0.32, 0.86, 0.07]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, 0.14, 6]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.34, 5]} />
            <meshStandardMaterial color="#4a3320" roughness={1} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.13, 0.12, 0.13]} />
            <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={1.24} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.62, 0.36, 4]} />
            <meshStandardMaterial color={C.roof} map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.85} flatShading />
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
            <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
          </mesh>
          <mesh position={[0, 0.47, -0.15]} rotation-x={-0.12} castShadow>
            <boxGeometry args={[1.0, 0.28, 0.05]} />
            <meshStandardMaterial color={C.logTip} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
          </mesh>
          {[-0.46, 0.46].map((bx) => (
            <group key={bx} position={[bx, 0, 0]}>
              <mesh position-y={0.14} castShadow>
                <boxGeometry args={[0.06, 0.28, 0.3]} />
                <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
              </mesh>
              <mesh position-y={0.42} castShadow>
                <boxGeometry args={[0.06, 0.05, 0.3]} />
                <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
            <meshStandardMaterial color={C.stone} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.024} roughness={0.95} flatShading />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2 + 0.5) * 0.26, 0.05, Math.sin((i / 3) * Math.PI * 2 + 0.5) * 0.26]} rotation-y={i} castShadow>
              <dodecahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial color="#8f8878" roughness={1} flatShading />
            </mesh>
          ))}
          <mesh position-y={0.47} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.74, 6]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
          </mesh>
          <LanternFlame y={0.95} />
          <mesh position-y={1.12}>
            <coneGeometry args={[0.15, 0.12, 4]} />
            <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} flatShading />
          </mesh>
        </group>
      );
    // знамя 1×1: каменный постамент и полотнище
    case "flag":
      return (
        <group>
          <mesh position-y={0.05} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.19, 0.1, 8]} />
            <meshStandardMaterial color={C.stone} map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.024} roughness={0.95} flatShading />
          </mesh>
          <RoofBannerSmall />
        </group>
      );
    default:
      return null;
  }
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
        <meshStandardMaterial color={C.beam} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.014} roughness={0.9} />
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
function Buildings({ grid, carried }: { grid: CourtGridLite; carried?: { x: number; z: number; type: string } | null }) {
  return (
    <>
      {grid.buildings.map((b) => {
        if (b.type === "townhall") return null; // Цитадель — отдельная живая модель
        // поднятая постройка едет в руках игрока (призрак с моделью), на старом месте её нет
        if (carried && carried.type === b.type && carried.x === b.x && carried.z === b.z) return null;
        const { wx, wz } = centerOfBuilding(b, grid.size);
        return (
          <Popped key={`${b.type}:${b.x}:${b.z}`} x={wx} z={wz}>
            {/* модель нарисована входом на восток; поворот — четверти оборота по часовой стрелке */}
            <group rotation-y={(-(b.rot ?? 0) * Math.PI) / 2}>
              <BuildingBody type={b.type} />
            </group>
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

/**
 * Центральное здание двора — Цитадель из скина. Клетка берётся из данных (перенос долгим
 * нажатием двигает и модель), вход смотрит на восток, к воротам. Размер на земле всегда 3×3.
 * В dev-сборке уровень можно подменить через `window.__citadelLevel` — так снимаются все стадии.
 */
function CitadelSlot({ skin, level, grid, carried }: { skin: ReturnType<typeof getSkin>; level: number; grid: CourtGridLite; carried: boolean }) {
  const at = grid.buildings.find((b) => b.type === "townhall") ?? { type: "townhall", x: 7, z: 7, rot: 0 };
  const [override, setOverride] = useState<number | null>(null);
  const [upgrade, setUpgrade] = useState<{ startedAt: number; endsAt: number } | null>(null);
  useFrame(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __citadelLevel?: number; __citadelUpgrade?: { startedAt: number; endsAt: number } | null };
    const next = typeof w.__citadelLevel === "number" ? w.__citadelLevel : null;
    if (next !== override) setOverride(next);
    const up = w.__citadelUpgrade ?? null;
    if (up !== upgrade) setUpgrade(up);
  });
  if (carried) return null; // Цитадель в руках игрока: показывается призраком
  return (
    <group position={[gridToWorld(at.x, grid.size), 0.08, gridToWorld(at.z, grid.size)]} rotation-y={(-(at.rot ?? 0) * Math.PI) / 2}>
      <skin.Citadel level={override ?? level} upgrade={upgrade} />
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
export type { CourtGridLite, CourtPending, CourtSelection, CourtTool } from "./grid.js";

export function CourtScene({
  texts,
  grid,
  thLevel = 1,
  gateLevel = 1,
  skinId,
  tool,
  pending,
  selected,
  onTarget,
  onValid,
  onRoad,
  onPickup,
  onSelect,
  onCancelPickup,
}: {
  texts: { rotate: string; nowebgl: string };
  grid: CourtGridLite | null;
  thLevel?: number;
  /** Уровень ворот: ядро хранит число, вид выбирает скин. */
  gateLevel?: number;
  /** Идентификатор скина двора; неизвестный откатывается на базовый. */
  skinId?: string | null;
  tool: CourtTool;
  pending: CourtPending | null;
  selected: CourtSelection | null;
  onTarget: (x: number, z: number) => void;
  /** Допустимо ли положение постройки в руках (красный призрак не подтвердить). */
  onValid: (ok: boolean) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number, rot: number) => void;
  onSelect: (sel: CourtSelection | null) => void;
  onCancelPickup: () => void;
}) {
  const [webgl] = useState(webglAvailable);
  const cam = useRef<CamState>({ target: new THREE.Vector3(0, 0, 0), az: Math.PI / 4, pol: 0.98, dist: 24 });
  const skin = getSkin(skinId);
  // клетки, где скин не ставит мелкий декор: дороги и пятна построек
  const blocked = useMemo(() => {
    const set = grid ? footprintKeys(grid) : new Set<string>();
    for (const road of grid?.roads ?? []) set.add(`${road.x}:${road.z}`);
    return set;
  }, [grid]);
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
    const { wx: x, wz: z } = centerOfBuilding(added, grid.size);
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
          gl.toneMappingExposure = 1.04;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        // near/far сжаты ради точности depth-буфера на мобильных (круг 9)
        camera={{ fov: 40, near: 3.5, far: 140, position: [17, 16, 17] }}
      >
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fogFar, 42, 100]} />
        <hemisphereLight args={["#e8f0fa", "#998064", 0.72]} />
        <directionalLight
          color="#ffe0b1"
          intensity={2.25}
          position={[16, 22, 8]}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-radius={2}
        />
        <directionalLight color="#c4d8eb" intensity={0.24} position={[-12, 10, -14]} />
        <CameraRig want={cam} />
        <skin.Ground size={grid?.size ?? 14} blocked={blocked} />
        <skin.Road roads={grid?.roads ?? []} size={grid?.size ?? 14} />
        <skin.Fence />
        <skin.Gate level={gateLevel} />
        <Buildings grid={grid ?? { size: 14, buildings: [], roads: [] }} carried={pending?.from ? { type: pending.type, x: pending.from.x, z: pending.from.z } : null} />
        <CitadelSlot skin={skin} level={thLevel} grid={grid ?? { size: 14, buildings: [], roads: [] }} carried={pending?.type === "townhall" && Boolean(pending.from)} />
        {bursts.map((b) => (
          <Dust key={b.key} x={b.x} z={b.z} onDone={() => setBursts((list) => list.filter((e) => e.key !== b.key))} />
        ))}
        {grid ? (
          <YardInput
            grid={grid}
            tool={tool}
            pending={pending}
            selected={selected}
            thLevel={thLevel}
            renderModel={(type) =>
              type === "townhall" ? <skin.Citadel level={thLevel} /> : type === "road" ? null : <BuildingBody type={type} />
            }
            camera={cam}
            onTarget={onTarget}
            onValid={onValid}
            onRoad={onRoad}
            onPickup={onPickup}
            onSelect={onSelect}
            onCancelPickup={onCancelPickup}
          />
        ) : null}
        <skin.Trees />
        <MeadowLife />
        <Birds />
      </Canvas>
    </div>
  );
}
