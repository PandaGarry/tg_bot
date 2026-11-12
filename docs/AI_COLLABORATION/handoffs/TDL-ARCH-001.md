# TDL-ARCH-001 — Visual refactor repository audit

## Target
- Repository: `PandaGarry/tg_bot`
- Branch: `refactor/tdl-asset-pipeline-foundation`
- Exact starting HEAD: `a761453e2a69530af02298409b359bb481ff87e0`
- Architecture contract: `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md`

## Purpose
This is an audit-only task. The direction has changed: stop patching the primitive Citadel blockout. We are preparing a clean visual architecture and asset pipeline. Do not mass-detail the existing Citadel.

## Required work
1. Fetch the exact branch HEAD and record the full SHA.
2. Inventory the repository's actual visual assets:
   - 3D: glb, gltf, obj, fbx, blend, other model formats.
   - Textures: png, jpg/jpeg, webp, ktx/ktx2, hdr/exr, other material maps.
   - Include path, file size, dimensions, format, apparent role and license/provenance evidence.
   - Separate real runtime assets from concept art, screenshots, UI sprites and documentation references.
   - Do not infer a license from a filename or source website. Mark unknown when not documented.
3. Inspect the current client package and installed libraries:
   - glTF loading support and existing loader code.
   - PBR material support, texture color-space handling, normal maps, roughness/metalness.
   - texture compression and fallback support in the current browser/mobile pipeline.
   - available optimization tools already installed (including gltf-transform if present).
   - do not install dependencies or change package files.
4. Map current `CourtScene.tsx` responsibilities:
   - camera/navigation;
   - environment/ground/lighting;
   - input/selection/pickup/placement;
   - building grid/footprint;
   - building visual geometry and level variants.
   Identify safe extraction seams and dependencies. Do not modify code.
5. Identify existing gameplay interfaces and state sources for building type, level, footprint, position, placement, pickup and upgrade. Note any duplicated or hard-coded contracts.
6. Propose a minimal typed building-definition / visual-asset registry interface, with exact file paths and types. Do not implement it.
7. Provide a parity checklist and risk register for extracting scene responsibilities without changing gameplay.
8. If possible, run current baseline typecheck/check/build/tests and runtime smoke. Report exact commands, exit codes and inherited failures. Do not claim real GPU performance from SwiftShader.

## Deliverables
- `evidence/TDL-ARCH-001/asset-inventory.json`
- `evidence/TDL-ARCH-001/asset-inventory.md`
- `evidence/TDL-ARCH-001/runtime-capabilities.md`
- `evidence/TDL-ARCH-001/court-scene-extraction-map.md`
- `evidence/TDL-ARCH-001/parity-and-risk-register.md`
- `evidence/TDL-ARCH-001/smoke-report.json` and `health.json` if runtime smoke is possible
- Record exact SHA and environment.

## Strict boundaries
- Audit only. Do not edit source files, package files, assets, PRs #23/#24/#25, or main.
- Do not download assets.
- Do not use generated images as textures.
- Do not merge anything.
- Be blunt: if no production-ready model/texture assets exist, state that clearly.
