/**
 * Оригинальный модульный набор имперского периметра.
 * Каталог не зависит от Pixi; runtime интеграция использует те же URL и pivot metadata.
 */
export interface WallModuleDefinition {
  file: string;
  width: number;
  height: number;
  patch: number;
  tipX: number;
  tipY: number;
  role: "straight" | "corner" | "gate" | "tower";
  stage: 1;
}

export const IMPERIAL_WALL_MODULES: Readonly<Record<string, WallModuleDefinition>> = {
  corner: {
    file: "wall-imperial-corner-stage-01",
    width: 512,
    height: 448,
    patch: 432,
    tipX: 256,
    tipY: 407,
    role: "corner",
    stage: 1,
  },
  straight: {
    file: "wall-imperial-straight-stage-01",
    width: 512,
    height: 384,
    patch: 428,
    tipX: 256,
    tipY: 350,
    role: "straight",
    stage: 1,
  },
  gate: {
    file: "wall-imperial-gate-stage-01",
    width: 512,
    height: 512,
    patch: 442,
    tipX: 256,
    tipY: 471,
    role: "gate",
    stage: 1,
  },
  tower: {
    file: "wall-imperial-tower-stage-01",
    width: 512,
    height: 512,
    patch: 372,
    tipX: 256,
    tipY: 477,
    role: "tower",
    stage: 1,
  },
};

export function wallModuleUrl(id: string): string | undefined {
  const module = IMPERIAL_WALL_MODULES[id];
  return module ? `/court/sprites/${module.file}.svg` : undefined;
}
