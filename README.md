# KRUXT Beta Monorepo

KRUXT beta platform: social fitness + gym ops (B2C/B2B) built with Supabase.

KRUXT is a social-first fitness platform with B2C workout tracking, gamification, and B2B gym operations.

## Workspace layout

- `apps/mobile`: iOS-first mobile app scaffold (React Native/Expo target)
- `apps/admin`: gym management web app scaffold (Next.js target)
- `packages/ui`: shared design tokens and UI primitives
- `packages/types`: shared TypeScript contracts for events/flags/API payloads
- `packages/db`: Supabase migrations, seed data, and SQL smoke tests
- `supabase/functions`: edge function entrypoints

## Key decisions

- Backend: Supabase (Postgres, Auth, RLS, Edge Functions)
- Integrations active first: Apple Health + Garmin
- Other providers: modeled and disabled behind feature flags
- Payments: schema-ready, billing activation deferred
- Compliance baseline: US + EU (consents, privacy requests, policy versions, audit logs)

## Quick start

1. Install deps: `pnpm install`
2. Run checks: `pnpm lint && pnpm typecheck && pnpm test`
3. Review DB migrations: `packages/db/supabase/migrations/`
4. Apply schema + seed with Supabase CLI:
   - `./scripts/bootstrap.sh`
   - This syncs SQL into `supabase/migrations` and `supabase/seed.sql`, then runs `supabase db push --include-seed`.
5. Deploy edge functions:
   - `./scripts/deploy_functions.sh`

## Important

The SQL migration is designed to be future-proof and includes strict RLS defaults.
Operational features are controlled by flags in `public.feature_flags`.

## Phase 2 Runtime

- Mobile onboarding + guild hall flows: `apps/mobile/src/services`, `apps/mobile/src/flows`
- Admin staff ops services + flows: `apps/admin/src/services`, `apps/admin/src/flows`
- Usage notes: `docs/phase2-runtime.md`

## Phase 3 Runtime

- Workout logging service + flow: `apps/mobile/src/services/workout-service.ts`, `apps/mobile/src/flows/phase3-workout-logging.ts`
- PR auto-detection trigger migration: `packages/db/supabase/migrations/202602190351_krux_beta_part3_s010.sql`
- Usage notes: `docs/phase3-runtime.md`

## Phase 4 Runtime

- Social/feed/notification services: `apps/mobile/src/services/social-service.ts`, `apps/mobile/src/services/feed-service.ts`, `apps/mobile/src/services/notification-service.ts`
- Social feed flow: `apps/mobile/src/flows/phase4-social-feed.ts`
- Push token schema + RLS migration set starts at: `packages/db/supabase/migrations/202602190355_krux_beta_part3_s014.sql`
- Usage notes: `docs/phase4-runtime.md`

## Phase 5 Runtime

- B2B admin ops service: `apps/admin/src/services/b2b-ops-service.ts`
- B2B ops flow snapshot: `apps/admin/src/flows/phase5-b2b-ops.ts`
- Staff acceptance RPC migration set starts at: `packages/db/supabase/migrations/202602190364_krux_beta_part3_s023.sql`
- Usage notes: `docs/phase5-runtime.md`

## Phase 6 Runtime

- Mobile integration runtime: `apps/mobile/src/services/integration-service.ts`, `apps/mobile/src/flows/phase6-integrations.ts`
- Edge activation: `supabase/functions/provider_webhook_ingest`, `supabase/functions/sync_dispatcher`
- Cursor + webhook sync migration set starts at: `packages/db/supabase/migrations/202602190370_krux_beta_part3_s029.sql`
- Usage notes: `docs/phase6-runtime.md`

## Phase 7 Runtime

- Mobile competition runtime: `apps/mobile/src/services/competition-service.ts`, `apps/mobile/src/flows/phase7-rank-trials.ts`
- Rank recompute hardening: `supabase/functions/rank_recompute_weekly`
- Challenge/trials RPC migration set starts at: `packages/db/supabase/migrations/202602190385_krux_beta_part3_s044.sql`
- Usage notes: `docs/phase7-runtime.md`

## Phase 8 Runtime (Slice 1)

- Mobile privacy request center runtime: `apps/mobile/src/services/privacy-request-service.ts`, `apps/mobile/src/flows/phase8-privacy-requests.ts`
- Admin compliance ops flow: `apps/admin/src/flows/phase8-compliance-ops.ts`
- Privacy queue edge function: `supabase/functions/privacy_request_processor`
- Privacy lifecycle migration set starts at: `packages/db/supabase/migrations/202602190398_krux_beta_part4_s057.sql`
- Usage notes: `docs/phase8-runtime.md`

## Phase 8 Runtime (Slice 2)

- Immutable policy registry publishing RPC: `public.publish_policy_version(...)`
- Immutable consent capture RPC: `public.record_user_consent(...)`
- Re-consent gate RPCs: `public.list_missing_required_consents(...)`, `public.user_has_required_consents(...)`
- Workout logging gate wiring: `apps/mobile/src/services/workout-service.ts`
- Policy/consent migration set starts at: `packages/db/supabase/migrations/202602190402_krux_beta_part4_s061.sql`

## Phase 8 Runtime (Slice 3)

- Export job queue table + delivery metadata: `public.privacy_export_jobs`
- Export pipeline RPCs: `queue_privacy_export_jobs`, `claim_privacy_export_jobs`, `build_privacy_export_payload`, `complete_privacy_export_job`, `fail_privacy_export_job`
- Privacy processor now generates signed export packages in `privacy-exports` bucket
- Export migration set starts at: `packages/db/supabase/migrations/202602190407_krux_beta_part4_s066.sql`

## Phase 8 Runtime (Slice 4)

- Legal hold registry + delete job queue table: `public.legal_holds`, `public.privacy_delete_jobs`
- Delete/anonymize RPCs: `has_active_legal_hold`, `apply_user_anonymization`, `queue_privacy_delete_jobs`, `claim_privacy_delete_jobs`, `complete_privacy_delete_job`, `fail_privacy_delete_job`
- Privacy processor now executes export + delete pipelines in one run with retry-safe outcomes
- Delete/anonymize migration: `packages/db/supabase/migrations/202602190410_krux_beta_part4_s069.sql`

## Phase 8 Runtime (Slice 5)

- Audit-log integrity chain: `public.audit_logs.integrity_seq`, `prev_entry_hash`, `entry_hash`
- Integrity monitoring RPCs: `audit_log_integrity_drift`, `audit_log_integrity_summary`
- Security event coverage trigger: `trg_event_outbox_audit_security_event` emits `security.event_outbox`
- Audit hardening migration: `packages/db/supabase/migrations/202602190411_krux_beta_part4_s070.sql`

## Phase 8 Runtime (Slice 6)

- Breach response tables: `public.security_incidents`, `public.incident_actions`, `public.incident_notification_jobs`
- Incident lifecycle/deadline RPCs: `create_security_incident`, `transition_security_incident_status`, `recompute_security_incident_deadlines`, `admin_list_security_incidents`
- Escalation + notifier queue RPCs: `queue_incident_escalation_notifications`, `claim_incident_notification_jobs`, `complete_incident_notification_job`, `fail_incident_notification_job`
- Edge notifier stub: `supabase/functions/incident_notifier` (provider-agnostic email/webhook interface with drill-safe mode)
- Breach-response migration: `packages/db/supabase/migrations/202602190412_krux_beta_part4_s071.sql`
