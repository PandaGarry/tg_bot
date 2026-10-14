# Очередь разбора архива

> Статус: **на обсуждении** · Обновлено: 11.10.2026

Правило: файл переносится по теме в актуальный документ, затем удаляется. Удалять можно только после переноса всего нужного. Запись о переносе — в коммите и в `DECISIONS.md`, если перенос содержит решения.

Файлы `docs/game/ui/` сюда не относятся и не трогаются.

## game/

| Файл | Куда переносим | Статус |
|---|---|---|
| `01-lore.md` | canon/lore.md | перенесено, удалено 11.10 |
| `02-tone.md` | canon/tone.md | перенесено, удалено 11.10 |
| `03-first-session.md` | перенесено, удалено 11.10 (`design/first-session.md`) |
| `04-systems.md` | перенесено, удалено 11.10 (`design/systems.md`; 11.10: пункт марша снят, слоты — Академия) |
| `05-architecture.md` | AGENTS.md и docs/README.md (архитектура уже описана) | ожидает сверки |
| `06-plan.md` | plan/roadmap.md (заменён 11.10) | перенесено, удалено 11.10 |
| `07-modules.md` | plan/roadmap.md, принципы модулей | ожидает разбора |
| `08-ops.md` | docs/ops.md (новый, эксплуатация) | ожидает разбора |
| `10-modules-kinds.md` | design/modules.md (виды модулей, единицы, расписание) | ожидает разбора |
| `11-calendar.md` | design/calendar.md | ожидает разбора |
| `12-worlds.md` | design/worlds.md (миры, серверы, фазы) | ожидает разбора |
| `13-genre-servers.md` | balance/competitors.md | ожидает разбора |
| `14-genre-core.md` | balance/competitors.md | ожидает разбора |
| `15-genre-deep.md` | balance/competitors.md (таблицы зданий 10 игр — сверка с buildings.md) | ожидает разбора |
| `16-money.md` | balance/economy.md (монетизация, удержание) | ожидает разбора |
| `17-ui.md` | §0–8, §10–11 → `design/ui-standards.md`; §2, §4, §5, §13–15 → `balance/competitors.md` §12–14; источники → §14; §9 (3D) не переносим (отменено 09.10) | перенесено, удалено 14.10 |
| `17-ui-real-screens.md` | balance/competitors.md §11 (источники и выводы; картинки не храним) | перенесено, удалено 14.10 |
| `18-ui-deep-dive.md` | §5–6 → `design/ui-standards.md` §6–7; §1–4 (поигровые детали) сведены в `balance/competitors.md` §14; полный текст — в истории git | перенесено, удалено 14.10 |
| `19-ui-research-tz.md` | принципы, компонентная ведомость, критерии greybox, открытые вопросы → `design/ui-standards.md` §8–9 и открыто; сравнительная таблица — в `balance/competitors.md` §14 (сводка), полный текст — в истории git | перенесено, удалено 14.10 |
| `20-ui-style-variants.md` | канон уже в `canon/tone.md`, `canon/world-basics.md`, `canon/lore.md`; стиль — `DECISIONS.md` (skin 03 «forge») | перенесено, удалено 14.10 |
| `21-rok-reference.md` | balance/competitors.md | ожидает разбора |
| `22-seasons-daytime-buildings.md` | предложения (пора, время суток, стадии, растущий двор) → `design/court-scene.md` §5–9; календарь → `design/calendar.md` (позже) | перенесено, удалено 14.10 |
| `23-court-scene.md` | `design/court-scene.md` (геометрия, камера, стройка) | перенесено, удалено 14.10 |
| `24-court-3d.md` | отменено (3D не используется, решение 09–10.10) — удалить | перенесено, удалено 11.10 |
| `25-court-layout.md` | схема и правила → `design/hud-court.md` §0б; таблица жанра → `balance/competitors.md` §10 | перенесено, удалено 14.10 |
| `27-frontend-os-research.md` | design/hud-court.md (исследование оболочки) | ожидает разбора |
| `28-pixi-migration.md` | AGENTS.md (правила Pixi) — проверить и удалить | перенесено, удалено 11.10 |
| `29-ui-refs-viking-rok.md` | balance/competitors.md и hud-court.md | ожидает разбора |
| `DECISIONS.md` | DECISIONS.md — все решения уже перенесены | перенесено, удалено 11.10 |
| `README.md (индекс)` | canon/world-basics.md — раздел «Уже решено» | перенесено, удалено 11.10 |

## balance/, design/, root/

| Файл | Куда переносим | Статус |
|---|---|---|
| `../archive/design/31-buildings-data-spec.md` | design/buildings.md (заменён 10.10) | перенесено, удалено 11.10 |
| `../archive/balance/09-numbers-3.md` | balance/* (разложен 10.10) | ожидает сверки |
| `../archive/balance/09-numbers-old.md` | — (старая версия, заменена 09-numbers-3) | перенесено, удалено 11.10 |
| `../archive/root/STATUS.md` | docs/STATUS.md (заменён 11.10) | перенесено, удалено 11.10 |
