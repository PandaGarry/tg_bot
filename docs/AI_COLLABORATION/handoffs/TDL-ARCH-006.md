# TDL-ARCH-006 — Citadel Visual Prototype v2 (L1–L5)

> **Статус:** DONE & POST-INTEGRATION VERIFIED (v2 integrated on PR #28 at `a5fe323859455082b66eb61bc090b0e3796d3fc6`)  
> **Delivery branch (evidence & handoff):** `arena/ff89979b-tg-bot` (фиксированная сессионная ветка; не переключалась)  
> **Integrated PR branch & tested HEAD SHA:** `refactor/tdl-court-grid-input-impl` (PR #28) @ `a5fe323859455082b66eb61bc090b0e3796d3fc6`  
> **Parent PR #28 SHA:** `1fd88f7569428fd138daec775184228f36f8b0f2`  
> **Arena prototype source SHA:** `c9145652320a28582ee5367c4418be7984df4cb9`  
> **Prior milestone:** `TDL-ARCH-005` (`db711655` + post-integration validation on `1fd88f75` in `evidence/TDL-ARCH-005-post/`)

## 1. Mission

Deliver a sculptural, deeply detailed dark-medieval **Citadel (`townhall`)** visual overhaul across authoritative levels **1–5** (`TDL-ARCH-006` v2), elevating silhouette continuity, recessed Gothic portal carving, masonry relief, procedural PBR surface wear, heraldry/bone/iron accents, and an expressive octagonal necrotic reliquary while keeping all gameplay, input, grid footprint, economy, HUD, camera, and other-building behavior untouched.

## 2. Hard Constraints & Preserved Contracts

- **Footprint & placement preserved:** `[3, 3]` cell footprint (`3.30m × 3.30m` plot centered on `footprintCenterToWorld("townhall", at.x, at.z, grid.size)`), `rotation-y={Math.PI / 2}`, ground slab top `y = 0.08`; all Citadel geometry across L1–L5 fits inside `3.22m × 6.08m × 3.24m` (`stepReachZ <= 1.62m < 1.65m` cell edge).
- **Authoritative domain data:** `CourtScene.tsx` reads `thLevel` directly from runtime state (`packages/modules/court/src/module.ts`, `TH_MAX = 5`); zero hardcoded demo levels or client-only economy hacks.
- **Zero dependency / server / UI churn:** `package.json`, `pnpm-lock.yaml`, `apps/server/**`, `packages/**`, `CitadelLegacy.tsx`, `LegacyBuildings.tsx`, `CourtEnvironment.tsx`, `CourtInteraction.tsx`, `CourtCamera.tsx`, `gridMath.ts`, `courtInput.ts`, and HUD components remain byte-for-byte identical to `1fd88f7569428fd138daec775184228f36f8b0f2`.
- **Safe fallback retained:** `CitadelRenderer.tsx` defaults to `"citadel"`, exposes `"legacy"`, and wraps rendering in `CitadelErrorBoundary` backed by unmodified `CitadelLegacy.tsx`.
- **No external unlicensed assets:** All procedural `256×256` PBR textures (`DataTexture` albedo/bump/roughness/alpha) and carved extrusions (`ExtrudeGeometry` / `LatheGeometry` / `TubeGeometry`) are generated deterministically in-repo.
- **R3F & WebGL discipline:** Shared immutable textures (`18`) and geometries (`12`) allocated on mount and disposed cleanly on unmount (verified under React `<StrictMode>` double-invocation); zero per-frame allocations in `useFrame`; localized `pointLight` (`distance <= 3.4m`, `decay = 2`) only around braziers and the reliquary vault.

## 3. Changed Files

Verified clean against `1fd88f7569428fd138daec775184228f36f8b0f2` (`diff -rq` outside `docs/` and `evidence/`):

1. `apps/client/src/court/CourtScene.tsx` _(modified, +5 / -3 lines)_ — imports `CitadelRenderer` & `CitadelRenderVariant`, accepts optional `citadelVariant = "citadel"`, replaces `<TownHall level={thLevel} grid={resolvedGrid} />` with `<CitadelRenderer level={thLevel} grid={resolvedGrid} variant={citadelVariant} />`.
2. `apps/client/src/court/buildings/citadel/citadelLevels.ts` _(added)_ — typed L1–L5 unified architectural progression (`CITADEL_LEVEL_VARIANTS`, `clampCitadelLevel`, `getCitadelVisualSpec`) growing consistently along a shared basalt plinth (`2.38m–3.00m`), buttressed hall, flanking turrets, and crowned reliquary axis, exposing `portalArchTiers`, `hasPinnacles`, `hasWallArcading`, `hasQuoins`, `hasHeraldicShields`, `reliquaryRings`, and `weatheringStage`.
3. `apps/client/src/court/materials/citadelMaterials.ts` _(added)_ — deterministic `256×256` procedural PBR `DataTexture` generators (`basalt`, `dressed`, `timber`, `slate`, `iron`, `bone`, `bannerAlpha`, `sootOverlay`) with albedo + bump + roughness maps featuring chipped mortar joints, vertical rain/soot streaking, moss/lichen tinting, iron rivets & rust patches, StrictMode-safe `useCitadelTextureSet`, and isolated animated material prop factories.
4. `apps/client/src/court/buildings/citadel/citadelGeometry.ts` _(added)_ — `12` carved architectural geometries (`buttress`, `pointedArch`, `wimperg` with crockets, `trefoilTracery` with 3 pierced holes, `gableRoof`, openwork `flyingButtress`, `pinnacleSpire`, `heraldicShield`, `vaultRib`, `hornTrophy`, `crystal`, `crystalCore`) and StrictMode-safe `useCitadelGeometrySet`.
5. `apps/client/src/court/buildings/citadel/CitadelBuilding.tsx` _(added)_ — multi-tier Citadel L1–L5 composition featuring:
   - Deep-recessed Gothic portals (`CitadelPortal`) with open entrance niche revealing studded oak doors, forged-iron strap hinges, bronze door rings, raised toothed iron portcullis (L3–L5), 2–3 stepped archivolt frames with colonnettes, pierced trefoil tympanum, crocketed wimperg gable, heraldic shield, and horned skull bone trophies.
   - Staggered 3D corner quoins (on non-turret corners), blind wall arcading & recessed trefoil lancets across all 4 facades, stepped buttresses with pinnacles, octagonal bastion turrets (`rotation-y = Math.PI / 8` aligned flat-face embrasures, stone belt bands, ribbed spires), notched/chipped battlements, and openwork flying buttresses (L5).
   - Expressive octagonal necrotic reliquary crown (`NecroticReliquaryCrown`) evolving from a bronze-capped ridge lantern (L2) → 4-ribbed ossuary lantern (L3) → 8-ribbed Gothic baldachin with heraldic base shields, curved bone ossuary ribs, dual counter-rotating rune rings, multi-layer floating necrotic crystal, and sovereign crown spire (L4–L5).
   - Swallowtail ragged heraldic banners (`alphaMap` silhouette + emblem) positioned across side/rear bastions and sovereign spire so the central reliquary remains unobstructed in desktop & mobile framing.
6. `apps/client/src/court/buildings/citadel/CitadelRenderer.tsx` _(added)_ — variant selector (`"citadel"` / `"legacy"`) + `CitadelErrorBoundary` fallback to `CitadelLegacy.tsx`.
7. `apps/client/tests/citadelLevels.test.tsx` _(added)_ — focused Vitest suite (5 tests) covering `clampCitadelLevel`, unified L1–L5 architectural progression, `[3, 3]` footprint bounds (`stepReachZ <= 1.62m`), 18-texture & 12-geometry StrictMode disposal, and error-boundary fallback.
8. `docs/AI_COLLABORATION/handoffs/TDL-ARCH-006.md` _(this handoff)_ and `evidence/TDL-ARCH-006/` _(validation logs, health & smoke reports, 12 unedited browser screenshots including macro portal/masonry closeups)_.

## 4. Visual Progression L1 → L5 (Unified Architectural Growth)

- **Lv. 1 (`fortified-manor`):** Stepped basalt plinth & entry stairs, staggered 3D corner quoins, 2-tier recessed pointed portal with crocketed wimperg & heraldic crest, lateral stepped buttresses, blind gothic lancet arcades on all facades, overhanging charred-oak gallery with corbels, dark slate gable roof with stone front wimperg, hearth smoke.
- **Lv. 2 (`watchtower-hall`):** Elevated basalt keep, projecting gabled stone portal porch with soot-stained flanks, horned skull trophy & flanking braziers, steep slate hip-and-dormer roof, asymmetric octagonal watchtower, forged ridge lantern housing a nascent necrotic crystal.
- **Lv. 3 (`battlemented-keep`):** Full upper masonry bastion with notched battlements & corner pinnacles, 3-tier deep portal niche with raised toothed portcullis, twin front ribbed-spire corner turrets, rear hexagonal apse sanctuary with rib piers, central belfry tower crowned by a 4-ribbed ossuary reliquary & apex war standard.
- **Lv. 4 (`gothic-bastion`):** Full 4-corner octagonal bastion turret ring with stone parapet crowns & curved bone spurs, cruciform 4-gable crocketed roof, flanked turret war standards, 8-ribbed Gothic reliquary pavilion with curved bone ossuary ribs, heraldic base shields & rotating bronze rune ring.
- **Lv. 5 (`sovereign-necrotic-citadel`):** Sovereign cathedral-citadel silhouette on the same axis: taller ribbed-spire bastions, 4 openwork stone flying buttresses springing from the turrets onto the central Donjon, projecting twin-pylon barbican with bone skull trophies & tall braziers, weathered notched merlons, 4 swallowtail war standards (flanks, rear & sovereign crown spire), dual counter-rotating iron-bronze rune rings, and radiant necrotic core.

## 5. Validation Summary

- **Source verification:** Exact isolated clone of `1fd88f7569428fd138daec775184228f36f8b0f2` (`Node v22.22.3`, `pnpm 12.6.0`, `turbo 2.11.4`).
- `pnpm --filter @tdl/client test`: `exit_code=0` — `5` test files, `39/39` tests passed (`shell` `15`, `citadelLevels` `5`, `courtExtraction` `5`, `courtGridMath` `6`, `courtInput` `8`).
- `pnpm typecheck`: `exit_code=0` (`18/18` workspace packages).
- `pnpm check`: `exit_code=0` (`11` modules, boundaries clean, `24`/`126` i18n keys, `810` calendar windows).
- `pnpm build`: `exit_code=0` (`3/3` packages: `@tdl/server`, `@tdl/court3d`, `@tdl/client` `171` modules).
- `pnpm test`: `exit_code=0` — `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`; `@tdl/host` reported `88 passed | 2 failed` due to pre-existing calendar-dependent assertions on `2026-11-13` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`), matching `1fd88f75` baseline verbatim.
- **Production-preview runtime smoke (`NODE_ENV=production node apps/server/dist/index.mjs`, PostgreSQL 18.4, `HeadlessChrome` + ANGLE Vulkan `SwiftShader Device (Subzero)`):**
  - `13/13` checks passed (`allOk: true`): `desktopCourtLoad`, `rightHoldNoPickup`, `rightDragOrbit`, `leftLongPressPickup`, `leftDragPan`, `upgradeLv2`..`upgradeLv5` (authoritative server upgrades `Ур. 2`–`Ур. 5` persisted across reloads), `farmPlace` (`620 1364 2286 2258 312 4454`), `navigation` (`Court → Map → Court`), `touchLongPressPickup` (`390×844`), and `noHorizontalOverflow` (`false` at `1376×768`, `390×844`, `320×690`, zero HUD overlaps).
  - Visual inspection confirmed across all 12 unedited screenshots (`01..05` same-camera Lv1–Lv5 progression, `06` full court Lv5, `06b` portal close-orbit confirming visible oak doors/hardware/toothed portcullis, `06c` masonry macro closeup, `07` desktop pickup, `08–10` mobile 390/320 Lv5 & touch pickup).
  - `consoleErrors: 0`, `pageErrors: 0`, `failedRequests: 0`; 1 expected benign `webglcontextlost` on detached canvas unmount during `Court → Map` navigation.
  - **Device disclaimer:** No physical mobile device or hardware GPU is present in this sandbox; all browser renders and screenshots ran under headless SwiftShader emulation.

## 6. Post-Integration Verification on PR #28 (`a5fe323859455082b66eb61bc090b0e3796d3fc6`)

- **Evidence folder:** `evidence/TDL-ARCH-006-post/` (`README.md`, `commands.log`, `smoke-report.json`, `health.json`, `console.txt`, and 12 unedited screenshots in `screenshots/`).
- **Exact tested SHA:** `a5fe323859455082b66eb61bc090b0e3796d3fc6` on `PandaGarry/tg_bot` branch `refactor/tdl-court-grid-input-impl` (parent `1fd88f7569428fd138daec775184228f36f8b0f2`), tested in clean detached checkout `/tmp/tdl-arch006-post` with zero source edits, zero Turborepo cache hits, and zero PR mutations.
- **Integrity parity (`1fd88f7..a5fe323` & vs `c914565`):**
  - Exactly the 7 expected Citadel integration files changed/added (`+3364 / -3`).
  - Zero diff vs Arena v2 prototype `c9145652320a28582ee5367c4418be7984df4cb9` outside `docs/` and `evidence/`.
  - Zero diff vs `1fd88f7` across `gridMath.ts`, `courtInput.ts`, `courtGridMath.test.tsx`, `courtInput.test.tsx`, `package.json`, and `pnpm-lock.yaml`.
- **Automated checks (`commands.log`):**
  - `pnpm install --frozen-lockfile`: `exit_code=0`.
  - `pnpm --filter @tdl/client test`: `exit_code=0` (`5` files, `39/39` tests passed).
  - `pnpm typecheck`: `exit_code=0` (`18/18` packages, `0/18` cached).
  - `pnpm check`: `exit_code=0` (`11` modules, boundaries clean, `24`/`126` i18n keys, `810` calendar windows).
  - `pnpm build`: `exit_code=0` (`3/3` packages: `@tdl/server`, `@tdl/court3d`, `@tdl/client`, `0/3` cached).
  - `pnpm test`: `exit_code=0` (`0/6` cached) — `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`, `@tdl/court3d` & `@tdl/protocol` `--passWithNoTests`; `@tdl/host` reproduced the pre-existing `88 passed | 2 failed` calendar assertions on `2026-11-13` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`) — explicitly reported rather than claimed green.
- **Production runtime smoke (`smoke-report.json`, PostgreSQL 18.4, `HeadlessChrome` + SwiftShader):**
  - `13/13` checks passed (`allOk: true`): `desktopCourtLoad`, `rightHoldNoPickup`, `leftLongPressPickup`, `leftDragPan`, `upgradeLv2`..`upgradeLv5`, `rightDragOrbit`, `farmPlace` (`630 1364 2286 2258 318 4454`), `navigation` (`Court → Map → Court`), `touchLongPressPickup`, and `noHorizontalOverflow` (`false` at `1376×768`, `390×844`, `320×690`).
  - `consoleErrors: 0`, `pageErrors: 0`, `failedRequests: 0`; `console.txt` contains strictly 1 detached-canvas unmount event (`THREE.WebGLRenderer: Context Lost.` paired with `[tdl-webgl-probe] desktop contextlost inDom=false`) during `Court → Map`.
  - Unedited screenshots (`01`–`05`, `06`, `06b`, `06c`, `07`–`10`) inspected and confirmed across L1–L5 progression, portal depth/hardware/portcullis, masonry/buttresses/towers/reliquary, desktop/mobile touch interactions, and HUD clearance.
  - **Device disclaimer:** Verified under HeadlessChrome + ANGLE Vulkan SwiftShader emulation; no physical smartphone or hardware GPU is present in this sandbox.

## 7. R2 Architectural Overhaul — Ossuary Cathedral-Fortress (`evidence/TDL-ARCH-006-r2/`)

- **Objective & Architectural Pivot:** Reimagined the Citadel from a symmetrical 4-turret keep into an asymmetric dark-medieval **Ossuary Cathedral-Fortress** inspired by cathedral gothic ruins and dark citadel massing:
  - **Three-part asymmetrical silhouette:** (1) broad steep-roofed central **Nave Hall**, (2) projecting **Monumental Gatehouse** with gabled wimperg, recessed studded oak portals & flanking braziers, and (3) a soaring **Asymmetric Left Rear Belfry/Ossuary Tower** counterweighted by a **Right Side Chapel / Lean-to Transept** and **Polygonal Rear Apse**.
  - **Broken Ossuary Crown:** Iconic curved bone-and-iron rib crown (`crownRib` & `brokenCrownEmblem`) forming an open Gothic ossuary pavilion atop the tower at L4–L5 (housing the animated necrotic crystal and crowned spire standard), plus carved Broken Ossuary Crown relief crest in the front gatehouse wimperg across L1–L5.
  - **Dual Cascading Fallback:** Archived verified `a5fe323` v2 code under `apps/client/src/court/buildings/citadel/v2/` (`CitadelV2Building`, `citadelV2Levels`, `citadelV2Geometry`, `citadelV2Materials`), with `CitadelRenderer.tsx` cascading `R2 CitadelBuilding -> stable CitadelV2Building -> CitadelLegacy`.

- **R2 Code Scope (verified clean vs `a5fe323` — zero edits to server, `gridMath.ts`, `courtInput.ts`, `CourtEnvironment.tsx`, `CourtCamera.tsx`, `CourtScene.tsx`, `package.json`, or `pnpm-lock.yaml`):**
  1. `apps/client/src/court/buildings/citadel/citadelLevels.ts` — 5 distinct asymmetrical stages (`fortified-chapel-manor` → `watchtower-nave` → `apse-sanctuary-keep` → `charnel-cathedral` → `sovereign-ossuary-citadel`) strictly bounded inside the `[3, 3]` footprint (`3.30m × 3.30m`, `stepReachZ <= 1.62m < 1.65m`, max height `6.12m <= 6.20m`).
  2. `apps/client/src/court/buildings/citadel/citadelGeometry.ts` — 13 carved procedural geometries (`buttress`, `pointedArch`, `gableRoof`, `leanToRoof`, `flyingButtress`, `crownRib`, `brokenCrownEmblem`, `pinnacleSpire`, `heraldicShield`, `trefoilTracery`, `wimperg`, `crystal`, `crystalCore`) with StrictMode-safe disposal.
  3. `apps/client/src/court/materials/citadelMaterials.ts` — 17 deterministic `256×256` procedural PBR `DataTexture` maps (`wall` ashlar albedo/bump/roughness, `dressed` stone albedo/bump/roughness, `timber` charred oak albedo/bump, `slate` shingle albedo/bump, `iron` forged metal albedo/bump/roughness, `bone` aged ossuary albedo/bump, `banner` heraldic cloth + swallowtail `alphaMap`) calibrated with large readable courses and grime gradients at court distance.
  4. `apps/client/src/court/buildings/citadel/CitadelBuilding.tsx` — monolithic Three.js/R3F implementation with:
     - Open recessed Gothic gatehouse (`portalVoid` behind `doorZ - 0.08`, recessed oak door at `0.72 * portalVoidHeight` with 3 iron strap bands & bronze rings, open upper Gothic arch revealing pierced `trefoilTracery` & raised toothed iron portcullis, crocketed wimperg, Broken Ossuary Crown emblem, and restrained warm amber braziers).
     - Stepped nave buttresses, tall glowing hearth lancet windows, chimney with ascending ash smoke, right lean-to side chapel (L4–L5), polygonal rear apse (L3–L5), 2 openwork flying buttresses bridging nave to tower (L5), left corner belfry tower with belt cornices & buttresses, and `BrokenOssuaryCrownTop` at L4–L5.
  5. `apps/client/src/court/buildings/citadel/CitadelRenderer.tsx` & `v2/*` — dual-fallback boundary (`citadel` | `citadel-v2` | `legacy`).
  6. `apps/client/tests/citadelLevels.test.tsx` — expanded 5-test Vitest suite validating asymmetrical progression invariants, explicit `[3, 3]` bounds for every sub-mass (`nave`, `apse`, `sideChapel`, `tower`, `gatehouse`, `steps`), 17 textures + 13 geometries under `<StrictMode>`, and `R2 -> v2 -> Legacy` fallback behavior.

- **Two-Pass Craft & Verification (`evidence/TDL-ARCH-006-r2/`):**
  - **Pass A (`pass-a/`):** Blockout captures (`pass-a-lv1.png`..`pass-a-lv5.png`, `pass-a-contact-sheet.png`) confirming three-part silhouette & proportion growth prior to surface ornament.
  - **Pass B (`pass-b/`):** Final textured & lit captures (`pass-b-lv1.png`..`pass-b-lv5.png`, `pass-b-contact-sheet.png`, `pass-b-lv5-front-3q.png`, `pass-b-lv5-portal-closeup.png`, `pass-b-lv5-transept-side.png`, `pass-b-lv5-rear-side.png`, `pass-b-lv5-mobile-390x844.png`, `pass-b-before-lighting-lv5.png`, `pass-b-lighting-before-after.png`, `v2-vs-r2-comparison.png`, `v2-vs-r2-lv5-direct.png`).
  - **Automated checks & smoke (`smoke-report.json`, `health.json`):**
    - `pnpm --filter @tdl/client test`: `39/39` passed (`5` files, `citadelLevels` `5/5`).
    - `pnpm -r --filter '!@tdl/host' test`: all non-host workspace tests passed (`kernel` `44/44`, `client` `39/39`, `server` `34/34`, `court3d` & `protocol` `0` tests).
    - `pnpm --filter @tdl/host test`: `88/90 passed`, `2 failed` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303` — pre-existing calendar-date failures in unmodified `@tdl/host`).
    - `pnpm typecheck` (`18/18`), `pnpm check`, and `pnpm build` (`3/3`): all passed (`exit_code=0`).
    - Production runtime smoke against `apps/server/dist/index.mjs` + PostgreSQL `18.4` (`HeadlessChrome` + SwiftShader): `/api/health` (`ok: true`, `ready: true`), `desktopCourtLoad` (`Ур. 5`), `rightHoldNoPickup`, `leftLongPressPickup`, `navigation` (`Court → Map → Court`), and responsive layout checks (`1376×768`, `390×844`, `320×690`, zero horizontal overflow, zero HUD overlap) all passed with `0` console errors, `0` page errors, and `0` failed requests.

## 8. R2 Final Post-Integration Verification on PR #28 (`adcae02db92468d1a7cfce1e42e98ad51dbcf8cf`)

- **Evidence folder:** `evidence/TDL-ARCH-006-r2-post/` (`README.md`, `commands.log`, `smoke-report.json`, `health.json`, `console.txt`, and 18 unmodified runtime screenshots in `screenshots/`).
- **Exact tested integrated HEAD SHA:** `adcae02db92468d1a7cfce1e42e98ad51dbcf8cf` on `PandaGarry/tg_bot` branch `refactor/tdl-court-grid-input-impl` (parent `a5fe323859455082b66eb61bc090b0e3796d3fc6`, Arena R2 source `f71497b260ba4c11c8ba5f8a87e5a168380d6b94`), verified in clean detached checkout `/tmp/tdl-arch006-r2-post` with `0` source mutations and `0` PR commits.
- **Integrity parity (`a5fe323..adcae02` & vs `f71497b`):**
  - Exactly the 10 expected Citadel R2 + `v2/` files modified/added (`CitadelBuilding.tsx`, `CitadelRenderer.tsx`, `citadelGeometry.ts`, `citadelLevels.ts`, `citadelMaterials.ts`, `citadelLevels.test.tsx`, `v2/{CitadelV2Building,citadelV2Geometry,citadelV2Levels,citadelV2Materials}`).
  - Zero diff vs Arena source `f71497b` outside `docs/` and `evidence/`; zero diff vs `a5fe323` across `CourtScene.tsx`, `gridMath.ts`, `courtInput.ts`, their tests, `package.json`, and `pnpm-lock.yaml`.
- **Automated checks (`commands.log`):**
  - `pnpm install --frozen-lockfile`: `exit_code=0`.
  - `pnpm --filter @tdl/client test`: `exit_code=0` (`5` files, `39/39` passed).
  - `pnpm typecheck`: `exit_code=0` (`18/18` packages, `0/18` cached).
  - `pnpm check`: `exit_code=0` (`11` modules, clean boundaries, `24`/`126` i18n keys, `810` calendar windows).
  - `pnpm build`: `exit_code=0` (`3/3` bundles, `0/3` cached).
  - `pnpm test` (`0/6` cached, `exit_code=0`) & direct `pnpm --filter @tdl/host test`: `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`, `@tdl/court3d` & `@tdl/protocol` `0` tests; `@tdl/host` reproduced the pre-existing `88 passed | 2 failed` calendar assertions on `2026-11-13` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`) matching `a5fe323` verbatim — not claimed green.
- **Production smoke, fallback & resource audit (`smoke-report.json`, `console.txt`):**
  - All production E2E gates passed (`allProductionStepsOk: true`, `0` console errors, `0` page errors, `0` failed requests) across `1376×768`, `390×844`, and `320×690`, including real L2–L5 server upgrades, Farm placement, pure RMB orbit, LMB pan, LMB/touch long-press pickup, and 2× `Court → Map → Court` cycles.
  - WebGL2 live instrumentation confirmed `593` draws / `37,344` tris at Lv.1 and `846` draws / `56,544` tris at Lv.5 with zero leaked buffers across 2 unmount/remount cycles (`1795` live vs `1803` initial) and `contextlost` occurring strictly on detached `inDom=false` canvases during unmount.
  - External read-only Vite harness verified explicit `citadel-v2`, `legacy`, and cascading `CitadelErrorBoundary` transitions (`R2 fail → CitadelV2Building` and `R2 + v2 fail → LegacyTownHall`) preserving the surrounding Court scene without crashing (`screenshots/11..14`).
  - **Device disclaimer:** Verified under HeadlessChrome + ANGLE Vulkan SwiftShader CPU emulation; no 60 FPS or physical mobile hardware GPU claims are made.



