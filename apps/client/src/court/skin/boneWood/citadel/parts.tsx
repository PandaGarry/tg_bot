/**
 * Кирпичи Цитадели: материалы и общие детали (брёвна, крыши со снегом, рога, рёберная арка,
 * окна, башни). Из них `stages.tsx` собирает пять стадий. Всё стоит в локальных координатах
 * вокруг центра пятна 3×3 клетки (3.3 × 3.3), вход смотрит на +x (к воротам), основание в y = 0.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SURFACE } from "../../kit.js";
import { snowBlob, snowConeCap, snowRidge } from "../../snow.js";

export type V3 = [number, number, number];

/** Копия процедурной текстуры со своим повтором: доски и камень не «растягиваются» на большую стену. */
function tex(base: THREE.DataTexture, rx: number, ry: number): THREE.DataTexture {
  const c = base.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}
const wood = (color: string, rx = 2, ry = 2, rough = 0.95) =>
  new THREE.MeshStandardMaterial({ color, map: tex(SURFACE.wood.color, rx, ry), bumpMap: tex(SURFACE.wood.bump, rx, ry), bumpScale: 0.03, roughness: rough, flatShading: true });
const rock = (color: string, rx = 2, ry = 2) =>
  new THREE.MeshStandardMaterial({ color, map: tex(SURFACE.stone.color, rx, ry), bumpMap: tex(SURFACE.stone.bump, rx, ry), bumpScale: 0.05, roughness: 0.92, flatShading: true });

/** Общие материалы (создаются один раз, GPU делит их между стадиями). */
export const MAT = {
  plank: wood("#7d5837", 3, 2),
  plankDark: wood("#46301e", 1, 1),
  log: wood("#6b4a2e", 1, 3),
  roofWood: wood("#4f3825", 4, 3),
  roofIron: new THREE.MeshStandardMaterial({ color: "#4b4f55", roughness: 0.55, metalness: 0.45, flatShading: true }),
  stone: rock("#9ea5ab", 2, 2),
  stoneDark: rock("#7b8186", 2, 2),
  quoin: rock("#d2d0c9", 1, 1),
  bone: new THREE.MeshStandardMaterial({ color: "#e8dec6", roughness: 0.78 }),
  boneDark: new THREE.MeshStandardMaterial({ color: "#cdbf9f", roughness: 0.85 }),
  iron: new THREE.MeshStandardMaterial({ color: "#34373c", roughness: 0.5, metalness: 0.6, flatShading: true }),
  door: wood("#3a281a", 1, 1),
  snow: new THREE.MeshStandardMaterial({ color: "#f7f3e8", roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: "#2e2013", emissive: "#ffb45a", emissiveIntensity: 0.8, roughness: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: "#d9c9a6", roughness: 0.85 }),
  smoke: new THREE.MeshStandardMaterial({ color: "#efe9dd", transparent: true, opacity: 0.4, roughness: 1, depthWrite: false }),
};

export function Box({ p, s, m, rot, cast = true }: { p: V3; s: V3; m: THREE.Material; rot?: V3; cast?: boolean }) {
  return (
    <mesh position={p} rotation={rot} material={m} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

/** Брусок с мягкими рёбрами: для снега и шапок. */
export function SoftBox({ p, s, rot, m = MAT.snow, radius = 0.05 }: { p: V3; s: V3; rot?: V3; m?: THREE.Material; radius?: number }) {
  const g = useMemo(() => new RoundedBoxGeometry(s[0], s[1], s[2], 3, Math.min(radius, s[1] / 2 - 0.001)), [s[0], s[1], s[2], radius]);
  return <mesh position={p} rotation={rot} geometry={g} material={m} castShadow receiveShadow />;
}

/** Стержень между двумя точками (рога, перила, рёбра). */
export function Rod({ a, b, r, m = MAT.bone, r2 }: { a: V3; b: V3; r: number; r2?: number; m?: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    return {
      len: d.length(),
      pos: va.clone().add(vb).multiplyScalar(0.5).toArray() as V3,
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
    };
  }, [a[0], a[1], a[2], b[0], b[1], b[2]]);
  return (
    <mesh position={pos} quaternion={quat} material={m} castShadow>
      <cylinderGeometry args={[r2 ?? r * 0.75, r, len, 6]} />
    </mesh>
  );
}

// ---------- брёвна ----------

/** Сруб: горизонтальные брёвна с выпущенными в «лапу» углами. Ось x — к воротам. */
export function LogWalls({ w, d, courses, r = 0.12 }: { w: number; d: number; courses: number; r?: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const step = r * 1.78;
    for (let i = 0; i < courses; i++) {
      const y = r + i * step;
      // по x идут стены z = ±d/2, по z — стены x = ±w/2; вторая пара чуть выше, чтобы углы перекрывались
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(r, r, w + r * 1.7, 8);
        g.rotateZ(Math.PI / 2);
        g.translate(0, y, (sz * d) / 2);
        parts.push(g);
      }
      for (const sx of [-1, 1]) {
        const g = new THREE.CylinderGeometry(r, r, d + r * 1.7, 8);
        g.rotateX(Math.PI / 2);
        g.translate((sx * w) / 2, y + step / 2, 0);
        parts.push(g);
      }
    }
    return mergeGeometries(parts)!;
  }, [w, d, courses, r]);
  return <mesh geometry={geo} material={MAT.log} castShadow receiveShadow />;
}

