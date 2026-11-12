/**
 * Архитектурный компонент Цитадели уровней 1..5 (TDL-ARCH-006).
 *
 * Мрачная средневековая архитектура (состаренный базальт, тёсаный камень,
 * почерневшее дерево, сланцевая черепица, кованое железо, приглушённая
 * состаренная бронза/золото и кость, тёплый огонь жаровен и очага,
 * сдержанный некротический фокус на старших уровнях).
 *
 * Все уровни читаются с существующей изометрической камеры, укладываются
 * в доменное пятно [3, 3] (3.3 м × 3.3 м) без наложения на дорогу и соседние
 * постройки, имеют законченные все 4 фасада и не выделяют объектов в useFrame.
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
} from "../../materials/citadelMaterials.js";
import { footprintCenterToWorld, type CourtGridLite } from "../../scene/gridMath.js";
import { useCitadelGeometrySet, type CitadelGeometrySet } from "./citadelGeometry.js";
import { getCitadelVisualSpec, type CitadelLevelVisualSpec } from "./citadelLevels.js";

/** Локальное боевое знамя (собственная геометрия на экземпляр — без мутации общих буферов). */
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
      pos.setZ(i, Math.sin(x * 7.2 + t * 5.2 + phase) * 0.048 * (x + 0.24));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={[position[0], position[1], position[2]]} scale={scale}>
      <mesh position-y={0.38} castShadow>
        <cylinderGeometry args={[0.024, 0.028, 0.86, 6]} />
        <meshStandardMaterial map={tex.ironMap} bumpMap={tex.ironBump} bumpScale={0.015} roughness={0.44} metalness={0.8} />
      </mesh>
      <mesh position={[0.14, 0.74, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.014, 0.014, 0.34, 6]} />
        <meshStandardMaterial color={CITADEL_PALETTE.boneIvory} roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.83, 0]} castShadow>
        <coneGeometry args={[0.042, 0.12, 6]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.72} />
      </mesh>
      <mesh ref={clothRef} position={[0.29, 0.52, 0]}>
        <planeGeometry args={[0.52, 0.36, 8, 1]} />
        <meshStandardMaterial map={tex.bannerMap} side={THREE.DoubleSide} roughness={0.86} metalness={0.04} />
      </mesh>
    </group>
  );
}

/** Тлеющая кованая жаровня с изолированным анимированным материалом пламени. */
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
    m.scale.set(0.95 + (flicker - 0.9) * 0.25, flicker, 0.95 + (flicker - 0.9) * 0.25);
    (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85 + flicker * 0.35;
  });

  const postH = tall ? 0.56 : 0.24;
  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* каменный или кованый пьедестал */}
      <mesh position-y={postH / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.065, 0.095, postH, 6]} />
        <meshStandardMaterial map={tex.ironMap} bumpMap={tex.ironBump} bumpScale={0.015} roughness={0.44} metalness={0.82} />
      </mesh>
      {/* чаша */}
      <mesh position-y={postH + 0.06} castShadow>
        <cylinderGeometry args={[0.13, 0.07, 0.11, 8]} />
        <meshStandardMaterial map={tex.ironMap} bumpMap={tex.ironBump} bumpScale={0.015} roughness={0.4} metalness={0.85} />
      </mesh>
      {/* угли */}
      <mesh position-y={postH + 0.095}>
        <cylinderGeometry args={[0.095, 0.095, 0.03, 6]} />
        <meshStandardMaterial color="#3c1b10" emissive="#b33d12" emissiveIntensity={0.65} roughness={0.8} />
      </mesh>
      {/* язык пламени */}
      <mesh ref={flameRef} position-y={postH + 0.18}>
        <coneGeometry args={[0.068, 0.19, 6]} />
        <meshStandardMaterial {...createBrazierFlameMaterialProps()} />
      </mesh>
    </group>
  );
}

/** Утопленное стрельчатое окно с подоконником, темной нишей, тёплым стеклом и переплётом. */
function RecessedLancetWindow({
  position,
  rotationY = 0,
  width = 0.28,
  height = 0.46,
  mode = "hearth",
  gilded = false,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  mode?: "hearth" | "necrotic";
  gilded?: boolean;
  tex: CitadelTextureSet;
}) {
  const glassProps =
    mode === "necrotic"
      ? {
          color: CITADEL_PALETTE.necroticBase,
          emissive: CITADEL_PALETTE.necroticGlow,
          emissiveIntensity: 0.72,
          roughness: 0.3,
        }
      : createHearthWindowMaterialProps();

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      {/* каменный наличник */}
      <mesh position-z={0.015} castShadow>
        <boxGeometry args={[width + 0.09, height + 0.08, 0.045]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.02}
          color={gilded ? "#8b8170" : undefined}
          roughness={0.86}
        />
      </mesh>
      {/* подоконник */}
      <mesh position={[0, -height / 2 - 0.03, 0.03]} castShadow>
        <boxGeometry args={[width + 0.13, 0.055, 0.075]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.88} />
      </mesh>
      {/* притолока */}
      <mesh position={[0, height / 2 + 0.035, 0.025]} castShadow>
        <boxGeometry args={[width + 0.11, 0.06, 0.065]} />
        <meshStandardMaterial
          color={gilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.stoneDressed}
          roughness={gilded ? 0.44 : 0.86}
          metalness={gilded ? 0.68 : 0.04}
        />
      </mesh>
      {/* тёплое/некротическое окно в глубине ниши */}
      <mesh position-z={0.042}>
        <boxGeometry args={[width - 0.02, height - 0.03, 0.018]} />
        <meshStandardMaterial {...glassProps} />
      </mesh>
      {/* кованая решётка впереди стекла (жёсткий зазор >= 0.018м от стекла) */}
      <mesh position-z={0.062}>
        <boxGeometry args={[0.024, height - 0.02, 0.02]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.03, 0.062]}>
        <boxGeometry args={[width - 0.01, 0.024, 0.02]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.82} />
      </mesh>
    </group>
  );
}

