# TDL-ARCH-005 — Slice B1: безопасная декомпозиция CourtScene

> **Статус:** DONE (delivered on Arena branch for independent review and selective integration)  
> **Delivery branch:** `arena/ff89979b-tg-bot` (фиксированная сессионная ветка; не переключалась)  
> **Implementation source:** PR #28, branch `refactor/tdl-court-grid-input-impl`  
> **Exact source SHA:** `db711655e870cfcbd1b337dd105a926d3da509fa`  
> **Parent architecture source:** PR #26 @ `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
> **Accepted audit:** TDL-ARCH-004 @ `228915caba204df90ed54477066c38fdd86f4c20`

## 1. Mission

Implement the smallest safe structural extraction of `apps/client/src/court/CourtScene.tsx` while preserving the exact current runtime appearance and all gameplay/input behavior. This is an engineering foundation task, **not** the visual redesign milestone.

Work from an isolated clone of the exact PR #28 source SHA above. Do not assume the Arena delivery branch itself contains that application source state. Keep the existing fixed Arena session branch; do not attempt branch switching.

## 2. Hard constraints

- No new npm dependencies; do not modify `package.json` or lockfiles.
- No new 3D models, textures, generated images, or asset replacements.
- No changes to economy, server state, domain rules, protocol contracts, or building footprints.
- Do not remove public assets or alter HUD/UI.
- Preserve PR #28's `gridMath.ts`, `courtInput.ts`, and tests exactly unless a strictly necessary integration fix is demonstrated and separately documented.
- Preserve old colors, material scalar values, camera defaults, grid layout, placement, upgrade, pointer/touch semantics, and mobile layout.
- Do not merge PR #26/#28, force-push, or alter their refs.
- Never describe a headless screenshot as a physical-device GPU result.

## 3. Implementation scope (completed)

Extracted from exact source SHA `db711655e870cfcbd1b337dd105a926d3da509fa` into cohesive modules under `apps/client/src/court/` (with `CourtScene.tsx` reduced from `1,909` to `113` lines):

1. `scene/CourtCamera.tsx` (`130` lines) — camera rig, damping, zoom clamping, and focus offset behavior preserved 1:1.
2. `scene/CourtEnvironment.tsx` (`570` lines) — `Ground`, `Road`, `Gatehouse`, `Palisade`, `Meadow`, `Snowflakes`, `Birds`, and `CourtEnvironment`. Replaced both hardcoded `+ 6.5` offsets in `Ground` with `worldToCell(x, z, grid?.size ?? 14)`. Added `useState` + `useEffect` unmount/StrictMode-safe disposal for all `26` `ShapeGeometry` snow patch allocations (`userData.__tdlDisposed`).
3. `scene/CourtInteraction.tsx` (`248` lines) — `GridOverlay` (with `BufferGeometry` unmount/StrictMode-safe disposal), `PlacementGhost`, and pointer/touch event wiring delegating directly to unmodified PR #28 `courtInput.ts` and `gridMath.ts`.
4. `scene/WebglFallback.tsx` (`23` lines) — `webglAvailable()` and `WebglFallback`, retaining `court-fallback.jpg` and localized `texts.nowebgl`.
5. `materials/palette.ts` (`89` lines) and `materials/MaterialRegistry.ts` (`194` lines) — extracted `PALETTE` (`C`), `ACCENT_COLORS`, and centralized immutable R3F material spec definitions preserving exact scalar values (`roughness`, `metalness`, `opacity`, `side`, `depthWrite`, `emissiveIntensity`, `flatShading`). Preserved per-`<mesh>` R3F instance lifecycles so animated opacity/emissive mutations (`Smoke`, `TownHall` chimney smoke, `Dust`, `LanternFlame`) and `Palisade` `instanceColor` remain isolated; shared `THREE.Material` pooling is documented as a follow-up in `MaterialRegistry.ts`.
6. `buildings/citadel/CitadelLegacy.tsx` (`188` lines) — legacy `TownHall` and `RoofBanner` preserved 1:1.
7. `buildings/legacy/LegacyBuildings.tsx` (`732` lines) — legacy `BuildingBody`, `BuildingEntry`, `Buildings`, `Smoke`, `Dust`, and shared `LanternFlame` (imported by `CourtEnvironment.tsx` to keep module dependency graph acyclic).
8. `performance/qualityProfiles.ts` (`64` lines) — `DEFAULT_QUALITY_PROFILE` preserving `dpr: [1, 1.75]`, `shadows: true`, `ACESFilmicToneMapping`, `toneMappingExposure: 1.12`, camera, and shadow frustum/bias parameters.
9. `apps/client/tests/courtExtraction.test.tsx` (`128` lines) — unit coverage for palette/material specs, `qualityProfiles`, `worldToCell` parity (`size=14` and scaled `size=16`), 26 `ShapeGeometry` unmount + React `<StrictMode>` disposal, and `WebglFallback`.

`package.json`, `pnpm-lock.yaml`, `gridMath.ts`, `courtInput.ts`, `courtGridMath.test.tsx`, `courtInput.test.tsx`, `shell.test.tsx`, HUD/UI, and public assets remain untouched (`diff -rq` outside extracted modules and new test file = 0).

