/**
 * Тропинка игрока: утоптанный гравий одной лентой, камни по краю и снег на камнях.
 *
 * Клетки склеены в один меш с мировыми UV: текстура идёт без швов между плитами, стороны
 * показываются только там, где нет соседней клетки. Мелкие камни и краевой бордюр — инстансы.
 * Слои разнесены по высоте (≥ 0.02), чтобы поверхности не мерцали на телефоне.
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL, WINTER, cellToWorld, rng, tiled, useSeasonTextures } from "../kit.js";
import { snowMound } from "../snow.js";
import type { RoadProps } from "../types.js";

const TOP = 0.15;
const BOTTOM = 0.05;

const PEBBLES = ["#b3a17f", "#9c8767", "#a89a82", "#8a7a5e", "#c2b193", "#7f7466"];
const EDGE = ["#8f8878", "#a39a88", "#7d776b", "#9a9080"];

/** Одна лента: верх каждой клетки и боковые грани там, где нет соседа. */
function ribbon(cells: { x: number; z: number; cx: number; cz: number }[]): THREE.BufferGeometry {
  const keys = new Set(cells.map((c) => `${c.x}:${c.z}`));
  const h = CELL / 2 + 0.012; // небольшой нахлёст убирает щели между клетками
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], uvs: number[][]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = [a, b, c, d][i]!;
      pos.push(v[0]!, v[1]!, v[2]!);
      uv.push(uvs[i]![0]!, uvs[i]![1]!);
    }
  };
  for (const c of cells) {
    const x0 = c.cx - h;
    const x1 = c.cx + h;
    const z0 = c.cz - h;
    const z1 = c.cz + h;
    quad([x0, TOP, z1], [x1, TOP, z1], [x1, TOP, z0], [x0, TOP, z0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
    const side = (nx: number, nz: number, a: number[], b: number[]) => {
      if (keys.has(`${c.x + nx}:${c.z + nz}`)) return;
      quad([a[0]!, BOTTOM, a[1]!], [b[0]!, BOTTOM, b[1]!], [b[0]!, TOP, b[1]!], [a[0]!, TOP, a[1]!], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
    };
    side(0, 1, [x1, z1], [x0, z1]);
    side(0, -1, [x0, z0], [x1, z0]);
    side(1, 0, [x1, z0], [x1, z1]);
    side(-1, 0, [x0, z1], [x0, z0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function Road({ roads, size }: RoadProps) {
  const tex = useSeasonTextures(WINTER);
  const data = useMemo(() => {
    const cells = roads.map((r) => ({ x: r.x, z: r.z, cx: cellToWorld(r.x, size), cz: cellToWorld(r.z, size) }));
    const keys = new Set(cells.map((c) => `${c.x}:${c.z}`));
    const pebbles: { x: number; z: number; s: number; rot: number; c: string }[] = [];
    const edge: { x: number; z: number; s: number; rot: number; c: string; snow: boolean }[] = [];
    for (const c of cells) {
      const r = rng(1000 + c.x * 31 + c.z * 7);
      for (let i = 0; i < 12; i++) {
        pebbles.push({
          x: c.cx + (r() - 0.5) * (CELL - 0.12),
          z: c.cz + (r() - 0.5) * (CELL - 0.12),
          s: 0.03 + r() * 0.04,
          rot: r() * Math.PI,
          c: PEBBLES[Math.floor(r() * PEBBLES.length)]!,
        });
      }
      // бордюр из камней вдоль открытых сторон
      const sides: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [nx, nz] of sides) {
        if (keys.has(`${c.x + nx}:${c.z + nz}`)) continue;
        for (let k = 0; k < 3; k++) {
          const along = (k - 1) * 0.36 + (r() - 0.5) * 0.12;
          edge.push({
            x: c.cx + nx * (CELL / 2 - 0.02) + (nz !== 0 ? along : (r() - 0.5) * 0.05),
            z: c.cz + nz * (CELL / 2 - 0.02) + (nx !== 0 ? along : (r() - 0.5) * 0.05),
            s: 0.1 + r() * 0.06,
            rot: r() * Math.PI,
            c: EDGE[Math.floor(r() * EDGE.length)]!,
            snow: r() > 0.4,
          });
        }
      }
    }
    return { geom: cells.length ? ribbon(cells) : null, pebbles, edge };
  }, [roads, size]);

  const mound = useMemo(() => snowMound(0.1, 0.075, 77, 8), []);
  const peb = useRef<THREE.InstancedMesh>(null!);
  const stone = useRef<THREE.InstancedMesh>(null!);
  const snow = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    if (peb.current) {
      data.pebbles.forEach((p, i) => {
        d.position.set(p.x, TOP + 0.004, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.set(p.s, p.s * 0.5, p.s);
        d.updateMatrix();
        peb.current.setMatrixAt(i, d.matrix);
        peb.current.setColorAt(i, col.set(p.c));
      });
      peb.current.instanceMatrix.needsUpdate = true;
      if (peb.current.instanceColor) peb.current.instanceColor.needsUpdate = true;
    }
    if (stone.current) {
      data.edge.forEach((p, i) => {
        d.position.set(p.x, TOP + 0.02, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.set(p.s, p.s * 0.7, p.s * 0.85);
        d.updateMatrix();
        stone.current.setMatrixAt(i, d.matrix);
        stone.current.setColorAt(i, col.set(p.c));
      });
      stone.current.instanceMatrix.needsUpdate = true;
      if (stone.current.instanceColor) stone.current.instanceColor.needsUpdate = true;
    }
    if (snow.current) {
      const capped = data.edge.filter((p) => p.snow);
      capped.forEach((p, i) => {
        d.position.set(p.x, TOP + 0.02 + p.s * 0.7 * 0.62, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.set(p.s * 8, p.s * 6, p.s * 7);
        d.updateMatrix();
        snow.current.setMatrixAt(i, d.matrix);
      });
      snow.current.instanceMatrix.needsUpdate = true;
    }
  }, [data]);

  const snowCount = data.edge.filter((p) => p.snow).length;
  if (!data.geom) return null;
  return (
    <group>
      <mesh geometry={data.geom} receiveShadow castShadow>
        {tex ? (
          /* земля двора тёмная, поэтому тропе нужен светлый утоптанный гравий: текстура + собственная подсветка */
          <meshStandardMaterial key="tex" color="#f2dfc2" map={tiled(tex.mud, 0.5)} emissiveMap={tiled(tex.mud, 0.5)} emissive="#b5a688" emissiveIntensity={1.05} bumpMap={tiled(tex.mud, 0.5)} bumpScale={0.07} roughness={1} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial key="plain" color="#a98a5e" roughness={1} side={THREE.DoubleSide} />
        )}
      </mesh>
      <instancedMesh key={`p${data.pebbles.length}`} ref={peb} args={[undefined, undefined, data.pebbles.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh key={`e${data.edge.length}`} ref={stone} args={[undefined, undefined, data.edge.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      {snowCount > 0 ? (
        <instancedMesh key={`s${snowCount}`} ref={snow} args={[mound, undefined, snowCount]} castShadow receiveShadow>
          <meshStandardMaterial color="#f6f5f0" roughness={0.92} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
