# TDL-ARCH-001 — `CourtScene.tsx` Extraction Map, Contracts & Typed Registry Proposal

**Audited repository:** `PandaGarry/tg_bot`  
**Branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
**Live audited HEAD SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
**Primary target file:** `apps/client/src/court/CourtScene.tsx` (`1,926` lines)  
**Design reference:** `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md` §3 & §9  

---

## 1. Line-by-Line Responsibility Map of `CourtScene.tsx`

`apps/client/src/court/CourtScene.tsx` currently conflates **7 distinct responsibilities** in a single `1,926`-line file (`82 KB`):

| Responsibility Domain | Current Symbols & Line Range | Lines | Coupling / Side Effects | Target Destination (`TDL_VISUAL_REFACTOR_ARCHITECTURE.md`) |
|---|---|---:|---|---|
| **Palette, Seed RNG & WebGL Probe** | `PLOT`, `GATE_HALF`, `C` (`L14–45`), `rng()` (`L48–56`), `webglAvailable()` (`L58–66`) | 53 | Palette constants `C` inline Bone-Wood colors everywhere; `PLOT`/`GATE_HALF` assume static `14×14` yard | `court/materials/MaterialRegistry.ts`, `court/scene/courtConstants.ts`, `court/scene/webglProbe.ts` |
| **Camera & Navigation** | `CameraRig()` (`L70–191`) | 122 | Direct DOM pointer/wheel/gesture listeners on `gl.domElement`; clamps target `[-6, 6]`, az `π/4 ± 0.9`, pol `[0.78, 1.25]`, dist `[7, 45]`; 120Hz `getCoalescedEvents`; damping `1 - exp(-14*dt)` | `court/scene/CourtCamera.tsx` |
| **Environment, Ground, Perimeter & Ambient Life** | `Ground()` (`L195–293`), `RoadTiles()` (`L354–425`), `Gatehouse()` (`L427–514`), `Palisade()` (`L515–605`), `Trees()` (`L1677–1734`), `Birds()` (`L1736–1772`), `MeadowLife()` (`L1774–1813`) | 608 | **Leakage:** `Ground` calls `footprintKeys(grid)` and hardcodes `Math.round(x / CELL + 6.5)` (`L224,242`) instead of using `grid.size`; `Ground` creates 26 `ShapeGeometry` objects via `new THREE.ShapeGeometry` without `.dispose()` | `court/scene/CourtEnvironment.tsx` (with shared grid coordinate helper) |
| **Grid Math & Footprint Helpers** | `CELL = 1.1`, `gridToWorld()` (`L296–298`), `FOOTVIEW` (`L300–313`), `worldToCell()` (`L316–321`), `footprintKeys()` (`L324–336`), `buildingAt()` (`L339–347`) | 55 | **`FOOTVIEW` duplicates server `FOOTPRINT`** (`packages/modules/court/src/module.ts:52–57`) and adds `road: [1,1]`; mixes math with visual geometry | `court/scene/gridMath.ts` + reads footprints from shared typed registry (`@tdl/protocol`) |
| **Input, Selection, Pickup & Placement Ghost** | `GridOverlay()` (`L1361–1379`), `CourtInput()` (`L1390–1525`) | 136 | Raycasts invisible `planeGeometry` at `y=0.22`; handles 8px tap threshold, `550ms` long-press pickup (`buildingAt` + `roads`), placement validity check `free()`, ghost preview (`#7fae5a` / `#c25438` / `#d9b25a`) | `court/scene/CourtInteraction.tsx` |
| **Building Geometry, Animations & Level Variants** | `RoofBanner()` (`L608–634`), `Smoke/Windmill/SawBlade/Bucket/LanternFlame/WaveCloth` (`L641–787`), `Pad/CornerBeams/RoofSnow` (`L791–829`), `BuildingBody()` (`L830–1261`, 10 types), `RoofBannerSmall()` (`L1263–1289`), `Popped()` (`L1291–1307`), `Buildings()` (`L1309–1326`), `Dust()` (`L1328–1359`), `TownHall()` (`L1526–1675`) | 909 | `TownHall` ignores `grid` centering via `[w, h]` (hardcodes `grid.buildings.find(b => b.type === "townhall") ?? { x: 7, z: 7 }` — works only because `3×3` is centered, breaks if center changes or multiple exist); only `TownHall` supports levels (`1..5`), and levels 4–5 have no distinct geometry | `court/buildings/BuildingRenderer.tsx`, `court/buildings/BuildingRegistry.ts`, `court/buildings/legacy/*`, `court/buildings/citadel/*` |
| **Scene Root, Fallback & Burst Effects** | `CourtGridLite`, `CourtTool`, `CourtPending` (`L1816–1829`), `CourtScene()` (`L1831–1926`) | 111 | Tracks `prevKeys` diff to spawn `Dust` bursts; configures `<Canvas shadows dpr={[1, 1.75]}>`, `ACESFilmicToneMapping`, lights, and WebGL-missing fallback (`court-fallback.jpg`) | `court/scene/CourtScene.tsx` + `court/performance/qualityProfiles.ts` |

