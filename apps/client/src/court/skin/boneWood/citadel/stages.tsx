/**
 * Пять стадий Цитадели (уровни 1–5, 6–10, 11–15, 16–20, 21–25), по концептам
 * docs/game/ui/concepts/phase-05-citadel/final. Размер на земле один на всех стадиях
 * (пятно 3×3 клетки = 3.3×3.3), растёт материал и высота: дерево → дерево на камне → камень и металл.
 */

import type { BannerSpec } from "../../banner.js";
import { Banner } from "./Banner.js";
import {
  Antlers, Box, Chimney, ConeRoof, Door, GableRoof, HipRoof, LogWalls, MAT, PlankWalls, RibArch, SnowDrift, StoneBlock, Win,
} from "./parts.js";

interface StageProps {
  banner?: BannerSpec;
}

function Drifts() {
  return (
    <>
      <SnowDrift p={[1.1, 0.02, -1.62]} r={0.42} h={0.16} seed={3} />
      <SnowDrift p={[-1.55, 0.02, 1.2]} r={0.4} h={0.14} seed={9} />
      <SnowDrift p={[-1.2, 0.02, -1.62]} r={0.35} h={0.12} seed={14} />
    </>
  );
}

/** I (1–5): бревенчатая хижина. */
export function Stage1({ banner }: StageProps) {
  const w = 2.5, d = 2.3, r = 0.12, courses = 7;
  const roofY = 1.6;
  const len = w + 2 * r;
  return (
    <group>
      <LogWalls w={w} d={d} courses={courses} r={r} />
      <GableRoof y={roofY} length={len} width={d + 2 * r} rise={0.95} over={0.2} seed={2} />
      <Door x={w / 2 + r + 0.03} w={0.55} h={1.0} />
      <Win p={[0.15, 0.95, d / 2 + r + 0.02]} face="z" s={[0.28, 0.3]} />
      <Antlers p={[len / 2 + 0.03, roofY + 0.42, 0]} k={0.85} />
      <Banner p={[-len / 2 + 0.3, roofY + 0.95, 0]} pole={0.8} cloth={[0.55, 0.3]} spec={banner} />
      <Drifts />
    </group>
  );
}

/** II (6–10): деревянный зал с крыльцом, пристройкой и костяной аркой. */
export function Stage2({ banner }: StageProps) {
  const cx = -0.15, w = 2.7, d = 2.0, h = 1.65;
  return (
    <group>
      <group position={[cx, 0, 0]}><PlankWalls w={w} d={d} y0={0} h={h} /></group>
      <Box p={[cx, 0.1, 0]} s={[w + 0.06, 0.2, d + 0.06]} m={MAT.plankDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[cx + (sx * w) / 2, h / 2, (sz * d) / 2]} s={[0.14, h, 0.14]} m={MAT.plankDark} />))}
      <GableRoof x={cx} y={h} length={w} width={d} rise={1.2} over={0.22} seed={4} bone />
      {/* пристройка со своей крышей */}
      <group position={[-0.7, 0, 1.28]}><PlankWalls w={1.3} d={0.62} y0={0} h={1.1} /></group>
      <group position={[-0.7, 1.1, 1.3]} rotation-y={Math.PI / 2}>
        <GableRoof y={0} length={0.55} width={1.3} rise={0.5} over={0.1} seed={6} />
      </group>
      <Win p={[-0.7, 0.62, 1.6]} face="z" s={[0.3, 0.32]} />
      <Win p={[0.45, 1.0, 1.02]} face="z" s={[0.3, 0.36]} />
      {/* крыльцо и арка */}
      {[-1, 1].map((s) => <Box key={s} p={[1.5, 0.75, s * 0.58]} s={[0.1, 1.5, 0.1]} m={MAT.plankDark} />)}
      <Box p={[1.45, 0.05, 0]} s={[0.4, 0.1, 1.3]} m={MAT.stoneDark} />
      <GableRoof x={1.42} y={1.5} length={0.5} width={1.3} rise={0.42} over={0.08} seed={8} snowLen={0.9} />
      <Door x={w / 2 + cx + 0.04} w={0.6} h={1.1} />
      <RibArch x={1.4} hw={0.5} h={1.25} n={2} lean={0.05} />
      <Antlers p={[cx + w / 2 + 0.02, 2.2, 0]} k={1.0} />
      <Banner p={[cx - w / 2 + 0.2, h + 1.2 + 0.1, 0]} pole={0.9} cloth={[0.65, 0.36]} spec={banner} />
      <Drifts />
    </group>
  );
}

