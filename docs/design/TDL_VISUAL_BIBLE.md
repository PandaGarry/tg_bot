# TDL Visual Bible — Settlement v1.0

> **Status:** working art-direction specification for owner review; not a claim that production assets exist.
> **Product direction:** Premium stylized realism, full 3D, isometric camera.
> **Scope:** first settlement vertical slice — Citadel + Farm + Sawmill + Quarry + Barracks, terrain, paths, props, lighting and settlement HUD.
> **Owner approval:** visual language is derived from the approved product direction of 12 November 2026. Individual model designs and the exact palette remain subject to visual review before production asset creation.

---

## 1. The visual promise

The Dead Lords is a ruined medieval world that has learned to live with death. It should feel ancient, inhabited, dangerous and valuable to explore. The player is rebuilding power in a hostile land — not decorating a cheerful fantasy village and not walking through a generic pile of gothic clichés.

**Target impression:** a premium strategy-game miniature world, with tactile handcrafted architecture, believable materials, deliberate silhouettes and restrained supernatural spectacle.

The scene must read clearly at normal gameplay zoom first. Close-up detail is a bonus, never a substitute for strong composition.

### Non-negotiable identity rules

- Full 3D geometry, real spatial placement, lighting and shadows for the settlement world.
- Original TDL architecture and symbols. No tracing, cloning or near-copying another game's recognizable buildings, UI, textures or compositions.
- The Citadel is the visual anchor; supporting buildings must feel like parts of the same settlement and culture.
- Undead atmosphere comes from material, history, environment and selective supernatural effects — not from putting skulls on every surface.
- Functional construction and upgrade stages must change the actual building presentation.
- UI is an authored game interface, not a medieval parchment texture placed behind every control.

## 2. Art direction pillars

1. **Ruined nobility.** Monumental medieval forms, damaged but maintained, with evidence of a society trying to endure.
2. **Tactile construction.** Stone blocks have weight; timber has grain and joinery; iron has thickness, fasteners and wear; cloth has seams and folds.
3. **Controlled corruption.** Necrotic energy is rare, purposeful and readable. It should feel dangerous and precious.
4. **Strong strategic readability.** Silhouette, footprint, faction cue and building function are identifiable at the normal isometric camera distance.
5. **One coherent world.** Buildings, terrain, props, roads, lighting and HUD share a common design grammar.

## 3. Shape language and architecture

### Primary forms

- **Citadel:** vertical, fortified, asymmetrical but balanced; a clear central mass, secondary towers, buttresses, crenellations and a singular supernatural focal feature. Its silhouette must remain recognizable when reduced to a small mobile-screen object.
- **Economic buildings:** lower and wider, built from practical timber/stone combinations. Their production function is visible in the architecture and props.
- **Military buildings:** heavier, more defensive silhouettes, thicker walls, reinforced gates, weapon racks and disciplined heraldic marks.
- **Utility structures:** compact, readable shapes; avoid visual competition with the Citadel.

### Detail hierarchy

- **Primary read:** overall silhouette, roofline, footprint and dominant material.
- **Secondary read:** entrances, structural supports, chimneys, machinery, banners and faction marks.
- **Tertiary read:** bolts, cracks, carvings, rope, nails, debris and surface variation.

At normal gameplay zoom, primary and secondary reads must survive. Tertiary details must not turn into noise or shimmer.

### Avoid

- Repeated identical towers, roofs or decorative kits across every building.
- Random spikes, skulls, chains and runes without structural or narrative purpose.
- Paper-thin walls, floating stairs, unsupported roofs, intersecting geometry and props that do not touch the ground.
- Pure black surfaces that lose all material information.
- Overly saturated green glow as the dominant scene color.

## 4. Color system

The palette below is a starting token set for art reviews, not a locked color-management profile. Values are sRGB hex references.

| Role | Starting color | Use |
|---|---|---|
| Deep iron | `#252A2D` | ironwork, deep recesses, UI base |
| Basalt | `#45494A` | primary dark stone |
| Weathered limestone | `#77766D` | readable stone edges and older masonry |
| Ash | `#A09B8C` | restrained highlights, pale stone, bone |
| Dead earth | `#514638` | soil, dry ground, worn timber shadows |
| Aged timber | `#49352B` | beams, doors, scaffolds |
| Tarnished bronze | `#80613A` | selected hardware and rank accents |
| Fire amber | `#D87932` | flame, warm windows, forge |
| Necrotic green | `#83A94B` | Citadel core and rare corruption accents |
| Cold spectral blue | `#7796A5` | selected magical/frozen effects only |

