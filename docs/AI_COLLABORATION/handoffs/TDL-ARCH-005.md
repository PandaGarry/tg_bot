# TDL-ARCH-005 — Slice B1: безопасная декомпозиция CourtScene

> **Статус:** READY FOR ARENA IMPLEMENTATION  
> **Delivery branch:** `arena/ff89979b-tg-bot` (фиксированная сессионная ветка; не переключать)  
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

## 3. Implementation scope

Extract from the exact PR #28 source into cohesive modules under `apps/client/src/court/`:

1. `scene/CourtCamera.tsx` — camera rig and camera behavior.
2. `scene/CourtEnvironment.tsx` — ground, road tiles, gatehouse, palisade, trees, meadow/ambient scene elements. Fix the hardcoded ground offset `+ 6.5` to derive from the existing grid size without changing visible placement. Ensure the 26 `ShapeGeometry` allocations are disposed on unmount (or provide a documented alternative if lifecycle ownership makes a direct cleanup unsafe).
3. `scene/CourtInteraction.tsx` — grid overlay and interaction wiring using the existing PR #28 `courtInput.ts` / `gridMath.ts`; do not reimplement their logic.
4. `scene/WebglFallback.tsx` — WebGL availability fallback, retaining the current `court-fallback.jpg` behavior.
5. `materials/palette.ts` and `materials/MaterialRegistry.ts` — extract palette and centralize shared material definitions. Preserve exact old colors, roughness, metalness, opacity, side and transparency semantics. If safe shared material caching/disposal cannot be proven, first extract without changing instance lifecycle and document the follow-up; do not introduce a leak.
6. `buildings/citadel/CitadelLegacy.tsx` — current TownHall and roof banner only; no redesign.
7. `buildings/legacy/LegacyBuildings.tsx` — current building bodies, building list and existing VFX.
8. `performance/qualityProfiles.ts` — initial profile must preserve current DPR `[1, 1.75]` and shadow settings exactly. No adaptive quality behavior in this slice.

Keep `CourtScene.tsx` as the composition/root component. Avoid speculative abstractions and avoid unrelated formatting churn.

## 4. Required validation

Run from the exact source snapshot and record complete commands, versions, exit codes and test counts:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @tdl/client test`
- `pnpm typecheck`
- `pnpm check`
- `pnpm build`
- `pnpm test` — report individual failures honestly; exit code 0 alone is not a pass if assertions failed.

Repeat the TDL-ARCH-003 production-preview Playwright smoke gates:

- Desktop 1376×768: scene load, left drag pan, right hold no pickup, right drag orbit, left long-press pickup, farm placement, Town Hall upgrade Lv2.
- Navigation Court → Map → Court.
- Mobile emulation 390×844 and 320×690: touch long-press pickup, no horizontal overflow or HUD overlap.
- Capture before/after screenshots with identical viewport, camera, zoom, building state and deterministic setup. Include pixel-diff or side-by-side review. Any intentional pixel difference is a regression until explained and approved.
- Record console errors, page errors, failed requests and WebGL context events.
- If no physical mobile device/GPU is available, state that explicitly.

## 5. Evidence and deliverables

On `arena/ff89979b-tg-bot`, commit the implementation plus:

- `docs/AI_COLLABORATION/handoffs/TDL-ARCH-005.md` updated with DONE/PARTIAL and exact implementation source SHA.
- `evidence/TDL-ARCH-005/README.md`
- `evidence/TDL-ARCH-005/smoke-report.json`
- `evidence/TDL-ARCH-005/health.json`
- `evidence/TDL-ARCH-005/commands.log`
- `evidence/TDL-ARCH-005/console.txt`
- `evidence/TDL-ARCH-005/screenshots/*` — before/after desktop and both mobile viewport sets.

Report exact delivery commit SHA and changed-file list. No claims of merge or integration into PR #28: this is an Arena delivery artifact for independent review and selective integration.

## 6. Stop conditions

Stop and report rather than improvising if:
- source SHA differs from `db711655e870cfcbd1b337dd105a926d3da509fa`;
- the right-hold no-pickup behavior or touch/left long-press behavior regresses;
- preserving pixel parity requires changing game rules, domain/protocol, server or dependencies;
- a proposed material/geometry cleanup changes the visual baseline or cannot be safely disposed;
- any test or runtime gate fails.

## 7. Acceptance

Slice B1 is accepted only when the source provenance is exact, structural extraction is reviewable, all required gates pass (with known monorepo calendar failures separately disclosed), screenshots establish visual parity, and the evidence bundle is committed to the fixed Arena delivery branch.
