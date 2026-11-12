# TDL-ENV-001 — проверить рабочую среду Arena.ai и два runtime baseline

- **Статус:** COMPLETED
- **Владелец:** Arena.ai
- **Координатор:** ChatGPT
- **Дата результата:** 12.11.2026
- **Рабочая ветка Arena:** `arena/ff89979b-tg-bot` (чистая; проектные файлы не изменялись)
- **Main SHA:** `eaaa9072a729f69ae19d44a1449c1d94f27c07a1`
- **PR #9 HEAD:** `45e1014e9fba72ec9bcddefa492ef210d26da808`
- **PR #9 base:** `bc7c737a4cbf10c97ffa6a26145c45b70a0653fa`
- **PR #9 CI:** run #437 SUCCESS, [GitHub Actions](https://github.com/PandaGarry/tg_bot/actions/runs/43223155437)

## Цель и scope

Подтвердить, какие практические проверки Arena.ai действительно может выполнять для TDL, и сравнить main (R3F/Three.js) с PR #9 (PixiJS) на одинаковом smoke-сценарии. Работа выполнена в изолированных копиях `/tmp/tdl-main` и `/tmp/tdl-pr9`; production не затрагивался. Коммиты, push и PR не создавались.

## 1. Среда Arena.ai

| Компонент | Фактический результат |
|---|---|
| ОС | Debian 12 bookworm, x86_64; 2 vCPU, 3.8 GiB RAM, без swap |
| Node.js | v22.22.3 |
| pnpm | 12.6.0 (установлен глобально через npm) |
| PostgreSQL | embedded-postgres 18.4.0-beta.17; локальные порты 55432/55433 |
| Browser | @sparticuz/chromium 153.0.0; HeadlessChrome/153.0.8010.0 |
| WebGL | WebGL 2.0 через SwiftShader software renderer (CPU) |
| Godot | Не установлен; CLI/templates не удалось получить из-за egress-фильтра и отсутствующего toolchain |

Ограничения Godot: отсутствуют godot/godot4, export templates, clang, scons, cmake, ninja, pkg-config, Xvfb; egress к deb.debian.org и objects.githubusercontent.com блокируется TLS. Готовый экспортированный Godot Web build теоретически можно smoke-test в Chromium, если артефакты доступны через разрешённый источник, но экспорт в текущей Arena-среде не подтверждён.

## 2. Сравнение runtime baseline

| Проверка | main — R3F/Three.js | PR #9 — PixiJS |
|---|---|---|
| Commit | `eaaa9072a729f69ae19d44a1449c1d94f27c07a1` | `45e1014e9fba72ec9bcddefa492ef210d26da808` |
| Install | `pnpm install --frozen-lockfile`, exit 0 | `pnpm install --frozen-lockfile`, exit 0 |
| Typecheck | exit 0, 18/18 | exit 0, 19/19 |
| Check | exit 0, 11 модулей | exit 0, 12 модулей + каталог 19 зданий |
| Build | exit 0, 3/3 (вкл. court3d) | exit 0, 2/2 (Pixi client/server; court3d отсутствует) |
| Tests | 181 passed, 2 failed; несмотря на это exit 0 из-за Vitest 5.0.1 runner behavior | 307 passed, 0 failed |
| Browser smoke | exit 0 | exit 0 |
| Scene | 3D low-poly snowy courtyard; Town Hall, palisade, gates, fir trees | 2D isometric dark gothic courtyard; Citadel with green crystal |
| Build interaction | Жилой дом placed at (4,10); power 145 → 185 | Sheep pen placed at (1,1), behind Citadel |
| Map navigation | Работает, но при уходе со сцены Canvas размонтируется и пишет WebGL Context Lost | Работает без потери WebGL context |
| Reload session | Не сохраняется; возвращает на login | Сохраняется |
| Desktop/mobile | 1376×768, 390×844, 320×690; horizontal overflow false | Те же viewport; horizontal overflow false |

### Производительность — не использовать как benchmark

- main: ~3.7 FPS, avg 271.1 ms, p95 583.3 ms.
- PR #9: ~14.7 FPS, avg 67.92 ms, p95 100 ms.

Оба значения измерены в HeadlessChrome на SwiftShader software CPU renderer. Это не аппаратный GPU и не реальные мобильные устройства; цифры нельзя использовать для выбора движка или прогнозирования production FPS.

## 3. Обнаруженные дефекты

