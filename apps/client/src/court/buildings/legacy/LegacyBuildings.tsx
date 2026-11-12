/**
 * Легаси-модели построек игрока (10 типов кроме Ратуши), анимации VFX
 * (дым, мельница, пила, бадья, огонёк фонаря, знамя), анимация появления
 * и пыль постановки.
 */

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  COURT_MATERIALS,
  getPadMaterialSpec,
  getWaveClothMaterialSpec,
} from "../../materials/MaterialRegistry.js";
import { ACCENT_COLORS, C } from "../../materials/palette.js";
import { footprintCenterToWorld, type CourtGridLite } from "../../scene/gridMath.js";

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
          <meshStandardMaterial {...COURT_MATERIALS.smokePuff} />
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
        <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
      </mesh>
      <group position-y={1.02} rotation-y={Math.PI / 2}>
        <group ref={rotor}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.27, Math.sin((k * Math.PI) / 2) * 0.27, 0]} rotation-z={(k * Math.PI) / 2} castShadow>
              <planeGeometry args={[0.52, 0.13]} />
              <meshStandardMaterial {...COURT_MATERIALS.windmillSail} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
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
          <meshStandardMaterial {...COURT_MATERIALS.sawBlade} />
        </mesh>
      </group>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 8]} />
        <meshStandardMaterial {...COURT_MATERIALS.sawHub} />
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
          <meshStandardMaterial {...COURT_MATERIALS.rope} />
        </mesh>
        <mesh position-y={-0.4} castShadow>
          <boxGeometry args={[0.15, 0.13, 0.15]} />
          <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
        </mesh>
      </group>
    </group>
  );
}

/** Фонарь: тёплый свет чуть дышит. */
export function LanternFlame({ y }: { y: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.emissiveIntensity = 0.85 + Math.sin(clock.elapsedTime * 7) * 0.25;
  });
  return (
    <mesh position-y={y} castShadow>
      <boxGeometry args={[0.17, 0.22, 0.17]} />
      <meshStandardMaterial ref={mat} {...COURT_MATERIALS.lanternFlame} />
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
      <meshStandardMaterial {...getWaveClothMaterialSpec(color)} />
    </mesh>
  );
}

/** Тёплый фундамент-подстил под 2×2 постройку. */
function Pad({ w = 1.86, h = 1.86, color = ACCENT_COLORS.padDefault }: { w?: number; h?: number; color?: string }) {
  return (
    <mesh position-y={0.04} receiveShadow>
      <boxGeometry args={[w, 0.08, h]} />
      <meshStandardMaterial {...getPadMaterialSpec(color)} />
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
          <meshStandardMaterial {...COURT_MATERIALS.cornerBeam} />
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
      <meshStandardMaterial {...COURT_MATERIALS.snowCap} />
    </mesh>
  );
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
        <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
      </mesh>
      <mesh ref={flag} position={[0.26, 0.82, 0]}>
        <planeGeometry args={[0.44, 0.28, 8, 1]} />
        <meshStandardMaterial {...COURT_MATERIALS.bannerCloth} />
      </mesh>
    </group>
  );
}