**Distribution rule:** most of the scene is desaturated stone, soil and wood. Warm amber provides local life and navigation cues. Necrotic green or spectral blue is a controlled accent, not a global tint. Do not use every accent color on every building.

## 5. Material standards

Materials must be distinguishable under the same lighting and at gameplay distance. Avoid relying on color alone.

| Material | Visual behavior | Detail cues | Avoid |
|---|---|---|---|
| Stone | matte, heavy, varied roughness | block seams, chipped edges, erosion, damp lower courses | uniform grey plastic, noisy grunge |
| Timber | matte/satin, warm-dark grain | beams, end grain, joints, splits, pegs | orange varnish, repeated procedural streaks |
| Iron | dark, mostly rough, small worn highlights | thickness, rivets, hinges, edge wear | mirror chrome, bright silver everywhere |
| Bronze | muted metallic accent | patina in recesses, worn raised edges | gold-plated ornament overload |
| Bone | warm ivory/ash, slightly varied | natural curvature, joints, cracks | clean white plastic skulls |
| Cloth/leather | low sheen, visible thickness | seams, folds, stitching, frayed edges | flat paper flags, high-gloss leather |
| Soil/ash | matte and irregular | compacted paths, footprints, stones, roots | one flat color plane |
| Necrotic crystal | emissive core with solid volume | facets, inner depth, restrained spill light | opaque neon blob or full-screen bloom |
| Fire | bright local source, warm spill | layered flame, embers, smoke where useful | constant oversized particles |

### Technical material guidance

- Prefer physically based materials with authored roughness/normal response over painted highlights baked into albedo.
- Keep albedo values plausible under the chosen exposure; reserve emission for actual light sources and supernatural objects.
- Use trim sheets and tileable materials where they preserve quality and reduce memory; unique textures only where silhouette or hero detail justifies them.
- Texture compression, mipmaps and anisotropic filtering must be validated in the actual web/mobile runtime.
- No universal texture resolution is mandated before the asset budget and target devices are measured. Hero assets may receive more texel density than small props; distant objects must not carry close-up texture cost.

## 6. Lighting and atmosphere

### Baseline lighting setup

- A clear key light establishes readable form and shadow direction.
- Cool ambient fill preserves information in dark stone and timber.
- Contact shadows ground buildings and props; shadow softness and range must be tuned to the target platform.
- Fog adds depth selectively and must not wash out the settlement.
- Fire sources create localized warm pools, not an orange filter over the whole scene.
- Necrotic emission should create a subtle nearby response; bloom is restrained and never hides geometry.

### Scene mood

The default settlement mood is **cold overcast dusk/daylight**, with readable midtones. It is not permanent night. Dark fantasy does not mean underexposed gameplay.

Weather, time-of-day and animated environmental layers are later enhancements. The first slice needs one excellent, stable lighting preset before variants are introduced.

## 7. Landmark design: the Citadel

<badge color="success">Hero asset — highest priority</badge>

The Citadel is the player's seat of power and the composition's visual center. It must feel defensible, old, expanded over generations and partly transformed by necromancy.

### Required visual construction

- Broad stone foundation with a readable footprint and grounded contact.
- A dominant central keep with a distinct roofline and at least two supporting vertical masses.
- Buttresses, parapets, narrow defensive openings and a credible entrance sequence.
- Dark timber/iron secondary construction where structurally plausible.
- One signature necrotic feature: a contained crystal, sealed rift, rune aperture or equivalent original TDL motif. The feature must be integrated into the architecture, not simply floating above it.
- A small number of banners, emblems or bone details that establish faction identity.
- Damage and repair history: repaired masonry, blocked openings, mismatched stone courses and weathering.

### Upgrade progression

- **Stage I — reclaimed stronghold:** repaired outer shell, limited defenses, small controlled magical core.
- **Stage II — fortified seat:** expanded defensive silhouette, stronger entrance, additional structural reinforcement and clearer faction identity.
- **Stage III — awakened Citadel:** major architectural transformation and a more powerful but still controlled supernatural feature.

Each stage must be a distinct model or a clearly authored model-state combination. Do not communicate an upgrade only through a level number, color tint or particle effect.

### Acceptance at gameplay zoom

