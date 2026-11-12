# TDL-VIS-004 — Citadel art pass and defect closure

## Intent
This is a focused art/geometry correction pass after TDL-VIS-003. The existing asset is still a blockout, not premium stylized realism. Do not mark it production-ready. The purpose is to close known functional/geometry defects and establish a stronger, evidence-led next art iteration.

## Exact scope / source
- Repository: `PandaGarry/tg_bot`
- Parent: PR #24, branch `feature/tdl-citadel-visual-polish-v2`
- This branch: `feature/tdl-citadel-art-pass-v1`
- Keep the existing React Three Fiber / Three.js renderer and all game systems.
- Do not touch `main`, PR #23, or PR #24. Do not merge anything.

## Changes already committed on this branch
1. `CourtInput` now ignores non-left mouse buttons for pickup pointer-down and pointer-up. Right/middle buttons remain available for camera controls.
2. Rear tower positions/radii have been pulled inward to fit the Citadel plinth better.
3. Crystal socket has been lowered to meet the timber roof; the green halo radius has been reduced and raised relative to the socket to avoid cutting through its stone/bronze collars.
4. Level 2 shadow camera has been tightened from a 48-unit square to a 24-unit square and map resolution increased to 4096; bias values adjusted to reduce the reported shadow acne.

These are hypotheses to validate, not assumed fixes. Check the actual rendered result and report any new collisions or performance costs.

## Required Arena work
1. Fetch latest HEAD of this branch, record exact 40-character SHA, test in isolated clean checkout.
2. Run install, typecheck, check, build, tests. Report exact commands, exit codes, counts; compare inherited test failures against main.
3. Launch game and verify `/api/health`.
4. Capture genuine, unedited PNG runtime evidence into `evidence/TDL-VIS-004/`:
   - Desktop 1376x768 full courtyard and front close-up.
   - Front/side/rear orbit close-ups at level 1.
   - Level 2 full and close-up/orbit.
   - Desktop right-button stationary hold >=700ms over Citadel, right-button drag, left-button long-press. Show that only left hold triggers pickup.
   - Mobile 390x844 and 320x690 full + close-up.
5. Inspect and report:
   - Rear towers fully supported by plinth; no overhang into ground, no intersection with quoins, no bad joins.
   - Crystal socket physically contacts roof; no visible gap; halo no longer cuts through stone/bronze.
   - Level-2 cornice corners are clean; no overlaps with towers, quoins, iron braces or upgraded side pilasters.
   - Shadow acne under roof/eaves and on tower crowns: compare against TDL-VIS-003. If higher shadow-map resolution is too expensive, use tighter shadow frustum, sensible bias/normalBias, selective shadow casting, or geometry separation. Do not simply hide all shadows or darken surfaces.
   - Check frame stability qualitatively only; this headless SwiftShader host cannot establish real-device FPS. Note GPU memory / rendering costs if observable.
   - Check all four facades. The rear and side walls are currently too empty: propose concrete facade details that fit the existing style (recessed slit windows, masonry courses, corner stonework, timber/iron details, rainwater channels, roof structure). Do not bulk-add random primitives; keep construction believable and silhouette readable.
6. Preserve interaction: placement, pickup, upgrade, map navigation, mobile HUD.

## Art direction gate — do not lower the bar
The TDL target is premium stylized realism, not a primitive low-poly blockout. Current screenshots still show flat single-colour surfaces, crude box/cylinder/cone masses, black unreadable shadows and a mostly empty side/rear. A successful build does not pass the art gate.

For this pass, prioritize defect closure and a practical material/art pipeline recommendation. Investigate whether the existing repository has suitable local texture/material assets and licenses before adding anything. Do not download or add unlicensed assets. If there are no suitable source textures, report the gap and propose a small curated PBR set (stone albedo/normal/roughness, dark timber, aged iron, roof slate) with provenance and mobile texture budgets.

Do not use generated images as flat in-game textures. Do not introduce new dependencies or migrate engine/renderer.

## Deliverables
- `evidence/TDL-VIS-004/`: runtime screenshots, smoke-report.json, health.json, console.txt, exact tested SHA and environment.
- Concise issue list: fixed / still open / newly introduced.
- A visual comparison against TDL-VIS-003. Be blunt if it remains a blockout.
- No changes to the implementation branch unless explicitly requested; commit evidence only to the Arena evidence branch.
- Do not merge.
