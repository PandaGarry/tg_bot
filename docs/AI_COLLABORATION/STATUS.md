# TDL — текущее состояние совместной разработки

> Снимок на 12.11.2026. Факты проверены по GitHub. После каждого merge обновлять main SHA, PR/CI и handoff.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` | `3e77cd2a45cb50763b96b77fa258a75bfa2b7472` |
| Документационный bootstrap | [PR #11](https://github.com/PandaGarry/tg_bot/pull/11) — MERGED |
| Рабочая ветка реализации | `arena/8885a9e3-tg-bot` |
| HEAD PR #9 после синхронизации main | `1cf39a6fdebcde60f01b02555ba03dd1efabb1e7` |
| PR #9 | [Открыт, не слит](https://github.com/PandaGarry/tg_bot/pull/9), 427 файлов, 700 commits; большой накопленный diff требует полного review |
| Последний завершённый CI | [run #416](https://github.com/PandaGarry/tg_bot/actions/runs/43219202084), PASS на HEAD `4dba3d1` |
| Последний видимый CI PR #9 | [run #420](https://github.com/PandaGarry/tg_bot/actions/runs/43219922568), IN_PROGRESS на предыдущем HEAD `fb4ecae`; новый merge commit `1cf39a6` ожидает собственного CI |
| CI в main | Workflow `.github/workflows/ci.yml` пока не интегрирован в main; он находится в PR #9. После merge PR #9 проверить первый push workflow на main |

## Утверждённая продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Оригинальные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Полная спецификация: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`.

## Что важно не перепутать

- PR #11 перенёс продуктовую спецификацию, оперативный план и multi-agent протокол в `main`. Все основные документы доступны другим агентам с основной ветки.
- 3D — утверждённая цель, но не выбранный движок и не разрешение на массовую миграцию.
- Текущая рабочая реализация клиента остаётся PixiJS/React; production 3D-прототип не создан и не принят.
- Run #416 PASS относится к SHA `4dba3d1`, а не к последующим commits. Run #420 проверяет предыдущий HEAD PR #9, не новый merge commit.
- Нельзя заявлять, что весь интерфейс/каталог зданий заменён, мобильная производительность подтверждена или production deployment проверен.

## Очередь и блокеры

1. TDL-PIPE-001 — VERIFIED: единый multi-agent протокол и продуктовая спецификация доступны в main; ссылки проверены, PR #11 слит.
2. TDL-ENV-001 — READY: Arena.ai проверяет browser/Node/PostgreSQL/Godot environment без изменения проекта.
3. TDL-3D-001 — READY: Cloud готовит независимое сравнение 3D-технологий; handoff: `docs/AI_COLLABORATION/handoffs/TDL-3D-001.md`.
4. TDL-AUD-001 — BLOCKED до принятия PR #9: полный аудит актуальной базы после интеграции накопленного diff.

## Обновление статуса

После каждого merge записывать новый main SHA, PR/commit, CI run и точные проверенные результаты. Не переписывать историю: прошлые snapshots сохранять в журнале. Незлитую ветку не считать частью main.
