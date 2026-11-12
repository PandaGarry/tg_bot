/**
 * Легаси-модель Ратуши (уровни 1..3+ без визуального редизайна) и знамя
 * на крыше. Сохраняет точные размеры, отступы, материалы и анимацию дыма.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { COURT_MATERIALS } from "../../materials/MaterialRegistry.js";
import { gridToWorld, type CourtGridLite } from "../../scene/gridMath.js";

/** Знамя на крыше Ратуши (уровень 3+): волнуется тем же ветром, что на воротах. */
export function RoofBanner({ y = 3.55, s = 1 }: { y?: number; s?: number }) {
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
        <meshStandardMaterial {...COURT_MATERIALS.bannerPole} />
      </mesh>
      <mesh ref={flag} position={[0.33, 0.52, 0]}>
        <planeGeometry args={[0.56, 0.34, 8, 1]} />
        <meshStandardMaterial {...COURT_MATERIALS.bannerCloth} />
      </mesh>
    </group>
  );
}

export function TownHall({ level = 1, grid }: { level?: number; grid: CourtGridLite }) {
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
        <meshStandardMaterial {...COURT_MATERIALS.citadelPodium} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.3 - i * 0.1, 1.56 + i * 0.22]} castShadow receiveShadow>
          <boxGeometry args={[1.3 - i * 0.12, 0.1, 0.26]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelStep} />
        </mesh>
      ))}
      {/* первый этаж — тёплый камень со светлыми угловыми квадрами */}
      <mesh position-y={0.95} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 2.5]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelStoneFlat} />
      </mesh>
      {[
        [-1.12, -1.12],
        [1.12, -1.12],
        [-1.12, 1.12],
        [1.12, 1.12],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.95, z!]} castShadow>
          <boxGeometry args={[0.3, 1.24, 0.3]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelQuoin} />
        </mesh>
      ))}
      {/* фасад: дверь с золотой аркой, два окна */}
      <mesh position={[0, 0.62, 1.24]}>
        <boxGeometry args={[0.74, 1.18, 0.05]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelArch} />
      </mesh>
      <mesh position={[0, 0.6, 1.29]} castShadow>
        <boxGeometry args={[0.58, 1.1, 0.06]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelDoor} />
      </mesh>
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 1.05, 1.26]}>
          <mesh>
            <boxGeometry args={[0.34, 0.44, 0.06]} />
            <meshStandardMaterial {...COURT_MATERIALS.citadelFrame} />
          </mesh>
          <mesh position-z={0.03}>
            <boxGeometry args={[0.24, 0.34, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.citadelWindow} />
          </mesh>
        </group>
      ))}
      {/* второй этаж — дерево, карниз со снегом */}
      <mesh position-y={1.92} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.86, 2.1]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelWall} />
      </mesh>
      <mesh position-y={2.4} castShadow>
        <boxGeometry args={[2.26, 0.12, 2.26]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelCornice} />
      </mesh>
      <mesh position-y={2.5}>
        <boxGeometry args={[2.3, 0.07, 2.3]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelCorniceSnow} />
      </mesh>
      {/* окна второго этажа: золотые рамы */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 1.95, 1.08]}>
          <mesh>
            <boxGeometry args={[0.4, 0.5, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.citadelUpperFrame} />
          </mesh>
          <mesh position-z={0.03}>
            <boxGeometry args={[0.3, 0.4, 0.05]} />
            <meshStandardMaterial {...COURT_MATERIALS.citadelWindow} />
          </mesh>
        </group>
      ))}
      {/* часовая башня с окном */}
      <mesh position-y={3.0} castShadow>
        <boxGeometry args={[1.15, 1.4, 1.15]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelClockTower} />
      </mesh>
      <group position={[0, 3.3, 0.58]}>
        <mesh>
          <boxGeometry args={[0.34, 0.42, 0.06]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelUpperFrame} />
        </mesh>
        <mesh position-z={0.04}>
          <boxGeometry args={[0.24, 0.32, 0.05]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelWindow} />
        </mesh>
      </group>
      {/* уровень 2+: золотой пояс башни */}
      {level >= 2 ? (
        <mesh position-y={2.54}>
          <boxGeometry args={[1.24, 0.09, 1.24]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelGoldBelt} />
        </mesh>
      ) : null}
      {/* шатёр: тёплая черепица, снег, золочёный шпиль */}
      <mesh position-y={4.02} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.05, 0.95, 4]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelRoof} />
      </mesh>
      <mesh position-y={4.33} rotation-y={Math.PI / 4}>
        <coneGeometry args={[0.62, 0.34, 4]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelRoofSnow} />
      </mesh>
      <mesh position-y={4.8}>
        <coneGeometry args={[0.09, 0.34, 6]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelSpire} />
      </mesh>
      {/* уровень 3+: знамя на башне */}
      {level >= 3 ? <RoofBanner y={4.52} s={0.9} /> : null}
      {/* труба с дымом */}
      <mesh position={[0.85, 2.6, -0.75]} castShadow>
        <boxGeometry args={[0.3, 0.7, 0.3]} />
        <meshStandardMaterial {...COURT_MATERIALS.citadelStoneFlat} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => { smoke.current[i] = m; }}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial {...COURT_MATERIALS.citadelSmoke} />
        </mesh>
      ))}
    </group>
  );
}