/** III (11–15): двухэтажный деревянный зал на низком каменном цоколе. */
export function Stage3({ banner }: StageProps) {
  const w = 2.7, d = 2.5, base = 0.3, top = 2.55;
  return (
    <group>
      <Box p={[0, base / 2, 0]} s={[3.0, base, 2.9]} m={MAT.stone} />
      <PlankWalls w={w} d={d} y0={base} h={top - base} />
      <Box p={[0, 1.55, 0]} s={[w + 0.07, 0.12, d + 0.07]} m={MAT.plankDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[(sx * w) / 2, (base + top) / 2, (sz * d) / 2]} s={[0.15, top - base, 0.15]} m={MAT.plankDark} />))}
      <GableRoof y={top} length={w} width={d} rise={1.2} over={0.2} seed={11} bone />
      {/* мезонин */}
      <Box p={[-0.5, 3.12, 1.0]} s={[0.55, 0.5, 0.5]} m={MAT.plank} />
      <group position={[-0.5, 3.37, 1.0]} rotation-y={Math.PI / 2}>
        <GableRoof y={0} length={0.5} width={0.55} rise={0.32} over={0.08} seed={12} />
      </group>
      <Win p={[-0.5, 3.1, 1.27]} face="z" s={[0.24, 0.28]} lit />
      <Chimney p={[-0.9, 2.7, -0.7]} h={1.5} />
      {/* окна */}
      {[-0.75, 0.55].map((x) => <Win key={x} p={[x, 1.0, d / 2 + 0.02]} face="z" lit />)}
      {[-0.75, 0.15].map((x) => <Win key={`u${x}`} p={[x, 2.05, d / 2 + 0.02]} face="z" lit />)}
      {[-0.9, 0.9].map((z) => <Win key={`f${z}`} p={[w / 2 + 0.02, 1.05, z]} face="x" lit />)}
      {[-0.9, 0.9].map((z) => <Win key={`g${z}`} p={[w / 2 + 0.02, 2.1, z]} face="x" lit />)}
      {/* вход, арка и балкон */}
      <group position-y={base}>
        <Door x={w / 2 + 0.04} w={0.66} h={1.2} />
        <RibArch x={1.36} hw={0.62} h={1.45} n={3} lean={0.06} />
      </group>
      <Box p={[1.5, 1.95, 0]} s={[0.3, 0.07, 0.95]} m={MAT.plankDark} />
      <Box p={[1.64, 2.2, 0]} s={[0.04, 0.06, 0.95]} m={MAT.plankDark} />
      {[-0.46, 0, 0.46].map((z) => <Box key={z} p={[1.64, 2.08, z]} s={[0.04, 0.26, 0.04]} m={MAT.plankDark} />)}
      <Box p={[w / 2 + 0.03, 2.3, 0]} s={[0.06, 0.8, 0.46]} m={MAT.door} />
      <Antlers p={[w / 2 + 0.02, 3.05, 0]} k={1.1} />
      <group position={[-w / 2 - 0.02, 0, 0]} rotation-y={Math.PI}><Antlers p={[0, 3.05, 0]} k={0.95} /></group>
      <Banner p={[-1.2, top + 1.25, 0]} pole={1.0} cloth={[0.75, 0.4]} spec={banner} />
      <Drifts />
    </group>
  );
}

