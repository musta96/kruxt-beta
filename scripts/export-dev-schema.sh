#!/bin/bash
# Owner-operated only. Sourcing defines functions but performs no export.

readonly DEV_SCHEMA_REF='hgomsmhsybrxjdxbgkjy'
readonly DEV_SCHEMA_HOST='db.hgomsmhsybrxjdxbgkjy.supabase.co'
readonly DEV_SCHEMA_PG_DUMP='/opt/homebrew/opt/postgresql@17/bin/pg_dump'
DEV_SCHEMA_ROOT="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEV_SCHEMA_ROOT

dev_schema_error() {
  printf '%s\n' "Export refused: $1" >&2
  return 1
}

dev_schema_help() {
  printf '%s\n' \
    'Owner-operated DEV schema export (no export by default).' \
    'Usage: bash scripts/export-dev-schema.sh --help' \
    '       bash scripts/export-dev-schema.sh --check \' \
    '         --ca-cert /absolute/approved-ca.pem \' \
    '         --output /absolute/private/dev.restricted.sql' \
    '       bash scripts/export-dev-schema.sh --run \' \
    '         --confirm-dashboard-target hgomsmhsybrxjdxbgkjy \' \
    '         --ca-cert /absolute/approved-ca.pem \' \
    '         --output /absolute/private/dev.restricted.sql' \
    '' \
    '--check validates local inputs only. It makes no connection and writes no dump.' \
    'Optional: --connection direct (default) or session, using pinned DEV endpoints only.' \
    'First independently verify the selected endpoint, database, and username' \
    'in the approved project dashboard. --run also requires an interactive terminal' \
    'and a typed confirmation. Enter the database password only at the native prompt.' \
    'All exported PG* variables are refused. No arbitrary password/host/port overrides.' \
    'Output must be new, outside Git checkouts, in an owned mode-0700 directory.' \
    'This is not an automatic deployment or a restore approval.'
}

dev_schema_require_tty() {
  [[ -t 0 && -t 1 && -t 2 ]] || {
    dev_schema_error 'stdin, stdout, and stderr must be an owner-operated TTY.'
    return 1
  }
  ( : < /dev/tty > /dev/tty ) 2>/dev/null || {
    dev_schema_error 'an accessible controlling terminal is required.'
    return 1
  }
}

dev_schema_require_clean_env() {
  local name
  while IFS= read -r name; do
    if [[ $name == PG* ]]; then
      dev_schema_error 'exported PG* variables are forbidden; use a clean owner terminal.'
      return 1
    fi
  done < <(compgen -e)
}

# No inherited credentials, service files, TLS overrides, or default pgpass.
# Tests replace this function after sourcing; there is no runtime override flag/env.
dev_schema_native() {
  /usr/bin/env -i PATH=/usr/bin:/bin LC_ALL=C HOME=/nonexistent \
    PGPASSFILE=/dev/null PGSSLMODE=verify-full PGSSLROOTCERT="$DEV_SCHEMA_CA" \
    PGCONNECT_TIMEOUT=10 PGOPTIONS='-c default_transaction_read_only=on' \
    "$DEV_SCHEMA_PG_DUMP" "$@" < /dev/tty
}

dev_schema_validate_version_report() {
  local version=$1
  if [[ $version == *$'\n'* ]] ||
    [[ ! $version =~ ^pg_dump\ \(PostgreSQL\)\ 17\.[0-9]+($|[[:space:]]) ]]; then
    dev_schema_error 'native pg_dump must report PostgreSQL major version 17.'
    return 1
  fi
}

dev_schema_require_version() {
  local version
  [[ -x $DEV_SCHEMA_PG_DUMP ]] || {
    dev_schema_error 'the fixed native PostgreSQL 17 pg_dump executable is unavailable.'
    return 1
  }
  version="$(/usr/bin/env -i PATH=/usr/bin:/bin LC_ALL=C HOME=/nonexistent \
    "$DEV_SCHEMA_PG_DUMP" --version </dev/null 2>/dev/null)" || {
    dev_schema_error 'native pg_dump version verification failed.'
    return 1
  }
  dev_schema_validate_version_report "$version"
}

