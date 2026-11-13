# THE BETWEEN — Visual Benchmark 01

Status: planning and asset qualification. This document does not approve a final engine or art direction.

## Goal

Prove that a sustainable 2D HD production pipeline can deliver a coherent, attractive, readable MMORPG scene before committing to a large content pipeline.

The first benchmark is a small frontier settlement in the existing Quiet Valley setting. The benchmark must be a real, interactive runtime scene, not a concept image or a static mock-up.

## Preferred visual direction

Primary candidate: high-resolution illustrated 2D with an oblique/isometric camera and restrained 2.5D depth cues.

Desired qualities:
- painterly or carefully illustrated materials; no default pixel-art look;
- coherent proportions, line weight, lighting direction and palette across every asset;
- terrain with organic transitions and controlled texture variation, not visible repetitive tile borders;
- architecture with readable construction details and distinct silhouettes;
- characters with a consistent scale and usable directional walk/idle animations;
- atmospheric depth, contact shadows and subtle ambient effects;
- enough clarity to read gameplay at desktop and mobile viewport sizes.

This is a direction to test, not a final art bible. A more stylized 2D treatment is acceptable if it looks intentional and high quality.

## Non-goals

- Do not start a full 3D asset-production pipeline for this benchmark.
- Do not model or hand-paint a large catalogue of assets before the art test passes.
- Do not mix unrelated packs merely because they are free.
- Do not use generated concept art as a substitute for runtime assets.
- Do not call the result production-ready or AAA.

## Asset qualification rules

Every candidate pack must be checked for:
1. Exact license and commercial-use permissions.
2. Original author and source URL.
3. Image resolution, alpha quality, sprite bounds and atlas structure.
4. Perspective, scale, outline treatment, palette and lighting compatibility.
5. Coverage of terrain, structures, props and characters.
6. Whether missing categories can be sourced in the same style without visual seams.

A pack that fails visual compatibility is rejected even if its license is permissive.

## Candidate research

### Rejected for the target art direction: Kenney Sketch Town

- Source: https://kenney.nl/assets/sketch-town
- Curated mirror: https://github.com/Tiddybub/2d-assets/tree/main/fantasy/sketch-town
- License: CC0-1.0, confirmed in the mirror's SOURCE.md and License.txt.
- Contents: 354 files in the curated mirror.
- Reason for rejection: the sample reads as bright, toy-like miniature diorama art. It is clean and technically useful, but its playful low-poly miniature appearance does not match the grounded, atmospheric frontier-fantasy tone currently sought for THE BETWEEN.
- No assets from this pack have been copied into the game repository.

### Candidate for visual inspection: 2DPIXX — Village (Tiled Environment | Isometric)

- Source: https://opengameart.org/content/village-tiled-environment-isometric
- Author: Jana Ochse / 2D!PIXX.
- License: CC-BY 3.0, as stated on the source page.
- Described contents: 49 isometric frames at 128×128.
- Status: candidate only. The archive and individual frames still need direct visual inspection and license-attribution packaging before any integration.
- Attribution, if used: "Jana Ochse (2D!PIXX), www.2dpixx.de".


### Paid quality benchmark candidate: Golden Skull Art — Village Exterior

- Source: https://goldenskullart-store.itch.io/2d-isometric-village-tile-pack
- Described contents: 312 high-resolution hand-drawn isometric sprites plus 80 conversion meshes; 512px atlas cells, 2:1 isometric grid.
- Commercial use is permitted under the seller's stated license; redistribution of the pack or derived assets is not permitted.
- Known caveats reported by the seller: some stone-wall/timber-frame border artifacts, some blurry props, placeholder signs, and non-standard y-positioning requirements.
- Status: strongest visual-quality candidate found so far, but not purchased, downloaded, inspected or integrated. Purchase requires an explicit project-budget decision. It must still pass our own visual and technical checks.
- Source explicitly states that no generative AI was used.

This pack is not automatically approved: the cost, usage restrictions and reported defects must be weighed against the benefit of a coherent hand-drawn asset base.

## Acceptance gates

A benchmark is not accepted until all gates pass:

### Visual
- No broken/transparent holes, missing texture regions, accidental seams or sprite clipping.
- No obvious mismatches in perspective, scale, palette or light direction.
- Buildings, trees, ground and characters read as one art direction.
- Terrain does not expose a distracting repeated grid.
- At least one full-screen settlement composition looks intentional and finished enough to judge.

### Runtime
- Real player movement and camera behavior.
- Object interaction and depth ordering.
- Stable rendering at desktop and mobile aspect ratios.
- No console/runtime errors.
- Screenshots captured from the actual running build.

### Performance
- Profile frame time and draw calls on a representative desktop viewport.
- Profile a constrained mobile viewport/device class before making performance claims.
- Avoid premature optimization; record measured bottlenecks.

### Production readiness
- Asset source and license ledger checked into the repository.
- Import settings documented, including filtering, mipmaps and compression.
- Reusable scene/prefab conventions documented.
- Clear separation between source assets, imported assets and generated build output.

## Technical approach

Godot 4.x remains a candidate, not an irrevocable decision. First prove the art pipeline and a representative scene. Use native 2D nodes, atlas/sprite resources, y-sorting, Camera2D, CanvasModulate/Light2D where appropriate, and lossless texture import for source artwork. Select filtering and mipmap behavior per asset class; do not apply one global setting blindly.

The existing browser Canvas prototype remains a reference for interaction and layout only. It is not the target rendering architecture.

## Next implementation step

Qualify one coherent environment pack and one compatible character set. Build a small Godot scene using real imported assets, then capture desktop and mobile runtime output. If the art cannot meet the visual gates without extensive patching, reject the pack and test another source rather than disguising the mismatch with code.