**main**
- Два падающих host tests: `packages/host/tests/clock.test.ts:71`, `switches.test.ts:303`; зависят от реальной даты 12.11.2026. Vitest 5.0.1 при этом вернул exit 0 — false green.
- Регистрация: иконки input перекрывают первые символы.
- Build panel mobile 390px: текст требования Ратуши перекрывает стоимость.
- При переключении Двор → Карта R3F Canvas размонтируется; в console `THREE.WebGLRenderer: Context Lost.`
- На desktop 1376×768 сцена занимает 820×768 с чёрными полями.

**PR #9**
- Login: плашка «Связь есть» перекрывает переключатель языка «РУС».
- Touch mobile 390×844 и 320×690: плашка переноса Цитадели перекрывает строку летописца.
- При zoom=1 камера центрирует доску; панорамирование становится заметным после zoom.

## 4. Вывод по пригодности Arena

**Подходит:** регулярный функциональный browser QA, smoke tests, проверка desktop/mobile layout, запуск локального сервера и PostgreSQL, проверка того, что WebGL-сцены рендерятся, сбор реальных Chromium screenshots и логов.

**Не подходит:** достоверное измерение GPU/FPS и тепловой стабильности на телефонах. Для этого нужен аппаратный GPU и реальные целевые устройства либо сопоставимый GPU-enabled CI runner.

**Godot:** текущая среда не подходит для установки/сборки Godot Web. Готовый export можно только тестировать в браузере при наличии артефакта.

## 5. Продуктовый вывод для PR #9

PR #9 имеет существенные преимущества по тестам (307/0 против 181/2), session persistence, onboarding, форме регистрации, созданию лорда и функциональности клиента. Но его PixiJS renderer заменяет 3D-мир на 2D и удаляет `apps/client/src/court/CourtScene.tsx` и `apps/court3d`. Это конфликтует с утверждённым 12.11 направлением Premium stylized realism + полноценный 3D.

**Решение:** не сливать PR #9 as-is. Сохранить полезные изменения после классификации diff и review; renderer rewrite держать отдельно. Не выбирать PixiJS из-за SwiftShader FPS. Продолжить сравнение R3F/Three.js с Babylon.js на одинаковой 3D-сцене и аппаратно-валидном benchmark. Godot Web остаётся условным вариантом до появления доступной сборочной среды.

## 6. Evidence — опубликовано в GitHub

После первоначального отчёта Arena добавила фактические материалы отдельным commit `eef31d1ce84efff6a4653e4a87c95ceebf946ce8` в рабочую ветку `arena/ff89979b-tg-bot`. Родитель commit — проверенный `main` SHA `eaaa9072a729f69ae19d44a1449c1d94f27c07a1`; изменения не затрагивают код, документацию, зависимости или `main`.

[Открыть всю папку TDL-ENV-001 evidence](https://github.com/PandaGarry/tg_bot/tree/arena/ff89979b-tg-bot/evidence/TDL-ENV-001)

В репозитории находятся 31 PNG screenshot и `health.json` / `smoke-report.json` для обоих baseline. Ключевые кадры:
- [main — двор desktop](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/main/05-court-desktop.png)
- [main — двор после постройки desktop](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/main/08-court-built-desktop.png)
- [PR #9 — двор desktop](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/pr9/05-court-desktop.png)
- [PR #9 — двор после постройки desktop](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/pr9/08-court-built-desktop.png)
- [main — mobile touch 390px](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/main/12-mobile-touch-ctx-390.png)
- [PR #9 — mobile touch 390px](https://github.com/PandaGarry/tg_bot/blob/eef31d1ce84efff6a4653e4a87c95ceebf946ce8/evidence/TDL-ENV-001/pr9/12-mobile-touch-ctx-390.png)

В папках main и pr9 также сохранены остальные desktop/mobile шаги, `health.json` и `smoke-report.json`.

## 7. Команды и exit codes

Обе базы: `pnpm install --frozen-lockfile` → 0; `pnpm typecheck` → 0; `pnpm check` → 0; `pnpm build` → 0; smoke script → 0.

- main tests: фактически 181 passed / 2 failed; process exit 0 (ложный зелёный статус Vitest 5.0.1).
- PR #9 tests: 307 passed / 0 failed; exit 0.

Подробный вывод и команды приведены в отчёте Arena.ai от 12.11.2026, на основании которого подготовлена эта запись.
