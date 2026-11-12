# TDL — текущее состояние совместной разработки

> Snapshot: 12.11.2026. Этот файл фиксирует проверенную точку состояния; перед каждым новым handoff сверяйте текущие refs и GitHub Actions.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| Main baseline перед этим status-only PR | `7f70e17539ed521d20db15fd33f6ab4d83a69b8f` (PR #12 squash merge) |
| Документационный PR #11 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/11), merge `3e77cd2` |
| Status/workflow PR #12 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/12), merge `7f70e17` |
| Основной кодовый PR #9 | [OPEN](https://github.com/PandaGarry/tg_bot/pull/9), 427 файлов после пересечения с документами main |
| HEAD PR #9 | `1cf39a6fdebcde60f01b02555ba03dd1efabb1e7` |
| Base SHA PR #9 на момент проверки | `3e77cd2a45cb50763b96b77fa258a75bfa2b7472`; отстаёт от main на один commit (PR #12) |
| CI run #421 | [IN_PROGRESS](https://github.com/PandaGarry/tg_bot/actions/runs/43220192351) на HEAD `1cf39a6`, base `3e77cd2`; один job typecheck/tests/checks/build выполняется |
| Последний завершённый PASS | [run #416](https://github.com/PandaGarry/tg_bot/actions/runs/43219202084) на старом HEAD `4dba3d1`; не подтверждает текущий PR |

## Продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Собственные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Источники: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`, `docs/DECISIONS.md`, `PROJECT_MASTER.md`.

## Интегрировано в main

- PR #11: продуктовая спецификация, общая точка входа, базовый multi-agent protocol и стартовые handoff.
- PR #12: актуализация очереди, operational status и активация протокола по поручению владельца.
- ChatGPT, Cloud и Arena.ai имеют отдельные роли и задания; GitHub — общий handoff-канал и source of truth.

## Не считать реализованным

- Целевой 3D runtime не выбран и не создан в production-клиенте; текущая клиентская база — PixiJS/React.
- PR #9 не слит; его код не является интегрированной частью main.
- Нет доказательства законченного 3D vertical slice, полного каталога зданий, физических mobile tests или production deployment.
- Run #421 ещё не завершён, а его base SHA предшествует PR #12.

## Следующие действия

1. PR #9: обновить ветку на актуальный main, дождаться CI на новой базе и провести независимый review 427-файлового diff. Не сливать автоматически.
2. Cloud: выполнить `TDL-3D-001` — независимую матрицу web 3D/Godot Web вариантов.
3. Arena.ai: выполнить `TDL-ENV-001` — environment check и runtime screenshots без изменения проекта.
4. ChatGPT: проверить отчёты, подготовить одинаковый benchmark и следующий handoff.
5. После технологического и визуального gate — изолированный vertical prototype.

## Правило доказательств

Каждый статус «запущено», «проверено», «готово» сопровождается SHA, командами, результатами и реальными артефактами. Непроверенное обозначать прямо. Исторические snapshots не переписывать.
