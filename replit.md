# The Dead Lords / Мёртвые лорды

TypeScript-монорепозиторий игры: один серверный процесс отдаёт API, WebSocket и клиент.

## Запуск в Replit

- Нажмите **Run**: workflow `Project` запускает `bash tools/replit-dev.sh`.
- Скрипт поднимает локальный PostgreSQL для разработки и затем сервер игры.
- Preview обслуживается на локальном порту `3000` и публикуется через внешний порт `80`.
- Если `SESSION_SECRET` не задан в Secrets, для dev-запуска создаётся случайный временный секрет. Для production задайте свой секрет отдельно.
- Данные локальной dev-базы хранятся в `.devdb/` и не попадают в Git.

## Проверки

- `pnpm typecheck`
- `pnpm check`
- `pnpm test`
- `pnpm build`
