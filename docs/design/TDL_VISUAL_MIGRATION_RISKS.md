# TDL-ARCH-004 — Visual Migration Risk Register & First Slice (`TDL_VISUAL_MIGRATION_RISKS.md`)

> **Task:** `TDL-ARCH-004` (Scope E)  
> **Audited source branch:** `refactor/tdl-asset-pipeline-foundation` (PR #26)  
> **Exact audited source SHA:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Cross-referenced baseline:** PR #28 (`db71165`) & `evidence/TDL-ARCH-003/smoke-report.json`  
> **Arena delivery branch:** `arena/ff89979b-tg-bot`  
> **Date:** 2026-11-12

---

## 1. Prioritized Risk Register

| Rank | Risk ID | Category | Severity | Evidence (`0a5e465` / `TDL-ARCH-003`) | Failure Mode / Impact | Required Mitigation |
|---:|---|---|---|---|---|---|
| **1** | **R1** | **Merge & base dependencies** | **Critical** | PR #26 (`0a5e465`) predates PR #28 (`db71165`, `TDL-ARCH-002/003`), which extracted `gridMath.ts` + `courtInput.ts` and fixed the right-hold pickup defect still present in `0a5e465` (`CourtScene.tsx:1443-1467`). | Starting Phase B directly on un-rebased `0a5e465` will either create merge conflicts across `CourtScene.tsx` or reintroduce the right-hold pickup regression. | Synchronize / integrate `db71165` (`gridMath.ts` + `courtInput.ts` + `courtGridInput.test.tsx`) first before continuing Phase B decomposition. |
| **2** | **R2** | **Duplicate footprint & catalog authority** | **Critical** | `FOOTVIEW` (`CourtScene.tsx:300-313`), `CATALOG`/`TH_COSTS` (`BuildPanel.tsx:22-60`), and decor list (`World.tsx:107`) duplicate `packages/modules/court/src/module.ts:34-71`. `tools/check/boundaries.ts:89-96` blocks `apps/client` from importing `@tdl/module-court`. | Divergent footprints or costs between server and client cause invalid placement ghosts, broken pickup hitboxes, or `pnpm check` boundary failures. | Emit read-only footprint/catalog metadata from `court` snapshot or pure `@tdl/protocol` types; never duplicate gameplay numbers in `BuildingDefinition` or import `@tdl/module-court` from `apps/client`. |
| **3** | **R3** | **Server MIME, cache & SPA fallback hazards** | **High** | `apps/server/src/http.ts:82-87,322-331` lacks `.glb`, `.gltf`, `.ktx2`, `.wasm`, `.jpg`, `.webp` MIME types; sets `immutable` 1-year `Cache-Control` on all non-`index.html` responses; falls back missing paths to `200 index.html`. | `WebAssembly.instantiateStreaming()` fails on `.wasm` decoders; unhashed `public/` models cache permanently across updates; missing `.glb` returns HTML and throws opaque Three.js parser errors. | Add explicit MIME mappings, return `404` for missing static asset prefixes (`/models/`, `/textures/`, `/decoders/`, `/icons/`), and import/hash assets via Vite (`assetsInclude`) or versioned asset paths before serving 3D files. |
| **4** | **R4** | **Asset licensing & commercial provenance** | **High** | `0` `LICENSE`/`NOTICE` files in repo; `322/322` raster files have `unknown` license; `image-search/` holds 2 copyrighted RoK screenshots; `public/icons/` derived via an uncommitted Python PIL script (`docs/game/24-court-3d.md:561-563`). | Shipping unverified AI or third-party assets violates `TDL_PRODUCT_VISION_AND_ACCEPTANCE.md` §3.5 and blocks commercial release. | Enforce `AssetProvenance` fields (`original-tdl` or `licensed-commercial`) on every new 3D/PBR/UI asset manifest entry; exclude `docs/game/ui/` and `image-search/` from runtime builds. |
| **5** | **R5** | **Gameplay regression & WebGL context loss** | **High** | `evidence/TDL-ARCH-003/smoke-report.json` recorded `THREE.WebGLRenderer: Context Lost.` on Court → Map → Court remount (`World.tsx` unmounts/remounts `<Canvas>`); `Ground()` (`CourtScene.tsx:226,241`) hardcodes `+ 6.5` assuming `size=14`; `TownHall` (`L1528`) bypasses `[w,h]` centering. | Rapid Court↔Map navigation can exhaust WebGL contexts on mobile Safari/WebView; changing `grid.size` breaks snow/mud patch alignment; off-center TownHall shifts visually. | Listen to `webglcontextlost`/`webglcontextrestored` (or keep Canvas alive/properly dispose renderer), derive patch coordinates from `grid.size`, use `footprintCenterToWorld()`, and gate every slice on `TDL-ARCH-003` parity tests. |
| **6** | **R6** | **Draw calls, material duplication & geometry leaks** | **Medium-High** | `CourtScene.tsx` defines `157` inline JSX materials + `155` geometry primitives; `Ground()` allocates `26` `THREE.ShapeGeometry` objects without `.dispose()` on unmount (`L207-247`). | Excessive material programs/shader compilations hurt mobile WebGL frame times; remounting Court leaks GPU geometry buffers across Court↔Map switches. | Consolidate materials into `MaterialRegistry.ts` (`<= 12` shared base material families) and dispose procedural geometries/loaded assets in `useEffect` cleanup. |
| **7** | **R7** | **Mobile memory, bundle & dead asset bloat** | **Medium-High** | `apps/client/public/icons/` ships `2.60 MiB` (`2,730,207 B`) of unused PNGs (`i-web.png` alone is `2.02 MiB` at `1408×768` + 12 legacy icons); single `~1.3 MB` JS chunk (`vite.config.ts` has no manual chunking); `2048×2048` shadows + `dpr [1, 1.75]` un-tiered. | Slow TG Mini App / mobile cold start and VRAM pressure before 3D models are even added; loading Draco (`705 KB`) + Basis (`585 KB`) eagerly would inflate startup further. | Lazy-load `CourtScene` + 3D assets, prefer `Meshopt` (`24.8 KB`) before adding Basis/Draco unless VRAM demands KTX2, introduce `QualityProfile` (`low`/`medium`/`high`), and schedule unused `public/icons/` cleanup in an asset hygiene PR. |
| **8** | **R8** | **Texture format & color-space / normal defects** | **Medium** | `CourtScene.tsx:1886-1889` sets `ACESFilmicToneMapping`; `three@0.182.0` deprecates `RGBELoader` in favor of `HDRLoader`; zero PBR maps exist today. | Wrong `NoColorSpace` vs `SRGBColorSpace`, DirectX `-Y` normals instead of OpenGL `+Y`, or missing IBL causes washed-out diffuse or black metallic surfaces on Citadel assets. | Enforce GLB PBR metallic-roughness export rules (OpenGL `+Y` normals, `SRGBColorSpace` color/emissive only, `NoColorSpace` linear data maps, `HDRLoader` + `PMREMGenerator` or baked env before metallic hero assets). |
| **9** | **R9** | **Visual quality gap & TownHall level parity** | **Medium** | `TownHall` (`CourtScene.tsx:1559,1640,1660`) has minimal difference between Lv.1 and Lv.2 (`+5%` scale + obscured gold trim) and zero difference across Lv.3–Lv.5; mixing a high-detail PBR Citadel with untextured primitive cottages risks uncanny contrast. | Violates `TDL_PRODUCT_VISION_AND_ACCEPTANCE.md` §3.2 ("Upgrade stages must change the model visibly and intentionally") or leaves Citadel looking stylistically isolated. | Author shared Bone-Wood / Undead-Empire `MaterialRegistry` palette first so procedural legacy buildings share cohesive lighting/palette alongside Citadel Lv.1–5 vertical-slice tiers, and keep `RenderLegacy` toggle for side-by-side comparison. |
| **10** | **R10** | **Migration sequencing risk** | **Medium** | Current `CourtScene.tsx` mixes camera, input, grid math, ground, environment, buildings, and materials in one `1,926`-line file. | Attempting Phase D Citadel `.glb` production before Phase B structural extraction and Phase C loader/server-MIME plumbing yields unreviewable diffs and runtime breakages. | Follow strict sequential slices: B1 (structure/materials extraction) → C1 (MIME/cache + `AssetLoader` + `QualityProfile`) → D1 (Citadel Lv.1–5 vertical slice). |

---

## 2. Recommended Smallest Safe First Implementation Slice

**Slice B1 — Pure Structural Extraction & Material Registry (Zero Visual Change, Zero New Dependencies, Zero Server/Asset Mutation):**

1. **Base alignment:** Reconcile PR #26 (`0a5e465`) with PR #28 (`db71165` `court/scene/gridMath.ts` and `court/scene/courtInput.ts`, plus `courtGridInput.test.tsx`) so right-hold no-pickup and touch long-press remain verified.
2. **Extract `CourtScene.tsx` submodules under `apps/client/src/court/`:**
   - `scene/CourtCamera.tsx` (`CameraRig`)
   - `scene/CourtEnvironment.tsx` (`Ground`, `RoadTiles`, `Gatehouse`, `Palisade`, `Trees`, `MeadowLife`, `Birds` — fixing `Ground()` hardcoded `+ 6.5` to derive from `grid.size` and disposing the 26 `ShapeGeometry` allocations on unmount)
   - `scene/CourtInteraction.tsx` (`GridOverlay`, `CourtInput` wired to `courtInput.ts`)
   - `scene/WebglFallback.tsx` (`webglAvailable` + `court-fallback.jpg`) + `webglcontextlost`/`webglcontextrestored` diagnostic listener
   - `materials/palette.ts` + `materials/MaterialRegistry.ts` (extract `C` and consolidate the `157` inline JSX materials into shared, cached, properly disposed material instances with **identical colors and scalar roughness/metalness**)
   - `buildings/citadel/CitadelLegacy.tsx` (`TownHall`, `RoofBanner`) & `buildings/legacy/LegacyBuildings.tsx` (`BuildingBody`, `Buildings`, `Popped`, `BuildingVfx`)
   - `performance/qualityProfiles.ts` (initial `high` profile preserving exact `dpr={[1, 1.75]}` and `2048` shadow settings)
3. **Why this slice first:**
   - **Zero visual regression risk:** pixels remain identical to `TDL-ARCH-003` baseline screenshots while eliminating GPU geometry/material leaks and isolating Citadel + Building rendering behind clean module boundaries.
   - **Zero blocked dependencies:** needs no new npm packages, no `.glb` assets, no server HTTP changes, and no domain/economy/protocol edits (single-authority footprint propagation via `@tdl/protocol` can follow cleanly either in Slice B2 or right alongside).
   - **Cleanly testable:** verifiable directly against `pnpm typecheck && pnpm test && pnpm check && pnpm build` and every `TDL-ARCH-003` Playwright/SwiftShader gate (`1376×768`, `390×844`, `320×690`).

---

## 3. Open Questions Requiring Owner / Lead Decision Before Phase C–D

1. **PR #26 + PR #28 integration order:** Should PR #28 (`db71165`, `TDL-ARCH-002/003` `gridMath.ts` + `courtInput.ts`) merge into `main` before PR #26 (`0a5e465`) rebases for Slice B1?
2. **Legacy asset cleanup scope:** Confirm removing the `13` unreferenced PNGs (`2,730,207 B`, including `i-web.png`) from `apps/client/public/icons/` and replacing `apps/client/public/court-fallback.jpg` later, plus tracking commercial license status for the `22` active glossy icons derived from `docs/game/ui/icon-packs/glossy/`.
3. **Domain footprint delivery path:** Prefer adding read-only `footprints` map inside `court` module `snapshot()` (`@tdl/protocol` `WorldViewBase.modules.court`) or defining shared pure court display/footprint types in `@tdl/protocol`?
4. **Citadel asset tiering vs `packages/modules/court` `TH_MAX = 5`:** Confirm whether Phase D authors 3 distinct architectural tiers (e.g., Lv.1, Lv.2–3, Lv.4–5) or 5 tiers for `townhall` within the `3×3` (`3.3m × 3.3m`) court footprint.
