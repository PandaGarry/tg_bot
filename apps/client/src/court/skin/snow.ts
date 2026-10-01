/**
 * Снег как объём: геометрии сугробов и снежных шапок для всех скинов зимы.
 *
 * Принцип: снег лежит СЛОЕМ с мягкой кромкой, а не плоским пятном. Ровный слой —
 * только там, где ветер оставил его (у стены, в углах); на ветвях, брёвнах и крышах —
 * шапка с выпуклым краем и неровной нижней кромкой. Все формы детерминированы
 * (одинаковый seed — одинаковый снег), чтобы двор не «дрожал» между перезагрузками.
 * Крыши зданий позже берут `snowMound` / `snowConeCap` отсюда же.
 */

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./kit.js";

const TAU = Math.PI * 2;

/** Периодический шум по углу: сумма гармоник с целыми частотами, значения около −1…1. */
function angular(seed: number, freqs: number[] = [2, 3, 5, 7]) {
  const r = rng(seed);
  const parts = freqs.map((k) => ({ k, p: r() * TAU, a: 0.5 / Math.sqrt(k) }));
  return (phi: number) => parts.reduce((sum, c) => sum + Math.sin(phi * c.k + c.p) * c.a, 0);
}

/** Склеивает дубликаты шва и считает гладкие нормали: форма читается мягкой, без видимого шва. */
function smooth(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Шапка снега поверх конуса (как ярус ели). Геометрия задана в тех же координатах,
 * что и `coneGeometry(R, H)`: вершина вверху (+H/2), так что меш ставится в ту же точку.
 * `cover` — какая доля высоты яруса под снегом (от вершины вниз).
 */
export function snowConeCap(R: number, H: number, cover: number, seed: number): THREE.BufferGeometry {
  const k = 1.06; // шапка чуть шире яруса и не тонет в его гранях
  const rs = (t: number) => R * (t / H) * k; // радиус яруса на глубине t от вершины
  const tc = cover * H;
  const top = H / 2;
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(rs(tc) * 0.55, top - tc - 0.09),
    new THREE.Vector2(rs(tc) + 0.012, top - tc - 0.07),
    new THREE.Vector2(rs(tc) + 0.045, top - tc - 0.015),
    new THREE.Vector2(rs(tc * 0.92) + 0.04, top - tc * 0.92 + 0.02),
    new THREE.Vector2(rs(tc * 0.72) + 0.03, top - tc * 0.72 + 0.03),
    new THREE.Vector2(rs(tc * 0.48) + 0.026, top - tc * 0.48 + 0.03),
    new THREE.Vector2(rs(tc * 0.24) + 0.02, top - tc * 0.24 + 0.025),
    new THREE.Vector2(rs(tc * 0.08) + 0.012, top - tc * 0.08 + 0.02),
    new THREE.Vector2(0, top + 0.03),
  ];
  const g = new THREE.LatheGeometry(prof, 14);
  const radial = angular(seed);
  const drop = angular(seed + 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const w = THREE.MathUtils.clamp((top - y) / Math.max(tc, 1e-3), 0, 1.1); // 0 у вершины, ≈1 у кромки
    const phi = Math.atan2(x, z);
    const s = 1 + 0.14 * w * radial(phi);
    pos.setXYZ(i, x * s, y - 0.1 * w * w * w * (drop(phi) + 0.6), z * s);
  }
  return smooth(g);
}

/**
 * Снежный холм над основанием: шапка на столбе, бревне, коньке, подоконнике.
 * Низ в y = 0 слегка свисает ниже (lip), верх — rounded. `r` — радиус основания, `h` — высота.
 */
