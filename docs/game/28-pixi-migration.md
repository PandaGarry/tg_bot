# Миграция на PixiJS: план и статус (28)

Решение заказчика 08.10.2026: 3D-двор (three + React-Three-Fiber) — шлак, вырезать.
Фронтенд — 2D-спрайт-сцена на **PixiJS 8** (MIT) + HUD на React + Tailwind
(визуальный дизайн UI — проектируем с заказчиком, см. ниже) + протокол `@tdl/protocol`
без изменений. Основа разбора — [27-frontend-os-research.md](27-frontend-os-research.md).

## Общие принципы (читать перед каждым этапом)

1. **Сервер, БД, `@tdl/protocol` — неприкосновенны.** Любая правка в них — только с
   явного разрешения заказчика.
2. **Pixi и React не смешиваются.** Код в `src/game/` не импортирует React и не использует
   хуки. Код HUD (`src/ui/` + `packages/themes/mitchell`) не импортирует Pixi.
3. **Связь слоёв — только через `src/game/bridge.ts`** (EventTarget). Никаких прямых вызовов
   методов между слоями.
4. **Ассеты — только через `PIXI.Assets`.** Не грузить `<img>` в React под сцену, не
   создавать `new Image()` в `game/`.
5. **Каждый этап завершается проверкой:** `pnpm typecheck && pnpm test && pnpm check &&
   pnpm build` зелёные + критерий приёмки этапа выполнен. Пока критерий не выполнен —
   следующий этап не начинается.
6. **Дисциплина этапов:** каждый этап отмечается в §Статус как
   `сделано → проверено → ждёт одобрения`, заказчик тестирует в Replit
   (`.replit` → `bash tools/replit-dev.sh`, превью на порту 3000) и ставит `одобрено`.
   Коммиты — по этапам, на ветке сессии `arena/99bce5fa-tg-bot`, сообщения по-русски.
   В `main` — только после полной проверки всех этапов.

## Отличия от ИИ-черновика плана (адаптация под реальное репо)

| В черновике | Как будет у нас | Почему |
|---|---|---|
| Ветка `arena/pixi-court` | `arena/99bce5fa-tg-bot` (ветка этой сессии) | Сессия закреплена за одной веткой; PR в main — от неё |
| Сетка 20×20 | **14×14**, размер приходит с сервера (`view.modules.court.grid.size`) | Решено заказчиком (круг 7, [23](23-court-scene.md) §162); сервер — источник правды, сцена data-driven |
| `TILE_W=64, TILE_H=32` (2:1) | **71.4×41.4 мира (≈1.72:1)** — диметрия, камера ≈35° | Производственный стандарт, зафиксирован в [23](23-court-scene.md) и прототипе `ui/court/index.html` |
| Новые HUD-компоненты (ResourceBar, ProfileCard, ActionBar, Compass, Toast) | **Не пишем вслепую** — UI проектируем с заказчиком по принятому процессу (разбор → скелет → варианты → выбор), как делали сцены | У заказчика был экспериментальный HUD (ветка `arena/6908a31b-tg-bot`), но он **отклонён** решением 08.10.2026 — ветка не является основой. Опорные материалы: [21-rok-reference.md](21-rok-reference.md), hud-круги 3–6 ([ui/hud/main-screen.html](ui/hud/main-screen.html)), `hud.css` — текущий единый источник правды |
| `src/hud/` | `src/ui/` + `packages/themes/mitchell` | Текущая структура клиента; перенос в новую папку — лишний шум |
| `packages/tdl-protocol` | `packages/protocol` (`@tdl/protocol`) | Реальное имя пакета |
| `howler` в фазе 4 | Звук — отдельная опциональная задача, не блокирует | Не критичный путь; добавится, когда сцена примет |
| `index.html: <div id="pixi-root"> + <div id="hud-root">` | Берём как есть | Полноэкранный canvas под HUD, pointer-events разведены |

## Целевая структура клиента