// ---------- крыши ----------

/** Ось конька — x. Двускатная крыша: доски, шапка снега, снежный гребень, фронтоны. */
export function GableRoof({
  y, length, width, rise, over = 0.2, mat = MAT.roofWood, gable = MAT.plank, seed = 1, x = 0, bone = false, snowLen = 1,
}: {
  y: number; length: number; width: number; rise: number; over?: number; mat?: THREE.Material; gable?: THREE.Material; seed?: number; x?: number; bone?: boolean; snowLen?: number;
}) {
  const hw = width / 2 + over;
  const a = Math.atan2(rise, hw);
  const L = Math.hypot(hw, rise);
  const lx = length + 0.24;
  const thick = 0.1;
  const snowT = 0.15;
  const side = (sg: 1 | -1) => {
    const off = thick / 2 + snowT / 2 - 0.02; // снег лежит поверх досок
    const shift = 0.07; // снег не доходит до карниза: виден край досок
    const cy = rise / 2;
    const cz = (sg * hw) / 2;
    const ang = sg * a;
    return (
      <group key={sg}>
        <mesh position={[0, cy, cz]} rotation={[ang, 0, 0]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[lx, thick, L]} />
        </mesh>
        <SoftBox
          p={[0, cy + Math.cos(a) * off + (Math.sin(a) * shift) / 2, cz + sg * Math.sin(a) * off - (sg * Math.cos(a) * shift) / 2]}
          s={[lx * snowLen - 0.1, snowT, L - shift - 0.04]}
          rot={[ang, 0, 0]}
          radius={0.06}
        />
      </group>
    );
  };
  const rk = Math.min(1, Math.max(0.55, width / 2.4)); // на малых крышах гребень тоньше
  const ridge = useMemo(() => snowRidge(lx * snowLen - 0.16, 0.2 * rk, 0.11 * rk, seed), [lx, seed, snowLen, rk]);
  const gableGeo = useMemo(() => {
    const ww = width / 2;
    const rr = rise * (ww / hw);
    const sh = new THREE.Shape([new THREE.Vector2(-ww, 0), new THREE.Vector2(ww, 0), new THREE.Vector2(0, rr)]);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
  }, [width, rise, hw]);
  return (
    <group position={[x, y, 0]}>
      {side(1)}
      {side(-1)}
      <mesh geometry={ridge} material={MAT.snow} rotation-y={Math.PI / 2} position-y={rise + thick / 2 + snowT - 0.07} castShadow />
      {[-1, 1].map((e) => (
        <mesh key={e} geometry={gableGeo} material={gable} rotation-y={Math.PI / 2} position={[e > 0 ? length / 2 - 0.1 : -length / 2, 0, 0]} castShadow receiveShadow />
      ))}
      {bone &&
        [-1, 1].flatMap((sg) =>
          [-1, 1].map((e) => (
            <Rod
              key={`${sg}${e}`}
              a={[(e * lx) / 2, 0.02, sg * hw]}
              b={[(e * lx) / 2, rise + 0.02, 0]}
              r={0.04}
              r2={0.04}
              m={MAT.boneDark}
            />
          )),
        )}
    </group>
  );
}

/** Четырёхскатная шапка (башня): основание base × base, высота h; снег лежит на верхней доле `cover`. */
export function HipRoof({ p, base, h, mat = MAT.roofWood, cover = 0.9, rot = 0 }: { p: V3; base: number; h: number; mat?: THREE.Material; cover?: number; rot?: number }) {
  const R = (base / 2) * Math.SQRT2;
  const snow = useMemo(() => {
    const hs = h * cover;
    const g = new THREE.ConeGeometry(R * cover * 1.05, hs, 4, 1);
    g.rotateY(Math.PI / 4);
    return { g, hs };
  }, [R, h, cover]);
  return (
    <group position={p} rotation-y={rot}>
      <mesh position-y={h / 2} rotation-y={Math.PI / 4} material={mat} castShadow receiveShadow>
        <coneGeometry args={[R, h, 4, 1]} />
      </mesh>
      <mesh geometry={snow.g} position-y={h + 0.06 - snow.hs / 2} material={MAT.snow} castShadow />
    </group>
  );
}

