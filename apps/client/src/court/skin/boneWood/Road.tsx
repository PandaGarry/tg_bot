/**
 * Тропинка и подъезд: узкая лента утоптанной земли с мягкой кромкой, без плиточных границ.
 *
 * Клетки, которые кладёт игрок, превращаются в «кисть»: центр каждой клетки — диск, соседние клетки
 * соединены перемычками. По этой кисти считается поле покрытия, из него строится ОДНА сетка с
 * плавной прозрачностью по краю и цветом в вершинах — отсюда органичная кромка и «разноцветие»
 * (песок, коричневая земля, серая крошка). За воротами тот же материал уходит прямой дорогой
 * далеко за край кадра: с колеёй и притоптанным снегом по обочинам.
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { snowBlob } from "../snow.js";
import { CELL, GATE_HALF, PLOT, WINTER, cellToWorld, rng, tiled, useSeasonTextures } from "../kit.js";
import type { RoadProps } from "../types.js";

/** Высота тропы во дворе: выше рельефа земли (до 0.127), чтобы поверхности не делили плоскость. */
const YARD_Y = 0.14;
const SNOW_Y = 0.03;
const STEP = 0.1;
const ROAD_END = 58;
const PATH_R = 0.3; // половина ширины тропы во дворе (≈ 0.55 клетки)
const ROAD_R = GATE_HALF; // половина ширины дороги: как проём ворот, чтобы двор и дорога «сливались»

