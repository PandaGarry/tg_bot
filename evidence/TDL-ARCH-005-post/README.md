# TDL-ARCH-005 — Post-Integration Validation on PR #28 HEAD

- **Tested source repository / branch:** `PandaGarry/tg_bot`, `refactor/tdl-court-grid-input-impl` (PR #28)
- **Exact tested application HEAD SHA:** `1fd88f7569428fd138daec775184228f36f8b0f2` (cloned cleanly in isolated directory `/tmp/tdl-arch005-post-src`, detached at `1fd88f7569428fd138daec775184228f36f8b0f2`; PR #28 ref untouched)
- **Parent PR #28 SHA:** `db711655e870cfcbd1b337dd105a926d3da509fa`
- **Arena delivery branch:** `arena/ff89979b-tg-bot` (evidence-only delivery; zero visual redesign or `TDL-ARCH-006` changes started)
- **Runtime mode:** Fresh production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving freshly built `apps/client/dist`) + embedded PostgreSQL (`pnpm dev:db`)
- **Tooling:** Node `v22.22.3`, pnpm `12.6.0`, turbo `2.11.4`, `puppeteer-core@25.12.0` + `@sparticuz/chromium@153.0.0`, ANGLE Vulkan SwiftShader (`WebGL 2.0`)

---

## 1. Environment & Scope Disclaimers

1. **Fresh isolated execution:** All installs, builds, checks, unit/monorepo tests, and production-preview browser smoke gates were executed from scratch against `1fd88f7569428fd138daec775184228f36f8b0f2` (0 Turborepo cache hits across `typecheck`, `build`, and `pnpm test`). No prior run artifacts were reused.
2. **Headless SwiftShader emulation (no physical device/GPU):** Desktop (`1376×768`) and mobile (`390×844` @ 2× DPR, `320×690` @ 2× DPR, `isMobile: true`, `hasTouch: true`) checks ran under CPU SwiftShader WebGL emulation. No physical mobile device or hardware GPU is present in this sandbox.
3. **Pre-existing `@tdl/host` calendar test failures (honestly reported):** On system date `2026-11-12`, `pnpm test` (`exit_code=0`) emits `2 failed | 88 passed` in `@tdl/host` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`), matching the pre-integration `db711655` baseline.

---

## 2. Input / Grid Preservation Check (`db71165` → `1fd88f7`)

Verified directly in `/tmp/tdl-arch005-post-src`:
- `git diff db711655e870cfcbd1b337dd105a926d3da509fa..1fd88f7569428fd138daec775184228f36f8b0f2 -- apps/client/src/court/scene/gridMath.ts apps/client/src/court/scene/courtInput.ts apps/client/tests/courtGridMath.test.tsx apps/client/tests/courtInput.test.tsx package.json pnpm-lock.yaml` → **empty diff (`exit_code=0`)**.
- `apps/client/src/court/scene/gridMath.ts` blob SHA: `2e68bdbed98be0b4ffc19e80801f11ee39045001` (unchanged).
- `apps/client/src/court/scene/courtInput.ts` blob SHA: `0c376fa4ebfac8fb5cfc2b24eab01941247348eb` (unchanged).
- Existing tests `courtGridMath.test.tsx` (`6/6`) and `courtInput.test.tsx` (`8/8`) pass verbatim.

---

## 3. Command Results on `1fd88f7569428fd138daec775184228f36f8b0f2`

| Command | Exit Code | Cached | Result |
| --- | ---: | --- | --- |
| `pnpm install --frozen-lockfile` | `0` | — | Clean lockfile verify & link across 20 workspace projects |
| `pnpm --filter @tdl/client test` | `0` | uncached | `4` files, `34/34` tests passed (`shell` `15`, `courtExtraction` `5`, `courtGridMath` `6`, `courtInput` `8`) |
| `pnpm typecheck` | `0` | `0/18` cached | `18/18` packages passed |
| `pnpm check` | `0` | — | Registry (`11` modules), boundaries, i18n (`24` kernel / `126` shell), schedule (`810` windows) passed |
| `pnpm build` | `0` | `0/3` cached | `@tdl/server`, `@tdl/court3d`, `@tdl/client` (`166` modules, `1,302.60 kB`) built cleanly |
| `pnpm test` | `0` | `0/6` cached | `@tdl/kernel` `44/44`, `@tdl/client` `34/34`, `@tdl/server` `34/34`; `@tdl/host` `88 passed \| 2 failed` (pre-existing calendar assertions `clock.test.ts:71`, `switches.test.ts:303`) |

---

## 4. Production-Preview Smoke Gates (`smoke-report.json`, `health.json`, `console.txt`)

| Gate | Status | Verified Details |
| --- | --- | --- |
| `desktopCourtLoad` (`1376×768`) | `ok: true` | WebGL2 SwiftShader active, `<canvas>` `820×768`, Lv.1 courtyard rendered |
| `rightHoldNoPickup` | `ok: true` | 750ms right-button hold does not open `.place-bar` (`triggeredPickup: false`) |
| `rightDragOrbit` | `ok: true` | Orbit rotates camera smoothly without pickup (`visualChanged: true`, `triggeredPickup: false`) |
| `leftLongPressPickup` | `ok: true` | 750ms left hold on TownHall triggers pickup (`Подтвердить`/`Отмена`, `03-desktop-left-longpress-pickup.png`) |
| `leftDragPan` | `ok: true` | Left-drag pans scene without pickup (`visualChanged: true`, `triggeredPickup: false`) |
| `farmPlace` | `ok: true` | Farm grid ghost (`04`) and confirmed placement (`05`); resources `"600 540 370 200 300 100"` |
| `upgradeLv2` | `ok: true` | TownHall upgraded to `"Ур. 2"`, Lv.2 gold trim geometry rendered (`06`) |
| `navigation` (`Court → Map → Court`) | `ok: true` | Clean unmount on Map (`onMap: true`) and WebGL remount back on Court (`backOnCourt: true`, `06b`) |
| `touchLongPressPickup` (`390×844`) | `ok: true` | Touch hold picks up TownHall on mobile (`08-mobile-390-touch-pickup.png`) |
| `noHorizontalOverflow` (`1376×768`, `390×844`, `320×690`) | `ok: true` | `horizontalOverflow: false`, `overlapProfileRes: false`, `overlapTopNav: false` across all 3 viewports |
| `consoleErrors` / `pageErrors` / `failedRequests` | `0 / 0 / 0` | Clean console (`console.txt`: only 1 expected `THREE.WebGLRenderer: Context Lost.` on `inDom: false` detached `<canvas>` during `Court → Map` unmount) |
