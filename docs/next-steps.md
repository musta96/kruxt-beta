# Immediate Next Steps

1. Re-run schema sync to apply latest Phase 8 (slice 8) migrations:
   - `./scripts/bootstrap.sh`
   - (syncs `packages/db/supabase/migrations/*` + `packages/db/supabase/seeds/001_feature_flags.sql` and pushes linked DB)
2. Verify smoke checks in target DB:
   - `packages/db/tests/rls_smoke.sql`
3. Connect admin B2B screens to runtime flow:
   - `createPhase5OpsConsoleUiFlow`
   - `B2BOpsService` methods for plans/classes/waitlist/waivers/contracts/check-ins
4. Connect admin integration monitor screen:
   - `createPhase6IntegrationMonitorFlow`
   - `IntegrationMonitorService` health + sync-failure records
5. Connect mobile integration screens to runtime flow:
   - `createPhase6IntegrationsUiFlow`
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
9. Validate active rank scheduler:
   - verify `.github/workflows/rank-recompute-weekly.yml` succeeds with project secrets
   - tune `determinismProbeCount`/`limit` after first two production runs
10. Configure scheduler for privacy queue:
   - call `privacy_request_processor` with triage/overdue/export limits
11. Operationalize compliance runbook in staff workflows:
   - map admin queue actions to `docs/compliance-ops-runbook.md`
   - enforce transition-note quality checks in operator QA
12. Add explicit re-consent UI flow:
   - show `list_missing_required_consents` reasons in-app
   - route users to policy acceptance screens before protected modules
13. Start Phase 9 rollout operations:
   - execute `docs/phase9-closed-beta-rollout.md` Pavia readiness checklist
   - update weekly KPI tracking board every Friday before gate review
14. Apply Phase 10 schema extension for customization/support/monetization foundations:
   - includes gym branding/feature toggles, invoice adapter layer, support-agent queue models, and pricing/discount experiment models
   - migration: `packages/db/supabase/migrations/202602200001_krux_beta_part5_s001_customization_support.sql`
   - migration: `packages/db/supabase/migrations/202602200002_krux_beta_part5_s002_monetization_experiments.sql`
   - migration: `packages/db/supabase/migrations/202602200003_krux_beta_part5_s003_platform_billing.sql`
   - migration: `packages/db/supabase/migrations/202602200004_krux_beta_part5_s004_gym_ops_rbac_workforce.sql`
   - migration: `packages/db/supabase/migrations/202602200005_krux_beta_part5_s005_platform_control_plane_governance.sql`
   - migration: `packages/db/supabase/migrations/202602200006_krux_beta_part5_s006_account_security_foundations.sql`
   - migration: `packages/db/supabase/migrations/202602200007_krux_beta_part5_s007_addons_partner_dataops.sql`
15. Build UI in strict Lovable order:
   - follow `docs/lovable/prompts-beta-master-pack-v2.md`
   - for deeper Phase 10 screen generation, use `docs/lovable/prompts-phase10-detailed-pack-v3.md`
   - wire each generated screen to existing flow/service contracts before next prompt
16. Operationalize support automation with approval gates:
   - follow `docs/ops/maintenance-agent-architecture.md`
   - keep non-read-only agent actions human-approved until post-pilot stability
17. Wire Phase 10 admin module:
   - `createPhase10CustomizationSupportFlow.load`
   - actions: branding, feature toggles, invoice adapters, support queue + automation approvals
18. Wire Phase 10 mobile support center:
   - `createPhase10SupportCenterFlow.load`
   - actions: submit ticket, reply in thread, approve/reject automation run
19. Add monetization surfaces behind flags:
   - mobile paywall + entitlement status + discount entry
   - admin pricing experiments + variant assignment observability
20. Keep monetization activation staged:
   - leave live charging off until `billing_live` rollout gate
   - validate experiment assignment integrity before paid rollout
21. Validate platform SaaS billing table family before charging gyms directly:
   - `platform_plans`, `gym_platform_subscriptions`, `gym_platform_invoices`, `gym_platform_payment_transactions`, `gym_platform_refunds`
   - keep behind `billing_live` until pilot + support SLO gates pass
22. Wire role-based gym staff surfaces:
   - use `user_has_gym_permission(...)` for feature gating
   - map desktop/iPad/phone module visibility by permission key
23. Pilot distribution without TestFlight:
   - launch via mobile-first web/PWA flow for Pavia cohort
   - details: `docs/strategy/pavia-pilot-distribution-and-surface-strategy-2026-02-20.md`
24. Build founder control-plane console:
   - operator RBAC, delegated gym-access grants/sessions, global KPI view, feature overrides
   - use `get_platform_admin_overview()` + platform governance tables from s005 migration
25. Build account security center:
   - user security settings (MFA/device/session controls)
   - trusted device management and auth-event timeline
26. Build growth/revenue control modules:
   - add-on catalog/subscriptions, automation playbooks/runs, advanced analytics views
   - partner marketplace installs + partner revenue event dashboards
   - aggregate data-ops jobs with anonymization checks + release approvals
