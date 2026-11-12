# TDL-VIS-002 — Gothic Citadel runtime prototype review

- **Owner:** ChatGPT — implementation/integration; Arena.ai — runtime validation
- **Product approval:** owner approved proceeding to visual prototype on 12.11.2026
- **PR:** https://github.com/PandaGarry/tg_bot/pull/23
- **Test exact HEAD:** `0ec73de0927ad17a126fab46de4b7ebce73a84b0`
- **Base:** `main` at `eaaa9072a729f69ae19d44a1449c1d94f27c07a1`
- **Scope:** first geometry/material prototype of the Citadel and shift of the settlement palette/lighting.

## Read first

1. `AGENTS.md`
2. `docs/AI_COLLABORATION/README.md`
3. `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`
4. `docs/design/TDL_VISUAL_BIBLE.md` (available on the Visual Bible review branch; if absent from main, use PR #22 branch `docs/tdl-visual-bible-v1`)
5. This handoff and PR #23.

## Changes in this prototype

- Replaces the previous town-hall mesh assembly with a 3D Citadel composition: stepped stone plinth, central keep, masonry courses, corner quoins, defensive buttresses, entrance/gate, three towers, roof crowns, iron braces and a necrotic crystal integrated into the forward tower.
- Citadel level 2 and 3 add architectural geometry.
- Shifts the world palette and lighting toward dark ashland, basalt, weathered stone, dark timber and restrained green emission.
- Keeps the existing R3F/Three.js renderer, camera, placement and game data contracts.

## Arena validation — exact HEAD only

1. Checkout PR #23 exact HEAD SHA above in an isolated worktree.
2. Install using the repository's documented package manager and lockfile.
3. Run client typecheck, production build and repository CI test commands; report exact commands and exit codes.
4. Run browser smoke in desktop viewport 1376×768 and mobile viewports 390×844 and 320×690.
5. Capture actual runtime screenshots of the Citadel at default gameplay zoom and a closer zoom, for each viewport. Do not substitute concept art.
6. Verify the Citadel does not intersect the palisade, hide the gate, float above the ground or obscure nearby buildings. Confirm entrance, towers and crystal remain readable.
7. Verify a Farm can still be placed and that placement grid, pan, zoom, pickup and build panel remain functional.
8. Inspect browser console, WebGL errors/context loss and loading behavior.
9. If level 2/3 state is available, capture those upgrade stages. If not, report unavailable; do not fabricate the state.
10. Return screenshot paths/links, commit SHA, viewport, test output and any defects.

## Acceptance criteria

- [ ] No TypeScript/build/test regressions.
- [ ] Citadel renders as a spatial 3D structure, not a flat sprite or image plane.
- [ ] Geometry is grounded; no visible floating or severe intersections.
- [ ] Necrotic emission is controlled and does not wash out surrounding geometry.
- [ ] Desktop and mobile composition remain usable; no severe clipping or HUD overlap introduced.
- [ ] Existing placement and camera interactions still work.
- [ ] Runtime screenshots and console report are attached.

## Known limitations / do not overclaim

- This is a first blockout-to-material prototype, not final production art.
- Supporting buildings remain largely from the old visual set; only the global palette/lighting was adjusted.
- No physical-device GPU/FPS claim is possible from Arena's SwiftShader environment.
- Do not merge PR #23 until review and runtime evidence are available.