/** Восьмигранная угловая башня-бастион (используется на уровнях 2..5). */
function CornerBastionTurret({
  position,
  baseY,
  height,
  radius,
  spireHeight,
  hasCrownRing,
  hasBoneSpurs,
  hasSpireRibs,
  gildedTrim,
  tex,
}: {
  position: readonly [number, number];
  baseY: number;
  height: number;
  radius: number;
  spireHeight: number;
  hasCrownRing: boolean;
  hasBoneSpurs: boolean;
  hasSpireRibs: boolean;
  gildedTrim: boolean;
  tex: CitadelTextureSet;
}) {
  const topY = baseY + height;
  return (
    <group position={[position[0], 0, position[1]]}>
      {/* расширенный цокольный воротник */}
      <mesh position-y={baseY + 0.14} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 1.06, radius * 1.18, 0.28, 8]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.025} roughness={0.88} />
      </mesh>
      {/* основное тело башни */}
      <mesh position-y={baseY + height / 2} castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.96, radius * 1.04, height, 8]} />
        <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.035} roughness={0.88} />
      </mesh>
      {/* кованое кольцо обвязки */}
      <mesh position-y={baseY + height * 0.54} castShadow>
        <cylinderGeometry args={[radius * 1.01, radius * 1.01, 0.06, 8]} />
        <meshStandardMaterial
          map={tex.ironMap}
          color={gildedTrim ? CITADEL_PALETTE.agedBronze : undefined}
          roughness={0.44}
          metalness={0.78}
        />
      </mesh>
      {/* бойницы-щели с тёплым отблеском */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, idx) => (
        <group key={idx} rotation-y={ang}>
          <mesh position={[0, baseY + height * 0.68, radius * 0.96]}>
            <boxGeometry args={[0.06, 0.26, 0.04]} />
            <meshStandardMaterial color="#1b1815" emissive={CITADEL_PALETTE.hearthGlow} emissiveIntensity={0.42} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* верхняя консоль/машикули */}
      <mesh position-y={topY - 0.05} castShadow>
        <cylinderGeometry args={[radius * 1.12, radius * 0.98, 0.14, 8]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
      </mesh>
      {/* парапет башенки на ур. 4..5 */}
      {hasCrownRing ? (
        <group position-y={topY + 0.07}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i * Math.PI) / 4;
            return (
              <mesh
                key={i}
                position={[Math.sin(ang) * radius * 1.01, 0, Math.cos(ang) * radius * 1.01]}
                rotation-y={ang}
                castShadow
              >
                <boxGeometry args={[radius * 0.44, 0.16, 0.09]} />
                <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
              </mesh>
            );
          })}
        </group>
      ) : null}
      {/* костяные/железные роговые навершия по углам воротника (ур. 4..5) */}
      {hasBoneSpurs
        ? [0, 1, 2, 3].map((i) => {
            const ang = (i * Math.PI) / 2 + Math.PI / 4;
            return (
              <mesh
                key={i}
                position={[Math.sin(ang) * radius * 1.12, topY + 0.14, Math.cos(ang) * radius * 1.12]}
                rotation={[0.28 * Math.cos(ang), 0, -0.28 * Math.sin(ang)]}
                castShadow
              >
                <coneGeometry args={[0.04, 0.24, 5]} />
                <meshStandardMaterial color={CITADEL_PALETTE.boneIvory} roughness={0.78} metalness={0.04} />
              </mesh>
            );
          })
        : null}
      {/* сланцевый шпиль башни */}
      <mesh position-y={topY + spireHeight / 2 + (hasCrownRing ? 0.06 : 0.01)} castShadow>
        <coneGeometry args={[radius * 1.12, spireHeight, 8]} />
        <meshStandardMaterial
          map={tex.slateMap}
          bumpMap={tex.slateBump}
          bumpScale={0.03}
          roughness={0.72}
          metalness={0.08}
        />
      </mesh>
      {/* кованые обручи шатра на 5-м уровне (базовый и поясной без выступающих перекладин) */}
      {hasSpireRibs ? (
        <>
          <mesh position-y={topY + 0.07} castShadow>
            <cylinderGeometry args={[radius * 1.11, radius * 1.14, 0.055, 8]} />
            <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.78} />
          </mesh>
          <mesh position-y={topY + spireHeight * 0.48 + 0.06} castShadow>
            <cylinderGeometry args={[radius * 0.56, radius * 0.62, 0.055, 8]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.84} />
          </mesh>
        </>
      ) : null}
      {/* шпиль-навершие */}
      <mesh position-y={topY + spireHeight + (hasCrownRing ? 0.18 : 0.12)} castShadow>
        <coneGeometry args={[0.04, 0.3, 6]} />
        <meshStandardMaterial
          color={gildedTrim ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.78}
        />
      </mesh>
    </group>
  );
}

