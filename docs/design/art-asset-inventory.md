# TDL Court Art Asset Inventory

> Decision: owner-approved unified original undead-fantasy art pack, 09.11.2026. Historical prototype sprites are temporary fallbacks only, not the final visual standard. See [DECISIONS.md](../DECISIONS.md), [Art Direction](art-direction.md), and [Court Scene](court-scene.md).

## 1. Production scope

- Complete building catalog and five visual stages per upgradeable building (levels 1–6, 7–12, 13–18, 19–24, 25–30).
- Terrain kit, paths/roads, courtyard boundaries and wall segments.
- Environment: trees, dead trees, stumps, rocks, ruins, fences, snowdrifts, banners, torches, props.
- Existing interactive decorations and resource objects.
- HUD resource icons, navigation/action icons, markers, status badges and modal illustrations.
- VFX: smoke, fire, embers, fog, weather and restrained undead corruption effects.
- Day/evening treatment, subject to an authoritative time-of-day contract; do not activate historical night assets from the device clock.

## 2. Building catalog — all 19 entries

| Building ID | Name | Footprint | Current runtime art | Production work |
|---|---|---:|---|---|
| citadel | Цитадель | 4×4 | Prototype fallback `a-01` | Hero asset; five stages; unique crown silhouette |
| wall | Стена | 3×3 | Missing | Modular straight/corner/gate/tower kit; five stages |
| warehouse | Склад | 3×3 | Prototype fallback `c-03` | Original five-stage storage art |
| infirmary | Лазарет | 3×3 | Prototype fallback `c-02` | Original five-stage healing art |
| academy | Академия | 3×3 | No mapping; legacy `c-01` (“Паутина”) is not semantically confirmed | Original five-stage research art |
| clan-hall | Зал клана | 3×3 | Missing | Five-stage clan hall |
| tavern | Таверна | 2×2 | Missing | Single-level tavern |
| watchtower | Надзорная вышка | 2×2 | Missing | Five-stage scout tower |
| forge | Кузница | 3×3 | Missing | Five-stage forge |
| trade-post | Торговый пост | 2×2 | Missing | Five-stage caravan/exchange post |
| barracks | Казарма | 3×3 | Prototype fallback `b-03` | Original five-stage barracks |
| range | Стрельбище | 3×3 | Missing | Five-stage ranged training building |
| stable | Конюшня | 3×3 | Missing | Five-stage cavalry stable |
| siege-yard | Осадный двор | 3×3 | Missing | Five-stage siege workshop |
| sawmill | Лесопилка | 2×2 | Prototype fallback `d-01` | Original five-stage sawmill |
| pen | Загон | 2×2 | Prototype fallback `b-02` | Original five-stage livestock pen |
| quarry | Каменоломня | 2×2 | Prototype fallback `a-03` | Original five-stage quarry |
| mine | Рудник | 2×2 | Missing | Five-stage ore mine |
| farm | Ферма | 2×2 | Prototype fallback `b-01` | Original five-stage farm |



**Coverage:** 8/19 buildings have a semantically confirmed temporary prototype sprite in runtime; 11/19 are explicitly listed in `BUILDING_ART_BACKLOG`. `academy` is deliberately unmapped until its original visual identity is defined. The automated test compares both sets with the authoritative content catalog, so a newly added building cannot silently disappear from the art plan.

## 3. Other asset groups

| Group | Current state | Required production assets |
|---|---|---|
| Terrain | Pixi Graphics geometry | base ground, grass/dirt/stone variants, edge/corner transitions, seasonal overlays |
| Roads | Pixi Graphics geometry | path tiles, junctions, gates and edge blends |
| Wall/perimeter | no production kit | straight, inner/outer corner, gate, tower, damaged/upgrade states |
| Decorations | simple vector fallback | lantern, bench, well, flag plus stump, rock, dead tree, fence, snowdrift |
| Resource icons | mixed SVG/PNG prototype | coherent material-rendered set for all six resources |
| HUD icons | ConceptIcon SVG fallback | original consistent icon family and state variants |
| Characters/animals | not production-ready | lord, workers, guards, livestock, undead silhouettes |
| VFX | not production-ready | chimney smoke, fire, sparks, fog, snow/rain, corruption accents |

## 4. Vertical slice — acceptance order

1. Terrain base tile plus edge/corner transitions, one dirt path and one stone path.
2. Citadel stages I and II, with fixed footprint, silhouette progression and a readable roof/entry at mobile scale.
3. Two contrasting buildings (sawmill and farm) at stages I and II.
4. Wall straight/corner/gate/tower kit at stages I and II.
5. Three props with matching material/light language.
6. Integrate the slice in Pixi; verify pivots, footprints, hitboxes, depth sorting and fallback.
7. Capture desktop, 390px and 320px screenshots; inspect at 25%, 50% and 100% scale.
8. Approve style and technical budgets before producing the remaining building catalog and stages.

## 5. Asset contract and acceptance

Every final asset needs a stable ID, source/license, stage/state, transparent source, logical dimensions, pivot/tip, patch width, footprint, depth-sort rule, hit area, fallback and atlas/compression metadata.

- [ ] Original source and rights/provenance recorded.
- [ ] Same orthographic camera, scale, light direction and material language across the pack.
- [ ] Five stage silhouettes preserve footprint and become richer upward.
- [ ] No visible seams, magenta fringe, cropped shadows or transparent-padding drift.
- [ ] Pivot and hitbox match the occupied cells and sprite silhouette.
- [ ] RU/EN HUD overlays remain legible.
- [x] Headless Chromium desktop/390/320 screenshots captured in CI #278 (artifact `tdl-live-game-screenshots`).
- [ ] Real iOS Safari / Android WebView acceptance and GPU performance measurements.
- [ ] Texture memory, draw calls, frame time and first-load cost measured on target devices.

## 6. Current technical status

- Prototype sprite source: `docs/game/ui/court/sprites/`.
- Runtime fallback copies: `apps/client/public/court/sprites/` (8 confirmed mappings; unconfirmed `c-01` copies removed).
- Shared mapping: `apps/client/src/game/court/spriteCatalog.ts`.
- Pixi loads only visible/selected mapped types; React build cards reuse the same fallback images without importing Pixi.
- Historical day/night pairs remain fallback material. Runtime currently uses day images only; evening treatment is blocked on the authoritative time contract and future light-mask implementation.
- The prototype sprites must be replaced by accepted original art before calling the game visually production-ready.


## 7. Live runtime evidence — CI #278

- Run: `https://github.com/PandaGarry/tg_bot/actions/runs/42578126038` — full CI PASS.
- Artifact: `tdl-live-game-screenshots` (14-day retention).
- `game-court-day.jpg`: initial server-backed court with Citadel.
- `game-court-build.jpg` and `game-court-military.jpg`: economy and military building panels; automated assertions check every card has a loaded prototype PNG or a non-empty SVG fallback.
- `game-court-decor.jpg`: decor panel; its cards are checked by the same artwork assertion.
- `game-court-buildings.jpg`: server-placed Citadel, Pen and Sawmill; two buildings placed with real `court.place` commands in disposable CI world.
- `game-court-portrait.jpg` and `game-court-narrow.jpg`: 390×844 and 320×690 responsive captures.
- This is runtime/prototype evidence, not art sign-off: the building PNGs are temporary historical fallbacks, terrain remains Pixi geometry, and physical-device/GPU acceptance remains open.
