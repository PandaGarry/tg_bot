# TDL — текущее состояние совместной разработки

> Snapshot: 12.11.2026 после merge PR #17. Проверено по GitHub; перед каждым новым handoff сверять refs и Actions.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` после PR #18 | `9850fa54494f169effa2c696bac75a9c58b806d1` |
| Документационный PR #11 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/11), merge `3e77cd2` |
| Status/workflow PR #12 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/12), merge `7f70e17` |
| Основной кодовый PR #9 | [OPEN](https://github.com/PandaGarry/tg_bot/pull/9), 427 файлов |
| HEAD PR #9 | `815d663e1b81e2e378b63c7a03afb02a24de5a0f` |
| Base PR #9 | совпадает с main: `9850fa54494f169effa2c696bac75a9c58b806d1` |
| Mergeability PR #9 | GitHub сообщает `mergeable=true`; это не заменяет code review |
| CI run #434 | [QUEUED](https://github.com/PandaGarry/tg_bot/actions/runs/43222527212) на точном HEAD PR #9 `815d663` |
| Последний завершённый PASS PR #9 | [run #429](https://github.com/PandaGarry/tg_bot/actions/runs/43220837032) на старом HEAD `6d87eea`; не подтверждает новый HEAD `815d663` |

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

- В `main` есть экспериментальная 3D-сцена на React Three Fiber + Three.js и отдельный `apps/court3d`; они не являются принятым production vertical slice.
- PR #9 удаляет эту сцену и Three.js зависимости, заменяя её PixiJS. Это нужно разрешить до merge с учётом решения владельца от 12.11 о full 3D.
- PR #9 не слит; CI run #434 на его новом HEAD ожидается.
- Нет доказательства законченного premium 3D vertical slice, полного каталога зданий, физических mobile tests или production deployment.

## Следующие действия

1. **ChatGPT — TDL-3D-001:** сравнить текущую R3F/Three.js сцену main с PixiJS rewrite PR #9, Babylon.js и Godot Web; подготовить benchmark и рекомендацию.
2. **Arena.ai — TDL-ENV-001:** выполнить environment check и runtime screenshots без изменения проекта.
3. **ChatGPT — TDL-VIS-001:** подготовить visual bible и критерии визуальной приёмки; Arena проверит их на runtime после появления прототипа.
4. **PR #9:** CI run #434 ожидается на точном HEAD `815d663`; до merge нужен полный review 427-файлового diff и решение по удалению существующей 3D-сцены.
5. После технологического и визуального gate — изолированный vertical prototype.

## Правило доказательств

Каждый статус «запущено», «проверено», «готово» сопровождается SHA, командами, результатами и реальными артефактами. Непроверенное обозначать прямо. Исторические snapshots не переписывать.


---

## Addendum — совместная ветка и TDL-ARCH-003 (12.11.2026)

Это дополнение актуализирует процесс и не переписывает исторический snapshot выше.

- **Рабочее соглашение:** ChatGPT и Arena.ai работают последовательно в одной назначенной GitHub-ветке. Локальные песочницы могут быть раздельными; GitHub — общая память, handoff, очередь и журнал изменений. Владелец может пересылать сообщения, но не обязан составлять технические задания и координировать исполнителей.
- **Общая ветка текущего технического этапа:** `refactor/tdl-court-grid-input-impl`.
- **Последний зафиксированный handoff/protocol HEAD:** `a0cb732e8a7d0a96d4c216e27fec77177c2d5e80`.
- **PR #28:** открыт, draft, не слит. На последней проверке GitHub сообщил `mergeable=false`; перед дальнейшими изменениями нужно выяснить состояние base/head и возможный конфликт, не делать force-push.
- **PR #28 evidence gap:** smoke report ссылается на tested SHA PR #27, а не на текущий интегрированный HEAD PR #28. Также зафиксированы WebGL Context Lost и Vite HMR WebSocket errors. Это не закрытые дефекты.
- **Следующая задача:** `docs/AI_COLLABORATION/handoffs/TDL-ARCH-003.md` — повторная runtime-валидация exact HEAD, production preview, классификация WebGL context loss, команды и exit codes, новые screenshots/logs. Arena и ChatGPT используют одну ветку; изменения выполняются последовательно.
- **Никакой PR не сливать** до проверки evidence, code review и устранения/объяснения mergeability status.
