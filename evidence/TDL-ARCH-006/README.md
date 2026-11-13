# TDL-ARCH-006 — Citadel Visual Prototype v2 (L1–L5) Validation & Evidence

- **Exact source SHA tested against:** `1fd88f7569428fd138daec775184228f36f8b0f2` (PR #28 `refactor/tdl-court-grid-input-impl`, isolated detached clone in `/tmp/tdl-arch006-v2`; PR #28 & PR #26 refs untouched)
- **Arena delivery branch:** `arena/ff89979b-tg-bot`
- **Runtime mode:** Fresh production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving compiled `apps/client/dist`) + live PostgreSQL 18.4 (`pnpm dev:db`)
- **Browser / WebGL environment:** `puppeteer-core@25.12.0` + `@sparticuz/chromium@153.0.0` (`HeadlessChrome` / ANGLE Vulkan `SwiftShader Device (Subzero)`, `WebGL 2.0`)

---

## 1. Environment & Integrity Disclaimers

1. **Headless SwiftShader emulation (no physical device / GPU):** Desktop (`1376×768`) and mobile (`390×844` @ 2× DPR, `320×690` @ 2× DPR, `isMobile: true`, `hasTouch: true`) checks ran under CPU SwiftShader WebGL emulation. No physical smartphone or hardware GPU was present in this sandbox; all screenshots are genuine, unedited browser runtime captures (`page.screenshot`).
2. **Pre-existing `@tdl/host` calendar test failures (honestly reported):** On sandbox date `2026-11-12` / `2026-11-13`, `pnpm test` (`exit_code=0`) reports `2 failed | 88 passed` in `@tdl/host` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`), matching the pre-existing `1fd88f7569428fd138daec775184228f36f8b0f2` baseline verbatim.
3. **Production-path stock grant for L3–L5 screenshot upgrades:** Upgrades L1→L2→L3→L4→L5 executed via the real HUD upgrade button (`button.th-up` → server `court.upgrade` WebSocket command → authoritative `court_holder.level` persistence). Because starting court stock (`600/600/400/200/300/100`) covers L1→L2 only, the smoke harness topped up `stock` in PostgreSQL (`stockOf()` reads the `stock` table directly) strictly to unlock the real server-validated L3/L4/L5 upgrades without altering domain costs (`TH_COSTS`) or client UI.

---

## 2. Scoped Changes vs `1fd88f7569428fd138daec775184228f36f8b0f2`

Verified via `diff -rq -x node_modules -x .git -x .devdb -x dist -x .turbo -x .env -x docs -x evidence` (`exit_code=0`):

- **Modified (1 file):** `apps/client/src/court/CourtScene.tsx` (+5 / -3 lines) — exports `CitadelRenderVariant`, accepts optional `citadelVariant = "citadel"`, and renders `<CitadelRenderer level={thLevel} grid={resolvedGrid} variant={citadelVariant} />` from authoritative `thLevel`.
- **Added source modules (5 files):**
  - `apps/client/src/court/buildings/citadel/citadelLevels.ts` — explicit L1–L5 typed architectural spec map (`CITADEL_LEVEL_VARIANTS`, `clampCitadelLevel`, `getCitadelVisualSpec`) tracing a unified vertical evolution across one basalt plinth → fortified hall → flanking towers → ribbed vaults/buttresses → cathedral-citadel axis (`plinthSize` `2.38m–3.00m`, `stepReachZ <= 1.62m < 1.65m`, max height `6.08m <= 6.2m`, `portalArchTiers`, `hasPinnacles`, `hasWallArcading`, `hasQuoins`, `hasHeraldicShields`, `reliquaryRings`, `weatheringStage`).
  - `apps/client/src/court/materials/citadelMaterials.ts` — deterministic `256×256` procedural `Uint8Array` `DataTexture` maps (`18` textures total: albedo, bump, and roughness for basalt, dressed stone, and forged iron; gothic slate albedo+bump; studded charred oak albedo+bump; aged bone albedo+bump; swallowtail banner albedo+`alphaMap`; vertical soot overlay) with React StrictMode-safe unmount disposal.
  - `apps/client/src/court/buildings/citadel/citadelGeometry.ts` — `12` shared procedural `BufferGeometry` primitives (`buttress`, `pointedArch`, `wimperg` with carved crockets, `trefoilTracery` with 3 pierced holes, `gableRoof`, openwork `flyingButtress` with spandrel hole, `pinnacleSpire`, `heraldicShield`, `vaultRib`, `hornTrophy`, `crystal`, `crystalCore`) built once per mount and disposed cleanly.
  - `apps/client/src/court/buildings/citadel/CitadelBuilding.tsx` — multi-tier Gothic Citadel L1–L5 renderer: recessed deep-niche portals with 2–3 nested archivolts, side columns, pierced trefoil tympanums, crocketed wimperg gables, forged-iron studded oak gates & raised toothed portcullis, staggered corner quoins, recessed blind wall arcades & trefoil lancets on all 4 facades, buttresses with carved pinnacles, openwork flying buttresses (L5), octagonal bastion turrets aligned cleanly on flat faces with chamfered slit embrasures & ribbed spires, notched weathered battlements, 3D heraldic shields, horned skull bone trophies, soot stains, swallowtail banners (`alphaMap`), and an octagonal ribbed reliquary sanctuary with floating multi-layer crystal and counter-rotating rune rings.
  - `apps/client/src/court/buildings/citadel/CitadelRenderer.tsx` — switcher (`"citadel"` default / `"legacy"` fallback) wrapped in `CitadelErrorBoundary` falling back cleanly to unmodified `CitadelLegacy.tsx`.
- **Added focused unit tests (1 file):** `apps/client/tests/citadelLevels.test.tsx` (5 tests covering clamping, L1–L5 unified progression & feature flags, `[3, 3]` bounds invariants, 18-texture & 12-geometry StrictMode disposal, and error-boundary fallback to `CitadelLegacy`).

---

## 3. Command Results

| Command | Exit Code | Result |
| --- | ---: | --- |
| `pnpm --filter @tdl/client test` | `0` | `5` files, `39/39` tests passed (`shell` `15`, `citadelLevels` `5`, `courtExtraction` `5`, `courtGridMath` `6`, `courtInput` `8`) |
| `pnpm typecheck` | `0` | `18/18` workspace packages passed (`tsc -p tsconfig.json --noEmit`) |
| `pnpm check` | `0` | Registry (`11` modules), boundaries (`0` violations), i18n (`24`/`126` keys), calendar (`810` windows) passed |
| `pnpm build` | `0` | `3/3` apps built cleanly (`@tdl/server`, `@tdl/court3d`, `@tdl/client` `171` modules) |
| `pnpm test` | `0` | `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`; `@tdl/host` `88 passed \| 2 failed` (pre-existing calendar assertions `clock.test.ts:71`, `switches.test.ts:303`) |
| `npx tsx /tmp/tdl-arch006-v2-smoke.mjs` | `0` | `13/13` production-preview smoke checks green; `consoleErrors: 0`, `pageErrors: 0`, `failedRequests: 0` |

---

## 4. Visual Progression & Baseline Comparison (vs `evidence/TDL-ARCH-005-post`)

Compared directly against both the `1fd88f7` legacy baseline (`evidence/TDL-ARCH-005-post/`) and `TDL-ARCH-006` v1 (`128×128` textures / simpler silhouettes):

| Screenshot | State Captured | Visual Verification |
| --- | --- | --- |
| `01-desktop-citadel-lv1.png` | Desktop `1376×768`, Lv. 1 | Basalt plinth & portal stairs, staggered 3D corner quoins, 2-tier carved portal with crocketed wimperg & heraldic shield, lateral stepped buttresses, blind side/rear lancet arcades, overhanging timbered hall, slate gable roof & hearth smoke. |
| `02-desktop-citadel-lv2.png` | Desktop `1376×768`, Lv. 2 | Elevated stone keep on the same unified axis, projecting porch with slate gable roof & horned skull trophy, flanking braziers with pylon soot, asymmetric watchtower spire, bronze ridge lantern with faint necrotic core. |
| `03-desktop-citadel-lv3.png` | Desktop `1376×768`, Lv. 3 | 3-tier portal archivolts & raised portcullis, twin front ribbed-spire bastion turrets, crenelated notched battlements with carved pinnacles, rear polygonal apse, central keep belfry crowned by 4-ribbed ossuary lantern & apex war standard. |
| `04-desktop-citadel-lv4.png` | Desktop `1376×768`, Lv. 4 | Full 4-corner octagonal bastion ring with bone spurs & stone crown parapets, cruciform 4-gable crocketed wimperg roof, twin flanking war banners, 8-ribbed chapel reliquary with heraldic base shields & rotating bronze rune ring. |
| `05-desktop-citadel-lv5.png` | Desktop `1376×768`, Lv. 5 | Sovereign Cathedral-Citadel: elevated bastions with carved stone belt courses, 4 openwork flying buttresses bracing the Donjon, projecting twin-pylon barbican with horned skull trophies & tall braziers, weathered notched merlons, 4 swallowtail standards (flanks, rear & sovereign spire), dual counter-rotating rune rings & radiant necrotic crystal. |
| `06-desktop-court-full-lv5.png` | Desktop `1376×768`, Lv. 5 + Farm | Full courtyard composition confirming scale harmony alongside legacy Farm, gatehouse, palisade, road, and HUD. |
| `06b-desktop-citadel-lv5-orbit-side.png` | Desktop `1376×768`, Portal Close Orbit | Recessed 3-tier portal niche clearly showing studded oak doors, bronze door rings, raised toothed iron portcullis, trefoil tympanum, crocketed wimperg, heraldic shield, skull trophies, and clean flat-face turret arrow slits. |
| `06c-desktop-citadel-lv5-closeup.png` | Desktop `1376×768`, Material Closeup | Macro inspection of `256×256` basalt/dressed ashlar albedo+bump+roughness (chipped edges, mortar fissures, moss, water/soot streaks), carved pinnacles, forged iron muntins, and clean chamfered bastion masonry. |
| `07-desktop-left-longpress-pickup.png` | Desktop `1376×768`, Lv. 1 Pickup | Left long-press pickup triggers `[3, 3]` selection ghost (`Подтвердить` / `Отмена`) strictly bounded inside the 3×3 cell plot. |
| `08-mobile-390-lv5.png` | Mobile `390×844` (2× DPR), Lv. 5 | Full Lv. 5 reliquary dome, bone ossuary ribs, flying buttresses, and barbican crisp and unobstructed (`horizontalOverflow: false`, `overlapTopNav: false`). |
| `09-mobile-390-touch-pickup.png` | Mobile `390×844`, Touch Pickup | Touch long-press enters move/pickup mode cleanly within the 3×3 plot (`Подтвердить` / `Отмена`). |
| `10-mobile-320-lv5.png` | Mobile `320×690` (2× DPR), Lv. 5 | Narrow viewport framing cleanly inside safe area (`horizontalOverflow: false`, `overlapLordRes: false`, `overlapTopNav: false`). |
