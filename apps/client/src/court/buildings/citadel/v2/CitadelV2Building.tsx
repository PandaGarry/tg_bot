/**
 * Архитектурный компонент Цитадели уровней 1..5 (TDL-ARCH-006 v2).
 *
 * Пять стадий развития ЕДИНОГО архитектурного замысла (осевой готический
 * оплот-некрополь):
 * - массивные многоступенчатые готические порталы с глубокой резьбой,
 *   вимпергами, краббами, трилистником и перспективными архивольтами;
 * - сложная каменная кладка, угловая 3D-рустовка, утопленные стрельчатые
 *   аркады, контрфорсы с пинаклями, нервюры, рёбра шатров и ажурные аркбутаны;
 * - выразительный центральный некротический реликварий с нервюрной сенью,
 *   многослойным кристаллом и вращающимися рунными орбитами;
 * - геральдические щиты, рваные боевые штандарты, кованая фурнитура,
 *   резные рогатые черепа и костяные оссуарные элементы;
 * - богатые выветренные материалы, сколы, трещины и следы копоти.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import {
  CITADEL_PALETTE,
  createAshSmokeMaterialProps,
  createBrazierFlameMaterialProps,
  createHearthWindowMaterialProps,
  createNecroticCrystalMaterialProps,
  useCitadelTextureSet,
  type CitadelTextureSet,
} from "./citadelV2Materials.js";
import { footprintCenterToWorld, type CourtGridLite } from "../../../scene/gridMath.js";
import { useCitadelGeometrySet, type CitadelGeometrySet } from "./citadelV2Geometry.js";
import { getCitadelVisualSpec, type CitadelLevelVisualSpec } from "./citadelV2Levels.js";

/** Объёмный готический геральдический щит ордена. */
function HeraldicShield({
  position,
  rotationY = 0,
  scale = 1,
  gilded = false,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number;
  gilded?: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY} scale={scale}>
      {/* кованая/бронзовая подложка-обод */}
      <mesh geometry={geoms.heraldicShield} scale={[0.26, 0.28, 0.036]} castShadow>
        <meshStandardMaterial
          map={gilded ? undefined : tex.ironMap}
          color={gilded ? CITADEL_PALETTE.agedBronze : "#3b3e45"}
          roughness={0.44}
          metalness={0.78}
        />
      </mesh>
      {/* тёмно-багровое эмалевое поле */}
      <mesh geometry={geoms.heraldicShield} position-z={0.012} scale={[0.21, 0.23, 0.03]}>
        <meshStandardMaterial color={CITADEL_PALETTE.bannerCloth} roughness={0.68} metalness={0.14} />
      </mesh>
      {/* рельефный геральдический крест и центральный умбон */}
      <mesh position={[0, 0.01, 0.03]}>
        <boxGeometry args={[0.028, 0.16, 0.016]} />
        <meshStandardMaterial color={CITADEL_PALETTE.bannerGold} roughness={0.4} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.03, 0.03]}>
        <boxGeometry args={[0.12, 0.026, 0.016]} />
        <meshStandardMaterial color={CITADEL_PALETTE.bannerGold} roughness={0.4} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.03, 0.038]}>
        <octahedronGeometry args={[0.026, 0]} />
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.01} roughness={0.72} />
      </mesh>
    </group>
  );
}

/** Резной рогатый костяной череп-трофей в кованой оправе. */
function HornedSkullTrophy({
  position,
  rotationY = 0,
  scale = 1,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY} scale={scale}>
      {/* железная розетка-подложка */}
      <mesh position-z={-0.01} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.11, 0.12, 0.03, 6]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.46} metalness={0.82} />
      </mesh>
      {/* черепная коробка */}
      <mesh position={[0, 0.02, 0.04]} castShadow>
        <dodecahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.018} roughness={0.76} />
      </mesh>
      {/* верхняя челюсть / морда */}
      <mesh position={[0, -0.045, 0.075]} rotation-x={0.25} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.08]} />
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.015} roughness={0.78} />
      </mesh>
      {/* глубокие закопчённые глазницы */}
      {[-0.036, 0.036].map((ex) => (
        <mesh key={ex} position={[ex, 0.015, 0.11]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#12100f" roughness={0.95} />
        </mesh>
      ))}
      {/* пара загнутых костяных рогов */}
      <mesh geometry={geoms.hornTrophy} position={[0.045, 0.055, 0.03]} scale={0.16} castShadow>
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.015} roughness={0.74} />
      </mesh>
      <mesh geometry={geoms.hornTrophy} position={[-0.045, 0.055, 0.03]} scale={[-0.16, 0.16, 0.16]} castShadow>
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.015} roughness={0.74} />
      </mesh>
    </group>
  );
}

/** Локальный рваный геральдический штандарт (собственная геометрия на экземпляр). */
function CitadelBanner({
  position,
  scale = 1,
  phase = 0,
  tex,
}: {
  position: readonly [number, number, number];
  scale?: number;
  phase?: number;
  tex: CitadelTextureSet;
}) {
  const clothRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mesh = clothRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 7.2 + t * 5.1 + phase) * 0.048 * (x + 0.25));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={[position[0], position[1], position[2]]} scale={scale}>
      <mesh position-y={0.42} castShadow>
        <cylinderGeometry args={[0.022, 0.028, 0.94, 6]} />
        <meshStandardMaterial
          map={tex.ironMap}
          bumpMap={tex.ironBump}
          roughnessMap={tex.ironRoughness}
          bumpScale={0.015}
          roughness={0.78}
          metalness={0.82}
        />
      </mesh>
      <mesh position={[0.16, 0.78, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />
        <meshStandardMaterial map={tex.boneMap} roughness={0.76} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.91, 0]} castShadow>
        <coneGeometry args={[0.044, 0.14, 4]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.4} metalness={0.76} />
      </mesh>
      <mesh ref={clothRef} position={[0.31, 0.56, 0]}>
        <planeGeometry args={[0.58, 0.38, 10, 1]} />
        <meshStandardMaterial
          map={tex.bannerMap}
          alphaMap={tex.bannerAlpha}
          alphaTest={0.42}
          side={THREE.DoubleSide}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
    </group>
  );
}

