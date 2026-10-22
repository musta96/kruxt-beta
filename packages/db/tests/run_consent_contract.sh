#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# This runner owns a disposable cluster, or an explicitly supplied empty CI database.
if [[ -z "${KRUXT_CONSENT_TEST_DATABASE_URL:-}" ]]; then
  if [[ -n "${PG_BIN:-}" ]]; then
    export PATH="$PG_BIN:$PATH"
  elif [[ -d /opt/homebrew/opt/postgresql@17/bin ]]; then
    export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
  fi
  command -v initdb >/dev/null
  command -v pg_ctl >/dev/null
  CONSENT_TMP="$(mktemp -d "${TMPDIR:-/tmp}/kruxt-consent.XXXXXX")"
  cleanup() {
    pg_ctl -D "$CONSENT_TMP/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$CONSENT_TMP"
  }
  trap cleanup EXIT
  initdb -D "$CONSENT_TMP/data" -A trust -U postgres --no-locale >/dev/null
  pg_ctl -D "$CONSENT_TMP/data" -l "$CONSENT_TMP/server.log" \
    -o "-k '$CONSENT_TMP' -c listen_addresses='' -c unix_socket_permissions=0700" -w start >/dev/null
  export PGHOST="$CONSENT_TMP" PGUSER=postgres PGDATABASE=postgres
  CONSENT_DB="postgresql:///postgres"
else
  CONSENT_DB="$KRUXT_CONSENT_TEST_DATABASE_URL"
fi
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -q -f "$ROOT_DIR/tests/consent_supabase_bootstrap.sql"
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -q -f "$migration" >/dev/null
done
psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tests/consent_activation_hardening.sql"
psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tests/consent_activation_repairs.sql"
psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tests/privacy_state_authorization.sql"
psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tests/privacy_export_inventory.sql"
psql "$CONSENT_DB" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/tests/privacy_erasure_disablement.sql"
echo '[ok] Full ordered migrations and consent/activation PostgreSQL contracts'
