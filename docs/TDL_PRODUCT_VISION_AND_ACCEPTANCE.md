# The Dead Lords — Product Vision & Acceptance Specification

> **Document:** Product vision, approved direction and acceptance gates  
> **Version:** 1.0  
> **Decision status:** Approved by product owner on 12 November 2026  
> **Repository:** `PandaGarry/tg_bot`  
> **Working branch:** `arena/8885a9e3-tg-bot`  
> **Product:** The Dead Lords (TDL)  
> **Scope of this document:** Product and quality direction. It does not authorize a mass refactor, engine migration, broad asset replacement or production release.

This document records the approved direction for TDL and defines how progress will be judged. It is a product specification, not a claim that the described features or quality levels already exist.

---

## 1. Product vision

The Dead Lords is an original dark-fantasy 4X strategy set in a world shaped by undeath, ruined kingdoms and competing powers. The player develops a stronghold, manages its economy, researches technologies, commands armies, explores and contests a persistent world, and cooperates or competes with other players.

The game must feel like one coherent world. Its settlement, global map, armies, interface, sound, effects, progression and social systems must share the same visual and mechanical identity.

**The target is a high-quality, commercially credible 4X experience, not a clone of another game.** Viking Rise, Rise of Kingdoms and Game of Thrones: Conquest are quality and genre references only. TDL must not copy their assets, interface layouts, names, lore, text, animations or exact implementations.

### Product pillars

1. **A distinctive undead fantasy world.** Ruined medieval kingdoms, necromantic power, factions, creatures, lords and a consistent visual language.
2. **A meaningful stronghold.** Buildings, upgrades, production, storage, research, queues and visible progression are connected to real game state.
3. **A persistent strategic world.** Territories, resource locations, scouting, marches, armies, PvE/PvP and player interaction are governed by authoritative server rules.
4. **Long-term strategic progression.** Meaningful choices across economy, technology, commanders, troops, territory and alliance play.
5. **A polished, accessible client.** Responsive touch-first mobile use and a deliberate desktop/browser experience, with localization and accessibility treated as requirements.
6. **Trustworthy systems.** Server-authoritative state, secure transactions, recoverable persistence, transparent combat outcomes and fair monetization.

---

## 2. Approved project decisions

The following choices are approved and are the baseline for future implementation.

| Area | Approved decision | Practical meaning |
|---|---|---|
| Art direction | **Premium stylized realism** | Detailed, tactile materials and convincing lighting, with deliberate stylization and readable silhouettes. Not flat cartoon art and not an attempt at photorealism at any cost. |
| World presentation | **Full 3D with an isometric camera** | Real 3D geometry, lighting, depth, camera framing and spatial placement. The camera may support controlled rotation/zoom where it improves play and usability. |
| Asset production | **Original models + properly licensed assets + manual art direction and finishing** | A coherent custom asset library. Purchased/licensed assets are source material, not a reason to accept mismatched quality. |
| First major milestone | **A high-quality vertical prototype first, then expansion** | Prove the visual, technical and gameplay foundations in one complete playable slice before scaling content and systems. |
| Platforms | **Mobile + browser/PC together** | Shared game rules and account/world state, with layouts and input adapted to touch and pointer/keyboard. Each target must be tested, not merely resized. |
| Identity | **Original TDL undead fantasy universe** | Keep TDL's own lore, factions, architecture, names, creatures, UI language and world-building. No direct copying. |

These decisions are not permission to change the engine or rewrite the client pre-emptively. Engine/rendering choices must be validated against a working prototype and measured constraints before any migration is proposed.

---

## 3. Visual direction: Premium stylized realism

### 3.1 Core visual identity

TDL should look like a dark, lived-in medieval world after a supernatural catastrophe. The world is dangerous and ancient, but not visually muddy or unreadable.

**Primary materials**
- weathered stone, cracked masonry and carved reliefs;
- dark, aged timber and damaged beams;
- forged iron, tarnished metal, chains and rivets;
- bone, leather, cloth, banners and restrained heraldic details;
- ash, soil, dead grass, roots, moss and corrupted ground;
- controlled supernatural materials: cold necromantic light, runes, crystals and spectral energy.

