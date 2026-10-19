#!/usr/bin/env bash
set -euo pipefail

# This initializes an EMPTY disposable database, never a hosted application DB.
: "${KRUXT_TEST_DATABASE_URL:?Set KRUXT_TEST_DATABASE_URL to an empty disposable database}"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
MIGRATIONS_DIR="$TEST_DIR/../supabase/migrations"
PSQL=(psql "$KRUXT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1)
if [[ "$("${PSQL[@]}" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")" != "0" ]]; then
  echo "Refusing to initialize a nonempty database" >&2
  exit 1
fi
if [[ -n "${KRUXT_CLASS_INTEGRATION_ROOT:-}" ]]; then
  # Read the other lanes' migrations without editing their integration checkout.
  INTEGRATION_DB="$KRUXT_CLASS_INTEGRATION_ROOT/packages/db"
  "${PSQL[@]}" -f "$INTEGRATION_DB/tests/consent_supabase_bootstrap.sql" >/dev/null
  while IFS= read -r migration; do
    case "$migration" in
      202608030002_atomic_class_booking_waitlist.sql|202608030003_harden_class_cancellation_promotion.sql|202608030006_harden_class_lifecycle.sql)
        if [[ "$migration" == 202608030002_atomic_class_booking_waitlist.sql ]]; then
          "${PSQL[@]}" -f "$TEST_DIR/class_upgrade_fixture.sql" >/dev/null
        fi
        "${PSQL[@]}" --single-transaction -f "$MIGRATIONS_DIR/$migration" >/dev/null
        ;;
      *)
        "${PSQL[@]}" -f "$INTEGRATION_DB/supabase/migrations/$migration" >/dev/null
        ;;
    esac
  done < <(
    {
      find "$INTEGRATION_DB/supabase/migrations" -name '*.sql' -exec basename {} \;
      printf '%s\n' 202608030002_atomic_class_booking_waitlist.sql 202608030003_harden_class_cancellation_promotion.sql 202608030006_harden_class_lifecycle.sql
    } | sort -u
  )
else
  "${PSQL[@]}" -f "$TEST_DIR/class_ci_bootstrap.sql" >/dev/null
  # The historic squash adds enum labels and immediately uses them, requiring
  # autocommit. Each pending class migration is tested as a deployment transaction.
  "${PSQL[@]}" -f "$MIGRATIONS_DIR/00000000000000_baseline.sql" >/dev/null
  "${PSQL[@]}" -f "$TEST_DIR/class_upgrade_fixture.sql" >/dev/null
  for migration in 202608030002_atomic_class_booking_waitlist 202608030003_harden_class_cancellation_promotion 202608030006_harden_class_lifecycle; do
    "${PSQL[@]}" --single-transaction -f "$MIGRATIONS_DIR/$migration.sql" >/dev/null
  done
fi
"${PSQL[@]}" -f "$TEST_DIR/class_upgrade_contract.sql"
"${PSQL[@]}" -f "$TEST_DIR/class_booking_contract.sql"
"${PSQL[@]}" -f "$TEST_DIR/class_staff_lifecycle_contract.sql"
bash "$TEST_DIR/class_lifecycle_concurrency.sh"
# Validation runs in its own transaction, after the deployment DDL is committed.
"${PSQL[@]}" -c "set lock_timeout = '5s'; alter table public.gym_classes validate constraint gym_classes_scheduled_booking_window_check;"
echo "[ok] class PostgreSQL contracts and concurrency"
