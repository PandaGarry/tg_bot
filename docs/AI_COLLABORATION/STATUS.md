# TDL — текущее состояние совместной разработки

> Snapshot: 12.11.2026 после merge PR #17. Проверено по GitHub; перед каждым новым handoff сверять refs и Actions.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` после PR #17 | `728e9592ad5d56e4c117ffcc5f92dbcff19acd55` |
| Документационный PR #11 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/11), merge `3e77cd2` |
| Status/workflow PR #12 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/12), merge `7f70e17` |
| Основной кодовый PR #9 | [OPEN](https://github.com/PandaGarry/tg_bot/pull/9), 427 файлов |
| HEAD PR #9 | `6d87eea206b7de7599dd9663529dec5419806bbb` |
| Base PR #9 | `b6e1614f43c43df217b315dffea8157353608628`; отстаёт от main на один документационный commit PR #17 |
| Mergeability PR #9 | GitHub сообщает `mergeable=true`; это не заменяет code review |
| CI run #429 | [SUCCESS](https://github.com/PandaGarry/tg_bot/actions/runs/43220837032) на точном HEAD PR #9 `6d87eea` |
| Последний более ранний PASS | run #416 на старом SHA; не нужен как подтверждение PR #9, так как run #429 проверил текущий HEAD |

## Продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Собственные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Источники: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`, `docs/DECISIONS.md`, `PROJECT_MASTER.md`.

## Интегрировано в main

- PR #11: продуктовая спецификация, общая точка входа и базовый multi-agent protocol.
- PR #12: очередь, handoff и активный процесс совместной работы.
- Основной производственный состав закреплён PR #17 как ChatGPT + Arena.ai. PR #17 слит в main commit `728e9592ad5d56e4c117ffcc5f92dbcff19acd55`. Внешние консультанты необязательны и не блокируют задачи.

## Не считать реализованным

- Целевой 3D runtime не выбран и не создан в production-клиенте; текущая клиентская база — PixiJS/React.
- PR #9 не слит; его код не является интегрированной частью main, хотя его текущий HEAD прошёл CI run #429.
- Нет доказательства законченного 3D vertical slice, полного каталога зданий, физических mobile tests или production deployment.

## Следующие действия

1. **ChatGPT — TDL-3D-001:** завершить анализ текущего кода PR #9 и сравнение web-native 3D/Godot Web; подготовить benchmark и рекомендацию. Эта задача теперь закреплена за ChatGPT в main.
2. **Arena.ai — TDL-ENV-001:** выполнить environment check и runtime screenshots без изменения проекта.
3. **ChatGPT — TDL-VIS-001:** подготовить visual bible и критерии визуальной приёмки; Arena проверит их на runtime после появления прототипа.
4. **PR #9:** синхронизировать ветку с main после PR #17, получить CI на точном новом HEAD и провести независимый review 427-файлового diff перед merge; run #429 прошёл на HEAD `6d87eea`, но сам по себе не является code review.
5. После технологического и визуального gate — изолированный vertical prototype.

## Правило доказательств

Каждый статус «запущено», «проверено», «готово» сопровождается SHA, командами, результатами и реальными артефактами. Непроверенное обозначать прямо. Исторические snapshots не переписывать.
