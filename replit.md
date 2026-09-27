# The Dead Lords / Мёртвые лорды

TypeScript-монорепозиторий игры: один серверный процесс отдаёт API, WebSocket и клиент.

## Запуск в Replit

- Основной workflow: `TDL dev server`.
- `bash tools/replit-dev.sh` запускает встроенный PostgreSQL и сервер.
- Preview использует порт `3000`, внешний порт — `80`.
- Локальная dev-база хранится в `.devdb/` и не является частью игрового кода.
- `SESSION_SECRET` берётся из защищённых настроек Replit.

## Проверки

- `pnpm typecheck`
- `pnpm check`
- `pnpm test`
- `pnpm build`

Для ручной работы с Git:

```text
git status
git pull --ff-only
git add .
git commit
git push
```