# TDL-ARCH-006 v2 — Post-Integration Verification on PR #28

- **Tested repository / branch:** `PandaGarry/tg_bot`, `refactor/tdl-court-grid-input-impl` (PR #28)
- **Exact tested integrated HEAD SHA:** `a5fe323859455082b66eb61bc090b0e3796d3fc6` (clean detached checkout in `/tmp/tdl-arch006-post`; zero source modifications)
- **Parent PR #28 SHA:** `1fd88f7569428fd138daec775184228f36f8b0f2`
- **Arena prototype source SHA:** `c9145652320a28582ee5367c4418be7984df4cb9` (`arena/ff89979b-tg-bot`)
- **Evidence delivery branch:** `arena/ff89979b-tg-bot` (evidence + handoff update only; zero source changes, zero PR modifications, no merge)
- **Runtime mode:** Fresh production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving freshly built `apps/client/dist`) + embedded PostgreSQL 18.4 (`127.0.0.1:55432`)
- **Tooling:** Node `v22.22.3`, pnpm `12.6.0`, turbo `2.11.4`, `puppeteer-core@25.12.0`, `@sparticuz/chromium@153.0.0`, ANGLE Vulkan SwiftShader (`WebGL 2.0 (OpenGL ES 3.0 Chromium)`)

---

## 1. Environment & Scope Disclaimers

1. **Zero-reuse fresh execution:** All workspace installation, TypeScript typechecking, check scripts, production builds, monorepo tests, and Chromium/PostgreSQL runtime smoke checks executed cleanly from scratch on exact `a5fe323859455082b66eb61bc090b0e3796d3fc6` (`0` Turborepo cache hits across `typecheck`, `build`, and `test`).
2. **Headless SwiftShader emulation (no physical device/GPU):** Desktop (`1376×768`) and mobile (`390×844` @ 2× DPR, `320×690` @ 2× DPR, `isMobile: true`, `hasTouch: true`) renders ran under CPU SwiftShader WebGL emulation. No physical smartphone or hardware GPU is present in this sandbox.
3. **Honest `@tdl/host` calendar failure reporting:** On system date `2026-11-13`, `pnpm test` (`exit_code=0`) reproduces the pre-existing `2 failed | 88 passed` result in `@tdl/host` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`), matching pre-integration `1fd88f7` and `db711655`. The monorepo test suite is **not** claimed 100% green in `@tdl/host` because of these two calendar-dependent assertions.
4. **Separate explanation of `WebGL context loss` on unmount:** Browser instrumentation (`tdl-webgl-probe`) recorded `THREE.WebGLRenderer: Context Lost.` **exclusively** during `Court → Map → Court` unmount, accompanied by `[tdl-webgl-probe] desktop contextlost inDom=false`. Thus context loss occurs only on the already-detached R3F `<canvas>` unmounted when switching from Court to Map, while the freshly mounted Court `<canvas>` upon `Map → Court` operates cleanly with `0` runtime errors.

---

## 2. Integrity Check (`1fd88f7` → `a5fe323` and vs `c914565`)

Verified in `/tmp/tdl-arch006-post`:

- `git rev-parse HEAD`: `a5fe323859455082b66eb61bc090b0e3796d3fc6`
- `git rev-parse HEAD^`: `1fd88f7569428fd138daec775184228f36f8b0f2`
- **Exact integration diff (`1fd88f7..a5fe323`, 7 files, `+3364 / -3`):**
  - `M apps/client/src/court/CourtScene.tsx`
  - `A apps/client/src/court/buildings/citadel/CitadelBuilding.tsx`
  - `A apps/client/src/court/buildings/citadel/CitadelRenderer.tsx`
  - `A apps/client/src/court/buildings/citadel/citadelGeometry.ts`
  - `A apps/client/src/court/buildings/citadel/citadelLevels.ts`
  - `A apps/client/src/court/materials/citadelMaterials.ts`
  - `A apps/client/tests/citadelLevels.test.tsx`
- **Source parity with Arena v2 prototype (`c914565`):** `git diff --stat c9145652320a28582ee5367c4418be7984df4cb9..a5fe323859455082b66eb61bc090b0e3796d3fc6 -- . ':!docs' ':!evidence'` → **empty (`0` diffs)**.
- **Preserved files (`1fd88f7..a5fe323`):** empty diff (`exit_code=0`) across `gridMath.ts` (`2e68bdbed98be0b4ffc19e80801f11ee39045001`), `courtInput.ts` (`0c376fa4ebfac8fb5cfc2b24eab01941247348eb`), `courtGridMath.test.tsx` (`12057158e0d893c685bd8b1b1cd4e142a3763c3a`), `courtInput.test.tsx` (`50a98b0bdfd7fd95263b0732c7fcb6654397a810`), `package.json` (`a239aaeb45c0a03841c2eb785193a8a4ca1d37ea`), and `pnpm-lock.yaml` (`7fc174aa86ae31ad718bdca01a094aba7465eb88`).

---

## 3. Automated Checks on `a5fe323859455082b66eb61bc090b0e3796d3fc6` (`commands.log`)

| Command | Exit Code | Cached | Outcome |
| --- | ---: | --- | --- |
| `pnpm install --frozen-lockfile` | `0` | — | Verified 366 lockfile entries & linked 20 workspace projects (`+229` packages in `3.8s`) |
| `pnpm --filter @tdl/client test` | `0` | uncached | `5` files, `39/39` tests passed (`shell` `15`, `courtInput` `8`, `citadelLevels` `5`, `courtGridMath` `6`, `courtExtraction` `5`) in `7.78s` |
| `pnpm typecheck` | `0` | `0/18` cached | `18/18` packages passed in `40.314s` |
| `pnpm check` | `0` | — | `11` modules registered, clean boundaries, `24` kernel / `126` shell i18n keys, `810` calendar windows (`2026–2028`) |
| `pnpm build` | `0` | `0/3` cached | `@tdl/server` (`1.2mb`), `@tdl/court3d` (`31` modules, `1,100.32 kB`), `@tdl/client` (`171` modules, `1,358.14 kB`) built in `2.035s` |
| `pnpm test` | `0` | `0/6` cached | `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`, `@tdl/court3d` & `@tdl/protocol` `0` tests (`--passWithNoTests`); `@tdl/host` `88 passed \| 2 failed` (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`) |