export function BuildingBody({ type }: { type: string }) {
  switch (type) {
    // жилой дом 2×2: каменный цоколь, фахверк, пирамидальная крыша, труба с дымом
    case "cottage":
      return (
        <group>
          <Pad />
          <mesh position-y={0.18} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.2, 1.5]} />
            <meshStandardMaterial {...COURT_MATERIALS.stoneBuilding} />
          </mesh>
          <mesh position-y={0.67} castShadow receiveShadow>
            <boxGeometry args={[1.36, 0.78, 1.36]} />
            <meshStandardMaterial {...COURT_MATERIALS.wallBuilding} />
          </mesh>
          <CornerBeams y={0.67} size={1.38} hgt={0.8} />
          {/* дверь с рамой и окно с цветником */}
          <mesh position={[0.33, 0.5, 0.68]}>
            <boxGeometry args={[0.42, 0.64, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.frameBuilding} />
          </mesh>
          <mesh position={[0.33, 0.47, 0.71]}>
            <boxGeometry args={[0.3, 0.54, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.doorBuilding} />
          </mesh>
          <group position={[-0.33, 0.78, 0.68]}>
            <mesh>
              <boxGeometry args={[0.36, 0.36, 0.05]} />
              <meshStandardMaterial {...COURT_MATERIALS.frameBuilding} />
            </mesh>
            <mesh position-z={0.03}>
              <boxGeometry args={[0.26, 0.26, 0.05]} />
              <meshStandardMaterial {...COURT_MATERIALS.windowBuilding} />
            </mesh>
            <mesh position-y={-0.24}>
              <boxGeometry args={[0.4, 0.09, 0.1]} />
              <meshStandardMaterial {...COURT_MATERIALS.flowerBox} />
            </mesh>
            {[[-0.12, 0], [0, 0.02], [0.12, 0]].map(([fx, fy], i) => (
              <mesh key={i} position={[fx!, -0.17 + fy!, 0]}>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshStandardMaterial {...COURT_MATERIALS.flowerPetals} />
              </mesh>
            ))}
          </group>
          {/* крыша со снегом и каменная труба */}
          <mesh position-y={1.39} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.1, 0.62, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.roofFlat} />
          </mesh>
          <RoofSnow y={1.72} r={0.5} />
          <mesh position={[0.52, 1.15, -0.3]} castShadow>
            <boxGeometry args={[0.2, 0.6, 0.2]} />
            <meshStandardMaterial {...COURT_MATERIALS.stoneBuilding} />
          </mesh>
          <mesh position={[0.52, 1.48, -0.3]}>
            <boxGeometry args={[0.26, 0.06, 0.26]} />
            <meshStandardMaterial {...COURT_MATERIALS.pebbleMuted} />
          </mesh>
          <Smoke x={0.52} y={1.6} z={-0.3} />
          {/* сложенные у стены дрова */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.56, 0.13 + (i === 2 ? 0.12 : 0), 0.5 + (i === 2 ? -0.09 : i * 0.14)]} rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 0.44, 7]} />
              <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.logBody : COURT_MATERIALS.logTipFlat)} />
            </mesh>
          ))}
        </group>
      );
    // ферма 2×2: борозды со всходами, сарай, ветряк, оградка
    case "farm":
      return (
        <group>
          <Pad w={1.9} h={1.9} color={ACCENT_COLORS.padFarm} />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, 0.075, -0.7 + i * 0.35]} receiveShadow>
              <boxGeometry args={[1.72, 0.02, 0.12]} />
              <meshStandardMaterial {...COURT_MATERIALS.furrow} />
            </mesh>
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={`s${i}`} position={[-0.6 + (i % 3) * 0.6, 0.15, -0.62 + Math.floor(i / 3) * 1.05 + (i % 2) * 0.1]}>
              <coneGeometry args={[0.05, 0.16, 5]} />
              <meshStandardMaterial {...COURT_MATERIALS.sprout} />
            </mesh>
          ))}
          {/* сарай в углу поля */}
          <group position={[-0.52, 0, -0.5]}>
            <mesh position-y={0.32} castShadow receiveShadow>
              <boxGeometry args={[0.74, 0.52, 0.64]} />
              <meshStandardMaterial {...COURT_MATERIALS.wallBuilding} />
            </mesh>
            <mesh position-y={0.75} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.62, 0.34, 4]} />
              <meshStandardMaterial {...COURT_MATERIALS.roofRed} />
            </mesh>
            <RoofSnow y={0.95} r={0.28} />
            <mesh position={[0, 0.2, 0.33]}>
              <boxGeometry args={[0.24, 0.34, 0.04]} />
              <meshStandardMaterial {...COURT_MATERIALS.doorBuilding} />
            </mesh>
          </group>
          <Windmill x={0.6} z={0.55} />
          {/* оградка по переднему краю */}
          {[-0.72, -0.24, 0.24, 0.72].map((fx) => (
            <mesh key={`f${fx}`} position={[fx, 0.16, 0.9]} castShadow>
              <boxGeometry args={[0.05, 0.22, 0.05]} />
              <meshStandardMaterial {...COURT_MATERIALS.logTipSmooth} />
            </mesh>
          ))}
          <mesh position={[0, 0.24, 0.9]}>
            <boxGeometry args={[1.66, 0.03, 0.035]} />
            <meshStandardMaterial {...COURT_MATERIALS.logTipSmooth} />
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
              <meshStandardMaterial {...COURT_MATERIALS.wallBuilding} />
            </mesh>
            <CornerBeams y={0.39} size={1.07} hgt={0.68} />
            <mesh position-y={0.99} rotation-y={Math.PI / 4} castShadow>
              <coneGeometry args={[0.92, 0.42, 4]} />
              <meshStandardMaterial {...COURT_MATERIALS.roofFlat} />
            </mesh>
            <RoofSnow y={1.24} r={0.4} />
          </group>
          <SawBlade x={0.28} y={0.52} z={0.14} />
          {/* штабель: три внизу, две сверху */}
          {[0, 1, 2].map((i) => (
            <mesh key={`l${i}`} position={[0.62, 0.1, -0.18 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.logBody : COURT_MATERIALS.logTipFlat)} />
            </mesh>
          ))}
          {[0, 1].map((i) => (
            <mesh key={`t${i}`} position={[0.62, 0.26, -0.08 + i * 0.2]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.56, 7]} />
              <meshStandardMaterial {...COURT_MATERIALS.logBody} />
            </mesh>
          ))}
          {/* свежие доски у сарая */}
          <mesh position={[0.42, 0.3, -0.62]} rotation-z={0.32} castShadow>
            <boxGeometry args={[0.5, 0.03, 0.14]} />
            <meshStandardMaterial {...COURT_MATERIALS.plankWarm} />
          </mesh>
          <mesh position={[0.56, 0.26, -0.7]} rotation-z={-0.28} castShadow>
            <boxGeometry args={[0.44, 0.03, 0.12]} />
            <meshStandardMaterial {...COURT_MATERIALS.plankMid} />
          </mesh>
        </group>
      );
    // каменоломня 2×2: скала, вороты с бадьёй, штабель блоков
    case "quarry":
      return (
        <group>
          <Pad color={ACCENT_COLORS.padQuarry} />
          <mesh position={[-0.28, 0.28, -0.28]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial {...COURT_MATERIALS.rockWarm} />
          </mesh>
          <mesh position={[0.32, 0.2, -0.4]} rotation-y={0.8} castShadow>
            <dodecahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial {...COURT_MATERIALS.rockCool} />
          </mesh>
          <mesh position={[0.02, 0.17, 0.12]} rotation-y={1.9} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial {...COURT_MATERIALS.rockWarm} />
          </mesh>
          {/* деревянные вороты: нога, перекладина, верёвка, бадья */}
          <mesh position={[0.42, 0.4, 0.5]} rotation-z={0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0.68, 0.4, 0.5]} rotation-z={-0.28} castShadow>
            <boxGeometry args={[0.05, 0.88, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0.55, 0.8, 0.5]} castShadow>
            <boxGeometry args={[0.36, 0.05, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <Bucket x={0.55} y={0.78} z={0.5} />
          {/* блоки ровным штабелем */}
          {[0, 1, 2].map((i) => (
            <mesh key={`b${i}`} position={[-0.55, 0.12 + (i === 2 ? 0.21 : 0), 0.52 + (i === 2 ? -0.1 : (i - 0.5) * 0.24)]} rotation-y={i * 0.4} castShadow>
              <boxGeometry args={[0.21, 0.21, 0.21]} />
              <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.blockLight : COURT_MATERIALS.blockDark)} />
            </mesh>
          ))}
        </group>
      );
    // рудник 2×2: гора, крепь портала, рельсы и вагонетка
    case "mine":
      return (
        <group>
          <Pad color={ACCENT_COLORS.padMine} />
          <mesh position={[0, 0.28, -0.1]} scale={[1.15, 0.6, 0.95]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial {...COURT_MATERIALS.mineSlope} />
          </mesh>
          <mesh position={[0.55, 0.16, -0.45]} rotation-y={0.7} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial {...COURT_MATERIALS.mineRock} />
          </mesh>
          {/* крепь и чёрный провал */}
          <mesh position={[-0.2, 0.26, 0.62]} castShadow>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0.2, 0.26, 0.62]} castShadow>
            <boxGeometry args={[0.09, 0.52, 0.09]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0, 0.55, 0.62]} castShadow>
            <boxGeometry args={[0.6, 0.09, 0.09]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0, 0.22, 0.63]}>
            <boxGeometry args={[0.36, 0.42, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.minePit} />
          </mesh>
          {/* рельсы со шпалами и вагонетка */}
          {[-0.09, 0.09].map((rx) => (
            <mesh key={rx} position={[rx, 0.06, 0.28]}>
              <boxGeometry args={[0.03, 0.02, 0.8]} />
              <meshStandardMaterial {...COURT_MATERIALS.mineRail} />
            </mesh>
          ))}
          {[0.02, 0.28, 0.54].map((rz) => (
            <mesh key={`w${rz}`} position={[0, 0.045, rz]}>
              <boxGeometry args={[0.3, 0.02, 0.045]} />
              <meshStandardMaterial {...COURT_MATERIALS.furrow} />
            </mesh>
          ))}
          <group position={[0, 0.16, 0.34]}>
            <mesh castShadow>
              <boxGeometry args={[0.26, 0.16, 0.19]} />
              <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
            </mesh>
            {[[-0.1, -0.07], [0.1, -0.07], [-0.1, 0.07], [0.1, 0.07]].map(([wx, wz], i) => (
              <mesh key={i} position={[wx!, -0.09, wz!]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
                <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
              </mesh>
            ))}
            <mesh position={[0, 0.1, 0]} castShadow>
              <dodecahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial {...COURT_MATERIALS.mineOre} />
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
            <meshStandardMaterial {...COURT_MATERIALS.barracksBase} />
          </mesh>
          <mesh position-y={0.64} castShadow receiveShadow>
            <boxGeometry args={[1.36, 0.6, 0.98]} />
            <meshStandardMaterial {...COURT_MATERIALS.wallBuilding} />
          </mesh>
          <CornerBeams y={0.64} size={1.38} hgt={0.62} />
          <mesh position-y={1.24} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.08, 0.52, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.roofRed} />
          </mesh>
          <RoofSnow y={1.54} r={0.46} />
          <mesh position={[-0.3, 0.44, 0.5]}>
            <boxGeometry args={[0.34, 0.5, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.doorBuilding} />
          </mesh>
          <group position={[0.28, 0.68, 0.5]}>
            <mesh>
              <boxGeometry args={[0.34, 0.34, 0.05]} />
              <meshStandardMaterial {...COURT_MATERIALS.frameBuilding} />
            </mesh>
            <mesh position-z={0.03}>
              <boxGeometry args={[0.24, 0.24, 0.05]} />
              <meshStandardMaterial {...COURT_MATERIALS.windowBuilding} />
            </mesh>
          </group>
          {/* знамя на стене — волнуется */}
          <WaveCloth w={0.26} h={0.38} color={C.flag} position={[-0.66, 0.66, 0.52]} />
          {/* стойка: два копья и щит */}
          {[-0.04, 0.04].map((ox) => (
            <mesh key={ox} position={[0.66 + ox, 0.44, 0.44 - Math.abs(ox)]} rotation-z={0.12 + (ox < 0 ? -0.05 : 0.05)} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.8, 6]} />
              <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
            </mesh>
          ))}
          {[-0.04, 0.04].map((ox) => (
            <mesh key={`h${ox}`} position={[0.66 + ox * 1.4, 0.88, 0.44 - Math.abs(ox)]}>
              <coneGeometry args={[0.035, 0.12, 6]} />
              <meshStandardMaterial {...COURT_MATERIALS.spearTip} />
            </mesh>
          ))}
          <mesh position={[0.66, 0.6, 0.56]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.03, 12]} />
            <meshStandardMaterial {...COURT_MATERIALS.shieldWood} />
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
            <meshStandardMaterial {...COURT_MATERIALS.stoneBuilding} />
          </mesh>
          <mesh position-y={0.35}>
            <cylinderGeometry args={[0.37, 0.37, 0.03, 9]} />
            <meshStandardMaterial {...COURT_MATERIALS.minePit} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.58, 0.06, Math.sin((i / 5) * Math.PI * 2) * 0.58]} rotation-y={i} castShadow>
              <dodecahedronGeometry args={[0.07, 0]} />
              <meshStandardMaterial {...(i % 2 ? COURT_MATERIALS.rockWarm : COURT_MATERIALS.pebbleMuted)} />
            </mesh>
          ))}
          {/* ворот */}
          <mesh position={[-0.3, 0.5, 0]} rotation-z={0.34} castShadow>
            <boxGeometry args={[0.06, 1.0, 0.06]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0.3, 0.5, 0]} rotation-z={-0.34} castShadow>
            <boxGeometry args={[0.06, 1.0, 0.06]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.56, 8]} />
            <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
          </mesh>
          <mesh position={[0.32, 0.86, 0.07]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, 0.14, 6]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.34, 5]} />
            <meshStandardMaterial {...COURT_MATERIALS.rope} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.13, 0.12, 0.13]} />
            <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
          </mesh>
          <mesh position-y={1.24} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[0.62, 0.36, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.roofFlat} />
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
            <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
          </mesh>
          <mesh position={[0, 0.47, -0.15]} rotation-x={-0.12} castShadow>
            <boxGeometry args={[1.0, 0.28, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.logTipFlat} />
          </mesh>
          {[-0.46, 0.46].map((bx) => (
            <group key={bx} position={[bx, 0, 0]}>
              <mesh position-y={0.14} castShadow>
                <boxGeometry args={[0.06, 0.28, 0.3]} />
                <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
              </mesh>
              <mesh position-y={0.42} castShadow>
                <boxGeometry args={[0.06, 0.05, 0.3]} />
                <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
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
            <meshStandardMaterial {...COURT_MATERIALS.stoneBuilding} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2 + 0.5) * 0.26, 0.05, Math.sin((i / 3) * Math.PI * 2 + 0.5) * 0.26]} rotation-y={i} castShadow>
              <dodecahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial {...COURT_MATERIALS.pebbleMuted} />
            </mesh>
          ))}
          <mesh position-y={0.47} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.74, 6]} />
            <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
          </mesh>
          <LanternFlame y={0.95} />
          <mesh position-y={1.12}>
            <coneGeometry args={[0.15, 0.12, 4]} />
            <meshStandardMaterial {...COURT_MATERIALS.gateBeamFlat} />
          </mesh>
        </group>
      );
    // знамя 1×1: каменный постамент и полотнище
    case "flag":
      return (
        <group>
          <mesh position-y={0.05} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.19, 0.1, 8]} />
            <meshStandardMaterial {...COURT_MATERIALS.stoneBuilding} />
          </mesh>
          <RoofBannerSmall />
        </group>
      );
    default:
      return null;
  }
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
export function Buildings({ grid }: { grid: CourtGridLite }) {
  return (
    <>
      {grid.buildings.map((b) => {
        if (b.type === "townhall") return null; // Ратуша — отдельная живая модель
        const { wx: cx, wz: cz } = footprintCenterToWorld(b.type, b.x, b.z, grid.size);
        return (
          <Popped key={`${b.type}:${b.x}:${b.z}`} x={cx} z={cz}>
            <BuildingBody type={b.type} />
          </Popped>
        );
      })}
    </>
  );
}

/** Пыль постановки: короткий веер комков под ногами новой постройки. */
export function Dust({ x, z, onDone }: { x: number; z: number; onDone: () => void }) {
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
          <meshStandardMaterial {...COURT_MATERIALS.dustPuff} />
        </mesh>
      ))}
    </group>
  );
}
