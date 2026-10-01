/**
 * Флаг Цитадели — отдельный элемент: шест и ткань, на которую ложится герб игрока.
 * Знает только про `BannerSpec` (см. ../../banner.ts), про здание не знает: поэтому один и тот же флаг
 * можно поставить на любую стадию Цитадели или на другое здание.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NEUTRAL_BANNER, bannerTexture, type BannerSpec } from "../../banner.js";
import { MAT, type V3 } from "./parts.js";

export function Banner({ p, pole, cloth, spec = NEUTRAL_BANNER }: { p: V3; pole: number; cloth: [number, number]; spec?: BannerSpec }) {
  const tex = useMemo(() => bannerTexture(spec), [spec.pattern, spec.field, spec.accent]);
  const geo = useRef<THREE.PlaneGeometry>(null!);
  const base = useMemo(() => new THREE.PlaneGeometry(cloth[0], cloth[1], 12, 4), [cloth[0], cloth[1]]);
  const rest = useMemo(() => Float32Array.from(base.attributes.position!.array as ArrayLike<number>), [base]);
  useFrame(({ clock }) => {
    const pos = base.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3]! + cloth[0] / 2; // 0 у шеста … cloth[0] у края
      const k = x / cloth[0];
      pos.setZ(i, Math.sin(t * 2.4 - x * 5) * 0.06 * k);
    }
    pos.needsUpdate = true;
    base.computeVertexNormals();
  });
  void geo;
  return (
    <group position={p}>
      <mesh position-y={pole / 2} material={MAT.plankDark} castShadow>
        <cylinderGeometry args={[0.028, 0.04, pole, 6]} />
      </mesh>
      <mesh position={[0, pole + 0.02, 0]} material={MAT.bone}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      {/* ткань: левый край у шеста, полотнище летит к +x */}
      <mesh geometry={base} position={[cloth[0] / 2 + 0.03, pole - cloth[1] / 2 - 0.04, 0]} castShadow>
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
    </group>
  );
}
