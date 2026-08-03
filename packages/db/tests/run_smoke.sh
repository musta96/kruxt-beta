#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
PRIMARY_MIGRATION="$MIGRATIONS_DIR/00000000000000_baseline.sql"
RLS_FILE="$ROOT_DIR/tests/rls_smoke.sql"
BULK_MEMBER_TEST="$ROOT_DIR/tests/bulk_member_access_mutations.sql"
BULK_MEMBER_MIGRATION="$MIGRATIONS_DIR/202606120001_bulk_member_access_mutations.sql"
CLASS_BOOKING_TEST="$ROOT_DIR/tests/class_booking_contract.sql"
CLASS_BOOKING_MIGRATION="$MIGRATIONS_DIR/202608030002_atomic_class_booking_waitlist.sql"

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

if [[ ! -f "$CLASS_BOOKING_TEST" ]]; then
  echo "Missing class booking contract test file: $CLASS_BOOKING_TEST"
  exit 1
fi

if [[ ! -f "$CLASS_BOOKING_MIGRATION" ]]; then
  echo "Missing class booking contract migration: $CLASS_BOOKING_MIGRATION"
  exit 1
fi

grep -q "bulk_update_gym_memberships" "$BULK_MEMBER_MIGRATION"
grep -q "membership_access_fields_unchanged" "$BULK_MEMBER_MIGRATION"
grep -q "create policy gym_memberships_update_self_or_staff" "$BULK_MEMBER_MIGRATION"
grep -q "partial failure contract failed" "$BULK_MEMBER_TEST"
grep -q "create or replace function public.book_gym_class" "$CLASS_BOOKING_MIGRATION"
grep -q "create or replace function public.join_waitlist" "$CLASS_BOOKING_MIGRATION"
grep -q "create or replace function public.promote_waitlist_member" "$CLASS_BOOKING_MIGRATION"
grep -q "for update" "$CLASS_BOOKING_MIGRATION"
grep -q "uq_class_waitlist_pending_position" "$CLASS_BOOKING_MIGRATION"
grep -q "trg_class_bookings_enforce_capacity" "$CLASS_BOOKING_MIGRATION"
grep -q "membership_status in ('trial', 'active')" "$CLASS_BOOKING_MIGRATION"
grep -q "create policy class_bookings_insert_staff_only" "$CLASS_BOOKING_MIGRATION"
grep -q "create policy class_waitlist_insert_staff_only" "$CLASS_BOOKING_MIGRATION"
grep -q "user_id = auth.uid() and status = 'cancelled'" "$CLASS_BOOKING_MIGRATION"
grep -q "revoke all on function public.book_gym_class(uuid) from public, anon, service_role" "$CLASS_BOOKING_MIGRATION"
grep -q "grant execute on function public.book_gym_class(uuid) to authenticated" "$CLASS_BOOKING_MIGRATION"
grep -q "capacity invariant failed" "$CLASS_BOOKING_TEST"
grep -q "waitlist position invariant failed" "$CLASS_BOOKING_TEST"
grep -q "RLS invariant failed" "$CLASS_BOOKING_TEST"

if [[ -n "${KRUXT_TEST_DATABASE_URL:-}" ]]; then
  psql "$KRUXT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BULK_MEMBER_TEST"
  psql "$KRUXT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$CLASS_BOOKING_TEST"
fi

echo "[ok] KRUXT DB smoke files are present"
