# Повторная проверка аудита TDL — 08.11.2026

> Ветка: `arena/8885a9e3-tg-bot` · первоначальный baseline: `13e59a7029eb273c8253af7992008441a2baeb23`; актуальный проверенный HEAD: `320d7e2cbc673aa156be4e0451c0a8e72ebddb53`
> Назначение: актуализировать статический аудит по текущему коду и результатам CI. Это не акт релизной приёмки.

> Текущий branch HEAD: `320d7e2cbc673aa156be4e0451c0a8e72ebddb53`; полный CI run #160 завершился PASS. Он проверил trusted proxy allowlist, XFF chain parsing, account-level command limiter, refreshed lockfile и Drizzle snapshot.

## 1. Проверки CI

| HEAD | Проверка | Результат | Вывод |
|---|---|---|---|
| `ed19b71` | `pnpm typecheck` | FAIL | Две ошибки TS2345 в `packages/modules/court/src/module.ts`: дорожная плитка передавалась числом вместо `Size` |
| `2c110a8` | `pnpm typecheck` | PASS | Исправлены оба вызова `fitsGrid`: размер задан как `{ w: 1, h: 1 }` |
| `2c110a8` | `pnpm test` | FAIL | 41 passed / 1 failed. Устаревшее ожидание logout без подтверждения сервера; остальные шаги workflow пропущены |
| `85c0505` | UI-тест logout | Исправлен | Тест подтверждает, что офлайн-клиент не изображает успешный отзыв серверной сессии |
| `316c2f8` | court deadline | Исправлен | Повторный вход не сдвигает существующий производственный срок; добавлены два теста |
| `13e59a7` | Полный CI run #35 | **PASS** | Исторический baseline: 247 тестов в 29 файлах |
| `1351fbb` | Полный CI run #75 | **PASS (исторический)** | 255 тестов в 30 файлах; на тот момент оставались 3 Moderate advisories. |
| `13deea4` | Полный CI run #85 | FAIL | Typecheck прошёл; один новый тест не прошёл контракт реестра из-за отсутствующих словарей ru/en. Исправлено в `877942d`. |
| `877942d` | Полный CI run #86 | **PASS (исторический)** | 261 тест в 31 файле; typecheck, test, check, production build и audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `76f50e3` | Полный CI run #101 | **PASS (исторический)** | 263 теста в 31 файле; typecheck, test, check, production build, audit thresholds High/Moderate; Origin allowlist и истечение override покрыты тестами. Известных уязвимостей не обнаружено. |
| `69268de` | Полный CI run #124 | **PASS (исторический)** | 264 теста в 31 файле; typecheck, test, check, `bash -n` backup/restore scripts, production build, audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `042f0cf` | Полный CI run #131 | **PASS (исторический)** | 264 теста в 31 файле; typecheck, test, check, HTTP security headers tests, `bash -n` backup/restore scripts, production build, audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `b4c1c51` | Полный CI run #146 | **PASS (исторический)** | 264 теста в 31 файле; typecheck, test, check, account-level command rate limit, `bash -n` backup/restore scripts, production build, Drizzle snapshot check и audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `320d7e2` | Полный CI run #160 | **PASS** | 266 тестов в 31 файле; typecheck, test, check, trusted proxy/XFF chain tests, account-level command rate limit, `bash -n` backup/restore scripts, production build, Drizzle snapshot check и audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `633ed3c` | CI run #136 | **ACTION_REQUIRED (superseded)** | Bot commit с refreshed lockfile и Drizzle snapshot baseline; jobs не запускались. Полный CI #146 на текущем HEAD `b4c1c51` прошёл и проверил lockfile, snapshot check и весь код. |