/** IV (16–20): каменный первый этаж, деревянный второй, квадратная башня. */
export function Stage4({ banner }: StageProps) {
  return (
    <group>
      <StoneBlock y0={0} h={1.35} w={2.9} d={2.9} />
      <PlankWalls w={2.7} d={2.7} y0={1.35} h={1.15} />
      <Box p={[0, 1.38, 0]} s={[2.78, 0.1, 2.78]} m={MAT.plankDark} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * 1.35, 1.925, sz * 1.35]} s={[0.15, 1.15, 0.15]} m={MAT.plankDark} />))}
      <GableRoof y={2.5} length={2.7} width={2.7} rise={1.05} over={0.22} seed={21} bone />
      {/* башня */}
      <group position={[-0.35, 0, 0]}><PlankWalls w={1.2} d={1.2} y0={2.0} h={2.1} /></group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`t${sx}${sz}`} p={[-0.35 + sx * 0.6, 3.05, sz * 0.6]} s={[0.14, 2.1, 0.14]} m={MAT.plankDark} />))}
      <Box p={[-0.35, 3.55, 0]} s={[1.26, 0.09, 1.26]} m={MAT.plankDark} />
      <Win p={[0.26, 3.2, 0]} face="x" s={[0.22, 0.4]} lit />
      <Win p={[-0.35, 3.2, 0.61]} face="z" s={[0.22, 0.4]} lit />
      <HipRoof p={[-0.35, 4.1, 0]} base={1.7} h={0.95} />
      {/* окна, дверь, арка */}
      {[-0.8, 0.6].map((x) => <Win key={x} p={[x, 0.85, 1.46]} face="z" s={[0.18, 0.4]} lit />)}
      {[-0.7, 0.35].map((x) => <Win key={`u${x}`} p={[x, 1.95, 1.36]} face="z" s={[0.24, 0.34]} lit />)}
      {[-0.95, 0.95].map((z) => <Win key={`f${z}`} p={[1.46, 0.85, z]} face="x" s={[0.18, 0.4]} lit />)}
      <Door x={1.47} w={0.7} h={1.25} iron />
      <RibArch x={1.36} hw={0.62} h={1.55} n={3} lean={0.06} />
      <Antlers p={[1.37, 2.95, 0]} k={0.95} />
      <Banner p={[-0.35, 5.0, 0]} pole={1.0} cloth={[0.85, 0.45]} spec={banner} />
      <Drifts />
    </group>
  );
}

/** V (21–25): каменная крепость с железными обручами, шпилем и угловыми башенками. */
export function Stage5({ banner }: StageProps) {
  return (
    <group>
      <StoneBlock y0={0} h={2.3} w={2.9} d={2.9} bands quoins={false} />
      <GableRoof y={2.3} length={2.9} width={2.6} rise={1.0} over={0.2} mat={MAT.roofIron} gable={MAT.stone} seed={31} bone />
      {/* угловые башенки */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 1.25, 0, sz * 1.25]}>
            <mesh position-y={1.55} material={MAT.stone} castShadow receiveShadow>
              <cylinderGeometry args={[0.38, 0.4, 3.1, 10]} />
            </mesh>
            {[0.9, 2.1].map((y) => (
              <mesh key={y} position-y={y} material={MAT.iron} castShadow>
                <cylinderGeometry args={[0.41, 0.41, 0.07, 10]} />
              </mesh>
            ))}
            <ConeRoof p={[0, 3.1, 0]} r={0.5} h={0.85} seed={sx * 3 + sz + 20} />
          </group>
        )),
      )}
      {/* центральная башня со шпилем */}
      <Box p={[-0.35, 3.2, 0]} s={[1.3, 2.4, 1.3]} m={MAT.stone} />
      {[2.6, 3.4, 4.1].map((y) => <Box key={y} p={[-0.35, y, 0]} s={[1.36, 0.07, 1.36]} m={MAT.iron} cast={false} />)}
      <Win p={[0.31, 3.4, 0]} face="x" s={[0.16, 0.5]} lit />
      <Win p={[-0.35, 3.4, 0.66]} face="z" s={[0.16, 0.5]} lit />
      <HipRoof p={[-0.35, 4.4, 0]} base={1.7} h={1.7} mat={MAT.roofIron} cover={0.62} />
      <Antlers p={[-0.35, 6.1, 0]} k={1.3} crown />
      {/* окна-бойницы, ворота и арка */}
      {[-0.8, 0.4].map((x) => <Win key={x} p={[x, 1.5, 1.46]} face="z" s={[0.15, 0.5]} lit />)}
      {[-0.95, 0.95].map((z) => <Win key={`f${z}`} p={[1.46, 1.5, z]} face="x" s={[0.15, 0.5]} lit />)}
      <Door x={1.47} w={0.8} h={1.5} iron />
      <RibArch x={1.36} hw={0.7} h={1.8} n={3} lean={0.06} />
      <Banner p={[-1.25, 3.9, -1.25]} pole={1.3} cloth={[1.0, 0.55]} spec={banner} />
      <Drifts />
    </group>
  );
}

export const STAGES = [Stage1, Stage2, Stage3, Stage4, Stage5] as const;