*(Plus `apps/court3d/src/App.tsx` (`485` lines) — standalone Circle 8 prototype duplicating `CameraRig`, `Ground`, `Palisade`, `TownHall`, `Trees`, `Rocks`, and `Sheep` outside `@tdl/client`.)*

---

## 2. Authoritative Gameplay State Sources & Duplicated Contracts

### Authoritative Server & Wire Contracts

1. **Server Module (`packages/modules/court/src/module.ts`):**
   - `GRID_SIZE = 14`, `CENTER = 7`, `MAX_BUILDINGS = 60` (`L18–23`)
   - `CATALOG` (`L32–49`): defines all 10 placeable types (`cottage`, `farm`, `sawmill`, `quarry`, `mine`, `barracks`, `lantern`, `bench`, `well`, `flag`) with `size: [w, h]`, `tab: "economy" | "military" | "decor"`, `th` unlock level, and `cost`.
   - `FOOTPRINT` (`L52–57`): `townhall: [3, 3]` + `PLACEABLE` sizes.
   - `TH_COSTS` (`L60–67`), `TH_MAX = 5` (`L69`).
   - **Snapshot emitted to `view.modules.court` (`L290–295`):**
     ```ts
     { starter, townhallLevel, level: townhallLevel, power, grid: { size, buildings: { type, x, z }[], roads: { x, z }[] }, holderId }
     ```
   - **Authoritative commands (`L297–590`):**
     - `court.enter` (`{}`)
     - `court.place` (`{ type, x, z }`)
     - `court.move` (`{ type, fromX, fromZ, toX, toZ }`)
     - `court.remove` (`{ type, x, z }` — strictly `CATALOG[type]?.tab === "decor"`)
     - `court.road` (`{ x, z, remove?, moveFrom? }`)
     - `court.upgrade` (`{}`)
2. **Client State & UI Wiring:**
   - `packages/protocol/src/view.ts:32–34`: `WorldViewBase.stock` and `WorldViewBase.modules: Record<ModuleId, JsonValue>`.
   - `apps/client/src/store.ts` & `apps/client/src/net.ts`: apply snapshot + RFC-style `patch` ops (`modules.court.grid`, `modules.court.townhallLevel`, `stock.*`).
   - `apps/client/src/ui/World.tsx:45–153`: reads `view.modules.court.{grid, townhallLevel}`, manages ephemeral UI state (`placing`, `roadTool`, `pending`), dispatches `sendCommand(...)`, and passes `grid`, `thLevel`, `tool`, `pending`, `onTarget`, `onRoad`, `onPickup` into `<CourtScene />`.
   - `apps/client/src/ui/Hud.tsx:69–79`: reads `view.modules.court.{level, power}` and `view.stock`.
   - `apps/client/src/ui/BuildPanel.tsx:198–268`: reads `view.stock` and `view.modules.court.townhallLevel`.

### Duplicated / Hard-Coded Contracts Found Across Files

