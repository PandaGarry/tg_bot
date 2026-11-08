# Повторная проверка аудита TDL — 08.11.2026

> Ветка: `arena/8885a9e3-tg-bot` · первоначальный baseline: `13e59a7029eb273c8253af7992008441a2baeb23`; актуальный проверенный HEAD: `83487bd300b9e10167825c657e384dbdcb15c9d3`
> Назначение: актуализировать статический аудит по текущему коду и результатам CI. Это не акт релизной приёмки.

> Текущий проверенный branch HEAD: `83487bd300b9e10167825c657e384dbdcb15c9d3`; полный CI run #175 завершился PASS. Он проверил typecheck, 269 тестов в 31 файле, checks, сезонное расписание, команды двора, backup/restore script syntax, production build, dependency audit High/Moderate и Drizzle snapshot.

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
| `320d7e2` | Полный CI run #160 | **PASS (исторический)** | 266 тестов в 31 файле; typecheck, test, check, trusted proxy/XFF chain tests, account-level command rate limit, `bash -n` backup/restore scripts, production build, Drizzle snapshot check и audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `83487bd` | Полный CI run #175 | **PASS** | 269 тестов в 31 файле; typecheck, test, check, сезонное расписание, локализованные ошибки команд двора, `bash -n` backup/restore scripts, production build, Drizzle snapshot check и audit thresholds High/Moderate. Известных уязвимостей не обнаружено. |
| `633ed3c` | CI run #136 | **ACTION_REQUIRED (superseded)** | Bot commit с refreshed lockfile и Drizzle snapshot baseline; jobs не запускались. Полный CI #146 на текущем HEAD `b4c1c51` прошёл и проверил lockfile, snapshot check и весь код. |

