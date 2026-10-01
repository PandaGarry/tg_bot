/** Ели вокруг двора: инстансы со стволом, хвоёй и снежной верхушкой на текстурах сезона. */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { C, WINTER, rng, tiled, useSeasonTextures } from "../kit.js";
import { snowBlob, snowConeCap } from "../snow.js";
import { BareTrees, type BareItem } from "./BareTrees.js";

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
  // голые берёзы (небольшими группами) и кусты: ели остаются на своих местах, новые деревья ищут свободные просветы
  const bare = useMemo(() => {
    const r = rng(91);
    const out: BareItem[] = [];
    const onRoad = (x: number, z: number) => x > 6 && Math.abs(z) < 3.9;
    const freeOf = (x: number, z: number, own: number, k: number) =>
      !trees.some((o) => Math.hypot(o.x - x, o.z - z) < k * o.s + own) && !out.some((o) => Math.hypot(o.x - x, o.z - z) < own + 0.6 * o.s);
    // берёзы: 14 групп по 2–3 дерева в просветах между елями
    let guard = 0;
    let groupsMade = 0;
    while (groupsMade < 14 && guard++ < 4000) {
      const cx = (r() * 2 - 1) * 26;
      const cz = (r() * 2 - 1) * 26;
      const edge = Math.max(Math.abs(cx), Math.abs(cz));
      if (edge < 11.2 || onRoad(cx, cz) || r() > 1.1 - (edge - 11) / 28) continue;
      if (!freeOf(cx, cz, 0.7, 0.8)) continue;
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2;
        const d = k === 0 ? 0 : 0.9 + r() * 0.9;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (onRoad(x, z) || Math.max(Math.abs(x), Math.abs(z)) < 10.8 || !freeOf(x, z, 0.5, 0.7)) continue;
        out.push({ kind: "birch", v: Math.floor(r() * 3), x, z, s: 0.85 + r() * 0.45, rot: r() * Math.PI * 2 });
      }
      groupsMade++;
    }
    // кусты: поодиночке и парами у опушки, ближе к двору их больше
    guard = 0;
    let bushes = 0;
    while (bushes < 60 && guard++ < 6000) {
      const x = (r() * 2 - 1) * 28;
      const z = (r() * 2 - 1) * 28;
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge < 9.9 || onRoad(x, z) || r() > 1.05 - (edge - 10) / 24) continue;
      if (!freeOf(x, z, 0.45, 0.78)) continue;
      out.push({ kind: "bush", v: Math.floor(r() * 3), x, z, s: 0.8 + r() * 0.6, rot: r() * Math.PI * 2 });
      bushes++;
    }
    return out;
  }, [trees]);
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
      <BareTrees items={bare} />
    </group>
  );
}