**Lighting and atmosphere**
- directional daylight and readable shadow shapes;
- cold ambient fill, fog and atmospheric depth used with restraint;
- warm fire, windows, braziers and furnaces as local contrast;
- supernatural glow as a meaningful accent, not a permanent bloom layer;
- weather and time-of-day variation only where they can be rendered and optimized reliably.

**Color language**
- restrained, desaturated environmental base;
- stone grey, ash, cold blue-grey, dead earth and dark wood;
- warm amber/orange for fire, interiors and selected points of life;
- limited cyan, violet or sickly green for distinct forms of magic, corruption or faction identity.

### 3.2 Shape, detail and readability

- Every building must have a recognizable silhouette at normal gameplay zoom.
- Important structures must remain distinguishable on narrow mobile screens.
- Detail must reinforce function, faction and upgrade level; avoid random ornament.
- Materials must read as different materials at gameplay distance, not as noisy high-frequency textures.
- Upgrade stages must change the model visibly and intentionally, not only the level badge.
- VFX must communicate an event or state: construction, upgrade, production, selection, damage, magic or victory.
- Effects must not obscure building silhouettes, labels, controls or tactical information.

### 3.3 Building and environment requirements

Each production-ready building asset must have:
- approved concept/reference and a defined gameplay footprint;
- consistent scale, pivot, orientation and ground contact;
- a model/mesh appropriate to its expected camera distance;
- coherent materials, texture resolution and lighting response;
- a defined LOD or equivalent distance-quality strategy where needed;
- collision/interaction bounds where applicable;
- a documented set of upgrade stages and any stage-specific effects;
- a mobile performance budget and tested fallback behavior.

The settlement must not be a collection of unrelated isolated sprites. Ground, paths, elevation, rocks, vegetation, walls, props, lighting, shadows and buildings must form one designed scene.

### 3.4 UI art direction

The interface must belong to the same world without sacrificing clarity:
- strong hierarchy, consistent spacing, typography and icon grammar;
- restrained dark surfaces, material framing and faction accents;
- clear resource, timer, level, requirement and action states;
- consistent panels, dialogs, tabs, tooltips, notifications and navigation;
- localized strings rather than hard-coded language-specific labels;
- responsive layouts that use the available screen area intentionally;
- no fake counters, decorative controls that do nothing, or placeholder actions presented as working features.

UI must remain readable and fast. Texture, ornament and animation are subordinate to comprehension and interaction.

### 3.5 Asset provenance and quality control

- Every non-original asset must have recorded source, license, permitted use and any attribution obligations.
- Do not use an asset whose license or commercial-use rights are unclear.
- Generated material may be used only as a draft/reference or as a reviewed production input where provenance and rights are acceptable. It must not be passed off as a finished hand-authored asset.
- A visual review must check the asset in the actual game scene, at gameplay zoom and on both narrow and wide layouts.
- A concept render or isolated model preview is not proof that the asset is integrated or shippable.

---

## 4. World and camera

The approved presentation is full 3D with an isometric gameplay camera.

### Required behavior
- stable, readable default camera framing;
- smooth, bounded zoom with useful minimum and maximum distances;
- predictable pan/drag behavior on touch and pointer input;
- no accidental page scrolling or gesture conflicts during world interaction;
- consistent building placement and selection under camera movement;
- sensible handling of viewport resize, orientation changes and safe areas;
- camera bounds that prevent the player from losing the playable settlement;
- performance-aware scene visibility and level-of-detail behavior.

Camera rotation is optional and must not be implemented at the expense of usability, performance or visual consistency. The final control model is to be validated with a playable prototype.

### World extensibility
The scene foundation must support adding more terrain, structures, props, effects and eventually larger world spaces without rebuilding the entire rendering architecture. The exact streaming/chunking strategy is a technical decision to be benchmarked, not assumed in advance.

---

## 5. Gameplay vision and system boundaries

The long-term product is a connected 4X game. The systems below describe the intended product, not a claim of current implementation completeness.

