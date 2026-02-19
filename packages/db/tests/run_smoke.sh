#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
PRIMARY_MIGRATION="$MIGRATIONS_DIR/202602190001_krux_beta_foundation_part1.sql"
RLS_FILE="$ROOT_DIR/tests/rls_smoke.sql"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Missing migrations directory: $MIGRATIONS_DIR"
  exit 1
fi

if ! compgen -G "$MIGRATIONS_DIR/*.sql" > /dev/null; then
  echo "No SQL migrations found in: $MIGRATIONS_DIR"
  exit 1
fi

if [[ ! -f "$PRIMARY_MIGRATION" ]]; then
  echo "Missing primary migration file: $PRIMARY_MIGRATION"
  exit 1
fi

if [[ ! -f "$RLS_FILE" ]]; then
  echo "Missing RLS smoke test file: $RLS_FILE"
  exit 1
fi

echo "[ok] KRUXT DB smoke files are present"
