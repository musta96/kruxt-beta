# KRUXT Edge Functions

- `provider_webhook_ingest`: stores provider callbacks with idempotency fields
- `sync_dispatcher`: advances queued sync jobs for device integrations
- `rank_recompute_weekly`: calls leaderboard rebuild RPC for active boards
- `privacy_request_processor`: triages submitted privacy requests
- `audit_event_ingest`: writes append-only audit records

All functions are intentionally thin entrypoints and should delegate heavy logic to SQL/RPC.
