/** Земля двора: утоптанный грунт с рельефом, снежная кромка, сугробы и подход к воротам. */

import { useMemo } from "react";
import * as THREE from "three";
import { CELL, PLOT, SURFACE, WINTER, rng, tiled, useSeasonTextures, type SeasonTextures } from "../kit.js";
import type { GroundProps } from "../types.js";


type Tex = SeasonTextures | null;

/** Снег: готовая текстура, пока не загрузилась — процедурная. `rep` — повторов на единицу UV. */
function snowMaterial(tex: Tex, rep: number, color: string, bump = 0.02, flat = false) {
  return tex ? (
    <meshStandardMaterial key="tex" color={color} map={tiled(tex.snow, rep)} bumpMap={tiled(tex.snow, rep)} bumpScale={bump} roughness={0.96} flatShading={flat} />
  ) : (
    <meshStandardMaterial key="plain" color={color} map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.014} roughness={0.96} flatShading={flat} />
  );
}

/** Земля двора: готовая текстура грязи или процедурная запасная. */
function mudMaterial(tex: Tex, rx: number, ry: number, color: string, bump = 0.05) {
  return tex ? (
    <meshStandardMaterial key="tex" color={color} map={tiled(tex.mud, rx, ry)} bumpMap={tiled(tex.mud, rx, ry)} bumpScale={bump} roughness={0.97} />
  ) : (
    <meshStandardMaterial key="plain" color="#7e6042" map={SURFACE.soil.color} bumpMap={SURFACE.soil.bump} bumpScale={0.055} roughness={0.97} />
  );
}

/** Лёгкий рельеф: сетка вершин с мягкими буграми, чтобы земля не была плоской коробкой. */
function GroundRelief({ tex }: { tex: Tex }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(PLOT * 2, PLOT * 2, 42, 42);
    const position = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getY(i);
      const broad = Math.sin(x * 0.52 + Math.sin(z * 0.31)) * Math.cos(z * 0.43 - x * 0.17);
      const fine = Math.sin(x * 1.21 + z * 0.63) * Math.cos(z * 0.92 - x * 0.38);
      position.setZ(i, 0.012 + (0.5 + broad * 0.3 + fine * 0.08) * 0.035);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} position-y={0.08} rotation-x={-Math.PI / 2} castShadow receiveShadow>
      {mudMaterial(tex, 3.4, 3.4, "#e9dccd", 0.04)}
    </mesh>
  );
}

/** Грунтовая дорога от ворот наружу: часть основы двора. */
function Approach({ tex }: { tex: Tex }) {
  return (
    <mesh position={[PLOT + 3.6, 0.08, 0]} castShadow receiveShadow>
      <boxGeometry args={[7.2, 0.12, 3.1]} />
      {mudMaterial(tex, 1.6, 0.7, "#d9c7b4")}
    </mesh>
  );
}

export function Ground({ size, blocked }: GroundProps) {
  const tex = useSeasonTextures(WINTER);
  const half = (size - 1) / 2;
  const cellOf = (x: number, z: number) => `${Math.round(x / CELL + half)}:${Math.round(z / CELL + half)}`;

  // Снежные пятна лежат у кромки: середина двора остаётся чистой землёй под застройку.
  const patches = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 26 }, () => {
      const m = 24;
      const base = 0.55 + r() * 0.75;
      const p1 = r() * 6.28;
      const p2 = r() * 6.28;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < m; i++) {
        const a = (i / m) * Math.PI * 2;
        const rad = base * (1 + 0.22 * Math.sin(a * 3 + p1) + 0.1 * Math.sin(a * 5 + p2));
        pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad * 0.8));
      }
      const t = (r() * 2 - 1) * (PLOT - 1);
      const edge = PLOT - 0.35 - r() * 1.05;
      const side = Math.floor(r() * 4);
      return {
        x: side < 2 ? t : side === 2 ? -edge : edge,
        z: side === 0 ? -edge : side === 1 ? edge : t,
        rot: r() * Math.PI,
        // объёмная шапка с закруглённой кромкой: снег лежит слоем, а не плоским пятном
        geom: new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
          depth: 0.03,
          bevelEnabled: true,
          bevelThickness: 0.07,
          bevelSize: 0.16,
          bevelSegments: 7,
          curveSegments: 12,
        }),
      };
    });
  }, []);

  const drifts = useMemo(() => {
    const r = rng(41);
    const out: { x: number; z: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 10 && guard++ < 60) {
      const a = r() * Math.PI * 2;
      const d = PLOT - 0.8 - r() * 1.5;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (blocked.has(cellOf(x, z))) continue;
      out.push({ x, z, s: 0.7 + r() * 1.1, rot: r() * Math.PI });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, size]);

  const debris = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; kind: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 40 && guard++ < 300) {
      const x = (r() * 2 - 1) * (PLOT - 0.5);
      const z = (r() * 2 - 1) * (PLOT - 0.5);
      if (blocked.has(cellOf(x, z))) continue;
      out.push({ x, z, kind: r() > 0.55 ? 1 : 0, s: 0.04 + r() * 0.06, rot: r() * Math.PI });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, size]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[120, 120]} />
        {snowMaterial(tex, 17, "#f4f0e6", 0.03)}
      </mesh>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[PLOT * 2 + 0.4, 0.16, PLOT * 2 + 0.4]} />
        {mudMaterial(tex, 3.4, 3.4, "#d9c7b4")}
      </mesh>
      <GroundRelief tex={tex} />
      <Approach tex={tex} />
      {patches.map((p, i) => (
        <mesh key={i} geometry={p.geom} rotation-x={-Math.PI / 2} rotation-z={p.rot} position={[p.x, 0.125, p.z]} castShadow receiveShadow>
          {snowMaterial(tex, 0.34, i % 2 ? "#f7f4ec" : "#eee6d3", 0.03)}
        </mesh>
      ))}
      {drifts.map((d, i) => (
        <mesh key={`d${i}`} position={[d.x, 0.1, d.z]} rotation-y={d.rot} scale={[d.s, 0.3, d.s * 0.7]} castShadow receiveShadow>
          <sphereGeometry args={[0.8, 10, 8]} />
          {/* у сферы UV сходятся в полюсе и дают кольца: сугробам хватает гладкого цвета */}
          <meshStandardMaterial color="#f1ede3" roughness={0.97} flatShading />
        </mesh>
      ))}
      {debris.map((d, i) =>
        d.kind === 0 ? (
          <mesh key={`st${i}`} position={[d.x, 0.13, d.z]} rotation-y={d.rot} castShadow>
            <dodecahedronGeometry args={[d.s, 0]} />
            <meshStandardMaterial color={i % 3 ? "#8f8878" : "#a39a88"} roughness={1} flatShading />
          </mesh>
        ) : (
          <mesh key={`gr${i}`} position={[d.x, 0.16, d.z]} rotation-y={d.rot}>
            <coneGeometry args={[d.s * 0.6, d.s * 3.2, 5]} />
            <meshStandardMaterial color="#77804a" roughness={1} flatShading />
          </mesh>
        ),
      )}
    </group>
  );
}
