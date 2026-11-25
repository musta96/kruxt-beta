#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$ROOT_DIR/scripts/deployment_guard.sh"

FUNCTIONS=(
  provider_webhook_ingest
  sync_dispatcher
  rank_recompute_weekly
  privacy_request_processor
  audit_event_ingest
  incident_notifier
  complete-profile-activation
)

for fn in "${FUNCTIONS[@]}"; do
  [ -f "$ROOT_DIR/supabase/functions/$fn/index.ts" ] || fail_deploy "Missing function source: $fn"
done

if [ "$DEPLOY_MODE" != "apply" ]; then
  printf 'Planned DEV function: %s\n' "${FUNCTIONS[@]}"
  echo "No remote command executed. Apply only after database verification."
  exit 0
fi

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying function: $fn"
  supabase functions deploy "$fn" --project-ref "$DEV_PROJECT_REF" --workdir "$ROOT_DIR"
done

echo "Edge functions deployed."
