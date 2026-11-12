# TDL-ARCH-003 — Runtime Validation & WebGL Investigation Evidence

- **Tested branch / PR:** `refactor/tdl-court-grid-input-impl` ([PR #28](https://github.com/PandaGarry/tg_bot/pull/28), base `refactor/tdl-asset-pipeline-foundation`)
- **Exact tested HEAD SHA:** `c10e99a1d51a25eb4a7873b2e6d6e6d4857dc194` (`docs: record shared branch workflow and validation queue`)
- **Arena delivery branch:** `arena/ff89979b-tg-bot` (platform session constraint prevents switching to, creating, or pushing to `refactor/tdl-court-grid-input-impl` directly; PR #28 HEAD `c10e99a1d51a25eb4a7873b2e6d6e6d4857dc194` was cloned into `/tmp/tdl-pr28` and verified unmodified)
- **Runtime mode:** Production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, static client bundle from `apps/client/dist`) with embedded PostgreSQL (`pnpm dev:db`)
- **Environment:** Node `v22.22.3`, pnpm `12.6.0`, `HeadlessChrome/153.0.8010.0` (`@sparticuz/chromium`), ANGLE Vulkan SwiftShader (`WebGL 2.0`), CPU software rasterizer

---

## 1. Environment & Scope Constraints

1. **Software WebGL (SwiftShader):** No hardware GPU is present in this sandbox; rendering ran on ANGLE SwiftShader. SwiftShader frame times do **not** represent real desktop or mobile GPU FPS.
2. **Mobile emulation vs physical devices:** `390×844` and `320×690` checks ran in headless Chromium (`isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 2`), including real `page.touchscreen.touchStart/touchEnd` (`pointerType === "touch"`). Physical iOS/Android GPU thermal/driver behavior remains untested here.
3. **`@tdl/host` calendar-dependent test failures:** On system date `2026-11-12`, `@tdl/host` reproduces 2 pre-existing date-dependent assertion failures (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`, `88 passed, 2 failed`, though Vitest returned `exit_code=0` in `pnpm test` and `pnpm --filter @tdl/host test`). All `@tdl/kernel` (`44/44`), `@tdl/client` (`29/29`), and `@tdl/server` (`34/34`) suites passed cleanly.
4. **Session branch restriction:** Per Arena platform rules, all commits/pushes from this session go exclusively to `arena/ff89979b-tg-bot`. `evidence/TDL-ARCH-003/` is committed without modifying any source code so it can be cherry-picked cleanly onto `refactor/tdl-court-grid-input-impl`.

---

## 2. Classification of `THREE.WebGLRenderer: Context Lost.`

- **Observed in `TDL-ARCH-002` (dev server) and `TDL-ARCH-003` (production preview):**
  `[desktop][desktop:nav-back-to-court-remount][log] THREE.WebGLRenderer: Context Lost.`
- **Root cause (not a SwiftShader crash):**
  1. In `apps/client/src/ui/World.tsx:72`, switching route from `"court"` to `"map"` (`Двор → Карта`) conditionally unmounts `<CourtScene />` and its R3F `<Canvas />`.
  2. `@react-three/fiber@9.5.0` (`unmountComponentAtNode`, `events-5a94e5eb.esm.js:15829`) schedules a `500 ms` cleanup callback that explicitly invokes `state.gl?.forceContextLoss?.()`.
  3. Three.js (`WebGLRenderer.js:1074-1080`) handles the resulting `webglcontextlost` event by logging `THREE.WebGLRenderer: Context Lost.`.
- **Empirical proof from `TDL-ARCH-003` DOM/console probes (`smoke-report.json`):**
  - During all interactive 3D steps (`desktopCourtLoad`, `leftDragPan`, `rightHoldNoPickup`, `rightDragOrbit`, `leftLongPressPickup`, `farmPlace`, `upgradeLv2`), **0 context-lost events** fired.
  - The report records the console event at `desktop:nav-back-to-court-remount`; the DOM probe records the event on a detached canvas (`webglContextDomEventsDesktop[0].inDom === false`). This proves the event was emitted by an already-unmounted canvas, but the current report does not unambiguously establish whether its delayed callback was observed during the outbound navigation or the return/remount step. The exact step label is therefore retained as reported rather than inferred.
  - On mobile (`390×844` + `320×690`), where the test did not navigate away from `Двор`, `webglContextDomEventsMobile` was `[]` and **0** `Context Lost` logs occurred.
  - Returning `Карта → Двор` (`06b-desktop-returned-from-map.png`) mounted a fresh `<Canvas />` and rendered Lv.2 TownHall + Farm normally.
- **Assessment:** The detached-canvas event and R3F's documented cleanup path strongly indicate intentional context release on `<Canvas />` unmount, not a live-canvas GPU failure. The report's step-label mismatch is retained as an evidence limitation; if route timing becomes relevant, rerun a focused trace. Optional future UX improvement (out of scope for TDL-ARCH-003): keep `<Canvas />` mounted or ignore expected unmount cleanup noise.

---

## 3. Vite HMR WebSocket Errors Separated

- In `TDL-ARCH-002` (`pnpm dev`), 4 Vite client HMR WebSocket connection errors (`ws://127.0.0.1:24678`, `ERR_CONNECTION_REFUSED`) were emitted because `apps/server/src/http.ts:58-62` boots Vite middleware with `hmr: false`.
- In `TDL-ARCH-003` production preview (`NODE_ENV=production pnpm start`, serving `apps/client/dist` without Vite dev middleware), **`consoleErrors: []`**, **`pageErrors: []`**, and **`failedRequests: []`**.
