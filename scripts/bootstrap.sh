#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_FILE="$ROOT_DIR/packages/db/supabase/migrations/202602190001_krux_beta_foundation.sql"
SEED_FILE="$ROOT_DIR/packages/db/supabase/seeds/001_feature_flags.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "Applying migration: $MIGRATION_FILE"
supabase db query --file "$MIGRATION_FILE"

echo "Applying seed: $SEED_FILE"
supabase db query --file "$SEED_FILE"

echo "Done. KRUXT foundation schema is applied."
