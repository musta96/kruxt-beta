#!/usr/bin/env bash
set -euo pipefail
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
# Discard inherited libpq targets and startup options before any native command.
while IFS= read -r pg_variable; do unset "$pg_variable"; done < <(compgen -v PG)
TASK_DIR="$(mktemp -d /tmp/kruxt-workout-social.XXXXXX)"
cleanup() {
  "$NATIVE_BIN/pg_ctl" -D "$TASK_DIR/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "$TASK_DIR"
}
trap cleanup EXIT
"$NATIVE_BIN/initdb" -D "$TASK_DIR/data" --auth=trust --username=postgres --no-locale >/dev/null
"$NATIVE_BIN/pg_ctl" -D "$TASK_DIR/data" -l "$TASK_DIR/postgres.log" -o "-k $TASK_DIR -c listen_addresses=''" -w start >/dev/null
export PATH="$NATIVE_BIN:$PATH" PGHOST="$TASK_DIR" PGUSER=postgres PGDATABASE=postgres PGPORT=5432
node "$TEST_DIR/workout-social-contract.mjs"
