/**
 * Ворота: два бревенчатых столба с перекладиной-брусом, подкосами и створками из брёвен.
 * Внешний вид зависит от уровня: 1 — простое дерево, 2 — окованное железом с фонарём,
 * 3 — каменные основания, кровля и знамя. Ступеней можно добавлять без правок ядра.
 *
 * Всё из круглого бревна на коре, снег — мягкие шапки (snow.ts). Детали не делят общих граней:
 * иначе на телефоне поверхности «мерцают» (z-fighting).
 */

import { useMemo } from "react";
import { C, GATE_HALF, LanternFlame, PLOT, SURFACE, WINTER, tiled, useSeasonTextures } from "../kit.js";
import { snowMound, snowRidge } from "../snow.js";
import type { GateProps } from "../types.js";

/** Уровень ядра → ступень внешнего вида (1..3). */
export function gateTier(level: number): 1 | 2 | 3 {
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

const POST_Z = GATE_HALF + 0.22;
const POST_R = 0.19;
const iron = <meshStandardMaterial color="#2f2b27" metalness={0.5} roughness={0.55} />;
const snowMat = <meshStandardMaterial color="#f6f5f0" roughness={0.92} />;

export function Gate({ level }: GateProps) {
  const tier = gateTier(level);
  const tex = useSeasonTextures(WINTER);
  const postH = tier === 3 ? 2.55 : tier === 2 ? 2.3 : 2.1;
  const baseH = tier === 3 ? 0.45 : 0;
  const beamLen = POST_Z * 2 + 0.9;

  // шапки: на столбах — холм, на брусе — вытянутый вал вдоль всего бруса
  const caps = useMemo(
    () => ({
      post: snowMound(0.27, 0.22, 61, 12),
      beam: snowRidge(beamLen - 0.3, 0.19, 0.12, 63),
      roof: snowRidge(beamLen + 0.1, 0.4, 0.16, 65),
    }),
    [beamLen],
  );

  /** Кора: общая текстура сезона; пока не загрузилась — процедурная. */
  const bark = (color = "#ffffff", rx = 1, ry = 1.2) =>
    tex ? (
      <meshStandardMaterial key="tex" color={color} map={tiled(tex.bark, rx, ry)} bumpMap={tiled(tex.bark, rx, ry)} bumpScale={0.05} roughness={0.97} />
    ) : (
      <meshStandardMaterial key="plain" color={C.gate} map={SURFACE.wood.color} bumpMap={SURFACE.wood.bump} bumpScale={0.02} roughness={0.95} flatShading />
    );

  return (
    <group position={[PLOT, 0, 0]}>
      {[-1, 1].map((s) => (
        <group key={`post${s}`} position={[0, 0, s * POST_Z]}>
          {tier === 3 ? (
            <mesh position-y={baseH / 2 + 0.08} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.46, baseH, 8]} />
              <meshStandardMaterial color="#8d8576" map={SURFACE.stone.color} bumpMap={SURFACE.stone.bump} bumpScale={0.03} roughness={0.96} flatShading />
            </mesh>
          ) : null}
          <mesh position-y={baseH + 0.08 + (postH - baseH) / 2} castShadow receiveShadow>
            <cylinderGeometry args={[POST_R, POST_R * 1.18, postH - baseH, 9]} />
            {bark("#e4ceb6", 1.2, 1.8)}
          </mesh>
          {tier >= 2
            ? [0.55, 1.2, 1.8].map((y) => (
                <mesh key={y} position-y={baseH + y} castShadow>
                  <cylinderGeometry args={[POST_R + 0.025, POST_R + 0.025, 0.07, 9]} />
                  {iron}
                </mesh>
              ))
            : null}
          {/* шапка снега над столбом: перекладина проходит ниже вершины, они не соприкасаются гранями */}
          <mesh geometry={caps.post} position-y={postH + 0.1} castShadow receiveShadow>
            {snowMat}
          </mesh>
        </group>
      ))}

      {/* брус: круглое бревно, концы выступают за столбы */}
      <mesh position={[0, postH - 0.28, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, beamLen, 9]} />
        {bark("#d9c2a8", 0.9, 4)}
      </mesh>
      {/* снежный вал на брусе (вытянутая шапка) */}
      <mesh geometry={caps.beam} position={[0, postH - 0.17, 0]} castShadow receiveShadow>
        {snowMat}
      </mesh>
      {/* подкосы под брусом: ворота читаются «бревенчатым срубом», а не коробкой */}
      {[-1, 1].map((s) => (
        <mesh key={`brace${s}`} position={[0, postH - 0.85, s * (GATE_HALF - 0.05)]} rotation-x={-s * Math.PI / 4} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.85, 7]} />
          {bark("#cdb59a", 0.5, 1)}
        </mesh>
      ))}

      {tier === 3 ? (
        <>
          {[-1, 1].map((s) => (
            <group key={`roof${s}`} position={[s * 0.2, postH + 0.5, 0]} rotation-z={-s * 0.5}>
              <mesh castShadow>
                <boxGeometry args={[0.62, 0.07, beamLen + 0.3]} />
                {bark("#b89c80", 2, 0.6)}
              </mesh>
              <mesh geometry={caps.roof} position={[0, 0.03, 0]} castShadow>
                {snowMat}
              </mesh>
            </group>
          ))}
          <mesh position={[0.12, postH - 1.0, 0]} castShadow>
            <boxGeometry args={[0.035, 1.2, 0.95]} />
            <meshStandardMaterial color={C.flag} roughness={0.85} flatShading />
          </mesh>
        </>
      ) : null}
      {tier === 2 ? (
        <group position={[-0.25, 0, 0]}>
          <mesh position={[0, postH - 0.55, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 5]} />
            {iron}
          </mesh>
          <LanternFlame y={postH - 0.72} />
        </group>
      ) : null}

      {/* створки распахнуты внутрь двора и стоят вдоль частокола */}
      {[-1, 1].map((s) => (
        <group key={`leaf${s}`} position={[-0.3, 0, s * GATE_HALF]} rotation-y={s * 1.38}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[0, 0.08 + (1.7 + (i % 3) * 0.05) / 2, -s * (0.1 + i * 0.2)]} castShadow receiveShadow>
              <cylinderGeometry args={[0.1, 0.105, 1.7 + (i % 3) * 0.05, 7]} />
              {bark(i % 2 ? "#d9c2a8" : "#e8d4bd", 0.7, 1.2)}
            </mesh>
          ))}
          {[0.4, 1.4].map((y) => (
            <mesh key={y} position={[0.115, y, -s * 0.7]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 1.46, 6]} />
              {tier >= 2 ? iron : bark("#cdb59a", 0.4, 3)}
            </mesh>
          ))}
          {tier >= 2 ? (
            <mesh position={[0.16, 0.95, -s * 0.2]} rotation-y={Math.PI / 2}>
              <torusGeometry args={[0.1, 0.025, 6, 14]} />
              <meshStandardMaterial color="#d9b25a" metalness={0.55} roughness={0.35} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}
