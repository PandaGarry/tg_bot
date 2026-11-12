# TDL — текущее состояние совместной разработки

> Обновлено: 12.11.2026. Текущие факты сверены с GitHub. Сверяйте HEAD и Actions перед каждым новым handoff.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` | `7f70e17539ed521d20db15fd33f6ab4d83a69b8f` |
| Документационный PR #11 | [MERGED](https://github.com/PandaGarry/tg_bot/pull/11), merge commit `3e77cd2` |
| Основной кодовый PR #9 | [OPEN](https://github.com/PandaGarry/tg_bot/pull/9), 427 файлов, требует независимого review |
| HEAD PR #9 | `b3fea3af25c77e335fbd82a16f18cf1553a68b1a` |
| Синхронизация PR #9 с main | выполнена merge commit; ветка больше не отстаёт от main |
| CI run #425 | [QUEUED](https://github.com/PandaGarry/tg_bot/actions/runs/43220545446) на точном HEAD `b3fea3a` |
| Последний завершённый PASS | [run #416](https://github.com/PandaGarry/tg_bot/actions/runs/43219202084) на более раннем SHA `4dba3d1`; не подтверждает текущий HEAD |
| CI в main | Workflow `.github/workflows/ci.yml` пока находится в PR #9. После его merge проверить первый запуск workflow на main |

## Утверждённая продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Оригинальные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Основная спецификация: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`.
Оперативный план: `PROJECT_MASTER.md`.

## Что реально интегрировано

- PR #11 перенёс продуктовую спецификацию, оперативный план и multi-agent протокол в `main`.
- Дополнительный commit `7f70e17` обновил очередь, план и статус после интеграции документации.
- PR #9 синхронизирован с текущим main; он всё ещё содержит большой кодовый diff и не слит.
- 3D — утверждённая цель, но не выбранный движок и не разрешение на массовую миграцию.
- Текущая реализация клиента остаётся PixiJS/React; production 3D-прототип не создан и не принят.
- Не подтверждены законченная 3D сцена, полный каталог зданий, физические мобильные тесты и production deployment.
- Run #425 должен завершиться на текущем HEAD, прежде чем PR #9 можно будет рассматривать для merge.

## Очередь и блокеры

1. TDL-PIPE-001 — MERGED: единая продуктовая документация и протокол совместной работы доступны в main.
2. TDL-3D-001 — READY: Cloud сравнивает 3D варианты без изменений production-кода.
3. TDL-ENV-001 — READY: Arena.ai проверяет browser/Node/PostgreSQL/Godot environment без изменения проекта.
4. TDL-VIS-001 — READY: визуальный benchmark и asset checklist после технической оценки.
5. TDL-AUD-001 — BLOCKED до принятия PR #9: полный аудит актуальной интегрированной базы.

## Обновление статуса

После каждого merge записывать новый main SHA, PR/commit, CI run и точные проверенные результаты. Не переписывать историю: прошлые snapshots сохранять в журнале. Незлитую ветку не считать частью main.
