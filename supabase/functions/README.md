# KRUXT Edge Functions

- `provider_webhook_ingest`: stores provider callbacks with idempotency fields, provider flag gating, and sync job fan-out for Apple/Garmin
- `sync_dispatcher`: claims queued sync jobs, processes webhook-linked imports, persists cursor state, and handles retry/backoff safely
- `rank_recompute_weekly`: recomputes active boards (weekly by default), supports deterministic repeat probes, and returns per-board failure diagnostics
- `privacy_request_processor`: triages submitted requests, marks overdue SLA breaches, generates signed privacy export packages, and executes delete/anonymize jobs with legal-hold checks
- `audit_event_ingest`: writes append-only audit records (integrity chain enforced in DB)
- `incident_notifier`: claims incident notification jobs and runs provider-agnostic email/webhook stub notifiers (drill-safe by default)
- `send-invite`: creates/resends/revokes gym staff invite tokens for org admins/founders
- `accept-invite`: validates invite token + email match and upserts the recipient gym membership
- `create-profile-invite`: creates/resends/disables pending gym profiles and sends expiring Supabase Auth magic links without setting passwords
- `complete-profile-activation`: finalizes a magic-link invite after the recipient sets their own password and accepts owner terms when required

All functions are intentionally thin entrypoints and should delegate heavy logic to SQL/RPC.

## Machine Endpoints

`provider_webhook_ingest`, `sync_dispatcher`, `rank_recompute_weekly`,
`privacy_request_processor`, `audit_event_ingest` and `incident_notifier`
require the configured server-side `SUPABASE_SERVICE_ROLE_KEY` as a bearer
credential. A normal member JWT is not sufficient. Keep gateway JWT verification
enabled and use the existing legacy service-role JWT scheduler contract; modern
secret-key transport needs a separately reviewed gateway/auth configuration.
Never place this credential in a client, provider dashboard, URL or report.

Provider ingestion is internal-only until a trusted adapter verifies provider
signatures/freshness and immutable replay binding. Incident force-drill requests
are rejected on the shared queue; use explicit drill-mode fixture jobs. Live
stub deliveries fail/retry and cannot be reported successful.

Run `node --test packages/db/tests/worker-security.test.mjs` for local negative
authorization regressions. This does not replace deployed Deno/gateway tests.