Ссылки: [CI run #32](https://github.com/PandaGarry/tg_bot/actions/runs/42514624495), [CI run #33](https://github.com/PandaGarry/tg_bot/actions/runs/42514707562), [CI run #34](https://github.com/PandaGarry/tg_bot/actions/runs/42514844082), [CI run #35 — исторический baseline](https://github.com/PandaGarry/tg_bot/actions/runs/42514990088), [CI run #85 — исправление тестового контракта](https://github.com/PandaGarry/tg_bot/actions/runs/42519010100), [CI run #86 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42519146771), [CI run #101 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42519773732), [CI run #124 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42520465831), [CI run #131 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42520902658). [CI run #136 — action required, superseded](https://github.com/PandaGarry/tg_bot/actions/runs/42521138693), [CI run #146 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42521629314), [CI run #160 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42522078074), [CI run #175 — полный PASS](https://github.com/PandaGarry/tg_bot/actions/runs/42523558776).

## 2. Повторная верификация находок первичного аудита

| ID | Первичный вывод | Текущий статус | Доказательство / следующий шаг |
|---|---|---|---|
| TDL-AUD-001 | Миграция сбрасывала дворы всех миров | **Исправлено + интеграционный тест PASS** | `applyModuleMigrations` задаёт transaction-local `tdl.world_id`; миграция `to: 3` фильтрует текущий мир. `packages/host/tests/migrations.test.ts` проверяет, что второй мир не меняется до своей миграции; тест проходит run #35. До production проверить backup и возможный исторический сброс. |
| TDL-AUD-002 | Жёсткий предел склада противоречил модели экономики | **Закрыто; CI #203/#214/#216/#218 PASS** | В актуальном `packages/modules/court/src/module.ts` для ресурсов нет modifiers фазы `limit`; `packages/modules/court/tests/commands.test.ts` явно проверяет `limitModifiers` пустым. Накопление не ограничено потолком; вместимость склада — отдельная защита от будущего грабежа согласно `docs/balance/economy.md` и `formulas.md`. |
| TDL-AUD-003 | Клиентский stock patch может расходиться с БД при clamp | **Закрыто; CI #160 PASS** | `applyStock` сохраняет фактический баланс после clamp в `stockBalances`; финальная сборка patch переписывает `stock.*` в `set` с фактическим значением. `packages/host/tests/foundation.test.ts` проверяет, что баланс не превышает 500, последний patch равен значению БД и создаётся `stock.clamped` sim fact. |
| TDL-AUD-004 | Производство не зависит от зданий и включает пассивное золото | **Открыто, P1 до утверждения экономики** | `packages/modules/court/src/module.ts` задаёт flat `PRODUCTION_BASE` на каждую минуту для всех игроков: meat 10, wood 12, stone 8, metal 4, mushrooms 6, gold 2. В 150 дней (216 000 минут) это baseline 2,592 млн дерева, 864 тыс. металла, 1,296 млн грибов и 432 тыс. золота независимо от ресурсных зданий/уровней. Это противоречит экономическому направлению (пассивное золото отсутствует; металл открывается поздно; грибы идут с фермы/карты/событий; дерево-пассив планировался как 15% бюджета). `ctx.modulate` может применять общие модификаторы, но связи выпуска с построенными зданиями в court нет. Не менять числа до утверждения модели владельцем продукта. |
| TDL-AUD-005 | Диагностический маршрут был публичным | **Исправлено + HTTP-тест PASS** | `/api/kernel/rejections` требует `x-admin-token`, пустой токен не даёт доступ; `apps/server/tests/http.test.ts` проверяет 403 без токена и 200 с корректным токеном; run #35 PASS. |
| TDL-AUD-006 | Auth limits, account command bucket и trusted proxy parser реализованы | **Частично закрыто, P1 до production** | Login/register используют общий IP bucket между сокетами; команды используют общий account bucket между WebSocket-сессиями. `TRUSTED_PROXY_IPS` принимает только exact IPv4/IPv6; XFF учитывается только от allowlisted TCP peer и разбирается справа налево. Перед production требуется заполнить список реальными IP выбранного провайдера и проверить его на целевом proxy. |
| TDL-AUD-007 | Повторный вход сдвигает производственный deadline | **Исправлено в HEAD 316c2f8; CI PASS на 13e59a7** | `court.enter` читает `ctx.deadlines()` и создаёт tick только если его нет. Добавлены тесты повторного входа и первого входа |
| TDL-AUD-008 | Дороги размещались вне текущей площадки | **Исправлено + тест PASS** | Оба пути постановки/переноса вызывают `fitsGrid(..., { w: 1, h: 1 }, grid.size)`; тесты проверяют границы, перенос и коллизии; run #35 PASS. |
| TDL-AUD-009 | Недостаточно тестов ключевых команд двора | **Частично активно; CI #216/#218 PASS** | `court.move` покрыт успешным переносом, not-found, occupied, out-of-bounds и road collision; тест сверяет сохранённую строку `court_holder.grid` с client patch. `packages/host/tests/migrations.test.ts` покрывает миграцию двух миров и конкурентное применение миграции; `stress.test.ts` — 20 конкурентных акторов. Остаются конкурентные court.place/move на одной сетке и end-to-end stock/production. |
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

1. Закрыть оставшиеся P0: production-like backup/restore drill (AUD-034; disposable CI drill PASS) и фактический TLS/reverse-proxy deployment (AUD-035). AUD-030 и AUD-022 закрыты и подтверждены CI.
2. Утвердить и реализовать производство по зданиям/уровням только после решения по экономике (AUD-004). AUD-002 закрыт: жёсткого потолка накопления больше нет.
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
| TDL-AUD-002 | **Закрыто; CI #203/#214 PASS** | Нет `limit` phase modifiers в court; regression test проверяет отсутствие потолка накопления. Ёмкость склада и накопление разведены. |
| TDL-AUD-004 | **Открыто, P1** | `PRODUCTION_BASE` остаётся фиксированным по ресурсам и не зависит от зданий/уровней; baseline также включает пассивное золото, металл и грибы. Утвердить экономику до изменения чисел. |
| TDL-AUD-003 | **Закрыто; CI #160 PASS** | Проверка `foundation.test.ts`: после 30 выдач клиентский stock patch содержит фактический DB balance после clamp, а не исходную дельту; `sim_rejections` фиксирует `stock.clamped`. Реализация находится в `packages/host/src/world/effects.ts`. |
| TDL-AUD-034 | **Открыто, P0 до production** | Подготовлены `tools/db/backup.sh`, `tools/db/restore-drill.sh` и `docs/ops/backup-restore.md`: custom dump, checksum, права файлов, restore только в пустую `tdl_restore_*` БД и smoke check core tables. Скрипты прошли `bash -n` вручную и в CI #124/#131. Фактический backup/restore drill на целевой БД не выполнялся; нужны провайдер, изолированная БД, application smoke test и запись RPO/RTO. |
| TDL-AUD-035 | **Частично закрыто, P0 до production** | Production config требует сильные раздельные `SESSION_SECRET`/`ADMIN_TOKEN`, явные `WORLD_ID`, `ACCESS_MODE`, `REGISTRATION_OPEN` и точный HTTPS `ALLOWED_ORIGINS`. WebSocket `/socket` отклоняет отсутствующий/неразрешённый Origin до авторизации. HTTP-ответы добавляют `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `/api/*` помечаются `no-store`, permissive CORS не включён. Config, socket и HTTP header tests проходят CI #101/#124/#131. Осталось определить CSP/frame policy по asset/preview inventory, проверить диагностические endpoints и фактический TLS/reverse-proxy deployment на целевой площадке. |
| TDL-AUD-016 | **Исправлено, CI #86/#101/#124/#131/#146/#160/#175 PASS** | Полный workflow проходит typecheck/test/check/build и оба порога `pnpm audit --audit-level high` / `moderate`; 266 тестов в 31 файле. Известных уязвимостей в текущем lockfile не обнаружено. |

### Что нельзя объявлять готовым

- PR #9 не слит в `main`; успешный CI рабочей ветки не равен production-релизу.
- Полный аудит безопасности и diff-review 375 файлов ещё не завершены.
- CI не заменяет нагрузочное тестирование на целевой инфраструктуре, проверку восстановления БД и ручную приёмку UI на телефонах/широких экранах.
- Экономика, production model и оставшиеся P0/P1 требуют отдельного закрытия с тестами.

## 7. Дополнительные исправления и новые находки — проверенный HEAD 83487bd

| ID | Статус | Доказательство / следующий шаг |
|---|---|---|
| TDL-DB-007 | **Snapshot baseline проверен; CI #146/#160 PASS** | Commit `633ed3c` добавил `0005_schema_snapshot_sync.sql` (`SELECT 1` без DDL), `0005_snapshot.json` и запись journal `idx: 5` после `0004_world_invariants`. Snapshot включает уже существующие объекты из migrations 0001–0004: `unit_states`, `unit_health`, `module_states.until_ms/reason`, `deadlines.unit_id`, `lords_account_world_idx`, `accounts_email_key_idx` и defaults email. `pnpm-lock.yaml` добавляет overrides из `pnpm-workspace.yaml` и обновляет Vitest 5.0.1 → 5.0.3. Drizzle snapshot check прошёл в CI #146. |
| TDL-AUD-030 | **Закрыто для полного startup bootstrap; CI #86/#101/#124/#131/#146 PASS** | `bootstrapWorld` удерживает единый database-wide advisory lock на всех четырёх стадиях запуска. Тест `полный bootstrap сериализуется одним замком от ядра до миграций модулей` запускает два bootstrap одновременно и проверяет однократное применение миграции. Mixed-version rolling deploy остаётся отдельной проверкой совместимости схемы и кода. |
| TDL-AUD-035 | **Частично закрыто; CI #101/#124/#131/#146/#160/#189 PASS** | `ALLOWED_ORIGINS` обязателен в production; WebSocket Origin allowlist, базовые HTTP security headers, CSP `base-uri/object-src/frame-ancestors`, `X-Frame-Options` и защита подробной health-диагностики реализованы и покрыты тестами. Осталось подтвердить TLS/reverse-proxy deployment на целевой площадке; `/api/schedule` переведён под операторскую авторизацию; остаётся проверить production TLS/reverse proxy. |
| TDL-TEST-001 | **Исправлена нестабильность теста; CI #101 PASS** | Тест истечения unit override больше не ждёт 60 мс в реальном времени: он задаёт истёкший срок через публичную операцию. Проверка стала детерминированной и не зависит от задержки CI. |
| TDL-AUD-033 | **Исправлено + CI #75 PASS** | PK `commands` теперь `(world_id, actor_id, idempotency_key)`; SELECT/INSERT/UPDATE scoped по actor; rejected-key conflict использует `DO NOTHING`, поэтому конфликтующий commandId не перезаписывает ранее успешный outcome. Есть тесты межигрового ключа и сохранения исходного результата. |
| TDL-AUD-036 | **Открыто, P1 производительность** | PixiJS импортируется статически в `main.tsx` и инициализируется до авторизации. Production main chunk — 735.16 КБ minified / 213.81 КБ gzip; требуется dynamic import после входа в мир и повторный замер. |
| TDL-AUD-037 | **Открыто, P1/P2 производительность** | `CourtScene.redraw` заново строит сетку и пересоздаёт здания при обновлении состояния; нет diff-based reconciliation/render-on-demand. Сначала добавить измерение времени redraw и затем обновлять только изменившиеся объекты. |
| TDL-AUD-038 | **Закрыто; CI #175 PASS** | `court.place/move/remove/road/upgrade` возвращают типизированные локализованные ошибки вместо silent no-op для отклонённых действий. Добавлены словари ru/en и unit/integration regressions; интеграционный тест подтверждает отклонение команды и неизменность stock. Ошибка выхода за границы проверяется как `court.error.out_of_bounds`. |
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
 

## 8. Новая находка: TDL-AUD-042 — публичная операционная диагностика

**Приоритет:** P1 security / information disclosure. **Статус:** **закрыто для текущей рабочей ветки; CI #189 PASS**.

**Доказательство до исправления:** `GET /api/health` возвращал `world`, `net`, `calendarNow`, `worldNow`, `modules` и `stats` без авторизации. Клиентская `Diagnostics` опрашивала этот endpoint каждые 5 секунд; нагрузочный инструмент использовал его же для серверных метрик.

**Исправление в рабочей ветке:**
- публичный `/api/health` ограничен `{ ok, ready }`;
- подробный `/api/ops/health` защищён `x-admin-token`, отказ пишет `admin.denied`, ответы `no-store`;
- `Diagnostics` доступен только при `import.meta.env.DEV` и больше не ожидает приватные поля;
- `tools/load` читает `/api/ops/health` с `ADMIN_TOKEN`, сохраняя возможность прогнать latency/throughput без телеметрии, если токен не передан;
- проверены client callsites (`net.ts`, `World.tsx`, `store.ts`): `/api/schedule` не используется клиентом; ручка требует `x-admin-token`, неверный/пустой токен даёт 403 и журналирует `admin.denied`, успешный ответ — `no-store`.

**Регрессии:** `apps/server/tests/http.test.ts` проверяет точный публичный payload и отсутствие полей `world/net/calendarNow/worldNow/modules/stats`; защищённый endpoint проверяется без токена, с неверным и корректным токеном, включая `no-store` и детальные счётчики.

**Коммиты:** `3ed5116`, `658c5e0`, `0116740`, `7b1010e`, `46a8525`, `1b1e179`, `3aa0334`. **Проверка:** GitHub Actions run #189 (`42525680616`) завершился PASS на `3aa0334e8d0b54ca9dd7135efee16b35fa57099c`: 270 тестов / 31 файл; typecheck, tests, checks, shell syntax, production build, оба dependency audit и Drizzle snapshot check прошли.

**Остаточный риск:** подробная диагностика доступна любому обладателю `ADMIN_TOKEN`; этот секрет нельзя передавать в браузер, URL, логи или публичные скрипты. Для `tools/load` задавать его только через защищённое окружение. Доступ к `/api/schedule` теперь operator-only и покрыт тестом; на deployment проверить, что token не попадает в браузер/логи, а TLS/reverse proxy настроены правильно.


## 9. AUD-034 — end-to-end backup/restore drill

**Статус:** автоматизированный disposable CI drill добавлен; CI pending; finding остаётся P0/open до production-like проверки.

**Что добавлено:**
- `tools/db/ci-restore-drill.sh` запускает собранный TDL на временной source PostgreSQL с production env, ждёт readiness, делает backup штатным скриптом, восстанавливает в отдельную пустую `tdl_restore_*` БД, сравнивает row counts семи ключевых таблиц и повторно запускает приложение на restored DB.
- Workflow устанавливает PostgreSQL 18 client. `backup.sh` проверяет совместимость major версии `pg_dump` с сервером.
- `restore-drill.sh` проверяет не только наличие таблиц в target, но и relation objects/custom schemas; требует world/module-state rows и сверяет source/restored row counts.
- Runbook описывает шаги и чётко отделяет CI evidence от production evidence.

**Граница:** даже успешный CI drill не проверяет production provider backups, внешнее шифрованное хранение, retention/PITR, актуальную production копию, роли/глобальные настройки PostgreSQL, фактическое production RPO/RTO или аварийный доступ к ключам. Для закрытия AUD-034 потребуется операторская production-like процедура с безопасной отдельной restore DB и записью времени/версий/hash/counts.

**Изменения:** `62c1cb2`, `8f871d1`, `d9c3b3f`, `64b8a69`, `7176424`, `342d964`, `b3de90c`. CI run после изменения workflow ожидает завершения.

### AUD-034 — результат CI drill #216

**Проверка:** [GitHub Actions run #218](https://github.com/PandaGarry/tg_bot/actions/runs/42527973800) — **PASS** на кодовом HEAD `acbaa2b3bfe24da0485eb04411d6e50b222a0312`. Полный workflow: 272 теста / 31 файл, typecheck, checks, shell syntax, PostgreSQL 18 client install, production build, restore drill, dependency audits и Drizzle snapshot check.

**Фактический CI результат:** custom dump — 30 401 bytes; SHA-256 `008b7ee4011fde41c735318e81d4d4dbf90214a72852b145f22c7e4b03e3d2b7`; restore — менее 1 second; source/restored row-count vector — `1:12:0:0:0:0:0` (worlds, module_states, accounts, lords, stock, deadlines, reports); TDL после восстановления повторно запустился с `ready=true`. CI backup timer округлился до 0 seconds.

**Статус:** CI-механика backup/restore подтверждена; **AUD-034 остаётся P0/open частично**, потому что disposable CI не является production-like backup drill. До закрытия нужны provider-managed backups/PITR, encrypted off-host copy, retention, восстановление актуальной production-like копии, проверка доступа/ролей и фиксация реальных production RPO/RTO.


### AUD-042 follow-up: `/api/schedule` operator-only

Проверка клиентских callsites не выявила потребителя `/api/schedule`; документация определяет ручку как операторский просмотр календарного плана. Endpoint теперь защищён `x-admin-token`, логирует отказ и устанавливает `cache-control: no-store`. Regression test покрывает 403 без/с неверным токеном и 200 с правильным токеном. **CI #214, #216 и #218 PASS** подтвердили изменение на HEAD `acbaa2b`.


## 10. AUD-035 — production deployment reference runbook

Создан `docs/ops/production-deployment.md` с reference topology Nginx TLS → loopback Node → managed PostgreSQL, примером Nginx WebSocket proxy и systemd unit, production env requirements, exact origin/proxy trust rules, deploy/smoke/rollback checklist.

**Статус:** documentation prepared; production validation not performed. Неизвестны целевой provider, domain/certificate, реальный адрес непосредственного proxy peer, PostgreSQL endpoint и firewall policy. AUD-035 не закрывается документом: нужен deployment на выбранном host, WSS Origin checks, прямой доступ к Node закрыт, health endpoints проверены, restart/shutdown и DB connectivity подтверждены.


### AUD-009 — расширение unit coverage court.move

В `packages/modules/court/tests/commands.test.ts` добавлены проверки успешного переноса постройки, синхронности persisted `court_holder.grid` и client patch, отказа при выходе за границы сетки и при пересечении с дорогой. Вместе с ранее имевшимися not-found/occupied тестами основные ветви `court.move` покрыты. `migrations.test.ts` уже проверяет изоляцию двух миров и конкурентный запуск миграций; `stress.test.ts` проверяет 20 конкурентных акторов. CI #216/#218 PASS: 272 теста / 31 файл. Finding остаётся частично активным до проверки конкурентных court.place/move на одной сетке и end-to-end stock/production.


## 11. AUD-036 — lazy-load Pixi после авторизации

В `apps/client/src/main.tsx` удалены статические импорты `gameApp` и `mountCourtScene`. `initializeGameScene()` делает dynamic import только после авторизации, при наличии `view.me` и после завершения create-lord этапа. Bridge сохраняет последний server state/scene mode, поэтому позднее монтирование не теряет первую сетку.

**Build evidence:** CI #218 production build: initial `index` chunk 470.71 KB minified / 136.09 KB gzip против baseline 735.16 KB / 213.81 KB gzip (примерно -36%); отдельные chunks `application` 5.56 KB и `courtScene` 17.76 KB. Typecheck, 272 теста / 31 файл, production build и полный workflow — PASS.

**Статус:** partial fix. Требуются реальные измерения на iOS/Android WebView: first-load, memory, GPU/FPS, redraw cost и время загрузки lazy chunks. Bundle reduction не доказывает оптимальную производительность сцены.


## 7. AUD-042 — публичная и операторская диагностика (09.11.2026)

**Результат повторной проверки исходников рабочей ветки:** реализация найдена в коде и тестах; техническое закрытие ожидает полного CI на актуальном HEAD.

| Поверхность | Проверенный контракт | Доказательство |
|---|---|---|
| `GET /api/health` | Публичный ответ только `{ ok: true, ready: boolean }`; без world ID, сети, календаря, модулей и статистики; `no-store` | `apps/server/src/http.ts`; HTTP-тест сравнивает весь JSON и запрещённые поля |
| `GET /api/ops/health` | Подробная телеметрия только с корректным `x-admin-token`; без токена/с неверным токеном — 403 | `apps/server/src/http.ts`; `apps/server/tests/http.test.ts` проверяет оба отказа и успешный ответ |
| `/api/kernel/rejections`, `/api/modules`, `/api/schedule` | Операторские endpoints закрыты токеном; расписание не является публичным API | HTTP-тесты проверяют отказ без токена и доступ с токеном |
| Клиентская диагностика | `Diagnostics` показывает локальные диагностические данные и опрашивает только минимальный health endpoint; компонент монтируется только под `import.meta.env.DEV` | `apps/client/src/ui/World.tsx`, `apps/client/src/ui/Diagnostics.tsx` |
| Нагрузочный инструмент | `tools/load/index.ts` обращается к `/api/ops/health`; передаёт `ADMIN_TOKEN` как `x-admin-token`. Без токена нагрузочный прогон продолжает работу без серверной телеметрии | `tools/load/index.ts` |

**CI:** run #218 прошёл на родительском HEAD `acbaa2b`. Текущий HEAD `f41198c89e42abc6ea9f7043f612e6580c22fb97` проверяется run #219 (на момент записи — in progress). Не приписывать run #218 проверку более позднего HEAD.

**Остаток:** после PASS run #219 и CI документационного коммита проверить, что защита остаётся без регрессий. Операторский токен должен задаваться через секреты окружения, быть длинным/случайным и ротироваться; фактическая конфигурация production относится к AUD-035. Служебные ручки не должны попадать в публичную документацию API.


## 8. AUD-035 — production reverse-proxy allowlist hardening (09.11.2026)

### Finding

Production deployment reference terminates TLS at Nginx and forwards traffic to Node. With an empty `TRUSTED_PROXY_IPS`, the server deliberately ignores `X-Forwarded-For`; in this topology all browser requests would be attributed to the proxy's TCP peer address. Login/register IP token buckets would then be shared by all players, creating a trivial cross-user denial-of-service condition and removing per-client IP discrimination.

### Change

- Production config now rejects missing/blank `TRUSTED_PROXY_IPS`.
- Existing exact IPv4/IPv6 parsing, IPv4-mapped IPv6 normalization, duplicate rejection and CIDR rejection remain in force.
- Config tests cover missing, blank and valid exact peer allowlist values.
- `.env.example` and `docs/ops/production-deployment.md` state that values must be the actual immediate TCP peer addresses observed by Node, not the public game-domain address.

### Acceptance boundary

This closes the configuration ambiguity in code, not deployment acceptance. AUD-035 remains partially open until the selected host's actual peer addresses, TLS certificate/redirect, firewall exposure, WSS Origin handling, DB TLS/network policy, restart and graceful shutdown are verified in a deployment drill.


## 12. CI #227/#228 — production proxy config regression and verified correction (09.11.2026)

**Контекст:** после изменения AUD-035 production config стал требовать непустой `TRUSTED_PROXY_IPS`. Первый полный CI после этого изменения (#227, run `42529868521`) остановился в `tools/db/ci-restore-drill.sh`: временный production-mode сервер в disposable CI окружении не получал обязательную переменную. Это была неполнота CI fixture, а не ошибка production runtime logic.

**Исправление:** CI restore drill задаёт `TRUSTED_PROXY_IPS=127.0.0.1` для собственного локального reverse-proxy stand-in. Это тестовая loopback-конфигурация; её нельзя переносить в production, где должны быть указаны фактические immediate TCP peer IP reverse proxy.

**Подтверждение:** GitHub Actions run [#228](https://github.com/PandaGarry/tg_bot/actions/runs/42530034410) завершился **PASS** на HEAD `446c21054b84323566cc51a333f0929f2e6f5251`. Все 16 шагов job завершились успешно: typecheck, тесты, package/i18n/schedule checks, shell syntax, PostgreSQL 18 client, production build, end-to-end backup/restore drill, High/Moderate dependency audits и Drizzle snapshot check.

**Граница:** CI #228 подтверждает код и автоматизированный disposable drill. Он не закрывает AUD-034 production backup/PITR acceptance, AUD-035 реальный TLS/proxy deployment или измерения UI на физических устройствах.

## 13. UI/graphics — приоритетный следующий поток

**Текущее подтверждённое состояние:** PixiJS сцена уже загружается динамически после авторизации и создания лорда. CI #223 показал initial bundle 470.71 KB / 136.09 KB gzip вместо baseline 735.16 KB / 213.81 KB gzip (примерно −36%). Это улучшение загрузки, не доказательство FPS/GPU оптимальности.

**Открытый объём:** текущая сцена остаётся техническим прототипом с векторными заглушками; отсутствует полный оригинальный sprite/atlas pipeline и финальный art pass. HUD и экраны требуют сквозной визуальной инвентаризации, анимационных состояний, адаптивной приёмки и устранения placeholder элементов.

**План:** следовать Фазе 3A в `PROJECT_MASTER.md`: инвентаризация экранов/состояний → единая undead design system → HUD и навигация → оригинальные ассеты/атласы → изометрическая сцена/эффекты → viewport/device acceptance → performance budgets на реальных устройствах. Не копировать ассеты или точные UI решения Viking Rise.

**Статус AUD-036:** partial; lazy-load реализован, real-device measurements open. **Статус AUD-037:** open; incremental redraw/render-on-demand нельзя считать закрытым до профилирования и теста корректности diff updates.


### UI audit follow-up — active HUD and mock-data cleanup

Проверен фактический путь монтирования: `main.tsx → World.tsx → ConceptHud.tsx → CourtChrome.tsx`; единственный активный mockup — `forge`. `Hud.tsx` остаётся отдельным неактивным legacy-поколением.

В активном `CourtChrome.tsx` обнаружены фиктивные сила/VIP/уровень, доходы ресурсов, номер мира, почтовый счётчик, объявления, квесты и seed-сообщения. Эти значения не были серверными данными. Из компонента удалены фиктивные значения и локальная имитация чата/событий/заданий; ресурсы отображаются из `view.stock`, уровень Цитадели — только при наличии `court.townhallLevel`, неподключённые системы показывают локализованные empty states. Добавлен regression test в `apps/client/tests/shell.test.tsx`, проверяющий отсутствие вымышленных значений.

Сцена `CourtScene` строит землю/дороги через Pixi `Graphics`; для восьми типов зданий подключены оригинальные PNG-спрайты из прототипа двора с привязкой к footprint и опорной точке. Для остальных типов сохраняется векторный fallback. Ночные варианты размещены в public, но пока не активированы: `CourtState` не содержит авторитетного времени суток. Каталог спрайтов вынесен в Pixi-независимый `spriteCatalog.ts`; те же PNG теперь используются в карточках активной панели строительства. Стадий уровней и полного atlas pipeline пока нет. Активная тема Forge переведена на obsidian/slate/bone/brass/ember, но screenshot/device visual acceptance ещё не проведена. `ConceptIcon.tsx` остаётся набором SVG-пиктограмм, не production illustration set. Подробный checklist, pipeline и критерии приёмки внесены в `docs/design/ui-overhaul.md`.

Старый `tools/shots/walkthrough.ts` искал селекторы предыдущего поколения (`.hud-lord`, `.hud-build`, `.bcard`, `.place-bar`) и потому не соответствовал активному UI. Сценарий переписан под `.ch-profile`, `.ch-res`, `.ch-action[aria-label="Строительство"]`, `.concept-build-panel` и актуальные вкладки; он снимает кадры двора/строительства/декора на desktop, 390px и 320px, проверяет наличие ключевых HUD-узлов и переполнение верхней строки. Размещение зданий в screenshot smoke flow больше не подтверждается, чтобы сценарий не мутировал тестовый мир.

В `ConceptHud.tsx` обнаружены концептуальные JSX-элементы/компоненты (`ProfileCard`, `ResourceBoard`, `nav`, `quick`), которые не участвуют в текущем return path; текущую фактическую оболочку обеспечивает `CourtChrome`. Не считать их частью активного интерфейса до отдельного включения/удаления.

**Статусы:** UI/ART overhaul — open; cleanup фиктивных HUD-данных — implemented; screenshot walkthrough migration — implemented; first 8 building sprites — implemented; HUD token foundation — partial. CI #254 PASS (HEAD `b799568d9b0de8f3d5fd290572d5eece54ff9f7c`). Ночные варианты, остальные здания/тайлы, atlas pipeline, финальные иллюстрации и device acceptance остаются открытыми. AUD-036 lazy-load — partial; AUD-037 incremental redraw — open. Не заявлять визуальную или производительную готовность до art pass, screenshot/device acceptance и измерений.
