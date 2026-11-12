/**
 * Сцена двора в клиенте (Slice B1 — корневая композиция извлечённых модулей).
 *
 * Тёплый low-poly в палитре Bone-Wood №05: Ратуша, частокол с воротами,
 * снег, ели, дым, флажок. Камера игровая: пан, зум, свободный поворот
 * с ограничениями. Инстансинг и предел dpr — под слабые телефоны TG Mini App.
 * Без WebGL — запасной кадр и подсказка (решение круга 8).
 */

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { CitadelRenderer, type CitadelRenderVariant } from "./buildings/citadel/CitadelRenderer.js";
import { Buildings, Dust } from "./buildings/legacy/LegacyBuildings.js";
import { ACCENT_COLORS, C } from "./materials/palette.js";
import { DEFAULT_QUALITY_PROFILE } from "./performance/qualityProfiles.js";
import { CourtCamera } from "./scene/CourtCamera.js";
import { CourtEnvironment } from "./scene/CourtEnvironment.js";
import { CourtInteraction, type CourtPending, type CourtTool } from "./scene/CourtInteraction.js";
import { WebglFallback, webglAvailable } from "./scene/WebglFallback.js";
import { footprintCenterToWorld, type CourtGridLite } from "./scene/gridMath.js";

/** Сетка двора из вида: то, что отдаёт модуль court. */
export type { CourtGridLite, CourtPending, CourtTool, CitadelRenderVariant };

export function CourtScene({
  texts,
  grid,
  thLevel = 1,
  citadelVariant = "citadel",
  tool,
  pending,
  onTarget,
  onRoad,
  onPickup,
}: {
  texts: { rotate: string; nowebgl: string };
  grid: CourtGridLite | null;
  thLevel?: number;
  citadelVariant?: CitadelRenderVariant;
  tool: CourtTool;
  pending: CourtPending | null;
  onTarget: (x: number, z: number) => void;
  onRoad: (x: number, z: number, has: boolean) => void;
  onPickup: (type: string, x: number, z: number) => void;
}) {
  const [webgl] = useState(webglAvailable);
  // пыль постановки: краткие веера под новыми постройками
  const [bursts, setBursts] = useState<{ key: string; x: number; z: number }[]>([]);
  const prevKeys = useRef<Set<string> | null>(null);
  const quality = DEFAULT_QUALITY_PROFILE;

  useEffect(() => {
    if (!grid) return;
    const keys = new Set(grid.buildings.map((b) => `${b.type}:${b.x}:${b.z}`));
    const prev = prevKeys.current;
    prevKeys.current = keys;
    if (!prev) return; // первая загрузка — просто рисуем двор
    const added = grid.buildings.find((b) => !prev.has(`${b.type}:${b.x}:${b.z}`));
    if (!added) return;
    const { wx: x, wz: z } = footprintCenterToWorld(added.type, added.x, added.z, grid.size);
    setBursts((list) => [...list, { key: `${added.type}:${added.x}:${added.z}:${Date.now()}`, x, z }]);
  }, [grid]);

  if (!webgl) {
    return <WebglFallback message={texts.nowebgl} />;
  }

  const resolvedGrid = grid ?? { size: 14, buildings: [], roads: [] };

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        shadows={quality.shadows}
        dpr={quality.dpr}
        gl={quality.gl}
        onCreated={({ gl }) => {
          gl.toneMapping = quality.toneMapping;
          gl.toneMappingExposure = quality.toneMappingExposure;
        }}
        // near/far сжаты ради точности depth-буфера на мобильных (круг 9)
        camera={quality.camera}
      >
        <color attach="background" args={[C.sky]} />
        <fog attach="fog" args={[C.fogFar, 42, 100]} />
        <hemisphereLight args={[ACCENT_COLORS.hemiSky, ACCENT_COLORS.hemiGround, 0.9]} />
        <directionalLight
          color={ACCENT_COLORS.sunLight}
          intensity={2.0}
          position={[16, 22, 8]}
          castShadow
          shadow-mapSize={quality.directionalShadow.mapSize}
          shadow-camera-left={quality.directionalShadow.cameraLeft}
          shadow-camera-right={quality.directionalShadow.cameraRight}
          shadow-camera-top={quality.directionalShadow.cameraTop}
          shadow-camera-bottom={quality.directionalShadow.cameraBottom}
          shadow-bias={quality.directionalShadow.bias}
          shadow-normalBias={quality.directionalShadow.normalBias}
        />
        <CourtCamera />
        <CourtEnvironment grid={grid} />
        <Buildings grid={resolvedGrid} />
        <CitadelRenderer level={thLevel} grid={resolvedGrid} variant={citadelVariant} />
        {bursts.map((b) => (
          <Dust key={b.key} x={b.x} z={b.z} onDone={() => setBursts((list) => list.filter((e) => e.key !== b.key))} />
        ))}
        {grid ? (
          <CourtInteraction grid={grid} tool={tool} pending={pending} onTarget={onTarget} onRoad={onRoad} onPickup={onPickup} />
        ) : null}
      </Canvas>
    </div>
  );
}
