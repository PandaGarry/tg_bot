import { Application, Container, Graphics } from "pixi.js";
import { bridge } from "../bridge.js";
import type { StateUpdate } from "../bridge.js";
import { CourtCamera } from "./camera.js";
import { createBuilding, hitBuilding } from "./building.js";
import { drawGhost } from "./ghost.js";
import { CourtInput } from "./input.js";
import { screenToCell } from "./isometric.js";
import { drawRoads, drawTileMap } from "./tileMap.js";
import { DEFAULT_COURT_SIZE, type CourtBuilding, type CourtGrid, type CourtSceneMode, type CourtState } from "./types.js";

const EMPTY_GRID: CourtGrid = { size: DEFAULT_COURT_SIZE, buildings: [], roads: [] };
const INITIAL_MODE: CourtSceneMode = { active: false, placing: null, roadTool: false, pending: null };

/** PixiJS-сцена двора: отдельна от React, обновляется и отдаёт ввод только через bridge. */
export class CourtScene {
  private readonly root = new Container();
  private readonly ground = new Graphics();
  private readonly roads = new Graphics();
  private readonly buildings = new Container();
  private readonly preview = new Graphics();
  private readonly camera: CourtCamera;
  private readonly input: CourtInput;
  private readonly unsubscribeState: () => void;
  private readonly unsubscribeMode: () => void;
  private readonly onResizeBound: () => void;
  private grid: CourtGrid = EMPTY_GRID;
  private townhallLevel = 1;
  private mode: CourtSceneMode = INITIAL_MODE;
  private hover: { x: number; z: number } | null = null;

  constructor(private readonly app: Application) {
    this.root.label = "court-scene";
    this.root.visible = false;
    this.root.sortableChildren = true;
    this.buildings.sortableChildren = true;
    this.root.addChild(this.ground, this.roads, this.buildings, this.preview);
    this.app.stage.addChild(this.root);

    this.camera = new CourtCamera(this.root);
    this.input = new CourtInput(
      app.canvas,
      this.camera,
      (point) => this.handleTap(point),
      (point) => this.handleHover(point),
    );
    this.onResizeBound = () => this.resize();
    window.addEventListener("resize", this.onResizeBound);
    window.addEventListener("orientationchange", this.onResizeBound);

    // Bridge replays the last state/mode when the Pixi scene starts after React.
    this.unsubscribeState = bridge.on("state:update", (payload) => this.updateState(payload));
    this.unsubscribeMode = bridge.on("scene:mode", (mode) => this.updateMode(mode));

    this.resize();
    this.redraw();
  }

  destroy(): void {
    this.input.destroy();
    this.unsubscribeState();
    this.unsubscribeMode();
    window.removeEventListener("resize", this.onResizeBound);
    window.removeEventListener("orientationchange", this.onResizeBound);
    this.app.stage.removeChild(this.root);
    this.root.destroy({ children: true });
  }

  private updateState(payload: StateUpdate): void {
    const state = isRecord(payload.court) ? (payload.court as CourtState) : {};
    const grid = normalizeGrid(state.grid);
    this.grid = grid;
    this.townhallLevel = Number.isInteger(state.townhallLevel) ? Math.max(1, Number(state.townhallLevel)) : 1;
    const viewport = this.viewportSize();
    this.camera.resize(viewport.width, viewport.height, grid.size);
    this.redraw();
  }

  private updateMode(mode: CourtSceneMode): void {
    this.mode = mode;
    this.root.visible = mode.active;
    this.drawPreview();
  }

  private resize(): void {
    const viewport = this.viewportSize();
    this.camera.resize(viewport.width, viewport.height, this.grid.size);
    this.drawPreview();
  }

  private viewportSize(): { width: number; height: number } {
    const container = this.app.canvas.parentElement;
    return {
      width: container?.clientWidth || this.app.screen.width,
      height: container?.clientHeight || this.app.screen.height,
    };
  }

  private redraw(): void {
    drawTileMap(this.ground, this.grid.size);
    drawRoads(this.roads, this.grid.roads, this.grid.size);
    this.clearBuildings();
    for (const building of this.grid.buildings) {
      const sprite = createBuilding(building, this.grid.size, this.townhallLevel);
      this.buildings.addChild(sprite);
    }
    this.drawPreview();
  }

  private clearBuildings(): void {
    for (const child of this.buildings.removeChildren()) child.destroy({ children: true });
  }

  private handleHover(point: { x: number; y: number }): void {
    const local = this.camera.toLocal(point);
    this.hover = screenToCell(local.x, local.y, this.grid.size);
    this.drawPreview();
  }

  private handleTap(point: { x: number; y: number }): void {
    const local = this.camera.toLocal(point);
    const cell = screenToCell(local.x, local.y, this.grid.size);
    if (!cell) return;

    if (this.mode.placing || this.mode.roadTool || this.mode.pending?.from) {
      bridge.emit("tile:click", cell);
      return;
    }

    const building = [...this.grid.buildings]
      .sort((a, b) => depth(b) - depth(a))
      .find((candidate) => hitBuilding(candidate, local, this.grid.size));
    if (building) {
      bridge.emit("building:click", {
        id: `${building.type}:${building.x}:${building.z}`,
        type: building.type,
        x: building.x,
        z: building.z,
      });
      return;
    }
    bridge.emit("tile:click", cell);
  }

  private drawPreview(): void {
    drawGhost(this.preview, this.grid, this.grid.size, this.mode, this.hover);
  }
}

let mountedScene: CourtScene | null = null;
let mountedApp: Application | null = null;

/** Монтирует одну сцену на приложение; удобно для HMR и тестового teardown. */
export function mountCourtScene(app: Application): () => void {
  if (mountedApp === app && mountedScene) return () => undefined;
  mountedScene?.destroy();
  mountedApp = app;
  mountedScene = new CourtScene(app);
  return () => {
    if (mountedApp !== app) return;
    mountedScene?.destroy();
    mountedScene = null;
    mountedApp = null;
  };
}

function normalizeGrid(value: unknown): CourtGrid {
  if (!isRecord(value)) return EMPTY_GRID;
  const size = Number(value.size);
  if (!Number.isInteger(size) || size < 1 || size > 40) return EMPTY_GRID;
  const buildings = Array.isArray(value.buildings)
    ? value.buildings.filter(isBuilding).filter((building) => inside(building, size))
    : [];
  const roads = Array.isArray(value.roads)
    ? value.roads.filter(isCell).filter((road) => inside(road, size))
    : [];
  return { size, buildings, roads };
}

function isBuilding(value: unknown): value is CourtBuilding {
  return isRecord(value)
    && typeof value.type === "string"
    && value.type.length > 0
    && Number.isInteger(value.x)
    && Number.isInteger(value.z);
}

function isCell(value: unknown): value is { x: number; z: number } {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.z);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inside(cell: { x: number; z: number }, size: number): boolean {
  return cell.x >= 0 && cell.z >= 0 && cell.x < size && cell.z < size;
}

function depth(building: CourtBuilding): number {
  return building.x + building.z;
}
