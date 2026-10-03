/**
 * Голые зимние берёзы и кусты вокруг двора: разбавляют ельник, чтобы лес не был однообразным.
 *
 * Деревья собираются из тонких конических отрезков (ствол, ветви, прутья) в одну геометрию с цветом в
 * вершинах: несколько вариантов каждого вида, затем инстансы со случайным поворотом и масштабом.
 * Снег — тонкие белые «валики» на верхней стороне ветвей и сугробик у комля.
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WINTER, rng, tiled, useSeasonTextures } from "../kit.js";
import { snowBlob } from "../snow.js";

export interface BareItem {
  kind: "birch" | "bush";
  /** Номер варианта геометрии внутри вида. */
  v: number;
  x: number;
  z: number;
  s: number;
  rot: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Отрезок-конус от a к b с цветом в вершинах. */
function seg(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: THREE.Color, sides = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.deleteAttribute("uv");
  const n = g.attributes.position!.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const dir = (az: number, fromUp: number) => new THREE.Vector3(Math.sin(fromUp) * Math.cos(az), Math.cos(fromUp), Math.sin(fromUp) * Math.sin(az));

const WHITE_BARK = ["#ebe9df", "#e4e1d6", "#f0eee6"].map((c) => new THREE.Color(c));
const DARK_BARK = new THREE.Color("#34302c");
const BRANCH = ["#4d413a", "#5a4a40", "#42372f"].map((c) => new THREE.Color(c));
const SNOW = new THREE.Color("#f7f8f6");
const BUSH = ["#6d3b2d", "#4f3d35", "#85624a", "#5c3a30"].map((c) => new THREE.Color(c));

function pick<T>(r: () => number, list: T[]): T {
  return list[Math.floor(r() * list.length)]!;
}

/** Ветка из двух колен с прутьями; `snowy` кладёт на неё снежный валик. */
function branch(parts: THREE.BufferGeometry[], r: () => number, from: THREE.Vector3, az: number, fromUp: number, len: number, r0: number, snowy: boolean, twigs: number) {
  const mid = from.clone().add(dir(az, fromUp).multiplyScalar(len * 0.55));
  const end = mid.clone().add(dir(az + (r() - 0.5) * 0.5, Math.min(fromUp + 0.25 + r() * 0.3, 1.5)).multiplyScalar(len * 0.5));
  const col = pick(r, BRANCH);
  parts.push(seg(from, mid, r0, r0 * 0.6, col), seg(mid, end, r0 * 0.6, r0 * 0.28, col, 4));
  if (snowy) {
    const lift = new THREE.Vector3(0, r0 * 0.8, 0);
    parts.push(seg(from.clone().add(lift), mid.clone().add(lift), r0 * 1.25, r0 * 0.85, SNOW, 5));
  }
  for (let t = 0; t < twigs; t++) {
    const p = mid.clone().lerp(end, r() * 0.7);
    const tl = len * (0.3 + r() * 0.25);
    const q = p.clone().add(dir(az + (r() - 0.5) * 2.2, 0.4 + r() * 0.7).multiplyScalar(tl));
    parts.push(seg(p, q, r0 * 0.3, r0 * 0.12, col, 4));
  }
}

/** Берёза: белый ствол с тёмными метинами, 8–11 ветвей, на вершине несколько побегов. */
function birchGeometry(seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const H = 2.8 + r() * 0.7;
  const N = 18;
  const pts: THREE.Vector3[] = [new THREE.Vector3()];
  let ox = 0;
  let oz = 0;
  for (let i = 1; i <= N; i++) {
    ox += (r() - 0.5) * 0.06;
    oz += (r() - 0.5) * 0.06;
    pts.push(new THREE.Vector3(ox, (H * i) / N, oz));
  }
  const rad = (i: number) => 0.095 * (1 - i / N) + 0.03 * (i / N);
  for (let i = 0; i < N; i++) {
    const dark = i > 2 && r() < 0.2;
    parts.push(seg(pts[i]!, pts[i + 1]!, rad(i), rad(i + 1), dark ? DARK_BARK : pick(r, WHITE_BARK), 6));
  }
  const count = 9 + Math.floor(r() * 3);
  for (let b = 0; b < count; b++) {
    const f = 0.32 + (b / count) * 0.66;
    const from = pts[Math.min(N, Math.round(f * N))]!;
    const len = (1.15 - f * 0.65) * (0.85 + r() * 0.5);
    branch(parts, r, from, r() * Math.PI * 2, 0.5 + r() * 0.55 - f * 0.25, len, 0.03 * (1.1 - f * 0.5), r() < 0.6, 2);
  }
  const top = pts[N]!;
  for (let k = 0; k < 3; k++) branch(parts, r, top, (k / 3) * Math.PI * 2 + r(), 0.25 + r() * 0.2, 0.7, 0.018, r() < 0.5, 2);
  return mergeGeometries(parts, false)!;
}

/** Куст: пучок красновато-бурых прутьев от одного корня, часть присыпана снегом. */
function bushGeometry(seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const stems = 12 + Math.floor(r() * 5);
  for (let i = 0; i < stems; i++) {
    const from = new THREE.Vector3((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2);
    const col = pick(r, BUSH);
    const az = r() * Math.PI * 2;
    const fromUp = 0.2 + r() * 0.65;
    const len = 0.75 + r() * 0.55;
    const mid = from.clone().add(dir(az, fromUp).multiplyScalar(len * 0.55));
    const end = mid.clone().add(dir(az + (r() - 0.5) * 0.6, fromUp + 0.2).multiplyScalar(len * 0.5));
    parts.push(seg(from, mid, 0.03, 0.018, col, 4), seg(mid, end, 0.018, 0.008, col, 4));
    if (r() < 0.4) parts.push(seg(from.clone().add(new THREE.Vector3(0, 0.02, 0)), mid.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.03, 0.02, SNOW, 4));
    for (let t = 0; t < 2; t++) {
      const p = mid.clone().lerp(end, r() * 0.6);
      parts.push(seg(p, p.clone().add(dir(az + (r() - 0.5) * 2.4, 0.5 + r() * 0.6).multiplyScalar(0.25 + r() * 0.2)), 0.011, 0.005, col, 4));
    }
  }
  return mergeGeometries(parts, false)!;
}

export function BareTrees({ items }: { items: readonly BareItem[] }) {
  const tex = useSeasonTextures(WINTER);
  const geoms = useMemo(
    () => ({
      birch: [11, 12, 13].map(birchGeometry),
      bush: [21, 22, 23].map(bushGeometry),
      foot: snowBlob(0.5, 0.1, 31, 0.9),
    }),
    [],
  );
  // группы: вид × вариант
  const groups = useMemo(() => {
    const out: { kind: BareItem["kind"]; v: number; items: BareItem[] }[] = [];
    for (const kind of ["birch", "bush"] as const)
      for (let v = 0; v < 3; v++) out.push({ kind, v, items: items.filter((i) => i.kind === kind && i.v === v) });
    return out.filter((g) => g.items.length > 0);
  }, [items]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const foot = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    groups.forEach((g, gi) => {
      const mesh = refs.current[gi];
      if (!mesh) return;
      g.items.forEach((t, i) => {
        d.position.set(t.x, 0, t.z);
        d.rotation.set(0, t.rot, 0);
        d.scale.setScalar(t.s);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
    items.forEach((t, i) => {
      d.position.set(t.x, 0, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.setScalar(t.kind === "birch" ? t.s * 0.9 : t.s * 0.75);
      d.updateMatrix();
      foot.current.setMatrixAt(i, d.matrix);
    });
    foot.current.instanceMatrix.needsUpdate = true;
  }, [groups, items]);
  return (
    <group>
      {groups.map((g, gi) => (
        <instancedMesh key={`${g.kind}${g.v}:${g.items.length}`} ref={(m) => { refs.current[gi] = m; }} args={[g.kind === "birch" ? geoms.birch[g.v] : geoms.bush[g.v], undefined, g.items.length]} castShadow>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </instancedMesh>
      ))}
      <instancedMesh key={`foot:${items.length}`} ref={foot} args={[geoms.foot, undefined, items.length]} receiveShadow>
        {tex ? (
          <meshStandardMaterial key="tex" color="#f4f1e8" map={tiled(tex.snow, 0.34)} roughness={0.96} />
        ) : (
          <meshStandardMaterial key="plain" color="#f1ede3" roughness={0.97} />
        )}
      </instancedMesh>
    </group>
  );
}
