/** Частокол: плотный ряд вкопанных брёвен со снежными шапками и угловыми стойками. */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C, GATE_HALF, PLOT, SURFACE, rng } from "../kit.js";

const LOG_H = 1.28;

export function Fence() {
  const logs = useMemo(() => {
    const r = rng(11);
    const pts: { x: number; z: number; h: number; tilt: number }[] = [];
    const j = () => r() * 2 - 1;
    const one = (x: number, z: number) => pts.push({ x, z, h: LOG_H + j() * 0.08, tilt: j() * 0.02 });
    for (let t = -PLOT; t <= PLOT + 0.001; t += 0.28) {
      one(t, PLOT);
      one(t, -PLOT);
      one(-PLOT, t);
      if (Math.abs(t) >= GATE_HALF) one(PLOT, t);
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
      d.position.y = 0.08 + p.h + 0.06;
      d.updateMatrix();
      caps.current.setMatrixAt(i, d.matrix);
      // лёгкая тональная рябь: частокол читается деревом, а не пластиком
      body.current.setColorAt(i, tone.set("#795839").offsetHSL(0, i % 2 ? 0.01 : -0.01, ((i * 7) % 5) * 0.013 - 0.026));
    });
    body.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true;
  }, [logs]);

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, logs.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.16, LOG_H, 6]} />
        <meshStandardMaterial color="#795839" map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, logs.length]} castShadow>
        <coneGeometry args={[0.16, 0.16, 6]} />
        <meshStandardMaterial color="#f0ede5" map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.95} flatShading />
      </instancedMesh>
      {/* угловые стойки выше основной линии */}
      {[
        [-PLOT, -PLOT],
        [PLOT, -PLOT],
        [-PLOT, PLOT],
        [PLOT, PLOT],
      ].map(([cx, cz], i) => (
        <group key={i} position={[cx!, 0, cz!]}>
          <mesh position-y={0.95} castShadow receiveShadow>
            <cylinderGeometry args={[0.2, 0.24, 1.75, 7]} />
            <meshStandardMaterial color={C.gate} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.02} roughness={0.95} flatShading />
          </mesh>
          <mesh position-y={1.95} castShadow>
            <coneGeometry args={[0.26, 0.28, 7]} />
            <meshStandardMaterial color="#fbf8f0" map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.94} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
