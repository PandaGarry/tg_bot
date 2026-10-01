/** Частокол: вкопанные брёвна на коре, заострённые, со снежными шапками; угловые стойки выше. */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C, GATE_HALF, PLOT, SURFACE, WINTER, rng, tiled, useSeasonTextures } from "../kit.js";
import { snowMound } from "../snow.js";

const LOG_H = 1.28;
const TIP_H = 0.15;

export function Fence() {
  const tex = useSeasonTextures(WINTER);
  const logs = useMemo(() => {
    const r = rng(11);
    const pts: { x: number; z: number; h: number; tilt: number; yaw: number; tone: number; cap: [number, number, number] }[] = [];
    const j = () => r() * 2 - 1;
    const one = (x: number, z: number) =>
      pts.push({
        x,
        z,
        h: LOG_H + j() * 0.1,
        tilt: j() * 0.025,
        yaw: r() * Math.PI * 2,
        tone: 0.8 + r() * 0.25,
        // шапки разного объёма: у одних бревно почти голое, у других шапка пышная
        cap: [0.78 + r() * 0.34, 0.75 + r() * 0.6, r() * Math.PI * 2],
      });
    for (let t = -PLOT; t <= PLOT + 0.001; t += 0.28) {
      one(t, PLOT);
      one(t, -PLOT);
      one(-PLOT, t);
      if (Math.abs(t) >= GATE_HALF) one(PLOT, t);
    }
    return pts;
  }, []);
  const mound = useMemo(() => snowMound(0.16, 0.3, 31, 10), []);
  const postMound = useMemo(() => snowMound(0.27, 0.34, 37, 12), []);
  const body = useRef<THREE.InstancedMesh>(null!);
  const tips = useRef<THREE.InstancedMesh>(null!);
  const caps = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const tone = new THREE.Color();
    logs.forEach((p, i) => {
      const k = p.h / LOG_H;
      d.rotation.set(p.tilt, p.yaw, p.tilt);
      d.scale.set(1, k, 1);
      d.position.set(p.x, 0.08 + p.h / 2, p.z);
      d.updateMatrix();
      body.current.setMatrixAt(i, d.matrix);
      d.scale.set(1, 1, 1);
      d.position.set(p.x, 0.08 + p.h + TIP_H / 2 - 0.01, p.z);
      d.updateMatrix();
      tips.current.setMatrixAt(i, d.matrix);
      d.rotation.set(0, p.cap[2], 0);
      d.scale.set(p.cap[0], p.cap[1], p.cap[0]);
      d.position.set(p.x, 0.08 + p.h - 0.05, p.z);
      d.updateMatrix();
      caps.current.setMatrixAt(i, d.matrix);
      body.current.setColorAt(i, tone.set("#ead6bf").multiplyScalar(p.tone));
      tips.current.setColorAt(i, tone);
    });
    body.current.instanceMatrix.needsUpdate = true;
    tips.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    for (const m of [body, tips]) if (m.current.instanceColor) m.current.instanceColor.needsUpdate = true;
  }, [logs]);

  const bark = (rx: number, ry: number, color = "#ffffff") =>
    tex ? (
      <meshStandardMaterial key="tex" color={color} map={tiled(tex.bark, rx, ry)} bumpMap={tiled(tex.bark, rx, ry)} bumpScale={0.05} roughness={0.97} />
    ) : (
      <meshStandardMaterial key="plain" color={C.log} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.018} roughness={0.95} flatShading />
    );
  const snowMat = <meshStandardMaterial color="#f6f5f0" roughness={0.92} />;

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, logs.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.16, LOG_H, 7]} />
        {bark(1, 1.4)}
      </instancedMesh>
      <instancedMesh ref={tips} args={[undefined, undefined, logs.length]} castShadow>
        <coneGeometry args={[0.13, TIP_H, 7]} />
        {bark(0.8, 0.3)}
      </instancedMesh>
      <instancedMesh ref={caps} args={[mound, undefined, logs.length]} castShadow receiveShadow>
        {snowMat}
      </instancedMesh>
      {/* угловые стойки выше основной линии */}
      {[
        [-PLOT, -PLOT],
        [PLOT, -PLOT],
        [-PLOT, PLOT],
        [PLOT, PLOT],
      ].map(([cx, cz], i) => (
        <group key={i} position={[cx!, 0, cz!]} rotation-y={i * 1.7}>
          <mesh position-y={0.95} castShadow receiveShadow>
            <cylinderGeometry args={[0.2, 0.24, 1.75, 8]} />
            {bark(1.2, 1.7, "#e2cdb6")}
          </mesh>
          <mesh position-y={1.97} castShadow>
            <coneGeometry args={[0.2, 0.3, 8]} />
            {bark(1, 0.3, "#e2cdb6")}
          </mesh>
          <mesh geometry={postMound} position-y={1.78} castShadow receiveShadow>
            {snowMat}
          </mesh>
        </group>
      ))}
    </group>
  );
}
