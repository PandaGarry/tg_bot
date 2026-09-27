#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV="${NODE_ENV:-development}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export TDL_DB_PORT="${TDL_DB_PORT:-55432}"
export DATABASE_URL="${DATABASE_URL:-postgres://tdl:tdl@127.0.0.1:${TDL_DB_PORT}/tdl}"

pnpm_cmd=(npm exec --yes --package=pnpm@12.6.0 -- pnpm)
mkdir -p .devdb
db_log="/tmp/tdl-replit-db.log"

"${pnpm_cmd[@]}" dev:db >"$db_log" 2>&1 &
db_pid=$!

cleanup() {
  kill "$db_pid" 2>/dev/null || true
  wait "$db_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

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

exec "${pnpm_cmd[@]}" dev