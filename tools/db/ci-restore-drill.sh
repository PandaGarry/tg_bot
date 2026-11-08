#!/usr/bin/env bash
# End-to-end CI drill: boot a real TDL world, dump PostgreSQL, restore to a
# separate empty database, compare persisted rows, then boot the restored world.
set -euo pipefail
umask 077

: "${TDL_DRILL_ADMIN_URL:?Set an admin URL for the disposable CI PostgreSQL cluster}"

for tool in psql pg_dump pg_restore sha256sum curl; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

source_db="${TDL_DRILL_SOURCE_DB:-tdl_backup_source}"
target_db="tdl_restore_ci_$$"
for db in "$source_db" "$target_db"; do
  if [[ ! "$db" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; then
    printf 'unsafe drill database name: %s\n' "$db" >&2
    exit 1
  fi
done
if [[ "$source_db" == "$target_db" ]]; then
  printf 'source and restore databases must differ\n' >&2
  exit 1
fi

admin_url="${TDL_DRILL_ADMIN_URL%%\?*}"
base_url="${admin_url%/*}"
source_url="$base_url/$source_db"
target_url="$base_url/$target_db"
backup_dir="$(mktemp -d "${TMPDIR:-/tmp}/tdl-restore-drill.XXXXXX")"
server_pid=""
server_log="$backup_dir/server.log"
restored_log="$backup_dir/restored-server.log"

stop_server() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill -TERM "$server_pid" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$server_pid" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  server_pid=""
}

cleanup() {
  local status=$?
  stop_server
  # Both databases are created exclusively for this disposable CI drill.
  psql --no-password "$admin_url" -X -v ON_ERROR_STOP=1 -qAtc \
    "DROP DATABASE IF EXISTS \"$target_db\" WITH (FORCE);" >/dev/null 2>&1 || true
  psql --no-password "$admin_url" -X -v ON_ERROR_STOP=1 -qAtc \
    "DROP DATABASE IF EXISTS \"$source_db\" WITH (FORCE);" >/dev/null 2>&1 || true
  rm -rf -- "$backup_dir"
  return "$status"
}
trap cleanup EXIT

psql --no-password "$admin_url" -X -v ON_ERROR_STOP=1 -qAtc \
  "CREATE DATABASE \"$source_db\";"
psql --no-password "$admin_url" -X -v ON_ERROR_STOP=1 -qAtc \
  "CREATE DATABASE \"$target_db\";"

start_world() {
  local database_url="$1" port="$2" log_file="$3"
  DATABASE_URL="$database_url" NODE_ENV=test SESSION_SECRET=ci-restore-drill-session-secret \
    PORT="$port" HOST=127.0.0.1 WORLD_ID=restore-drill WORLD_NAME="Restore drill" \
    WORLD_SEED=1541 WORLD_SIZE=64 REGISTRATION_OPEN=0 \
    node apps/server/dist/index.mjs >"$log_file" 2>&1 &
  server_pid=$!
  local ready=0
  for _ in $(seq 1 90); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
      cat "$log_file" >&2
      printf 'TDL server exited before readiness\n' >&2
      return 1
    fi
    if curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:$port/api/health" 2>/dev/null | grep -q '"ready":true'; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    cat "$log_file" >&2
    printf 'TDL server did not become ready within 90 seconds\n' >&2
    return 1
  fi
}

count_snapshot() {
  psql --no-password "$1" -X -v ON_ERROR_STOP=1 -Atqc "
    SELECT
      (SELECT count(*) FROM public.worlds) || ':' ||
      (SELECT count(*) FROM public.module_states) || ':' ||
      (SELECT count(*) FROM public.accounts) || ':' ||
      (SELECT count(*) FROM public.lords) || ':' ||
      (SELECT count(*) FROM public.stock) || ':' ||
      (SELECT count(*) FROM public.deadlines) || ':' ||
      (SELECT count(*) FROM public.reports);
  "
}

printf 'Starting source world against disposable PostgreSQL...\n'
start_world "$source_url" 3417 "$server_log"
stop_server

source_snapshot="$(count_snapshot "$source_url")"
IFS=: read -r worlds module_states _ <<<"$source_snapshot"
if [[ "$worlds" -lt 1 || "$module_states" -lt 1 ]]; then
  printf 'source world did not persist expected world/module state rows: %s\n' "$source_snapshot" >&2
  exit 1
fi

backup_started="$(date +%s)"
backup_output="$(DATABASE_URL="$source_url" TDL_BACKUP_DIR="$backup_dir" bash tools/db/backup.sh)"
backup_seconds=$(( $(date +%s) - backup_started ))
printf '%s\n' "$backup_output"
dump_file="$(sed -n 's/^backup created: //p' <<<"$backup_output")"
if [[ -z "$dump_file" || ! -f "$dump_file" ]]; then
  printf 'backup script did not produce a dump file\n' >&2
  exit 1
fi
backup_hash="$(sha256sum "$dump_file" | awk '{print $1}')"
backup_bytes="$(wc -c < "$dump_file" | tr -d ' ')"

restore_started="$(date +%s)"
DATABASE_URL="$source_url" TDL_BACKUP_FILE="$dump_file" \
  TDL_RESTORE_DATABASE_URL="$target_url" TDL_RESTORE_CONFIRM=RESTORE_TO_ISOLATED_DATABASE \
  bash tools/db/restore-drill.sh
restore_seconds=$(( $(date +%s) - restore_started ))

restored_snapshot="$(count_snapshot "$target_url")"
if [[ "$source_snapshot" != "$restored_snapshot" ]]; then
  printf 'restored row counts differ from source: source=%s restored=%s\n' \
    "$source_snapshot" "$restored_snapshot" >&2
  exit 1
fi

printf 'Starting TDL against restored database...\n'
start_world "$target_url" 3418 "$restored_log"
stop_server

printf 'CI restore drill PASS: sha256=%s bytes=%s backup_seconds=%s restore_seconds=%s rows=%s\n' \
  "$backup_hash" "$backup_bytes" "$backup_seconds" "$restore_seconds" "$restored_snapshot"
printf 'Note: timings are CI drill measurements, not production RPO/RTO.\n'
