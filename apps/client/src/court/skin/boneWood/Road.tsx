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
import { CELL, GATE_HALF, PLOT, WINTER, cellToWorld, rng, tiled, useSeasonTextures } from "../kit.js";
import type { RoadProps } from "../types.js";

/** Высота тропы во дворе: выше рельефа земли (до 0.127), чтобы поверхности не делили плоскость. */
const YARD_Y = 0.14;
const SNOW_Y = 0.03;
const STEP = 0.1;
const ROAD_END = 58;
const PATH_R = 0.3; // половина ширины тропы во дворе (≈ 0.55 клетки)
const ROAD_R = 0.95; // половина ширины дороги за воротами

interface Prim {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  r0: number;
  r1: number;
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
  return THREE.MathUtils.clamp((1 - d / r) / 0.5, 0, 1);
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

const PEBBLES = ["#b3a17f", "#9c8767", "#a89a82", "#8a7a5e", "#c2b193", "#7f7466", "#b9ad9b"];

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
    const road: Prim[] = [{ x0: PLOT - 0.2, z0: 0, x1: ROAD_END, z1: 0, r0: ROAD_R, r1: ROAD_R }];
    const all = [...path, ...road.filter((p) => p.x0 < PLOT + 1.2)];

    const gridMin = (v: number) => Math.floor(v / STEP) * STEP;
    const xs = [PLOT + 1.2, ...cells.map((c) => c.cx)];
    const zs = [-GATE_HALF, GATE_HALF, ...cells.map((c) => c.cz)];
    const yardBounds = {
      x: [gridMin(Math.min(...xs) - 0.7), PLOT + 1.2] as [number, number],
      z: [gridMin(Math.min(...zs) - 0.7), gridMin(Math.max(...zs) + 0.7) + STEP] as [number, number],
    };

    const toneOut = new THREE.Color();
    const soil = (x: number, z: number, f: number, out: THREE.Color) => {
      groundTone(x, z, out);
      // во дворе тропа мягче и пестрее: меньше яркости, пятна светлее и темнее (за воротами палитра как утверждена)
      const inside = 1 - smooth(PLOT, PLOT + 2.2, x);
      const patch = noise(x * 2.4 + 9, z * 2.4 - 5, 0.8) * 0.5 + 0.5;
      const boost = THREE.MathUtils.lerp(1.2, 0.85 * (0.75 + 0.5 * patch), inside);
      out.multiplyScalar(boost * (0.55 + 0.45 * smooth(0, 1, f))); // у кромки темнее: грунт «врастает» в землю
      return smooth(0, 0.6, f);
    };

    const yard = buildField({ prims: all, ...yardBounds, stepX: STEP, stepZ: STEP, y: (x, f) => baseY(x) - 0.012 * (1 - f), color: soil });
    const outer = buildField({
      prims: road,
      x: [PLOT + 1.2, ROAD_END],
      z: [-2.2, 2.2 + 1e-6],
      stepX: 0.3,
      stepZ: STEP,
      y: (x, f) => baseY(x) - 0.004 * (1 - f),
      color: soil,
    });
    // притоптанный снег по обочинам: шире дороги, серовато-голубой, очень мягкий
    const shoulder = buildField({
      prims: road,
      x: [PLOT + 0.4, ROAD_END],
      z: [-3.6, 3.6 + 1e-6],
      stepX: 0.4,
      stepZ: 0.15,
      widen: 1.85,
      y: () => 0.014,
      color: (x, z, f, out) => {
        out.setRGB(0.8, 0.82, 0.87).offsetHSL(0, 0, noise(x * 0.5, z * 1.5) * 0.02);
        return 0.85 * smooth(0, 0.7, f);
      },
    });
    // колея: две тонкие тёмные полосы вдоль дороги, затухают у ворот
    const rut = (x: number, z: number) => {
      const mask = smooth(PLOT + 1.6, PLOT + 4.5, x) * smooth(0.4, 0.9, fieldAt(road, x, z));
      const a = 1 - Math.min(Math.abs(z - 0.36), Math.abs(z + 0.36)) / 0.075;
      return Math.max(a, 0) * mask * (0.7 + 0.3 * noise(x * 0.8, 0));
    };
    const ruts = buildField({
      prims: road,
      x: [PLOT + 1.6, ROAD_END],
      z: [-0.6, 0.6 + 1e-6],
      stepX: 0.4,
      stepZ: 0.025,
      value: rut,
      y: () => baseY(PLOT + 6) + 0.003,
      color: (_x, _z, f, out) => {
        out.setRGB(0.5, 0.36, 0.26);
        return 0.55 * f;
      },
    });

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
    scatter(area * 16, yardBounds.x[0], yardBounds.x[1], yardBounds.z[0], yardBounds.z[1], all, 0.55, 1, 0.03, 0.07);
    scatter(area * 10, yardBounds.x[0], yardBounds.x[1], yardBounds.z[0], yardBounds.z[1], all, 0.08, 0.5, 0.02, 0.04);
    scatter(260, PLOT + 1.2, 36, -1.1, 1.1, road, 0.5, 1, 0.025, 0.06);
    scatter(120, PLOT + 1.2, 36, -1.3, 1.3, road, 0.05, 0.5, 0.02, 0.04);
    void toneOut;
    return { yard, outer, shoulder, ruts, pebbles };
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
      peb.current.setColorAt(i, col.set(p.c));
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
  const shoulderMat = tex ? (
    <meshStandardMaterial key="tex" vertexColors transparent depthWrite={false} map={tiled(tex.snow, 0.34)} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  ) : (
    <meshStandardMaterial key="plain" vertexColors transparent depthWrite={false} roughness={1} />
  );

  return (
    <group>
      {data.shoulder ? (
        <mesh geometry={data.shoulder} receiveShadow renderOrder={1}>
          {shoulderMat}
        </mesh>
      ) : null}
      {data.outer ? (
        <mesh geometry={data.outer} receiveShadow renderOrder={2}>
          {soilMat}
        </mesh>
      ) : null}
      {data.yard ? (
        <mesh geometry={data.yard} receiveShadow renderOrder={2}>
          {soilMat}
        </mesh>
      ) : null}
      {data.ruts ? (
        <mesh geometry={data.ruts} renderOrder={3}>
          <meshBasicMaterial vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ) : null}
      <instancedMesh key={data.pebbles.length} ref={peb} args={[undefined, undefined, data.pebbles.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
