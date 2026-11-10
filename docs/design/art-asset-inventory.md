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
| citadel | Цитадель | 4×4 | Original imperial SVG stage I (citadel-imperial-stage-01.svg) | Stages II–V; polish against in-scene screenshots; fallback retained for rollback |
| wall | Стена | 3×3 | Missing | Modular straight/corner/gate/tower kit; five stages |
| warehouse | Склад | 3×3 | Original imperial SVG stage I (`warehouse-imperial-stage-01.svg`) | Stages II–V; in-scene scale/pivot acceptance |
| infirmary | Лазарет | 3×3 | Prototype fallback `c-02` | Original five-stage healing art |
| academy | Академия | 3×3 | No mapping; legacy `c-01` (“Паутина”) is not semantically confirmed | Original five-stage research art |
| clan-hall | Зал клана | 3×3 | Missing | Five-stage clan hall |
| tavern | Таверна | 2×2 | Missing | Single-level tavern |
| watchtower | Надзорная вышка | 2×2 | Missing | Five-stage scout tower |
| forge | Кузница | 3×3 | Missing | Five-stage forge |
| trade-post | Торговый пост | 2×2 | Missing | Five-stage caravan/exchange post |
| barracks | Казарма | 3×3 | Original imperial SVG stage I (`barracks-imperial-stage-01.svg`) | Stages II–V; in-scene scale/pivot acceptance |
| range | Стрельбище | 3×3 | Missing | Five-stage ranged training building |
| stable | Конюшня | 3×3 | Missing | Five-stage cavalry stable |
| siege-yard | Осадный двор | 3×3 | Missing | Five-stage siege workshop |
| sawmill | Лесопилка | 2×2 | Prototype fallback `d-01` | Original five-stage sawmill |
| pen | Загон | 2×2 | Original imperial SVG stage I (`pen-imperial-stage-01.svg`) | Stages II–V; validate in-scene silhouette and livestock readability |
| quarry | Каменоломня | 2×2 | Prototype fallback `a-03` | Original five-stage quarry |
| mine | Рудник | 2×2 | Missing | Five-stage ore mine |
| farm | Ферма | 2×2 | Prototype fallback `b-01` | Original five-stage farm |



**Coverage:** 6/19 buildings have original production-direction assets in runtime (Citadel, Sawmill, Farm, Warehouse, Barracks and Pen stage I); 2/19 additional buildings retain semantically confirmed temporary prototype sprites (Quarry and Infirmary); 11/19 remain explicitly listed in `BUILDING_ART_BACKLOG`. `academy` is deliberately unmapped until its original visual identity is defined. The automated test compares both sets with the authoritative content catalog, so a newly added building cannot silently disappear from the art plan.

## 3. Other asset groups

| Group | Current state | Required production assets |
|---|---|---|
| Terrain | Imperial SVG ground tile is integrated through Pixi Graphics texture fill; edge/corner transitions remain geometry | grass/dirt/stone variants, edge/corner transitions, seasonal overlays |
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
- [x] Headless Chromium desktop/390/320 screenshots captured in CI #280 (artifact `tdl-live-game-screenshots`).
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


## 9. Imperial perimeter kit — stage I (09.11.2026)

Four original transparent SVG modules have been added as a first perimeter-art set:
- `wall-imperial-straight-stage-01.svg` — straight defensive segment.
- `wall-imperial-corner-stage-01.svg` — joined 90-degree corner.
- `wall-imperial-gate-stage-01.svg` — arched gate module.
- `wall-imperial-tower-stage-01.svg` — elevated watch/defense tower.

Shared metadata lives in `apps/client/src/game/court/wallModuleCatalog.ts`; URL and anchor contracts are covered by `apps/client/tests/wall-module-catalog.test.ts`. The set is intentionally catalogued separately from the building catalog because wall segments are modular perimeter pieces, not placeable economy buildings.

**Not yet runtime-integrated:** scene placement, corner variants, stage II–V, connection snapping, hit areas and desktop/mobile screenshot acceptance remain open. These SVGs are source assets and catalog groundwork, not a completed wall system.

## 8. First implementation — Empire of the Dead vertical slice (09.11.2026)

- [x] Approved visual direction C documented in art-direction.md and DECISIONS.md.
- [x] Original standalone SVG for Citadel stage I added at apps/client/public/court/sprites/citadel-imperial-stage-01.svg (512×512, transparent background, 4×4 footprint anchor, 286 px base patch, bottom pivot 256×500).
- [x] Sprite catalog supports explicit PNG/SVG extensions while preserving legacy PNG fallback URLs.
- [x] Pixi building loader resolves URLs through the shared catalog and continues to load through PIXI.Assets.
- [x] Regression test covers Citadel asset metadata/URL and legacy fallback compatibility.
- [ ] In-scene screenshot review at desktop, 390 px and 320 px.
- [x] Add and wire the first original imperial ground tile texture through the shared PIXI.Assets cache, retaining geometry fallback.
- [ ] Add road/edge/corner texture kit and wall modules.
- [ ] Produce Citadel stages II–V and the first two companion buildings.
- [ ] Physical-device texture memory/FPS acceptance.

