import { Application, Container, Graphics } from "pixi.js";
import { bridge } from "../bridge.js";
import type { StateUpdate } from "../bridge.js";
import { CourtCamera } from "./camera.js";
import { buildingDepth, createBuilding, hitBuilding, preloadBuildingSprites } from "./building.js";
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
  private readonly buildingNodes = new Map<string, Container>();
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
  private destroyed = false;
  private renderedGridSize = -1;
  private renderedRoadsSignature: string | null = null;
  private renderedBuildingsSignature = "";
  private renderedBuildingGridSize = -1;
  private renderedTownhallLevel = -1;

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
    this.destroyed = true;
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
    this.preloadBuildingTypes(this.grid.buildings.map((building) => building.type));
  }

  private updateMode(mode: CourtSceneMode): void {
    this.mode = mode;
    this.root.visible = mode.active;
    this.drawPreview();
    const activeType = mode.placing ?? mode.pending?.type;
    if (activeType) this.preloadBuildingTypes([activeType]);
  }

  private resize(): void {
    const viewport = this.viewportSize();
    this.camera.resize(viewport.width, viewport.height, this.grid.size);
    this.drawPreview();
  }

  /** Подгружает арт только для видимых/выбранных типов, не блокируя первый кадр. */
  private preloadBuildingTypes(types: readonly string[]): void {
    if (types.length === 0) return;
    void preloadBuildingSprites(types).then(() => {
      // Повторно собираем только слой зданий: грунт и дороги от загрузки PNG не меняются.
      if (!this.destroyed) this.renderBuildings(types);
    });
  }

  private viewportSize(): { width: number; height: number } {
    const container = this.app.canvas.parentElement;
    return {
      width: container?.clientWidth || this.app.screen.width,
      height: container?.clientHeight || this.app.screen.height,
    };
  }

  /**
   * Сервер присылает state:update и при изменении ресурсов. Не перерисовываем
   * 1 600 тайлов и все здания, если сам двор не изменился.
   */
  private redraw(): void {
    if (this.renderedGridSize !== this.grid.size) {
      drawTileMap(this.ground, this.grid.size);
      this.renderedGridSize = this.grid.size;
      // Размер сетки влияет на вертикальное центрирование всех слоёв.
      this.renderedRoadsSignature = null;
      this.renderedBuildingsSignature = "";
    }

    const roadsSignature = this.grid.roads.map(({ x, z }) => `${x},${z}`).join(";");
    if (roadsSignature !== this.renderedRoadsSignature) {
      drawRoads(this.roads, this.grid.roads, this.grid.size);
      this.renderedRoadsSignature = roadsSignature;
    }

    const buildingsSignature = `${this.townhallLevel}|${this.grid.buildings
      .map(({ type, x, z }) => `${type},${x},${z}`)
      .join(";")}`;
    if (buildingsSignature !== this.renderedBuildingsSignature) {
      this.renderBuildings();
      this.renderedBuildingsSignature = buildingsSignature;
    }

    this.drawPreview();
  }

  /** Обновляет только добавленные/удалённые здания; неизменные Pixi-ноды сохраняются. */
  private renderBuildings(rebuildTypes: readonly string[] = []): void {
    if (
      this.renderedBuildingGridSize !== this.grid.size
      || this.renderedTownhallLevel !== this.townhallLevel
    ) {
      this.clearBuildings();
      this.renderedBuildingGridSize = this.grid.size;
      this.renderedTownhallLevel = this.townhallLevel;
    }

    // После асинхронной загрузки PNG пересоздаём только соответствующие типы.
    if (rebuildTypes.length > 0) {
      for (const [key, node] of this.buildingNodes) {
        if (!rebuildTypes.some((type) => key.startsWith(`${type}:`))) continue;
        this.buildings.removeChild(node);
        node.destroy({ children: true });
        this.buildingNodes.delete(key);
      }
    }

    const desired = new Map(
      this.grid.buildings.map((building) => [
        `${building.type}:${building.x}:${building.z}`,
        building,
      ]),
    );

    for (const [key, node] of this.buildingNodes) {
      if (desired.has(key)) continue;
      this.buildings.removeChild(node);
      node.destroy({ children: true });
      this.buildingNodes.delete(key);
    }

    for (const [key, building] of desired) {
      if (this.buildingNodes.has(key)) continue;
      const node = createBuilding(building, this.grid.size, this.townhallLevel);
      this.buildingNodes.set(key, node);
      this.buildings.addChild(node);
    }
    this.buildings.sortChildren();
  }

  private clearBuildings(): void {
    for (const child of this.buildings.removeChildren()) child.destroy({ children: true });
    this.buildingNodes.clear();
  }

  private handleHover(point: { x: number; y: number }): void {
    const local = this.camera.toLocal(point);
    this.hover = screenToCell(local.x, local.y, this.grid.size);
    this.drawPreview();
  }

  private handleTap(point: { x: number; y: number }): void {
    const local = this.camera.toLocal(point);
    const cell = screenToCell(local.x, local.y, this.grid.size);

    if (this.mode.placing || this.mode.roadTool || this.mode.pending?.from) {
      if (cell) bridge.emit("tile:click", cell);
      return;
    }

    // Здание проверяем раньше клетки: крыша может выступать за плоскость сетки.
    const building = [...this.grid.buildings]
      .sort((a, b) => buildingDepth(b) - buildingDepth(a))
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
    if (cell) bridge.emit("tile:click", cell);
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