dev_schema_validate_ca() {
  local ca=$1
  [[ $ca == /* && -f $ca && -r $ca ]] || {
    dev_schema_error 'an absolute readable CA certificate file is required.'
    return 1
  }
  /usr/bin/openssl x509 -in "$ca" -noout >/dev/null 2>&1 || {
    dev_schema_error 'the CA file must contain a readable PEM certificate.'
    return 1
  }
  DEV_SCHEMA_CA=$ca
}

dev_schema_validate_output() {
  local requested=$1 parent base mode
  [[ $requested == /* && $requested == *.restricted.sql ]] || {
    dev_schema_error 'output must be absolute and end in .restricted.sql.'
    return 1
  }
  parent="$(cd -P -- "$(dirname -- "$requested")" 2>/dev/null && pwd)" || {
    dev_schema_error 'the output parent must already exist.'
    return 1
  }
  base="$(basename -- "$requested")"
  [[ -O $parent ]] || {
    dev_schema_error 'the output directory must belong to the current owner.'
    return 1
  }
  case "$(/usr/bin/uname -s)" in
    Darwin) mode="$(/usr/bin/stat -f '%Lp' "$parent" 2>/dev/null)" ;;
    Linux) mode="$(/usr/bin/stat -c '%a' "$parent" 2>/dev/null)" ;;
    *) dev_schema_error 'unsupported filesystem permission verification platform.'; return 1 ;;
  esac
  [[ $mode == 700 ]] || {
    dev_schema_error 'the output directory must have mode 0700.'
    return 1
  }
  case "$parent/" in
    "$DEV_SCHEMA_ROOT/"*) dev_schema_error 'output must be outside this checkout.'; return 1 ;;
  esac
  [[ -x /usr/bin/git && -x /bin/link ]] || {
    dev_schema_error 'required local Git and atomic link utilities are unavailable.'
    return 1
  }
  # Ignore inherited Git discovery overrides, without reading their values.
  if /usr/bin/env -i PATH=/usr/bin:/bin HOME=/nonexistent \
    /usr/bin/git -C "$parent" rev-parse --git-dir >/dev/null 2>&1; then
    dev_schema_error 'output must be outside every Git checkout or repository.'
    return 1
  fi
  DEV_SCHEMA_OUTPUT="$parent/$base"
  [[ ! -e $DEV_SCHEMA_OUTPUT && ! -L $DEV_SCHEMA_OUTPUT ]] || {
    dev_schema_error 'output already exists or is a symlink.'
    return 1
  }
}

# Only emit fixed hints. Native stderr may include connection or schema details.
dev_schema_failure_hint() {
  local line
  while IFS= read -r line || [[ -n $line ]]; do
    case "$line" in
      *'password authentication failed'*) printf '%s\n' 'Database password rejected.'; return ;;
      *'no password supplied'*) printf '%s\n' 'No database password was supplied.'; return ;;
      *'certificate verify failed'*|*'does not match host name'*|*'SSL error:'*)
        printf '%s\n' 'TLS verification or negotiation failed.'; return ;;
      *'could not translate host name'*|*'Network is unreachable'*|*'Connection refused'*|*'timeout expired'*)
        printf '%s\n' 'Could not reach the direct database endpoint.'; return ;;
      *'permission denied'*|*'no pg_hba.conf entry'*)
        printf '%s\n' 'Database access or export permission denied.'; return ;;
      *'server version mismatch'*) printf '%s\n' 'PostgreSQL tool/server version mismatch.'; return ;;
      *'lock timeout'*) printf '%s\n' 'Database lock wait timed out.'; return ;;
    esac
  done < "$1"
  printf '%s\n' 'Unclassified pg_dump failure.'
}

# Publish a completed file with link(2), which fails atomically for any existing
# destination (including a directory or dangling symlink). No rename-overwrite.
dev_schema_export() (
  umask 077
  local staging host username
  case "${1:-direct}" in
    direct) host=$DEV_SCHEMA_HOST; username=postgres ;;
    session) host='aws-1-eu-central-1.pooler.supabase.com'; username="postgres.$DEV_SCHEMA_REF" ;;
    *) dev_schema_error 'unsupported connection mode.'; return 1 ;;
  esac
  staging="$(/usr/bin/mktemp -d "$(dirname -- "$DEV_SCHEMA_OUTPUT")/.native-dev-schema.XXXXXXXX")" || {
    dev_schema_error 'could not create private staging directory.'
    return 1
  }
  trap '/bin/rm -rf -- "$staging"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  if ! dev_schema_native \
    --host="$host" --port=5432 --dbname=postgres --username="$username" \
    --password --schema-only --format=plain --quote-all-identifiers \
    --lock-wait-timeout=10s --file="$staging/schema.sql" \
    > /dev/null 2> "$staging/diagnostics"; then
    dev_schema_error "$(dev_schema_failure_hint "$staging/diagnostics") Partial output removed; raw diagnostics withheld."
    return 1
  fi
  [[ -f $staging/schema.sql && ! -L $staging/schema.sql && -s $staging/schema.sql ]] || {
    dev_schema_error 'pg_dump did not produce a nonempty regular schema file.'
    return 1
  }
  /bin/chmod 600 "$staging/schema.sql" || return 1
  /bin/link "$staging/schema.sql" "$DEV_SCHEMA_OUTPUT" 2>/dev/null || {
    dev_schema_error 'atomic publication failed; destination was not overwritten.'
    return 1
  }
  printf '%s\n' 'Restricted schema artifact created (0600). Independent review is still required.'
)

dev_schema_main() {
  local mode='' ca='' output='' confirmed='' answer connection='direct' connection_seen=0
  if [[ $# == 0 || ( $# == 1 && $1 == --help ) ]]; then
    dev_schema_help
    return 0
  fi
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check|--run)
        [[ -z $mode ]] || { dev_schema_error 'choose exactly one operation.'; return 1; }
        mode=$1; shift ;;
      --connection)
        [[ $connection_seen == 0 && $# -ge 2 ]] || {
          dev_schema_error 'connection mode must be supplied exactly once.'; return 1;
        }
        case "$2" in direct|session) connection=$2 ;; *) dev_schema_error 'unsupported connection mode.'; return 1 ;; esac
        connection_seen=1; shift 2 ;;
      --ca-cert|--output|--confirm-dashboard-target)
        [[ $# -ge 2 && $2 != --* ]] || {
          dev_schema_error 'a required option value is missing.'; return 1;
        }
        case "$1" in
          --ca-cert) [[ -z $ca ]] || return 1; ca=$2 ;;
          --output) [[ -z $output ]] || return 1; output=$2 ;;
          --confirm-dashboard-target) [[ -z $confirmed ]] || return 1; confirmed=$2 ;;
        esac
        shift 2 ;;
      *) dev_schema_error 'unsupported option (no host, URL, password, or binary overrides).'; return 1 ;;
    esac
  done
  case "$mode" in
    --run)
      dev_schema_require_tty || return 1
      [[ $confirmed == "$DEV_SCHEMA_REF" ]] || {
        dev_schema_error 'independent dashboard target confirmation is required.'; return 1;
      } ;;
    --check)
      [[ -z $confirmed ]] || {
        dev_schema_error 'dashboard target confirmation is only accepted with --run.'; return 1;
      } ;;
    *) dev_schema_error 'choose --check or --run; nothing exported.'; return 1 ;;
  esac
  [[ -n $ca && -n $output ]] || { dev_schema_error 'CA and output are required.'; return 1; }
  dev_schema_require_clean_env || return 1
  dev_schema_validate_ca "$ca" || return 1
  dev_schema_validate_output "$output" || return 1
  dev_schema_require_version || return 1
  if [[ $mode == --check ]]; then
    printf '%s\n' 'Local export prerequisites passed. No connection or export attempted.'
    return 0
  fi
  if [[ $connection == session ]]; then
    printf '%s\n' 'DEV session pooler: aws-1-eu-central-1.pooler.supabase.com:5432, user postgres.hgomsmhsybrxjdxbgkjy' >&2
  else
    printf '%s\n' 'DEV direct endpoint: db.hgomsmhsybrxjdxbgkjy.supabase.co:5432, user postgres' >&2
  fi
  printf '%s\n' 'After independent dashboard verification, type: EXPORT hgomsmhsybrxjdxbgkjy' >&2
  IFS= read -r answer || return 1
  [[ $answer == "EXPORT $DEV_SCHEMA_REF" ]] || {
    dev_schema_error 'owner confirmation did not match.'; return 1;
  }
  dev_schema_export "$connection"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  set -euo pipefail
  dev_schema_main "$@"
fi
