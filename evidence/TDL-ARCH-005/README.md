# TDL-ARCH-005 — Slice B1 Evidence (Safe `CourtScene.tsx` Extraction)

- **Implementation source PR / branch:** PR #28 (`refactor/tdl-court-grid-input-impl`)
- **Exact source SHA:** `db711655e870cfcbd1b337dd105a926d3da509fa`
- **Arena delivery branch:** `arena/ff89979b-tg-bot` (parent `2fe9261f08ddfb1b322ad26ddc3f1b82d509e84`; code outside `apps/client/src/court/` and `apps/client/tests/courtExtraction.test.tsx` matches `db71165` identically, verified with `diff -rq`: `DIFF_EXIT=0`)
- **Runtime mode:** Production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving `apps/client/dist`) with embedded PostgreSQL (`pnpm dev:db`)
- **Tooling:** Node `v22.22.3`, pnpm `12.6.0`, turbo `2.11.4`, `puppeteer-core@25.12.0` + `@sparticuz/chromium@153.0.0`, ANGLE Vulkan SwiftShader (`WebGL 2.0`), CPU software rasterizer

---

## 1. Environment & Scope Disclaimers

1. **Headless SwiftShader emulation (no physical device/GPU):** All desktop (`1376×768`) and mobile (`390×844`, `320×690`, `isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 2`) visual captures ran under CPU SwiftShader WebGL emulation. No physical iOS/Android GPU or hardware browser was available in this sandbox.
2. **Pre-existing `@tdl/host` calendar test failures (honestly reported):** On system date `2026-11-12`, both baseline (`db71165`) and post-extraction `pnpm test` runs emit `2 failed | 88 passed` in `@tdl/host` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`) while Vitest / Turborepo exit with code `0` (`BASELINE_PNPM_TEST_EXIT=0`, `AFTER_PNPM_TEST_EXIT=0`). All `@tdl/kernel` (`44/44`), `@tdl/client` (`29/29` before, `34/34` after including 5 new extraction tests), and `@tdl/server` (`34/34`) suites passed with 0 assertion failures.
3. **Unchanged PR #28 scope & constraints:** `package.json`, `pnpm-lock.yaml`, `gridMath.ts`, `courtInput.ts`, `courtGridMath.test.tsx`, `courtInput.test.tsx`, `shell.test.tsx`, HUD/UI, economy, server/protocol contracts, and public assets were not altered.

---

## 2. Structural Extraction Summary

`apps/client/src/court/CourtScene.tsx` was decomposed from **1,909 lines** to **113 lines** (root composition component):

| Module | Lines | Responsibility |
| --- | ---: | --- |
| `apps/client/src/court/CourtScene.tsx` | 113 | Root composition `<Canvas>` + lighting + fog + scene subtrees |
| `apps/client/src/court/materials/palette.ts` | 89 | Exact legacy `PALETTE` (`C`) and `ACCENT_COLORS` |
| `apps/client/src/court/materials/MaterialRegistry.ts` | 194 | Immutable R3F material spec registry preserving exact scalar values (`roughness`, `metalness`, `opacity`, `side`, `depthWrite`, `emissiveIntensity`, `flatShading`) and runtime instance lifecycle |
| `apps/client/src/court/performance/qualityProfiles.ts` | 64 | `DEFAULT_QUALITY_PROFILE` preserving `dpr: [1, 1.75]`, `shadows: true`, `ACESFilmicToneMapping`, `toneMappingExposure: 1.12`, camera & shadow frustum |
| `apps/client/src/court/scene/WebglFallback.tsx` | 23 | `webglAvailable()` and `<WebglFallback />` with `court-fallback.jpg` |
| `apps/client/src/court/scene/CourtCamera.tsx` | 130 | Isometric `CameraRig` & zoom/focus clamping |
| `apps/client/src/court/scene/CourtInteraction.tsx` | 248 | `GridOverlay` (with `BufferGeometry` unmount/StrictMode cleanup), `PlacementGhost`, and pointer/touch binding onto `createCourtInputController` & `gridMath` |
| `apps/client/src/court/scene/CourtEnvironment.tsx` | 570 | `Ground` (using `worldToCell(x, z, grid?.size ?? 14)` instead of hardcoded `+ 6.5`; disposes all 26 `ShapeGeometry` patches cleanly on unmount and under React `<StrictMode>`), `Road`, `Gatehouse`, `Palisade`, `Meadow`, `Snowflakes`, `Birds` |
| `apps/client/src/court/buildings/citadel/CitadelLegacy.tsx` | 188 | Legacy `TownHall` and `RoofBanner` |
| `apps/client/src/court/buildings/legacy/LegacyBuildings.tsx` | 732 | Legacy `BuildingBody`, `BuildingEntry`, `Buildings`, `Smoke`, `Dust`, and shared `LanternFlame` |
| `apps/client/tests/courtExtraction.test.tsx` | 128 | 5 unit tests covering palette/material parity, `qualityProfiles`, `worldToCell` equivalence, 26 `ShapeGeometry` unmount & `<StrictMode>` disposal, and `WebglFallback` |

---

## 3. Lifecycle & Follow-up Notes

- **26 `ShapeGeometry` snow patches & `GridOverlay` `BufferGeometry`:** Both `Ground` (`CourtEnvironment.tsx`) and `GridOverlay` (`CourtInteraction.tsx`) create geometry via `useState` and dispose on unmount in `useEffect`, marking `userData.__tdlDisposed` so React `<StrictMode>` simulated unmount → remount regenerates live geometries without retaining disposed buffers or leaking on true unmount. Verified in `courtExtraction.test.tsx`.
- **Shared `THREE.Material` pooling:** `MaterialRegistry.ts` centralizes immutable material specs while preserving per-`<mesh>` R3F material instance lifecycles so animated/mutated materials (`Smoke`, `TownHall` chimney smoke, `Dust`, `LanternFlame`, `Palisade` `instanceColor`) do not mutate shared instances. Converting static meshes to pooled shared `THREE.Material` instances with reference-counted disposal is documented as a safe follow-up in `MaterialRegistry.ts` and `TDL-ARCH-005.md`.

---

## 4. Before / After Gate & Pixel-Diff Results

### Functional & Layout Gates (`smoke-report.json`)

| Gate | Before (`db71165`) | After (Slice B1) | Notes |
| --- | --- | --- | --- |
| `desktopCourtLoad` (`1376×768`) | `ok: true` | `ok: true` | Canvas rendered, 0 errors |
| `leftDragPan` | `ok: true` | `ok: true` | `triggeredPickup: false`, `visualChanged: true` |
| `rightHoldNoPickup` | `ok: true` | `ok: true` | `triggeredPickup: false` |
| `rightDragOrbit` | `ok: true` | `ok: true` | `triggeredPickup: false`, `visualChanged: true` |
| `leftLongPressPickup` | `ok: true` | `ok: true` | TownHall pickup & Cancel verified |
| `farmPlace` | `ok: true` | `ok: true` | Post-placement resources identical: `"610 552 378 204 306 102"` |
| `upgradeLv2` | `ok: true` | `ok: true` | `"Ур. 2"`, Lv.2 Citadel geometry rendered |
| `navigation` (`Court → Map → Court`) | `ok: true` | `ok: true` | Remounts cleanly after intentional R3F unmount cleanup |
| `touchLongPressPickup` (`390×844`) | `ok: true` | `ok: true` | Touch pickup verified |
| `noHorizontalOverflow` (`1376×768`, `390×844`, `320×690`) | `ok: true` | `ok: true` | 0 horizontal overflow, 0 HUD overlaps |
| `consoleErrors` / `pageErrors` / `failedRequests` | `0 / 0 / 0` | `0 / 0 / 0` | Clean in both runs |
| `webglContextEvents` | `1` on `Court → Map` (`inDom: false`) | `1` on `Court → Map` (`inDom: false`) | Benign R3F `forceContextLoss()` on `<Canvas />` unmount (see `TDL-ARCH-003`) |

### Pixel-Diff Analysis (`screenshots/before-*`, `after-*`, `diff-*`)

Differences across all 10 viewport/state captures are strictly sub-0.12% pixels caused by frame-phase drift of continuous `useFrame` clock animations (flying `Birds`, chimney `Smoke` puffs, and `Farm` `Windmill` blade rotation); static terrain, snow patches, palisade, trees, buildings, lighting, shadows, and HUD are pixel-identical:

| Screenshot | Resolution | Mean Abs Channel Diff (`/255`) | Pixels Diff > 0 (%) | Pixels Diff > 24 (%) |
| --- | --- | ---: | ---: | ---: |
| `01-desktop-court-full-lv1.png` | `1376×768` | `0.0303` | `0.0784%` | `0.0220%` |
| `02-desktop-right-orbit-no-pickup.png` | `1376×768` | `0.0046` | `0.1051%` | `0.0009%` |
| `03-desktop-left-longpress-pickup.png` | `1376×768` | `0.0332` | `0.1279%` | `0.0301%` |
| `04-desktop-farm-grid.png` | `1376×768` | `0.0054` | `0.0894%` | `0.0073%` |
| `05-desktop-farm-placed.png` | `1376×768` | `0.0417` | `0.1819%` | `0.0749%` |
| `06-desktop-upgrade-lv2.png` | `1376×768` | `0.0516` | `0.1663%` | `0.0594%` |
| `06b-desktop-returned-from-map.png` | `1376×768` | `0.0881` | `0.1932%` | `0.1030%` |
| `07-mobile-390-full.png` | `780×1688` | `0.0940` | `0.3979%` | `0.0753%` |
| `08-mobile-390-touch-pickup.png` | `780×1688` | `0.1011` | `0.3947%` | `0.0855%` |
| `09-mobile-320-full.png` | `640×1380` | `0.1120` | `0.3858%` | `0.0956%` |