/** Коническая крыша круглой башенки со снежной шапкой из общего набора снега. */
export function ConeRoof({ p, r, h, mat = MAT.roofIron, seed = 1 }: { p: V3; r: number; h: number; mat?: THREE.Material; seed?: number }) {
  const cap = useMemo(() => snowConeCap(r, h, 0.82, seed), [r, h, seed]);
  return (
    <group position={p}>
      <mesh position-y={h / 2} material={mat} castShadow receiveShadow>
        <coneGeometry args={[r, h, 12]} />
      </mesh>
      <mesh geometry={cap} position-y={h / 2} material={MAT.snow} castShadow />
    </group>
  );
}

// ---------- рога, кость, детали ----------

/** Череп с рогами: смотрит на +x, рога идут вверх и в стороны (по z), три отростка на каждом. */
export function Antlers({ p, k = 1, crown = false }: { p: V3; k?: number; crown?: boolean }) {
  const horns = useMemo(() => {
    const main: V3[] = [[0, 0.04, 0.06], [-0.04, 0.17, 0.15], [-0.05, 0.33, 0.23], [0, 0.49, 0.27], [0.07, 0.62, 0.24]];
    const tines: V3[][] = [
      [main[1]!, [0.05, 0.25, 0.17], [0.11, 0.3, 0.17]],
      [main[2]!, [0.05, 0.41, 0.27], [0.12, 0.5, 0.29]],
      [main[3]!, [0.02, 0.6, 0.32], [-0.04, 0.7, 0.34]],
      [main[4]!, [0.1, 0.72, 0.26], [0.13, 0.82, 0.25]],
    ];
    const parts: THREE.BufferGeometry[] = [];
    for (const sg of [1, -1]) {
      const m = (v: V3) => new THREE.Vector3(v[0], v[1], v[2] * sg);
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(main.map(m)), 14, 0.03, 6));
      for (const tn of tines) parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tn.map(m)), 6, 0.017, 5));
    }
    return mergeGeometries(parts)!;
  }, []);
  return (
    <group position={p} scale={k}>
      {!crown && (
        <group>
          <mesh scale={[1.2, 0.85, 0.9]} material={MAT.bone} castShadow>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
          <mesh position={[0.12, -0.03, 0]} rotation-z={-Math.PI / 2 + 0.2} material={MAT.bone} castShadow>
            <coneGeometry args={[0.055, 0.17, 7]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.09, 0.02, s * 0.06]} material={MAT.door}>
              <sphereGeometry args={[0.022, 6, 5]} />
            </mesh>
          ))}
        </group>
      )}
      <mesh geometry={horns} material={MAT.bone} castShadow />
    </group>
  );
}

/** Рёберная арка у входа: n рёбер подряд вглубь, пролёт 2·hw, высота h. Перед стеной на x. */
export function RibArch({ x, hw, h, n = 3, lean = 0.12 }: { x: number; hw: number; h: number; n?: number; lean?: number }) {
  const geos = useMemo(() => {
    return Array.from({ length: n }, (_, i) => {
      const w = hw * (1 - 0.08 * i);
      const hh = h * (1 - 0.1 * i);
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 12; t++) {
        const th = (t / 12) * Math.PI;
        pts.push(new THREE.Vector3(i * 0.14 + Math.sin(th) * lean, Math.sin(th) * hh * 0.98, -Math.cos(th) * w));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.052, 6);
    });
  }, [hw, h, n, lean]);
  return (
    <group position={[x, 0, 0]}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.bone} castShadow />
      ))}
      <mesh position={[0.03, h * 0.98, 0]} material={MAT.bone} castShadow>
        <sphereGeometry args={[0.1, 8, 6]} />
      </mesh>
    </group>
  );
}

/** Окно в стене, смотрящей по оси: `face` — куда смотрит (+x, −x, +z, −z). */
export function Win({ p, face, s = [0.3, 0.42], lit = false }: { p: V3; face: "x" | "-x" | "z" | "-z"; s?: [number, number]; lit?: boolean }) {
  const rotY = face === "x" ? Math.PI / 2 : face === "-x" ? -Math.PI / 2 : face === "z" ? 0 : Math.PI;
  return (
    <group position={p} rotation-y={rotY}>
      <Box p={[0, 0, 0]} s={[s[0] + 0.1, s[1] + 0.1, 0.05]} m={MAT.frame} cast={false} />
      <Box p={[0, 0, 0.03]} s={[s[0], s[1], 0.03]} m={lit ? MAT.glass : MAT.door} cast={false} />
      <Box p={[0, 0, 0.05]} s={[0.03, s[1], 0.02]} m={MAT.plankDark} cast={false} />
      <Box p={[0, 0, 0.05]} s={[s[0], 0.03, 0.02]} m={MAT.plankDark} cast={false} />
    </group>
  );
}

