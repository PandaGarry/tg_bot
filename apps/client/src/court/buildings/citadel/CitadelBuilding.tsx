/**
 * Pass B — полная архитектурная и материальная проработка Цитадели TDL-ARCH-006 R2
 * (Ossuary Cathedral-Fortress, уровни 1..5).
 *
 * Архитектурный замысел (трёхчастный асимметричный собор-оплот):
 * 1. Primary mass — широкий соборный Неф с ритмом глубоких проёмов и контрфорсов,
 *    гранёная Апсида (L3–L5) и поперечное крыло-Трансепт (L4–L5);
 * 2. Secondary mass — выступающий монументальный Гейтхаус со ступенчатыми пилонами,
 *    многослойной аркой-пустотой, дубовыми окованными вратами и кованой герсой;
 * 3. Dominant vertical accent — вынесенная на лево-тыльное плечо гранёная Башня-Реликварий,
 *    соединённая с Нефом аркбутанами и увенчанная скульптурной Broken Ossuary Crown.
 *
 * Символ фракции Broken Ossuary Crown последовательно повторяется в 4 масштабах:
 * 1) макро-корона на башне-реликварии (L4–L5);
 * 2) каменный/костяно-железный горельеф над главными вратами (L1–L5);
 * 3) готический щит ордена и боевые штандарты с рваной кромкой;
 * 4) переплёт стрельчатых окон-ланцетов.
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

/** Скульптурный знак Broken Ossuary Crown (для портала и фронтонов). */
function BrokenCrownEmblem({
  position,
  rotationY = 0,
  scale = 1,
  withNiche = true,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  scale?: number;
  withNiche?: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY} scale={scale}>
      {withNiche ? (
        <>
          {/* Каменная резная рамка ниши */}
          <mesh position={[0, 0.12, -0.025]} castShadow>
            <boxGeometry args={[1.18, 0.96, 0.06]} />
            <meshStandardMaterial
              map={tex.dressedMap}
              bumpMap={tex.dressedBump}
              bumpScale={0.024}
              roughnessMap={tex.dressedRoughness}
              color="#d8d2c6"
              roughness={0.86}
            />
          </mesh>
          {/* Тёмная сердцевина-разлом за короной */}
          <mesh position={[0, 0.12, 0.004]}>
            <boxGeometry args={[0.98, 0.78, 0.04]} />
            <meshStandardMaterial color={CITADEL_PALETTE.portalVoid} roughness={0.95} />
          </mesh>
        </>
      ) : null}
      {/* Левое и правое костяные/светло-каменные восходящие рёбра */}
      <mesh geometry={geoms.brokenCrownEmblem} position={[0, 0.02, 0.036]} castShadow>
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.018} roughness={0.74} />
      </mesh>
      <mesh geometry={geoms.brokenCrownEmblem} position={[0, 0.02, 0.036]} scale={[-1, 1, 1]} castShadow>
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.018} roughness={0.74} />
      </mesh>
      {/* Третье центральное верхнее ребро в глубине разлома */}
      <mesh position={[0, 0.24, 0.022]} castShadow>
        <coneGeometry args={[0.10, 0.44, 4]} />
        <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.018} roughness={0.74} />
      </mesh>
      {/* Единая вертикальная кованая железная ость с бронзовым запорным узлом */}
      <mesh position={[0, 0.13, 0.072]} castShadow>
        <boxGeometry args={[0.068, 0.74, 0.048]} />
        <meshStandardMaterial
          map={tex.ironMap}
          bumpMap={tex.ironBump}
          bumpScale={0.014}
          roughnessMap={tex.ironRoughness}
          roughness={0.38}
          metalness={0.78}
        />
      </mesh>
      <mesh position={[0, -0.06, 0.078]} castShadow>
        <boxGeometry args={[0.24, 0.055, 0.052]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.44} metalness={0.68} />
      </mesh>
    </group>
  );
}

/** Готический геральдический щит со знаком Broken Ossuary Crown. */
function BrokenCrownShield({
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
      <mesh geometry={geoms.heraldicShield} scale={[0.26, 0.28, 0.036]} castShadow>
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.40} metalness={0.76} />
      </mesh>
      <mesh geometry={geoms.heraldicShield} position-z={0.012} scale={[0.21, 0.23, 0.03]}>
        <meshStandardMaterial color={CITADEL_PALETTE.bannerCloth} roughness={0.70} metalness={0.12} />
      </mesh>
      {/* Мини-эмблема Broken Ossuary Crown на щите */}
      <group position={[0, -0.02, 0.026]} scale={0.14}>
        <mesh geometry={geoms.brokenCrownEmblem} position={[0, 0, 0]}>
          <meshStandardMaterial map={tex.boneMap} roughness={0.72} />
        </mesh>
        <mesh geometry={geoms.brokenCrownEmblem} position={[0, 0, 0]} scale={[-1, 1, 1]}>
          <meshStandardMaterial map={tex.boneMap} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.14, 0.04]}>
          <boxGeometry args={[0.075, 0.72, 0.045]} />
          <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.70} />
        </mesh>
      </group>
    </group>
  );
}

/** Готическое стрельчатое окно-ланцет, повторяющее переплёт Broken Ossuary Crown. */
function BrokenCrownLancet({
  position,
  rotationY = 0,
  width = 0.28,
  height = 0.56,
  lit = true,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  lit?: boolean;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      {/* Утопленный каменный наличник */}
      <mesh geometry={geoms.pointedArch} position={[0, -height * 0.5, 0]} scale={[width, height, 0.08]} castShadow>
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.02}
          roughnessMap={tex.dressedRoughness}
          roughness={0.86}
        />
      </mesh>
      {/* Тёмный или тлеющий проём */}
      <mesh position={[0, -height * 0.04, 0.008]}>
        <boxGeometry args={[width * 0.58, height * 0.72, 0.04]} />
        {lit ? (
          <meshStandardMaterial {...createHearthWindowMaterialProps()} />
        ) : (
          <meshStandardMaterial color={CITADEL_PALETTE.portalVoid} roughness={0.95} />
        )}
      </mesh>
      {/* Переплёт Broken Crown: вертикальная железная ость + пара верхних косых перемычек */}
      <mesh position={[0, -height * 0.02, 0.032]}>
        <boxGeometry args={[0.024, height * 0.74, 0.024]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.38} metalness={0.78} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.14, height * 0.14, 0.032]} rotation-z={s * 0.26}>
          <boxGeometry args={[0.018, height * 0.34, 0.022]} />
          <meshStandardMaterial map={tex.ironMap} roughness={0.38} metalness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