export function snowMound(r: number, h: number, seed: number, segments = 10): THREE.BufferGeometry {
  const prof = [
    [0.55, -0.1],
    [0.98, -0.085],
    [1.12, -0.02],
    [1.06, 0.1],
    [0.9, 0.34],
    [0.68, 0.62],
    [0.4, 0.86],
    [0.16, 0.985],
    [0, 1],
  ].map(([x, y]) => new THREE.Vector2(x! * r, y! * h));
  const g = new THREE.LatheGeometry(prof, segments);
  const radial = angular(seed);
  const drop = angular(seed + 5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const low = THREE.MathUtils.clamp(1 - y / (h * 0.5), 0, 1); // низ мягче искривлён
    const phi = Math.atan2(x, z);
    const s = 1 + 0.16 * radial(phi);
    pos.setXYZ(i, x * s, y - h * 0.16 * low * (drop(phi) + 0.6), z * s);
  }
  return smooth(g);
}

/**
 * Сугроб-«линза» на земле: полярная сетка, высота падает к кромке и уходит ниже грунта, поэтому
 * кромка не торчит и не мерцает. Координаты в плоскости XZ, y = 0 на уровне грунта.
 * `aspect` вытягивает по Z; UV — мировые, для плиточной текстуры снега.
 */
export function snowBlob(radius: number, height: number, seed: number, aspect = 0.8): THREE.BufferGeometry {
  const seg = 30;
  const rings = 8;
  const radial = angular(seed, [2, 3, 4]); // низкие частоты: кромка плавная, без зубцов
  const verts: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const dip = 0.05;
  for (let ring = 0; ring <= rings; ring++) {
    const rho = ring / rings;
    for (let s = 0; s <= seg; s++) {
      const phi = (s / seg) * TAU;
      const edge = radius * (1 + 0.5 * radial(phi) * rho);
      const x = Math.cos(phi) * edge * rho;
      const z = Math.sin(phi) * edge * rho * aspect;
      const y = (height + dip) * Math.pow(Math.max(1 - rho * rho, 0), 1.25) - dip;
      verts.push(x, y, z);
      uvs.push(x, z);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let s = 0; s < seg; s++) {
      const a = ring * (seg + 1) + s;
      const b = a + seg + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return flipUp(g);
}

/** Если в среднем нормали смотрят вниз, переворачивает обход треугольников. */
function flipUp(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  let sum = 0;
  for (let i = 0; i < n.count; i++) sum += n.getY(i);
  if (sum < 0) {
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    g.computeVertexNormals();
  }
  return g;
}

export interface SnowBandOptions {
  /** Половина площадки (внутренняя сторона стены). */
  half: number;
  /** Половина проёма ворот: здесь снег заканчивается. */
  gateHalf: number;
  /** Запрет: вернуть true, если в точке нельзя класть снег (постройка, дорога). */
  blocked: (x: number, z: number) => boolean;
  seed: number;
}

/**
 * Снежный вал вдоль стены внутри двора: сплошная лента от одной стороны проёма до другой.
 * Высота у стены меняется волнами (0.14…0.45), ширина — тоже (0.5…1.6), к воротам лента сходит
 * на нет, около построек сужается. Профиль: высокий у стены и плавно уходит под грунт —
 * как наметённый ветром сугроб.
 */
export function snowBand({ half, gateHalf, blocked, seed }: SnowBandOptions): THREE.BufferGeometry {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, () => ({ f: 0.25 + r() * 0.9, p: r() * TAU, a: 0.5 + r() }));
  const n1 = (s: number) =>
    waves.reduce((acc, w) => acc + Math.sin(s * w.f + w.p) * w.a, 0) / waves.reduce((acc, w) => acc + w.a, 0);
  const wavesB = Array.from({ length: 5 }, () => ({ f: 0.2 + r() * 1.1, p: r() * TAU, a: 0.5 + r() }));
  const n2 = (s: number) =>
    wavesB.reduce((acc, w) => acc + Math.sin(s * w.f + w.p) * w.a, 0) / wavesB.reduce((acc, w) => acc + w.a, 0);

  // периметр по часовой стрелке от верхнего края проёма (восточная стена) и обратно к нижнему
  const side = half - gateHalf;
  const lengths = [side, half * 2, half * 2, half * 2, side];
  const total = lengths.reduce((a, b) => a + b, 0);
  const at = (s: number): [number, number] => {
    let t = s;
    if (t <= lengths[0]!) return [half, gateHalf + t];
    t -= lengths[0]!;
    if (t <= lengths[1]!) return [half - t, half];
    t -= lengths[1]!;
    if (t <= lengths[2]!) return [-half, half - t];
    t -= lengths[2]!;
    if (t <= lengths[3]!) return [-half + t, -half];
    t -= lengths[3]!;
    return [half, -half + t];
  };

  const step = 0.2;
  const count = Math.ceil(total / step);
  const cross = 7;
  const width: number[] = [];
  for (let i = 0; i <= count; i++) {
    const s = (i / count) * total;
    const w = 0.55 + 0.55 * (n2(s) + 1);
    width.push(w);
  }
  // у построек лента уже: уменьшаем ширину, пока внутренняя кромка не выйдет из запрета
  const inner = (x: number, z: number, w: number): [number, number] => [
    Math.sign(x) * Math.min(Math.abs(x), half - w),
    Math.sign(z) * Math.min(Math.abs(z), half - w),
  ];
  for (let i = 0; i <= count; i++) {
    const [x, z] = at((i / count) * total);
    while (width[i]! > 0.12) {
      const [ix, iz] = inner(x, z, width[i]! + 0.35);
      if (!blocked(ix, iz)) break;
      width[i]! -= 0.1;
    }
    width[i] = Math.max(width[i]!, 0.1);
  }
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < count; i++) width[i] = (width[i - 1]! + width[i]! * 2 + width[i + 1]!) / 4;
  }

  const verts: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const dip = 0.05;
  const outerInset = 0.05;
  for (let i = 0; i <= count; i++) {
    const s = (i / count) * total;
    const [ox, oz] = at(s);
    const taper = THREE.MathUtils.smoothstep(Math.min(s, total - s), 0, 2.2); // конец у ворот сходит на нет
    const w = width[i]! * (0.15 + 0.85 * taper);
    const hk = (0.14 + 0.31 * (n1(s) * 0.5 + 0.5)) * (0.1 + 0.9 * taper);
    const [ix, iz] = inner(ox, oz, w);
    for (let c = 0; c <= cross; c++) {
      const t = c / cross;
      const x = THREE.MathUtils.lerp(ox - Math.sign(ox) * outerInset, ix, t);
      const z = THREE.MathUtils.lerp(oz - Math.sign(oz) * outerInset, iz, t);
      const y = (hk + dip) * Math.pow(Math.max(1 - t * t, 0), 1.35) - dip;
      verts.push(x, y, z);
      uvs.push(x, z);
    }
  }
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < cross; c++) {
      const a = i * (cross + 1) + c;
      const b = a + cross + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return flipUp(g);
}