### 5.1 Stronghold and economy
- building placement, ownership, construction and upgrades;
- building levels and upgrade-stage presentation;
- resource production tied to building level and server-side time;
- storage limits, collection, costs, prerequisites and queues;
- clear resource sources, sinks and transaction history;
- persistent state across reconnects and server restarts.

### 5.2 Research and progression
- technology branches with explicit prerequisites and costs;
- progression that changes strategic options, not only displayed numbers;
- research queues and server-authoritative timers;
- clear previews of effects and requirements.

### 5.3 Commanders and armies
- commanders with distinct roles and progression;
- troop types with readable strengths, weaknesses and costs;
- recruitment, healing, capacity and army composition;
- server-validated army state and march availability.

### 5.4 World map and marches
- persistent world map with territories and resource locations;
- scouting and information rules;
- march creation, travel time, arrival and return;
- ownership, contest and protection rules;
- server-authoritative movement and event resolution.

### 5.5 Combat
- deterministic or reproducible server-side resolution;
- explicit inputs, rules and combat report;
- meaningful commander, troop, technology and terrain effects;
- PvE and PvP rules with anti-cheat validation;
- no client-side authority over casualties, loot, victory or ownership.

### 5.6 Alliances and social play
- alliance membership, roles and permissions;
- shared objectives and territory cooperation;
- chat and notifications with moderation and abuse controls;
- clear privacy and access boundaries between worlds and players.

### 5.7 Live operations and monetization
- events and seasonal progression with auditable schedules;
- rewards and purchases processed idempotently and validated server-side;
- transparent purchase outcomes and recovery paths;
- monetization must not corrupt core economy integrity or misrepresent probabilities/benefits.

### System integration rule

A feature is not accepted because a panel, button, animation or mock response exists. Its full path must work: player action → validation → authoritative state change → persistence → response/event → updated UI → reconnect/reload consistency.

---

## 6. Architecture and engineering principles

The current repository architecture is the starting point. This document does not mandate a new engine, framework or backend rewrite.

### Non-negotiable principles
1. The server and database remain authoritative for resources, timers, ownership, marches, combat, rewards and purchases.
2. Client input is untrusted. Every command is validated for identity, world, permissions, prerequisites, cost, timing and idempotency.
3. Economy and ownership changes are transactional and protected against races and duplicate commands.
4. Time-based progression is derived from trusted server time, not the device clock.
5. State survives reconnects and process restarts.
6. World/player isolation applies to sessions, commands, queries, events, background jobs and administrative paths.
7. Migrations are reversible where practical, backed up and tested against realistic data before release.
8. Localization, responsive behavior, observability, security and accessibility are part of feature acceptance.
9. Performance optimization is measured on representative devices and realistic scene/data loads.
10. No mass refactor or engine migration without a written proposal, measurable reason, migration plan, rollback path and product-owner approval.

### Rendering/engine decision gate

Before committing to a renderer or replacing the current client foundation, build a representative prototype and compare:
- visual quality at actual gameplay camera distance;
- mobile GPU/CPU/memory behavior;
- desktop/browser behavior;
- asset pipeline and iteration cost;
- input, camera and UI integration;
- loading, recovery and compatibility;
- long-term maintainability and team/tooling constraints.

The selected technology must be justified by measured results. Do not choose a technology only because it is fashionable or because a demo looks impressive.

---

## 7. First vertical prototype: scope

The first vertical prototype is the first hard proof that TDL's approved direction can be delivered in the real product.

### Included

**A. A complete settlement scene**
- real 3D ground and coherent terrain composition;
- the Citadel as the visual and functional centerpiece;
- at least four supporting buildings selected from the current product building set (for example: Farm, Sawmill, Quarry and Barracks);
- coherent props, paths, environmental detail, lighting, shadows and atmosphere;
- readable silhouettes and composition at mobile and desktop camera distances.

**B. Real building progression**
- selection and contextual information;
- visible level and upgrade requirements;
- construction/upgrade action with server validation;
- timer and completion state;
- visibly different approved stage/model after upgrade;
- state retained after reload/reconnect.