/** Глубокая слепая стрельчатая арочная ниша пролёта стены (masonry bay). */
function BlindMasonryBay({
  position,
  rotationY = 0,
  width,
  height,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <mesh geometry={geoms.pointedArch} position={[0, -height * 0.5, 0.02]} scale={[width, height, 0.07]} castShadow>
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.022}
          roughnessMap={tex.dressedRoughness}
          roughness={0.86}
        />
      </mesh>
      <mesh position={[0, -height * 0.08, -0.002]}>
        <boxGeometry args={[width * 0.60, height * 0.74, 0.03]} />
        <meshStandardMaterial color="#3c3a37" roughness={0.94} />
      </mesh>
    </group>
  );
}

/** Строгая кованая жаровня с анимированным пламенем (локальный свет только у врат). */
function GateBrazier({
  position,
  lightIntensity = 0.85,
  tex,
}: {
  position: readonly [number, number, number];
  lightIntensity?: number;
  tex: CitadelTextureSet;
}) {
  const flameRef = useRef<THREE.Mesh>(null);
  const phase = position[0] * 3.1 + position[2] * 2.3;

  useFrame(({ clock }) => {
    const f = flameRef.current;
    if (!f) return;
    const t = clock.elapsedTime;
    const flicker = 0.88 + Math.sin(t * 7.8 + phase) * 0.14 + Math.cos(t * 12.1 + phase) * 0.08;
    f.scale.set(0.92, flicker * 1.12, 0.92);
    f.rotation.y = t * 1.6;
  });

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.10, 0.32, 6]} />
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.40} metalness={0.78} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.125, 0.065, 0.10, 6]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.38} metalness={0.8} />
      </mesh>
      <mesh ref={flameRef} position={[0, 0.44, 0]}>
        <coneGeometry args={[0.062, 0.16, 5]} />
        <meshStandardMaterial {...createBrazierFlameMaterialProps()} />
      </mesh>
      {lightIntensity > 0 ? (
        <pointLight position={[0, 0.56, 0.10]} color={CITADEL_PALETTE.flameGlow} intensity={lightIntensity} distance={2.1} decay={2.2} />
      ) : null}
    </group>
  );
}

/** Боевой штандарт ордена со знаком Broken Ossuary Crown и рваным краем. */
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
      pos.setZ(i, Math.sin(x * 7.0 + t * 5.0 + phase) * 0.045 * (x + 0.25));
    }
    pos.needsUpdate = true;
  });
  return (
    <group position={[position[0], position[1], position[2]]} scale={scale}>
      <mesh position-y={0.38} castShadow>
        <cylinderGeometry args={[0.020, 0.026, 0.86, 6]} />
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.40} metalness={0.78} />
      </mesh>
      <mesh position-y={0.84}>
        <coneGeometry args={[0.036, 0.10, 4]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.70} />
      </mesh>
      <mesh ref={clothRef} position={[0.28, 0.58, 0]} castShadow>
        <planeGeometry args={[0.54, 0.34, 8, 1]} />
        <meshStandardMaterial
          map={tex.bannerMap}
          alphaMap={tex.bannerAlpha}
          alphaTest={0.45}
          side={THREE.DoubleSide}
          roughness={0.82}
        />
      </mesh>
    </group>
  );
}

/**
 * Доминирующее завершение башни-реликвария:
 * - открытый 8-гранный готический фонарь со стрельчатыми арочными прорезями (L4–L5);
 * - три скульптурных костяных/каменных ребра Broken Ossuary Crown в ракурсе (все 3 видны!);
 * - глубокая тёмная сердцевина с пульсирующей некротической филактерией;
 * - пронзающая кованая вертикальная железная ость-шпиль и редкие бронзовые скобы.
 */
