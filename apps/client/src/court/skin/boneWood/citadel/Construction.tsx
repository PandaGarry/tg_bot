/**
 * Стройка на здании: молот на столбе бьёт по стене, поднимается пыль, над зданием висит
 * компактная плашка с таймером и полосой прогресса. Ничего не знает о Цитадели: берёт только
 * прогресс улучшения и «площадку» (где стена, на какой высоте плашка), поэтому подходит любому зданию.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { formatDuration } from "../../duration.js";
import type { UpgradeProgress } from "../../types.js";
import { Box, MAT } from "./parts.js";

export interface ConstructionSite {
  /** Лицо стены (x), по которому бьёт молот. */
  wallX: number;
  /** Положение молота вдоль стены (z). */
  z: number;
  /** Высота плашки с таймером над землёй. */
  labelY: number;
}

const W = 340;
const H = 92;

function draw(g: CanvasRenderingContext2D, text: string, progress: number) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = "rgba(48,33,22,0.95)";
  g.strokeStyle = "#e8dec6";
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(4, 4, W - 8, H - 8, 18);
  g.fill();
  g.stroke();
  // молоточек
  g.save();
  g.translate(44, H / 2 - 4);
  g.rotate(-0.7);
  g.fillStyle = "#e8dec6";
  g.fillRect(-3.5, -16, 7, 38);
  g.fillStyle = "#cfc6b0";
  g.fillRect(-15, -24, 30, 13);
  g.restore();
  g.fillStyle = "#f4eddc";
  g.font = "bold 36px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 196, H / 2 - 7);
  // полоса прогресса
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.fillRect(78, H - 24, W - 104, 8);
  g.fillStyle = "#e8dec6";
  g.fillRect(78, H - 24, (W - 104) * Math.min(1, Math.max(0, progress)), 8);
}

const dayLabel = () => (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ru") ? "д" : "d");

function TimerLabel({ upgrade, y }: { upgrade: UpgradeProgress; y: number }) {
  const { sprite, g, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.7, (1.7 * H) / W, 1);
    sp.renderOrder = 30;
    return { sprite: sp, g: ctx, tex: t };
  }, []);
  const last = useRef(-1);
  useEffect(() => () => {
    tex.dispose();
    (sprite.material as THREE.Material).dispose();
  }, [tex, sprite]);
  useFrame(() => {
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    if (sec === last.current) return;
    last.current = sec;
    const total = Math.max(1, upgrade.endsAt - upgrade.startedAt);
    draw(g, formatDuration(upgrade.endsAt - now, dayLabel()), (now - upgrade.startedAt) / total);
    tex.needsUpdate = true;
  });
  return <primitive object={sprite} position={[0, y, 0]} />;
}

/** Молот на столбе: поднимается, бьёт по стене, пыль и щепки. */
function Hammer({ wallX, z }: { wallX: number; z: number }) {
  const arm = useRef<THREE.Group>(null!);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const px = wallX + 0.5;
  const py = 1.0;
  useFrame(({ clock }) => {
    const ph = (clock.elapsedTime * 0.85) % 1;
    let a: number;
    if (ph < 0.5) a = -0.55 - 0.35 * Math.sin((ph / 0.5) * (Math.PI / 2));
    else if (ph < 0.6) a = -0.9;
    else if (ph < 0.7) a = -0.9 + 1.15 * ((ph - 0.6) / 0.1);
    else a = 0.25 - 0.8 * ((ph - 0.7) / 0.3);
    arm.current.rotation.z = a;
    const t = ph >= 0.7 ? (ph - 0.7) / 0.3 : 1;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      m.position.set(wallX + 0.1 + i * 0.05, py - 0.1 + t * (0.25 + i * 0.08), z + (i - 1) * 0.12);
      m.scale.setScalar(0.18 + t * 0.5);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - t);
    });
  });
  return (
    <group>
      <Box p={[px + 0.04, py / 2, z]} s={[0.1, py, 0.1]} m={MAT.plankDark} />
      <group ref={arm} position={[px, py, z]}>
        <Box p={[-0.27, 0, 0]} s={[0.58, 0.07, 0.07]} m={MAT.plank} />
        <Box p={[-0.55, 0, 0]} s={[0.15, 0.2, 0.17]} m={MAT.iron} />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m; }} material={MAT.smoke.clone()}>
          <sphereGeometry args={[0.5, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

export function Construction({ upgrade, site }: { upgrade: UpgradeProgress; site: ConstructionSite }) {
  return (
    <group>
      <Hammer wallX={site.wallX} z={site.z} />
      <TimerLabel upgrade={upgrade} y={site.labelY} />
    </group>
  );
}