```
apps/client/
├── index.html               # <div id="pixi-root"> (canvas) + <div id="hud-root"> (React)
└── src/
    ├── main.tsx             # монтирует React в #hud-root; game/ создаёт сцену в #pixi-root
    ├── game/                # PixiJS. НЕ импортирует React.
    │   ├── core/
    │   │   ├── application.ts   # GameApp: init(container)/destroy(), singleton gameApp
    │   │   ├── resize.ts        # window.resize / orientationchange → renderer.resize()
    │   │   ├── ticker.ts        # app.ticker.add с дельта-временем, отписка
    │   │   └── assets.ts        # обёртка PIXI.Assets, кэш атласов
    │   ├── court/
    │   │   ├── courtScene.ts    # сцена двора: синхронизация зданий с state
    │   │   ├── isometric.ts     # worldToScreen / screenToWorld / getDepth (1.72:1) + тесты
    │   │   ├── tileMap.ts       # 14×14 диметрическая сетка (спрайт-тайлы/графика)
    │   │   ├── building.ts      # здание-контейнер: спрайт, глубина, tap
    │   │   ├── camera.ts        # пан/зум, границы, демпфирование (как в прототипе)
    │   │   ├── input.ts         # drag vs tap (<200ms), wheel/щипок
    │   │   └── ghost.ts         # призрак в стройке (зелёный/красный след)
    │   ├── world/             # карта мира — ПОЗЖЕ, после приёмки фазы 4
    │   └── bridge.ts          # ЕДИНСТВЕННАЯ связь Pixi ↔ React (EventTarget)
    ├── ui/                    # React + Tailwind: World, Hud, панели (дизайн — с заказчиком)
    ├── shell/                 # хроника, первый запуск, формы (как есть)
    ├── i18n/                  # ru/en (как есть; i18n-чек проходит при каждом этапе)
    ├── net.ts                 # транспорт @tdl/protocol (WS) — остаётся, в фазе 2
    │                          #   события сервера пробрасываются в bridge
    ├── store.ts               # состояние клиента (как есть)
    └── styles.css             # глобальные стили: layout #pixi-root/#hud-root + hud.css
```

События bridge (фазы 1–2):

- `tile:click → { x, z }`
- `building:click → { id, type }`
- `camera:moved → { x, y, zoom }`
- `state:update → { court: … }` (из net: серверный view/патч)
- `hud:action → { action, payload }` (кнопки HUD → net → сервер)

Убираем из клиента: `three`, `@react-three/fiber`, `@types/three`; `apps/court3d/`;
`tools/shots/court3d.ts` + скрипт `shots:court3d`; `src/court/CourtScene.tsx` (1926 строк
R3F), `src/three-jsx.d.ts`. Оставляем: `tools/shots/*` (boot-shot, walkthrough — снимают
основной клиент), HUD-хром, прототип `ui/court/index.html` (референс сцены).

## Этапы

### Этап 0. Подготовка — удаление 3D, каркас

- [x] Ветка сессии `arena/99bce5fa-tg-bot`; взяты из ветки заказчика `arena/6908a31b-tg-bot`
      только `.replit`, `replit.md`, `tools/replit-dev.sh` (тестирование в Replit).
      HUD-эксперимент (тема Mitchell) оттуда **не переносится** — решение заказчика 08.10.2026.
- [x] `AGENTS.md` в корне (правила слоёв, язык — русский, чекпоинты).
- [x] `git rm -r apps/court3d`; убраны `tools/shots/court3d.ts` и скрипт `shots:court3d`;
      снимки основного клиента пишутся в `docs/game/ui/client/`.
- [x] Клиент: убраны `three`, `@react-three/fiber`, `@types/three`; добавлен `pixi.js@^8`.
- [x] Удалены `src/court/CourtScene.tsx`, `src/three-jsx.d.ts`; маршрут «Двор» —
      2D-заглушка (диметрический контур сетки 1.72:1 по размеру с сервера) до этапа 2.