function BrokenOssuaryCrownTop({
  baseY,
  topY,
  shaftRadius,
  geoms,
  tex,
  sovereign,
  withBanner,
}: {
  baseY: number;
  topY: number;
  shaftRadius: number;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
  sovereign: boolean;
  withBanner: boolean;
}) {
  const crystalRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const h = topY - baseY;
  const ribH = h * (sovereign ? 0.80 : 0.74);
  const ribScale = sovereign ? 1.06 : 0.92;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const hoverY = ribH * 0.44 + Math.sin(t * 2.0) * 0.032;
    if (crystalRef.current) {
      crystalRef.current.position.y = hoverY;
      crystalRef.current.rotation.y = t * 0.68;
    }
    if (innerRef.current) {
      innerRef.current.position.y = hoverY;
      innerRef.current.rotation.y = -t * 1.05;
    }
  });

  // Разворот тройки рёбер так, чтобы все 3 отчётливо разделялись в дефолтной камере [-1, +1] и сзади/сбоку
  const ribs: readonly { angle: number; hMul: number; rMul: number }[] = [
    { angle: -Math.PI * 0.78, hMul: 0.94, rMul: 0.96 },
    { angle: Math.PI * 0.26, hMul: 0.92, rMul: 0.96 },
    { angle: Math.PI * 0.86, hMul: 1.08, rMul: 1.02 },
  ];

  return (
    <group position={[0, baseY, 0]}>
      {/* Открытый коронационный постамент с бронзовым обручем */}
      <mesh position={[0, 0.07, 0]} rotation-y={Math.PI / 8} castShadow>
        <cylinderGeometry args={[shaftRadius * 1.24, shaftRadius * 1.06, 0.14, 8]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.022}
          roughnessMap={tex.dressedRoughness}
          roughness={0.86}
        />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[shaftRadius * 1.04, 0.028, 6, 16]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.44} metalness={0.68} />
      </mesh>

      {/* Нижняя глубокая тёмная камера-колодец внутри короны (не перекрывает пустоту сверху!) */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[shaftRadius * 0.46, shaftRadius * 0.60, 0.18, 8]} />
        <meshStandardMaterial color={CITADEL_PALETTE.portalVoid} roughness={0.96} />
      </mesh>
      {/* Узкая вертикальная тёмная щель-пустота за железной остью между рёбрами */}
      <mesh position={[0, ribH * 0.42, 0]}>
        <cylinderGeometry args={[0.065, 0.10, ribH * 0.68, 6]} />
        <meshStandardMaterial color="#0d0d11" roughness={0.96} />
      </mesh>

      {/* Три скульптурных костяно-каменных ребра Broken Ossuary Crown */}
      {ribs.map((rb, idx) => (
        <group key={idx} rotation-y={rb.angle}>
          <mesh
            geometry={geoms.crownRib}
            position={[0, 0.10, 0]}
            scale={[ribScale * 1.14, ribH * rb.hMul, ribScale * rb.rMul]}
            castShadow
          >
            <meshStandardMaterial map={tex.boneMap} bumpMap={tex.boneBump} bumpScale={0.02} roughness={0.76} metalness={0.04} />
          </mesh>
          {/* Кованая скрепа у основания каждого ребра */}
          <mesh position={[0, 0.24, shaftRadius * 1.02]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.09]} />
            <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.38} metalness={0.78} />
          </mesh>
        </group>
      ))}

      {/* Единая вертикальная кованая железная ость-шпиль через разлом короны */}
      <mesh position={[0, h * 0.50, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.044, h, 6]} />
        <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.36} metalness={0.80} />
      </mesh>
      {/* Запорная кованая перекладина + верхний бронзовый финиал */}
      <mesh position={[0, ribH * 0.66, 0]} castShadow>
        <boxGeometry args={[shaftRadius * 1.16, 0.046, 0.048]} />
        <meshStandardMaterial map={tex.ironMap} roughness={0.36} metalness={0.80} />
      </mesh>
      <mesh position={[0, h * 0.90, 0]}>
        <octahedronGeometry args={[0.056, 0]} />
        <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.42} metalness={0.72} />
      </mesh>

      {/* Сдержанная некротическая филактерия в разломе тёмной пустоты между костяных рёбер */}
      <mesh ref={crystalRef} geometry={geoms.crystal} position={[0, ribH * 0.40, 0]} scale={sovereign ? 0.48 : 0.38}>
        <meshStandardMaterial {...createNecroticCrystalMaterialProps()} />
      </mesh>
      <mesh ref={innerRef} geometry={geoms.crystalCore} position={[0, ribH * 0.40, 0]} scale={sovereign ? 0.48 : 0.38}>
        <meshStandardMaterial color="#6fe0b0" emissive="#2da677" emissiveIntensity={0.85} roughness={0.22} />
      </mesh>
      <pointLight
        position={[0, ribH * 0.44, 0]}
        color={CITADEL_PALETTE.necroticGlow}
        intensity={sovereign ? 0.58 : 0.42}
        distance={2.2}
        decay={2.2}
      />

      {/* Державный вымпел на ости L5 */}
      {withBanner ? <CitadelBanner position={[0, h * 0.72, 0]} scale={0.72} phase={0.7} tex={tex} /> : null}
    </group>
  );
}

