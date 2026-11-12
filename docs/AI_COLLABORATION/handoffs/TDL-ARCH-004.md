# TDL-ARCH-004 — visual asset inventory and architecture audit

**Status:** READY  
**Arena delivery branch:** `arena/ff89979b-tg-bot`  
**Architecture source branch:** `refactor/tdl-asset-pipeline-foundation`  
**Exact architecture source HEAD:** `0a5e465ede6096ecdfc33b4771b0761baf327fab`  
**Related PR:** https://github.com/PandaGarry/tg_bot/pull/26  
**Owner:** Arena.ai — repository/runtime audit; ChatGPT — technical direction, review and integration.

## Collaboration and branch protocol

Arena's session is fixed to `arena/ff89979b-tg-bot`; do not attempt to switch it or push to another branch. ChatGPT will work against this same Arena delivery branch for the handoff/evidence package. The source under audit must be cloned/read at the exact architecture SHA above. Keep source provenance explicit: do not claim that Arena's delivery branch itself is the architecture source branch.

Work sequentially. Before each commit, verify the current Arena branch HEAD. Do not force-push, do not alter application source in this audit, and do not overwrite existing evidence. ChatGPT will review the audit and selectively integrate accepted documentation into the architecture PR branch.

## Objective

Complete the first deliverable required by PR #26's architecture contract before any mass Citadel geometry production:
1. repository asset inventory with file paths, formats, sizes and license/provenance status;
2. runtime/dependency capability audit for glTF, PBR maps, compression and mobile fallbacks using existing tooling;
3. typed building-definition / asset-registry interface proposal;
4. extraction map from the current CourtScene to the target architecture;
5. gameplay parity and migration risk register.

This is an audit and proposal only. Do not implement the new renderer or replace assets.

## Read first

- `AGENTS.md`
- `docs/AI_COLLABORATION/README.md`
- `docs/AI_COLLABORATION/STATUS.md`
- `PROJECT_MASTER.md`
- `docs/DECISIONS.md`
- `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`
- `docs/design/TDL_VISUAL_REFACTOR_ARCHITECTURE.md` at source branch SHA `0a5e465ede6096ecdfc33b4771b0761baf327fab`
- `evidence/TDL-ARCH-003/README.md` and smoke report (functional baseline; not visual acceptance).

## Scope A — repository asset inventory

Inspect existing assets and list:
- exact repository path;
- file type/format and dimensions where applicable;
- file size;
- current use/reference in code;
- provenance / author / license evidence;
- commercial-use status: confirmed, restricted, unknown;
- recommended action: keep, convert, replace, remove, investigate.

Do not infer a license from a filename or from the fact that a file is in the repository. Mark unknown where no explicit license/provenance is recorded. Include fonts, icons, textures, models, environment props and generated files.

## Scope B — runtime and toolchain capability

Inspect current package manifests, installed dependencies and code paths. Determine evidence-backed support for:
- glTF / GLB loading in React Three Fiber and Three.js;
- PBR material maps: base color, normal, roughness, metalness, AO, emissive;
- color-space and normal-map handling;
- texture compression/transcoding (KTX2/Basis, if installed);
- geometry compression (Draco/Meshopt, if installed);
- mobile fallback behavior and lazy loading;
- asset path/build handling in Vite/server production preview.

For each capability state: available now / possible with installed dependency / requires new dependency / unsupported. Do not add dependencies or modify lockfiles.

## Scope C — typed architecture proposal

Provide a small TypeScript interface proposal for:
- BuildingDefinition keyed by domain building type;
- visual variants by authoritative building level;
- footprint metadata sourced from the existing domain contract (do not create a second authority);
- asset manifest entry with path, format, dimensions, material references, provenance and license;
- quality profile / LOD selection.

The proposal must not move economy, upgrade eligibility, placement rules or server state into the renderer. Show one concise Citadel example and one supporting-building example. No need to create production code.

## Scope D — extraction and parity map

Map current responsibilities/files to target modules:
- scene composition;
- environment/lighting/fog;
- camera;
- pointer/touch interaction;
- grid/footprint helpers;
- building registry/renderer;
- Citadel geometry;
- supporting building geometry;
- material definitions;
- asset loading and provenance.

For every proposed extraction list current owner, target owner, public interface, dependencies and parity tests. Reuse TDL-ARCH-003 scenarios: pan/orbit, left hold, right hold no-pickup, touch hold, placement, upgrade, navigation, 390/320 mobile layout.

## Scope E — risk register and recommendation

Prioritize risks: gameplay regression, duplicate footprint authority, asset licensing, mobile memory, draw calls/material count, texture formats, visual quality, migration sequencing, merge/base dependencies. Recommend a smallest safe first implementation slice.

## Deliverables

Commit only documentation/evidence to `arena/ff89979b-tg-bot`:
- `docs/design/TDL_ASSET_INVENTORY.md`
- `docs/design/TDL_RUNTIME_ASSET_CAPABILITIES.md`
- `docs/design/TDL_BUILDING_REGISTRY_PROPOSAL.md`
- `docs/design/TDL_COURTSCENE_EXTRACTION_MAP.md`
- `docs/design/TDL_VISUAL_MIGRATION_RISKS.md`
- `evidence/TDL-ARCH-004/README.md` with source SHA, inspected paths, commands, tool versions and limitations.

No screenshots are required unless an existing viewer/tool materially clarifies a current asset. Do not generate concept images. No source-code or package changes.

## Acceptance checklist

- [ ] All assets enumerated or explicit search boundaries documented.
- [ ] Every license/provenance is evidenced or marked unknown.
- [ ] Capability statements cite exact package versions / code references.
- [ ] Proposed types preserve domain as single source of truth.
- [ ] Extraction map names real files/functions and parity gates.
- [ ] Risk register prioritizes concrete failure modes.
- [ ] All docs are internally consistent with the visual architecture.
- [ ] No source code, dependencies, lockfiles or runtime behavior changed.
- [ ] Commit SHA and changed-file list reported.

## Final response format

- Arena branch / commit:
- Architecture source SHA inspected:
- Inventory totals (known / unknown provenance):
- Runtime capabilities:
- Proposed interfaces:
- Extraction map highlights:
- Top risks:
- Changed paths:
- Open questions:
- Recommended first implementation slice:

ChatGPT will review the package, update PR #26 architecture docs if needed, and decide whether the architecture gate is ready for owner review. Do not merge PR #26 or #28.
