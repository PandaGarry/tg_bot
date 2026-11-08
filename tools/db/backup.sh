#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL must point to the source PostgreSQL database}"

for tool in pg_dump pg_restore psql sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

backup_dir="${TDL_BACKUP_DIR:-$HOME/tdl-backups}"
mkdir -p "$backup_dir"
backup_dir="$(cd "$backup_dir" && pwd -P)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../.." && pwd -P)"
if [[ "$backup_dir/" == "$repo_root/"* ]]; then
  printf 'backup directory must be outside the repository\n' >&2
  exit 1
fi
chmod 700 "$backup_dir"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="tdl-${stamp}-$$.dump"
dump_file="$backup_dir/$base"
meta_file="$dump_file.meta"
checksum_file="$dump_file.sha256"

if [[ -e "$dump_file" || -e "$meta_file" || -e "$checksum_file" ]]; then
  printf 'refusing to overwrite an existing backup\n' >&2
  exit 1
fi

cleanup_failed_backup() {
  local status=$?
  if (( status != 0 )); then
    rm -f -- "$dump_file" "$meta_file" "$checksum_file"
  fi
  return "$status"
}
trap cleanup_failed_backup EXIT

server_version="$(psql --no-password "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "SHOW server_version")"
server_major="${server_version%%.*}"
dump_version="$(pg_dump --version | awk '{print $3}')"
dump_major="${dump_version%%.*}"
if [[ ! "$server_major" =~ ^[0-9]+$ || ! "$dump_major" =~ ^[0-9]+$ || "$dump_major" -lt "$server_major" ]]; then
  printf 'pg_dump major version %s must be at least the PostgreSQL server major version %s\n' \
    "$dump_major" "$server_major" >&2
  exit 1
fi
pg_dump --no-password --format=custom --no-owner --no-acl --file="$dump_file" --dbname="$DATABASE_URL"
pg_restore --no-password --list "$dump_file" >/dev/null

(
  cd "$backup_dir"
  sha256sum "$base" > "$base.sha256"
)

{
  printf 'created_at_utc=%s\n' "$stamp"
  printf 'format=postgres-custom\n'
  printf 'server_version=%s\n' "$server_version"
  pg_dump --version
} > "$meta_file"

chmod 600 "$dump_file" "$meta_file" "$checksum_file"
trap - EXIT
printf 'backup created: %s\n' "$dump_file"
printf 'checksum: %s\n' "$checksum_file"
