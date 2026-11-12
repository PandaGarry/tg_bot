# TDL-ARCH-006 — Citadel Visual Prototype (L1–L5) Validation & Evidence

- **Exact source SHA tested against:** `1fd88f7569428fd138daec775184228f36f8b0f2` (PR #28 `refactor/tdl-court-grid-input-impl`, isolated detached clone in `/tmp/tdl-arch006-src`; PR #28 & PR #26 refs untouched)
- **Arena delivery branch:** `arena/ff89979b-tg-bot`
- **Runtime mode:** Fresh production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving compiled `apps/client/dist`) + live PostgreSQL (`pnpm dev:db`)
- **Browser / WebGL environment:** `puppeteer-core@25.12.0` + `@sparticuz/chromium@153.0.0` (`HeadlessChrome` / ANGLE Vulkan `SwiftShader Device (Subzero)`, `WebGL 2.0`)

---

## 1. Environment & Integrity Disclaimers

1. **Headless SwiftShader emulation (no physical device / GPU):** Desktop (`1376×768`) and mobile (`390×844` @ 2× DPR, `320×690` @ 2× DPR, `isMobile: true`, `hasTouch: true`) checks ran under CPU SwiftShader WebGL emulation. No physical smartphone or hardware GPU was present in this sandbox; all screenshots are genuine, unedited browser runtime captures (`page.screenshot`).
2. **Pre-existing `@tdl/host` calendar test failures (honestly reported):** On sandbox date `2026-11-12`, `pnpm test` (`exit_code=0`) reports `2 failed | 88 passed` in `@tdl/host` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`), matching the pre-existing `1fd88f7569428fd138daec775184228f36f8b0f2` baseline verbatim.
3. **Production-path stock grant for L3–L5 screenshot upgrades:** Upgrades L1→L2→L3→L4→L5 executed via the real HUD upgrade button (`button.th-up` → server `court.upgrade` WebSocket command → authoritative `court_holder.level` persistence). Because starting court stock (`600/600/400/200/300/100`) covers L1→L2 only, the smoke harness topped up `stock` in PostgreSQL (`stockOf()` reads the `stock` table directly) strictly to unlock the real server-validated L3/L4/L5 upgrades without altering domain costs (`TH_COSTS`) or client UI.

---

## 2. Scoped Changes vs `1fd88f7569428fd138daec775184228f36f8b0f2`

Verified via `diff -rq -x node_modules -x .git -x .devdb -x dist -x .turbo -x .env -x docs -x evidence` (`exit_code=0`):

- **Modified (1 file):** `apps/client/src/court/CourtScene.tsx` (+5 / -3 lines) — exports `CitadelRenderVariant`, accepts optional `citadelVariant = "citadel"`, and renders `<CitadelRenderer level={thLevel} grid={resolvedGrid} variant={citadelVariant} />` from authoritative `thLevel`.
- **Added source modules (5 files):**
  - `apps/client/src/court/buildings/citadel/citadelLevels.ts` — explicit L1–L5 typed architectural spec map (`CITADEL_LEVEL_VARIANTS`, `clampCitadelLevel`, `getCitadelVisualSpec`), keeping all `[3, 3]` footprint extents within `3.16m × 5.98m × 3.24m` (`stepReachZ <= 1.61m < 1.65m` cell edge).
  - `apps/client/src/court/buildings/citadel/citadelMaterials.ts` — deterministic procedural `Uint8Array` `DataTexture` maps (`basalt`, `dressed`, `timber`, `slate`, `iron`, `banner` albedo + bump) with React StrictMode-safe unmount disposal, palette tokens, and isolated per-instance animated material factories.
  - `apps/client/src/court/buildings/citadel/citadelGeometry.ts` — shared extruded architectural geometries (`steppedButtress`, `pointedArch`, `gableRoof`, `flyingButtress`, `crystal`) built once per mount and disposed safely.
  - `apps/client/src/court/buildings/citadel/CitadelBuilding.tsx` — multi-part dark-medieval Citadel L1–L5 renderer (all 4 facades, rear sanctuary apse, stepped buttresses, half-timber & corbels, corner octagonal bastion turrets, gothic lancets, portcullis/barbican, flying buttresses, necrotic crystal reliquary crown, braziers, hearth chimney smoke, and war banners).
  - `apps/client/src/court/buildings/citadel/CitadelRenderer.tsx` — switcher (`"citadel"` default / `"legacy"` fallback) wrapped in `CitadelErrorBoundary` falling back cleanly to unmodified `CitadelLegacy.tsx`.
- **Added focused unit tests (1 file):** `apps/client/tests/citadelLevels.test.tsx` (5 tests covering clamping, L1–L5 silhouette & feature progression, `[3, 3]` bounds invariants, `DataTexture`/geometry StrictMode disposal, and error-boundary fallback to `CitadelLegacy`).

---

## 3. Command Results

| Command | Exit Code | Result |
| --- | ---: | --- |
| `pnpm --filter @tdl/client test` | `0` | `5` files, `39/39` tests passed (`shell` `15`, `citadelLevels` `5`, `courtExtraction` `5`, `courtGridMath` `6`, `courtInput` `8`) |
| `pnpm typecheck` | `0` | `18/18` workspace packages passed (`tsc -p tsconfig.json --noEmit`) |
| `pnpm check` | `0` | Registry (`11` modules), boundaries (`0` violations), i18n (`24`/`126` keys), calendar (`810` windows) passed |
| `pnpm build` | `0` | `3/3` apps built cleanly (`@tdl/server`, `@tdl/court3d`, `@tdl/client` `171` modules) |
| `pnpm test` | `0` | `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`; `@tdl/host` `88 passed \| 2 failed` (pre-existing calendar assertions `clock.test.ts:71`, `switches.test.ts:303`) |
| `npx tsx /tmp/tdl-arch006-smoke.mjs` | `0` | `13/13` production-preview smoke checks green; `consoleErrors: 0`, `pageErrors: 0`, `failedRequests: 0` |

---

## 4. Visual Progression & Baseline Comparison (vs `evidence/TDL-ARCH-005-post`)

Compared directly against the `1fd88f7` legacy baseline (`evidence/TDL-ARCH-005-post/screenshots/01-desktop-court-full-lv1.png` & `06-desktop-upgrade-lv2.png`, where Town Hall was three flat-shaded snowy boxes with an added gold band at L2):

| Screenshot | State Captured | Visual Verification |
| --- | --- | --- |
| `01-desktop-citadel-lv1.png` | Desktop `1376×768`, Lv. 1 | Fortified basalt base, stepped corner buttresses, overhanging dark-oak half-timber gallery with visible timber corbels, dark slate pitched gable roof, hearth chimney smoke, stepped stone entry portal. |
| `02-desktop-citadel-lv2.png` | Desktop `1376×768`, Lv. 2 | Steep slate hip+dormer roof, tall asymmetric front watchtower with collar, projecting stone gatehouse porch, bronze keystone, flanking flickering braziers. |
| `03-desktop-citadel-lv3.png` | Desktop `1376×768`, Lv. 3 | Twin front octagonal bastion turrets, crenelated stone battlements, iron portcullis spears, raised central keep belfry with glowing emerald lancet, slate spire, and apex crimson banner. |
| `04-desktop-citadel-lv4.png` | Desktop `1376×768`, Lv. 4 | Full 4-corner bastion turret ring with crown rings, taller cruciform 4-gable gothic roof inside battlements, gothic portcullis + 2 turret-apex war banners, open necrotic crystal crown. |
| `05-desktop-citadel-lv5.png` | Desktop `1376×768`, Lv. 5 | Sovereign Necrotic Citadel: taller stone bastions with forged waist & bronze eave collars, 4 exterior arched stone flying buttresses bracing the Donjon, projecting barbican gatehouse with twin pylons & tall braziers, bone finials, 4 war banners, and radiant emerald crystal crown. |
| `06-desktop-court-full-lv5.png` | Desktop `1376×768`, Lv. 5 + Farm | Full courtyard composition confirming scale harmony alongside legacy Farm, gatehouse, palisade, road, and HUD. |
| `06b-desktop-citadel-lv5-orbit-side.png` | Desktop `1376×768`, Rear/Flank Orbit | Right-drag camera orbit verifying complete rear & flank architectural detailing (octagonal apse sanctuary, stepped buttresses, recessed lancet windows, rear corner bastions). |
| `07-desktop-left-longpress-pickup.png` | Desktop `1376×768`, Lv. 1 Pickup | Left long-press pickup triggers `[3, 3]` selection ghost (`Подтвердить` / `Отмена`) strictly bounded inside the 3×3 cell footprint. |
| `08-mobile-390-lv5.png` | Mobile `390×844` (2× DPR), Lv. 5 | Crisp ashlar stone textures, flying buttresses, iron muntins, and clean clearance below top HUD (`horizontalOverflow: false`, `overlapTopNav: false`). |
| `09-mobile-390-touch-pickup.png` | Mobile `390×844`, Touch Pickup | Touch long-press enters move/pickup mode cleanly within the 3×3 plot (`Подтвердить` / `Отмена`). |
| `10-mobile-320-lv5.png` | Mobile `320×690` (2× DPR), Lv. 5 | Narrow viewport framing cleanly inside safe area (`horizontalOverflow: false`, `overlapLordRes: false`, `overlapTopNav: false`). |