/** Крупнопрофилированная сланцевая двускатная крыша с выступающими торцами, коньком и стропильными швами. */
function DetailedSlateGableRoof({
  position,
  rotationY = 0,
  width,
  height,
  depth,
  ribCount,
  geoms,
  tex,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  depth: number;
  ribCount: number;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const halfW = width * 0.54;
  const slopeLen = Math.hypot(halfW, height);
  const slopeAngle = Math.atan2(height, halfW);

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      {/* Основное тело сланцевой кровли */}
      <mesh geometry={geoms.gableRoof} scale={[width, height, depth]} castShadow receiveShadow>
        <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.036} roughness={0.68} metalness={0.08} />
      </mesh>
      {/* Выраженные толстые каменные торцевые щипцы/свесы (edge thickness!) */}
      {[-depth * 0.5 + 0.025, depth * 0.5 - 0.025].map((zOff, idx) => (
        <mesh key={`barge-${idx}`} geometry={geoms.gableRoof} position={[0, 0.015, zOff]} scale={[width * 1.03, height * 1.03, 0.065]} castShadow>
          <meshStandardMaterial
            map={tex.dressedMap}
            bumpMap={tex.dressedBump}
            bumpScale={0.02}
            roughnessMap={tex.dressedRoughness}
            roughness={0.86}
          />
        </mesh>
      ))}
      {/* Объёмный сланцево-железный коньковый гребень */}
      <mesh position={[0, height + 0.015, 0]} castShadow>
        <boxGeometry args={[0.10, 0.08, depth + 0.08]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.82} />
      </mesh>
      {/* Поперечные швы / рёбра скатов кровли — дают чёткий ритм плоскостей с 24 м */}
      {Array.from({ length: ribCount }, (_, i) => {
        const z = (i / Math.max(1, ribCount - 1) - 0.5) * (depth * 0.72);
        return (
          <group key={`rr-${i}`} position={[0, height * 0.5, z]}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * halfW * 0.48, 0.02, 0]}
                rotation-z={side * (Math.PI * 0.5 - slopeAngle)}
                castShadow
              >
                <boxGeometry args={[0.045, slopeLen * 0.96, 0.045]} />
                <meshStandardMaterial map={tex.ironMap} roughness={0.44} metalness={0.68} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Монументальный выдвинутый Гейтхаус со ступенчатыми архивольтами, дубовыми вратами и герсой. */
function MonumentalGatehouse({
  spec,
  geoms,
  tex,
}: {
  spec: CitadelLevelVisualSpec;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const py = spec.plinthHeight;
  const gateZCenter = spec.gateFrontZ - spec.gateDepth * 0.5;
  const frontFaceZ = spec.gateDepth * 0.5;
  const pylonW = (spec.gateWidth - spec.portalVoidWidth) * 0.5;
  const lintelH = Math.max(0.46, spec.gateWallHeight - spec.portalVoidHeight);
  const doorZ = frontFaceZ - spec.portalVoidDepth * 0.72;
  const portcullisZ = frontFaceZ - spec.portalVoidDepth * 0.28;

  return (
    <group position={[spec.gateCenterX, py, gateZCenter]}>
      {/* Боковые устои/пилоны гейтхауса в крупной блочной кладке */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (spec.portalVoidWidth * 0.5 + pylonW * 0.5), spec.gateWallHeight * 0.5, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[pylonW, spec.gateWallHeight, spec.gateDepth]} />
          <meshStandardMaterial
            map={tex.wallMap}
            bumpMap={tex.wallBump}
            bumpScale={0.04}
            roughnessMap={tex.wallRoughness}
            roughness={0.86}
          />
        </mesh>
      ))}

      {/* Выступающие контрфорсы пилонов (L2–L5) */}
      {spec.level >= 2
        ? [-1, 1].map((side) => (
            <group key={`gp-${side}`}>
              <mesh
                geometry={geoms.buttress}
                position={[side * (spec.gateWidth * 0.42), 0, frontFaceZ]}
                scale={[0.14, spec.gateWallHeight * 0.88, 0.20]}
                castShadow
              >
                <meshStandardMaterial
                  map={tex.dressedMap}
                  bumpMap={tex.dressedBump}
                  bumpScale={0.022}
                  roughnessMap={tex.dressedRoughness}
                  roughness={0.84}
                />
              </mesh>
              {spec.hasPinnacles ? (
                <mesh
                  geometry={geoms.pinnacleSpire}
                  position={[side * (spec.gateWidth * 0.42), spec.gateWallHeight, 0.08]}
                  scale={[0.42, 0.38, 0.42]}
                  castShadow
                >
                  <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
                </mesh>
              ) : null}
            </group>
          ))
        : null}

      {/* Массивная каменная притолока/фриз над проёмом */}
      <mesh position={[0, spec.portalVoidHeight + lintelH * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.portalVoidWidth + 0.12, lintelH, spec.gateDepth]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.025}
          roughnessMap={tex.dressedRoughness}
          roughness={0.84}
        />
      </mesh>

      {/* Карнизный пояс и зубчатый крепостной парапет (отличает гейтхаус от фронтона нефа!) */}
      <mesh position={[0, spec.gateWallHeight + 0.04, 0]} castShadow>
        <boxGeometry args={[spec.gateWidth + 0.10, 0.08, spec.gateDepth + 0.08]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.82} />
      </mesh>
      <mesh position={[0, spec.gateWallHeight + spec.gateParapetHeight * 0.35, 0]} castShadow>
        <boxGeometry args={[spec.gateWidth + 0.06, spec.gateParapetHeight * 0.65, spec.gateDepth + 0.04]} />
        <meshStandardMaterial map={tex.wallMap} bumpMap={tex.wallBump} bumpScale={0.03} roughness={0.86} />
      </mesh>
      {spec.level >= 2
        ? [-0.38, -0.13, 0.13, 0.38].map((mx, i) => (
            <mesh key={`gm-${i}`} position={[mx * spec.gateWidth, spec.gateWallHeight + spec.gateParapetHeight * 0.85, frontFaceZ - 0.05]} castShadow>
              <boxGeometry args={[spec.gateWidth * 0.16, spec.gateParapetHeight * 0.48, 0.14]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
            </mesh>
          ))
        : null}

      {/* Задняя тёмная стенка и глухая верхняя/боковая полость тоннеля (ЗА створками врат и под трилистником!) */}
      <mesh position={[0, spec.portalVoidHeight * 0.5, doorZ - 0.08]}>
        <boxGeometry args={[spec.portalVoidWidth * 0.96, spec.portalVoidHeight * 0.98, 0.10]} />
        <meshStandardMaterial color={CITADEL_PALETTE.portalVoid} roughness={0.96} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`tun-side-${side}`}
          position={[side * (spec.portalVoidWidth * 0.48), spec.portalVoidHeight * 0.48, frontFaceZ - spec.portalVoidDepth * 0.5]}
        >
          <boxGeometry args={[0.04, spec.portalVoidHeight * 0.96, spec.portalVoidDepth]} />
          <meshStandardMaterial color="#19161a" roughness={0.94} />
        </mesh>
      ))}
      <mesh position={[0, spec.portalVoidHeight * 0.94, frontFaceZ - spec.portalVoidDepth * 0.5]}>
        <boxGeometry args={[spec.portalVoidWidth * 0.96, 0.08, spec.portalVoidDepth]} />
        <meshStandardMaterial color="#161418" roughness={0.94} />
      </mesh>

      {/* Ступенчатые уступчатые архивольты уходящие в глубину к воротам */}
      {Array.from({ length: spec.portalArchTiers }, (_, tIdx) => {
        const s = 1 - tIdx * 0.12;
        const az = frontFaceZ - 0.04 - tIdx * (spec.portalVoidDepth * 0.24);
        return (
          <mesh
            key={`arch-${tIdx}`}
            geometry={geoms.pointedArch}
            position={[0, 0.01, az]}
            scale={[spec.portalVoidWidth * 1.18 * s, spec.portalVoidHeight * 1.02 * s, 0.11]}
            castShadow
          >
            <meshStandardMaterial
              map={tex.dressedMap}
              bumpMap={tex.dressedBump}
              bumpScale={0.024}
              roughnessMap={tex.dressedRoughness}
              roughness={0.84}
            />
          </mesh>
        );
      })}

      {/* Прорезной готический тимпан-трилистник в арке (L3–L5) */}
      {spec.level >= 3 ? (
        <mesh
          geometry={geoms.trefoilTracery}
          position={[0, spec.portalVoidHeight * 0.68, doorZ + 0.06]}
          scale={[spec.portalVoidWidth * 0.68, spec.portalVoidHeight * 0.28, 0.06]}
          castShadow
        >
          <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
        </mesh>
      ) : null}

      {/* Толстые окованные дубовые врата (4 широкие плахи на текстуре) */}
      <group position={[0, 0, doorZ]}>
        <mesh position={[0, spec.portalVoidHeight * 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.portalVoidWidth * 0.86, spec.portalVoidHeight * 0.72, 0.08]} />
          <meshStandardMaterial map={tex.timberMap} bumpMap={tex.timberBump} bumpScale={0.032} roughness={0.76} />
        </mesh>
        {/* Центральный стык створок + 3 кованые железные полосы с петлями и заклёпками */}
        <mesh position={[0, spec.portalVoidHeight * 0.36, 0.045]}>
          <boxGeometry args={[0.025, spec.portalVoidHeight * 0.70, 0.02]} />
          <meshStandardMaterial map={tex.ironMap} roughness={0.36} metalness={0.80} />
        </mesh>
        {[0.14, 0.36, 0.58].map((yf, idx) => (
          <mesh key={`band-${idx}`} position={[0, spec.portalVoidHeight * yf, 0.048]} castShadow>
            <boxGeometry args={[spec.portalVoidWidth * 0.84, 0.045, 0.024]} />
            <meshStandardMaterial map={tex.ironMap} roughnessMap={tex.ironRoughness} roughness={0.34} metalness={0.82} />
          </mesh>
        ))}
        {/* Пара бронзовых колец-стучалок */}
        {[-0.11, 0.11].map((rx, idx) => (
          <mesh key={`ring-${idx}`} position={[rx, spec.portalVoidHeight * 0.30, 0.060]}>
            <torusGeometry args={[0.038, 0.010, 6, 12]} />
            <meshStandardMaterial color={CITADEL_PALETTE.agedBronze} roughness={0.38} metalness={0.76} />
          </mesh>
        ))}
      </group>

      {/* Полуопущенная зубчатая кованая решётка-герса в тени арки (L2–L5) */}
      {spec.hasPortcullis ? (
        <group position={[0, spec.portalVoidHeight * 0.58, portcullisZ]}>
          {[-0.32, -0.11, 0.11, 0.32].map((bx, idx) => (
            <group key={`bar-${idx}`} position={[bx * spec.portalVoidWidth, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.028, spec.portalVoidHeight * 0.56, 0.028]} />
                <meshStandardMaterial map={tex.ironMap} roughness={0.36} metalness={0.82} />
              </mesh>
              <mesh position={[0, -spec.portalVoidHeight * 0.30, 0]} rotation-x={Math.PI} castShadow>
                <coneGeometry args={[0.026, 0.075, 4]} />
                <meshStandardMaterial map={tex.ironMap} roughness={0.36} metalness={0.82} />
              </mesh>
            </group>
          ))}
          {[-0.10, 0.12].map((hy, idx) => (
            <mesh key={`hbar-${idx}`} position={[0, hy, 0]} castShadow>
              <boxGeometry args={[spec.portalVoidWidth * 0.78, 0.03, 0.03]} />
              <meshStandardMaterial map={tex.ironMap} roughness={0.36} metalness={0.82} />
            </mesh>
          ))}
        </group>
      ) : null}

      {/* Горельефный знак Broken Ossuary Crown на каменном фризе над входом */}
      <BrokenCrownEmblem
        position={[0, spec.portalVoidHeight + lintelH * 0.54, frontFaceZ + 0.032]}
        scale={spec.crownReliefScale}
        withNiche={spec.level >= 2}
        geoms={geoms}
        tex={tex}
      />

      {/* Строгий каменный щипец-вимперг обрамляющий эмблему на L3–L5 */}
      {spec.level >= 3 ? (
        <mesh
          geometry={geoms.wimperg}
          position={[0, spec.portalVoidHeight + lintelH * 0.10, frontFaceZ + 0.01]}
          scale={[spec.portalVoidWidth * 1.12, lintelH * 1.04, 0.07]}
          castShadow
        >
          <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
        </mesh>
      ) : null}

      {/* Геральдический щит ордена на парапете гейтхауса L4–L5 */}
      {spec.level >= 4 ? (
        <BrokenCrownShield
          position={[0, spec.gateWallHeight + spec.gateParapetHeight * 0.42, frontFaceZ + 0.036]}
          scale={0.78}
          geoms={geoms}
          tex={tex}
        />
      ) : null}

      {/* Сдержанные кованые жаровни у врат (мягко подсвечивают глубину портала без пересвета пилонов) */}
      {spec.brazierCount >= 2
        ? [-1, 1].map((side) => (
            <GateBrazier
              key={`bz-f-${side}`}
              position={[side * (spec.gateWidth * 0.48), 0, frontFaceZ + 0.22]}
              lightIntensity={side === -1 ? 0.50 : 0.40}
              tex={tex}
            />
          ))
        : null}
    </group>
  );
}

