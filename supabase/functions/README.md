# KRUXT Edge Functions

- `provider_webhook_ingest`: stores provider callbacks with idempotency fields, provider flag gating, and sync job fan-out for Apple/Garmin
- `sync_dispatcher`: claims queued sync jobs, processes webhook-linked imports, persists cursor state, and handles retry/backoff safely
- `rank_recompute_weekly`: recomputes active boards (weekly by default) and returns per-board failure diagnostics
- `privacy_request_processor`: triages submitted requests, marks overdue SLA breaches, generates signed privacy export packages, and executes delete/anonymize jobs with legal-hold checks
- `audit_event_ingest`: writes append-only audit records (integrity chain enforced in DB)

All functions are intentionally thin entrypoints and should delegate heavy logic to SQL/RPC.
