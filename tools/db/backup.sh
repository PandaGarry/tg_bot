#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL must point to the source PostgreSQL database}"

for tool in pg_dump pg_restore sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

backup_dir="${TDL_BACKUP_DIR:-$HOME/tdl-backups}"
mkdir -p "$backup_dir"
backup_dir="$(cd "$backup_dir" && pwd -P)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" && "$backup_dir/" == "$repo_root/"* ]]; then
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

pg_dump --format=custom --no-owner --no-acl --file="$dump_file" --dbname="$DATABASE_URL"
pg_restore --list "$dump_file" >/dev/null

(
  cd "$backup_dir"
  sha256sum "$base" > "$base.sha256"
)

{
  printf 'created_at_utc=%s\n' "$stamp"
  printf 'format=postgres-custom\n'
  pg_dump --version
} > "$meta_file"

chmod 600 "$dump_file" "$meta_file" "$checksum_file"
printf 'backup created: %s\n' "$dump_file"
printf 'checksum: %s\n' "$checksum_file"
