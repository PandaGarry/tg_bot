# TDL Visual Refactor — Asset Pipeline & Building Architecture

Status: proposed implementation contract  
Base: `main` at `eaaa9072a729f69ae19d44a1449c1d94f27c07a1`  
Branch: `refactor/tdl-asset-pipeline-foundation`

## 1. Decision

Stop extending the current primitive-based Citadel blockout. Build a clean, data-driven visual architecture while preserving the current game systems and React Three Fiber / Three.js runtime.

The current `CourtScene.tsx` mixes scene composition, environment, input, grid/footprint helpers, and building geometry. It also constructs the Citadel from primitive meshes with mostly single-colour materials. This is a prototype implementation, not the production asset foundation.

This refactor must not become a renderer migration, gameplay rewrite, or a cosmetic patch series.

## 2. Non-goals and safety

- Do not merge PR #23, #24, or #25 as part of this work.
- Do not modify `main` directly.
- Do not migrate away from React Three Fiber / Three.js.
- Do not change economy, building timers, placement rules, footprints, upgrade rules, or server contracts.
- Do not use generated images as flat in-game textures.
- Do not add assets with unclear source, license, commercial-use rights, or attribution obligations.
- Do not replace working gameplay interactions until parity tests exist.
- Keep old scene available on its existing branches for visual and behavioral comparison.

## 3. Target code architecture

Separate the visual system into explicit layers. Exact paths may be adjusted after code audit, but ownership boundaries must remain:

```
apps/client/src/court/
  scene/
    CourtScene.tsx             # scene composition only
    CourtEnvironment.tsx      # ground, lighting, fog, atmosphere
    CourtCamera.tsx            # camera and navigation
    CourtInteraction.tsx       # selection, placement, pickup
  buildings/
    BuildingRenderer.tsx       # resolves building type + level to asset
    BuildingRegistry.ts        # typed registry, footprints, level variants
    definitions/               # data-only building definitions
    citadel/                   # Citadel assembly and subcomponents
    shared/                    # reusable architectural modules
  materials/
    MaterialRegistry.ts        # semantic material IDs and tuning
    materials/                 # stone, timber, iron, slate, bone, effects
  assets/
    manifest.ts                # paths, dimensions, license/provenance
    loaders/                   # glTF loading and validation
  performance/
    qualityProfiles.ts         # mobile / balanced / desktop budgets
```

Do not create empty folders just to match this sketch. Extract modules in small, buildable steps and preserve typed interfaces.

### Ownership boundaries

- Gameplay/domain layer owns building type, level, footprint, grid position, state and upgrade eligibility.
- Building registry maps domain building IDs and levels to visual asset IDs.
- Asset components own geometry/material presentation only.
- Scene owns environment, camera, lighting and render composition.
- Interaction layer translates pointer/touch input into existing game actions; it does not own building geometry.
- Asset manifest records file path, dimensions, texture references, provenance, license and attribution.

A building renderer must not calculate economy or invent gameplay state. A visual level variant must be selected from the authoritative building level.

## 4. Asset strategy

Use a hybrid production pipeline:

1. **Authored modular geometry** for architecture that defines TDL identity: Citadel silhouette, towers, gates, rooflines, buttresses, major supports and signature ornaments.
2. **Curated licensed glTF assets** only for supporting props where they fit the art direction and have documented rights.
3. **Procedural geometry** only for repeatable structural systems (masonry courses, roof tiles, beams, trims, modular wall sections), with controlled variation and believable construction logic.
4. **PBR material sets** shared across buildings, not unrelated per-mesh flat colours.

Do not make the building out of hundreds of unrelated primitives. Use a small number of authored, reusable modules and combined/instanced repeated details where appropriate.

### Required material families

| Material ID | Required maps / properties | Visual read |
|---|---|---|
| `stone_basalt` | albedo, normal, roughness; optional height/AO | dark volcanic masonry, chipped edges |
| `stone_limestone` | albedo, normal, roughness | pale worn cut stone, subtle strata |
| `timber_blackened` | albedo, normal, roughness | dark aged structural wood, grain |
| `iron_forged` | albedo, normal, roughness, metalness | aged iron, restrained edge wear |
| `roof_slate` | albedo, normal, roughness | layered slate/shingle roof |
| `bone_ivory` | albedo, normal, roughness | aged bone, restrained use |
| `necrotic_crystal` | controlled emissive + physically plausible base | focal magic accent, not a global green wash |

All maps must be authored or sourced with documented rights. Prefer tileable maps at sensible resolutions. Do not fake material detail by painting a full building into one texture.

### Texture and runtime budgets (initial targets; validate on actual devices)

- Desktop: 2K for hero materials where justified; 1K for most shared materials.
- Mobile: 1K maximum for shared building materials by default; 512 px for small props.
- Reuse material maps across assets; avoid unique texture sets for every building.
- Use compressed GPU texture formats supported by the target browser/device pipeline; document fallback behavior.
- Avoid unnecessary alpha transparency and excessive emissive/postprocessing.
- Keep material count, draw calls, geometry size and texture memory measurable per scene.

