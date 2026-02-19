# Immediate Next Steps

1. Re-run schema sync to apply latest Phase 5 RPC migrations:
   - `./scripts/bootstrap.sh`
   - (syncs `packages/db/supabase/migrations/*` + `packages/db/supabase/seeds/001_feature_flags.sql` and pushes linked DB)
2. Verify smoke checks in target DB:
   - `packages/db/tests/rls_smoke.sql`
3. Connect admin B2B screens to runtime flow:
   - `createPhase5B2BOpsFlow`
   - `B2BOpsService` methods for plans/classes/waitlist/waivers/contracts/check-ins
4. Keep billing activation controlled:
   - Use `B2BOpsService` read/update telemetry methods
   - Keep `billing_live` flag disabled until pilot stability gate
5. Start Phase 6 integration activation:
   - implement Apple + Garmin in `provider_webhook_ingest` and `sync_dispatcher`
   - keep Fitbit/Huawei/Suunto/Oura/Whoop flags off
6. Configure scheduler for weekly ranks:
   - call `rank_recompute_weekly` edge function
