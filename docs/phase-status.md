# KRUXT Phase Status (Repository)

## Completed in this implementation

- Phase 0: monorepo scaffold, CI skeleton, env template, shared packages, scripts
- Phase 1: complete Supabase schema v2 migration with RLS, RPCs, triggers, seed flags
- Phase 2 runtime: mobile onboarding + guild hall flows + admin staff ops/triage services
- Phase 2 mobile UI wiring: onboarding screen controller with recoverable step-level errors and submit routing
- Phase 2 admin UI wiring: staff console controller with queue actions and post-mutation snapshot refresh
- Phase 3 runtime: workout logging flow with proof-feed and progress verification
- Phase 3 mobile UI wiring: WorkoutLogger controller with draft helpers, validation, and signal checks
- Phase 4 runtime: social graph/feed ranking/notification service layer for mobile
- Phase 4 mobile UI wiring: Proof Feed controller with interaction + moderation refresh loops
- Phase 5 runtime: admin B2B ops service layer for classes, waitlist, waivers, contracts, check-ins, and billing telemetry
- Phase 5 admin UI wiring: Ops Console controller with class/waitlist/check-in/acceptance mutation refresh loops
- Phase 6 runtime: Apple/Garmin integration pipeline (mobile integration service + webhook ingest + sync dispatcher + cursor persistence)
- Phase 6 monitoring runtime: admin integration health + sync failure monitor flow for gym staff
- Phase 7 runtime: rank ladder + trials service layer with deterministic leaderboard recompute and challenge progress RPCs
- Phase 7 ops follow-up: weekly rank recompute scheduler workflow + deterministic repeat probes + failure issue alerts
- Phase 8 runtime (slice 1): privacy request lifecycle services/flows + queue processor for triage and SLA breach marking
- Phase 8 runtime (slice 2): immutable policy/consent registry + audited consent RPCs + workout re-consent gate
- Phase 8 runtime (slice 3): export package generation with signed URL delivery + retry-safe queue processing
- Phase 8 runtime (slice 4): delete/anonymize fulfillment pipeline with legal holds + retry-safe delete jobs
- Phase 8 runtime (slice 5): audit-log integrity hardening with hash chain + security event coverage
- Phase 8 runtime (slice 6): breach-response incident plumbing + deadline/escalation notifier stubs
- Phase 8 runtime (slice 7): localization baseline for legal surfaces with deterministic locale fallback
- Phase 8 runtime (slice 8): compliance ops console hardening with queue filters, SLA badges, metrics, and runbook mapping
- Phase 9 planning: closed beta rollout checklist + KPI gates + rollback playbook documentation
- Phase 3 prep: workout atomic logging RPC + XP/chain trigger + feed event trigger
- Phase 4 prep: social graph, blocks/reports, interaction schema + moderation storage

## Pending implementation in runtime apps

- Mobile and admin feature-complete UI screen implementation (React Native + Next runtime wiring)
- Supabase auth wiring and protected client routes
- Direct provider API polling implementations for production credentials (Apple/Garmin providers currently webhook-first runtime)
- Scheduled job orchestration still pending for `sync_dispatcher` and `privacy_request_processor`
- Production observability dashboards
- KPI instrumentation and analytics ingestion
