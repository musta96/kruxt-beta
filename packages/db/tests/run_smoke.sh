#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_FILE="$ROOT_DIR/supabase/migrations/202602190001_krux_beta_foundation.sql"
RLS_FILE="$ROOT_DIR/tests/rls_smoke.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Missing migration file: $MIGRATION_FILE"
  exit 1
fi

if [[ ! -f "$RLS_FILE" ]]; then
  echo "Missing RLS smoke test file: $RLS_FILE"
  exit 1
fi

echo "[ok] KRUXT DB smoke files are present"
