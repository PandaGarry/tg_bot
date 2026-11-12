# TDL — текущее состояние совместной разработки

> Обновлено: 12.11.2026. Текущие факты сверены с GitHub. Сверяйте HEAD и Actions перед каждым новым handoff.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD main | `3e77cd2a45cb50763b96b77fa258a75bfa2b7472` |
| Документационный PR #11 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/11), merge commit `3e77cd2`, 16 файлов |
| Основной кодовый PR #9 | [OPEN](https://github.com/PandaGarry/tg_bot/pull/9), 443 файла, требует независимого review |
| HEAD PR #9 | `fb4ecae64bb54ba0a854c74134f4511405edbb76` |
| CI run #420 | [IN_PROGRESS](https://github.com/PandaGarry/tg_bot/actions/runs/43219922568) на HEAD `fb4ecae`; запуск начат до merge PR #11 и использовал прежнюю base SHA |
| Последний ранее завершённый CI | [run #416 PASS](https://github.com/PandaGarry/tg_bot/actions/runs/43219202084) на HEAD `4dba3d1`; не подтверждает текущий HEAD |

После merge PR #11 проверить, что GitHub Actions запустил CI на PR #9 с новой базой main. Не считать run #420 доказательством проверки merge-base после интеграции PR #11.

## Утверждённая продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Собственные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Основная спецификация: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`.
Оперативный план: `PROJECT_MASTER.md`.

## Что реально интегрировано

- Общая продуктовая спецификация, оперативный план, протокол Cloud/Arena.ai/ChatGPT, очередь и handoff-файлы теперь находятся в `main` после PR #11.
- Корневой `AGENTS.md` содержит актуальный блок правил; исторические инструкции ниже него нужно читать с учётом этого приоритета.
- PR #9 с накопленным кодовым diff не слит. Его изменения нельзя считать интегрированными.
- 3D runtime не выбран и не создан в production-клиенте. Текущая реализация остаётся PixiJS/React.
- Полный визуальный рефакторинг, каталог зданий, реальная мобильная производительность и production deployment не подтверждены.

## Активные handoff

- Cloud: `docs/AI_COLLABORATION/handoffs/TDL-3D-001.md`.
- Arena.ai: `docs/AI_COLLABORATION/handoffs/TDL-ENV-001.md`.
- Очередь: `docs/AI_COLLABORATION/QUEUE.md`.

## Правило обновления

После каждого принятого PR записывать merge SHA, актуальные PR HEAD, CI run и результаты фактических проверок. Не переписывать историю прошлых snapshots. Сначала принимать независимый малый PR, затем проверять крупные накопленные изменения.
