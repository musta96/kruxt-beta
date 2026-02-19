#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$ROOT_DIR/supabase"
SOURCE_MIGRATIONS_DIR="$ROOT_DIR/packages/db/supabase/migrations"
SOURCE_SEED_FILE="$ROOT_DIR/packages/db/supabase/seeds/001_feature_flags.sql"
TARGET_MIGRATIONS_DIR="$SUPABASE_DIR/migrations"
TARGET_SEED_FILE="$SUPABASE_DIR/seed.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

if [ ! -d "$SUPABASE_DIR" ]; then
  echo "Supabase directory not found at: $SUPABASE_DIR"
  exit 1
fi

if [ ! -d "$SOURCE_MIGRATIONS_DIR" ]; then
  echo "Source migrations directory not found: $SOURCE_MIGRATIONS_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_SEED_FILE" ]; then
  echo "Source seed file not found: $SOURCE_SEED_FILE"
  exit 1
fi

rm -rf "$TARGET_MIGRATIONS_DIR"
mkdir -p "$TARGET_MIGRATIONS_DIR"

CREATED_TARGET_MIGRATIONS=()
CREATED_TARGET_SEED=0
cleanup_synced_files() {
  for file in "${CREATED_TARGET_MIGRATIONS[@]}"; do
    rm -f "$file"
  done

  if [ "$CREATED_TARGET_SEED" -eq 1 ]; then
    rm -f "$TARGET_SEED_FILE"
  fi

  if [ -d "$TARGET_MIGRATIONS_DIR" ] && [ -z "$(ls -A "$TARGET_MIGRATIONS_DIR")" ]; then
    rmdir "$TARGET_MIGRATIONS_DIR"
  fi
}
trap cleanup_synced_files EXIT

echo "Syncing migrations into $TARGET_MIGRATIONS_DIR"
copied=0
shopt -s nullglob
for migration in "$SOURCE_MIGRATIONS_DIR"/*.sql; do
  target_path="$TARGET_MIGRATIONS_DIR/$(basename "$migration")"
  cp "$migration" "$target_path"
  CREATED_TARGET_MIGRATIONS+=("$target_path")
  copied=$((copied + 1))
done
shopt -u nullglob

if [ "$copied" -eq 0 ]; then
  echo "No SQL migrations found in $SOURCE_MIGRATIONS_DIR"
  exit 1
fi

cp "$SOURCE_SEED_FILE" "$TARGET_SEED_FILE"
CREATED_TARGET_SEED=1
echo "Seed synced to $TARGET_SEED_FILE"

echo "Pushing migrations + seed to linked Supabase project"
DB_PUSH_ARGS=(--linked --include-all --include-seed --yes --workdir "$ROOT_DIR")

if [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
  DB_PUSH_ARGS+=(--password "$SUPABASE_DB_PASSWORD")
fi

supabase db push "${DB_PUSH_ARGS[@]}"

echo "Done. KRUXT foundation schema + seed are applied."