/** Анимируемый дым очага из каменной трубы правого придела/нефа. */
function ChimneySmoke({ origin, tex }: { origin: readonly [number, number, number]; tex: CitadelTextureSet }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const baseProps = createAshSmokeMaterialProps();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.20 + i / 5) % 1;
      m.position.set(
        origin[0] + Math.sin(p * 4.5 + i) * 0.07,
        origin[1] + p * 1.15,
        origin[2] + Math.cos(p * 3.8 + i) * 0.06,
      );
      m.scale.setScalar(0.32 + p * 0.72);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.28 * (1 - p);
    });
  });

  return (
    <group>
      {/* Строгая каменная дымовая труба */}
      <mesh position={[origin[0], origin[1] - 0.34, origin[2]]} castShadow>
        <boxGeometry args={[0.20, 0.68, 0.20]} />
        <meshStandardMaterial map={tex.wallMap} bumpMap={tex.wallBump} bumpScale={0.03} roughness={0.88} />
      </mesh>
      <mesh position={[origin[0], origin[1] - 0.02, origin[2]]} castShadow>
        <boxGeometry args={[0.26, 0.06, 0.26]} />
        <meshStandardMaterial map={tex.dressedMap} roughness={0.86} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} ref={(el) => { puffs.current[i] = el; }}>
          <dodecahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial {...baseProps} />
        </mesh>
      ))}
    </group>
  );
}

