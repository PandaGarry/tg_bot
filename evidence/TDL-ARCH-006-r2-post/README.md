# TDL-ARCH-006 R2 — Final Post-Integration Verification on PR #28

- **Tested repository / branch:** `PandaGarry/tg_bot`, `refactor/tdl-court-grid-input-impl` (PR #28)
- **Exact tested integrated HEAD SHA:** `adcae02db92468d1a7cfce1e42e98ad51dbcf8cf` (clean detached checkout in `/tmp/tdl-arch006-r2-post`; `0` source modifications)
- **Parent PR #28 SHA:** `a5fe323859455082b66eb61bc090b0e3796d3fc6`
- **Arena prototype source SHA:** `f71497b260ba4c11c8ba5f8a87e5a168380d6b94` (`arena/ff89979b-tg-bot`)
- **Evidence delivery branch:** `arena/ff89979b-tg-bot` (evidence + handoff update only; zero PR commits, zero source edits, no merge)
- **Runtime mode:** Fresh production preview (`NODE_ENV=production node apps/server/dist/index.mjs`, serving freshly built `apps/client/dist`) + embedded PostgreSQL 18.4 (`127.0.0.1:55432`)
- **Tooling:** Node `v22.22.3`, pnpm `12.6.0`, turbo `2.11.4`, `puppeteer-core@25.12.0`, `@sparticuz/chromium@153.0.0`, ANGLE Vulkan `SwiftShader Device (Subzero)` (`WebGL 2.0 (OpenGL ES 3.0 Chromium)`)

---

## 1. Environment & Scope Disclaimers

1. **Zero-reuse fresh execution:** All installation, TypeScript typechecking, check scripts, production builds, monorepo tests, and Chromium/PostgreSQL runtime smoke checks ran cleanly against exact `adcae02db92468d1a7cfce1e42e98ad51dbcf8cf` (`0` Turborepo cache hits across `typecheck`, `build`, and `test`), with final `git status -s` returning `0` modified/untracked tracked files.
2. **Headless SwiftShader emulation (no physical device/GPU):** All desktop (`1376×768`) and mobile (`390×844` @ 2× DPR, `320×690` @ 2× DPR, `isMobile: true`, `hasTouch: true`) checks ran under CPU SwiftShader WebGL emulation. **No 60 FPS or hardware mobile GPU performance claims are made from SwiftShader runs.**
3. **Honest `@tdl/host` calendar failure reporting:** `pnpm test` (`exit_code=0` from turbo wrapper) reproduces the exact pre-existing `2 failed | 88 passed (90)` calendar-dependent assertions in `@tdl/host` on `2026-11-13` (`tests/clock.test.ts:71` and `tests/switches.test.ts:303`), matching parent baseline `a5fe323` verbatim. Therefore, `@tdl/host` and the monorepo as a whole are **not** declared 100% green.
4. **Detached-canvas `WebGL context loss` on unmount:** Browser instrumentation (`tdl-webgl-probe`) recorded `THREE.WebGLRenderer: Context Lost.` paired with `[tdl-webgl-probe] desktop contextlost inDom=false` **strictly** during `Court → Map` unmounts of the detached previous `<canvas>`; newly mounted Court canvases upon `Map → Court` operated cleanly with `0` console/page errors.

---

## 2. Integrity Check (`a5fe323` → `adcae02` and vs `f71497b`)

Verified in `/tmp/tdl-arch006-r2-post`:

- `git rev-parse HEAD`: `adcae02db92468d1a7cfce1e42e98ad51dbcf8cf`
- `git rev-parse HEAD^`: `a5fe323859455082b66eb61bc090b0e3796d3fc6`
- **Exact integration diff (`a5fe323..adcae02`, 10 files):**
  - `M apps/client/src/court/buildings/citadel/CitadelBuilding.tsx`
  - `M apps/client/src/court/buildings/citadel/CitadelRenderer.tsx`
  - `M apps/client/src/court/buildings/citadel/citadelGeometry.ts`
  - `M apps/client/src/court/buildings/citadel/citadelLevels.ts`
  - `A apps/client/src/court/buildings/citadel/v2/CitadelV2Building.tsx`
  - `A apps/client/src/court/buildings/citadel/v2/citadelV2Geometry.ts`
  - `A apps/client/src/court/buildings/citadel/v2/citadelV2Levels.ts`
  - `A apps/client/src/court/buildings/citadel/v2/citadelV2Materials.ts`
  - `M apps/client/src/court/materials/citadelMaterials.ts`
  - `M apps/client/tests/citadelLevels.test.tsx`
- **Source parity with Arena R2 source (`f71497b`):** `git diff --stat f71497b260ba4c11c8ba5f8a87e5a168380d6b94..adcae02db92468d1a7cfce1e42e98ad51dbcf8cf -- . ':!docs' ':!evidence'` → **empty (`0` diffs)**.
- **Preserved baseline files (`a5fe323..adcae02`):** `git diff --exit-code` passed (`PRESERVED_OK=true`) across `CourtScene.tsx`, `gridMath.ts`, `courtInput.ts`, `courtGridMath.test.tsx`, `courtInput.test.tsx`, `package.json`, and `pnpm-lock.yaml`.
- **Self-contained `v2/` fallback verification:** `CitadelRenderer.tsx` imports `./v2/CitadelV2Building.js`, and `CitadelV2Building.tsx` imports strictly `./citadelV2Materials.js`, `./citadelV2Geometry.js`, `./citadelV2Levels.js`, and `../../../scene/gridMath.js` with zero cross-contamination from R2 modules.

---

## 3. Automated Checks on `adcae02db92468d1a7cfce1e42e98ad51dbcf8cf` (`commands.log`)

| Command | Exit Code | Cached | Outcome |
| --- | ---: | --- | --- |
| `pnpm install --frozen-lockfile` | `0` | — | Verified lockfile & linked 20 workspace projects (`229` packages in `286ms`) |
| `pnpm --filter @tdl/client test` | `0` | uncached | `5` files, `39/39` tests passed (`shell` `15`, `courtInput` `8`, `citadelLevels` `5`, `courtGridMath` `6`, `courtExtraction` `5`) in `7.45s` |
| `pnpm typecheck` | `0` | `0/18` cached | `18/18` workspace packages passed in `38.71s` |
| `pnpm check` | `0` | — | `11` modules registered, clean package boundaries, `24` kernel / `126` shell i18n keys, `810` calendar windows (`2026–2028`) |
| `pnpm build` | `0` | `0/3` cached | `@tdl/server` (`1.2mb`), `@tdl/court3d` (`31` modules, `1,100.32 kB`), `@tdl/client` (`175` modules, `1,404.35 kB`) in `1.81s` |
| `pnpm test` | `0` | `0/6` cached | `@tdl/kernel` `44/44`, `@tdl/client` `39/39`, `@tdl/server` `34/34`, `@tdl/court3d` & `@tdl/protocol` `0` tests; `@tdl/host` **`88 passed \| 2 failed`** (`tests/clock.test.ts:71`, `tests/switches.test.ts:303`) |
| `pnpm --filter @tdl/host test` (direct check) | `0` | — | Reproduced identical `2 failed \| 88 passed (90)` calendar assertions on `2026-11-13` matching baseline `a5fe323` |

---

## 4. Production Runtime Smoke & Fallback Verification (`smoke-report.json`, `health.json`, `console.txt`)

- **Backend `/api/health` (`health.json`):** `ok: true`, `world: "world-1"`, `ready: true`, `modulesEnabled: 10`, `failures: 0`, `epoch: 1`.
- **Gameplay & Progression Gates:**
  - `desktopCourtLoad` (`1376×768`), `upgradeLv2`–`upgradeLv5` (real server `court.upgrade` commands persisted in PostgreSQL), and `farmPlace` (`5000 752 1778 2254 2000 28402`, `06`) all passed.
  - `rightHoldNoPickup` (`ok: true`), `leftLongPressPickup` (`ok: true`, `07`), `leftDragPan` (`visualChanged: true`, `triggeredPickup: false`), `rightDragOrbit` (pure RMB drag without Shift: `visualChanged: true`, `triggeredPickup: false`), `touchLongPressPickup` (`390×844`, `09`), and `navigation` (`Court → Map → Court`, 2 full cycles) all passed.
  - `noHorizontalOverflow` & `noLayoutOverlap`: `false` overflow / `false` HUD overlap at `1376×768`, `390×844`, and `320×690`.
  - `consoleErrors: []`, `pageErrors: []`, `failedRequests: []`.
- **Fallback Rendering Verification (external read-only Vite harness `/tmp/tdl-fallback-harness` against unmodified `adcae02` sources):**
  - Explicit `variant="citadel-v2"` (`11-fallback-v2-lv5.png`) and `variant="legacy"` (`12-fallback-legacy-lv5.png`) render cleanly (`ok: true`, `0` pageErrors).
  - Cascading `CitadelErrorBoundary` fault injection verified live in Chromium WebGL:
    - Throwing inside `CitadelBuilding` (R2) preserves the entire Court scene (`canvasOk: true`) and seamlessly renders `CitadelV2Building` (`13-fallback-cascade-r2-to-v2-lv5.png`, visually identical to `11`).
    - Throwing inside both `CitadelBuilding` and `CitadelV2Building` preserves the entire Court scene (`canvasOk: true`) and falls back to `LegacyTownHall` (`14-fallback-cascade-both-to-legacy-lv5.png`, visually identical to `12`).

---

## 5. Performance & Resource Discipline Audit

1. **17 PBR textures & 13 carved geometries:** Allocated once per mount in `useCitadelTextureSet` / `useCitadelGeometrySet` and cleanly disposed on unmount; verified under React `<StrictMode>` double-invocation in `tests/citadelLevels.test.tsx` (`dispose()` called `17×2` and `13×2` times respectively).
2. **Zero per-frame allocations:** Inspected all `4` `useFrame` callbacks in `CitadelBuilding.tsx` (`GateBrazier`, `HeraldicWarBanner`, `BrokenOssuaryCrownTop`, `ChimneySmoke`) — zero `new THREE.*`, texture, or geometry allocations per frame.
3. **Scene draw/triangle cost & localized lighting (live WebGL2 counters on `adcae02`):**
   - Full Lv.1 courtyard frame: `593` draws, `37,344` triangles (`0` local Citadel `pointLight`s).
   - Full Lv.5 courtyard frame (with Farm): `846` draws (`+253`), `56,544` triangles (`+19,200`), `3` localized non-shadow-casting `pointLight`s (`castShadow={false}`, 2 brazier lights `intensity <= 0.46`, `distance=2.1`, `decay=2.2`, 1 reliquary light `intensity=0.68`, `distance <= 2.4`, `decay=2`).
4. **Multi-cycle `Court → Map → Court` WebGL lifecycle (2 full roundtrips):**
   - Pre-unmount active scene: `createdTextures=24`, `createdBuffers=1803` (`deleted=0`).
   - After 2 full unmount/remount cycles: `createdTextures=72` (`deletedTextures=38`), `createdBuffers=5393` (`deletedBuffers=3598`, leaving `1795` live buffers — delta `-8` vs initial `1803`), confirming **zero WebGL resource accumulation or leak across repeated Court unmounts**.

---

## 6. Unmodified Runtime Screenshots (`screenshots/`)

| File | Description |
| --- | --- |
| `01-desktop-citadel-lv1.png` | Desktop `1376×768` — Lv.1 Fortified Chapel-Manor (basalt plinth, stepped buttresses, pointed portal, gables, chimney) |
| `02-desktop-citadel-lv2.png` | Desktop `1376×768` — Lv.2 Watchtower Nave (same isometric camera, asymmetric left watchtower, gate braziers) |
| `03-desktop-citadel-lv3.png` | Desktop `1376×768` — Lv.3 Apse Sanctuary Keep (same camera, polygonal rear apse, raised portcullis, taller belfry) |
| `04-desktop-citadel-lv4.png` | Desktop `1376×768` — Lv.4 Charnel Cathedral (same camera, right lean-to transept, 4-rib Broken Ossuary Crown + crystal + banner) |
| `05-desktop-citadel-lv5.png` | Desktop `1376×768` — Lv.5 Sovereign Ossuary Citadel (same camera, 2 flying buttresses, full 8-rib Ossuary Crown pavilion & sovereign spire) |
| `06-desktop-court-full-lv5.png` | Desktop `1376×768` — Full Lv.5 Court with server-persisted Farm (`5000 752 1778 2254 2000 28402`) |
| `06b-desktop-citadel-lv5-front-3q.png` | Desktop front 3/4 view (`dist ~ 17.5m`) framing the full unclipped L5 silhouette from plinth to sovereign flag |
| `06c-desktop-citadel-lv5-portal-closeup.png` | Desktop portal close-up — open Gothic niche revealing studded oak doors, 3 iron bands, pierced trefoil tympanum, portcullis teeth & Broken Ossuary Crown wimperg |
| `06d-desktop-citadel-lv5-rear-side.png` | Desktop rear-left view — polygonal apse with lit lancets, ossuary tower & 2 flying buttresses inside `[3, 3]` bounds |
| `06e-desktop-citadel-lv5-transept-side.png` | Desktop right-side view — right lean-to transept wing, chimney, buttresses & projecting gatehouse |
| `07-desktop-left-longpress-pickup.png` | Desktop `1376×768` — Left long-press pickup confirmation bar (`Подтвердить` / `Отмена`) |
| `08-mobile-390-lv5.png` | Mobile `390×844` (2× DPR) — Full unclipped Lv.5 Citadel & clean HUD |
| `09-mobile-390-touch-pickup.png` | Mobile `390×844` (2× DPR) — Touch long-press pickup confirmation bar |
| `10-mobile-320-lv5.png` | Mobile `320×690` (2× DPR) — Narrow viewport framing & clean HUD (`overlapLordRes: false`, `horizontalOverflow: false`) |
| `11-fallback-v2-lv5.png` | Explicit `citadelVariant="citadel-v2"` Lv.5 runtime render on unmodified `adcae02` `CourtScene` |
| `12-fallback-legacy-lv5.png` | Explicit `citadelVariant="legacy"` Lv.5 runtime render on unmodified `adcae02` `CourtScene` |
| `13-fallback-cascade-r2-to-v2-lv5.png` | Live `CitadelErrorBoundary` cascade when R2 throws — scene preserved & falls back cleanly to `CitadelV2Building` |
| `14-fallback-cascade-both-to-legacy-lv5.png` | Live `CitadelErrorBoundary` cascade when both R2 and v2 throw — scene preserved & falls back cleanly to `LegacyTownHall` |