These are budgets to validate, not claims about current performance.

## 5. Architectural quality rules

Every building must pass these rules before it is called an asset:

- A readable silhouette at normal gameplay zoom and at mobile width.
- A coherent structural load path: towers, balconies, roofs and galleries visibly rest on supports.
- Consistent wall thickness, scale, bevel language and architectural proportions.
- Four designed facades; side and rear are not unfinished backs.
- Recessed openings with depth: doors, arrow slits, windows and arches must not be black decals.
- Roofs must have believable eaves, ridge/cap, thickness and repeated slate/shingle structure.
- Masonry courses, quoins, lintels, sills, buttresses and joints must align.
- No floating ornaments, coplanar surfaces, z-fighting, intersections or unsupported overhangs.
- Material identity must remain legible under the approved lighting and at gameplay distance.
- Upgrade stages must visibly evolve the architecture, not just scale the same mesh or add a badge.

## 6. Citadel as the vertical-slice asset

The Citadel is the first and only asset to receive the full pipeline until it passes review.

Required deliverables:

- A distinctive gothic/undead silhouette with a strong central keep, supported towers and coherent roofline.
- Four complete facades, including rear and both sides.
- Modular stone foundation, wall sections, corner stones, recessed windows, gate/door assembly, buttresses, roof structure, slate, timber and iron fittings.
- A physically integrated necrotic focal element with a designed mount and controlled light.
- At least three intentional visual upgrade states with coherent additions and material changes.
- Shared PBR materials from the material registry.
- Mobile-friendly LOD / detail reduction where needed.
- A clean asset manifest with provenance and dimensions.

The Citadel must be reviewed in actual runtime screenshots from front, both sides, rear, gameplay zoom and close-up. A standalone model preview is not sufficient.

## 7. Migration sequence

### Phase A — audit and boundaries
- Inventory the current scene, building types, level states, interaction handlers, package support and existing assets.
- Record all existing gameplay contracts and identify which code can be extracted without behavior changes.
- Inventory every candidate texture/model with provenance and license status.
- Produce a baseline screenshot/evidence set before visual replacement.

### Phase B — structural refactor
- Extract camera, environment, interaction and building rendering boundaries.
- Introduce typed building definitions and registry.
- Keep existing visuals as a temporary legacy renderer behind the same building interface.
- Add parity checks for placement, selection, pickup, upgrade, mobile touch and map navigation.

### Phase C — material and asset foundation
- Implement material registry and asset manifest.
- Add validated texture loading, color-space handling, normal-map handling and fallbacks.
- Add glTF loading/validation and optional optimization using existing repository tooling.
- Add quality profiles and asset budget reporting.

### Phase D — Citadel production asset
- Build modular geometry and shared materials.
- Implement level variants.
- Validate silhouette, facades, material response, lighting and performance.
- Replace the legacy Citadel only after visual and gameplay acceptance.

### Phase E — building family rollout
Only after Citadel approval, adapt the shared grammar to farm, sawmill, quarry and other buildings. Each building must have its own function-specific silhouette; do not simply recolor the Citadel modules.

## 8. Acceptance gates

A phase is not complete because TypeScript or the build passes.

### Architecture gate
- Scene responsibilities are separated.
- Gameplay/domain contracts remain unchanged.
- Legacy renderer can be switched on for comparison.
- Typecheck, tests, lint/check and build pass, or inherited failures are documented against main.

### Asset gate
- Provenance and license recorded for every non-original asset.
- Materials are visibly distinct at gameplay zoom.
- All four facades are finished.
- No floating, intersecting or unsupported geometry.
- Level changes are intentional and readable.

### Runtime gate
- Exact tested commit SHA recorded.
- Genuine unedited runtime screenshots at desktop and mobile sizes.
- Placement, selection, pickup, upgrade and navigation verified.
- No new console errors or failed asset requests.
- Performance measurements are taken on representative real hardware; headless SwiftShader is not accepted as a real GPU benchmark.

### Art direction gate
Target: premium stylized realism in a dark medieval undead world. The accepted result must have convincing material response, layered architecture, restrained atmospheric lighting and a distinct TDL identity. A clean blockout, even with perfect tests, does not pass.

## 9. Required first deliverable

Before mass geometry production, submit:

1. A repository asset inventory with file paths, formats, sizes and license/provenance status.
2. A dependency/runtime capability check for glTF, PBR maps, compression and mobile fallbacks using already-installed tooling.
3. A proposed typed interface for building definitions and asset registry.
4. A short extraction map from current `CourtScene.tsx` to the new ownership boundaries.
5. A risk list showing how gameplay parity will be preserved.

Do not begin mass-detailing the old Citadel. Do not merge this foundation branch without review.
