# KRUXT Edge Functions

- `provider_webhook_ingest`: stores provider callbacks with idempotency fields, provider flag gating, and sync job fan-out for Apple/Garmin
- `sync_dispatcher`: claims queued sync jobs, processes webhook-linked imports, persists cursor state, and handles retry/backoff safely
- `rank_recompute_weekly`: recomputes active boards (weekly by default) and returns per-board failure diagnostics
- `privacy_request_processor`: triages submitted requests, marks overdue SLA breaches, and generates signed privacy export packages
- `audit_event_ingest`: writes append-only audit records

All functions are intentionally thin entrypoints and should delegate heavy logic to SQL/RPC.
