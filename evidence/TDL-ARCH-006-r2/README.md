# TDL-ARCH-006 R2 Evidence — Ossuary Cathedral-Fortress (L1–L5)

- **Base PR #28 HEAD:** `a5fe323859455082b66eb61bc090b0e3796d3fc6` (v2 baseline archived in `apps/client/src/court/buildings/citadel/v2/`)
- **Delivery branch:** `arena/ff89979b-tg-bot`
- **Test & build workspace:** isolated clean clone `/tmp/tdl-arch006-r2` at `a5fe323` with Node `v22.22.3`, `pnpm 12.6.0`, PostgreSQL `18.4`, `HeadlessChrome` + ANGLE Vulkan `SwiftShader Device (Subzero)`, exact source parity verified against `/home/user/tg_bot` via `diff -qr` (`0` diffs in `apps/` and `packages/`).
- **Device / environment disclaimer:** No physical smartphone or hardware GPU is present in this sandbox; all browser captures and smoke tests ran under headless Chromium + SwiftShader software emulation.

## 1. Two-Pass Craft Sequence

### Pass A — Structural Blockout (`pass-a/`)
Captured before procedural PBR texture painting or micro-ornamentation to lock silhouette, asymmetry, proportions, and `[3, 3]` footprint bounds across L1–L5:
- `pass-a/pass-a-lv1.png` .. `pass-a/pass-a-lv5.png`: unedited default-camera (`1376×768`) screenshots on account `r2passa` across authoritative server upgrades `Ур. 1`–`Ур. 5`.
- `pass-a/thumb-lv1.png` .. `pass-a/thumb-lv5.png` & `pass-a/pass-a-contact-sheet.png`: 5-level silhouette progression composite confirming three-part asymmetrical composition (`Nave Hall` + `Monumental Gatehouse` + `Asymmetric Left Rear Belfry/Ossuary Tower` + right `Side Chapel/Transept` + `Rear Apse`).

### Pass B — Carved Materials, Portal Depth, Lighting Polish & Multi-Angle Review (`pass-b/`)
Final post-portal-fix captures (`0` console errors, `0` page errors) on account `r2end` (`Оссуарист`):
- `pass-b/pass-b-lv1.png` .. `pass-b/pass-b-lv5.png`: unedited default-camera (`1376×768`) progression across authoritative L1–L5 upgrades.
- `pass-b/pass-b-contact-sheet.png`: L1–L5 final composite strip.
- `pass-b/pass-b-lv5-front-3q.png`: reframed front 3/4 view (`dist ~ 17.5m`) showing the entire L5 silhouette unclipped from stepped plinth to crown apex banner.
- `pass-b/pass-b-lv5-portal-closeup.png`: close-up (`dist ~ 8.4m`) verifying the recessed portal depth — visible studded oak doors, 3 forged-iron strap hinges, bronze ring pulls, open pointed stone arch revealing pierced trefoil tympanum & raised toothed portcullis spikes, Broken Ossuary Crown heraldic shield in the wimperg, and restrained warm amber braziers.
- `pass-b/pass-b-lv5-transept-side.png`: right-side azimuth (`+1.685 rad`) inspecting the right lean-to chapel/transept, mortar-jointed stone chimney, flanking buttresses, and projecting gatehouse.
- `pass-b/pass-b-lv5-rear-side.png`: rear-left azimuth (`-0.115 rad`) inspecting the tall left ossuary belfry tower, 2 openwork flying buttresses bridging nave to tower, polygonal rear apse, and slate roofing.
- `pass-b/pass-b-lv5-mobile-390x844.png`: mobile `390×844` (`dpr: 2`) framing with unobstructed HUD and clean crown/citadel silhouette.
- `pass-b/pass-b-before-lighting-lv5.png` & `pass-b/pass-b-lighting-before-after.png`: pre- vs post-lighting polish showing controlled brazier point lights (`0.42–0.46`) and subtle necrotic reliquary emission (`0.68`, `distance <= 2.4m`, `decay = 2`) without whiteout overexposure.
- `pass-b/v2-vs-r2-comparison.png` & `pass-b/v2-vs-r2-lv5-direct.png`: side-by-side comparison against the prior PR #28 v2 (`a5fe323`) baseline (`evidence/TDL-ARCH-006-post/screenshots/01,03,05`).

## 2. Automated Verification Summary

Ran against `/tmp/tdl-arch006-r2` after the final `CitadelBuilding.tsx` edit (`diff -qr` confirmed identical sources in `/home/user/tg_bot`):
- `pnpm --filter @tdl/client test`: **passed** — `5` test files, `39/39` tests (`tests/citadelLevels.test.tsx`: `5/5`, verifying L1–L5 structural progression, `stepReachZ <= 1.62m < 1.65m` footprint bounds across all sub-masses, 17 procedural PBR textures & 13 carved geometries with React `<StrictMode>` disposal, and `CitadelRenderer` dual fallback `R2 -> v2 -> Legacy`).
- `pnpm -r --filter '!@tdl/host' test`: **passed** — `@tdl/kernel` `44/44` (3 files), `@tdl/client` `39/39` (5 files), `@tdl/server` `34/34` (4 files), `@tdl/court3d` & `@tdl/protocol` `0` tests.
- `pnpm --filter @tdl/host test`: `88/90 passed`, `2 failed` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`) — **pre-existing calendar-date-sensitive baseline failures** on `2026-11-12/13` in unmodified `@tdl/host`, matching the `a5fe323` / `1fd88f7` baseline verbatim.
- `pnpm typecheck`: **passed** (`18/18` workspace packages).
- `pnpm check`: **passed** (module boundaries, i18n keys, calendar windows).
- `pnpm build`: **passed** (`3/3` production bundles: `@tdl/server`, `@tdl/court3d`, `@tdl/client`).

## 3. Production Runtime Smoke (`health.json` & `smoke-report.json`)

- **Backend:** `NODE_ENV=production node apps/server/dist/index.mjs` on `0.0.0.0:3000` with embedded PostgreSQL 18.4 (`127.0.0.1:55432`, `epoch: 1`).
- **`/api/health` (`health.json`):** `ok: true`, `world: "world-1"`, `ready: true`, `modulesEnabled: 10`, `failures: 0`.
- **Browser E2E checks (`smoke-report.json`):**
  - `desktopCourtLoad`: `ok: true` (`canvasPresent: true`, `Ур. 5`).
  - `rightHoldNoPickup`: `ok: true` (`triggeredPickup: false`).
  - `leftLongPressPickup`: `ok: true` (triggers relocate confirmation & cleanly cancels).
  - `navigation`: `ok: true` (`Court → Map → Court`).
  - `noHorizontalOverflow` & `noLayoutOverlap`: `ok: true` across `1376×768`, `390×844`, and `320×690`.
  - `consoleErrors: []`, `pageErrors: []`, `failedRequests: []`.