- [x] `index.html`: `#pixi-root` + `#hud-root`; `main.tsx` монтирует React в `#hud-root`.
- [x] `styles.css`: слой сцены z-0, HUD z-10 с `pointer-events: none` (клики проходят в сцену).
- [x] Каркас папок `src/game/{core,court,world}` + `src/shared`.
Критерий приёмки:

- [x] `pnpm install`, `pnpm typecheck` (18/18), `pnpm test` (183/183), `pnpm check`,
      `pnpm build` — зелёные (08.10.2026).
- [x] В `apps/client/src` нет ни одного импорта `three` / `@react-three/*`.
- [ ] В Replit: вход → лорд → маршрут «Двор» показывает 2D-заглушку, существующий HUD живой
      (тест заказчика).

### Этап 1. Ядро Pixi

- [x] `game/core/application.ts` — GameApp.init(container)/destroy(), singleton.
      Решение: `preference: "webgl"` (2D-спрайт-сцене WebGPU ничего не даёт, а WebGL
      предсказуемее в webview/Replit), `resolution = min(dpr, 2)`.
- [x] `game/core/resize.ts` (orientationchange-синхронизация для iOS; обычный ресайз
      держит resizeTo), `game/core/ticker.ts` (deltaTime, отписка), `game/core/assets.ts`
      ( PIXI.Assets, кэш текстур; атласы добавим, когда появятся).
- [x] `game/bridge.ts` — класс Bridge (обычная карта слушателей, без зависимостей),
      события: tile:click, building:click, camera:moved, state:update, hud:action.
- [x] `main.tsx`: сначала `gameApp.init(#pixi-root)` (не блокирует рендер),
      потом React в `#hud-root`.
- [x] Смоук-приёмка: `tools/shots/pixi-smoke.ts` (canvas в #pixi-root, «[Pixi] Initialized»
      в консоли, HUD смонтирован, реальные ошибки страницы) — кадр
      `docs/game/ui/client/pixi-stage1.jpg`.
- [x] Попутно: фикс net.ts — `close()` по WS-ошибке до open() кидал uncaught-ошибку
      «WebSocket closed without opened» (срезало смоук-тест).

Критерий приёмки:

- [x] Экран: тёмный canvas на весь вьюпорт (1376×768 в смоке); в консоли `[Pixi] Initialized`.
- [x] Ресайз окна/поворот — canvas следует (resizeTo + orientationchange-обёртка).
- [x] HUD React поверх, клики по кнопкам HUD работают (проверено смоком на живых экранах).
- [ ] Клики «сквозь» пустые места HUD доходят до canvas (pointer-events настроены;
      фактически подтвердится в этапе 2, когда у сцены появится ввод).

### Этап 2. Двор (Pixi)

- [ ] `isometric.ts`: W×H = 71.4×41.4 (1.72:1), worldToScreen/screenToWorld (туда-обратно),
      getDepth = x + z; unit-тесты.
- [ ] `tileMap.ts`: сетка `grid.size`×`grid.size` (с сервера), тайл-спрайты или графика,
      `sortableChildren`, tap по тайлу → bridge.
- [ ] `building.ts`: здание по типу (пока placeholder-спрайт — потом реальные PNG из
      конвейера `pnpm icons`), глубина = x + z + 0.5, tap → bridge, update(state).
- [ ] `camera.ts`: пан (drag), зум 0.85…2.2 (wheel/щипок), границы площадки, демпфирование.
- [ ] `input.ts`: drag vs tap (<200ms), не путать.
- [ ] `courtScene.ts`: init/update/destroy; синхронизация зданий
      (добавить/обновить/удалить) по `state:update`.
- [ ] `net.ts`: серверные события двора → `bridge.emit('state:update')`;
      `hud:action` → команды серверу (court.place/move/remove/road — как сейчас).
- [ ] HUD: «Строить» (QuickActions) → `placing` → призрак в сцене → tap → подтверждение
      в HUD (существующий сценарий World.tsx).

