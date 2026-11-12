# TDL-ARCH-006 — Citadel Visual Prototype (L1–L5)

> **Статус:** DONE (delivered on Arena branch for independent review and selective integration)  
> **Delivery branch:** `arena/ff89979b-tg-bot` (фиксированная сессионная ветка; не переключалась)  
> **Implementation base:** PR #28, branch `refactor/tdl-court-grid-input-impl`  
> **Exact source SHA:** `1fd88f7569428fd138daec775184228f36f8b0f2`  
> **Prior milestone:** `TDL-ARCH-005` (`db711655` + post-integration validation on `1fd88f75` in `evidence/TDL-ARCH-005-post/`)

## 1. Mission

Build a scoped, production-safe visual prototype strictly for the **Citadel (`townhall`)** across authoritative levels **1–5**, replacing the legacy flat-shaded snowy Town Hall box stack (`CitadelLegacy.tsx`) with five clearly distinguishable dark-medieval stylized-realism visual states while keeping all gameplay, input, grid footprint, economy, HUD, camera, and other-building behavior untouched.

## 2. Hard Constraints & Preserved Contracts

- **Footprint & placement preserved:** `[3, 3]` cell footprint (`3.30m × 3.30m` plot centered on `footprintCenterToWorld("townhall", at.x, at.z, grid.size)`), `rotation-y={Math.PI / 2}`, ground slab top `y = 0.08`; all Citadel geometry fits inside `3.16m × 5.98m × 3.24m` (`stepReachZ <= 1.61m < 1.65m` cell edge).
- **Authoritative domain data:** `CourtScene.tsx` continues reading `thLevel` directly from runtime state (`packages/modules/court/src/module.ts`, `TH_MAX = 5`); zero hardcoded demo levels or client-only economy hacks.
- **Zero dependency / server / UI churn:** `package.json`, `pnpm-lock.yaml`, `apps/server/**`, `packages/**`, `CitadelLegacy.tsx`, `LegacyBuildings.tsx`, `CourtEnvironment.tsx`, `CourtInteraction.tsx`, `CourtCamera.tsx`, `gridMath.ts`, `courtInput.ts`, and HUD components remain byte-for-byte identical to `1fd88f7569428fd138daec775184228f36f8b0f2`.
- **Safe fallback retained:** `CitadelRenderer.tsx` defaults to `"citadel"`, exposes `"legacy"`, and wraps rendering in `CitadelErrorBoundary` backed by unmodified `CitadelLegacy.tsx`.
- **No external unlicensed assets:** All stone, slate, oak timber, forged iron, and banner textures (`DataTexture` albedo + bump) and architectural extrusions (`ExtrudeGeometry`) are procedurally generated deterministically in-repo.
- **R3F & WebGL discipline:** Shared immutable textures/geometries allocated on mount and cleanly disposed on unmount (including React `<StrictMode>` double-invocation); no shared mutable animated materials across unrelated meshes; zero per-frame allocations in `useFrame`; localized `pointLight` `distance <= 3.1m` (`decay = 2`) with no global light flood.

## 3. Changed Files

Verified clean against `1fd88f7569428fd138daec775184228f36f8b0f2` (`diff -rq` outside `docs/` and `evidence/`):

1. `apps/client/src/court/CourtScene.tsx` _(modified, +5 / -3 lines)_ — imports `CitadelRenderer` & `CitadelRenderVariant`, accepts optional `citadelVariant = "citadel"`, replaces `<TownHall level={thLevel} grid={resolvedGrid} />` with `<CitadelRenderer level={thLevel} grid={resolvedGrid} variant={citadelVariant} />`.
2. `apps/client/src/court/buildings/citadel/citadelLevels.ts` _(added)_ — typed L1–L5 visual specs (`CITADEL_LEVEL_VARIANTS`), `clampCitadelLevel`, and `getCitadelVisualSpec`.
3. `apps/client/src/court/materials/citadelMaterials.ts` _(added)_ — deterministic procedural PBR `DataTexture` generators (`basalt`, `dressed`, `timber`, `slate`, `iron`, `banner`), StrictMode-safe `useCitadelTextureSet`, dark-medieval `CITADEL_PALETTE`, and isolated animated material prop factories (`createHearthGlowMaterialProps`, `createNecroticCrystalMaterialProps`, `createFlameMaterialProps`, `createAshSmokeMaterialProps`).
4. `apps/client/src/court/buildings/citadel/citadelGeometry.ts` _(added)_ — procedural architectural extrusions (`buildSteppedButtressGeometry`, `buildPointedArchFrameGeometry`, `buildGableRoofGeometry`, `buildFlyingButtressGeometry`, `buildNecroticCrystalGeometry`) and StrictMode-safe `useCitadelGeometrySet`.
5. `apps/client/src/court/buildings/citadel/CitadelBuilding.tsx` _(added)_ — five-tier Citadel composition featuring stepped basalt plinth & portal stairs, corner quoins, stepped gothic buttresses, recessed pointed lancets with forged-iron muntins, oak half-timbered upper gallery + corbels (L1), projecting watchtower + gatehouse porch + braziers (L2), battlemented twin-bastion keep + portcullis + central belfry + rear sanctuary apse + banner (L3), 4-turret cruciform gothic citadel + open necrotic crystal crown + 2 war banners (L4), and sovereign necrotic fortress with 4 exterior vaulted flying buttresses, projecting twin-pylon barbican gatehouse, gilded trim, bone finials, 4 iron braziers, and 4 war standards (L5).
6. `apps/client/src/court/buildings/citadel/CitadelRenderer.tsx` _(added)_ — variant selector (`"citadel"` / `"legacy"`) + `CitadelErrorBoundary` fallback to `CitadelLegacy.tsx`.
7. `apps/client/tests/citadelLevels.test.tsx` _(added)_ — focused Vitest suite (5 tests) covering `clampCitadelLevel`, non-uniform L1–L5 silhouette & feature escalation, `[3, 3]` footprint bounds (`stepReachZ <= 1.61m`), procedural `DataTexture`/geometry StrictMode disposal, and error-boundary fallback.
8. `docs/AI_COLLABORATION/handoffs/TDL-ARCH-006.md` _(this handoff)_ and `evidence/TDL-ARCH-006/` _(validation logs, health & smoke reports, 11 unedited browser screenshots)_.