/** Тлеющая кованая жаровня с профилированной чашей, углями и изолированным пламенем. */
function IronBrazier({
  position,
  tall = false,
  tex,
}: {
  position: readonly [number, number, number];
  tall?: boolean;
  tex: CitadelTextureSet;
}) {
  const flameRef = useRef<THREE.Mesh>(null);
  const phase = position[0] * 1.9 + position[2] * 2.3;

  useFrame(({ clock }) => {
    const m = flameRef.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const flicker = 0.88 + Math.sin(t * 9.5 + phase) * 0.12 + Math.sin(t * 15.3 + phase * 1.7) * 0.07;
    m.scale.set(0.94 + (flicker - 0.9) * 0.24, flicker, 0.94 + (flicker - 0.9) * 0.24);
    (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.88 + flicker * 0.34;
  });

  const postH = tall ? 0.58 : 0.24;
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={postH * 0.16} castShadow>
        <cylinderGeometry args={[0.11, 0.14, postH * 0.32, 6]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
      </mesh>
      <mesh position-y={postH * 0.62} castShadow receiveShadow>
        <cylinderGeometry args={[0.062, 0.088, postH * 0.76, 6]} />
        <meshStandardMaterial
          map={tex.ironMap}
          bumpMap={tex.ironBump}
          roughnessMap={tex.ironRoughness}
          bumpScale={0.018}
          roughness={0.78}
          metalness={0.82}
        />
      </mesh>
      <mesh position-y={postH + 0.06} castShadow>
        <cylinderGeometry args={[0.145, 0.075, 0.12, 8]} />
        <meshStandardMaterial
          map={tex.ironMap}
          roughnessMap={tex.ironRoughness}
          roughness={0.78}
          metalness={0.84}
        />
      </mesh>
      <mesh position-y={postH + 0.1}>
        <cylinderGeometry args={[0.105, 0.105, 0.03, 6]} />
        <meshStandardMaterial color="#3c190e" emissive="#c44214" emissiveIntensity={0.72} roughness={0.8} />
      </mesh>
      <mesh ref={flameRef} position-y={postH + 0.19}>
        <coneGeometry args={[0.072, 0.2, 6]} />
        <meshStandardMaterial {...createBrazierFlameMaterialProps()} />
      </mesh>
    </group>
  );
}

/**
 * Глубоко утопленное стрельчатое окно-ниша (с профилированной аркой, пилястрами,
 * ажурным трилистником на ур. 3+, кованым переплётом и подтёком копоти под отливом).
 */
function RecessedLancetWindow({
  position,
  rotationY = 0,
  width = 0.28,
  height = 0.5,
  mode = "hearth",
  gilded = false,
  tracery = false,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  mode?: "hearth" | "necrotic";
  gilded?: boolean;
  tracery?: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const glassProps =
    mode === "necrotic"
      ? {
          color: CITADEL_PALETTE.necroticBase,
          emissive: CITADEL_PALETTE.necroticGlow,
          emissiveIntensity: 0.78,
          roughness: 0.26,
        }
      : createHearthWindowMaterialProps();

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      {/* стрельчатый профилированный наличник */}
      <mesh
        geometry={geoms.pointedArch}
        position={[0, -height * 0.48, 0.032]}
        scale={[width + 0.14, height + 0.12, 0.075]}
        castShadow
      >
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.022}
          color={gilded ? "#8f8572" : undefined}
          roughness={0.86}
        />
      </mesh>
      {/* выступающий скошенный подоконник */}
      <mesh position={[0, -height * 0.5 - 0.025, 0.045]} castShadow>
        <boxGeometry args={[width + 0.18, 0.055, 0.095]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
      </mesh>
      {/* тёмный след копоти/подтёков под подоконником */}
      <mesh position={[0, -height * 0.5 - 0.14, 0.012]}>
        <planeGeometry args={[width + 0.08, 0.18]} />
        <meshStandardMaterial map={tex.sootOverlay} transparent opacity={0.42} depthWrite={false} roughness={0.98} />
      </mesh>
      {/* замковый трилистник (на старших уровнях) */}
      {tracery ? (
        <mesh
          geometry={geoms.trefoilTracery}
          position={[0, height * 0.16, 0.048]}
          scale={[width * 0.68, height * 0.34, 0.032]}
        >
          <meshStandardMaterial
            color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.stoneDressed}
            roughness={gilded ? 0.46 : 0.85}
            metalness={gilded ? 0.68 : 0.05}
          />
        </mesh>
      ) : null}
      {/* утопленное светящееся стекло */}
      <mesh position={[0, -height * 0.04, 0.026]}>
        <boxGeometry args={[width - 0.02, height * 0.84, 0.018]} />
        <meshStandardMaterial {...glassProps} />
      </mesh>
      {/* кованая решётка (чётко впереди стекла) */}
      <mesh position={[0, -height * 0.04, 0.052]}>
        <boxGeometry args={[0.024, height * 0.84, 0.02]} />
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.5} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.04, 0.052]}>
        <boxGeometry args={[width - 0.01, 0.024, 0.02]} />
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.5} metalness={0.82} />
      </mesh>
    </group>
  );
}

