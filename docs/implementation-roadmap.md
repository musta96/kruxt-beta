# KRUXT Implementation Roadmap (Execution-Ready)

## Current status

- Phase 0 scaffolded: monorepo structure, CI skeleton, shared packages
- Phase 1 scaffolded: Supabase schema v2 migration + seed + smoke tests
- Edge function entrypoints scaffolded for integrations, rankings, compliance, and audit
- Phase 5 runtime scaffolded: B2B ops service + flow for gym admin operations
- Phase 6 runtime scaffolded: integration service + Apple/Garmin webhook/sync activation path
- Phase 6 mobile UI scaffolded: connector activation flow with sync/idempotency/mapping validation
- Phase 6 monitoring scaffolded: gym staff integration health and sync failure monitor flow
- Phase 7 runtime scaffolded: challenge/trials service + rank ladder flow + hardened leaderboard recompute
- Phase 8 runtime slice 1 scaffolded: privacy request mobile/admin flows + queue processor + status transition RPCs
- Phase 8 runtime slice 2 scaffolded: immutable policy/consent registry and re-consent gates for protected actions
- Phase 8 runtime slice 3 scaffolded: data export package queue + signed link delivery pipeline
- Phase 10 runtime scaffolded: gym customization + support ops + monetization experiment + platform SaaS billing + gym RBAC/workforce/CRM + platform control-plane governance + account security + add-ons/partner/data-ops foundations

## Ordered build sequence

1. Apply DB migration and seed data in Supabase project.
2. Connect auth flow in mobile/admin to `profiles` creation, consent capture, guild hall load, and staff ops snapshot (`createPhase2OnboardingUiFlow` + `createPhase2StaffConsoleUiFlow`).
3. Implement workout logger UI and call `log_workout_atomic` RPC (see `createPhase3WorkoutLoggerUiFlow`).
4. Build feed UI from `createPhase4ProofFeedUiFlow` (`feed_events` + joined `workouts` + `social_interactions`).
5. Connect admin UI screens to `createPhase5OpsConsoleUiFlow` and `B2BOpsService`.
6. Connect integration monitoring UI to `createPhase6IntegrationMonitorFlow`.
7. Connect mobile integration screens to `createPhase6IntegrationsUiFlow` + `IntegrationService`.
8. Wire production provider credentials and scheduler cadence for `provider_webhook_ingest` + `sync_dispatcher`.
9. Connect rank/trials UI to `createPhase7RankTrialsFlow` + `CompetitionService`.
10. Validate weekly rank recompute scheduler (`.github/workflows/rank-recompute-weekly.yml`) and alert routing.
11. Run privacy workflows (`submit_privacy_request`) and staff handling pipeline (`transition_privacy_request_status`).
12. Wire Phase 10 admin customization/support surfaces (`createPhase10CustomizationSupportFlow`).
13. Wire mobile support center (`createPhase10SupportCenterFlow`) with ticket submission + threaded replies.
14. Wire monetization screens behind feature flags (consumer paywall, pricing experiments, discount campaigns).
15. Wire staff role-permission gating + phone/iPad/desktop surface split from `user_has_gym_permission(...)`.
16. Wire founder control-plane with delegated support access and governance workflows.
17. Wire user account security center (MFA/device/session controls + auth timeline).
18. Wire add-on marketplace, partner revenue, and governed data-ops modules in control plane.

## Feature flag activation policy

- Keep `billing_live = false` until pilot retention + reliability targets are met.
- Keep non-priority provider flags off (`fitbit`, `oura`, `whoop`, `suunto`, `huawei`).
- Enable only one major flag category per release window.
- Keep support automation high-risk actions on explicit approval path until two stable gate reviews.

## Pilot gates (Pavia)

- 7-day repeat workout logging rate above target
- No Sev-1 access-control bug in RLS or class booking paths
- Sync success for Apple/Garmin connected users above target
- Staff can run class booking + waitlist + check-in operations without fallback sheets