/** Дверь: ставится перед стеной на +x, центр по z = 0. */
export function Door({ x, w = 0.62, h = 1.15, iron = false }: { x: number; w?: number; h?: number; iron?: boolean }) {
  return (
    <group position={[x, h / 2, 0]}>
      <Box p={[0, 0, 0]} s={[0.07, h, w]} m={MAT.door} />
      {iron && [-0.32, 0.32].map((dy, i) => <Box key={i} p={[0.05, dy * h, 0]} s={[0.03, 0.08, w]} m={MAT.iron} cast={false} />)}
      <Box p={[0.04, 0, 0]} s={[0.04, h + 0.1, w + 0.1]} m={MAT.plankDark} cast={false} />
    </group>
  );
}

/** Каменная труба и дымок. */
export function Chimney({ p, h, w = 0.34 }: { p: V3; h: number; w?: number }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const q = (t * 0.2 + i / 5) % 1;
      m.position.set(Math.sin((q + i) * 4) * 0.08, h + 0.2 + q * 1.8, 0);
      m.scale.setScalar(0.4 + q * 1.3);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - q);
    });
  });
  return (
    <group position={p}>
      <Box p={[0, h / 2, 0]} s={[w, h, w]} m={MAT.stone} />
      <Box p={[0, h + 0.03, 0]} s={[w + 0.08, 0.07, w + 0.08]} m={MAT.stoneDark} />
      <mesh position-y={h + 0.1} geometry={useMemo(() => snowBlob(w * 0.62, 0.1, 5), [w])} material={MAT.snow} />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m; }} material={MAT.smoke.clone()}>
          <sphereGeometry args={[0.16, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** Каменное основание/этаж с угловыми квадрами и (по желанию) железными обручами. */
export function StoneBlock({ y0, h, w, d, bands = false, quoins = true }: { y0: number; h: number; w: number; d: number; bands?: boolean; quoins?: boolean }) {
  const bandYs = bands ? [0.28, 0.62, 0.92].map((f) => y0 + h * f) : [];
  return (
    <group>
      <Box p={[0, y0 + h / 2, 0]} s={[w, h, d]} m={MAT.stone} />
      {quoins &&
        [-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) =>
            Array.from({ length: Math.round(h / 0.34) }, (_, i) => (
              <Box key={`${sx}${sz}${i}`} p={[(sx * (w - 0.02)) / 2, y0 + 0.17 + i * 0.34, (sz * (d - 0.02)) / 2]} s={[i % 2 ? 0.3 : 0.22, 0.32, i % 2 ? 0.22 : 0.3]} m={MAT.quoin} cast={false} />
            )),
          ),
        )}
      {bandYs.map((by) => (
        <group key={by}>
          <Box p={[0, by, 0]} s={[w + 0.05, 0.07, d + 0.05]} m={MAT.iron} cast={false} />
        </group>
      ))}
    </group>
  );
}

/** Сугроб у основания (на земле у стены), чтобы здание «стояло» в снегу. */
export function SnowDrift({ p, r = 0.4, h = 0.16, seed = 3 }: { p: V3; r?: number; h?: number; seed?: number }) {
  const g = useMemo(() => snowBlob(r, h, seed), [r, h, seed]);
  return <mesh geometry={g} position={p} material={MAT.snow} receiveShadow />;
}

/** Дощатые стены: коробка и вертикальные рейки, чтобы доски читались издали. Центр основания в (0, y0, 0). */
export function PlankWalls({ w, d, y0, h, mat = MAT.plank, gap = 0.3 }: { w: number; d: number; y0: number; h: number; mat?: THREE.Material; gap?: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const bh = h - 0.16;
    for (let x = -w / 2 + gap; x < w / 2 - gap / 2; x += gap) {
      for (const sz of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.055, bh, 0.035);
        g.translate(x, y0 + h / 2, (sz * (d + 0.02)) / 2);
        parts.push(g);
      }
    }
    for (let z = -d / 2 + gap; z < d / 2 - gap / 2; z += gap) {
      for (const sx of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.035, bh, 0.055);
        g.translate((sx * (w + 0.02)) / 2, y0 + h / 2, z);
        parts.push(g);
      }
    }
    return mergeGeometries(parts)!;
  }, [w, d, y0, h, gap]);
  return (
    <group>
      <Box p={[0, y0 + h / 2, 0]} s={[w, h, d]} m={mat} />
      <mesh geometry={geo} material={MAT.plankDark} castShadow />
    </group>
  );
}
