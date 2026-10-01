/** Ели вокруг двора: инстансы со стволом, хвоёй и снежной верхушкой на текстурах сезона. */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C, WINTER, rng, tiled, useSeasonTextures } from "../kit.js";
import { snowBlob, snowConeCap } from "../snow.js";

export function Trees() {
  const trees = useMemo(() => {
    const r = rng(23);
    const out: { x: number; z: number; s: number; w: number; tone: number; rot: number }[] = [];
    // Лес густеет к двору и редеет вдали. Полоса дороги от ворот (вдоль +X) остаётся чистой,
    // у частокола деревья не стоят: крона ели шире 1.5.
    let guard = 0;
    while (out.length < 170 && guard++ < 6000) {
      const x = (r() * 2 - 1) * 36;
      const z = (r() * 2 - 1) * 36;
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge < 10.6) continue;
      if (x > 6 && Math.abs(z) < 3.9) continue;
      if (r() > 1.15 - (edge - 10) / 30) continue;
      const s = 0.72 + r() * 0.8;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.15 * (o.s + s))) continue;
      out.push({ x, z, s, w: 0.9 + r() * 0.22, tone: 0.84 + r() * 0.26, rot: r() * Math.PI });
    }
    return out;
  }, []);
  const tex = useSeasonTextures(WINTER);
  // снег: шапки на ярусах (покрытие растёт к вершине) и сугробик у комля
  const caps = useMemo(
    () => ({
      c1: snowConeCap(1.0, 1.3, 0.6, 3),
      c2: snowConeCap(0.78, 1.05, 0.66, 4),
      c3: snowConeCap(0.55, 0.85, 0.82, 5),
      foot: snowBlob(0.62, 0.13, 9, 0.9),
    }),
    [],
  );
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
  const s1 = useRef<THREE.InstancedMesh>(null!);
  const s2 = useRef<THREE.InstancedMesh>(null!);
  const s3 = useRef<THREE.InstancedMesh>(null!);
  const foot = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const tint = new THREE.Color();
    // ширина ярусов меняется от дерева к дереву: ели не клоны
    const put = (ref: THREE.InstancedMesh, dy: number, t: (typeof trees)[number], i: number) => {
      d.position.set(t.x, dy * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.set(t.s * t.w, t.s, t.s * t.w);
      d.updateMatrix();
      ref.setMatrixAt(i, d.matrix);
    };
    trees.forEach((t, i) => {
      put(trunk.current, 0.3, t, i);
      put(c1.current, 1.1, t, i);
      put(c2.current, 1.85, t, i);
      put(c3.current, 2.5, t, i);
      put(s1.current, 1.1, t, i);
      put(s2.current, 1.85, t, i);
      put(s3.current, 2.5, t, i);
      d.position.set(t.x, 0, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.setScalar(t.s * 1.1);
      d.updateMatrix();
      foot.current.setMatrixAt(i, d.matrix);
      c1.current.setColorAt(i, tint.set("#f2f6ee").multiplyScalar(t.tone));
      c2.current.setColorAt(i, tint.set("#f6faf2").multiplyScalar(t.tone));
    });
    [trunk, c1, c2, c3, s1, s2, s3, foot].forEach((ref) => { ref.current.instanceMatrix.needsUpdate = true; });
    for (const ref of [c1, c2]) if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
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
        {needles("#ffffff", C.fir1, 3, 2)}
      </instancedMesh>
      <instancedMesh ref={c2} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.78, 1.05, 7]} />
        {needles("#ffffff", C.fir2, 2.5, 1.7)}
      </instancedMesh>
      <instancedMesh ref={c3} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[0.55, 0.85, 7]} />
        {needles("#f4f8f0", C.fir2, 1.8, 1.4)}
      </instancedMesh>
      {/* снег: плотная шапка на каждом ярусе с рваной нижней кромкой */}
      {([[s1, caps.c1], [s2, caps.c2], [s3, caps.c3]] as const).map(([ref, geom], i) => (
        <instancedMesh key={i} ref={ref} args={[geom, undefined, trees.length]} castShadow receiveShadow>
          <meshStandardMaterial color="#f6f7f5" roughness={0.92} />
        </instancedMesh>
      ))}
      <instancedMesh ref={foot} args={[caps.foot, undefined, trees.length]} receiveShadow>
        {tex ? (
          <meshStandardMaterial key="tex" color="#f4f1e8" map={tiled(tex.snow, 0.34)} roughness={0.96} />
        ) : (
          <meshStandardMaterial key="plain" color="#f1ede3" roughness={0.97} />
        )}
      </instancedMesh>
    </group>
  );
}

