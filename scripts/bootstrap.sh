#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/deployment_guard.sh"

if [ "$DEPLOY_MODE" = "check" ]; then
  echo "Local migration preflight passed. No remote command executed."
  exit 0
fi

LINK_FILE="$ROOT_DIR/supabase/.temp/project-ref"
[ -f "$LINK_FILE" ] || fail_deploy "Link the reviewed checkout to the canonical DEV project first."
[ "$(tr -d '\r\n' < "$LINK_FILE")" = "$DEV_PROJECT_REF" ] || fail_deploy "Linked project is not canonical DEV."

# Do not include seeds or modify tracked migration/seed files.
DB_PUSH_ARGS=(--linked --include-all --workdir "$ROOT_DIR")
if [ "$DEPLOY_MODE" = "dry-run" ]; then
  DB_PUSH_ARGS+=(--dry-run)
else
  DB_PUSH_ARGS+=(--yes)
fi
supabase db push "${DB_PUSH_ARGS[@]}"
