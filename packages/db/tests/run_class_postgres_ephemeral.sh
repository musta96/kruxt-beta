#!/usr/bin/env bash
set -euo pipefail
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
TASK_DIR="$(mktemp -d /tmp/kruxt-class-db.XXXXXX)"
cleanup() {
  "$PG_BIN/pg_ctl" -D "$TASK_DIR/data" -m immediate stop >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$TASK_DIR/data" --auth=trust --username=postgres >/dev/null
# A private socket directory permits concurrent test runs without shared ports.
"$PG_BIN/pg_ctl" -D "$TASK_DIR/data" -l "$TASK_DIR/postgres.log" -o "-k $TASK_DIR -c listen_addresses=''" -w start >/dev/null
export PATH="$PG_BIN:$PATH"
export KRUXT_TEST_DATABASE_URL="postgresql://postgres@/postgres?host=$TASK_DIR"
bash "$TEST_DIR/run_class_postgres.sh"