Ссылки: [CI run #32](https://github.com/PandaGarry/tg_bot/actions/runs/42514624495), [CI run #33](https://github.com/PandaGarry/tg_bot/actions/runs/42514707562), [CI run #34](https://github.com/PandaGarry/tg_bot/actions/runs/42514844082), [CI run #35 — исторический baseline](https://github.com/PandaGarry/tg_bot/actions/runs/42514990088), [CI run #85 — исправление тестового контракта](https://github.com/PandaGarry/tg_bot/actions/runs/42519010100), [CI run #86 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42519146771), [CI run #101 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42519773732), [CI run #124 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42520465831), [CI run #131 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42520902658). [CI run #136 — action required, superseded](https://github.com/PandaGarry/tg_bot/actions/runs/42521138693), [CI run #146 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42521629314), [CI run #160 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42522078074).

## 2. Повторная верификация находок первичного аудита

| ID | Первичный вывод | Текущий статус | Доказательство / следующий шаг |
|---|---|---|---|
| TDL-AUD-001 | Миграция сбрасывала дворы всех миров | **Исправлено + интеграционный тест PASS** | `applyModuleMigrations` задаёт transaction-local `tdl.world_id`; миграция `to: 3` фильтрует текущий мир. `packages/host/tests/migrations.test.ts` проверяет, что второй мир не меняется до своей миграции; тест проходит run #35. До production проверить backup и возможный исторический сброс. |
| TDL-AUD-002 | Жёсткий предел склада противоречит модели экономики | **Активно, P1** | `LIMIT_BASE` и фаза `limit` по-прежнему ограничивают баланс. Уточнить канон: вместимость склада, защищённый объём и фактическое накопление — разные величины |
| TDL-AUD-003 | Клиентский stock patch может расходиться с БД при clamp | **Закрыто; CI #160 PASS** | `applyStock` сохраняет фактический баланс после clamp в `stockBalances`; финальная сборка patch переписывает `stock.*` в `set` с фактическим значением. `packages/host/tests/foundation.test.ts` проверяет, что баланс не превышает 500, последний patch равен значению БД и создаётся `stock.clamped` sim fact. |
| TDL-AUD-004 | Производство не зависит от зданий и включает пассивное золото | **Активно, P1 до включения экономики** | `PRODUCTION_BASE` остаётся фиксированным по ресурсам; связать выпуск с утверждёнными зданиями/уровнями и источниками валюты |
| TDL-AUD-005 | Диагностический маршрут был публичным | **Исправлено + HTTP-тест PASS** | `/api/kernel/rejections` требует `x-admin-token`, пустой токен не даёт доступ; `apps/server/tests/http.test.ts` проверяет 403 без токена и 200 с корректным токеном; run #35 PASS. |
| TDL-AUD-006 | Auth limits, account command bucket и trusted proxy parser реализованы | **Частично закрыто, P1 до production** | Login/register используют общий IP bucket между сокетами; команды используют общий account bucket между WebSocket-сессиями. `TRUSTED_PROXY_IPS` принимает только exact IPv4/IPv6; XFF учитывается только от allowlisted TCP peer и разбирается справа налево. Перед production требуется заполнить список реальными IP выбранного провайдера и проверить его на целевом proxy. |
| TDL-AUD-007 | Повторный вход сдвигает производственный deadline | **Исправлено в HEAD 316c2f8; CI PASS на 13e59a7** | `court.enter` читает `ctx.deadlines()` и создаёт tick только если его нет. Добавлены тесты повторного входа и первого входа |
| TDL-AUD-008 | Дороги размещались вне текущей площадки | **Исправлено + тест PASS** | Оба пути постановки/переноса вызывают `fitsGrid(..., { w: 1, h: 1 }, grid.size)`; тесты проверяют границы, перенос и коллизии; run #35 PASS. |
| TDL-AUD-009 | Недостаточно тестов ключевых команд двора | **Частично активно** | Есть тесты place/road/upgrade/remove/enter; остаются move, конкурирующие команды, миграция двух миров, склад и production |
| TDL-AUD-010 | Сила — временная формула, уровни зданий не реализованы | **Активно, продуктовый пробел** | Не показывать формулу как финальную силу до утверждения доменной модели и уровней зданий |
| TDL-AUD-011 | Нативная поставка и полноценный desktop не подтверждены | **Активно, план платформ** | Сейчас доказан browser client; отдельно спроектировать responsive desktop и принять решение PWA/Capacitor/native |
| TDL-AUD-012 | Основной 4X-геймплей не реализован | **Активно, блокер готовности продукта** | Карта, марши, армия, бой, командиры, альянсы и исследования — этапы roadmap, не считать прототип готовой стратегией |
| TDL-AUD-013 | Уникальные спрайты зданий не готовы | **Активно, визуальный пробел** | Нужны арт-лист, состояния уровней, ассеты и тесты читаемости на мобильных экранах |
| TDL-AUD-014 | Нет полноценного fallback при ошибке Pixi | **Активно, P1/P2 совместимость** | Нужен пользовательский fallback, повтор запуска и проверка браузеров/устройств |
| TDL-AUD-015 | Документация расходится с кодом | **Активно; этот файл — первый шаг синхронизации** | Синхронизировать roadmap, STATUS, master plan и DECISIONS; исторические документы помечать как архивные |

## 3. Технологический вывод

Текущий стек — TypeScript, pnpm/Turborepo, Node.js 24 в CI, React 19, PixiJS 8, Vite 8, PostgreSQL, Drizzle, WebSocket, Zod и Vitest — подходит как основа browser-first многопользовательской 2D стратегии. Массовая смена стека сейчас не обоснована.

Приоритет — не «обновить всё до последней версии», а:
1. Зафиксировать и проверить совместимость версий по lockfile и Node runtime.
2. Проверить security advisories, лицензии и цепочку поставки зависимостей.
3. Исправить доменные инварианты склада, производства, сроков и команд.
4. Проверить серверную авторизацию, rate limiting, изоляцию миров, идемпотентность и транзакции.
5. Измерить клиентские FPS, GPU/CPU, память, размер bundle и загрузку ассетов на реальных мобильных устройствах.
6. Утвердить responsive desktop и мобильную поставку; веб-клиент не равен нативному приложению.

Первый CI run #35 показал предупреждение о Node 20 в actions v4. Workflow обновлён на `actions/checkout@v7`, `actions/setup-node@v7` и `pnpm/action-setup@v6` (Node 24 compatible); следующий run должен подтвердить обновление. Добавлен `pnpm audit --audit-level high`.

## 4. Следующий порядок работ

1. Закрыть оставшиеся P0: backup/restore drill (AUD-034) и остаток production hardening (AUD-035: CSP/frame policy, diagnostic-route review, TLS/reverse-proxy deployment validation). AUD-030 (полный startup migration lock) и AUD-022 (уникальность lord per account/world) закрыты и подтверждены CI.
2. Исправить склад/production только после сверки с утверждённой экономикой (AUD-002/003/004).
3. Настроить реальные IP в `TRUSTED_PROXY_IPS` на выбранном production proxy и завершить idempotency scope (AUD-006/033). Auth/register, trusted proxy parser и account-level command buckets реализованы.
4. Восстановить историю отчётов при входе (AUD-032) и проверить конкурирующие команды/гонки.
5. Провести review HTTP/WebSocket security, CSP/security headers, localStorage token threat model и observability.
6. Оптимизировать initial JS chunk (~734.64 kB minified / 213.55 kB gzip), убрать build warnings, затем перейти к Pixi lifecycle/performance и UI/UX.

**Правило приёмки:** находка закрывается только при наличии исправления, теста, зелёного CI на HEAD и актуальной записи в STATUS/master plan.

## 5. Дополнительно подтверждённые исправления на HEAD 13e59a7

| ID | Исправление | Регрессионная проверка |
|---|---|---|
| TDL-AUD-018 | Logout отзывает авторизацию на всех активных сокетах с тем же токеном, а не только на текущем соединении | `apps/server/tests/socket.test.ts`: второе активное соединение после logout получает отказ на команду |
| TDL-AUD-019/020/027 | Клиент предъявляет сохранённый токен при reconnect, ждёт серверный auth перед командами, не удаляет токен при offline logout и ждёт `out.ok` | `apps/client/tests/net.test.ts` + обновлённый `shell.test.tsx`; run #35 PASS |
| TDL-AUD-029 | Подготовительные sweep-операции находятся внутри `try/finally`; ошибка не оставляет `pumping=true` | `packages/host/tests/writer.test.ts`: синтетическая ошибка sweep и успешный следующий проход |
| TDL-AUD-031 | `resume/logout` фильтруются по `world_id`; создание лорда обновляет только сессии текущего мира; WebSocket и `submitCommand` проверяют принадлежность мира | `packages/host/tests/gates.test.ts` и `writer.test.ts`: межмировой токен и чужой actor отклоняются |
| TDL-AUD-007 | Повторный `court.enter` не переносит существующий production deadline | `packages/modules/court/tests/commands.test.ts`: повторный вход не сдвигает срок |

**Ограничение:** эти статусы означают «исправлено в рабочей ветке и подтверждено CI», а не «выпущено в production». PR #9 не слит; production DB не мигрировалась.


## 6. Повторная проверка после обновления ветки — 08.11.2026

> Текущий проверенный HEAD: `c0b113fdaa7386a859aa502ae759cba819d347c1` · PR #9 открыт, не слит · CI run #74: **SUCCESS**.

Полный workflow #74 на этом HEAD завершил успешно все обязательные этапы: `pnpm typecheck`, `pnpm test`, `pnpm check`, `pnpm build`, `pnpm audit --audit-level high`. Предыдущий run #72 на HEAD `16fa322` упал на typecheck в `packages/host/tests/stress.test.ts`: тест обращался к `outcome.key` без narrowing и терял тип `CommandOutcome` в результате `.then()`. Коммит `150fe8d` сохранил возвращаемый outcome и убрал ошибочный доступ; run #74 подтвердил исправление полным CI. Не путать run #72 (FAIL) и run #74 (PASS).

### Пересмотр отдельных находок по коду HEAD c0b113f

| ID | Уточнённый статус | Подтверждение и остаток |
|---|---|---|
| TDL-AUD-003 | **Исправление в реализации; тестовое покрытие требует усиления** | `packages/host/src/world/effects.ts`: при сборке `stock.*` патчей ядро заменяет переданное значение фактическим балансом из `stockBalances`, включая результат clamp и gather. Не считать находку полностью закрытой, пока нет отдельной регрессии на БД + клиентский патч при clamp. |
| TDL-AUD-006 | **Частично закрыто; CI #75/#146/#160 PASS** | `apps/server/src/net.ts`: login/register используют общий IP bucket между сокетами (login — 5, register — 10 попыток на окно 60 секунд), TTL и максимальный размер карты ограничены. Команды ограничиваются общим token bucket по `accountId` в пределах мира. `TRUSTED_PROXY_IPS` валидирует exact IPv4/IPv6; XFF учитывается только при trusted TCP peer и разбирается справа налево. Для production остаётся указать реальные IP proxy. |
| TDL-AUD-022 | **Исправлено на уровне приложения и БД; CI #75 PASS** | `createLord` сериализует создание через `pg_advisory_xact_lock`; миграция `0004_world_invariants.sql` добавляет уникальный индекс `(world_id, account_id)` после fail-fast проверки дублей. Тесты проверяют конкурентное создание и восстановление `sessions.lord_id`. До production выполнить read-only запрос на существующие дубли; миграция намеренно не удаляет данные. |
| TDL-AUD-030 | **Исправлено в startup bootstrap; CI #86/#101/#124/#131 PASS** | `bootServer` вызывает `bootstrapWorld`: один PostgreSQL advisory lock охватывает kernel migrations → `ensureWorld` → `syncModuleStates` → module migrations. Добавлен конкурентный интеграционный тест: два одновременных bootstrap не применяют ступень модуля повторно. Совместимость mixed-version rolling deploy остаётся отдельной production-проверкой. |
| TDL-AUD-002/004 | **Открыто, P1** | Склад по-прежнему поддерживает фазу limit/clamp, а `PRODUCTION_BASE` в модуле двора задаёт фиксированный выпуск. Требуется утвердить экономическую модель и только после этого менять баланс. |
| TDL-AUD-003 | **Закрыто; CI #160 PASS** | Проверка `foundation.test.ts`: после 30 выдач клиентский stock patch содержит фактический DB balance после clamp, а не исходную дельту; `sim_rejections` фиксирует `stock.clamped`. Реализация находится в `packages/host/src/world/effects.ts`. |
| TDL-AUD-034 | **Открыто, P0 до production** | Подготовлены `tools/db/backup.sh`, `tools/db/restore-drill.sh` и `docs/ops/backup-restore.md`: custom dump, checksum, права файлов, restore только в пустую `tdl_restore_*` БД и smoke check core tables. Скрипты прошли `bash -n` вручную и в CI #124/#131. Фактический backup/restore drill на целевой БД не выполнялся; нужны провайдер, изолированная БД, application smoke test и запись RPO/RTO. |
| TDL-AUD-035 | **Частично закрыто, P0 до production** | Production config требует сильные раздельные `SESSION_SECRET`/`ADMIN_TOKEN`, явные `WORLD_ID`, `ACCESS_MODE`, `REGISTRATION_OPEN` и точный HTTPS `ALLOWED_ORIGINS`. WebSocket `/socket` отклоняет отсутствующий/неразрешённый Origin до авторизации. HTTP-ответы добавляют `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `/api/*` помечаются `no-store`, permissive CORS не включён. Config, socket и HTTP header tests проходят CI #101/#124/#131. Осталось определить CSP/frame policy по asset/preview inventory, проверить диагностические endpoints и фактический TLS/reverse-proxy deployment на целевой площадке. |
| TDL-AUD-016 | **Исправлено, CI #86/#101/#124/#131/#146/#160 PASS** | Полный workflow проходит typecheck/test/check/build и оба порога `pnpm audit --audit-level high` / `moderate`; 266 тестов в 31 файле. Известных уязвимостей в текущем lockfile не обнаружено. |

### Что нельзя объявлять готовым

- PR #9 не слит в `main`; успешный CI рабочей ветки не равен production-релизу.
- Полный аудит безопасности и diff-review 375 файлов ещё не завершены.
- CI не заменяет нагрузочное тестирование на целевой инфраструктуре, проверку восстановления БД и ручную приёмку UI на телефонах/широких экранах.
- Экономика, production model и оставшиеся P0/P1 требуют отдельного закрытия с тестами.

## 7. Дополнительные исправления и новые находки — проверенный HEAD 320d7e2

| ID | Статус | Доказательство / следующий шаг |
|---|---|---|
| TDL-DB-007 | **Snapshot baseline проверен; CI #146/#160 PASS** | Commit `633ed3c` добавил `0005_schema_snapshot_sync.sql` (`SELECT 1` без DDL), `0005_snapshot.json` и запись journal `idx: 5` после `0004_world_invariants`. Snapshot включает уже существующие объекты из migrations 0001–0004: `unit_states`, `unit_health`, `module_states.until_ms/reason`, `deadlines.unit_id`, `lords_account_world_idx`, `accounts_email_key_idx` и defaults email. `pnpm-lock.yaml` добавляет overrides из `pnpm-workspace.yaml` и обновляет Vitest 5.0.1 → 5.0.3. Drizzle snapshot check прошёл в CI #146. |
| TDL-AUD-030 | **Закрыто для полного startup bootstrap; CI #86/#101/#124/#131/#146 PASS** | `bootstrapWorld` удерживает единый database-wide advisory lock на всех четырёх стадиях запуска. Тест `полный bootstrap сериализуется одним замком от ядра до миграций модулей` запускает два bootstrap одновременно и проверяет однократное применение миграции. Mixed-version rolling deploy остаётся отдельной проверкой совместимости схемы и кода. |
| TDL-AUD-035 | **Частично закрыто; CI #101/#124/#131/#146/#160 PASS** | `ALLOWED_ORIGINS` обязателен в production и принимает только точные HTTPS origins без путей; WebSocket handshake разрешает только `/socket` и только allowlisted Origin. Добавлены базовые HTTP security headers и `no-store` для API, тесты покрывают health/static responses и отсутствие permissive CORS. CSP/frame policy, диагностические endpoints и TLS/proxy deployment остаются открытыми. |
| TDL-TEST-001 | **Исправлена нестабильность теста; CI #101 PASS** | Тест истечения unit override больше не ждёт 60 мс в реальном времени: он задаёт истёкший срок через публичную операцию. Проверка стала детерминированной и не зависит от задержки CI. |
| TDL-AUD-033 | **Исправлено + CI #75 PASS** | PK `commands` теперь `(world_id, actor_id, idempotency_key)`; SELECT/INSERT/UPDATE scoped по actor; rejected-key conflict использует `DO NOTHING`, поэтому конфликтующий commandId не перезаписывает ранее успешный outcome. Есть тесты межигрового ключа и сохранения исходного результата. |
| TDL-AUD-036 | **Открыто, P1 производительность** | PixiJS импортируется статически в `main.tsx` и инициализируется до авторизации. Production main chunk — 735.16 КБ minified / 213.81 КБ gzip; требуется dynamic import после входа в мир и повторный замер. |
| TDL-AUD-037 | **Открыто, P1/P2 производительность** | `CourtScene.redraw` заново строит сетку и пересоздаёт здания при обновлении состояния; нет diff-based reconciliation/render-on-demand. Сначала добавить измерение времени redraw и затем обновлять только изменившиеся объекты. |
| TDL-AUD-038 | **Открыто, P1 корректность UX** | Несколько ветвей `court.place/move/remove/road/upgrade` возвращают пустой список effects при невалидном действии/недостатке ресурсов; ядро считает это успешным no-op. Добавить типизированные локализованные ошибки и тесты rejected outcomes. |
| TDL-AUD-039 | **Закрыто для текущего lockfile; CI #86/#101/#124/#131 PASS** | `pnpm audit --audit-level high` и `pnpm audit --audit-level moderate` завершились сообщением `No known vulnerabilities found`. Повторять audit при каждом обновлении зависимостей; статус не является гарантией отсутствия будущих advisories. |
| TDL-AUD-040 | **Частично закрыто; CI #160 PASS** | `TRUSTED_PROXY_IPS` принимает только exact IPv4/IPv6, CIDR намеренно запрещён. XFF доверяется только если прямой TCP peer входит в allowlist; цепочка разбирается справа налево до первого недоверенного hop, forged prefix слева игнорируется. Тесты покрывают spoofed XFF без allowlist и forged prefix за доверенным proxy. До production необходимо задать реальные proxy IP. |
| TDL-AUD-041 | **Закрыто; CI #146/#160 PASS** | `SocketHub` хранит ограниченный token bucket по `accountId` в пределах мира. Все WebSocket-сессии одного аккаунта используют общий бюджет; открытие нового сокета не сбрасывает лимит. Bucket имеет TTL и верхнюю границу по количеству аккаунтов, очищается при остановке мира. Регрессионный тест проверяет два сокета одного аккаунта и независимость соседнего аккаунта. |

### Графическая сборка и производительность

- `vite v8.3.6` production build успешен.
- Главный JS chunk: **735.16 КБ** (213.81 КБ gzip); предупреждение Vite/Rolldown о чанке >500 КБ остаётся.
- Tailwind Vite plugin выдаёт предупреждение о некорректной/отсутствующей sourcemap при трансформации; нужно проверить production sourcemaps и корректность pipeline.
- Статический аудит выявил раннюю загрузку Pixi до авторизации, постоянный ticker при преимущественно статичной сцене и полную перерисовку сетки/зданий. Это пока не замеры FPS: перед оптимизацией снять baseline на слабом Android/iPhone и desktop.
- Текущие здания — векторные заглушки, не финальный sprite/atlas pipeline. Арт-лист, атласы, LOD/culling и бюджет GPU памяти остаются отдельной задачей.

### Текущие ограничения

- PR #9 открыт, не слит; в нём 378 файлов. Полный diff review не завершён.
- CI #131 не выполняет restore drill и не проверяет production DB; миграция 0004 проверена только на чистой тестовой PostgreSQL.
- До применения миграции 0004 к существующей БД выполнить:
  `SELECT world_id, account_id, count(*), array_agg(lord_id) FROM lords GROUP BY world_id, account_id HAVING count(*) > 1;`
  При наличии строк требуется ручное решение по данным, автоматическое удаление запрещено.
- На текущем lockfile CI #86/#101/#124/#131/#146/#160 не обнаружил известных High или Moderate advisories. Это не отменяет повторного dependency audit при каждом обновлении.