**C. A working economy loop**
- at least two resource types used by the prototype;
- production rates tied to actual building levels;
- storage/cap rules and upgrade costs;
- collection or automatic accrual rules clearly shown;
- server-side calculation and persistence;
- no fabricated resource values or client-only rewards.

**D. Production-quality interface slice**
- settlement HUD and resource display;
- building selection panel;
- construction/upgrade panel;
- progress/timer feedback;
- localized Russian and English strings for every visible control and state;
- responsive mobile and wide-screen layouts;
- loading, empty, error, disabled, success and insufficient-resource states.

**E. Technical proof**
- production build and automated tests;
- browser walkthrough covering the full player loop;
- no critical console errors or unhandled network failures;
- measured frame time, memory and loading behavior;
- screenshots captured from the running build, not from a concept render.

### Explicitly out of scope for this first prototype

The first settlement prototype does not claim to complete the global map, alliance system, PvP, full combat, commander collection, live events or monetization. These remain part of the product roadmap and must be implemented as real connected systems in later milestones. Do not create nonfunctional placeholders that imply otherwise.

---

## 8. Acceptance criteria

Acceptance is evidence-based. A milestone is not complete because code was written, a build passed, a mockup looks good or a feature is described in documentation.

### Gate 0 — Specification and baseline
- [ ] Approved decisions in Section 2 are recorded in the project decision log.
- [ ] Existing architecture, renderer, asset pipeline and current gameplay loop are documented accurately.
- [ ] Known defects and incomplete systems are separated from completed, tested behavior.
- [ ] The baseline build, tests and screenshots are recorded against a specific commit.
- [ ] No mass refactor is started under the authority of this document alone.

**Exit evidence:** reviewed specification, baseline commit, test report and prioritized implementation plan.

### Gate 1 — Visual prototype
- [ ] Full 3D/isometric presentation is demonstrated in the actual TDL client.
- [ ] Citadel and at least four supporting buildings form one coherent settlement.
- [ ] Materials, lighting, ground, props and environmental detail match the approved art direction.
- [ ] Buildings are recognizable at normal gameplay zoom and remain readable on a narrow phone viewport.
- [ ] Selection, construction and upgrade feedback are visually clear.
- [ ] No concept image is presented as an in-game result.

**Exit evidence:** playable build, side-by-side mobile/desktop screenshots, asset inventory and visual review checklist.

### Gate 2 — Functional vertical loop
- [ ] Player can open the settlement, select a building, inspect requirements and start a valid upgrade.
- [ ] Invalid upgrades are rejected server-side with a clear localized reason.
- [ ] Resources and timers are calculated from authoritative state.
- [ ] Completion changes the persisted building level and visible stage.
- [ ] Reload/reconnect does not duplicate rewards, reset timers or lose progress.
- [ ] Concurrent/replayed commands cannot spend resources or grant rewards twice.
- [ ] UI values match server/database state.

**Exit evidence:** automated domain/integration tests, browser walkthrough, persistence/reconnect test and transaction/race test.

### Gate 3 — Responsive platform quality
- [ ] Core loop works on a representative narrow mobile viewport and a wide desktop viewport.
- [ ] Touch and pointer interactions both work without gesture conflicts.
- [ ] No essential control is clipped, hidden behind safe areas or unreachable.
- [ ] Layout changes are intentional; mobile is not simply a shrunken desktop layout.
- [ ] Russian and English are complete for the accepted slice; no mixed-language labels remain.
- [ ] Loading, errors, empty states and network interruption are handled visibly and safely.

**Exit evidence:** screenshots and walkthrough recordings from both viewport classes, localization checks and responsive tests.

### Gate 4 — Performance and stability
Targets below are **provisional acceptance goals** and must be measured on named devices/build conditions. They are not statements about current performance.