| Contract | Location 1 (Authoritative) | Duplicate / Hard-coded Copies | Drift / Breakage Risk |
|---|---|---|---|
| **Building Footprint `[w, h]`** | `packages/modules/court/src/module.ts:52–57` (`FOOTPRINT`) | `apps/client/src/court/CourtScene.tsx:300–313` (`FOOTVIEW`, also adds `road: [1,1]`) | Adding/resizing a building requires editing two separate packages; mismatch breaks `free()` ghost vs server rejection |
| **Building Catalog & Costs** | `packages/modules/court/src/module.ts:32–49` (`CATALOG`) | `apps/client/src/ui/BuildPanel.tsx:22–33` (`CATALOG`) + inline SVG switch `Sign()` (`L62–188`) | Price/unlock drift disables button wrongly or misleads player |
| **TownHall Upgrade Costs & Max Level** | `packages/modules/court/src/module.ts:60–69` (`TH_COSTS`, `TH_MAX`) | `apps/client/src/ui/BuildPanel.tsx:52–59` (`TH_COSTS`, `TH_MAX`) | Client shows wrong cost or `TH_MAX` |
| **Removable Decor Rule** | `packages/modules/court/src/module.ts:487` (`CATALOG[input.type]?.tab !== "decor"`) | `apps/client/src/ui/World.tsx:107` (`["lantern", "bench", "well", "flag"].includes(pending.type)`) | Adding new decor item omits delete button on client |
| **Grid Size `14` & Half-Center `6.5`** | `packages/modules/court/src/module.ts:18` (`GRID_SIZE = 14`, comments note expandable to `22×22`) | `CourtScene.tsx:14` (`PLOT = 7.7`), `L224,242` (`Math.round(x / CELL + 6.5)`), `L1528` (`?? { x: 7, z: 7 }`), `L1902` (`?? { size: 14, ... }`) | Changing `grid.size` to `18` or `22` misaligns ground drifts/debris & palisade bounds |
| **Building i18n Keys** | `packages/modules/court/src/strings.ts` (`building.*`) | `apps/client/src/i18n/shell.ts` (`shell.hud.b.*` including `road`) | `BuildPanel`/`World` use `shell.hud.b.*` instead of module strings |
| **Monorepo Import Constraint** | `tools/check/boundaries.ts:90–100` | — | **`apps/client/src` CANNOT import `@tdl/module-court` directly** (`pnpm check` fails). Shared typed specs MUST live in **`@tdl/protocol`**. |

---

## 3. Minimal Proposed Typed Interfaces (Audit Proposal Only — Not Implemented)

To respect `tools/check/boundaries.ts` (`apps/client` and `@tdl/module-court` both depend on `@tdl/protocol`), split contracts cleanly into **domain metadata** (`packages/protocol`) and **visual presentation** (`apps/client/src/court`):

### A. Shared Authoritative Domain Contract (`packages/protocol/src/court.ts`, re-exported by `packages/protocol/src/index.ts`)

```ts
export type CourtResourceId = "meat" | "wood" | "stone" | "metal" | "mushrooms" | "gold";
export type CourtBuildTab = "economy" | "military" | "decor";

export type CourtPlaceableType =
  | "cottage" | "farm" | "sawmill" | "quarry" | "mine"
  | "barracks"
  | "lantern" | "bench" | "well" | "flag";

export type CourtBuildingType = "townhall" | CourtPlaceableType;
export type CourtPlaceableOrRoad = CourtBuildingType | "road";

export interface CourtBuildingSpec {
  id: CourtBuildingType;
  footprint: readonly [width: number, depth: number];
  tab: CourtBuildTab | "core";
  requiredTownhallLevel: number;
  cost: Partial<Record<CourtResourceId, number>>;
  removable: boolean;
  /** Optional explicit max visual/gameplay level (5 for townhall). */
  maxLevel: number;
}

export interface CourtBuildingInstance {
  type: CourtBuildingType | string;
  x: number;
  z: number;
  level?: number;
}

export interface CourtGridSnapshot {
  size: number;
  buildings: CourtBuildingInstance[];
  roads: { x: number; z: number }[];
}
```
*Eliminates duplication between `packages/modules/court/src/module.ts`, `apps/client/src/ui/BuildPanel.tsx`, `apps/client/src/ui/World.tsx`, and `CourtScene.tsx` while obeying `tools/check/boundaries.ts`.*