## 4. Validation summary

- **Source verification:** Exact clone of `db711655e870cfcbd1b337dd105a926d3da509fa` (`Node v22.22.3`, `pnpm 12.6.0`, `turbo 2.11.4`).
- `pnpm install --frozen-lockfile`: `exit_code=0`.
- `pnpm --filter @tdl/client test`: `exit_code=0` — `4` test files, `34/34` tests passed (`shell.test.tsx` `15/15`, `courtGridMath.test.tsx` `6/6`, `courtInput.test.tsx` `8/8`, `courtExtraction.test.tsx` `5/5`).
- `pnpm typecheck`: `exit_code=0` (`18/18` packages).
- `pnpm check`: `exit_code=0` (registry, boundaries, i18n, schedule).
- `pnpm build`: `exit_code=0` (`3/3` apps built cleanly).
- `pnpm test`: `exit_code=0` — `@tdl/kernel` `44/44`, `@tdl/client` `34/34` (uncached), `@tdl/server` `34/34`; `@tdl/host` reported `88 passed | 2 failed` due to pre-existing date-dependent calendar assertions (`tests/clock.test.ts:71`, `tests/switches.test.ts:303` on system date `2026-11-12`, identical before and after extraction).
- **Production-preview Playwright/Puppeteer smoke (`NODE_ENV=production`, ANGLE Vulkan SwiftShader, headless Chromium `153.0.8010.0`):**
  - Before (`db71165`): `BEFORE_SMOKE_EXIT=0`, 10/10 gates passed, 0 console/page/request errors.
  - After (Slice B1): `AFTER_SMOKE_EXIT=0`, 10/10 gates passed (`1376×768` load, left-drag pan, right-hold no pickup, right-drag orbit, left long-press pickup, farm placement with identical post-placement resources `"610 552 378 204 306 102"`, TownHall Lv2 upgrade `"Ур. 2"`, Court→Map→Court navigation, `390×844` touch long-press pickup, no horizontal overflow or HUD overlap at `1376×768`, `390×844`, `320×690`), 0 console/page/request errors, 1 benign intentional R3F `webglcontextlost` (`inDom: false`) on Court→Map unmount.
  - Pixel-diff across all 10 before/after screenshot pairs shows `meanAbsChannelDiff` between `0.0046` and `0.1120` (`/255`), with `diff-*` frames completely `#000000` apart from continuous `useFrame` phase offsets (flying birds, smoke puffs, windmill rotation).
  - **Device disclaimer:** No physical mobile device or hardware GPU is present in this sandbox; all browser and mobile checks ran under headless SwiftShader emulation.

## 5. Evidence and deliverables

Committed on `arena/ff89979b-tg-bot`:

- `apps/client/src/court/CourtScene.tsx` and extracted modules under `apps/client/src/court/{materials,performance,scene,buildings}/`
- `apps/client/tests/courtExtraction.test.tsx`
- `docs/AI_COLLABORATION/handoffs/TDL-ARCH-005.md`
- `evidence/TDL-ARCH-005/README.md`
- `evidence/TDL-ARCH-005/smoke-report.json`
- `evidence/TDL-ARCH-005/health.json`
- `evidence/TDL-ARCH-005/commands.log`
- `evidence/TDL-ARCH-005/console.txt`
- `evidence/TDL-ARCH-005/screenshots/` (`before-*`, `after-*`, and `diff-*` pairs across `1376×768`, `390×844`, and `320×690`)

## 6. Post-integration validation (PR #28 @ `1fd88f7569428fd138daec775184228f36f8b0f2`)

- **Integrated PR #28 HEAD verified:** `1fd88f7569428fd138daec775184228f36f8b0f2` (parent `db711655e870cfcbd1b337dd105a926d3da509fa`), isolated clone validation recorded in `evidence/TDL-ARCH-005-post/`.
- **Input/grid preservation:** `gridMath.ts` (`2e68bdbed98be0b4ffc19e80801f11ee39045001`), `courtInput.ts` (`0c376fa4ebfac8fb5cfc2b24eab01941247348eb`), their tests, `package.json`, and `pnpm-lock.yaml` have zero diff vs `db711655e870cfcbd1b337dd105a926d3da509fa`.
- **Checks (0 cached):** `pnpm install --frozen-lockfile`, `pnpm --filter @tdl/client test` (`4/4` files, `34/34`), `pnpm typecheck` (`18/18`), `pnpm check`, `pnpm build` (`3/3`), and `pnpm test` (`@tdl/kernel` `44/44`, `@tdl/client` `34/34`, `@tdl/server` `34/34`; pre-existing `@tdl/host` `88 passed | 2 failed` calendar assertions on `2026-11-12` at `clock.test.ts:71` & `switches.test.ts:303`) all ran cleanly.
- **Production-preview runtime smoke (`NODE_ENV=production`, headless Chromium + SwiftShader):** `10/10` gates passed (`1376×768`, `390×844`, `320×690`), `0` console/page/request errors, `1` benign `inDom: false` R3F `webglcontextlost` on Court→Map unmount. Ready for next gate (`TDL-ARCH-006`).

