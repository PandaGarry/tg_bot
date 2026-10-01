/** Земля двора: утоптанный грунт с рельефом, снежная кромка, сугробы и подход к воротам. */

import { useMemo } from "react";
import * as THREE from "three";
import { CELL, GATE_HALF, PLOT, SURFACE, WINTER, rng, tiled, useSeasonTextures, type SeasonTextures } from "../kit.js";
import { snowBand, snowBlob } from "../snow.js";
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

/** Подъезд от ворот наружу: утоптанный гравий того же тона, что и тропинка во дворе, снег по краям. */
function Approach({ tex }: { tex: Tex }) {
  const rims = useMemo(
    () => [-1, 1].flatMap((s) => [0.9, 3.0, 5.1, 7.0].map((dx, i) => ({ s, x: PLOT + dx + (i % 2) * 0.3, geom: snowBlob(1.25 + (i % 3) * 0.2, 0.15 + (i % 2) * 0.05, 200 + i + s * 9, 0.34) }))),
    [],
  );
  return (
    <group>
      <mesh position={[PLOT + 3.6, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.2, 0.12, 3.1]} />
        {tex ? (
          <meshStandardMaterial key="tex" color="#e8d6bc" map={tiled(tex.mud, 1.1, 0.5)} emissiveMap={tiled(tex.mud, 1.1, 0.5)} emissive="#b5a688" emissiveIntensity={0.85} bumpMap={tiled(tex.mud, 1.1, 0.5)} bumpScale={0.07} roughness={1} />
        ) : (
          <meshStandardMaterial key="plain" color="#a98a5e" roughness={1} />
        )}
      </mesh>
      {rims.map((r, i) => (
        <mesh key={i} geometry={r.geom} position={[r.x, 0.0, r.s * 1.95]} rotation-y={r.s * 0.05} castShadow receiveShadow>
          {snowMaterial(tex, 0.34, "#f4f1e8", 0.03)}
        </mesh>
      ))}
    </group>
  );
}

export function Ground({ size, blocked }: GroundProps) {
  const tex = useSeasonTextures(WINTER);
  const half = (size - 1) / 2;
  const cellOf = (x: number, z: number) => `${Math.round(x / CELL + half)}:${Math.round(z / CELL + half)}`;

  /** Занята ли точка двора (постройка, дорога) — клетка или соседняя с ней. */
  const taken = (x: number, z: number, pad = 0) => {
    for (const [dx, dz] of pad > 0 ? [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]] : [[0, 0]]) {
      if (blocked.has(cellOf(x + dx!, z + dz!))) return true;
    }
    return false;
  };

  // Снег внутри частокола: вал вдоль стены, крупные сугробы в углах и редкие низкие языки у края.
  // Середина двора остаётся чистой землёй под застройку.
  const snow = useMemo(() => {
    const r = rng(7);
    const band = snowBand({ half: PLOT - 0.1, gateHalf: GATE_HALF + 0.35, blocked: (x, z) => taken(x, z), seed: 5 });
    const blobs: { geom: THREE.BufferGeometry; x: number; z: number; rot: number; tone: string }[] = [];
    const tones = ["#f7f4ec", "#f1ede2", "#f4efe4"];
    const push = (x: number, z: number, radius: number, height: number, aspect: number) => {
      blobs.push({
        geom: snowBlob(radius, height, 100 + blobs.length * 7, aspect),
        x,
        z,
        rot: r() * Math.PI,
        tone: tones[blobs.length % tones.length]!,
      });
    };
    // углы: наметённые сугробы, в дальнем (за воротами) тоже
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = sx * (PLOT - 1.0 - r() * 0.3);
      const z = sz * (PLOT - 1.0 - r() * 0.3);
      if (!taken(x, z, 0.9)) push(x, z, 1.15 + r() * 0.35, 0.34 + r() * 0.14, 0.75 + r() * 0.2);
    }
    // языки снега между стеной и серединой: рваные, невысокие
    let guard = 0;
    let placed = 0;
    while (placed < 8 && guard++ < 200) {
      const along = (r() * 2 - 1) * (PLOT - 2.2);
      const off = PLOT - 2.2 - r() * 2.2;
      const side = Math.floor(r() * 4);
      const x = side < 2 ? along : side === 2 ? -off : off;
      const z = side === 0 ? -off : side === 1 ? off : along;
      const radius = 0.55 + r() * 0.65;
      if (taken(x, z, radius * 1.15)) continue;
      if (x > 0 && Math.abs(z) < 2.4) continue; // полоса от ворот остаётся чистой
      push(x, z, radius, 0.08 + r() * 0.08, 0.55 + r() * 0.3);
      placed++;
    }
    return { band, blobs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, size]);

  const debris = useMemo(() => {
    const r = rng(77);
    const out: { x: number; z: number; kind: number; s: number; rot: number }[] = [];
    let guard = 0;
    while (out.length < 30 && guard++ < 300) {
      const x = (r() * 2 - 1) * (PLOT - 1.9);
      const z = (r() * 2 - 1) * (PLOT - 1.9);
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
        {snowMaterial(tex, 17, "#f4f0e6", 0.015)}
      </mesh>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[PLOT * 2 + 0.4, 0.16, PLOT * 2 + 0.4]} />
        {mudMaterial(tex, 3.4, 3.4, "#d9c7b4")}
      </mesh>
      <GroundRelief tex={tex} />
      <Approach tex={tex} />
      <mesh geometry={snow.band} castShadow receiveShadow position-y={0.1}>
        {snowMaterial(tex, 0.34, "#f6f2e8", 0.03)}
      </mesh>
      {snow.blobs.map((b, i) => (
        <mesh key={i} geometry={b.geom} position={[b.x, 0.1, b.z]} rotation-y={b.rot} castShadow receiveShadow>
          {snowMaterial(tex, 0.34, b.tone, 0.03)}
        </mesh>
      ))}
      {debris.map((d, i) =>
        d.kind === 0 ? (
          <mesh key={`st${i}`} position={[d.x, 0.13, d.z]} rotation-y={d.rot} castShadow>
            <dodecahedronGeometry args={[d.s, 0]} />
            <meshStandardMaterial color={i % 3 ? "#8f8878" : "#a39a88"} roughness={1} flatShading />
          </mesh>
        ) : null,
      )}
    </group>
  );
}