**Scope note:** this is the first integrated original asset, not completion of the visual slice or a claim that the whole city has reached target fidelity. The first imperial ground tile is integrated asynchronously into cached Pixi chunks; geometry remains the fallback. Seam/UV appearance still requires live screenshot review.


## 10. Live review and second asset slice — CI #377 (09.11.2026)

- Full workflow run #377 (`42698911502`) on HEAD `e8df1f34565939dd846a7c5d7871dcf092dcfe35` — **PASS** across typecheck, PostgreSQL tests, package/check suite, production build, Chromium live-world walk, screenshots, PostgreSQL backup/restore, dependency audits and Drizzle snapshots.
- Captured artifact: `tdl-live-game-screenshots` (7 JPEGs: court day/build/buildings/decor/military/narrow/portrait). Visual review confirms the Citadel and terrain load in the live scene; current Citadel is readable but still too graphic/flat relative to the textured ground, while prototype companion buildings visibly clash in style.
- Added original transparent SVG stage-I assets for Sawmill and Farm and switched their runtime catalog mappings away from legacy prototype PNGs. Both preserve the 2×2 domain footprint and use a shared 512×448 canvas with a bottom anchor and 300 px base patch.
- This is a second asset slice, not a final art sign-off: both assets still require in-scene pivot/scale review and mobile captures; stages II–V and remaining buildings are open.


## 11. Second original building slice — 09.11.2026

- Added original transparent imperial SVG stage-I art for Warehouse and Barracks, each 512×512 with a shared 3×3 footprint base patch (348 px) and bottom pivot (256, 500).
- Warehouse uses stone plinth, reinforced timber storehouse, slate roof, ironwork and cargo details; Barracks uses a fortified hall, crenellations, weapon racks, burgundy standards and braziers.
- Runtime catalog now routes both types to SVG through PIXI.Assets; legacy art remains available in repository history for rollback.
- These are authored stage-I production-direction assets, not yet final art sign-off: validate rendered scale/pivot in the live world and compare material readability at mobile scale. Stages II–V remain open.


## 12. Расширение live walkthrough для Склада и Казармы — 10.11.2026

- tools/shots/walkthrough.ts расширен: сценарий ставит Склад и Казарму в свободные 3×3 зоны двора после повышения Цитадели; используется штатная панель, а не подмена состояния сцены. Казарма выбирается из военной вкладки.
- Сценарий также проверяет повышение Цитадели до уровня 2. В первом запуске CI #387 сервер действительно обновил townhallLevel и сформировал court.report.upgraded, однако тест упал на UI-ожидании; значит серверная часть команды подтверждена, но UI-приёмка нет.
- Повторный CI #388 не дошёл до Chromium из-за падения packages/host/tests/quarantine.test.ts:60; ожидалось quarantine, фактически получено core. Полный прогон и новые скриншоты отсутствуют.
- До успешного повторного прогона статус интеграции двух новых зданий в live-сцену — **ожидает проверки**. Наличие SVG в каталоге и успешная проверка metadata не доказывают корректную отрисовку размещённых зданий.
- После зелёного прогона обязательно просмотреть итоговые desktop/mobile screenshots и сверить silhouette, scale, pivot, footprint, depth sorting и контраст материалов. Никакого визуального sign-off по одному факту прохождения CI.


## 12. Walkthrough расширен — CI #397 (10.11.2026)

- Актуальный live-world workflow #397 (`42868604601`) на HEAD `a0fbb204` завершился **PASS**; все 18 основных шагов workflow, включая Chromium UI, screenshot capture и PostgreSQL backup/restore drill, успешны.
- Walkthrough теперь выполняет upgrade Цитадели и размещение Склада/Казармы через реальные UI-команды в disposable мире. Артефакт: `tdl-live-game-screenshots`, семь JPEG.
- Скриншоты подтверждают техническую загрузку объектов и HUD, но не качество финального арта. Видимая разница материалов/детализации между зданиями остаётся блокером визуальной приёмки; этот запуск не закрывает полный арт-пак.


## 13. Загон — оригинальный имперский stage I (10.11.2026)

- Добавлен `pen-imperial-stage-01.svg`: прозрачный оригинальный SVG 512×448 с основанием 2×2, опорным пятном 300 px и нижним pivot (256, 427).
- В композиции: каменный подиум, деревянные секции ограды, хозяйственный корпус, кормушка/сено и читаемые силуэты скота; материалы согласованы с палитрой имперского набора.
- Runtime mapping переведён с временного `b-02.png` на SVG через общий `PIXI.Assets` loader. Геометрия серверного footprint не менялась.
- Добавлена регрессия URL и метаданных спрайта.
- Это закрывает только замену одного прототипа на stage I. Нужны in-scene screenshots, проверка читаемости на мобильном масштабе и стадии II–V.
