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
   - `guild hall` via `createGuildHallFlow`
4. Connect admin staff dashboard to:
   - `GymAdminService.getGymOpsSummary`
   - `GymAdminService.listPendingMemberships`
   - `GymAdminService.listPendingWaitlistEntries`
   - `GymAdminService.listOpenPrivacyRequests`
5. Implement workout logger UI and wire flow:
   - `createPhase3WorkoutLoggingFlow`
   - `public.log_workout_atomic`
6. Implement class waitlist action buttons:
   - `public.join_waitlist`
   - `public.promote_waitlist_member`
7. Implement compliance entry points:
   - `public.submit_privacy_request`
   - `public.record_waiver_acceptance`
8. Configure scheduler for weekly ranks:
   - call `rank_recompute_weekly` edge function