function CitadelCathedralArchitecture({
  spec,
  geoms,
  tex,
}: {
  spec: CitadelLevelVisualSpec;
  geoms: CitadelGeometrySet;
  tex: CitadelTextureSet;
}) {
  const py = spec.plinthHeight;
  const naveBaseY = py;
  const naveTopY = naveBaseY + spec.naveWallHeight;
  const towerH = spec.towerShaftTopY - py;

  // Аркбутан от левой стенки кровли Нефа к 8-гранному поясу Башни-Реликвария
  const naveAnchor = new THREE.Vector3(spec.naveCenterX - spec.naveWidth * 0.24, naveTopY + 0.18, spec.naveCenterZ - 0.32);
  const towerAnchor = new THREE.Vector3(
    spec.towerCenterX + spec.towerShaftRadius * 0.76,
    Math.min(spec.towerShaftTopY - 0.32, naveTopY + 1.08),
    spec.towerCenterZ + spec.towerShaftRadius * 0.56,
  );
  const buttressSpan = Math.hypot(towerAnchor.x - naveAnchor.x, towerAnchor.z - naveAnchor.z);
  const buttressYaw = Math.atan2(-(towerAnchor.z - naveAnchor.z), towerAnchor.x - naveAnchor.x);

  return (
    <group>
      {/* Базовый двухступенчатый каменный стилобат + скошенный цокольный отлив */}
      <mesh position={[spec.plinthOffsetX, py * 0.45, spec.plinthOffsetZ]} castShadow receiveShadow>
        <boxGeometry args={[spec.plinthWidth, py * 0.90, spec.plinthDepth]} />
        <meshStandardMaterial
          map={tex.dressedMap}
          bumpMap={tex.dressedBump}
          bumpScale={0.025}
          color="#726c64"
          roughness={0.88}
        />
      </mesh>
      <mesh position={[spec.plinthOffsetX, py * 0.94, spec.plinthOffsetZ]} castShadow receiveShadow>
        <boxGeometry args={[spec.plinthWidth - 0.10, py * 0.16, spec.plinthDepth - 0.10]} />
        <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.84} />
      </mesh>
      {/* Широкие парадные ступени к дорожке */}
      {Array.from({ length: spec.stepCount }, (_, i) => {
        const sh = py / spec.stepCount;
        const sz = spec.gateFrontZ + 0.02 + i * ((spec.stepReachZ - spec.gateFrontZ) / spec.stepCount);
        return (
          <mesh key={i} position={[spec.gateCenterX, py - (i + 0.5) * sh, sz]} castShadow receiveShadow>
            <boxGeometry args={[spec.portalVoidWidth + 0.52 - i * 0.08, sh, 0.20]} />
            <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.85} />
          </mesh>
        );
      })}

      {/* 1. PRIMARY MASS — СОБОРНЫЙ НЕФ + РИТМ ПРОЁМОВ + АПСИДА + ТРАНСЕПТ */}
      <group>
        {/* Стеновой корпус Нефа (крупная блочная кладка) */}
        <mesh position={[spec.naveCenterX, naveBaseY + spec.naveWallHeight * 0.5, spec.naveCenterZ]} castShadow receiveShadow>
          <boxGeometry args={[spec.naveWidth, spec.naveWallHeight, spec.naveDepth]} />
          <meshStandardMaterial
            map={tex.wallMap}
            bumpMap={tex.wallBump}
            bumpScale={0.044}
            roughnessMap={tex.wallRoughness}
            roughness={0.86}
          />
        </mesh>

        {/* Выраженный тёсаный карниз и зубцы парапета вдоль боковых стен (L3–L5) */}
        <mesh position={[spec.naveCenterX, naveTopY + 0.04, spec.naveCenterZ]} castShadow>
          <boxGeometry args={[spec.naveWidth + 0.12, 0.09, spec.naveDepth + 0.12]} />
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.84} />
        </mesh>
        {/* Выраженная соборная сланцевая кровля с рёбрами и толстыми щипцами */}
        <DetailedSlateGableRoof
          position={[spec.naveCenterX, naveTopY + 0.07, spec.naveCenterZ]}
          width={spec.naveWidth * 1.02}
          height={spec.naveRoofHeight}
          depth={spec.naveDepth + 0.10}
          ribCount={spec.level >= 3 ? 4 : 2}
          geoms={geoms}
          tex={tex}
        />

        {/* Уступчатые контрфорсы с пинаклями и утопленные ниши-окна по обоим бортам Нефа */}
        {Array.from({ length: spec.naveButtressPairs }, (_, i) => {
          const zFrac = (i / (spec.naveButtressPairs - 1) - 0.5) * 0.78;
          const bz = spec.naveCenterZ + zFrac * spec.naveDepth;
          return (
            <group key={`nb-${i}`}>
              {[-1, 1].map((side) => (
                <group key={side}>
                  <mesh
                    geometry={geoms.buttress}
                    position={[spec.naveCenterX + side * (spec.naveWidth * 0.5), naveBaseY, bz]}
                    rotation-y={side * (Math.PI / 2)}
                    scale={[0.15, spec.naveWallHeight * 0.96, 0.24]}
                    castShadow
                  >
                    <meshStandardMaterial
                      map={tex.dressedMap}
                      bumpMap={tex.dressedBump}
                      bumpScale={0.024}
                      roughnessMap={tex.dressedRoughness}
                      roughness={0.84}
                    />
                  </mesh>
                  {spec.hasPinnacles ? (
                    <mesh
                      geometry={geoms.pinnacleSpire}
                      position={[spec.naveCenterX + side * (spec.naveWidth * 0.5 + 0.05), naveTopY + 0.06, bz]}
                      scale={[0.42, 0.42, 0.42]}
                      castShadow
                    >
                      <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
                    </mesh>
                  ) : null}
                </group>
              ))}
            </group>
          );
        })}

        {/* Ритм слепых пролётов и окон Broken Crown по видимой левой стене (-X) и правой (+X) */}
        {Array.from({ length: Math.max(1, spec.naveButtressPairs - 1) }, (_, i) => {
          const spanZ = spec.naveDepth * 0.78 / (spec.naveButtressPairs - 1);
          const wz = spec.naveCenterZ + (i - (spec.naveButtressPairs - 2) * 0.5) * spanZ;
          const bayW = Math.min(0.36, spanZ * 0.72);
          const bayH = spec.naveWallHeight * 0.76;
          return (
            <group key={`bay-${i}`}>
              <BlindMasonryBay
                position={[spec.naveCenterX - spec.naveWidth * 0.5, naveBaseY + bayH * 0.5 + 0.08, wz]}
                rotationY={-Math.PI / 2}
                width={bayW}
                height={bayH}
                geoms={geoms}
                tex={tex}
              />
              <BrokenCrownLancet
                position={[spec.naveCenterX - spec.naveWidth * 0.5 - 0.01, naveBaseY + spec.naveWallHeight * 0.54, wz]}
                rotationY={-Math.PI / 2}
                width={bayW * 0.72}
                height={bayH * 0.66}
                lit={spec.level >= 2}
                geoms={geoms}
                tex={tex}
              />
              {!spec.hasSideChapel ? (
                <BrokenCrownLancet
                  position={[spec.naveCenterX + spec.naveWidth * 0.5 + 0.01, naveBaseY + spec.naveWallHeight * 0.54, wz]}
                  rotationY={Math.PI / 2}
                  width={bayW * 0.72}
                  height={bayH * 0.66}
                  lit={spec.level >= 2}
                  geoms={geoms}
                  tex={tex}
                />
              ) : null}
            </group>
          );
        })}

        {/* Задняя гранёная Апсида с 3 радиальными контрфорсами и ланцетными окнами (L3–L5) */}
        {spec.hasRearApse ? (
          <group position={[spec.naveCenterX, naveBaseY, spec.apseOffsetZ]}>
            <mesh position={[0, spec.apseHeight * 0.5, 0]} rotation-y={Math.PI / 6} castShadow receiveShadow>
              <cylinderGeometry args={[spec.apseRadius, spec.apseRadius * 1.06, spec.apseHeight, 6]} />
              <meshStandardMaterial
                map={tex.wallMap}
                bumpMap={tex.wallBump}
                bumpScale={0.04}
                roughnessMap={tex.wallRoughness}
                roughness={0.86}
              />
            </mesh>
            <mesh position={[0, spec.apseHeight + 0.03, 0]} rotation-y={Math.PI / 6} castShadow>
              <cylinderGeometry args={[spec.apseRadius * 1.07, spec.apseRadius * 1.07, 0.08, 6]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
            </mesh>
            <mesh position={[0, spec.apseHeight + 0.44, 0]} rotation-y={Math.PI / 6} castShadow>
              <coneGeometry args={[spec.apseRadius * 1.10, 0.84, 6]} />
              <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.68} />
            </mesh>
            {[Math.PI, Math.PI * 0.68, Math.PI * 1.32].map((ang, idx) => (
              <group key={`apb-${idx}`} rotation-y={ang}>
                <mesh
                  geometry={geoms.buttress}
                  position={[0, 0, spec.apseRadius * 0.94]}
                  scale={[0.16, spec.apseHeight * 0.92, 0.24]}
                  castShadow
                >
                  <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
                </mesh>
              </group>
            ))}
            <BrokenCrownLancet
              position={[0, spec.apseHeight * 0.56, -spec.apseRadius * 0.92]}
              rotationY={Math.PI}
              width={0.26}
              height={0.66}
              lit
              geoms={geoms}
              tex={tex}
            />
          </group>
        ) : null}

        {/* Поперечное правое соборное крыло / Трансепт с перпендикулярной кровлей (L4–L5) */}
        {spec.hasSideChapel ? (
          <group position={[spec.sideChapelCenterX, naveBaseY, spec.naveCenterZ - 0.04]}>
            <mesh position={[0, spec.sideChapelHeight * 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[spec.sideChapelWidth, spec.sideChapelHeight, spec.sideChapelDepth]} />
              <meshStandardMaterial
                map={tex.wallMap}
                bumpMap={tex.wallBump}
                bumpScale={0.04}
                roughnessMap={tex.wallRoughness}
                roughness={0.86}
              />
            </mesh>
            <mesh position={[0, spec.sideChapelHeight + 0.03, 0]} castShadow>
              <boxGeometry args={[spec.sideChapelWidth + 0.08, 0.07, spec.sideChapelDepth + 0.08]} />
              <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
            </mesh>
            <DetailedSlateGableRoof
              position={[0, spec.sideChapelHeight + 0.06, 0]}
              rotationY={Math.PI / 2}
              width={spec.sideChapelDepth * 0.98}
              height={spec.sideChapelRoofHeight}
              depth={spec.sideChapelWidth + 0.14}
              ribCount={2}
              geoms={geoms}
              tex={tex}
            />
            <mesh
              geometry={geoms.buttress}
              position={[spec.sideChapelWidth * 0.5, 0, 0]}
              rotation-y={Math.PI / 2}
              scale={[0.18, spec.sideChapelHeight * 0.92, 0.20]}
              castShadow
            >
              <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
            </mesh>
            <BrokenCrownLancet
              position={[spec.sideChapelWidth * 0.5 + 0.01, spec.sideChapelHeight * 0.56, 0]}
              rotationY={Math.PI / 2}
              width={0.30}
              height={0.70}
              lit
              geoms={geoms}
              tex={tex}
            />
            <BrokenCrownShield
              position={[spec.sideChapelWidth * 0.5 + 0.02, spec.sideChapelHeight + 0.34, 0]}
              rotationY={Math.PI / 2}
              scale={0.75}
              geoms={geoms}
              tex={tex}
            />
          </group>
        ) : null}

        {/* Выраженный верхний знак-щита на главном восточном щипце Нефа за Гейтхаусом (L3–L5) */}
        {spec.level >= 3 ? (
          <BrokenCrownEmblem
            position={[spec.naveCenterX, naveTopY + spec.naveRoofHeight * 0.48, spec.naveCenterZ + spec.naveDepth * 0.5 + 0.04]}
            scale={0.40}
            withNiche={false}
            geoms={geoms}
            tex={tex}
          />
        ) : null}
      </group>

      {/* 2. SECONDARY MASS — МОНУМЕНТАЛЬНЫЙ ГЕЙТХАУС */}
      <MonumentalGatehouse spec={spec} geoms={geoms} tex={tex} />

      {/* 3. DOMINANT VERTICAL ACCENT — СТУПЕНЧАТО-ГРАНЁНАЯ БАШНЯ-РЕЛИКВАРИЙ */}
      <group position={[spec.towerCenterX, 0, spec.towerCenterZ]}>
        {/* Мощный уступчатый цоколь башни в каменной кладке */}
        <mesh position={[0, py + towerH * 0.19, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.towerBaseSize, towerH * 0.38, spec.towerBaseSize]} />
          <meshStandardMaterial
            map={tex.wallMap}
            bumpMap={tex.wallBump}
            bumpScale={0.042}
            roughnessMap={tex.wallRoughness}
            roughness={0.86}
          />
        </mesh>
        <mesh position={[0, py + towerH * 0.39, 0]} castShadow>
          <boxGeometry args={[spec.towerBaseSize + 0.09, 0.10, spec.towerBaseSize + 0.09]} />
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.02} roughness={0.84} />
        </mesh>

        {/* 4 диагонально-осевых контрфорса с пинаклями вокруг устоя башни */}
        {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((ang, idx) => (
          <group key={`tb-${idx}`} rotation-y={ang}>
            <mesh
              geometry={geoms.buttress}
              position={[0, py, spec.towerShaftRadius * 0.86]}
              scale={[0.15, towerH * 0.78, 0.22]}
              castShadow
            >
              <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.84} />
            </mesh>
            {spec.hasPinnacles ? (
              <mesh
                geometry={geoms.pinnacleSpire}
                position={[0, py + towerH * 0.39, spec.towerBaseSize * 0.44]}
                scale={[0.40, 0.44, 0.40]}
                castShadow
              >
                <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
              </mesh>
            ) : null}
          </group>
        ))}

        {/* Средняя 8-гранная шахта святилища в блочной кладке */}
        <mesh position={[0, py + towerH * 0.62, 0]} rotation-y={Math.PI / 8} castShadow receiveShadow>
          <cylinderGeometry args={[spec.towerShaftRadius * 0.94, spec.towerShaftRadius * 1.06, towerH * 0.56, 8]} />
          <meshStandardMaterial
            map={tex.wallMap}
            bumpMap={tex.wallBump}
            bumpScale={0.042}
            roughnessMap={tex.wallRoughness}
            roughness={0.86}
          />
        </mesh>

        {/* Углублённые вертикальные щели-амбразуры на плоских гранях 8-гранной башни (Math.PI/8 учтён!) */}
        {spec.level >= 2
          ? [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((ang, idx) => (
              <group key={`tslit-${idx}`} rotation-y={ang}>
                <BrokenCrownLancet
                  position={[0, py + towerH * 0.66, spec.towerShaftRadius * 0.94]}
                  width={0.18}
                  height={0.56}
                  lit={spec.level >= 3}
                  geoms={geoms}
                  tex={tex}
                />
              </group>
            ))
          : null}

        {/* Верхний ярус фонаря или шатровая крыша */}
        {spec.hasBrokenCrownTop ? (
          <>
            {/* Консольный открытый фонарный ярус оссуария (L4–L5) из 8 каменных столпов + решётка */}
            <group position={[0, spec.towerShaftTopY - 0.54, 0]}>
              <mesh position={[0, 0.04, 0]} rotation-y={Math.PI / 8} castShadow>
                <cylinderGeometry args={[spec.towerShaftRadius * 1.06, spec.towerShaftRadius * 0.96, 0.08, 8]} />
                <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <cylinderGeometry args={[spec.towerShaftRadius * 0.52, spec.towerShaftRadius * 0.56, 0.42, 8]} />
                <meshStandardMaterial color={CITADEL_PALETTE.portalVoid} roughness={0.95} />
              </mesh>
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
                const r = spec.towerShaftRadius * 0.92;
                return (
                  <mesh key={`lp-${k}`} position={[Math.sin(a) * r, 0.28, Math.cos(a) * r]} castShadow>
                    <boxGeometry args={[0.10, 0.44, 0.10]} />
                    <meshStandardMaterial map={tex.dressedMap} roughness={0.84} />
                  </mesh>
                );
              })}
            </group>
            <BrokenOssuaryCrownTop
              baseY={spec.crownBaseY}
              topY={spec.crownTotalTopY}
              shaftRadius={spec.towerShaftRadius}
              geoms={geoms}
              tex={tex}
              sovereign={spec.level === 5}
              withBanner={spec.bannerCount >= 2}
            />
          </>
        ) : spec.level === 1 ? (
          <group position={[0, spec.towerShaftTopY, 0]}>
            <mesh position={[0, 0.12, 0]} castShadow>
              <boxGeometry args={[spec.towerBaseSize * 0.82, 0.22, spec.towerBaseSize * 0.82]} />
              <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.03} roughness={0.72} />
            </mesh>
          </group>
        ) : (
          <group position={[0, spec.towerShaftTopY, 0]}>
            <mesh position={[0, (spec.crownTotalTopY - spec.towerShaftTopY) * 0.44, 0]} rotation-y={Math.PI / 8} castShadow>
              <coneGeometry
                args={[spec.towerShaftRadius * 1.18, (spec.crownTotalTopY - spec.towerShaftTopY) * 0.88, 8]}
              />
              <meshStandardMaterial map={tex.slateMap} bumpMap={tex.slateBump} bumpScale={0.032} roughness={0.68} />
            </mesh>
            {spec.level === 3 ? (
              <>
                <mesh position={[0, (spec.crownTotalTopY - spec.towerShaftTopY) * 0.84, 0]} castShadow>
                  <cylinderGeometry args={[0.022, 0.036, 0.56, 6]} />
                  <meshStandardMaterial map={tex.ironMap} roughness={0.38} metalness={0.80} />
                </mesh>
                <CitadelBanner position={[0, spec.crownTotalTopY - spec.towerShaftTopY - 0.44, 0]} scale={0.78} phase={0.2} tex={tex} />
              </>
            ) : null}
          </group>
        )}
      </group>

      {/* Ажурные аркбутаны в просвете между Нефом и Башней-Реликварием (L3–L5) */}
      {spec.flyingButtressCount >= 1 ? (
        <mesh
          geometry={geoms.flyingButtress}
          position={[naveAnchor.x, naveAnchor.y, naveAnchor.z]}
          rotation-y={buttressYaw}
          scale={[buttressSpan, Math.max(0.55, towerAnchor.y - naveAnchor.y + 0.18), 0.14]}
          castShadow
        >
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.84} />
        </mesh>
      ) : null}
      {spec.flyingButtressCount >= 2 ? (
        <mesh
          geometry={geoms.flyingButtress}
          position={[naveAnchor.x + 0.14, naveAnchor.y - 0.34, naveAnchor.z + 0.22]}
          rotation-y={buttressYaw - 0.14}
          scale={[buttressSpan * 0.96, Math.max(0.52, towerAnchor.y - naveAnchor.y + 0.05), 0.13]}
          castShadow
        >
          <meshStandardMaterial map={tex.dressedMap} bumpMap={tex.dressedBump} bumpScale={0.022} roughness={0.84} />
        </mesh>
      ) : null}

      {/* Очаг-труба с тихим вьющимся дымком */}
      <ChimneySmoke origin={spec.smokeOrigin} tex={tex} />
    </group>
  );
}

export function CitadelBuilding({ level = 1, grid }: { level?: number; grid: CourtGridLite }) {
  const spec = getCitadelVisualSpec(level);
  const geoms = useCitadelGeometrySet();
  const tex = useCitadelTextureSet();
  const at = grid.buildings.find((b) => b.type === "townhall") ?? { x: 7, z: 7 };
  const { wx, wz } = footprintCenterToWorld("townhall", at.x, at.z, grid.size);

  return (
    <group position={[wx, 0.08, wz]} rotation-y={Math.PI / 2}>
      <CitadelCathedralArchitecture spec={spec} geoms={geoms} tex={tex} />
    </group>
  );
}