/** Ряд зубцов парапета (мерлонов) по периметру заданного прямоугольника. */
function BattlementPerimeter({
  halfSpan,
  y,
  tex,
  hasCornerBoneFinials,
  skipCorners = false,
}: {
  halfSpan: number;
  y: number;
  tex: CitadelTextureSet;
  hasCornerBoneFinials?: boolean;
  skipCorners?: boolean;
}) {
  const offsets = [-0.62, 0, 0.62];
  return (
    <group position-y={y}>
      {/* парапетная подставка */}
      <mesh position-y={-0.02} castShadow>
        <boxGeometry args={[halfSpan * 2 + 0.08, 0.08, halfSpan * 2 + 0.08]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
      </mesh>
      {offsets.map((frac) => {
        const p = frac * (halfSpan - 0.16);
        return (
          <group key={frac}>
            <mesh position={[p, 0.11, halfSpan - 0.03]} castShadow>
              <boxGeometry args={[0.28, 0.2, 0.12]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
            </mesh>
            <mesh position={[p, 0.11, -(halfSpan - 0.03)]} castShadow>
              <boxGeometry args={[0.28, 0.2, 0.12]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
            </mesh>
            <mesh position={[halfSpan - 0.03, 0.11, p]} castShadow>
              <boxGeometry args={[0.12, 0.2, 0.28]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
            </mesh>
            <mesh position={[-(halfSpan - 0.03), 0.11, p]} castShadow>
              <boxGeometry args={[0.12, 0.2, 0.28]} />
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
            </mesh>
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
                <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
              </mesh>
              {hasCornerBoneFinials ? (
                <mesh position-y={0.2} castShadow>
                  <coneGeometry args={[0.048, 0.2, 5]} />
                  <meshStandardMaterial color={CITADEL_PALETTE.boneIvory} roughness={0.78} metalness={0.05} />
                </mesh>
              ) : null}
            </group>
          ))
        : null}
    </group>
  );
}

/** Некротический реликварий с открытой кованой клетью и пульсирующим кристаллом (уровни 4..5). */
function NecroticReliquaryCrown({
  y,
  scale = 1,
  sovereign = false,
  geoms,
  tex,
}: {
  y: number;
  scale?: number;
  sovereign?: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const crystalRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.72 + Math.sin(t * 2.1) * 0.22;
    const m = crystalRef.current;
    if (m) {
      m.rotation.y = t * 0.45;
      m.position.y = 0.38 + Math.sin(t * 1.9) * 0.025;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
    if (lightRef.current) {
      lightRef.current.intensity = (sovereign ? 0.95 : 0.65) * (0.85 + Math.sin(t * 2.1) * 0.15);
    }
  });

  const cageH = sovereign ? 0.72 : 0.58;
  const cageR = sovereign ? 0.34 : 0.26;
  const roofH = sovereign ? 0.86 : 0.68;
  const finialH = sovereign ? 0.34 : 0.26;
  return (
    <group position-y={y} scale={scale}>
      {/* бронзовый/железный постамент фонаря */}
      <mesh position-y={0.05} castShadow>
        <cylinderGeometry args={[cageR * 1.15, cageR * 1.28, 0.12, 8]} />
        <meshStandardMaterial
          color={sovereign ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.44}
          metalness={0.76}
        />
      </mesh>
      {/* 4 кованые стойки клети */}
      {[0, 1, 2, 3].map((i) => {
        const ang = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh
            key={i}
            position={[Math.sin(ang) * cageR, 0.08 + cageH / 2, Math.cos(ang) * cageR]}
            castShadow
          >
            <cylinderGeometry args={[0.026, 0.032, cageH, 6]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.4} metalness={0.85} />
          </mesh>
        );
      })}
      {/* верхнее кольцо короны */}
      <mesh position-y={0.08 + cageH} castShadow>
        <cylinderGeometry args={[cageR * 1.08, cageR * 1.08, 0.08, 8]} />
        <meshStandardMaterial
          color={sovereign ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>
      {/* парящий гранёный кристалл */}
      <mesh ref={crystalRef} geometry={geoms.crystal} position-y={0.38} scale={sovereign ? 1.04 : 0.82}>
        <meshStandardMaterial {...createNecroticCrystalMaterialProps()} />
      </mesh>
      {/* локализованный некротический свет (жёстко ограничен по distance — без заливки двора) */}
      <pointLight
        ref={lightRef}
        position={[0, 0.42, 0]}
        color={CITADEL_PALETTE.necroticGlow}
        intensity={sovereign ? 0.95 : 0.65}
        distance={3.1}
        decay={2}
      />
      {/* навершие сланцевого/кованого шпиля поверх клети */}
      <mesh position-y={0.1 + cageH + roofH / 2} castShadow>
        <coneGeometry args={[cageR * 1.24, roofH, 8]} />
        <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.7} metalness={0.14} />
      </mesh>
      <mesh position-y={0.1 + cageH + roofH + finialH / 2 - 0.04} castShadow>
        <coneGeometry args={[0.042, finialH, 6]} />
        <meshStandardMaterial
          color={sovereign ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.forgedIron}
          roughness={0.38}
          metalness={0.82}
        />
      </mesh>
      {/* 4 костяных зубца короны на 5-м уровне */}
      {sovereign
        ? [0, 1, 2, 3].map((i) => {
            const ang = (i * Math.PI) / 2;
            return (
              <mesh
                key={i}
                position={[Math.sin(ang) * (cageR * 1.12), 0.12 + cageH + 0.14, Math.cos(ang) * (cageR * 1.12)]}
                rotation={[0.24 * Math.cos(ang), 0, -0.24 * Math.sin(ang)]}
                castShadow
              >
                <coneGeometry args={[0.036, 0.24, 5]} />
                <meshStandardMaterial color={CITADEL_PALETTE.boneIvory} roughness={0.76} metalness={0.05} />
              </mesh>
            );
          })
        : null}
    </group>
  );
}

/** Главный фасадный портал (+Z) с прогрессией от дубовой двери до барбакана. */
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
  const hasPorch = spec.gateStyle === "gated-porch" || isBarbican;
  const hasPortcullis =
    spec.gateStyle === "portcullis-keep" ||
    spec.gateStyle === "gothic-portcullis" ||
    isBarbican;
  const porchDepth = isBarbican ? 0.34 : 0.24;
  const archZ = hasPorch ? zFace + porchDepth : zFace + 0.04;
  const doorW = isBarbican ? 0.68 : 0.56;
  const doorH = isBarbican ? 1.06 : 0.88;

  return (
    <group>
      {/* выдвижной корпус крыльца/барбакана (ур. 2 и 5) */}
      {hasPorch ? (
        <group position={[0, keepBaseY, zFace + porchDepth / 2]}>
          <mesh position-y={doorH * 0.55} castShadow receiveShadow>
            <boxGeometry args={[doorW + 0.38, doorH * 1.1, porchDepth]} />
            <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.03} roughness={0.88} />
          </mesh>
          <mesh
            geometry={geoms.gableRoof}
            position={[0, doorH * 1.1, 0]}
            scale={[doorW + 0.48, 0.34, porchDepth + 0.14]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
          </mesh>
          {isBarbican ? (
            <>
              {/* боковые пилоны барбакана */}
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * (doorW * 0.64), 0, porchDepth * 0.22]}>
                  <mesh position-y={doorH * 0.68} castShadow>
                    <boxGeometry args={[0.2, doorH * 1.36, 0.22]} />
                    <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
                  </mesh>
                  <mesh position-y={doorH * 1.44} castShadow>
                    <coneGeometry args={[0.13, 0.24, 4]} />
                    <meshStandardMaterial map={tex.slateMap} roughness={0.72} metalness={0.1} />
                  </mesh>
                </group>
              ))}
            </>
          ) : null}
        </group>
      ) : null}

      {/* стрельчатая каменная арка портала */}
      <mesh
        geometry={geoms.pointedArch}
        position={[0, keepBaseY, archZ]}
        scale={[doorW + 0.3, doorH + 0.18, 0.12]}
        castShadow
      >
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.86} />
      </mesh>

      {/* замковый бронзовый камень на L2+ */}
      {spec.goldTrimStage !== "none" ? (
        <mesh position={[0, keepBaseY + doorH + 0.08, archZ + 0.05]} castShadow>
          <boxGeometry args={[0.14, 0.16, 0.06]} />
          <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.74} />
        </mesh>
      ) : null}

      {/* дубовые створки ворот + кованые петли */}
      <mesh position={[0, keepBaseY + doorH * 0.45, archZ - 0.02]} castShadow>
        <boxGeometry args={[doorW * 0.88, doorH * 0.88, 0.06]} />
        <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.02} roughness={0.88} />
      </mesh>
      {[-0.22, 0.22].map((dy, idx) => (
        <mesh key={idx} position={[0, keepBaseY + doorH * 0.45 + dy, archZ + 0.018]} castShadow>
          <boxGeometry args={[doorW * 0.82, 0.042, 0.02]} />
          <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.84} />
        </mesh>
      ))}
      <mesh position={[0, keepBaseY + doorH * 0.45, archZ + 0.018]}>
        <boxGeometry args={[0.024, doorH * 0.84, 0.022]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.84} />
      </mesh>

      {/* поднятая решётка герсы (ур. 3..5) */}
      {hasPortcullis ? (
        <group position={[0, keepBaseY + doorH * 0.72, archZ + 0.032]}>
          <mesh position-y={0.08}>
            <boxGeometry args={[doorW * 0.8, 0.032, 0.024]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.86} />
          </mesh>
          {[-0.22, -0.11, 0, 0.11, 0.22].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.022, 0.28, 0.022]} />
              <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.86} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

