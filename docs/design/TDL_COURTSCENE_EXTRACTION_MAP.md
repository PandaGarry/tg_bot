# TDL-ARCH-004 — `CourtScene.tsx` Extraction & Parity Map (`TDL_COURTSCENE_EXTRACTION_MAP.md`)

> **Task:** `TDL-ARCH-004` (Scope D)  
> **Audited source branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
> **Exact audited source SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Parallel integration context:** PR #28 (`refactor/tdl-court-grid-input-impl`, HEAD `db71165`) already extracted `apps/client/src/court/scene/gridMath.ts` and `apps/client/src/court/scene/courtInput.ts` and verified functional parity in `evidence/TDL-ARCH-003/`.  
> **Arena delivery branch:** `arena/ff89979b-tg-bot` (architecture mapping only; zero source edits)  
> **Date:** 2026-11-12

---

## 1. Source Monolith Provenance (`0a5e465` vs PR #28 `db71165`)

- At `0a5e465ede6096ecdfc33b4771b0761baf327fab`, `apps/client/src/court/CourtScene.tsx` is a single **`1,926`-line (`82,070 B`)** monolith containing scene setup, lights, camera controls, environment meshes, 14×14 grid math, pointer/touch gestures, all 10 procedural building models, TownHall Lv.1–5 procedural variants, VFX animations, and 157 inline JSX material definitions.
- Parallel standalone prototype `apps/court3d/src/App.tsx` (`485` lines, `27` inline materials) duplicates early `CameraRig`, `Ground`, `Palisade`, `TownHall`, `Trees`, `Rocks`, and `Sheep`; it is not wired into `apps/client` and should stay frozen/isolated until deprecated.
- **Important merge provenance note:** PR #28 (`db71165`, `TDL-ARCH-002` + `TDL-ARCH-003`) already extracted pure grid math (`gridMath.ts`) and pointer hold/tap logic (`courtInput.ts`) from `CourtScene.tsx`, shrinking `CourtScene.tsx` by `132` lines and fixing the `0a5e465` right-hold pickup defect. Extraction Phase B on PR #26 should build upon (or reconcile cleanly with) `db71165` rather than re-extracting conflicting copies of `gridMath.ts` / `courtInput.ts`.

---

## 2. Responsibility Extraction Map (All 10 Required Areas)

Target paths align with `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md` §3 (`apps/client/src/court/...`).

