#!/usr/bin/env bash
set -euo pipefail
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for tool in initdb pg_ctl psql node; do
  command -v "$tool" >/dev/null || { echo "Required local tool missing: $tool" >&2; exit 1; }
done
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/kruxt-role-profile-pg.XXXXXX")"
mkdir "${cluster_dir}/socket"
cleanup() {
  pg_ctl -D "${cluster_dir}/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "${cluster_dir}"
}
trap cleanup EXIT
initdb -D "${cluster_dir}/data" -U postgres -A trust --no-locale >"${cluster_dir}/initdb.log" 2>&1
pg_ctl -D "${cluster_dir}/data" -o "-F -h '' -k ${cluster_dir}/socket" -l "${cluster_dir}/postgres.log" -w start >/dev/null
export PGHOST="${cluster_dir}/socket" PGUSER=postgres PGDATABASE=postgres PGPORT=5432
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
node "${test_dir}/operator-role-profiles-contract.mjs"