/** 3D-перевязка выступающих угловых рустовых камней (со сколами времени). */
function StaggeredCornerQuoins({
  x,
  z,
  baseY,
  height,
  sx,
  sz,
  tex,
}: {
  x: number;
  z: number;
  baseY: number;
  height: number;
  sx: number;
  sz: number;
  tex: CitadelTextureSet;
}) {
  const count = 5;
  const stepH = height / count;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const wide = i % 2 === 0;
        const w = wide ? 0.27 : 0.21;
        const d = wide ? 0.21 : 0.27;
        const chipped = i === 1 && sx > 0 ? 0.025 : 0;
        return (
          <mesh
            key={i}
            position={[x - sx * (w * 0.28 + chipped), baseY + stepH * (i + 0.5), z - sz * (d * 0.28)]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[w, stepH * 0.88, d]} />
            <meshStandardMaterial
              map={tex.dressedMap}
              bumpMap={tex.dressedBump}
              roughnessMap={tex.dressedRoughness}
              bumpScale={0.025}
              roughness={0.88}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Восьмигранная угловая башня-бастион с рёбрами шатра, рустовыми поясами и пинаклями. */
function CornerBastionTurret({
  position,
  baseY,
  height,
  radius,
  spireHeight,
  hasCrownRing,
  hasBoneSpurs,
  hasRibbedSpire,
  gildedTrim,
  geoms,
  tex,
}: {
  position: readonly [number, number];
  baseY: number;
  height: number;
  radius: number;
  spireHeight: number;
  hasCrownRing: boolean;
  hasBoneSpurs: boolean;
  hasRibbedSpire: boolean;
  gildedTrim: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const topY = baseY + height;
  const spireBaseY = topY + (hasCrownRing ? 0.07 : 0.02);
  const spireR = radius * 1.13;
  const ribTilt = Math.atan2(spireR, spireHeight);
  const ribLen = Math.hypot(spireR, spireHeight);

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* расширенный скошенный цоколь башни (плоские грани на 0°/90°/180°/270°) */}
      <mesh position-y={baseY + 0.16} rotation-y={Math.PI / 8} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.07, radius * 1.21, 0.32, 8]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.028}
          roughness={0.88}
        />
      </mesh>
      {/* основное восьмигранное тело из выветренного базальта */}
      <mesh position-y={baseY + height / 2} rotation-y={Math.PI / 8} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.96, radius * 1.05, height, 8]} />
        <meshStandardMaterial
          map={tex.basaltMap}
          bumpMap={tex.basaltBump}
          roughnessMap={tex.basaltRoughness}
          bumpScale={0.036}
          roughness={0.9}
        />
      </mesh>
      {/* двойные каменные и кованые пояски обвязки (без жирных рыжих полос) */}
      {[0.38, 0.68].map((frac, idx) => (
        <group key={idx} position-y={baseY + height * frac}>
          <mesh rotation-y={Math.PI / 8} castShadow>
            <cylinderGeometry args={[radius * 1.03, radius * 1.03, 0.058, 8]} />
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
          </mesh>
          <mesh rotation-y={Math.PI / 8}>
            <cylinderGeometry args={[radius * 1.038, radius * 1.038, 0.018, 8]} />
            <meshStandardMaterial
              map={idx === 1 || !gildedTrim ? tex.ironMap : undefined}
              color={idx === 0 && gildedTrim ? "#6e5632" : undefined}
              roughness={0.48}
              metalness={0.78}
            />
          </mesh>
        </group>
      ))}
      {/* глубокие утопленные амбразуры-бойницы строго на плоских гранях восьмигранника */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, idx) => (
        <group key={idx} rotation-y={ang}>
          <mesh position={[0, baseY + height * 0.56, radius * 0.905]}>
            <boxGeometry args={[0.075, 0.25, 0.022]} />
            <meshStandardMaterial map={tex.basaltMap} roughness={0.92} />
          </mesh>
          <mesh position={[0, baseY + height * 0.56, radius * 0.922]}>
            <boxGeometry args={[0.032, 0.19, 0.014]} />
            <meshStandardMaterial color="#18130f" emissive={CITADEL_PALETTE.hearthGlow} emissiveIntensity={0.62} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* верхний карниз машикулей */}
      <mesh position-y={topY - 0.05} rotation-y={Math.PI / 8} castShadow>
        <cylinderGeometry args={[radius * 1.15, radius * 0.98, 0.15, 8]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.024} roughness={0.86} />
      </mesh>
      {/* парапетная корона + малые угловые пинакли/клыки */}
      {hasCrownRing ? (
        <group position-y={topY + 0.08}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i * Math.PI) / 4;
            const chipped = i === 3 ? 0.12 : 0.16;
            return (
              <mesh
                key={i}
                position={[Math.sin(ang) * radius * 1.01, 0, Math.cos(ang) * radius * 1.01]}
                rotation-y={ang}
                castShadow
              >
                <boxGeometry args={[radius * 0.42, chipped, 0.095]} />
                <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
              </mesh>
            );
          })}
        </group>
      ) : null}
      {/* костяные клыки/шпицы и мини-пинакли по короне */}
      {hasBoneSpurs
        ? [0, 1, 2, 3].map((i) => {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            return (
              <group key={i} position={[Math.sin(ang) * radius * 1.1, topY + 0.08, Math.cos(ang) * radius * 1.1]}>
                <mesh geometry={geoms.pinnacleSpire} scale={[0.38, 0.28, 0.38]} castShadow>
                  <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.012} roughness={0.76} />
                </mesh>
              </group>
            );
          })
        : null}
      {/* сланцевый готический шатёр башни */}
      <mesh position-y={spireBaseY + spireHeight / 2} rotation-y={Math.PI / 8} castShadow>
        <coneGeometry args={[spireR, spireHeight, 8]} />
        <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.74} metalness={0.08} />
      </mesh>
      {/* НАСТОЯЩИЕ наклонные архитектурные рёбра-нервюры вдоль рёбер шатра */}
      {hasRibbedSpire
        ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i * Math.PI) / 4 + Math.PI / 8;
            return (
              <group key={i} rotation-y={ang}>
                <mesh
                  position={[0, spireBaseY + spireHeight * 0.5, spireR * 0.49]}
                  rotation-x={-ribTilt}
                  castShadow
                >
                  <boxGeometry args={[0.036, ribLen * 0.96, 0.042]} />
                  <meshStandardMaterial
                    map={tex.ironMap}
                    roughnessMap={tex.ironRoughness}
                    color={gildedTrim && i % 2 === 0 ? "#6e5632" : undefined}
                    roughness={0.46}
                    metalness={0.8}
                  />
                </mesh>
              </group>
            );
          })
        : null}
      {/* шпиль-навершие */}
      <mesh position-y={spireBaseY + spireHeight + 0.14} castShadow>
        <coneGeometry args={[0.042, 0.32, 6]} />
        <meshStandardMaterial
          color={gildedTrim ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

/** Ряд зубцов парапета с выщерблинами времени и резными угловыми пинаклями. */
function BattlementPerimeter({
  halfSpan,
  y,
  weatheringStage,
  geoms,
  tex,
  hasCornerPinacles,
  skipCorners = false,
}: {
  halfSpan: number;
  y: number;
  weatheringStage: 1 | 2 | 3;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
  hasCornerPinacles?: boolean;
  skipCorners?: boolean;
}) {
  const offsets = [-0.62, 0, 0.62];
  return (
    <group position-y={y}>
      <mesh position-y={-0.02} castShadow>
        <boxGeometry args={[halfSpan * 2 + 0.08, 0.08, halfSpan * 2 + 0.08]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
      </mesh>
      {offsets.map((frac, idx) => {
        const p = frac * (halfSpan - 0.16);
        // намеренные сколы и разная сохранность зубцов (следы боёв и времени)
        const frontH = idx === 0 && weatheringStage >= 2 ? 0.16 : 0.22;
        const sideH = idx === 2 && weatheringStage >= 3 ? 0.15 : 0.22;
        return (
          <group key={frac}>
            <mesh position={[p, frontH * 0.5 + 0.01, halfSpan - 0.03]} castShadow>
              <boxGeometry args={[0.28, frontH, 0.12]} />
              <meshStandardMaterial
                map={tex.dressedMap}
                bumpMap={tex.dressedBump}
                roughnessMap={tex.dressedRoughness}
                bumpScale={0.022}
                roughness={0.88}
              />
            </mesh>
            <mesh position={[p, 0.12, -(halfSpan - 0.03)]} castShadow>
              <boxGeometry args={[0.28, 0.22, 0.12]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
            </mesh>
            <mesh position={[halfSpan - 0.03, sideH * 0.5 + 0.01, p]} castShadow>
              <boxGeometry args={[0.12, sideH, 0.28]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
            </mesh>
            <mesh position={[-(halfSpan - 0.03), 0.12, p]} castShadow>
              <boxGeometry args={[0.12, 0.22, 0.28]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
            </mesh>
            {/* кованые зубцы-шипы в проёмах мерлонов */}
            {idx !== 1 ? (
              <mesh position={[p + 0.24, 0.08, halfSpan - 0.03]}>
                <coneGeometry args={[0.02, 0.14, 4]} />
                <meshStandardMaterial map={tex.ironMap} roughness={0.5} metalness={0.82} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {!skipCorners
        ? [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <group key={i} position={[sx! * (halfSpan - 0.04), 0.12, sz! * (halfSpan - 0.04)]}>
              <mesh castShadow>
                <boxGeometry args={[0.24, 0.24, 0.24]} />
                <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
              </mesh>
              {hasCornerPinacles ? (
                <mesh geometry={geoms.pinnacleSpire} position-y={0.12} scale={[0.7, 0.45, 0.7]} castShadow>
                  <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
                </mesh>
              ) : null}
            </group>
          ))
        : null}
    </group>
  );
}

/**
 * Выразительный центральный некротический реликварий (эволюционирует от
 * 4-аркового оссуария-фонаря на L3 до соборной 8-арковой ротонды с нервюрным
 * сводом, костяными консолями, рунными кольцами и коронованным шпилем на L4..5).
 */
function NecroticReliquaryCrown({
  y,
  scale = 1,
  level,
  ringCount,
  gilded,
  geoms,
  tex,
}: {
  y: number;
  scale?: number;
  level: 3 | 4 | 5;
  ringCount: 0 | 1 | 2;
  gilded: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const crystalRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.78 + Math.sin(t * 2.15) * 0.24;
    const bob = Math.sin(t * 1.9) * 0.026;
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.48;
      crystalRef.current.position.y = 0.48 + bob;
      (crystalRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.7;
      coreRef.current.position.y = 0.48 + bob;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.55;
      ring1Ref.current.rotation.y = t * 0.35;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -t * 0.62;
      ring2Ref.current.rotation.z = -t * 0.32;
    }
    if (lightRef.current) {
      lightRef.current.intensity = (level === 5 ? 1.15 : level === 4 ? 0.85 : 0.58) * (0.85 + Math.sin(t * 2.15) * 0.15);
    }
  });

  const isCathedral = level === 5;
  const isChapel = level >= 4;
  const ribCount = isChapel ? 8 : 4;
  const radius = isCathedral ? 0.48 : isChapel ? 0.4 : 0.34;
  const vaultH = isCathedral ? 0.96 : isChapel ? 0.82 : 0.68;

  return (
    <group position-y={y} scale={scale}>
      {/* восьмигранный алтарный цоколь реликвария */}
      <mesh position-y={0.08} castShadow>
        <cylinderGeometry args={[radius * 1.06, radius * 1.24, 0.16, 8]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.025}
          roughness={0.86}
        />
      </mesh>
      <mesh position-y={0.17} castShadow>
        <cylinderGeometry args={[radius * 1.12, radius * 1.12, 0.05, 8]} />
        <meshStandardMaterial
          color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>

      {/* геральдические щиты ордена по 4 граням цоколя (L4..5) */}
      {isChapel
        ? [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, idx) => (
            <HeraldicShield
              key={idx}
              position={[Math.sin(ang) * (radius * 1.14), 0.11, Math.cos(ang) * (radius * 1.14)]}
              rotationY={ang}
              scale={0.72}
              gilded={gilded}
              geoms={geoms}
              tex={tex}
            />
          ))
        : null}

      {/* костяные рёбра оссуария по кругу цоколя (L4..5) */}
      {isChapel
        ? [0, 1, 2, 3].map((i) => {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            return (
              <mesh
                key={`br${i}`}
                geometry={geoms.vaultRib}
                position={[0, 0.12, 0]}
                rotation-y={ang}
                scale={[0.85, 0.42, radius * 2.15]}
                castShadow
              >
                <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.015} roughness={0.76} />
              </mesh>
            );
          })
        : null}

      {/* 4 или 8 изогнутых готических каменных/кованых нервюр свода ротонды */}
      {Array.from({ length: ribCount }, (_, i) => {
        const ang = (i * Math.PI * 2) / ribCount + (isChapel ? 0 : Math.PI / 4);
        const rx = Math.sin(ang) * radius;
        const rz = Math.cos(ang) * radius;
        return (
          <group key={i}>
            {/* пилон-нервюра свода */}
            <mesh
              geometry={geoms.vaultRib}
              position={[0, 0.16, 0]}
              rotation-y={ang}
              scale={[0.86, vaultH, radius * 2.18]}
              castShadow
            >
              <meshStandardMaterial
                map={i % 2 === 0 || !gilded ? tex.dressedMap : tex.ironMap}
                color={gilded && i % 2 === 1 ? CITADEL_PALETTE.agedBronze : undefined}
                roughness={gilded && i % 2 === 1 ? 0.44 : 0.85}
                metalness={gilded && i % 2 === 1 ? 0.76 : 0.06}
              />
            </mesh>
            {/* угловой резной пинакль на каждом устое (для L4..5) */}
            {isChapel && i % 2 === 0 ? (
              <mesh
                geometry={geoms.pinnacleSpire}
                position={[rx * 1.02, 0.18, rz * 1.02]}
                scale={[0.56, 0.48, 0.56]}
                castShadow
              >
                <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {/* замковое кольцо свода (ключевой камень ротонды) */}
      <mesh position-y={0.16 + vaultH} castShadow>
        <cylinderGeometry args={[radius * 0.52, radius * 0.62, 0.1, 8]} />
        <meshStandardMaterial
          color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>

      {/* парящий многослойный некротический кристалл + тёмное ядро */}
      <mesh ref={crystalRef} geometry={geoms.crystal} position-y={0.48} scale={isCathedral ? 1.08 : 0.9}>
        <meshStandardMaterial {...createNecroticCrystalMaterialProps()} />
      </mesh>
      <mesh ref={coreRef} geometry={geoms.crystalCore} position-y={0.48} scale={isCathedral ? 1.0 : 0.85}>
        <meshStandardMaterial color="#0b2820" emissive="#124e3c" emissiveIntensity={0.6} roughness={0.2} metalness={0.6} />
      </mesh>

      {/* вращающиеся рунные орбиты вокруг кристалла */}
      {ringCount >= 1 ? (
        <mesh ref={ring1Ref} position-y={0.48} rotation={[0.52, 0, 0.28]}>
          <torusGeometry args={[radius * 0.58, 0.018, 6, 20]} />
          <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.36} metalness={0.84} />
        </mesh>
      ) : null}
      {ringCount >= 2 ? (
        <mesh ref={ring2Ref} position-y={0.48} rotation={[-0.48, 0.35, 0.5]}>
          <torusGeometry args={[radius * 0.72, 0.016, 6, 20]} />
          <meshStandardMaterial map={tex.ironMap} roughness={0.38} metalness={0.88} />
        </mesh>
      ) : null}

      {/* сфокусированный локальный некротический свет (освещает свод ротонды изнутри) */}
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        color={CITADEL_PALETTE.necroticGlow}
        intensity={isCathedral ? 1.15 : 0.8}
        distance={3.4}
        decay={2}
      />

      {/* ажурный готический шпиль-венец над замковым камнем */}
      <mesh geometry={geoms.pinnacleSpire} position-y={0.18 + vaultH} scale={[1.38, 0.92, 1.38]} castShadow>
        <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.12} />
      </mesh>
      {/* золочёно-кованый крестоцвет на макушке */}
      <mesh position-y={0.18 + vaultH + 0.94} castShadow>
        <coneGeometry args={[0.044, 0.24, 6]} />
        <meshStandardMaterial
          color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.38}
          metalness={0.84}
        />
      </mesh>
    </group>
  );
}

/**
 * МАССИВНЫЙ ГОТИЧЕСКИЙ ПОРТАЛ (+Z) С ГЛУБОКОЙ РЕЗЬБОЙ:
 * уступчатые перспективные архивольты (2..3 слоя), тонкие колонки с капителями,
 * резной трилистник тимпана, острый вимперг с краббами, геральдический щит,
 * костяные рогатые трофеи, окованные ворота с заклёпками и зубастая герса.
 */
function CitadelPortal({
  spec,
  keepBaseY,
  keepHalf,
  geoms,
  tex,
}: {
  spec: CitadelLevelVisualSpec;
  keepBaseY: number;
  keepHalf: number;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const zFace = keepHalf;
  const isBarbican = spec.gateStyle === "barbican-fortress";
  const hasPorch = spec.level >= 2;
  const hasPortcullis = spec.level >= 3;
  const porchDepth = isBarbican ? 0.36 : spec.level >= 3 ? 0.28 : spec.level === 2 ? 0.22 : 0.16;
  const frontZ = zFace + porchDepth;
  const doorW = isBarbican ? 0.72 : spec.level >= 3 ? 0.64 : 0.56;
  const doorH = isBarbican ? 1.06 : spec.level >= 3 ? 0.96 : 0.88;
  const doorZ = frontZ - (spec.portalArchTiers - 1) * 0.065 - 0.04;
  const gilded = spec.goldTrimStage === "gilded-tracery" || spec.goldTrimStage === "sovereign-filigree";

  return (
    <group>
      {/* корпус портального притвора / барбакана: боковые устои + свод над проёмом, открытая ниша для ворот */}
      <group position={[0, keepBaseY, zFace + porchDepth / 2]}>
        {/* перемычка-антреволь над аркой проёма (оставляет проход открытым до doorZ!) */}
        <mesh position-y={doorH * 0.86} castShadow receiveShadow>
          <boxGeometry args={[doorW + 0.4, doorH * 0.24, porchDepth]} />
          <meshStandardMaterial
            map={tex.basaltMap}
            bumpMap={tex.basaltBump}
            roughnessMap={tex.basaltRoughness}
            bumpScale={0.032}
            roughness={0.9}
          />
        </mesh>
        {/* боковые устои ниши (обрамляют уступчатый проём слева и справа, оставляя ворота полностью видимыми) */}
        {[-1, 1].map((sx) => (
          <mesh key={`jamb${sx}`} position={[sx * (doorW * 0.48 + 0.12), doorH * 0.44, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.24, doorH * 0.88, porchDepth]} />
            <meshStandardMaterial
              map={tex.basaltMap}
              bumpMap={tex.basaltBump}
              roughnessMap={tex.basaltRoughness}
              bumpScale={0.032}
              roughness={0.9}
            />
          </mesh>
        ))}
        {/* боковые портальные пилоны (с пинаклями на ур. 3..5) */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * (doorW * 0.56 + 0.1), 0, porchDepth * 0.16]}>
            <mesh position-y={doorH * 0.68} castShadow>
              <boxGeometry args={[0.2, doorH * 1.36, porchDepth * 0.92]} />
              <meshStandardMaterial
                map={tex.dressedMap}
                bumpMap={tex.dressedBump}
                roughnessMap={tex.dressedRoughness}
                bumpScale={0.025}
                roughness={0.86}
              />
            </mesh>
            {spec.hasPinnacles ? (
              <mesh geometry={geoms.pinnacleSpire} position-y={doorH * 1.36} scale={[0.62, 0.44, 0.62]} castShadow>
                <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
              </mesh>
            ) : (
              <mesh position-y={doorH * 1.38} castShadow>
                <coneGeometry args={[0.13, 0.22, 4]} />
                <meshStandardMaterial map={tex.slateMap} roughness={0.72} />
              </mesh>
            )}
            {/* костяные трофеи или щиты на пилонах барбакана (ур. 4..5) */}
            {spec.level >= 4 ? (
              <HornedSkullTrophy position={[0, doorH * 0.92, porchDepth * 0.48]} scale={0.78} geoms={geoms} tex={tex} />
            ) : null}
          </group>
        ))}

        {/* накрывающая скатная крыша притвора (строго в профиль вимперга, без торчащих углов) */}
        {hasPorch ? (
          <mesh
            geometry={geoms.gableRoof}
            position={[0, doorH * 0.78, -0.02]}
            scale={[doorW + 0.34, 0.64, porchDepth * 0.94]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.74} />
          </mesh>
        ) : null}
      </group>

      {/* ПЕРСПЕКТИВНЫЕ СТУПЕНЧАТЫЕ АРХИВОЛЬТЫ (2 или 3 вложенных стрельчатых обвода!) */}
      {Array.from({ length: spec.portalArchTiers }, (_, tier) => {
        const shrink = tier * 0.14;
        const z = frontZ - tier * 0.065;
        return (
          <group key={`arch${tier}`}>
            <mesh
              geometry={geoms.pointedArch}
              position={[0, keepBaseY, z]}
              scale={[doorW + 0.38 - shrink, doorH + 0.3 - shrink * 0.72, 0.085]}
              castShadow
            >
              <meshStandardMaterial
                map={tex.dressedMap}
                bumpMap={tex.dressedBump}
                roughnessMap={tex.dressedRoughness}
                bumpScale={0.024}
                roughness={0.86}
              />
            </mesh>
            {/* тонкие боковые колонки-пилястры у каждого уступа */}
            {[-1, 1].map((sx) => (
              <mesh
                key={sx}
                position={[sx * ((doorW + 0.3 - shrink) * 0.41), keepBaseY + (doorH + 0.1 - shrink) * 0.32, z + 0.032]}
              >
                <cylinderGeometry args={[0.026, 0.032, (doorH + 0.1 - shrink) * 0.64, 6]} />
                <meshStandardMaterial
                  color={tier === 0 && gilded ? "#6e5632" : CITADEL_PALETTE.stoneDressed}
                  roughness={tier === 0 && gilded ? 0.46 : 0.84}
                  metalness={tier === 0 && gilded ? 0.7 : 0.06}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ВЫСОКИЙ РЕЗНОЙ ГОТИЧЕСКИЙ ВИМПЕРГ С КРАББАМИ НАД ПОРТАЛОМ */}
      <mesh
        geometry={geoms.wimperg}
        position={[0, keepBaseY + doorH * 0.76, frontZ + 0.04]}
        scale={[doorW + 0.44, 0.74, 0.08]}
        castShadow
      >
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.024}
          roughness={0.84}
        />
      </mesh>
      {/* шпиль-крестоцвет вимперга */}
      <mesh position={[0, keepBaseY + doorH * 0.76 + 0.86, frontZ + 0.04]} castShadow>
        <coneGeometry args={[0.034, 0.18, 4]} />
        <meshStandardMaterial
          color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>

      {/* РЕЗНОЙ ТИМПАН-ТРИЛИСТНИК + ГЕРБОВЫЙ ЩИТ + КОСТЯНОЙ ЧЕРЕП */}
      <mesh
        geometry={geoms.trefoilTracery}
        position={[0, keepBaseY + doorH * 0.78, frontZ - 0.11]}
        scale={[doorW * 0.86, 0.42, 0.04]}
      >
        <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
      </mesh>
      <HeraldicShield
        position={[0, keepBaseY + doorH + 0.16, frontZ + 0.075]}
        scale={isBarbican ? 0.92 : 0.78}
        gilded={gilded}
        geoms={geoms}
        tex={tex}
      />
      {spec.level >= 2 && spec.level <= 3 ? (
        <HornedSkullTrophy
          position={[0, keepBaseY + doorH + 0.36, frontZ + 0.07]}
          scale={0.72}
          geoms={geoms}
          tex={tex}
        />
      ) : null}

      {/* САЖИСТАЯ КОПОТЬ НА ПИЛОНАХ НАД ЖАРОВНЯМИ (ур. 2..5, не перекрывает проём арки) */}
      {spec.level >= 2
        ? [-1, 1].map((sx) => (
            <mesh
              key={`soot${sx}`}
              position={[sx * (doorW * 0.56 + 0.1), keepBaseY + doorH * 0.96, zFace + porchDepth * 0.63]}
            >
              <planeGeometry args={[0.19, 0.44]} />
              <meshStandardMaterial map={tex.sootOverlay} transparent opacity={0.44} depthWrite={false} roughness={0.98} />
            </mesh>
          ))
        : null}

      {/* МАССИВНЫЕ ОКОВАННЫЕ ДУБОВЫЕ ВРАТА В ГЛУБИНЕ НИШИ */}
      <group position={[0, keepBaseY, doorZ]}>
        <mesh position-y={doorH * 0.44} castShadow>
          <boxGeometry args={[doorW * 0.84, doorH * 0.86, 0.06]} />
          <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.028} roughness={0.9} />
        </mesh>
            {/* кованые полосы петель + заклёпки + центральная планка */}
            {[-0.22, 0.04, 0.28].map((dy, idx) => (
              <group key={idx} position={[0, doorH * 0.44 + dy, 0.038]}>
                <mesh castShadow>
                  <boxGeometry args={[doorW * 0.78, 0.048, 0.022]} />
                  <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.55} metalness={0.86} />
                </mesh>
                {[-0.22, -0.09, 0.09, 0.22].map((rx) => (
                  <mesh key={rx} position={[rx, 0, 0.014]}>
                    <sphereGeometry args={[0.015, 5, 5]} />
                    <meshStandardMaterial color="#4e545e" roughness={0.34} metalness={0.88} />
                  </mesh>
                ))}
              </group>
            ))}
            <mesh position={[0, doorH * 0.44, 0.038]}>
              <boxGeometry args={[0.032, doorH * 0.84, 0.022]} />
              <meshStandardMaterial map={tex.ironMap} roughness={0.5} metalness={0.86} />
            </mesh>
            {/* кованые дверные кольца */}
            {[-0.12, 0.12].map((rx) => (
              <mesh key={rx} position={[rx, doorH * 0.42, 0.052]}>
                <torusGeometry args={[0.036, 0.01, 5, 10]} />
                <meshStandardMaterial color="#735b36" roughness={0.44} metalness={0.82} />
              </mesh>
            ))}
            {/* ПОДНЯТАЯ ЗУБАСТАЯ ГЕРСА (ур. 3..5) */}
            {hasPortcullis ? (
              <group position={[0, doorH * 0.66, 0.056]}>
                <mesh position-y={0.1}>
                  <boxGeometry args={[doorW * 0.82, 0.04, 0.03]} />
                  <meshStandardMaterial color="#1f2329" roughness={0.46} metalness={0.88} />
                </mesh>
                {[-0.24, -0.12, 0, 0.12, 0.24].map((x) => (
                  <group key={x} position={[x, 0, 0]}>
                    <mesh>
                      <boxGeometry args={[0.026, 0.3, 0.026]} />
                      <meshStandardMaterial color="#1f2329" roughness={0.46} metalness={0.88} />
                    </mesh>
                    <mesh position-y={-0.17} rotation-x={Math.PI}>
                      <coneGeometry args={[0.024, 0.08, 4]} />
                      <meshStandardMaterial color="#2a2f36" roughness={0.4} metalness={0.88} />
                    </mesh>
                  </group>
                ))}
              </group>
            ) : null}
          </group>
    </group>
  );
}

export function CitadelV2Building({ level = 1, grid }: { level?: number; grid: CourtGridLite }) {
  const spec = getCitadelVisualSpec(level);
  const tex = useCitadelTextureSet();
  const geoms = useCitadelGeometrySet();

  const at = grid.buildings.find((b) => b.type === "townhall") ?? { x: 7, z: 7 };
  const center = footprintCenterToWorld("townhall", at.x, at.z, grid.size);

  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const [ox, oy, oz] = spec.smokeOrigin;
    smokeRefs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.2 + i / 5) % 1;
      m.position.set(ox + Math.sin((p + i) * 4.5) * 0.09, oy + p * 1.65, oz);
      m.scale.setScalar(0.38 + p * 1.15);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.28 * (1 - p);
    });
  });

  const keepBaseY = spec.plinthHeight;
  const keepTopY = keepBaseY + spec.keepHeight;
  const upperTopY = keepTopY + spec.upperHeight;
  const keepHalf = spec.keepWidth / 2;
  const upperHalf = spec.upperWidth / 2;
  const plinthHalf = spec.plinthSize / 2;

  const isGilded = spec.goldTrimStage === "gilded-tracery" || spec.goldTrimStage === "sovereign-filigree";
  const isSovereign = spec.level === 5;
  const isBarbican = spec.gateStyle === "barbican-fortress";
  const turretRadius = spec.level >= 5 ? 0.33 : spec.level === 4 ? 0.31 : spec.level === 3 ? 0.31 : 0.32;
  const turretOffset = spec.level >= 4 ? keepHalf - 0.04 : keepHalf - 0.02;
  const turretHeight =
    spec.level === 5
      ? spec.keepHeight + spec.upperHeight + 0.44
      : spec.level === 4
        ? spec.keepHeight + spec.upperHeight + 0.2
        : spec.level === 3
          ? spec.keepHeight + spec.upperHeight + 0.08
          : spec.keepHeight + spec.upperHeight + 0.42;
  const turretSpireHeight = spec.level >= 5 ? 0.98 : spec.level === 4 ? 0.84 : spec.level === 3 ? 0.72 : 0.84;
  const turretBannerY = keepBaseY + turretHeight + turretSpireHeight + (spec.level >= 4 ? 0.14 : 0.06);

  const turretPositions: readonly (readonly [number, number])[] =
    spec.turretLayout === "single-watch"
      ? [[-turretOffset, turretOffset]]
      : spec.turretLayout === "twin-front"
        ? [
            [-turretOffset, turretOffset],
            [turretOffset, turretOffset],
          ]
        : spec.turretLayout === "four-corner" || spec.turretLayout === "four-bastion-spired"
          ? [
              [-turretOffset, turretOffset],
              [turretOffset, turretOffset],
              [-turretOffset, -turretOffset],
              [turretOffset, -turretOffset],
            ]
          : [];

  const buttressLateralOffsets = spec.level >= 4 ? [-0.54, 0.54] : [-0.46, 0.46];

  return (
    <group position={[center.wx, 0.08, center.wz]} rotation-y={Math.PI / 2}>
      {/* ---------- 1. СТУПЕНЧАТЫЙ СКОШЕННЫЙ КАМЕННЫЙ ПОДИУМ И ЛЕСТНИЦА ---------- */}
      <mesh position-y={spec.plinthHeight * 0.45} rotation-y={Math.PI / 4} castShadow receiveShadow>
        <cylinderGeometry
          args={[(spec.plinthSize * 0.96) / Math.SQRT2, (spec.plinthSize + 0.16) / Math.SQRT2, spec.plinthHeight * 0.9, 4]}
        />
        <meshStandardMaterial
          map={tex.basaltMap}
          bumpMap={tex.basaltBump}
          roughnessMap={tex.basaltRoughness}
          bumpScale={0.034}
          roughness={0.92}
        />
      </mesh>
      <mesh position-y={spec.plinthHeight - 0.038} castShadow receiveShadow>
        <boxGeometry args={[spec.plinthSize, 0.076, spec.plinthSize]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.025}
          roughness={0.88}
        />
      </mesh>

      {/* парадная каменная лестница внутри пятна (<= spec.stepReachZ) */}
      {Array.from({ length: spec.stepCount }, (_, i) => {
        const stepD = (spec.stepReachZ - plinthHalf + 0.12) / spec.stepCount;
        const zCenter = plinthHalf - 0.06 + stepD * (i + 0.5);
        const stepH = spec.plinthHeight * ((spec.stepCount - i) / spec.stepCount);
        const stepW = 1.12 - i * 0.08;
        return (
          <mesh key={i} position={[0, stepH / 2, zCenter]} castShadow receiveShadow>
            <boxGeometry args={[stepW, stepH, stepD + 0.04]} />
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.88} />
          </mesh>
        );
      })}
      {spec.level >= 2
        ? [-0.58, 0.58].map((sx) => (
            <mesh
              key={sx}
              position={[sx, spec.plinthHeight * 0.52, (plinthHalf + spec.stepReachZ) / 2 - 0.06]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.13, spec.plinthHeight * 0.96, spec.stepReachZ - plinthHalf + 0.14]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
            </mesh>
          ))
        : null}

      {/* ---------- 2. НИЖНИЙ ЯРУС С ТРЁХМЕРНЫМИ РУСТАМИ, АРКАДАМИ И КОНТРФОРСАМИ ---------- */}
      <mesh position-y={keepBaseY + spec.keepHeight / 2} castShadow receiveShadow>
        <boxGeometry args={[spec.keepWidth, spec.keepHeight, spec.keepWidth]} />
        <meshStandardMaterial
          map={tex.basaltMap}
          bumpMap={tex.basaltBump}
          roughnessMap={tex.basaltRoughness}
          bumpScale={0.038}
          roughness={0.9}
        />
      </mesh>

      {/* 3D-перевязка угловых рустовых камней (на углах без башен) */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => {
        const coveredByTurret = turretPositions.some(([tx, tz]) => Math.sign(tx) === sx && Math.sign(tz) === sz);
        if (coveredByTurret) return null;
        return (
          <StaggeredCornerQuoins
            key={i}
            x={sx! * keepHalf}
            z={sz! * keepHalf}
            baseY={keepBaseY}
            height={spec.keepHeight}
            sx={sx!}
            sz={sz!}
            tex={tex}
          />
        );
      })}

      {/* профилированный каменный кордон-карниз между ярусами */}
      <mesh position-y={keepTopY} castShadow receiveShadow>
        <boxGeometry args={[spec.keepWidth + 0.16, 0.11, spec.keepWidth + 0.16]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          roughnessMap={tex.dressedRoughness}
          bumpScale={0.025}
          roughness={0.88}
        />
      </mesh>
      {spec.goldTrimStage !== "none" && spec.goldTrimStage !== "subtle-keystone" ? (
        <mesh position-y={keepTopY + 0.01}>
          <boxGeometry args={[spec.keepWidth + 0.175, 0.016, spec.keepWidth + 0.175]} />
          <meshStandardMaterial color="#6e5632" roughness={0.48} metalness={0.76} />
        </mesh>
      ) : null}

      {/* МАССИВНЫЙ ГОТИЧЕСКИЙ ПОРТАЛ (+Z) */}
      <CitadelPortal spec={spec} keepBaseY={keepBaseY} keepHalf={keepHalf} geoms={geoms} tex={tex} />

      {/* УТОПЛЕННЫЕ АРКАДЫ И ГОТИЧЕСКИЕ ОКНА БОКОВЫХ ФАСАДОВ */}
      {[-1, 1].map((side) => (
        <group key={`flank${side}`}>
          {/* каменная пилястра-аркада обрамления бокового фасада */}
          <mesh
            geometry={geoms.pointedArch}
            position={[side * (keepHalf + 0.015), keepBaseY + 0.06, 0]}
            rotation-y={(side * Math.PI) / 2}
            scale={[0.88, spec.keepHeight * 0.88, 0.06]}
            castShadow
          >
            <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.025} roughness={0.9} />
          </mesh>
          <RecessedLancetWindow
            position={[side * keepHalf, keepBaseY + spec.keepHeight * 0.52, 0]}
            rotationY={(side * Math.PI) / 2}
            width={0.3}
            height={0.52}
            mode="hearth"
            gilded={isGilded}
            tracery={spec.level >= 3}
            geoms={geoms}
            tex={tex}
          />
          {spec.hasHeraldicShields && spec.level >= 3 ? (
            <HeraldicShield
              position={[side * (keepHalf + 0.03), keepTopY - 0.16, side * 0.42]}
              rotationY={(side * Math.PI) / 2}
              scale={0.7}
              gilded={isGilded}
              geoms={geoms}
              tex={tex}
            />
          ) : null}
        </group>
      ))}

      {/* ТЫЛЬНЫЙ (-Z) ФАСАД: ОКНО НА L1..2 ИЛИ ГОТИЧЕСКАЯ АПСИДА С НЕРВЮРАМИ НА L3..5 */}
      {!spec.hasRearApse ? (
        <group>
          <mesh
            geometry={geoms.pointedArch}
            position={[0, keepBaseY + 0.06, -(keepHalf + 0.015)]}
            rotation-y={Math.PI}
            scale={[0.88, spec.keepHeight * 0.88, 0.06]}
            castShadow
          >
            <meshStandardMaterial map={tex.basaltMap} roughness={0.9} />
          </mesh>
          <RecessedLancetWindow
            position={[0, keepBaseY + spec.keepHeight * 0.52, -keepHalf]}
            rotationY={Math.PI}
            width={0.3}
            height={0.52}
            mode="hearth"
            geoms={geoms}
            tex={tex}
          />
        </group>
      ) : (
        <group position={[0, 0, -keepHalf - 0.08]}>
          <mesh position-y={keepBaseY + (spec.keepHeight + spec.upperHeight * 0.56) / 2} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.48, spec.keepHeight + spec.upperHeight * 0.56, 6]} />
            <meshStandardMaterial
              map={tex.basaltMap}
              bumpMap={tex.basaltBump}
              roughnessMap={tex.basaltRoughness}
              bumpScale={0.034}
              roughness={0.9}
            />
          </mesh>
          {/* вертикальные нервюры по рёбрам шестигранной апсиды */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const ang = (i * Math.PI) / 3;
            return (
              <mesh
                key={i}
                position={[
                  Math.sin(ang) * 0.44,
                  keepBaseY + (spec.keepHeight + spec.upperHeight * 0.56) * 0.5,
                  Math.cos(ang) * 0.44,
                ]}
                castShadow
              >
                <boxGeometry args={[0.055, spec.keepHeight + spec.upperHeight * 0.56, 0.055]} />
                <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
              </mesh>
            );
          })}
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.56 + 0.02} castShadow>
            <cylinderGeometry args={[0.49, 0.44, 0.085, 6]} />
            <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
          </mesh>
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.56 + 0.39} castShadow>
            <coneGeometry args={[0.51, 0.7, 6]} />
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.026} roughness={0.74} />
          </mesh>
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.56 + 0.8} castShadow>
            <coneGeometry args={[0.035, 0.22, 6]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.82} />
          </mesh>
          <RecessedLancetWindow
            position={[0, keepBaseY + spec.keepHeight * 0.58, -0.44]}
            rotationY={Math.PI}
            width={0.24}
            height={0.58}
            mode={spec.level >= 4 ? "necrotic" : "hearth"}
            gilded={isGilded}
            tracery
            geoms={geoms}
            tex={tex}
          />
        </group>
      )}

      {/* СТУПЕНЧАТЫЕ КОНТРФОРСЫ С РЕЗНЫМИ ПИНАКЛЯМИ ПО БОКАМ И ТЫЛУ (С УР. 1..5!) */}
      {buttressLateralOffsets.map((lat) => (
        <group key={`but${lat}`}>
          {[
            { pos: [keepHalf, keepBaseY, lat] as const, rot: Math.PI / 2, pinX: keepHalf + 0.09, pinZ: lat },
            { pos: [-keepHalf, keepBaseY, lat] as const, rot: -Math.PI / 2, pinX: -(keepHalf + 0.09), pinZ: lat },
          ].map((b, bi) => (
            <group key={bi}>
              <mesh
                geometry={geoms.buttress}
                position={b.pos}
                rotation-y={b.rot}
                scale={[0.17, spec.keepHeight * 0.98, 0.27]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  map={tex.dressedMap}
                  bumpMap={tex.dressedBump}
                  roughnessMap={tex.dressedRoughness}
                  bumpScale={0.024}
                  roughness={0.88}
                />
              </mesh>
              {spec.hasPinnacles ? (
                <mesh
                  geometry={geoms.pinnacleSpire}
                  position={[b.pinX, keepBaseY + spec.keepHeight * 0.95, b.pinZ]}
                  scale={[0.54, 0.42, 0.54]}
                  castShadow
                >
                  <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
                </mesh>
              ) : null}
            </group>
          ))}
          {spec.level >= 2 ? (
            <group>
              <mesh
                geometry={geoms.buttress}
                position={[lat, keepBaseY, -keepHalf]}
                rotation-y={Math.PI}
                scale={[0.17, spec.keepHeight * 0.96, 0.24]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
              </mesh>
              {spec.hasPinnacles ? (
                <mesh
                  geometry={geoms.pinnacleSpire}
                  position={[lat, keepBaseY + spec.keepHeight * 0.93, -(keepHalf + 0.08)]}
                  scale={[0.48, 0.38, 0.48]}
                  castShadow
                >
                  <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
                </mesh>
              ) : null}
            </group>
          ) : null}
        </group>
      ))}

      {/* ---------- 3. ВТОРОЙ ЯРУС С ВЫРАЖЕННЫМ РЕЛЬЕФОМ И АРКАДАМИ ---------- */}
      <mesh position-y={keepTopY + spec.upperHeight / 2} castShadow receiveShadow>
        <boxGeometry args={[spec.upperWidth, spec.upperHeight, spec.upperWidth]} />
        <meshStandardMaterial
          map={spec.level === 1 ? tex.timberMap : tex.basaltMap}
          bumpMap={spec.level === 1 ? tex.timberBump : tex.basaltBump}
          roughnessMap={spec.level === 1 ? undefined : tex.basaltRoughness}
          bumpScale={0.032}
          roughness={0.9}
        />
      </mesh>

      {/* деревянно-кованый каркас, раскосы и консоли-подкосы (L1..L2 ярко выражены) */}
      {spec.level <= 3
        ? [-1, 1].map((side) => (
            <group key={`tm${side}`}>
              {[-upperHalf * 0.68, 0, upperHalf * 0.68].map((off) => (
                <group key={off}>
                  <mesh position={[off, keepTopY + spec.upperHeight * 0.5, side * (upperHalf + 0.018)]} castShadow>
                    <boxGeometry args={[0.08, spec.upperHeight, 0.045]} />
                    <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.022} roughness={0.88} />
                  </mesh>
                  <mesh position={[off, keepTopY - 0.12, side * (upperHalf - 0.03)]} rotation-x={side * 0.45} castShadow>
                    <boxGeometry args={[0.07, 0.24, 0.095]} />
                    <meshStandardMaterial map={tex.timberMap} roughness={0.88} />
                  </mesh>
                </group>
              ))}
              {[-upperHalf * 0.68, 0, upperHalf * 0.68].map((off) => (
                <group key={`s${off}`}>
                  <mesh position={[side * (upperHalf + 0.018), keepTopY + spec.upperHeight * 0.5, off]} castShadow>
                    <boxGeometry args={[0.045, spec.upperHeight, 0.08]} />
                    <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.022} roughness={0.88} />
                  </mesh>
                  <mesh position={[side * (upperHalf - 0.03), keepTopY - 0.12, off]} rotation-z={-side * 0.45} castShadow>
                    <boxGeometry args={[0.095, 0.24, 0.07]} />
                    <meshStandardMaterial map={tex.timberMap} roughness={0.88} />
                  </mesh>
                </group>
              ))}
            </group>
          ))
        : null}

      {/* готические окна верхнего яруса по всем 4 фасадам + боковые пилястры аркад */}
      {[
        { pos: [0, keepTopY + spec.upperHeight * 0.5, upperHalf] as const, rot: 0 },
        { pos: [0, keepTopY + spec.upperHeight * 0.5, -upperHalf] as const, rot: Math.PI },
        { pos: [upperHalf, keepTopY + spec.upperHeight * 0.5, 0] as const, rot: Math.PI / 2 },
        { pos: [-upperHalf, keepTopY + spec.upperHeight * 0.5, 0] as const, rot: -Math.PI / 2 },
      ].map((w, idx) => (
        <RecessedLancetWindow
          key={`uw${idx}`}
          position={w.pos}
          rotationY={w.rot}
          width={spec.level >= 4 ? 0.36 : 0.28}
          height={spec.level >= 4 ? 0.54 : 0.42}
          mode={spec.level === 5 && idx === 1 ? "necrotic" : "hearth"}
          gilded={isGilded}
          tracery={spec.level >= 4}
          geoms={geoms}
          tex={tex}
        />
      ))}

      {/* машикули и костяные кронштейны верхнего яруса (ур. 4..5) */}
      {spec.hasMachicolations ? (
        <mesh position-y={upperTopY - 0.06} castShadow>
          <boxGeometry args={[spec.upperWidth + 0.18, 0.12, spec.upperWidth + 0.18]} />
          <meshStandardMaterial
            map={tex.dressedMap}
            bumpMap={tex.dressedBump}
            roughnessMap={tex.dressedRoughness}
            bumpScale={0.022}
            roughness={0.86}
          />
        </mesh>
      ) : null}

      {/* ---------- 4. КРОВЛЯ ОСНОВНОГО ОБЪЁМА / ВИМПЕРГИ / БОЕВОЙ ПАРАПЕТ ---------- */}
      {spec.roofStyle === "pitched-manor" ? (
        <group position-y={upperTopY}>
          <mesh
            geometry={geoms.gableRoof}
            scale={[spec.upperWidth + 0.24, 0.92, spec.upperWidth + 0.22]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.74} />
          </mesh>
          {/* передний резной вимперг с краббами на фронтоне 1-го уровня */}
          <mesh
            geometry={geoms.wimperg}
            position={[0, 0, upperHalf + 0.12]}
            scale={[spec.upperWidth + 0.18, 0.88, 0.075]}
            castShadow
          >
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.86} />
          </mesh>
          <mesh position-y={0.94} castShadow>
            <boxGeometry args={[0.1, 0.1, spec.upperWidth + 0.28]} />
            <meshStandardMaterial map={tex.timberMap} roughness={0.86} />
          </mesh>
          <mesh position-y={1.12} castShadow>
            <coneGeometry args={[0.042, 0.34, 6]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.84} />
          </mesh>
        </group>
      ) : null}

      {spec.roofStyle === "hip-dormer" ? (
        <group position-y={upperTopY}>
          <mesh position-y={0.54} rotation-y={Math.PI / 4} castShadow receiveShadow>
            <coneGeometry args={[spec.upperWidth * 0.78, 1.08, 4]} />
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.74} />
          </mesh>
          <mesh
            geometry={geoms.gableRoof}
            position={[0, 0.04, upperHalf * 0.42]}
            scale={[0.88, 0.66, 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.74} />
          </mesh>
          <mesh
            geometry={geoms.wimperg}
            position={[0, 0.04, upperHalf * 0.86]}
            scale={[0.92, 0.68, 0.06]}
            castShadow
          >
            <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
          </mesh>
          {/* ЗАЧАТОЧНЫЙ КОВАНЫЙ НЕКРОТИЧЕСКИЙ ФОНАРЬ-МАЯК НА КОНЬКЕ УР. 2 */}
          <group position-y={1.08}>
            <mesh position-y={0.14} castShadow>
              <cylinderGeometry args={[0.12, 0.16, 0.26, 4]} />
              <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.82} />
            </mesh>
            <mesh position-y={0.16}>
              <octahedronGeometry args={[0.075, 0]} />
              <meshStandardMaterial {...createNecroticCrystalMaterialProps()} emissiveIntensity={0.62} />
            </mesh>
            <mesh position-y={0.36} castShadow>
              <coneGeometry args={[0.16, 0.26, 4]} />
              <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.76} />
            </mesh>
          </group>
        </group>
      ) : null}

      {spec.hasBattlements ? (
        <BattlementPerimeter
          halfSpan={upperHalf + 0.06}
          y={upperTopY}
          weatheringStage={spec.weatheringStage}
          geoms={geoms}
          tex={tex}
          hasCornerPinacles={spec.hasPinnacles}
          skipCorners={spec.turretCount === 4}
        />
      ) : null}

      {/* крестообразная готическая кровля с 4 резными вимпергами-щипцами (L4..5) */}
      {spec.level >= 4 ? (
        <group position-y={upperTopY + 0.02}>
          <mesh
            geometry={geoms.gableRoof}
            scale={[spec.upperWidth * 0.88, 0.86, spec.upperWidth * 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.74} />
          </mesh>
          <mesh
            geometry={geoms.gableRoof}
            rotation-y={Math.PI / 2}
            scale={[spec.upperWidth * 0.88, 0.86, spec.upperWidth * 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.74} />
          </mesh>
          {/* резные каменные вимперги-краббы на всех 4 щипцах кровли */}
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, wi) => (
            <mesh
              key={wi}
              geometry={geoms.wimperg}
              position={[Math.sin(ang) * (upperHalf * 0.86), 0, Math.cos(ang) * (upperHalf * 0.86)]}
              rotation-y={ang}
              scale={[spec.upperWidth * 0.88, 0.86, 0.06]}
              castShadow
            >
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
            </mesh>
          ))}
        </group>
      ) : null}

      {/* ---------- 5. УГЛОВЫЕ БАШНИ-БАСТИОНЫ С НЕРВЮРНЫМИ ШАТРАМИ ---------- */}
      {turretPositions.map(([tx, tz], i) => (
        <CornerBastionTurret
          key={`tur${i}`}
          position={[tx, tz]}
          baseY={keepBaseY}
          height={turretHeight}
          radius={turretRadius}
          spireHeight={turretSpireHeight}
          hasCrownRing={spec.level >= 4}
          hasBoneSpurs={spec.boneAccentStage === "spur-finials" || spec.boneAccentStage === "ossuary-crown"}
          hasRibbedSpire={spec.level >= 3}
          gildedTrim={isGilded}
          geoms={geoms}
          tex={tex}
        />
      ))}

      {/* АЖУРНЫЕ ПРОРЕЗНЫЕ АРКБУТАНЫ 5-ГО УРОВНЯ (от башен к соборному реликварию) */}
      {spec.hasFlyingButtresses
        ? turretPositions.map(([tx, tz], i) => {
            const sx = Math.sign(tx);
            const sz = Math.sign(tz);
            const outerX = tx * 0.92;
            const outerZ = tz * 0.92;
            const span = Math.hypot(outerX, outerZ) - spec.belfryWidth * 0.56;
            return (
              <mesh
                key={`fly${i}`}
                geometry={geoms.flyingButtress}
                position={[outerX, upperTopY + 0.36, outerZ]}
                rotation-y={Math.atan2(sz, -sx)}
                scale={[Math.max(0.58, span), spec.belfryHeight * 0.86, 0.15]}
                castShadow
              >
                <meshStandardMaterial
                  map={tex.dressedMap}
                  bumpMap={tex.dressedBump}
                  roughnessMap={tex.dressedRoughness}
                  bumpScale={0.022}
                  roughness={0.86}
                />
              </mesh>
            );
          })
        : null}

      {/* ---------- 6. ЦЕНТРАЛЬНАЯ БАШНЯ-ДОНЖОН И НЕКРОТИЧЕСКИЙ РЕЛИКВАРИЙ (УР. 3..5) ---------- */}
      {spec.belfryHeight > 0 ? (
        <group position-y={upperTopY}>
          <mesh position-y={spec.belfryHeight / 2} castShadow receiveShadow>
            <boxGeometry args={[spec.belfryWidth, spec.belfryHeight, spec.belfryWidth]} />
            <meshStandardMaterial
              map={tex.basaltMap}
              bumpMap={tex.basaltBump}
              roughnessMap={tex.basaltRoughness}
              bumpScale={0.034}
              roughness={0.9}
            />
          </mesh>
          {/* угловые контрфорсные колонки донжона */}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <mesh
              key={i}
              position={[sx! * (spec.belfryWidth * 0.47), spec.belfryHeight / 2, sz! * (spec.belfryWidth * 0.47)]}
              castShadow
            >
              <boxGeometry args={[0.17, spec.belfryHeight + 0.05, 0.17]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
            </mesh>
          ))}
          <mesh position-y={spec.belfryHeight - 0.05} castShadow>
            <boxGeometry args={[spec.belfryWidth + 0.15, 0.1, spec.belfryWidth + 0.15]} />
            <meshStandardMaterial
              color={isGilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.stoneDressed}
              roughness={isGilded ? 0.42 : 0.86}
              metalness={isGilded ? 0.76 : 0.05}
            />
          </mesh>
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, idx) => (
            <RecessedLancetWindow
              key={`bw${idx}`}
              position={[
                Math.sin(rot) * (spec.belfryWidth / 2),
                spec.belfryHeight * 0.56,
                Math.cos(rot) * (spec.belfryWidth / 2),
              ]}
              rotationY={rot}
              width={0.24}
              height={0.46}
              mode={spec.level === 3 || idx % 2 === 0 ? "necrotic" : "hearth"}
              gilded={isGilded}
              tracery
              geoms={geoms}
              tex={tex}
            />
          ))}

          {/* ВЫРАЗИТЕЛЬНЫЙ ЦЕНТРАЛЬНЫЙ НЕКРОТИЧЕСКИЙ РЕЛИКВАРИЙ (L3 -> L4 -> L5) */}
          <NecroticReliquaryCrown
            y={spec.belfryHeight}
            scale={isSovereign ? 1.02 : spec.level === 4 ? 0.94 : 0.84}
            level={spec.level as 3 | 4 | 5}
            ringCount={spec.reliquaryRings}
            gilded={isGilded}
            geoms={geoms}
            tex={tex}
          />
        </group>
      ) : null}

      {/* ---------- 7. ЗАКОПЧЁННАЯ ТРУБА ОЧАГА С ПЕПЕЛЬНЫМ ДЫМОМ ---------- */}
      <group position={[keepHalf - 0.16, keepBaseY + spec.keepHeight, -keepHalf + 0.16]}>
        <mesh position-y={0.45} castShadow>
          <boxGeometry args={[0.25, 1.12, 0.25]} />
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.025} roughness={0.9} />
        </mesh>
        {/* тёмная сажа по верху трубы */}
        <mesh position-y={0.92}>
          <boxGeometry args={[0.26, 0.22, 0.26]} />
          <meshStandardMaterial color={CITADEL_PALETTE.sootChar} roughness={0.96} />
        </mesh>
        <mesh position-y={1.06} castShadow>
          <boxGeometry args={[0.31, 0.08, 0.31]} />
          <meshStandardMaterial map={tex.ironMap} roughness={0.48} metalness={0.8} />
        </mesh>
      </group>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={`sm${i}`}
          ref={(m) => {
            smokeRefs.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshStandardMaterial {...createAshSmokeMaterialProps()} />
        </mesh>
      ))}

      {/* ---------- 8. ЖАРОВНИ И РВАНЫЕ БОЕВЫЕ ШТАНДАРТЫ ---------- */}
      {spec.brazierCount >= 2 ? (
        <>
          <IronBrazier position={[-0.66, keepBaseY, keepHalf + (isBarbican ? 0.38 : 0.22)]} tall={isBarbican} tex={tex} />
          <IronBrazier position={[0.66, keepBaseY, keepHalf + (isBarbican ? 0.38 : 0.22)]} tall={isBarbican} tex={tex} />
        </>
      ) : null}
      {spec.brazierCount === 4 ? (
        <>
          <IronBrazier position={[-0.84, upperTopY, -0.84]} tex={tex} />
          <IronBrazier position={[0.84, upperTopY, -0.84]} tex={tex} />
        </>
      ) : null}
      {spec.brazierCount >= 2 ? (
        <pointLight
          position={[0, keepBaseY + 0.72, keepHalf + 0.48]}
          color={CITADEL_PALETTE.flameGlow}
          intensity={0.58}
          distance={2.8}
          decay={2}
        />
      ) : null}

      {spec.bannerCount === 1 ? (
        <CitadelBanner position={[0, upperTopY + spec.belfryHeight + 1.38, 0]} scale={0.76} tex={tex} />
      ) : null}
      {spec.bannerCount >= 2 ? (
        <>
          {/* левая и правая башни относительно камеры после rotation-y=PI/2 (не перекрывают центральный реликварий!) */}
          <CitadelBanner position={[-turretOffset, turretBannerY, -turretOffset]} scale={0.68} phase={0.3} tex={tex} />
          <CitadelBanner position={[turretOffset, turretBannerY, turretOffset]} scale={0.68} phase={1.7} tex={tex} />
        </>
      ) : null}
      {spec.bannerCount === 4 ? (
        <>
          <CitadelBanner position={[turretOffset, turretBannerY, -turretOffset]} scale={0.68} phase={2.9} tex={tex} />
          <CitadelBanner position={[0, upperTopY + spec.belfryHeight + 1.66, 0]} scale={0.72} phase={4.1} tex={tex} />
        </>
      ) : null}
    </group>
  );
}