## 4. Visual Progression L1 → L5

- **Lv. 1 (`fortified-manor`):** Basalt ground keep, corner stepped buttresses, cantilevered oak half-timber upper hall with angled corbel brackets, dark slate pitched gable roof, hearth chimney smoke, recessed warm lancets, stepped pointed-arch doorway.
- **Lv. 2 (`watchtower-hall`):** Elevated basalt keep, steep hip-and-dormer slate roof, projecting front stone gatehouse porch with bronze keystone, tall asymmetric octagonal watchtower rising above roof ridge, 2 flanking iron braziers.
- **Lv. 3 (`battlemented-keep`):** Full upper masonry bastion with stone merlons/embrasures, twin front corner bastion turrets, raised portcullis gate spears, central square belfry with emerald necrotic lancet & slate pyramid spire, apex crimson war standard, rear polygonal apse.
- **Lv. 4 (`gothic-bastion`):** 4 corner octagonal bastion towers with crown parapet rings & bone finials, cruciform 4-gable gothic slate roof, machicolated cornice, open iron reliquary cage housing floating pulsing necrotic crystal, 2 turret-apex war standards, 4 braziers.
- **Lv. 5 (`sovereign-necrotic-citadel`):** Sovereign fortress silhouette with taller stone bastions (bronze eave collars & iron spire rings), 4 arched stone flying buttresses springing from the corner bastions onto the central Donjon, projecting stone barbican gatehouse with twin pylons & tall braziers, aged-gold filigree accents, radiant sovereign crystal reliquary spire, and 4 war standards.

## 5. Validation Summary

- **Source verification:** Exact isolated clone of `1fd88f7569428fd138daec775184228f36f8b0f2` (`Node v22.22.3`, `pnpm 12.6.0`, `turbo 2.11.4`).
- `pnpm --filter @tdl/client test`: `exit_code=0` — `5` test files, `39/39` tests passed (`shell` `15`, `citadelLevels` `5`, `courtExtraction` `5`, `courtGridMath` `6`, `courtInput` `8`).
- `pnpm typecheck`: `exit_code=0` (`18/18` workspace packages).
- `pnpm check`: `exit_code=0` (`11` modules, boundaries clean, `24`/`126` i18n keys, `810` calendar windows).
- `pnpm build`: `exit_code=0` (`3/3` packages: `@tdl/server`, `@tdl/court3d`, `@tdl/client`).
- `pnpm test`: `exit_code=0` — `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`; `@tdl/host` reported `88 passed | 2 failed` due to pre-existing calendar-dependent assertions on `2026-11-12` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`), matching `1fd88f75` baseline verbatim.
- **Production-preview runtime smoke (`NODE_ENV=production node apps/server/dist/index.mjs`, PostgreSQL 18.4, `HeadlessChrome` + ANGLE Vulkan `SwiftShader Device (Subzero)`):**
  - `13/13` checks passed (`allOk: true`): `desktopCourtLoad`, `rightHoldNoPickup`, `rightDragOrbit`, `leftLongPressPickup`, `leftDragPan`, `upgradeLv2`..`upgradeLv5` (authoritative server upgrades `Ур. 2`–`Ур. 5` persisted across reloads), `farmPlace` (`600 1340 1770 650 300 950`), `navigation` (`Court → Map → Court`), `touchLongPressPickup` (`390×844`), and `noHorizontalOverflow` (`false` at `1376×768`, `390×844`, `320×690`, zero HUD overlaps).
  - `consoleErrors: 0`, `pageErrors: 0`, `failedRequests: 0`; 1 expected benign `webglcontextlost` (`inDom: false`) on detached canvas unmount during `Court → Map` navigation.
  - **Device disclaimer:** No physical mobile device or hardware GPU is present in this sandbox; all browser renders and screenshots ran under headless SwiftShader emulation.
