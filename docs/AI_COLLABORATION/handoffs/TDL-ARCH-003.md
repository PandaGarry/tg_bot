# TDL-ARCH-003 — повторная runtime-валидация общей ветки

**Статус:** DONE — evidence accepted by ChatGPT review (12.11.2026)  
**Общая рабочая ветка:** `refactor/tdl-court-grid-input-impl`  
**База задания / HEAD после фиксации протокола:** `ca552b98089f196e15fbb97b81faac8c4d8a6019`  
**Связанный PR:** https://github.com/PandaGarry/tg_bot/pull/28  
**Владелец задачи:** Arena.ai — runtime QA; ChatGPT — технический руководитель, review и интеграция.

## Рабочее соглашение

ChatGPT и Arena.ai работают над этой задачей в одной GitHub-ветке `refactor/tdl-court-grid-input-impl`. Локальные песочницы могут быть раздельными, но GitHub-ветка и её история общие. Не создавать параллельную ветку для этой же задачи и не force-push.

Перед началом Arena должна проверить текущий HEAD. Если он отличается от указанного SHA, прочитать последние коммиты и продолжить с актуального HEAD, сохранив все изменения. ChatGPT также работает только с этой веткой и перед каждым коммитом сверяет HEAD. Работа строго последовательная: не редактировать одновременно одни и те же файлы.

## Цель

Подтвердить, что интегрированная реализация PR #28 действительно запускается и проходит smoke-проверки на точном текущем HEAD, а также разобраться с WebGL Context Lost и Vite HMR WebSocket errors, которые присутствуют в предыдущем отчёте.

## Обязательный контекст

Прочитать:
1. `AGENTS.md`
2. `docs/AI_COLLABORATION/README.md`
3. `docs/AI_COLLABORATION/STATUS.md`
4. `PROJECT_MASTER.md`
5. `docs/DECISIONS.md`
6. `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`
7. Этот handoff.
8. `evidence/TDL-ARCH-002/smoke-report.json` и связанные screenshots/console/health.

## Задание Arena.ai

### A. Синхронизация и provenance
- Checkout `refactor/tdl-court-grid-input-impl`, fetch latest, зафиксировать точный HEAD SHA до начала.
- Не cherry-pick-ать чужие несвязанные изменения.
- Подтвердить, что запускается именно текущая интегрированная ветка, а не старый PR #27 SHA.
- Все evidence должны содержать точный tested HEAD SHA.

### B. Статические проверки
Выполнить и сохранить полные команды, exit codes и существенные логи:
- установка зависимостей (если требуется; не менять lockfile без причины);
- client tests;
- typecheck;
- check/lint;
- production build;
- monorepo tests либо объяснить ограничения среды.

Не заявлять pass без exit code 0. Отдельно указать известные 2 calendar-dependent failures в `@tdl/host`, если они воспроизводятся.

### C. Runtime smoke
Запустить приложение в production preview, если среда позволяет, чтобы отделить runtime-проблемы от dev HMR:
- desktop 1376×768;
- mobile 390×844;
- narrow mobile 320×690.

Повторить:
- загрузка двора;
- левый drag камеры не поднимает здание;
- правый hold не поднимает здание;
- правый drag вращает камеру;
- левый long press поднимает здание;
- touch long press поднимает здание;
- размещение Farm;
- upgrade до уровня 2;
- навигация и отсутствие горизонтального overflow.

### D. WebGL и консоль
- Разобраться, почему прошлый запуск сообщил `THREE.WebGLRenderer: Context Lost`.
- Проверить, повторяется ли это в production preview и влияет ли на сцену.
- Если это лимит SwiftShader/headless, приложить точные признаки и не объявлять проблему закрытой без аргументов.
- HMR WebSocket error не должен маскировать runtime-ошибки; production preview — предпочтительный режим.
- Не использовать SwiftShader FPS как показатель реальной производительности устройства.

### E. Evidence
Добавить в `evidence/TDL-ARCH-003/`:
- `smoke-report.json` с tested HEAD SHA, временем, browser/runtime versions, viewport, шагами и результатами;
- `health.json` (если применимо);
- `console.txt` и page errors;
- скриншоты desktop/mobile из реального запуска;
- `commands.log` с командами и exit codes;
- краткий `README.md` с ограничениями среды.

Скриншоты не обрезать и не редактировать так, чтобы скрыть дефекты. Концепт-арт не является runtime evidence.

## Ограничения
- Не менять визуальный стиль, геометрию зданий, экономику, серверные контракты и схему БД.
- Не мигрировать движок и не менять renderer.
- Не сливать PR.
- Не удалять и не переписывать предыдущие evidence; добавить новый отдельный пакет.
- Если для проверки требуется исправление кода, сначала описать точный дефект, предложить минимальный patch в этой же ветке и указать изменяемые файлы. Не расширять scope самостоятельно.

## Критерии сдачи
1. Точный tested HEAD SHA совпадает с интегрированной веткой на момент теста либо все последующие изменения явно перечислены.
2. Все команды и exit codes воспроизводимы.
3. Runtime сценарии имеют отдельные pass/fail, screenshots и console evidence.
4. WebGL Context Lost классифицирован доказательно.
5. Все новые файлы evidence добавлены в эту же общую ветку.
6. Финальный отчёт содержит commit SHA, список изменённых путей, результаты, ограничения и нерешённые дефекты.

## Ответ Arena.ai

Вернуть краткий итог в формате:
- Branch / tested HEAD:
- Environment:
- Commands + exit codes:
- Runtime scenarios:
- WebGL/context loss:
- Evidence paths:
- Changed files / commit:
- Open issues:
- Recommended next step:

После сдачи ChatGPT проверяет evidence и diff, обновляет статус/документацию и решает следующий этап. PR #28 не сливать до review.


## Результат приёмки ChatGPT — 12.11.2026

- Evidence пакет проверен в PR #28: JSON, commands.log, README, список файлов и runtime screenshot.
- Tested application SHA подтверждён как `c10e99a1d51a25eb4a7873b2e6d6e6d4857dc194`; текущие коммиты evidence/docs не меняли исходный код приложения.
- Runtime smoke принят с оговорками: HeadlessChrome + SwiftShader, мобильная эмуляция, не физические устройства.
- Monorepo: 195 passed + 2 calendar-dependent failed в `@tdl/host`; не считать suite полностью зелёным.
- WebGL: событие на detached canvas при R3F unmount; README сохраняет неопределённость точного шага навигации, не приписывает GPU-сбой.
- ChatGPT оставил review-комментарий в PR #28. PR остаётся draft; merge запрещён до review базового PR #26 и дальнейшей интеграционной проверки.
- Визуальный acceptance не пройден и не проверялся этой задачей: screenshot показывает старый снежный blockout. ARCH-003 подтверждает функциональность и адаптивность, но не новый gothic art direction.