interface Prim {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  r0: number;
  r1: number;
  /** Доля радиуса, на которой покрытие спадает от 1 до 0 (меньше — чётче кромка). */
  soft?: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Гладкий шум по плоскости (около −1…1). */
const noise = (x: number, z: number, k = 1) =>
  Math.sin(x * 1.7 * k + Math.sin(z * 1.3 * k)) * 0.5 + Math.sin(z * 2.1 * k - x * 0.9 * k) * 0.3 + Math.sin((x + z) * 3.3 * k) * 0.2;

/** Покрытие 0…1 от одной «кисти»: 1 в середине, плавно спадает к краю, кромка неровная. */
function cover(p: Prim, x: number, z: number, widen = 1): number {
  const dx = p.x1 - p.x0;
  const dz = p.z1 - p.z0;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 1e-9 ? THREE.MathUtils.clamp(((x - p.x0) * dx + (z - p.z0) * dz) / len2, 0, 1) : 0;
  const d = Math.hypot(x - (p.x0 + dx * t), z - (p.z0 + dz * t));
  const r = THREE.MathUtils.lerp(p.r0, p.r1, t) * widen * (1 + 0.3 * noise(x, z, 1.5));
  return THREE.MathUtils.clamp((1 - d / r) / (p.soft ?? 0.5), 0, 1);
}

function fieldAt(prims: Prim[], x: number, z: number, widen = 1): number {
  let f = 0;
  for (const p of prims) f = Math.max(f, cover(p, x, z, widen));
  return f;
}

/** Высота полотна: во дворе над землёй, за воротами плавно ложится на снег. */
const baseY = (x: number) => THREE.MathUtils.lerp(YARD_Y, SNOW_Y, smooth(PLOT + 0.35, PLOT + 2.4, x));

const SAND = new THREE.Color(2.2, 1.9, 1.5);
const BROWN = new THREE.Color(1.6, 1.22, 0.9);
const GREY = new THREE.Color(1.7, 1.62, 1.52);

/** «Разноцветие» грунта: пятна песка, коричневой земли и серой крошки. */
function groundTone(x: number, z: number, out: THREE.Color): THREE.Color {
  const t = noise(x * 0.9 + 4, z * 0.9 - 3, 0.7) * 0.5 + 0.5;
  return t < 0.5 ? out.copy(BROWN).lerp(SAND, t * 2) : out.copy(SAND).lerp(GREY, (t - 0.5) * 2);
}

/** Дорога за воротами: своя текстура (road.jpg), цвет вершин лишь слегка оживляет её вдоль дороги. */
function roadTone(x: number, z: number, out: THREE.Color): THREE.Color {
  const n = noise(x * 0.5 + 2, z * 1.2 - 1, 0.9) * 0.5 + 0.5;
  return out.setScalar(1.0 + 0.3 * n);
}

const YARD_SAND = new THREE.Color(1.9, 1.85, 1.55);
const YARD_BROWN = new THREE.Color(1.55, 1.2, 0.9);

interface FieldOptions {
  prims: Prim[];
  x: [number, number];
  z: [number, number];
  stepX: number;
  stepZ: number;
  widen?: number;
  y: (x: number, f: number) => number;
  color: (x: number, z: number, f: number, out: THREE.Color) => number; // возвращает альфу 0…1
  /** Дополнительное поле для особых слоёв (колея): подменяет cover. */
  value?: (x: number, z: number) => number;
}

/** Сетка поля: вершины с цветом и прозрачностью, треугольники только там, где есть покрытие. */
function buildField(o: FieldOptions): THREE.BufferGeometry | null {
  const nx = Math.ceil((o.x[1] - o.x[0]) / o.stepX);
  const nz = Math.ceil((o.z[1] - o.z[0]) / o.stepZ);
  const w = nx + 1;
  const f = new Float32Array(w * (nz + 1));
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = o.x[0] + i * o.stepX;
      const z = o.z[0] + j * o.stepZ;
      f[j * w + i] = o.value ? o.value(x, z) : fieldAt(o.prims, x, z, o.widen);
    }
  }
  const map = new Int32Array(w * (nz + 1)).fill(-1);
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tmp = new THREE.Color();
  const use = (i: number, j: number) => {
    const k = j * w + i;
    if (map[k]! >= 0) return map[k]!;
    const x = o.x[0] + i * o.stepX;
    const z = o.z[0] + j * o.stepZ;
    const fv = f[k]!;
    const a = o.color(x, z, fv, tmp);
    map[k] = pos.length / 3;
    pos.push(x, o.y(x, fv), z);
    uv.push(x, z);
    col.push(tmp.r, tmp.g, tmp.b, a);
    return map[k]!;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = f[j * w + i]!;
      const b = f[j * w + i + 1]!;
      const c = f[(j + 1) * w + i]!;
      const d = f[(j + 1) * w + i + 1]!;
      if (a + b + c + d <= 0) continue;
      const v00 = use(i, j);
      const v10 = use(i + 1, j);
      const v01 = use(i, j + 1);
      const v11 = use(i + 1, j + 1);
      idx.push(v00, v01, v10, v10, v01, v11);
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array<number>((pos.length / 3) * 3).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

const PEBBLES = ["#b3a17f", "#9c8767", "#a89a82", "#8a7a5e", "#c2b193", "#7f7466", "#b9ad9b", "#9a948a", "#847b70"];

export function Road({ roads, size }: RoadProps) {
  const tex = useSeasonTextures(WINTER);

  const data = useMemo(() => {
    // кисть тропы: диски на клетках и перемычки между соседями
    const cells = roads.map((r) => ({ x: r.x, z: r.z, cx: cellToWorld(r.x, size), cz: cellToWorld(r.z, size) }));
    const keys = new Map(cells.map((c) => [`${c.x}:${c.z}`, c]));
    const path: Prim[] = [];
    for (const c of cells) {
      path.push({ x0: c.cx, z0: c.cz, x1: c.cx, z1: c.cz, r0: PATH_R, r1: PATH_R });
      for (const [nx, nz] of [[1, 0], [0, 1]] as const) {
        const n = keys.get(`${c.x + nx}:${c.z + nz}`);
        if (n) path.push({ x0: c.cx, z0: c.cz, x1: n.cx, z1: n.cz, r0: PATH_R, r1: PATH_R });
      }
    }
    // подъезд: от ворот прямо наружу, одной ширины по всей длине (по решению заказчика не сужается)
    const road: Prim[] = [{ x0: PLOT - 2.6, z0: 0, x1: ROAD_END, z1: 0, r0: ROAD_R, r1: ROAD_R, soft: 0.22 }];

    const gridMin = (v: number) => Math.floor(v / STEP) * STEP;
    const xs = [PLOT + 1.2, ...cells.map((c) => c.cx)];
    const zs = [-GATE_HALF, GATE_HALF, ...cells.map((c) => c.cz)];
    const yardBounds = {
      x: [gridMin(Math.min(...xs) - 0.7), PLOT + 1.2] as [number, number],
      z: [gridMin(Math.min(...zs) - 0.7), gridMin(Math.max(...zs) + 0.7) + STEP] as [number, number],
    };

    const roadCol = new THREE.Color();
    const soil = (x: number, z: number, f: number, out: THREE.Color) => {
      // тропа во дворе: бледный песок/грунт, мягкие пятна светлее и темнее
      const tone = noise(x * 0.9 + 4, z * 0.9 - 3, 0.7) * 0.5 + 0.5;
      const patch = noise(x * 2.4 + 9, z * 2.4 - 5, 0.8) * 0.5 + 0.5;
      out.copy(YARD_BROWN).lerp(YARD_SAND, THREE.MathUtils.clamp(tone * 1.4, 0, 1)).multiplyScalar(0.82 + 0.36 * patch);
      out.multiplyScalar(0.55 + 0.45 * smooth(0, 1, f)); // у кромки темнее: грунт «врастает» в землю
      return smooth(0, 0.6, f);
    };
    const roadSoil = (x: number, z: number, f: number, out: THREE.Color) => {
      // у ворот дорога «вырастает» из земли двора: прозрачность и яркость нарастают от x = PLOT-2.6 до края площадки
      const ramp = smooth(PLOT - 2.6, PLOT + 0.15, x);
      roadTone(x, z, roadCol);
      out.copy(roadCol).multiplyScalar((0.75 + 0.25 * smooth(0, 1, f)) * (0.7 + 0.3 * ramp));
      return smooth(0, 0.3, f) * ramp;
    };

    const yard = buildField({ prims: path, ...yardBounds, stepX: STEP, stepZ: STEP, y: (x, f) => baseY(x) - 0.012 * (1 - f), color: soil });
    // дорога: ближний участок у ворот — мелкая сетка, дальше — крупнее
    const roadY = (x: number, f: number) => baseY(x) + 0.004 - 0.006 * (1 - f);
    const roadNear = buildField({ prims: road, x: [PLOT - 3.1, PLOT + 1.2], z: [-2.4, 2.4 + 1e-6], stepX: STEP, stepZ: STEP, y: roadY, color: roadSoil });
    const roadFar = buildField({ prims: road, x: [PLOT + 1.2, ROAD_END], z: [-2.4, 2.4 + 1e-6], stepX: 0.3, stepZ: STEP, y: roadY, color: roadSoil });
    // колея: две тонкие тёмные полосы вдоль дороги, затухают у ворот
    const rut = (x: number, z: number) => {
      const mask = smooth(PLOT + 1.0, PLOT + 3.0, x) * smooth(0.4, 0.9, fieldAt(road, x, z));
      const a = 1 - Math.min(Math.abs(z - 0.55), Math.abs(z + 0.55)) / 0.1;
      return Math.max(a, 0) * mask * (0.7 + 0.3 * noise(x * 0.8, 0));
    };
    const ruts = buildField({
      prims: road,
      x: [PLOT + 1.0, ROAD_END],
      z: [-0.8, 0.8 + 1e-6],
      stepX: 0.4,
      stepZ: 0.03,
      value: rut,
      y: () => baseY(PLOT + 6) + 0.009,
      color: (_x, _z, f, out) => {
        out.setRGB(0.3, 0.19, 0.13);
        return 0.55 * f;
      },
    });

    // снег по краям дороги: низкие неровные валики вдоль кромки (не изгиб дороги, а лёгкая обвалка)
    const rs = rng(777);
    const lumps: { geom: THREE.BufferGeometry; x: number; z: number; rot: number; tone: string }[] = [];
    for (let x = PLOT + 0.9; x < 34; x += 1.2 + rs() * 1.9) {
      for (const side of [-1, 1]) {
        if (rs() < 0.25) continue;
        lumps.push({
          geom: snowBlob(0.55 + rs() * 0.6, 0.13 + rs() * 0.1, 300 + lumps.length * 5, 0.5),
          x: x + rs() * 0.8,
          z: side * ROAD_R * (0.9 + rs() * 0.3),
          rot: (rs() - 0.5) * 0.5,
          tone: rs() < 0.5 ? "#f6f2e8" : "#eeeae0",
        });
      }
    }

    // мелкая россыпь: только крошка и мелкая галька, никаких крупных камней
    const r = rng(4242);
    const pebbles: { x: number; y: number; z: number; s: number; rot: number; c: string }[] = [];
    const scatter = (count: number, x0: number, x1: number, z0: number, z1: number, prims: Prim[], minF: number, maxF: number, s0: number, s1: number) => {
      let guard = 0;
      let n = 0;
      while (n < count && guard++ < count * 40) {
        const x = x0 + r() * (x1 - x0);
        const z = z0 + r() * (z1 - z0);
        const fv = fieldAt(prims, x, z);
        if (fv < minF || fv > maxF) continue;
        pebbles.push({ x, y: baseY(x), z, s: s0 + r() * (s1 - s0), rot: r() * Math.PI, c: PEBBLES[Math.floor(r() * PEBBLES.length)]! });
        n++;
      }
    };
    const area = Math.max(cells.length, 1);
    scatter(area * 16, yardBounds.x[0], yardBounds.x[1], yardBounds.z[0], yardBounds.z[1], path, 0.55, 1, 0.03, 0.07);
    scatter(area * 10, yardBounds.x[0], yardBounds.x[1], yardBounds.z[0], yardBounds.z[1], path, 0.08, 0.5, 0.02, 0.04);
    scatter(320, PLOT - 0.4, 36, -1.45, 1.45, road, 0.5, 1, 0.025, 0.06);
    scatter(140, PLOT - 0.4, 36, -1.7, 1.7, road, 0.05, 0.5, 0.02, 0.04);
    return { yard, roadNear, roadFar, ruts, lumps, pebbles };
  }, [roads, size]);

  const peb = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    if (!peb.current) return;
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    data.pebbles.forEach((p, i) => {
      d.position.set(p.x, p.y + 0.004, p.z);
      d.rotation.set(0, p.rot, 0);
      d.scale.set(p.s, p.s * 0.5, p.s);
      d.updateMatrix();
      peb.current.setMatrixAt(i, d.matrix);
      peb.current.setColorAt(i, col.set(p.c).multiplyScalar(0.8));
    });
    peb.current.instanceMatrix.needsUpdate = true;
    if (peb.current.instanceColor) peb.current.instanceColor.needsUpdate = true;
  }, [data]);

  /** Материал полотна: текстура земли × цвета вершин (значения > 1 осветляют тёмную текстуру двора). */
  const soilMat = tex ? (
    <meshStandardMaterial key="tex" vertexColors transparent map={tiled(tex.mud, 0.5)} bumpMap={tiled(tex.mud, 0.5)} bumpScale={0.07} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  ) : (
    <meshStandardMaterial key="plain" vertexColors transparent color="#a98a5e" roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  );
  const roadMat = tex ? (
    <meshStandardMaterial key="tex" vertexColors transparent map={tiled(tex.road, 0.27)} bumpMap={tiled(tex.road, 0.27)} bumpScale={0.06} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
  ) : (
    <meshStandardMaterial key="plain" vertexColors transparent color="#8a5f3e" roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
  );
  const lumpMat = (tone: string) =>
    tex ? (
      <meshStandardMaterial key="tex" color={tone} map={tiled(tex.snow, 0.34)} bumpMap={tiled(tex.snow, 0.34)} bumpScale={0.03} roughness={0.96} />
    ) : (
      <meshStandardMaterial key="plain" color={tone} roughness={0.96} />
    );

  return (
    <group>
      {data.roadNear ? (
        <mesh geometry={data.roadNear} receiveShadow renderOrder={3}>
          {roadMat}
        </mesh>
      ) : null}
      {data.roadFar ? (
        <mesh geometry={data.roadFar} receiveShadow renderOrder={3}>
          {roadMat}
        </mesh>
      ) : null}
      {data.yard ? (
        <mesh geometry={data.yard} receiveShadow renderOrder={2}>
          {soilMat}
        </mesh>
      ) : null}
      {data.ruts ? (
        <mesh geometry={data.ruts} renderOrder={4}>
          <meshBasicMaterial vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ) : null}
      {data.lumps.map((l, i) => (
        <mesh key={i} geometry={l.geom} position={[l.x, 0.06, l.z]} rotation-y={l.rot} castShadow receiveShadow>
          {lumpMat(l.tone)}
        </mesh>
      ))}
      <instancedMesh key={data.pebbles.length} ref={peb} args={[undefined, undefined, data.pebbles.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
