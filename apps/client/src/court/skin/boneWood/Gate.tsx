/**
 * Ворота: два столба с перекладиной (арка) и распахнутые внутрь створки.
 * Внешний вид зависит от уровня: 1 — простое дерево, 2 — окованное железом с фонарём,
 * 3 — каменные основания, кровля и знамя. Ступеней можно добавлять без правок ядра.
 */

import { C, GATE_HALF, LanternFlame, PLOT, SURFACE } from "../kit.js";
import type { GateProps } from "../types.js";

/** Уровень ядра → ступень внешнего вида (1..3). */
export function gateTier(level: number): 1 | 2 | 3 {
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

const POST_Z = GATE_HALF + 0.2;
const wood = (color: string, bump = 0.02) => (
  <meshStandardMaterial color={color} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={bump} roughness={0.95} flatShading />
);
const snow = (
  <meshStandardMaterial color="#f4f0e7" map={SURFACE.snow.color} bumpMap={SURFACE.snow.bump} bumpScale={0.01} roughness={0.95} />
);
const iron = <meshStandardMaterial color="#2f2b27" metalness={0.5} roughness={0.55} />;

export function Gate({ level }: GateProps) {
  const tier = gateTier(level);
  const postH = tier === 3 ? 2.9 : 2.5;
  const baseH = tier === 3 ? 0.5 : 0;

  return (
    <group position={[PLOT, 0, 0]}>
      {[-1, 1].map((s) => (
        <group key={`post${s}`} position={[0, 0, s * POST_Z]}>
          {tier === 3 ? (
            <mesh position-y={baseH / 2 + 0.08} castShadow receiveShadow>
              <boxGeometry args={[0.8, baseH, 0.8]} />
              <meshStandardMaterial color="#8d8576" map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.03} roughness={0.96} flatShading />
            </mesh>
          ) : null}
          <mesh position-y={baseH + 0.08 + (postH - baseH) / 2} castShadow receiveShadow>
            <boxGeometry args={[0.5, postH - baseH, 0.5]} />
            {wood(C.gate)}
          </mesh>
          {tier >= 2
            ? [0.55, 1.25, 1.95].map((y) => (
                <mesh key={y} position={[0, baseH + y, 0]} castShadow>
                  <boxGeometry args={[0.56, 0.08, 0.56]} />
                  {iron}
                </mesh>
              ))
            : null}
          <mesh position-y={postH + 0.14} castShadow>
            <boxGeometry args={[0.6, 0.08, 0.6]} />
            {snow}
          </mesh>
        </group>
      ))}

      {/* перекладина с прогоном: арка читается издали */}
      <mesh position={[0, postH - 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.36, POST_Z * 2 + 0.5]} />
        {wood(C.beam)}
      </mesh>
      <mesh position={[0, postH + 0.07, 0]} castShadow>
        <boxGeometry args={[0.6, 0.08, POST_Z * 2 + 0.55]} />
        {snow}
      </mesh>
      {tier === 3 ? (
        <>
          {[-1, 1].map((s) => (
            <mesh key={`roof${s}`} position={[s * 0.18, postH + 0.5, 0]} rotation-z={-s * 0.55} castShadow>
              <boxGeometry args={[0.7, 0.1, POST_Z * 2 + 0.7]} />
              {snow}
            </mesh>
          ))}
          <mesh position={[0.1, postH - 0.9, 0]} castShadow>
            <boxGeometry args={[0.04, 1.3, 1.0]} />
            <meshStandardMaterial color={C.flag} roughness={0.85} flatShading />
          </mesh>
        </>
      ) : null}
      {tier === 2 ? (
        <group position={[-0.2, 0, 0]}>
          <mesh position={[0, postH - 0.52, 0]}>
            <boxGeometry args={[0.03, 0.3, 0.03]} />
            {iron}
          </mesh>
          <LanternFlame y={postH - 0.7} />
        </group>
      ) : null}

      {/* створки распахнуты внутрь двора и стоят вдоль частокола */}
      {[-1, 1].map((s) => (
        <group key={`leaf${s}`} position={[-0.2, 0, s * GATE_HALF]} rotation-y={s * 1.38}>
          <mesh position={[0, 0.95, -s * 0.68]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 1.75, 1.36]} />
            {wood("#60452d")}
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[0.08, 0.95, -s * (0.16 + i * 0.2)]} castShadow>
              <boxGeometry args={[0.05, 1.7, 0.13]} />
              {wood(i % 2 ? C.log : C.gate, 0.018)}
            </mesh>
          ))}
          {[0.32, 1.55].map((y) => (
            <mesh key={y} position={[0.11, y, -s * 0.68]} castShadow>
              <boxGeometry args={[0.07, 0.13, 1.4]} />
              {tier >= 2 ? iron : wood(C.logTip, 0.016)}
            </mesh>
          ))}
          {tier >= 2 ? (
            <mesh position={[0.15, 0.95, -s * 0.2]} rotation-y={Math.PI / 2}>
              <torusGeometry args={[0.1, 0.025, 6, 14]} />
              <meshStandardMaterial color="#d9b25a" metalness={0.55} roughness={0.35} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}
