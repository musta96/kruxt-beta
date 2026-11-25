#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${KRUXT_OPERATOR_TEST_DATABASE_URL:-${KRUXT_CONSENT_TEST_DATABASE_URL:-}}" ]]; then
  export KRUXT_OPERATOR_TEST_DATABASE_URL="${KRUXT_OPERATOR_TEST_DATABASE_URL:-$KRUXT_CONSENT_TEST_DATABASE_URL}"
  exec node "${test_dir}/operator-permission-contract.mjs"
fi
for tool in initdb pg_ctl psql node; do
  command -v "$tool" >/dev/null || { echo "Required local tool missing: $tool" >&2; exit 1; }
done
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/kruxt-operator-pg.XXXXXX")"
mkdir "${cluster_dir}/socket"
cleanup() {
  pg_ctl -D "${cluster_dir}/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "${cluster_dir}"
}
trap cleanup EXIT
if ! initdb -D "${cluster_dir}/data" -U postgres -A trust --no-locale >"${cluster_dir}/initdb.log" 2>&1; then
  cat "${cluster_dir}/initdb.log" >&2
  exit 1
fi
pg_ctl -D "${cluster_dir}/data" -o "-F -h '' -k ${cluster_dir}/socket" \
  -l "${cluster_dir}/postgres.log" -w start >/dev/null
export PGHOST="${cluster_dir}/socket" PGUSER=postgres PGDATABASE=postgres PGPORT=5432
node "${test_dir}/operator-permission-contract.mjs"
