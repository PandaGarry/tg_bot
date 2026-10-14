# The Dead Lords / Мёртвые лорды

Браузерная стратегия (жанр RoK), зомби-лорд замка. Коротко: **TDL**.

Документация: [docs/README.md](docs/README.md) — карта, статусы, процесс работы.
Состояние: [docs/STATUS.md](docs/STATUS.md). Решения: [docs/DECISIONS.md](docs/DECISIONS.md).
Старые документы: [docs/archive/game/](docs/archive/game/) (разбираются по темам).

## Разработка

```bash
cp .env.example .env      # адрес базы, порт, секрет сессий
pnpm dev:db               # местный Postgres на 55432 (первый раз — инициализация)
pnpm dev                  # мир: API, сокет и клиент через Vite на PORT из .env
pnpm db:reset             # снести схему базы разработки и поднять мир заново
```

Проверки: `pnpm typecheck`, `pnpm test`, `pnpm check`, `pnpm build`.
`pnpm check` вместе с прочим считает календарь сборки за три года: полосы, пробелы, покрытие пор года.
Печать расписания: `pnpm schedule --days 90 [--from 2026-12-01] [--tz 180]` — окна и состояния единиц по часам мира.
Снимки интерфейса: `pnpm shots [--only style-08]`, страница макета — `pnpm shots --page hud/main-screen.html --size 1376x768 --scale 1.5 --file docs/game/ui/hud/main-screen.jpg` (состояния: `?zoom=near`, `?mode=build`, `?annotate=1`, `?quests=1`), нарезка иконок и спрайтов зданий из AI-листа по цветовому ключу — `pnpm icons hud/icons/sheet-a.png --prefix a` (для зданий `--merge-gap -1`), прототип двора-конструктора — `docs/game/ui/court/index.html` (снимки `pnpm shots --page "court/index.html?state=built"`), контактный лист — `pnpm shots --sheet concepts/<каталог>` — Chromium из npm-пакета снимает макеты и страницы концептов
из `docs/game/ui/` в `docs/game/ui/shots/` (для просмотра файлами, без живого предпросмотра).
Тесты идут на настоящем Postgres: каждый пакет сносит схему своей базы
`tdl_test_<пакет>` и не трогает рабочую. Адрес можно задать явно —
`TDL_TEST_DB_URL` (тогда имя базы обязано содержать `test`).

Файлы `.env` и `.devdb/` в репозиторий не попадают: после переноса окружения
их нужно создать заново (`cp .env.example .env`, `pnpm dev:db`).

Состояние работы и что смотреть в предпросмотре — [STATUS.md](STATUS.md).
