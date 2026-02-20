# Phase 6 Runtime Implementation

Phase 6 runtime now includes integration activation for Apple + Garmin with dark-launch-safe provider scaffolding:

- Device connection management and sync job queueing in mobile runtime
- Cursor persistence via `device_sync_cursors` to keep retries deterministic
- Webhook ingest idempotency + job fan-out for active providers
- Dispatcher-side import pipeline with retry/backoff and failure telemetry

## Mobile entrypoints

- `apps/mobile/src/services/integration-service.ts`
- `apps/mobile/src/flows/phase6-integrations.ts`
- `apps/mobile/src/flows/phase6-integrations-ui.ts`
- `apps/mobile/src/app.tsx`

Core methods:

- `IntegrationService.listConnections(...)`
- `IntegrationService.upsertConnection(...)`
- `IntegrationService.queueSyncJob(...)`
- `IntegrationService.listSyncJobs(...)`
- `IntegrationService.getSyncCursor(...)`
- `IntegrationService.listImportedActivities(...)`

UI controller methods:

- `createPhase6IntegrationsUiFlow.load(...)`
- `createPhase6IntegrationsUiFlow.connectProvider(...)`
- `createPhase6IntegrationsUiFlow.disconnectProvider(...)`
- `createPhase6IntegrationsUiFlow.queueSync(...)`
- `createPhase6IntegrationsUiFlow.validateActivation(...)`

Wiring guide:

- `docs/phase6-integrations-ui-wiring.md`

## Admin monitoring entrypoints

- `apps/admin/src/services/integration-monitor-service.ts`
- `apps/admin/src/flows/phase6-integration-monitor.ts`

Core methods:

- `IntegrationMonitorService.getSummary(...)`
- `IntegrationMonitorService.listConnectionHealth(...)`
- `IntegrationMonitorService.listRecentSyncFailures(...)`

## Edge function entrypoints

- `supabase/functions/provider_webhook_ingest/index.ts`
- `supabase/functions/sync_dispatcher/index.ts`
- `supabase/functions/_shared/integrations.ts`

## DB migration hooks

- `packages/db/supabase/migrations/202602190370_krux_beta_part3_s029.sql`
- `packages/db/supabase/migrations/202602190371_krux_beta_part3_s030.sql`
- `packages/db/supabase/migrations/202602190372_krux_beta_part3_s031.sql`
- `packages/db/supabase/migrations/202602190373_krux_beta_part3_s032.sql`
- `packages/db/supabase/migrations/202602190374_krux_beta_part3_s033.sql`
- `packages/db/supabase/migrations/202602190375_krux_beta_part3_s034.sql`
- `packages/db/supabase/migrations/202602190376_krux_beta_part3_s035.sql`
- `packages/db/supabase/migrations/202602190377_krux_beta_part3_s036.sql`
- `packages/db/supabase/migrations/202602190378_krux_beta_part3_s037.sql`
- `packages/db/supabase/migrations/202602190379_krux_beta_part3_s038.sql`
- `packages/db/supabase/migrations/202602190380_krux_beta_part3_s039.sql`
- `packages/db/supabase/migrations/202602190381_krux_beta_part3_s040.sql`

These add `device_sync_cursors` plus dedupe-safe linkage between webhook events and sync jobs (`source_webhook_event_id`).
