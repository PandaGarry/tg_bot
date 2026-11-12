# Очередь задач TDL

 > Обновлено: 12.11.2026 после TDL-ENV-001 и подготовки Visual Bible v1.0. Основной состав: ChatGPT + Arena.ai.

## Активная очередь

| ID | Статус | Задача | Владелец | Результат | Блокирует |
|---|---|---|---|---|---|
| TDL-PIPE-001 | MERGED | Общая продуктовая документация и протокол совместной работы | ChatGPT | PR #17–#20 интегрировали workflow и уточнение 3D baseline | — |
| TDL-ENV-001 | COMPLETED | Проверить browser/Node/PostgreSQL среду, запуск TDL и возможности Godot в Arena.ai | Arena.ai | Две базы запущены; smoke, desktop/mobile screenshots, версии, exit codes и ограничения задокументированы в handoff | — |
| TDL-3D-001 | IN PROGRESS | Сравнить web-native 3D и Godot Web; подготовить техническую рекомендацию и benchmark | ChatGPT | Есть фактические runtime результаты main и PR #9; требуется завершить сравнение архитектур и определить корректный benchmark | TDL-3D-002 |
| TDL-VIS-001 | REVIEW | Подготовить и согласовать Visual Bible для settlement vertical slice | ChatGPT; владелец — art approval | Создан `docs/design/TDL_VISUAL_BIBLE.md`: художественные принципы, палитра, материалы, Цитадель, 4 здания, terrain, HUD, asset pipeline и acceptance checklist. Требуется визуальное утверждение владельца | TDL-VIS-002 |
| TDL-PR9-001 | READY | Разобрать PR #9 на переносимые изменения и конфликтующий renderer rewrite | ChatGPT | 427 файлов: классифицировать UI/onboarding, тесты, gameplay, server, PixiJS renderer и удаления R3F | безопасная интеграция полезных изменений |
| TDL-AUD-001 | BLOCKED | Полный аудит систем и кода после решения по PR #9 | ChatGPT | baseline архитектуры, дефекты P0/P1, тестовая карта, приоритеты | безопасная реализация |

## Следующая очередь

- TDL-3D-002 — одинаковый vertical benchmark: terrain, Цитадель, четыре здания, foliage/props, свет, материалы, изометрическая камера, одинаковые assets и viewport. Запуск только после TDL-3D-001 и согласования владельцем.
- TDL-VIS-002 — production-quality block сцены: terrain, дороги, Цитадель и 4 здания; старт после утверждения Visual Bible и выбора benchmark runtime.
- TDL-UI-001 — полный аудит/рефакторинг HUD по принятому visual benchmark.
- TDL-GAME-001 — сквозная спецификация и проверка игрового цикла поселения.
- TDL-PERF-001 — воспроизводимый performance baseline на аппаратном GPU и реальных целевых устройствах.
- TDL-OPS-001 — production deployment, TLS/proxy, backup/RPO/RTO.

## Правила потока

1. READY означает, что задачу можно брать, а не то, что она уже выполнена. REVIEW означает, что результат подготовлен и ждёт проверки/утверждения.
2. Один ответственный — одна ветка — один handoff — один PR для кодовых изменений.
3. ChatGPT ведёт архитектуру, исследования, документацию и интеграцию; Arena.ai обеспечивает практические проверки в своей среде.
4. Зависимые задачи не стартуют до приёмки входных результатов.
5. Не сливать PR без review, CI на актуальном HEAD и критериев приёмки.
6. Не выдавать план, концепт или скриншот макета за работающий результат.
7. Не принимать renderer/engine migration без одинакового benchmark и отдельного решения владельца.
