#!/usr/bin/env bash
set -euo pipefail

if ! command -v initdb >/dev/null 2>&1 || ! command -v pg_ctl >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "[skip] PostgreSQL tools unavailable for mobile onboarding contract test"
  exit 0
fi

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_dir="$(cd "${test_dir}/.." && pwd)"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/kruxt-onboarding-pg.XXXXXX")"
socket_dir="${cluster_dir}/socket"
port="$((55432 + ($$ % 1000)))"
mkdir -p "${socket_dir}"

cleanup() {
  pg_ctl -D "${cluster_dir}/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "${cluster_dir}"
}
trap cleanup EXIT

if ! initdb -D "${cluster_dir}/data" -U postgres -A trust --no-locale >"${cluster_dir}/initdb.log" 2>&1; then
  if grep -q "could not create shared memory segment" "${cluster_dir}/initdb.log"; then
    echo "[skip] PostgreSQL shared memory is unavailable for mobile onboarding contract test"
    exit 0
  fi

  cat "${cluster_dir}/initdb.log" >&2
  exit 1
fi
pg_ctl \
  -D "${cluster_dir}/data" \
  -o "-F -p ${port} -k ${socket_dir}" \
  -l "${cluster_dir}/postgres.log" \
  -w start >/dev/null

psql \
  -v ON_ERROR_STOP=1 \
  -h "${socket_dir}" \
  -p "${port}" \
  -U postgres \
  -d postgres \
  -f "${test_dir}/mobile_onboarding_contract_fixture.sql" \
  -f "${package_dir}/supabase/migrations/202608030005_mobile_onboarding_contract.sql" \
  -f "${test_dir}/mobile_onboarding_contract_assertions.sql"