Критерий приёмки:

- [ ] Двор 14×14 виден; здания на своих клетках из серверного вида.
- [ ] Тап по тайлу/зданию — события в консоли; drag — панорама; wheel/щипок — зум.
- [ ] Стройка и перестановка работают по серверным командам (place/move/remove/road).
- [ ] 60 FPS на десктопе, ≥30 на мобильном (проверка на телефоне — заказчик в Replit).
- [ ] Тесты isometric/bridge/camera — зелёные.

### Этап 2.5. Дизайн UI (совместно с заказчиком)

- [ ] Дизайн-документ по принятому процессу: разбор (RoK-референс [21](21-rok-reference.md),
      реальные экраны [17](17-ui-real-screens.md)) → скелет зон (топбар, панель лорда,
      навигация, стройка, очереди, баннеры) → 3–5 вариантов на CSS (макеты, как
      `ui/hud/main-screen.html`) → выбор заказчика.
- [ ] Схемы экранов: двор (idle), двор (стройка), карта, профиль/очереди.
- [ ] Палитра и токены для canvas/спрайтов (связка Pixi-сцены и HUD в одном стиле).
- [ ] Реализация выбранного варианта в `src/ui/` + `hud.css`.

Начинается после «одобрено» этапа 2 (сцена живая, есть что оформлять) — или раньше,
если заказчик захочет зафиксировать каркас заранее.

### Этап 3. Ночь, стадии, сезонность (по [22](22-seasons-daytime-buildings.md))

- [ ] Слои: земля день/ночь; ночь = свет-слой поверх дневного (blend/filter).
- [ ] Стадии зданий (5) и два сезонных набора спрайтов; выбор набора по времени мира
      (serverNow уже есть в HUD).
- [ ] Периметр двора фиксирован (частокол) — спрайт по контуру.

Критерий приёмки:

- [ ] День/ночь переключаются без моргания; здания меняют спрайт по стадии/сезону.
- [ ] Снимки `pnpm shots` (день/ночь) не хуже прототипа `ui/court`.

### Этап 4. Полировка

- [ ] Анимации появления/улучшения (ticker: alpha/scale).
- [ ] Частицы (pixi-particle-emitter) — дым Ратуши, эффекты улучшений.
- [ ] `tileMap.cacheAsTexture()` для статичной сетки; слои: фон → тайлы → здания → эффекты.
- [ ] Unit-тесты: bridge, input, camera.
- [ ] (Опционально, отдельно) звук: Howler — клики, постройка, уведомления.

Критерий приёмки:

- [ ] Полный цикл: «Построить» → выбор → прицел → тап → здание появилось, очередь в HUD.
- [ ] 60/30 FPS стабильно; `pnpm build` зелёный; снимки `pnpm shots` — приёмка заказчиком.

### Этап 5. Карта мира (ПОЗЖЕ, отдельное решение)

- [ ] `game/world/`: карта с чанками, подгрузка по камере, границы мира.
- [ ] HUD: переключатель «Двор ↔ Карта» (маршрут «Карта» уже есть в NAV).
- [ ] Состояние мира — через `@tdl/protocol` (viewport-сообщение уже поддерживается net.ts).

Начинается только после полного «одобрено» этапа 4.

## Статус

| Этап | Сделано | Проверено | Одобрено заказчиком |
|---|---|---|---|
| 0. Подготовка (3D → 2D, каркас) | 08.10.2026 | 08.10.2026 | — (тест в Replit) |
| 0.1. Откат HUD-эксперимента (решение заказчика) | 08.10.2026 | 08.10.2026 | — (тот же тест) |
| 1. Ядро Pixi | — | — | — |
| 2.5. Дизайн UI (совместно) | — | — | — |
| 2. Двор (Pixi) | — | — | — |
| 3. Ночь/стадии/сезоны | — | — | — |
| 4. Полировка | — | — | — |
| 5. Карта мира | — | — | — (только после 4) |
