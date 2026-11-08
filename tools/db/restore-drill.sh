#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DATABASE_URL:?Set DATABASE_URL to the source database for the safety comparison}"
: "${TDL_BACKUP_FILE:?Set TDL_BACKUP_FILE to the verified custom-format dump}"
: "${TDL_RESTORE_DATABASE_URL:?Set TDL_RESTORE_DATABASE_URL to a fresh isolated database}"
if [[ "${TDL_RESTORE_CONFIRM:-}" != "RESTORE_TO_ISOLATED_DATABASE" ]]; then
  printf 'set TDL_RESTORE_CONFIRM=RESTORE_TO_ISOLATED_DATABASE to confirm an isolated restore\n' >&2
  exit 1
fi

for tool in psql pg_restore sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

if [[ ! -f "$TDL_BACKUP_FILE" ]]; then
  printf 'backup file not found\n' >&2
  exit 1
fi
checksum_file="$TDL_BACKUP_FILE.sha256"
if [[ ! -f "$checksum_file" ]]; then
  printf 'backup checksum file not found\n' >&2
  exit 1
fi
(
  cd "$(dirname "$TDL_BACKUP_FILE")"
  sha256sum -c "$(basename "$checksum_file")"
)

source_url="${DATABASE_URL%%\?*}"
target_url="${TDL_RESTORE_DATABASE_URL%%\?*}"
source_db="${source_url##*/}"
target_db="${target_url##*/}"
if [[ -z "$target_db" || "$target_db" == "$source_db" ]]; then
  printf 'restore target must differ from the source database\n' >&2
  exit 1
fi
if [[ ! "$target_db" =~ ^tdl_restore_[A-Za-z0-9_]+$ ]]; then
  printf 'restore target database name must start with tdl_restore_\n' >&2
  exit 1
fi

pg_restore --no-password --list "$TDL_BACKUP_FILE" >/dev/null

table_count="$(psql --no-password "$TDL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")"
if [[ "$table_count" != "0" ]]; then
  printf 'restore target is not empty; refusing to overwrite existing objects\n' >&2
  exit 1
fi

pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-acl \
  --dbname="$TDL_RESTORE_DATABASE_URL" "$TDL_BACKUP_FILE"

schema_ok="$(psql "$TDL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT (to_regclass('public.worlds') IS NOT NULL AND to_regclass('public.module_states') IS NOT NULL)::int")"
if [[ "$schema_ok" != "1" ]]; then
  printf 'restore smoke check failed: required core tables are missing\n' >&2
  exit 1
fi

world_count="$(psql "$TDL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT count(*) FROM public.worlds")"
module_state_count="$(psql "$TDL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT count(*) FROM public.module_states")"
if [[ "$world_count" -lt 1 ]]; then
  printf 'restore smoke check failed: no world rows were restored\n' >&2
  exit 1
fi

printf 'restore drill passed: worlds=%s module_states=%s target=%s\n' \
  "$world_count" "$module_state_count" "$target_db"
