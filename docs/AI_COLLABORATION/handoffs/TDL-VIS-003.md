# TDL-VIS-003 — Citadel architectural polish and runtime review

## Objective
Raise the existing 3D Citadel prototype above the first-pass blockout while preserving the current React Three Fiber / Three.js renderer and game systems.

## Source
- Repository: `PandaGarry/tg_bot`
- Parent implementation: PR #23, branch `feature/tdl-citadel-visual-prototype`
- This iteration: `feature/tdl-citadel-visual-polish-v2`
- Do not modify `main`, do not merge PR #23 or this iteration, and do not migrate the renderer/engine.

## Changes in this iteration
- Corrected the entry stair profile so the steps descend toward the outer approach and rise toward the gate.
- Moved the three rear towers outward from the keep wall to reduce destructive mesh intersections and improve the silhouette.
- Added a carved stone socket / collar under the necrotic crystal so it reads as architecturally supported.
- Replaced the broad level-2 cap slab with a narrow perimeter cornice to keep the roof/tower forms legible.

These are targeted geometry edits, not a claim that the asset is production-ready.

## Required validation
1. Fetch the latest HEAD of `feature/tdl-citadel-visual-polish-v2` and record the exact 40-character SHA. Test that exact SHA in a clean isolated checkout.
2. Run:
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm check`
   - `pnpm build`
   - `pnpm test`
   Report actual exit codes and distinguish inherited failures from new regressions.
3. Launch the game and confirm /api/health.
4. Capture genuine, unedited runtime PNGs:
   - Desktop 1376x768: full courtyard, Citadel front close-up, 3/4 orbit close-up, level 2 close-up.
   - Mobile 390x844 and 320x690: full scene and Citadel close-up.
5. Specifically inspect:
   - Stair tread heights and approach direction.
   - Tower-to-keep joins from front and orbit views; no visible floating or deep interpenetration.
   - Crystal socket contact with the roof; no floating crystal.
   - Level-2 cornice does not cut through towers or hide iron braces.
   - Shadow acne / z-fighting on wall courses, tower crowns and roof edges.
   - Placement, pickup, upgrade and navigation still work.
   - Right-button orbit does not trigger pickup; test right click explicitly, separately from left long-press.
   - Console, failed network requests, WebGL errors and mobile HUD overlap.
6. Save artifacts under `evidence/TDL-VIS-003/`: PNGs, `smoke-report.json`, `health.json`, and relevant console output. Include tested SHA, environment, viewport, exact commands, results and known limitations.

## Visual quality gate
Do not call this finished based only on successful build or a running scene. Compare the new screenshots against the TDL visual bible and the prior TDL-VIS-002 screenshots. The target remains premium stylized realism: layered architectural silhouette, believable stone/iron/timber materials, controlled lighting, atmospheric depth and coherent composition. If any of the geometry edits introduce new intersections, report them and do not conceal them.

## Restrictions
- Do not change the engine, renderer, dependencies or unrelated game systems.
- Do not replace the scene with 2D sprites or put a generated image on a plane.
- Do not modify PR #23 or `main`.
- Do not claim physical-device FPS from SwiftShader.
- Do not merge. Return the evidence branch and a concise factual report.