---

## 4. Production Runtime Smoke Checks (`smoke-report.json`, `health.json`, `console.txt`)

| Gate | Status | Verified Details |
| --- | --- | --- |
| `desktopCourtLoad` (`1376×768`) | `ok: true` | SwiftShader WebGL2 active, `<canvas>` `820×768`, Lv.1 courtyard rendered |
| `rightHoldNoPickup` | `ok: true` | Right-button hold (750ms) does not open `.place-bar` (`triggeredPickup: false`) |
| `leftLongPressPickup` | `ok: true` | Left hold (750ms) on Citadel picks up building (`Подтвердить`/`Отмена`, `07`) |
| `leftDragPan` | `ok: true` | Left-drag pans camera without pickup (`visualChanged: true`, `triggeredPickup: false`) |
| `upgradeLv2` – `upgradeLv5` | `ok: true` | Real server `court.upgrade` calls persisted in PostgreSQL (`Ур. 2` → `Ур. 5`) across reloads |
| `rightDragOrbit` | `ok: true` | Right-drag orbits Citadel without pickup (`visualChanged: true`, `triggeredPickup: false`) |
| `farmPlace` | `ok: true` | Farm placed cleanly alongside Lv.5 Citadel; resources `"630 1364 2286 2258 318 4454"` (`06`) |
| `navigation` (`Court → Map → Court`) | `ok: true` | Map view activates cleanly (`onMap: true`), returns to playable Court (`backOnCourt: true`) |
| `touchLongPressPickup` (`390×844`) | `ok: true` | Mobile touch hold opens `.place-bar` (`09`) |
| `noHorizontalOverflow` | `ok: true` | `horizontalOverflow: false`, `overlapLordRes: false`, `overlapTopNav: false` at `1376×768`, `390×844`, `320×690` |
| `errors` (`console` / `page` / `net`) | `0 / 0 / 0` | Zero runtime console/page/network errors; only 1 detached-canvas unmount `contextlost` (`inDom=false`) in `console.txt` |

---

## 5. Unmodified Runtime Screenshots (`screenshots/`)

| File | Description |
| --- | --- |
| `01-desktop-citadel-lv1.png` | Desktop `1376×768` — Lv.1 Fortified Manor (basalt plinth, 3D quoins, pointed portal, charred-oak gallery, slate gable) |
| `02-desktop-citadel-lv2.png` | Desktop `1376×768` — Lv.2 Watchtower Hall (same camera angle, stone portal porch, asymmetric octagon watchtower, ridge lantern) |
| `03-desktop-citadel-lv3.png` | Desktop `1376×768` — Lv.3 Battlemented Keep (same angle, front ribbed turrets, raised toothed portcullis, 4-ribbed reliquary) |
| `04-desktop-citadel-lv4.png` | Desktop `1376×768` — Lv.4 Gothic Bastion (same angle, 4 octagonal corner turrets, cruciform roof, 8-ribbed reliquary + rune ring) |
| `05-desktop-citadel-lv5.png` | Desktop `1376×768` — Lv.5 Sovereign Necrotic Citadel (same angle, flying buttresses, sovereign crown spire, non-occluding flank/rear banners) |
| `06-desktop-court-full-lv5.png` | Desktop `1376×768` — Full court Lv.5 Citadel + server-persisted Farm placement (`630 1364 2286 2258 318 4454`) |
| `06b-desktop-citadel-lv5-portal-closeup.png` | Desktop close-orbit — Open portal recess showing oak doors, bronze rings, raised toothed portcullis, stepped archivolts, trefoil tympanum, heraldic shield & skulls |
| `06c-desktop-citadel-lv5-masonry-closeup.png` | Desktop close-orbit — Ashlar masonry bump/roughness, flat-face octagonal turret slits (`Math.PI / 8`), stepped buttresses, pinnacles & portal soot gradient |
| `07-desktop-left-longpress-pickup.png` | Desktop `1376×768` — Left long-press pickup confirmation bar (`Подтвердить` / `Отмена`) & `[3, 3]` selection highlight |
| `08-mobile-390-lv5.png` | Mobile `390×844` (2× DPR) — Clean HUD spacing, zero overflow, legible Citadel & reliquary |
| `09-mobile-390-touch-pickup.png` | Mobile `390×844` (2× DPR) — Touch long-press pickup confirmation bar |
| `10-mobile-320-lv5.png` | Mobile `320×690` (2× DPR) — Narrow-screen layout & HUD clearance verified (`overlapLordRes: false`) |