The Citadel must be the first object recognized, but must not occupy so much screen area that the player loses the settlement. Its entrance, main tower and signature feature should remain distinguishable on a 390px-wide viewport.

## 8. Four supporting building archetypes

These four archetypes are the first production set around the Citadel. Final silhouettes and detailed designs are subject to owner visual review.

### 8.1 Farm — food production

- Low, broad composition with a weathered stone storehouse or timber granary.
- A visible working area: fenced plots, sacks, carts, troughs or drying racks.
- Dead or hardy crops fit the world; do not make it a bright pastoral farm.
- Silhouette: horizontal roofline, granary volume and a clear production yard.
- Upgrade language: more storage/working capacity and better structural repair, not simply a larger fence.

### 8.2 Sawmill — timber production

- Strong timber frame, covered cutting area and a recognizable saw mechanism.
- Stacked logs, squared beams and a log-handling yard communicate function.
- Iron blades and fasteners are functional details, not decorative clutter.
- Silhouette: pitched canopy, exposed beams and vertical log stacks.
- Upgrade language: more substantial machinery, expanded covered workspace and improved supports.

### 8.3 Quarry — stone production

- A cut into rock or a terraced extraction face, with a compact tool shed or hoist.
- Blocks, rubble, ramps, wedges and a crane/derrick show the extraction process.
- The quarry must visually connect to the terrain rather than look like a house placed on a rock.
- Silhouette: stepped rock face, timber lifting frame and block stacks.
- Upgrade language: deeper/expanded extraction, stronger hoist and more organized stone storage.

### 8.4 Barracks — military recruitment

- Heavier stone base, reinforced timber upper structure and a defensible entrance.
- Training yard, weapon racks, target dummies or a small drill space.
- Restrained banners and unit markers distinguish it from economic buildings.
- Silhouette: fortified roofline, gate and visible training yard.
- Upgrade language: stronger defensive envelope, expanded training space and clearer military identity.

### Shared building rules

- A building's function must be readable without its UI label.
- The footprint, pivot, front direction and ground contact must be documented.
- Props belong to a building's authored composition and must not obscure selection or placement.
- Building families share construction logic and material language, but not identical silhouettes.
- Level changes affect meaningful geometry, not only decals or particle count.

## 9. Settlement ground and environment

The settlement is a designed environment, not a flat board with buildings dropped onto it.

### Required layers

1. **Terrain base:** subtle height variation, believable soil/stone transitions and clear playable boundaries.
2. **Paths:** compacted, readable routes connecting the entrance, Citadel and production buildings.
3. **Edges and elevation:** retaining walls, steps, rocks, broken paving and terrain cuts where they explain the site.
4. **Vegetation:** dead grass, roots, sparse twisted trees and selective hardy growth. Keep the playable area legible.
5. **Settlement props:** carts, barrels, crates, tools, braziers, fences, rubble and work materials, placed with a reason.
6. **Atmosphere:** restrained fog, smoke, drifting ash or embers. These are optional layers after the base scene is clear and performant.

Use negative space intentionally. Do not fill every empty cell with debris. The scene needs readable paths and room for future expansion.

## 10. Isometric camera and composition

- Use a stable isometric-style perspective with controlled perspective strength; do not distort verticals or make tall buildings unreadable.
- Default camera must show the Citadel and enough supporting settlement to communicate place and scale.
- Keep building footprints and placement cells visually consistent under zoom and pan.
- Provide bounded zoom and predictable pan; mobile gestures must not fight page scrolling.
- Reserve safe, predictable screen regions for HUD and contextual panels.
- Desktop should use the available viewport deliberately; do not leave unexplained black side gutters around a narrow fixed-width board.
- Mobile must prioritize the world and current action; contextual panels should not cover the object or critical world information they describe.
- Validate at minimum 1376×768, 390×844 and 320×690, including touch context and safe areas.

## 11. HUD visual language

The HUD is a separate but coherent layer. It should feel premium and strategic, not like a collection of unrelated fantasy frames.

### Surface and hierarchy

- Use deep charcoal/iron surfaces with restrained stone, leather or metal accents.
- Use a single clear accent for primary actions; reserve warning, success and destructive colors for semantic states.
- Establish a consistent spacing, corner, border, shadow and typography scale.
- Resource counters must be compact and scannable; icons must be distinct at small sizes.
- Primary action, cost, requirement, timer and disabled reason must have clear hierarchy.
- Avoid excessive ornament, glowing borders on every card, parchment overload and ornamental typefaces for small body copy.

