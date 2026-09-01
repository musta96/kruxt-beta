#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
PRIMARY_MIGRATION="$MIGRATIONS_DIR/00000000000000_baseline.sql"
RLS_FILE="$ROOT_DIR/tests/rls_smoke.sql"
BULK_MEMBER_TEST="$ROOT_DIR/tests/bulk_member_access_mutations.sql"
BULK_MEMBER_MIGRATION="$MIGRATIONS_DIR/202606120001_bulk_member_access_mutations.sql"
CLASS_BOOKING_TEST="$ROOT_DIR/tests/class_booking_contract.sql"
CLASS_BOOKING_MIGRATION="$MIGRATIONS_DIR/202608030002_atomic_class_booking_waitlist.sql"
CLASS_BOOKING_FOLLOWUP_MIGRATION="$MIGRATIONS_DIR/202608030003_harden_class_cancellation_promotion.sql"
CLASS_LIFECYCLE_MIGRATION="$MIGRATIONS_DIR/202608030006_harden_class_lifecycle.sql"
CLASS_LIFECYCLE_CONCURRENCY_TEST="$ROOT_DIR/tests/class_lifecycle_concurrency.sh"
ADMIN_CLASS_SERVICE="$REPO_DIR/apps/admin/src/services/b2b-ops-service.ts"
ADMIN_CLASS_CONSOLE="$REPO_DIR/apps/admin/src/ops-console/OpsConsoleFlow.tsx"
ADMIN_CLASS_SEED="$REPO_DIR/apps/admin/src/services/seed-bzone.ts"
WEB_CLASS_ADMIN_DATA="$REPO_DIR/apps/web/src/lib/admin/data.ts"
WEB_CLASS_CONSOLE="$REPO_DIR/apps/web/src/components/console/ClassesConsole.tsx"

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

if [[ ! -f "$CLASS_BOOKING_FOLLOWUP_MIGRATION" ]]; then
  echo "Missing class booking follow-up migration: $CLASS_BOOKING_FOLLOWUP_MIGRATION"
  exit 1
fi

if [[ ! -f "$CLASS_LIFECYCLE_MIGRATION" ]]; then
  echo "Missing class lifecycle migration: $CLASS_LIFECYCLE_MIGRATION"
  exit 1
fi

if [[ ! -x "$CLASS_LIFECYCLE_CONCURRENCY_TEST" ]]; then
  echo "Missing executable class lifecycle concurrency test: $CLASS_LIFECYCLE_CONCURRENCY_TEST"
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
grep -q "revoke all on function public.book_gym_class(uuid) from public, anon, service_role" "$CLASS_BOOKING_MIGRATION"
grep -q "grant execute on function public.book_gym_class(uuid) to authenticated" "$CLASS_BOOKING_MIGRATION"
grep -q "create or replace function public.cancel_gym_class_booking" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "create or replace function public.leave_class_waitlist" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "create or replace function public.promote_waitlist_member" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "membership_status in ('trial', 'active')" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "for update of cw, gm" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "ignores booking_closes_at" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "create policy class_bookings_update_staff_only" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "create policy class_waitlist_update_staff_only" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "revoke all on function public.cancel_gym_class_booking(uuid) from public, anon, service_role" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "revoke all on function public.leave_class_waitlist(uuid) from public, anon, service_role" "$CLASS_BOOKING_FOLLOWUP_MIGRATION"
grep -q "capacity invariant failed" "$CLASS_BOOKING_TEST"
grep -q "waitlist position invariant failed" "$CLASS_BOOKING_TEST"
grep -q "RLS invariant failed" "$CLASS_BOOKING_TEST"
grep -q "promotion membership invariant failed" "$CLASS_BOOKING_TEST"
grep -q "cancel_gym_class_booking immutable-column invariant failed" "$CLASS_BOOKING_TEST"
grep -q "leave_class_waitlist immutable-column invariant failed" "$CLASS_BOOKING_TEST"
grep -q "create or replace function public.cancel_gym_class" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "create or replace function public.expire_ineligible_class_waitlist" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "create or replace function public.promote_waitlist_member" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "create trigger trg_gym_classes_cascade_cancellation" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "Class has a pending waitlist; promote queued members first" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "Class has available capacity; book it directly" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "v_membership public.gym_memberships%rowtype" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "Class capacity cannot be lower than active bookings" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "Members may cancel after booking_closes_at" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "booking_opens_at := least(now(), new.booking_closes_at)" "$CLASS_LIFECYCLE_MIGRATION"
grep -q "fairness race preserved queue ownership" "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
grep -q "membership suspension race blocked booking and waitlist" "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
grep -q "class cancellation race cascaded" "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
grep -q "capacity race preserved active-booking bound" "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
grep -q "admin schedule defaults remained bookable" "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
grep -q 'rpc("cancel_gym_class"' "$ADMIN_CLASS_SERVICE"
grep -q 'booking_closes_at: bookingClosesAt' "$ADMIN_CLASS_SERVICE"
grep -q 'ADMIN_CLASS_BOOKING_WINDOW_CLOSED' "$ADMIN_CLASS_SERVICE"
grep -q 'bookingClosesAt: startAt.toISOString()' "$ADMIN_CLASS_CONSOLE"
grep -q 'Start date/time must be in the future' "$ADMIN_CLASS_CONSOLE"
grep -q 'booking_closes_at: startsAt' "$ADMIN_CLASS_SEED"
grep -q 'rpc("cancel_gym_class"' "$WEB_CLASS_ADMIN_DATA"
grep -q 'booking_closes_at: bookingClosesAt' "$WEB_CLASS_ADMIN_DATA"
grep -q 'Class booking close time must be in the future' "$WEB_CLASS_ADMIN_DATA"
grep -q 'bookingClosesAt: occurrence.startsAt' "$WEB_CLASS_CONSOLE"
grep -q 'Every class start time must be in the future' "$WEB_CLASS_CONSOLE"

if [[ -n "${KRUXT_TEST_DATABASE_URL:-}" ]]; then
  psql "$KRUXT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BULK_MEMBER_TEST"
  psql "$KRUXT_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$CLASS_BOOKING_TEST"
  "$CLASS_LIFECYCLE_CONCURRENCY_TEST"
fi

echo "[ok] KRUXT DB smoke files are present"