### B. Client Visual Asset Manifest & Material Registry (`apps/client/src/court/assets/manifest.ts` & `materials/MaterialRegistry.ts`)

```ts
export type MaterialFamilyId =
  | "stone_basalt"
  | "stone_limestone"
  | "timber_blackened"
  | "iron_forged"
  | "roof_slate"
  | "bone_ivory"
  | "necrotic_crystal";

export type QualityTier = "mobile" | "balanced" | "desktop";

export interface AssetProvenance {
  source: "authored" | "licensed-gltf" | "procedural-module";
  license: string;          // SPDX ID or explicit written license note; never "unknown" in prod
  attribution?: string;
  maxTextureSizeDesktop: number;
  maxTextureSizeMobile: number;
}

export interface GlbAssetEntry {
  assetId: string;
  url: string;              // e.g. "/assets/models/citadel/citadel-lv1.glb"
  triCount: number;
  compression: { draco: boolean; meshopt: boolean; ktx2: boolean };
  boundsMeters: readonly [number, number, number];
  provenance: AssetProvenance;
}
```

### C. Client Building Visual Registry & Renderer Interface (`apps/client/src/court/buildings/BuildingRegistry.ts`)

```ts
import type { ComponentType } from "react";
import type { CourtBuildingType } from "@tdl/protocol";

export interface BuildingVisualProps {
  type: CourtBuildingType | string;
  level: number;
  quality: QualityTier;
  isSelected?: boolean;
  isGhost?: boolean;
}

export interface BuildingLevelVariant {
  minLevel: number;
  assetId: string;                     // maps into AssetManifest or modular scene component
  materialOverrides?: Partial<Record<string, MaterialFamilyId>>;
}

export interface BuildingVisualDefinition {
  id: CourtBuildingType;
  /** Authoritative grid anchor rule & world-space offset derived from footprint [w, d]. */
  anchorMode: "footprint-center";
  yawRad?: number;                     // e.g. Math.PI / 2 for townhall facing East gate
  variants: readonly BuildingLevelVariant[];
  /** New production visual component (glTF / modular assembly). */
  RenderProduction?: ComponentType<BuildingVisualProps>;
  /** Existing procedural blockout kept switchable during migration for A/B parity comparison. */
  RenderLegacy: ComponentType<BuildingVisualProps>;
}

export type BuildingVisualRegistry = Record<CourtBuildingType, BuildingVisualDefinition>;
```

---

## 4. Safe Phased Extraction Sequence (Without Behavior Changes)

1. **Step 1 — Centralize shared constants & grid math (`@tdl/protocol` + `court/scene/gridMath.ts`):**
   Move `CELL`, `gridToWorld`, `worldToCell`, `footprintKeys`, `buildingAt`, and `CourtGridSnapshot` out of `CourtScene.tsx` and deduplicate `FOOTPRINT`/`CATALOG`/`TH_COSTS`/`removable` via `@tdl/protocol` with zero visual changes.
2. **Step 2 — Extract `CourtCamera.tsx` and `CourtInteraction.tsx`:**
   Move `CameraRig`, `GridOverlay`, and `CourtInput` verbatim into dedicated files; verify identical drag, wheel, pinch, 8px tap threshold, and 550ms pickup behavior via runtime smoke before touching visuals.
3. **Step 3 — Extract `CourtEnvironment.tsx`:**
   Move `Ground`, `RoadTiles`, `Gatehouse`, `Palisade`, `Trees`, `Birds`, and `MeadowLife`; drive `Ground` debris/drift exclusions from `grid.size` rather than hardcoded `6.5` so future `22×22` expansions work cleanly.
4. **Step 4 — Introduce `BuildingRegistry.ts` & `BuildingRenderer.tsx` wrapping legacy geometry:**
   Wrap existing `TownHall` and `BuildingBody` inside `RenderLegacy` behind `BuildingVisualRegistry` first; confirm 100% pixel/interaction parity (`legacy` flag) before introducing `MaterialRegistry`, `GLTFLoader`/`KTX2Loader` pipeline, and the Phase D vertical-slice Citadel asset.
