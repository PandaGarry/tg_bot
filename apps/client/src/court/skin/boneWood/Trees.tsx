/** Ели вокруг двора: инстансы со стволом, хвоёй и снежной верхушкой на текстурах сезона. */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C, WINTER, rng, tiled, useSeasonTextures } from "../kit.js";

export function Trees() {
  const trees = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; s: number; rot: number }[] = [];
    for (let i = 0; i < 64; i++) {
      const side = Math.floor(r() * 4);
      const t = (r() * 2 - 1) * 26;
      const d = 10 + r() * 16;
      const x = side === 0 ? t : side === 1 ? d : side === 2 ? t : -d;
      const z = side === 0 ? d : side === 1 ? t : side === 2 ? -d : t;
      if (z > 7 && Math.abs(x) < 3.5) continue;
      out.push({ x, z, s: 0.8 + r() * 0.6, rot: r() * Math.PI });
    }
    return out;
  }, []);
  const tex = useSeasonTextures(WINTER);
  /** Хвоя: текстура с мягкой подсветкой; пока не загрузилась — плоский цвет. */
  const needles = (tint: string, fallback: string, rx: number, ry: number) =>
    tex ? (
      <meshStandardMaterial key="tex" color={tint} map={tiled(tex.needles, rx, ry)} bumpMap={tiled(tex.needles, rx, ry)} bumpScale={0.05} emissive="#1c3a26" emissiveIntensity={0.3} roughness={0.95} />
    ) : (
      <meshStandardMaterial key="plain" color={fallback} roughness={1} flatShading />
    );
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const c1 = useRef<THREE.InstancedMesh>(null!);
  const c2 = useRef<THREE.InstancedMesh>(null!);
  const c3 = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const put = (ref: THREE.InstancedMesh, dy: number, t: (typeof trees)[number], i: number) => {
      d.position.set(t.x, dy * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.setScalar(t.s);
      d.updateMatrix();
      ref.setMatrixAt(i, d.matrix);
    };
    trees.forEach((t, i) => {
      put(trunk.current, 0.3, t, i);
      put(c1.current, 1.1, t, i);
      put(c2.current, 1.85, t, i);
      put(c3.current, 2.5, t, i);
    });
    [trunk, c1, c2, c3].forEach((ref) => { ref.current.instanceMatrix.needsUpdate = true; });
  }, [trees]);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 0.6, 6]} />
        {tex ? (
          <meshStandardMaterial key="tex" color="#e6d3c0" map={tiled(tex.bark, 1, 1.6)} bumpMap={tiled(tex.bark, 1, 1.6)} bumpScale={0.03} roughness={1} />
        ) : (
          <meshStandardMaterial key="plain" color={C.trunk} roughness={1} flatShading />
        )}
      </instancedMesh>
      <instancedMesh ref={c1} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[1.0, 1.3, 7]} />
        {needles("#f2f6ee", C.fir1, 3, 2)}
      </instancedMesh>
      <instancedMesh ref={c2} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.78, 1.05, 7]} />
        {needles("#f6faf2", C.fir2, 2.5, 1.7)}
      </instancedMesh>
      <instancedMesh ref={c3} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 0.85, 7]} />
        {tex ? (
          <meshStandardMaterial key="tex" color="#f4f2ea" map={tiled(tex.snow, 1.4)} bumpMap={tiled(tex.snow, 1.4)} bumpScale={0.03} roughness={0.95} />
        ) : (
          <meshStandardMaterial key="plain" color={C.firTip} roughness={1} flatShading />
        )}
      </instancedMesh>
    </group>
  );
}