export function CitadelBuilding({ level = 1, grid }: { level?: number; grid: CourtGridLite }) {
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
  const turretRadius = spec.level >= 5 ? 0.33 : spec.level === 4 ? 0.31 : spec.level === 3 ? 0.32 : 0.33;
  const turretOffset = spec.level >= 4 ? keepHalf - 0.04 : keepHalf - 0.02;
  const turretHeight =
    spec.level === 5
      ? spec.keepHeight + spec.upperHeight + 0.42
      : spec.level === 4
        ? spec.keepHeight + spec.upperHeight + 0.18
        : spec.level === 3
          ? spec.keepHeight + spec.upperHeight + 0.06
          : spec.keepHeight + spec.upperHeight + 0.44;
  const turretSpireHeight = spec.level >= 5 ? 0.96 : spec.level === 4 ? 0.82 : spec.level === 3 ? 0.72 : 0.84;
  const turretBannerY = keepBaseY + turretHeight + turretSpireHeight + (spec.level >= 4 ? 0.14 : 0.06);

  // координаты угловых башен по макету уровня
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

  // позиции ступенчатых контрфорсов по 4 стенам
  const buttressLateralOffsets = spec.level >= 4 ? [-0.56, 0.56] : [-0.46, 0.46];

  return (
    <group position={[center.wx, 0.08, center.wz]} rotation-y={Math.PI / 2}>
      {/* ---------- 1. СТУПЕНЧАТЫЙ СКОШЕННЫЙ КАМЕННЫЙ ПОДИУМ И ЛЕСТНИЦА ---------- */}
      <mesh position-y={spec.plinthHeight * 0.45} rotation-y={Math.PI / 4} castShadow receiveShadow>
        <cylinderGeometry
          args={[(spec.plinthSize * 0.96) / Math.SQRT2, (spec.plinthSize + 0.14) / Math.SQRT2, spec.plinthHeight * 0.9, 4]}
        />
        <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.03} roughness={0.9} />
      </mesh>
      <mesh position-y={spec.plinthHeight - 0.035} castShadow receiveShadow>
        <boxGeometry args={[spec.plinthSize, 0.07, spec.plinthSize]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
      </mesh>

      {/* парадная каменная лестница внутри пятна (<= spec.stepReachZ) */}
      {Array.from({ length: spec.stepCount }, (_, i) => {
        const stepD = (spec.stepReachZ - plinthHalf + 0.1) / spec.stepCount;
        const zCenter = plinthHalf - 0.05 + stepD * (i + 0.5);
        const stepH = spec.plinthHeight * ((spec.stepCount - i) / spec.stepCount);
        const stepW = 1.06 - i * 0.08;
        return (
          <mesh key={i} position={[0, stepH / 2, zCenter]} castShadow receiveShadow>
            <boxGeometry args={[stepW, stepH, stepD + 0.04]} />
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
          </mesh>
        );
      })}
      {/* каменные щёки лестницы (ур. 2..5) */}
      {spec.level >= 2
        ? [-0.56, 0.56].map((sx) => (
            <mesh
              key={sx}
              position={[sx, spec.plinthHeight * 0.52, (plinthHalf + spec.stepReachZ) / 2 - 0.05]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.12, spec.plinthHeight * 0.95, spec.stepReachZ - plinthHalf + 0.14]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
            </mesh>
          ))
        : null}

      {/* ---------- 2. НИЖНИЙ ЯРУС ДОНЖОНА И ЧЕТЫРЕ ЗАКОНЧЕННЫХ ФАСАДА ---------- */}
      <mesh position-y={keepBaseY + spec.keepHeight / 2} castShadow receiveShadow>
        <boxGeometry args={[spec.keepWidth, spec.keepHeight, spec.keepWidth]} />
        <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.035} roughness={0.88} />
      </mesh>

      {/* угловые каменные русты (на углах без башен) */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => {
        const coveredByTurret = turretPositions.some(([tx, tz]) => Math.sign(tx) === sx && Math.sign(tz) === sz);
        if (coveredByTurret) return null;
        return (
          <mesh key={i} position={[sx! * (keepHalf - 0.08), keepBaseY + spec.keepHeight / 2, sz! * (keepHalf - 0.08)]} castShadow>
            <boxGeometry args={[0.24, spec.keepHeight + 0.02, 0.24]} />
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.86} />
          </mesh>
        );
      })}

      {/* разделительный пояс между 1-м и 2-м ярусом */}
      <mesh position-y={keepTopY} castShadow receiveShadow>
        <boxGeometry args={[spec.keepWidth + 0.14, 0.1, spec.keepWidth + 0.14]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.84} />
      </mesh>
      {spec.goldTrimStage !== "none" && spec.goldTrimStage !== "subtle-keystone" ? (
        <mesh position-y={keepTopY + 0.045}>
          <boxGeometry args={[spec.keepWidth + 0.16, 0.036, spec.keepWidth + 0.16]} />
          <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.72} />
        </mesh>
      ) : null}

      {/* парадный портал (+Z) */}
      <CitadelPortal spec={spec} keepBaseY={keepBaseY} keepHalf={keepHalf} geoms={geoms} tex={tex} />

      {/* окна боковых и тыльного фасадов нижнего яруса */}
      {[-1, 1].map((side) => (
        <RecessedLancetWindow
          key={`flank${side}`}
          position={[side * keepHalf, keepBaseY + spec.keepHeight * 0.56, 0]}
          rotationY={(side * Math.PI) / 2}
          width={0.28}
          height={0.48}
          mode="hearth"
          gilded={isGilded}
          tex={tex}
        />
      ))}

      {/* тыльный (-Z) фасад: очажный дымоход на L1..2 или гранёная готическая апсида на L3..5 */}
      {!spec.hasRearApse ? (
        <RecessedLancetWindow
          position={[0, keepBaseY + spec.keepHeight * 0.56, -keepHalf]}
          rotationY={Math.PI}
          width={0.3}
          height={0.5}
          mode="hearth"
          tex={tex}
        />
      ) : (
        <group position={[0, 0, -keepHalf - 0.08]}>
          <mesh position-y={keepBaseY + (spec.keepHeight + spec.upperHeight * 0.55) / 2} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.46, spec.keepHeight + spec.upperHeight * 0.55, 6]} />
            <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.032} roughness={0.88} />
          </mesh>
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.55 + 0.02} castShadow>
            <cylinderGeometry args={[0.48, 0.44, 0.08, 6]} />
            <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
          </mesh>
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.55 + 0.38} castShadow>
            <coneGeometry args={[0.5, 0.68, 6]} />
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
          </mesh>
          <mesh position-y={keepBaseY + spec.keepHeight + spec.upperHeight * 0.55 + 0.78} castShadow>
            <coneGeometry args={[0.032, 0.2, 6]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.82} />
          </mesh>
          <RecessedLancetWindow
            position={[0, keepBaseY + spec.keepHeight * 0.58, -0.43]}
            rotationY={Math.PI}
            width={0.22}
            height={0.56}
            mode={spec.level >= 4 ? "necrotic" : "hearth"}
            gilded={isGilded}
            tex={tex}
          />
        </group>
      )}

      {/* ступенчатые контрфорсы по бокам и тылу (ур. 2..5) */}
      {spec.buttressCount > 0
        ? buttressLateralOffsets.map((lat) => (
            <group key={`but${lat}`}>
              <mesh
                geometry={geoms.buttress}
                position={[keepHalf, keepBaseY, lat]}
                rotation-y={Math.PI / 2}
                scale={[0.16, spec.keepHeight * 0.96, 0.24]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
              </mesh>
              <mesh
                geometry={geoms.buttress}
                position={[-keepHalf, keepBaseY, lat]}
                rotation-y={-Math.PI / 2}
                scale={[0.16, spec.keepHeight * 0.96, 0.24]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
              </mesh>
              <mesh
                geometry={geoms.buttress}
                position={[lat, keepBaseY, -keepHalf]}
                rotation-y={Math.PI}
                scale={[0.16, spec.keepHeight * 0.96, 0.22]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
              </mesh>
            </group>
          ))
        : null}

      {/* ---------- 3. ВТОРОЙ ЯРУС (ФАХВЕРК НА L1 -> КАМЕННО-БРЕВЕНЧАТАЯ ГАЛЕРЕЯ -> БАСТИОН) ---------- */}
      <mesh position-y={keepTopY + spec.upperHeight / 2} castShadow receiveShadow>
        <boxGeometry args={[spec.upperWidth, spec.upperHeight, spec.upperWidth]} />
        <meshStandardMaterial
          map={spec.level === 1 ? tex.timberMap : tex.basaltMap}
          bumpMap={spec.level === 1 ? tex.timberBump : tex.basaltBump}
          bumpScale={0.03}
          roughness={0.88}
        />
      </mesh>

      {/* деревянный каркас, раскосы и консоли-подкосы (хорошо читаются на L1..L2 и как галерея на L3) */}
      {spec.level <= 3
        ? [-1, 1].map((side) => (
            <group key={`tm${side}`}>
              {[-upperHalf * 0.65, 0, upperHalf * 0.65].map((off) => (
                <group key={off}>
                  <mesh position={[off, keepTopY + spec.upperHeight * 0.5, side * (upperHalf + 0.015)]} castShadow>
                    <boxGeometry args={[0.075, spec.upperHeight, 0.04]} />
                    <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.018} roughness={0.88} />
                  </mesh>
                  <mesh
                    position={[off, keepTopY - 0.12, side * (upperHalf - 0.03)]}
                    rotation-x={side * 0.45}
                    castShadow
                  >
                    <boxGeometry args={[0.065, 0.22, 0.09]} />
                    <meshStandardMaterial map={tex.timberMap} roughness={0.88} />
                  </mesh>
                </group>
              ))}
              {[-upperHalf * 0.65, 0, upperHalf * 0.65].map((off) => (
                <group key={`s${off}`}>
                  <mesh position={[side * (upperHalf + 0.015), keepTopY + spec.upperHeight * 0.5, off]} castShadow>
                    <boxGeometry args={[0.04, spec.upperHeight, 0.075]} />
                    <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.018} roughness={0.88} />
                  </mesh>
                  <mesh
                    position={[side * (upperHalf - 0.03), keepTopY - 0.12, off]}
                    rotation-z={-side * 0.45}
                    castShadow
                  >
                    <boxGeometry args={[0.09, 0.22, 0.065]} />
                    <meshStandardMaterial map={tex.timberMap} roughness={0.88} />
                  </mesh>
                </group>
              ))}
            </group>
          ))
        : null}

      {/* готические окна верхнего яруса по всем 4 фасадам */}
      {[
        { pos: [0, keepTopY + spec.upperHeight * 0.52, upperHalf] as const, rot: 0 },
        { pos: [0, keepTopY + spec.upperHeight * 0.52, -upperHalf] as const, rot: Math.PI },
        { pos: [upperHalf, keepTopY + spec.upperHeight * 0.52, 0] as const, rot: Math.PI / 2 },
        { pos: [-upperHalf, keepTopY + spec.upperHeight * 0.52, 0] as const, rot: -Math.PI / 2 },
      ].map((w, idx) => (
        <RecessedLancetWindow
          key={`uw${idx}`}
          position={w.pos}
          rotationY={w.rot}
          width={spec.level >= 4 ? 0.34 : 0.28}
          height={spec.level >= 4 ? 0.52 : 0.4}
          mode={spec.level === 5 && idx === 1 ? "necrotic" : "hearth"}
          gilded={isGilded}
          tex={tex}
        />
      ))}

      {/* машикули верхнего яруса (ур. 4..5) */}
      {spec.hasMachicolations ? (
        <mesh position-y={upperTopY - 0.06} castShadow>
          <boxGeometry args={[spec.upperWidth + 0.18, 0.12, spec.upperWidth + 0.18]} />
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
        </mesh>
      ) : null}

      {/* ---------- 4. КРОВЛЯ ОСНОВНОГО ОБЪЁМА / БОЕВОЙ ПАРАПЕТ / ДОРМЕРЫ ---------- */}
      {spec.roofStyle === "pitched-manor" ? (
        <group position-y={upperTopY}>
          {/* сланцевая щипцовая кровля (L1) */}
          <mesh
            geometry={geoms.gableRoof}
            scale={[spec.upperWidth + 0.26, 0.92, spec.upperWidth + 0.22]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.72} metalness={0.08} />
          </mesh>
          {/* коньковая балка и кованый шпиль */}
          <mesh position-y={0.94} castShadow>
            <boxGeometry args={[0.1, 0.1, spec.upperWidth + 0.28]} />
            <meshStandardMaterial map={tex.timberMap} roughness={0.86} />
          </mesh>
          <mesh position-y={1.12} castShadow>
            <coneGeometry args={[0.04, 0.34, 6]} />
            <meshStandardMaterial map={tex.ironMap} roughness={0.42} metalness={0.82} />
          </mesh>
        </group>
      ) : null}

      {spec.roofStyle === "hip-dormer" ? (
        <group position-y={upperTopY}>
          {/* крутая шатрово-перекрёстная кровля (L2) */}
          <mesh position-y={0.54} rotation-y={Math.PI / 4} castShadow receiveShadow>
            <coneGeometry args={[spec.upperWidth * 0.78, 1.08, 4]} />
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.72} metalness={0.08} />
          </mesh>
          <mesh
            geometry={geoms.gableRoof}
            position={[0, 0.04, upperHalf * 0.42]}
            scale={[0.88, 0.66, 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
          </mesh>
          <mesh position-y={1.18} castShadow>
            <coneGeometry args={[0.045, 0.3, 6]} />
            <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.74} />
          </mesh>
        </group>
      ) : null}

      {spec.hasBattlements ? (
        <BattlementPerimeter
          halfSpan={upperHalf + 0.06}
          y={upperTopY}
          tex={tex}
          hasCornerBoneFinials={spec.boneAccentStage !== "none"}
          skipCorners={spec.turretCount === 4}
        />
      ) : null}

      {/* 4 перекрёстных готических дормера/щипца поверх верхней деки на L4..5 */}
      {spec.level >= 4 ? (
        <group position-y={upperTopY + 0.02}>
          <mesh
            geometry={geoms.gableRoof}
            scale={[spec.upperWidth * 0.88, 0.86, spec.upperWidth * 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
          </mesh>
          <mesh
            geometry={geoms.gableRoof}
            rotation-y={Math.PI / 2}
            scale={[spec.upperWidth * 0.88, 0.86, spec.upperWidth * 0.86]}
            castShadow
          >
            <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
          </mesh>
        </group>
      ) : null}

      {/* ---------- 5. УГЛОВЫЕ БАШНИ-БАСТИОНЫ (L2: 1, L3: 2, L4..5: 4) ---------- */}
      {turretPositions.map(([tx, tz], i) => (
        <CornerBastionTurret
          key={`tur${i}`}
          position={[tx, tz]}
          baseY={keepBaseY}
          height={turretHeight}
          radius={turretRadius}
          spireHeight={turretSpireHeight}
          hasCrownRing={spec.level >= 4}
          hasBoneSpurs={spec.boneAccentStage !== "none"}
          hasSpireRibs={isSovereign}
          gildedTrim={isGilded}
          tex={tex}
        />
      ))}

      {/* аркбутаны 5-го уровня от угловых башен к верхнему ярусу центрального донжона */}
      {spec.hasFlyingButtresses
        ? turretPositions.map(([tx, tz], i) => {
            const sx = Math.sign(tx);
            const sz = Math.sign(tz);
            const outerX = tx * 0.9;
            const outerZ = tz * 0.9;
            const span = Math.hypot(outerX, outerZ) - spec.belfryWidth * 0.62;
            return (
              <mesh
                key={`fly${i}`}
                geometry={geoms.flyingButtress}
                position={[outerX, upperTopY + 0.32, outerZ]}
                rotation-y={Math.atan2(sz, -sx)}
                scale={[Math.max(0.55, span), spec.belfryHeight * 0.72, 0.14]}
                castShadow
              >
                <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.86} />
              </mesh>
            );
          })
        : null}

      {/* ---------- 6. ЦЕНТРАЛЬНАЯ БАШНЯ-ДОНЖОН И НЕКРОТИЧЕСКИЙ ФОКУС (УР. 3..5) ---------- */}
      {spec.belfryHeight > 0 ? (
        <group position-y={upperTopY}>
          {/* основание донжона */}
          <mesh position-y={spec.belfryHeight / 2} castShadow receiveShadow>
            <boxGeometry args={[spec.belfryWidth, spec.belfryHeight, spec.belfryWidth]} />
            <meshStandardMaterial map={tex.basaltMap} bumpMap={tex.basaltBump} bumpScale={0.032} roughness={0.88} />
          </mesh>
          {/* угловые колонки донжона */}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], i) => (
            <mesh
              key={i}
              position={[sx! * (spec.belfryWidth * 0.46), spec.belfryHeight / 2, sz! * (spec.belfryWidth * 0.46)]}
              castShadow
            >
              <boxGeometry args={[0.16, spec.belfryHeight + 0.04, 0.16]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
            </mesh>
          ))}
          {/* бронзовый/золочёный венец донжона */}
          <mesh position-y={spec.belfryHeight - 0.05} castShadow>
            <boxGeometry args={[spec.belfryWidth + 0.14, 0.1, spec.belfryWidth + 0.14]} />
            <meshStandardMaterial
              color={isGilded ? CITADEL_PALETTE.agedBronze : CITADEL_PALETTE.stoneDressed}
              roughness={isGilded ? 0.4 : 0.86}
              metalness={isGilded ? 0.75 : 0.05}
            />
          </mesh>
          {/* стрельчатые окна на 4 сторонах донжона (с некротическим акцентом) */}
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, idx) => (
            <RecessedLancetWindow
              key={`bw${idx}`}
              position={[
                Math.sin(rot) * (spec.belfryWidth / 2),
                spec.belfryHeight * 0.56,
                Math.cos(rot) * (spec.belfryWidth / 2),
              ]}
              rotationY={rot}
              width={0.22}
              height={0.44}
              mode={spec.level === 3 || idx % 2 === 0 ? "necrotic" : "hearth"}
              gilded={isGilded}
              tex={tex}
            />
          ))}

          {/* завершение донжона: L3 шатёр + знамя / L4..5 открытая клеть-реликварий */}
          {spec.level === 3 ? (
            <>
              <mesh position-y={spec.belfryHeight + 0.52} rotation-y={Math.PI / 4} castShadow>
                <coneGeometry args={[spec.belfryWidth * 0.82, 1.04, 4]} />
                <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.025} roughness={0.72} metalness={0.08} />
              </mesh>
              <mesh position-y={spec.belfryHeight + 1.12} castShadow>
                <coneGeometry args={[0.045, 0.28, 6]} />
                <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.74} />
              </mesh>
            </>
          ) : (
            <NecroticReliquaryCrown
              y={spec.belfryHeight}
              scale={isSovereign ? 1.04 : 0.88}
              sovereign={isSovereign}
              geoms={geoms}
              tex={tex}
            />
          )}
        </group>
      ) : null}

      {/* ---------- 7. ТРУБА ОЧАГА С ПЕПЕЛЬНЫМ ДЫМОМ ---------- */}
      <mesh position={[keepHalf - 0.16, keepBaseY + spec.keepHeight + 0.45, -keepHalf + 0.16]} castShadow>
        <boxGeometry args={[0.24, 1.1, 0.24]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.88} />
      </mesh>
      <mesh position={[keepHalf - 0.16, keepBaseY + spec.keepHeight + 1.02, -keepHalf + 0.16]} castShadow>
        <boxGeometry args={[0.3, 0.08, 0.3]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.46} metalness={0.78} />
      </mesh>
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

      {/* ---------- 8. ЖАРОВНИ И БОЕВЫЕ ЗНАМЁНА ---------- */}
      {spec.brazierCount >= 2 ? (
        <>
          <IronBrazier position={[-0.64, keepBaseY, keepHalf + (isBarbican ? 0.38 : 0.2)]} tall={isBarbican} tex={tex} />
          <IronBrazier position={[0.64, keepBaseY, keepHalf + (isBarbican ? 0.38 : 0.2)]} tall={isBarbican} tex={tex} />
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
          position={[0, keepBaseY + 0.72, keepHalf + 0.45]}
          color={CITADEL_PALETTE.flameGlow}
          intensity={0.55}
          distance={2.8}
          decay={2}
        />
      ) : null}

      {spec.bannerCount === 1 ? (
        <CitadelBanner position={[0, upperTopY + spec.belfryHeight + 0.96, 0]} scale={0.82} tex={tex} />
      ) : null}
      {spec.bannerCount >= 2 ? (
        <>
          <CitadelBanner position={[-turretOffset, turretBannerY, turretOffset]} scale={0.68} phase={0.3} tex={tex} />
          <CitadelBanner position={[turretOffset, turretBannerY, turretOffset]} scale={0.68} phase={1.7} tex={tex} />
        </>
      ) : null}
      {spec.bannerCount === 4 ? (
        <>
          <CitadelBanner position={[-turretOffset, turretBannerY, -turretOffset]} scale={0.68} phase={2.9} tex={tex} />
          <CitadelBanner position={[turretOffset, turretBannerY, -turretOffset]} scale={0.68} phase={4.1} tex={tex} />
        </>
      ) : null}
    </group>
  );
}
