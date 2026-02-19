# KRUXT Implementation Roadmap (Execution-Ready)

## Current status

- Phase 0 scaffolded: monorepo structure, CI skeleton, shared packages
- Phase 1 scaffolded: Supabase schema v2 migration + seed + smoke tests
- Edge function entrypoints scaffolded for integrations, rankings, compliance, and audit

## Ordered build sequence

1. Apply DB migration and seed data in Supabase project.
2. Connect auth flow in mobile/admin to `profiles` creation, consent capture, guild hall load, and staff ops snapshot.
3. Implement workout logger UI and call `log_workout_atomic` RPC (see `createPhase3WorkoutLoggingFlow`).
4. Build feed UI from `createPhase4SocialFeedFlow` (`feed_events` + joined `workouts` + `social_interactions`).
5. Build B2B admin screens for memberships, classes, waitlist, check-ins, waivers.
6. Activate Apple + Garmin integration paths with `device_connections` + `device_sync_jobs`.
7. Enable weekly rank recompute scheduler calling `rank_recompute_weekly`.
8. Run privacy workflows (`submit_privacy_request`) and staff handling pipeline.

## Feature flag activation policy

- Keep `billing_live = false` until pilot retention + reliability targets are met.
- Keep non-priority provider flags off (`fitbit`, `oura`, `whoop`, `suunto`, `huawei`).
- Enable only one major flag category per release window.

## Pilot gates (Pavia)

- 7-day repeat workout logging rate above target
- No Sev-1 access-control bug in RLS or class booking paths
- Sync success for Apple/Garmin connected users above target
- Staff can run class booking + waitlist + check-in operations without fallback sheets
