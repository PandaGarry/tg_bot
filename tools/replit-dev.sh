#!/usr/bin/env bash
set -euo pipefail

# Один локальный адрес используется и сервером, и Replit Preview/workflow.
export NODE_ENV="${NODE_ENV:-development}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export TDL_DB_PORT="${TDL_DB_PORT:-55432}"
export DATABASE_URL="${DATABASE_URL:-postgres://tdl:tdl@127.0.0.1:${TDL_DB_PORT}/tdl}"

# Упрощает первый запуск в Replit без обязательной ручной настройки Secrets.
# Секрет действителен только для локальной dev-сессии; production задаёт свой.
if [[ -z "${SESSION_SECRET:-}" ]]; then
  export SESSION_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  echo "SESSION_SECRET не задан: создан временный секрет для dev-запуска."
fi

pnpm_cmd=(npm exec --yes --package=pnpm@12.6.0 -- pnpm)
mkdir -p .devdb
db_log="/tmp/tdl-replit-db.log"

"${pnpm_cmd[@]}" dev:db >"$db_log" 2>&1 &
db_pid=$!

cleanup() {
  kill "$db_pid" 2>/dev/null || true
  wait "$db_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for _ in $(seq 1 60); do
  if grep -q "Postgres готов" "$db_log"; then
    break
  fi
  if ! kill -0 "$db_pid" 2>/dev/null; then
    cat "$db_log" >&2
    exit 1
  fi
  sleep 1
done

if ! grep -q "Postgres готов" "$db_log"; then
  cat "$db_log" >&2
  echo "Postgres не запустился за 60 секунд" >&2
  exit 1
fi

# Не использовать exec: оболочка должна остаться владельцем фоновой базы и
# остановить её в cleanup, когда dev-сервер завершится.
"${pnpm_cmd[@]}" dev