| # | Area | Current Owner (`0a5e465` file & lines) | Target Owner | Public Interface | Dependencies | Parity Gates |
|---|---|---|---|---|---|---|
| **1** | **Scene composition & root canvas** | `CourtScene.tsx`: `webglAvailable()` (`L58-66`), `CourtGridLite`, `CourtTool`, `CourtPending` (`L1816-1829`), `CourtScene()` (`L1831-1926`), `Dust()` (`L1328-1359`) | `court/scene/CourtScene.tsx` + `court/scene/WebglFallback.tsx` + `court/effects/PlacementDust.tsx` | `export function CourtScene(props: CourtSceneProps): JSX.Element` (keep exact prop signature from `World.tsx:74-92`: `texts`, `grid`, `thLevel`, `tool`, `pending`, `onTarget`, `onRoad`, `onPickup`) | `react`, `@react-three/fiber`, `three`, `CourtCamera`, `CourtEnvironment`, `CourtInteraction`, `BuildingRenderer`, `QualityProfile` | G1, G7, G8, G9, G10 |
| **2** | **Environment, lighting & fog** | `CourtScene.tsx`: `PLOT`/`GATE_HALF` (`L14-15`), `Ground()` (`L195-293`), `RoadTiles()` (`L354-425`), `Gatehouse()` (`L427-514`), `Palisade()` (`L515-605`), `Trees()` (`L1677-1734`), `Birds()` (`L1736-1772`), `MeadowLife()` (`L1774-1813`), `<color>`/`<fog>`/`<hemisphereLight>`/`<directionalLight>` (`L1893-1906`) | `court/scene/CourtEnvironment.tsx` + `court/scene/CourtLighting.tsx` | `export function CourtEnvironment(props: { grid: CourtGridLite \| null; quality: QualityProfile })` & `export function CourtLighting(props: { quality: QualityProfile })` | `three`, `gridMath.ts`, `MaterialRegistry`, `rng()` | G1, G8, G9 + fix `Ground()` `L226,241` hardcoded `+ 6.5` & dispose 26 `ShapeGeometry` allocations |
| **3** | **Camera** | `CourtScene.tsx`: `CameraRig()` (`L70-191`) | `court/scene/CourtCamera.tsx` | `export function CourtCamera(props?: { bounds?: CameraBounds })` (`target ∈ [-6,6]`, `az ∈ [π/4 ± 0.9]`, `pol ∈ [0.78, 1.25]`, `dist ∈ [7, 45]`, `120Hz` coalesced events, `touchAction = "none"`) | `@react-three/fiber` (`useThree`, `useFrame`), `three` | G2 (`leftDragPan`), G3 (`rightDragOrbit`), pinch/wheel zoom |
| **4** | **Pointer / touch interaction** | `CourtScene.tsx`: `GridOverlay()` (`L1361-1379`), `CourtInput()` (`L1390-1525`) *(partially extracted on PR #28 `db71165` into `court/scene/courtInput.ts`)* | `court/scene/CourtInteraction.tsx` + `court/scene/courtInput.ts` | `CourtInteraction({ grid, tool, pending, onTarget, onRoad, onPickup })`; pure `createCourtInputController(callbacks)` (`HOLD_PICKUP_MS = 550`, `DRAG_THRESHOLD_PX = 8`, `button === 0` guard) | `gridMath.ts`, `courtInput.ts`, `three`, `@react-three/fiber` | G2, G3, G4, G5, G6 (left hold, **right hold no-pickup**, touch hold, placement, drag-cancel) |
| **5** | **Grid / footprint helpers** | `CourtScene.tsx`: `CELL = 1.1`, `gridToWorld()` (`L294-298`), `FOOTVIEW` (`L300-313`), `worldToCell()` (`L316-321`), `footprintKeys()` (`L324-336`), `buildingAt()` (`L339-347`) *(extracted on PR #28 `db71165` into `court/scene/gridMath.ts`)* | `court/scene/gridMath.ts` | `gridToWorld`, `worldToCell`, `footprintSize`, `footprintCells`, `footprintCenterToWorld`, `footprintKeys`, `buildingAt`, `isFootprintFree` — consuming authoritative footprints from `@tdl/protocol` snapshot | `@tdl/protocol` only (zero `three`/React imports; preserves `tools/check/boundaries.ts`) | Unit tests (`courtGridInput.test.tsx`), G4, G6 |
| **6** | **Building registry & renderer** | `CourtScene.tsx`: `Popped()` (`L1291-1307`), `Buildings()` (`L1309-1326`), inline `TownHall` level branches (`L1559,1640,1660`) | `court/buildings/BuildingRegistry.ts` + `court/buildings/BuildingRenderer.tsx` | `resolveBuildingVisual(type, level, quality, renderMode): ResolvedBuildingVisual`; `<BuildingRenderer grid thLevel quality renderMode />` | `BuildingDefinition`, `AssetManifestEntry`, `gridMath.ts`, `AssetLoader`, `Citadel`, `LegacyBuildings` | G1, G6, G7 (`upgradeLv2`), legacy/new comparison toggle |
| **7** | **Citadel geometry** | `CourtScene.tsx`: `TownHall()` (`L1526-1675`) + `RoofBanner()` (`L608-634`) *(plus note `L1528` centers via `at.x, at.z` directly rather than `[w,h]` footprint center helper)* | `court/buildings/citadel/CitadelLegacy.tsx` (preserved for parity) & `court/buildings/citadel/CitadelBuilding.tsx` (glTF/PBR target) | `export function CitadelLegacy({ level, position })` & `export function CitadelBuilding({ level, variant, quality })` | `BuildingVfx` (`Smoke`, `WaveCloth`), `MaterialRegistry`, `AssetLoader` | G1, G4 (Citadel 3×3 pickup/move), G7 (Lv.1→5 visual evolution) |
| **8** | **Supporting building geometry** | `CourtScene.tsx`: `Pad()`, `CornerBeams()`, `RoofSnow()` (`L791-829`), `BuildingBody()` (`L830-1261` — 10 types), `RoofBannerSmall()` (`L1263-1289`), `Smoke()`, `Windmill()`, `SawBlade()`, `Bucket()`, `LanternFlame()`, `WaveCloth()` (`L641-787`) | `court/buildings/legacy/LegacyBuildings.tsx` + `court/effects/BuildingVfx.tsx` + future `court/buildings/supporting/*` | `export function LegacyBuildingBody({ type })`; shared animated VFX props (`Smoke`, `LanternFlame`, `Windmill`, `SawBlade`, `Bucket`, `WaveCloth`) | `MaterialRegistry`, `AssetLoader`, `BuildingRegistry` | G6 (`farmPlace`), placement `Popped` + `Dust`, all 10 `CATALOG` types visible without overlap |
| **9** | **Material definitions** | `CourtScene.tsx`: `C` (`L18-45`) + **157** inline `<meshStandardMaterial>`/`<meshBasicMaterial>`/`<lineBasicMaterial>` tags across `L195-1900` | `court/materials/MaterialRegistry.ts` + `court/materials/palette.ts` | `getMaterial(familyId, overrides?)`, `getPaletteColor(token)`, material cloning/disposal registry | `three` | Shared material count reduction, color-space/tone-mapping parity (`ACESFilmic`, `exposure = 1.12`) |
| **10** | **Asset loading & provenance** | *Not implemented at `0a5e465`* (zero `useLoader`, zero `GLTFLoader`, zero `QualityProfile`, zero asset manifest) | `court/assets/AssetLoader.ts` + `court/assets/assetManifest.ts` + `court/performance/qualityProfiles.ts` | `useCourtAsset(entry: AssetManifestEntry)` (wraps R3F `useLoader` + `GLTFLoader` + optional `MeshoptDecoder`), `selectQualityProfile()`, manifest provenance assertions | `three/examples/jsm/loaders/GLTFLoader.js`, `@react-three/fiber`, `react` (`Suspense`) | G1, G9, G10 (WebGL fallback + asset-load error boundary + no unverified licenses) |

---

## 3. UI & Module Consumers Outside `CourtScene.tsx`

- **`apps/client/src/ui/World.tsx:74-153`:** Calls `<CourtScene>` and forwards `court.grid`, `court.townhallLevel`, `tool`, `pending`, `onTarget` → `court.place` / `court.move`, `onRoad` → `court.road`, `onPickup`, and `onUpgrade` → `court.upgrade`. Note `World.tsx:107` hardcodes removable decor check `["lantern", "bench", "well", "flag"]`, which also mirrors server `CATALOG[type].tab === "decor"`.
- **`apps/client/src/ui/BuildPanel.tsx:22-60`:** Duplicates `CATALOG` (`10` buildings, tabs, `th` levels, costs) and `TH_COSTS` (`2..5`). Must stay coupled to server `packages/modules/court/src/module.ts` via `@tdl/protocol` (never moved into `CourtScene` or `BuildingDefinition`).

---

## 4. Mandatory Parity Gates (`TDL-ARCH-003` + Toolchain Baseline)

Every extraction PR (Phases B–D) must pass ALL of the following gates before acceptance, matching the `TDL-ARCH-003` baseline (`evidence/TDL-ARCH-003/smoke-report.json`):

| Gate ID | Scenario / Check | Exact Acceptance Criterion | `TDL-ARCH-003` Reference Step |
|---|---|---|---|
| **G0** | **Static toolchain checks** | `pnpm typecheck`, `pnpm test` (`@tdl/client`, `@tdl/kernel`, `@tdl/server` passing; note pre-existing date-dependent failures in `@tdl/host`), `pnpm check` (registry, package boundaries, ru/en i18n, schedule), `pnpm build` | `TDL-ARCH-003` `commands.log` |
| **G1** | **Desktop court load** | `1376×768` production preview (`apps/server/dist/index.mjs` + `apps/client/dist`) loads `<canvas>`, WebGL2 context, Citadel (`townhall` at `7,7`), palisade, and 5 starter road tiles with zero console/page errors and zero failed requests | `desktopCourtLoad` |
| **G2** | **Left-drag camera pan** | Left pointer drag moves viewport camera smoothly without triggering building pickup or tap placement | `leftDragPan` (`triggeredPickup: false`) |
| **G3** | **Right-hold no-pickup & right-drag orbit** | Stationary right-mouse hold (`>= 700ms`) never picks up Citadel or buildings; right-drag and `Shift+drag` orbit azimuth/polar angles smoothly | `rightHoldNoPickup`, `rightDragOrbit` |
| **G4** | **Left long-press & touch long-press pickup** | Left mouse hold (`550ms`) and single-finger touch hold (`550ms`) on a building footprint (`3×3` TownHall, `2×2` Farm, `1×1` road) lift into `pending` move mode (`from` preserved); `> 8px` move or second finger cancels timer cleanly | `leftLongPressPickup`, `touchLongPressPickup` |
| **G5** | **Placement & confirm/remove rules** | Selecting `farm` opens valid/invalid footprint ghost; tap confirms into `.place-bar .ok` → `court.place` updates stock/power and plays `Popped` + `Dust`; `.warn` remove appears only for `decor` & `road` | `farmPlace` |
| **G6** | **Citadel upgrade** | `.th-up` triggers `court.upgrade`; HUD shows `Ур. 2`, power increases, unlocked buildings become enabled, and Citadel visual variant reflects `thLevel = 2` | `upgradeLv2` |
| **G7** | **Court ↔ Map ↔ Court navigation** | Switching Court → Map → Court via bottom nav remounts/restores 3D scene cleanly with **no lingering broken WebGL context** (`webglcontextlost` must recover or avoid context starvation) | `navigation` (monitor `webglContextEvents`) |
| **G8** | **Mobile 390×844 & 320×690 responsive layout** | Zero horizontal overflow (`scrollWidth <= clientWidth`), zero overlap between profile card, resource grid, and bottom nav at `1376×768`, `390×844`, and `320×690` | `noHorizontalOverflow`, `desktopLayout`, `mobileLayout390`, `mobileLayout320` |
| **G9** | **WebGL-unavailable & asset-error fallback** | When WebGL is absent, `court-fallback.jpg` + `nowebgl` banner render; when future glTF assets fail to load, `<ErrorBoundary>` degrades cleanly to `RenderLegacy` instead of blank canvas | `CourtScene.tsx:1870-1874` |
| **G10** | **Legacy vs New comparison mode** | `RenderLegacy` remains selectable behind dev/comparison switch throughout Phase B–D so visual/silhouette/footprint parity can be audited side-by-side | `TDL_VISUAL_REFACTOR_ARCHITECTURE.md` §2 & §7 |