### Interaction states

Every reusable control/panel must define default, hover/focus (where relevant), pressed, selected, disabled, loading, success and error states. Touch targets must be comfortably tappable and must not depend on hover.

The world and HUD must remain visually coherent, but HUD legibility takes precedence over decorative realism.

## 12. Asset production and integration contract

Every production asset must have a record containing:

- stable asset ID, display name and category;
- source (original, licensed or modified licensed), author/vendor and license evidence;
- source file and exported runtime file;
- scale, units, pivot, forward axis and ground-contact convention;
- gameplay footprint, selection/collision bounds and placement orientation;
- material/texture list and texture dimensions;
- LOD or distance fallback strategy where required;
- supported upgrade stages and variants;
- mobile/desktop review status and known limitations.

### Production workflow

1. Approve a silhouette sheet or blockout for the building family.
2. Approve a material/color study under the baseline lighting.
3. Build the high-quality hero model and shared modular pieces.
4. Create optimized runtime meshes/materials and LODs as needed.
5. Integrate into the real settlement scene with terrain, props and HUD.
6. Review at gameplay zoom and all required viewports.
7. Record provenance/license and technical budget.
8. Accept or return with specific corrections.

A model preview on a blank background is not sufficient for final acceptance.

## 13. Performance and technical guardrails

These are workflow guardrails, not claims about current runtime performance.

- Reuse geometry/materials where appropriate; instance repeated props and vegetation.
- Keep transparent layers and particle overdraw under control.
- Avoid excessive dynamic shadow casters; prioritize the Citadel and nearby hero structures.
- Use LOD, impostors or simplified distant representations when the camera distance justifies them.
- Prefer glTF/GLB as a candidate interchange format for 3D assets, subject to the selected renderer's verified pipeline.
- Track draw calls, triangles, texture memory, shader variants, frame time and loading cost in the actual build.
- Keep a visual fallback for unsupported devices and context-loss recovery.
- Do not use Arena's SwiftShader CPU FPS figures as hardware performance evidence. Hardware targets require GPU-enabled testing and named physical devices.

Numeric budgets for triangles, draw calls, texture memory, texture resolution and LOD distances remain **TBD** until the renderer and representative target devices are selected. Inventing budgets before the benchmark would create false precision.

## 14. Visual acceptance checklist

A building or environment asset is accepted only when all relevant checks pass:

- [ ] Original TDL silhouette; no copied recognizable design.
- [ ] Function and footprint are readable at normal gameplay zoom.
- [ ] Correct scale, pivot, orientation and ground contact.
- [ ] Stone, timber, iron, cloth, bone and magic read as distinct materials.
- [ ] No floating/intersecting geometry or unsupported structural elements.
- [ ] Lighting reveals form without flattening or hiding the model.
- [ ] Detail hierarchy survives desktop and mobile gameplay distance.
- [ ] Upgrade stages have meaningful visual differences.
- [ ] Props support function and do not clutter paths or block interaction.
- [ ] HUD labels, costs, requirements and actions remain legible over the scene.
- [ ] 1376×768, 390×844 and 320×690 layouts reviewed.
- [ ] Asset provenance and license are recorded.
- [ ] Runtime screenshots are captured from the integrated build.
- [ ] Performance and memory behavior are measured on the agreed target matrix.

## 15. First visual review package

The first review is not a request to build the entire art pack. It is a focused approval package:

1. One Citadel silhouette sheet with three distinct original directions.
2. One selected Citadel blockout at the actual isometric camera angle.
3. Four supporting building silhouette/blockout studies (Farm, Sawmill, Quarry, Barracks).
4. One shared material board showing stone, timber, iron, bone, cloth and necrotic crystal under the same lighting.
5. One settlement composition blockout with terrain, paths, Citadel and the four buildings.
6. Desktop and mobile crops at the specified viewports.
7. A short asset/provenance inventory.

Only after the owner approves the visual direction should the team invest in final hero modeling and broad asset production.

---

## Change control

This Visual Bible translates the approved product direction into a reviewable art standard. It does not authorize engine migration, mass client refactoring, replacement of the full asset catalog, production deployment or a large-scale art purchase. Those require separate technical/product approval.

Any proposed departure must state what rule changes, why it improves TDL, what trade-offs it creates and how it will be validated.
