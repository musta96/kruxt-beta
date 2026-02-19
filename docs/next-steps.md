# Immediate Next Steps

1. Create Supabase project and run migration:
   - `packages/db/supabase/migrations/202602190001_krux_beta_foundation.sql`
2. Run seed script:
   - `packages/db/supabase/seeds/001_feature_flags.sql`
3. Verify smoke checks in target DB:
   - `packages/db/tests/rls_smoke.sql`
4. Connect mobile auth onboarding to:
   - `profiles`
   - `consents`
   - `notification_preferences`
5. Implement workout logger UI and wire RPC:
   - `public.log_workout_atomic`
6. Implement class waitlist action buttons:
   - `public.join_waitlist`
   - `public.promote_waitlist_member`
7. Implement compliance entry points:
   - `public.submit_privacy_request`
   - `public.record_waiver_acceptance`
8. Configure scheduler for weekly ranks:
   - call `rank_recompute_weekly` edge function
