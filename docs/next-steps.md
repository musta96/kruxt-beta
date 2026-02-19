# Immediate Next Steps

1. Re-run schema sync to apply latest Phase 7 migrations:
   - `./scripts/bootstrap.sh`
   - (syncs `packages/db/supabase/migrations/*` + `packages/db/supabase/seeds/001_feature_flags.sql` and pushes linked DB)
2. Verify smoke checks in target DB:
   - `packages/db/tests/rls_smoke.sql`
3. Connect admin B2B screens to runtime flow:
   - `createPhase5B2BOpsFlow`
   - `B2BOpsService` methods for plans/classes/waitlist/waivers/contracts/check-ins
4. Connect admin integration monitor screen:
   - `createPhase6IntegrationMonitorFlow`
   - `IntegrationMonitorService` health + sync-failure records
5. Connect mobile integration screens to runtime flow:
   - `createPhase6IntegrationsFlow`
   - `IntegrationService` methods for provider linking, sync queueing, and import snapshots
6. Connect mobile Rank Ladder + Trials screens:
   - `createPhase7RankTrialsFlow`
   - `CompetitionService` challenge join/progress and leaderboard reads
7. Keep billing activation controlled:
   - Use `B2BOpsService` read/update telemetry methods
   - Keep `billing_live` flag disabled until pilot stability gate
8. Configure recurring runs for integration jobs:
   - schedule `sync_dispatcher` for frequent execution
   - route provider callbacks into `provider_webhook_ingest`
9. Configure scheduler for weekly ranks:
   - call `rank_recompute_weekly` edge function
10. Start Phase 8 hardening:
   - privacy request handling dashboard
   - policy versioning verification and audit-log review workflow