/**
 * Снежный вал на балке: вытянут вдоль оси Z, в сечении — полуэллипс с загнутой под бревно кромкой,
 * концы закруглены. Основание в y = 0 (кладите на верх балки). Высота и ширина «дышат» по длине.
 */
export function snowRidge(length: number, width: number, height: number, seed: number): THREE.BufferGeometry {
  const nu = Math.max(12, Math.round(length / 0.08));
  const nv = 14;
  const r = rng(seed);
  const waves = Array.from({ length: 3 }, () => ({ f: 1.5 + r() * 3.5, p: r() * TAU, a: 0.12 + r() * 0.1 }));
  const wob = (u: number) => 1 + waves.reduce((acc, w) => acc + Math.sin(u * w.f * Math.PI + w.p) * w.a, 0);
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const e = Math.pow(Math.max(1 - Math.pow(Math.abs(2 * u - 1), 7), 0), 0.5); // закруглённые концы
    const k = wob(u);
    for (let j = 0; j <= nv; j++) {
      const th = -0.45 + (j / nv) * (Math.PI + 0.9); // кромка заходит под бревно с обеих сторон
      const x = Math.cos(th) * width * e * (1 + 0.08 * (k - 1));
      const y = Math.sin(th) * height * e * k;
      pos.push(x, y, (u - 0.5) * length);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  let up = 0;
  for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2]!, idx[i + 1]!];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}
