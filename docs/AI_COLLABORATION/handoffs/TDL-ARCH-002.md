# TDL-ARCH-002 — Court grid and input foundation

## Target
- Repository: `PandaGarry/tg_bot`
- Working branch: `refactor/tdl-court-grid-input-foundation`
- Base branch: `refactor/tdl-asset-pipeline-foundation`
- Base commit: `0a5e465ede6096ecdfc33b4771b0761baf327fab`
- Audit evidence: `arena/ff89979b-tg-bot`, commit `dbb10919cfc5f8832cde9b84cf1881848eb70107`
- Architecture contract: `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md`
- Prior audit: `evidence/TDL-ARCH-001/`

## Purpose
Implement the first narrow, behavior-preserving Phase B slice. Establish a safe boundary for court grid math and correct the confirmed right-mouse long-press pickup defect. This is not a visual redesign.

## Required work

### 1. Reconfirm the baseline before editing
- Fetch the exact base commit and verify it is `0a5e465ede6096ecdfc33b4771b0761baf327fab`.
- Read the current `CourtScene.tsx`, `World.tsx`, court module contracts, and existing tests.
- Record the exact pre-change behavior and the current locations of grid helpers and pointer handlers.
- If the branch base differs, stop and report; do not silently rebase.

### 2. Extract pure grid math
- Create `apps/client/src/court/scene/gridMath.ts` (or a better justified path under `court/scene/`).
- Move only pure helpers needed for coordinate/grid operations: `gridToWorld`, `worldToCell`, footprint key generation, and building/road occupancy lookup, as applicable to the actual code.
- Keep existing constants and semantics unchanged in this slice. Do not centralize catalog/cost/footprint domain definitions yet.
- Update `CourtScene.tsx` to import the extracted helpers.
- Avoid circular imports and avoid moving React components, Three.js objects, camera logic, or rendering code.
- Add focused unit tests for coordinate round-trips, cell boundaries, footprint occupancy, and edge cases supported by the existing contract.
- No change to grid size, cell size, anchor convention, building placement rules, or server commands.

### 3. Fix the confirmed right-button long-press defect
- In `CourtInput`, ensure only a primary/left pointer press can start the long-press pickup timer.
- Right-button drag/orbit and stationary right-button hold must never trigger pickup.
- Preserve existing left-button long-press and touch pickup semantics, including the existing threshold and movement cancellation behavior.
- Correctly clear timers on pointer-up, pointer-cancel, component unmount, and any relevant multi-pointer transition.
- Do not break camera orbit, pointer capture, touch gestures, or placement confirmation.
- Add a regression test where feasible. If browser-level pointer testing is unavailable, document the exact runtime scenario for Arena verification.

### 4. Parity and regression checks
Run and report:
- `pnpm typecheck`
- `pnpm check`
- `pnpm build`
- focused tests and `pnpm test`
- runtime smoke at desktop and mobile widths if possible.

Runtime must explicitly verify:
- left long-press on a building still picks it up;
- right stationary hold for at least 700 ms does not pick it up;
- right drag still orbits the camera;
- left drag/pan and touch long-press still work;
- building placement and TownHall upgrade still work;
- Court -> Map -> Court navigation still works;
- no horizontal overflow at 390×844 and 320×690.

Capture genuine, unedited runtime screenshots and structured smoke output under:
`evidence/TDL-ARCH-002/`

Record exact tested HEAD SHA, environment, commands, exit codes, inherited failures, and screenshot filenames.

## Strict boundaries
- No visual changes, no new geometry, no materials, no textures, no 3D assets.
- Do not implement the material registry, glTF/KTX2 loading, server MIME/cache changes, quality profiles, or catalog/cost centralization in this task.
- Do not modify economy, server commands, building costs, footprints, grid dimensions, upgrade rules, or game state semantics.
- Do not install/update dependencies or change package manifests/lockfiles.
- Do not edit PRs #23/#24/#25 or `main`.
- Do not merge anything.
- Keep the legacy visuals intact. This task is accepted only if the current scene looks the same and interactions remain in parity apart from the right-button bug fix.

## Deliverables
- Small implementation diff on this branch.
- Focused tests.
- `evidence/TDL-ARCH-002/smoke-report.json`
- `evidence/TDL-ARCH-002/health.json` if runtime smoke is available.
- Genuine desktop/mobile screenshots.
- A concise report listing changed files, behavior preserved, bug fixed, test results, exact HEAD SHA, and any unresolved risks.

## Stop conditions
Stop without broadening scope if:
- grid helpers are coupled to rendering in a way that makes extraction non-trivial;
- input semantics cannot be preserved safely;
- tests reveal existing behavior differs from the audit;
- any change requires dependency, server, renderer, or gameplay-contract changes.
In that case, report the blocker and propose the smallest safe alternative; do not improvise a larger refactor.