| Metric | Initial target |
|---|---|
| Desktop/browser frame rate | 60 FPS target during normal settlement interaction |
| Supported mobile frame rate | 60 FPS target on agreed mid/high-tier devices; stable 30 FPS floor on the agreed lower-tier baseline |
| Frame pacing | No recurring long stalls during camera movement, selection or ordinary effects |
| Initial usable scene | Target ≤5 seconds on the agreed test network/device profile; report cold and warm loads separately |
| Memory | No unbounded growth during a 15-minute interaction/stress pass |
| Stability | No crash, unrecoverable scene failure or state corruption during the acceptance walkthrough |
| Effects | Quality scales down on constrained devices without hiding gameplay information |

- [ ] Test devices, OS/browser versions, network conditions and build commit are recorded.
- [ ] Measurements include average and percentile frame time, not only a peak FPS counter.
- [ ] Asset loading, texture memory, draw calls and expensive effects are profiled.
- [ ] Any target miss is documented with a measured cause and corrective plan.

**Exit evidence:** repeatable profiling report and a 15-minute stability run on the agreed device matrix.

### Gate 5 — Release readiness for the prototype
- [ ] Production build succeeds from a clean checkout.
- [ ] Required type, unit, integration and browser walkthrough tests pass.
- [ ] No open blocker or critical security issue affects the prototype path.
- [ ] Backup/restore and migration behavior are validated for the relevant environment.
- [ ] Logs and diagnostics are sufficient to investigate failed commands and client errors without exposing secrets.
- [ ] Known limitations are listed honestly.
- [ ] Product owner reviews the playable build and evidence before the milestone is marked accepted.

**Exit evidence:** CI run URL/commit, test summary, security and migration notes, device matrix, screenshots and owner sign-off.

---

## 9. Quality bar for future features

Every future feature must include, where relevant:
- product purpose and player-facing behavior;
- server-side rules and data model;
- client states and responsive UI;
- ru/en localization;
- failure, retry, timeout and reconnect behavior;
- security, permissions and abuse cases;
- persistence and migration strategy;
- automated tests and an end-to-end walkthrough;
- performance budget and observability;
- screenshots or other evidence from the integrated build.

A feature may be marked:
- **Designed** — specification reviewed, not implemented;
- **In progress** — implementation underway;
- **Implemented** — code exists, acceptance not yet proven;
- **Verified** — defined tests and walkthrough pass;
- **Accepted** — evidence reviewed and approved for the milestone.

Do not use “done”, “complete” or “production-ready” as synonyms for “code exists”.

---

## 10. Delivery sequence and change control

1. **Baseline and specification:** reconcile this document with the current code, decision log, master plan and status report.
2. **Technical proof:** validate the 3D/isometric scene approach, camera, asset pipeline and responsive client behavior with a small integrated prototype.
3. **Visual vertical slice:** finish the settlement scene and its art direction in the real client.
4. **Functional vertical slice:** connect building progression, economy, persistence and UI end to end.
5. **Cross-platform and performance gate:** test the same loop on agreed mobile and desktop/browser devices.
6. **Product-owner acceptance:** review the build and evidence; only then expand content and systems.
7. **System expansion:** add map, marches, commanders, combat, alliances, events and monetization in dependency-aware increments.

### Change control

Any proposal that changes the approved art direction, world presentation, asset-production model, platform scope, core architecture or acceptance targets must include:
- the reason for the change;
- benefits and trade-offs;
- implementation and migration cost;
- performance and maintenance implications;
- risks and rollback plan;
- a working comparison or prototype where feasible.

The product owner approves material changes before implementation.

### Current authorization boundary

**Authorized now:** document the approved direction, reconcile project documentation, maintain the baseline and prepare a bounded vertical-prototype plan.

**Not authorized by this document:** mass refactoring, wholesale UI replacement, engine migration, destructive data/schema changes, broad asset replacement, or claiming the game already meets the targets above.

---

## 11. Definition of success

The first major milestone succeeds when a player can enter a visually convincing TDL settlement, understand its layout, interact with the Citadel and supporting buildings, complete a real server-authoritative upgrade/economy loop, and do so reliably on both a phone-sized and desktop-sized viewport.

It must be a real integrated game build with measurable performance and test evidence. A beautiful still image, disconnected 3D demo, static UI mockup or passing CI alone is not sufficient.

**The guiding rule: prove quality in a small complete piece, then scale that quality across the game.**
