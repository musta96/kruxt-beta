#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

FUNCTIONS=(
  provider_webhook_ingest
  sync_dispatcher
  rank_recompute_weekly
  privacy_request_processor
  audit_event_ingest
  incident_notifier
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying function: $fn"
  supabase functions deploy "$fn" --workdir "$ROOT_DIR"
done

echo "Edge functions deployed."
