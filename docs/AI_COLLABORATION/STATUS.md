# TDL — текущее состояние совместной разработки

> Snapshot: 12.11.2026 после TDL-ENV-001 и подготовки Visual Bible v1.0. Проверено по GitHub refs и отчёту Arena.ai.

## GitHub baseline

| Показатель | Значение |
|---|---|
| Репозиторий | `PandaGarry/tg_bot` |
| Default branch | `main` |
| HEAD `main` | `eaaa9072a729f69ae19d44a1449c1d94f27c07a1` |
| PR #17 | MERGED — workflow ChatGPT + Arena.ai |
| PR #18 | MERGED — status snapshot |
| PR #19 | MERGED — reconciliation 3D baseline |
| PR #20 | MERGED — Arena runtime comparison handoff |
| Основной кодовый PR #9 | OPEN, не слит, 427 файлов |
| HEAD PR #9 | `45e1014e9fba72ec9bcddefa492ef210d26da808` |
| Base PR #9 | `bc7c737a4cbf10c97ffa6a26145c45b70a0653fa` |
| Последний CI PR #9 на проверенном HEAD | run #437 — SUCCESS по отчёту Arena.ai |
| CI run #437 | [GitHub Actions](https://github.com/PandaGarry/tg_bot/actions/runs/43223155437) |

## Продуктовая цель (утверждена 12.11.2026)

- Оригинальная undead-fantasy вселенная The Dead Lords.
- Premium stylized realism.
- Полноценный 3D-мир с изометрической камерой.
- Собственные модели + лицензированные ассеты + ручная художественная доводка.
- Сначала качественный vertical prototype, затем масштабирование.
- Mobile + browser/PC.

Источник: `docs/TDL_PRODUCT_VISION_AND_ACCEPTANCE.md`.

## Результат TDL-ENV-001 — Arena.ai

**Статус: COMPLETED.** Отчёт получен 12.11.2026. Проверены изолированные копии main и PR #9; рабочая ветка Arena оставлена чистой, коммиты/push/PR не создавались.

- Arena пригодна для регулярного функционального browser QA, проверки вёрстки и WebGL-сцен с реальными Chromium screenshots на desktop/mobile viewport.
- Тестовая среда использует HeadlessChrome 153 + SwiftShader software WebGL 2.0. Она не пригодна для достоверных сравнений реального FPS/GPU или производительности физических телефонов.
- Godot CLI и export templates отсутствуют; установка/сборка заблокированы сетевыми ограничениями и отсутствующим toolchain. Godot Web runtime можно проверять только если готовые экспортированные артефакты будут доставлены в доступную среду.
- Фактические отчёты и screenshots опубликованы в рабочей ветке Arena, commit `eef31d1ce84efff6a4653e4a87c95ceebf946ce8`: [evidence/TDL-ENV-001](https://github.com/PandaGarry/tg_bot/tree/arena/ff89979b-tg-bot/evidence/TDL-ENV-001).

### Сравнение двух baseline

| Критерий | main — R3F/Three.js | PR #9 — PixiJS |
|---|---|---|
| Runtime | Полноценная 3D low-poly сцена | 2D изометрия |
| Install/typecheck/check/build | Успешно | Успешно |
| Тесты | 181 passed, 2 failed; Vitest 5.0.1 ошибочно вернул exit 0 | 307 passed, 0 failed |
| Browser smoke | Пройден | Пройден |
| Старт → auth → создание лорда → двор → постройка → карта | Пройдено | Пройдено |
| Session persistence после reload | Нет | Да |
| Mobile overflow | Не обнаружен | Не обнаружен |
| Ограничения UI | Ошибки регистрации/build mobile; WebGL context lost при переходе на карту | Перекрытие языка плашкой связи; touch-плашка переноса перекрывает летописец |
| Software-rendered frame time | ~3.7 FPS / 271.1 ms avg | ~14.7 FPS / 67.92 ms avg |

**Важно:** цифры FPS получены на SwiftShader CPU renderer и не являются сопоставимым аппаратным benchmark. Они не доказывают преимущество PixiJS над Three.js на реальном GPU.

### Продуктовое/техническое решение

PR #9 содержит ценные улучшения: исправления тестов, сохранение сессии, улучшенный onboarding/создание лорда, каталог зданий и более полную функциональность. Однако он удаляет R3F/Three.js и заменяет игровой мир 2D PixiJS, что прямо расходится с утверждённым full-3D направлением.

**Не сливать PR #9 as-is.** Следующий шаг — сохранить полезные изменения PR #9, отделив их от renderer rewrite, и провести одинаковый аппаратно-валидный vertical benchmark R3F/Three.js против Babylon.js (Godot Web остаётся условным кандидатом до появления доступной среды). Выбор движка не делать по SwiftShader FPS.

## Следующие действия

1. **ChatGPT — TDL-3D-001:** завершить архитектурное сравнение, определить минимальный одинаковый benchmark и дать рекомендацию без необоснованной миграции.
2. **ChatGPT — TDL-VIS-001:** подготовлен `docs/design/TDL_VISUAL_BIBLE.md` v1.0; ожидается визуальное утверждение владельца. После утверждения — TDL-VIS-002.
3. **ChatGPT — PR #9 review:** классифицировать изменения на переносимые продуктовые улучшения, сервер/архитектуру и конфликтующие PixiJS renderer changes.
4. **Arena.ai:** использовать для регулярного browser QA, скриншотов и функционального smoke; не заявлять реальные GPU/FPS результаты.
5. **Владелец:** утвердить Visual Bible и запуск benchmark/vertical prototype после технической рекомендации.

## Правило доказательств

Каждый статус «запущено», «проверено», «готово» сопровождается SHA, командами, результатами и реальными артефактами. Непроверенное обозначать прямо. Не выдавать план, концепт или скриншот макета за работающий результат.
