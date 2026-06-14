#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
PRIMARY_MIGRATION="$MIGRATIONS_DIR/00000000000000_baseline.sql"
RLS_FILE="$ROOT_DIR/tests/rls_smoke.sql"
BULK_MEMBER_TEST="$ROOT_DIR/tests/bulk_member_access_mutations.sql"
BULK_MEMBER_MIGRATION="$MIGRATIONS_DIR/202606120001_bulk_member_access_mutations.sql"

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

if [[ ! -f "$BULK_MEMBER_TEST" ]]; then
  echo "Missing bulk member mutation test file: $BULK_MEMBER_TEST"
  exit 1
fi

if [[ ! -f "$BULK_MEMBER_MIGRATION" ]]; then
  echo "Missing bulk member mutation migration: $BULK_MEMBER_MIGRATION"
  exit 1
fi

grep -q "bulk_update_gym_memberships" "$BULK_MEMBER_MIGRATION"
grep -q "membership_access_fields_unchanged" "$BULK_MEMBER_MIGRATION"
grep -q "create policy gym_memberships_update_self_or_staff" "$BULK_MEMBER_MIGRATION"
grep -q "partial failure contract failed" "$BULK_MEMBER_TEST"

if [[ -n "${KRUXT_TEST_DATABASE_URL:-}" ]]; then
  psql "$KRUXT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BULK_MEMBER_TEST"
fi

echo "[ok] KRUXT DB smoke files are present"
