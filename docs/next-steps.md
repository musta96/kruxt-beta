# Immediate Next Steps

1. Create/link Supabase project and run bootstrap:
   - `./scripts/bootstrap.sh`
   - (syncs `packages/db/supabase/migrations/*` + `packages/db/supabase/seeds/001_feature_flags.sql` into CLI defaults and pushes)
2. Verify smoke checks in target DB:
   - `packages/db/tests/rls_smoke.sql`
3. Connect mobile auth onboarding to:
   - `profiles`
   - `consents`
   - `notification_preferences`
4. Implement workout logger UI and wire RPC:
   - `public.log_workout_atomic`
5. Implement class waitlist action buttons:
   - `public.join_waitlist`
   - `public.promote_waitlist_member`
6. Implement compliance entry points:
   - `public.submit_privacy_request`
   - `public.record_waiver_acceptance`
7. Configure scheduler for weekly ranks:
   - call `rank_recompute_weekly` edge function
