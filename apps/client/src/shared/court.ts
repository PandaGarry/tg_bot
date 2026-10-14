/** DTO двора и режим отображения, общие для Pixi-сцены и React-HUD. */
export interface CourtCell {
  x: number;
  z: number;
}

export interface CourtBuilding extends CourtCell {
  type: string;
}

export interface CourtRoad extends CourtCell {}

export interface CourtGrid {
  size: number;
  buildings: CourtBuilding[];
  roads: CourtRoad[];
}

export interface CourtState {
  grid?: CourtGrid;
  townhallLevel?: number;
}

export interface CourtPendingPlacement extends CourtCell {
  type: string;
  from?: CourtCell;
}

/** Эфемерный режим HUD: только подсказка/призрак, не авторитетное состояние игры. */
export interface CourtSceneMode {
  active: boolean;
  placing: string | null;
  roadTool: boolean;
  pending: CourtPendingPlacement | null;
}
