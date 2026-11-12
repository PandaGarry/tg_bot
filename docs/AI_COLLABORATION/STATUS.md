# TDL — текущее состояние совместной разработки

> Снимок на 12.11.2026. Факты проверены через GitHub. Этот файл обновляется вместе с принятыми handoff/PR; точный актуальный SHA всегда сверять с открытым PR.

## GitHub baseline

| Показатель | Проверенное значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` до интеграции документационного PR | `8a46482422a2127db73597dea65b3f07464fd9dc` |
| Рабочая ветка реализации | `arena/8885a9e3-tg-bot` |
| HEAD PR #9 на момент снимка | `7223021c6c7bd78fc4edc643259390d7accaadc9` |
| PR #9 | [Открыт, не слит](https://github.com/PandaGarry/tg_bot/pull/9), 443 файла; большой накопленный diff, требуется полный review |
| Последний завершённый CI | [run #416](https://github.com/PandaGarry/tg_bot/actions/runs/43219202084), PASS на HEAD `4dba3d1` |
| CI текущего HEAD PR #9 | [run #419](https://github.com/PandaGarry/tg_bot/actions/runs/43219807826), IN_PROGRESS на HEAD `7223021` |
| Документационный PR #11 | [Открыт](https://github.com/PandaGarry/tg_bot/pull/11), 16 файлов; только документы/инструкции, без игрового кода |
| CI в main до PR #11 | Workflow ещё не обнаружен в `.github/workflows/ci.yml` на main; PR #11 — документационный bootstrap, после интеграции необходимо отдельно проверить запуск workflow на main |

## Утверждённая продуктовая цель

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Собственные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Полная спецификация: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`.

## Что важно не перепутать

- 3D — утверждённое продуктовое направление, но **не** выбранный движок и **не** разрешение на массовую миграцию.
- Текущая рабочая реализация клиента остаётся PixiJS/React; production 3D-прототип не создан и не принят.
- Нельзя заявлять, что весь интерфейс/каталог зданий заменён, мобильная производительность подтверждена или production deployment проверен.
- Run #416 PASS относится к SHA `4dba3d1`, а не к последующим commits. Run #419 проверяет текущую на момент снимка ветку PR #9.
- PR #11 создан как отдельный небольшой путь переноса общей продуктовой спецификации и multi-agent протокола в `main`; PR #9 остаётся отдельным большим PR с кодом.

## Очередь и блокеры

1. TDL-PIPE-001 — REVIEW: синхронизация документов и проверка ссылок; handoff: `docs/AI_COLLABORATION/handoffs/TDL-PIPE-001.md`.
2. TDL-ENV-001 — READY: Arena.ai проверяет browser/Node/PostgreSQL/Godot environment без изменений проекта.
3. TDL-3D-001 — READY: Cloud готовит независимое сравнение 3D-технологий; handoff: `docs/AI_COLLABORATION/handoffs/TDL-3D-001.md`.
4. TDL-AUD-001 — BLOCKED до интеграции PR #9: полный аудит актуальной базы после merge.

## Обновление статуса

После каждого merge записывать новый main SHA, PR/commit, CI run и точные проверенные результаты. Не переписывать историю: прошлые snapshots сохранять в журнале. Не считать незлитую ветку частью main.
