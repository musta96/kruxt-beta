# Phase 10 Runtime (Gym Customization + Support Ops)

Phase 10 adds runtime contracts for:

- Gym-specific branding and module controls
- Invoicing adapter readiness (including Italy FatturaPA fields)
- Support queue + conversation + agent approval workflows
- Monetization foundations (B2C entitlements, pricing experiments, discount campaigns)

## New Database Migration

- `packages/db/supabase/migrations/202602200001_krux_beta_part5_s001_customization_support.sql`
- `packages/db/supabase/migrations/202602200002_krux_beta_part5_s002_monetization_experiments.sql`
- `packages/db/supabase/migrations/202602200003_krux_beta_part5_s003_platform_billing.sql`
- `packages/db/supabase/migrations/202602200004_krux_beta_part5_s004_gym_ops_rbac_workforce.sql`
- `packages/db/supabase/migrations/202602200005_krux_beta_part5_s005_platform_control_plane_governance.sql`
- `packages/db/supabase/migrations/202602200006_krux_beta_part5_s006_account_security_foundations.sql`
- `packages/db/supabase/migrations/202602200007_krux_beta_part5_s007_addons_partner_dataops.sql`

## Monetization Foundations (Activation Controlled)

Part 5 s002 introduces:

- `public.consumer_plans`
- `public.consumer_plan_prices`
- `public.consumer_entitlements`
- `public.pricing_experiments`
- `public.pricing_experiment_variants`
- `public.pricing_experiment_assignments`
- `public.discount_campaigns`
- `public.discount_redemptions`

All billing-critical mutations remain intended for service-role paths and feature-flag control (`billing_live`) until post-pilot reliability gates are met.

## Platform SaaS Billing Readiness (Gyms Paying KRUXT)

Part 5 s003 introduces:

- `public.platform_plans`
- `public.gym_platform_subscriptions`
- `public.gym_platform_invoices`
- `public.gym_platform_payment_transactions`
- `public.gym_platform_refunds`

This separates gym-to-platform SaaS billing from gym-to-member billing, so future monetization expansion does not require backfilling overloaded tables.

## Gym RBAC + Workforce + CRM Readiness

Part 5 s004 introduces:

- `public.gym_permission_catalog`
- `public.gym_role_permissions`
- `public.gym_user_permission_overrides`
- `public.staff_shifts`
- `public.staff_time_entries`
- `public.gym_kpi_daily_snapshots`
- `public.gym_crm_leads`
- `public.gym_crm_lead_activities`
- helper function `public.user_has_gym_permission(gym_id, permission_key, viewer)`

This enables owner-controlled staff permission granularity, phone/iPad operations slices for staff, and management dashboards with CRM/shift foundations.

## Platform Control Plane + Governance

Part 5 s005 introduces:

- platform operator RBAC:
  - `public.platform_permission_catalog`
  - `public.platform_role_permissions`
  - `public.platform_operator_accounts`
  - `public.platform_operator_permission_overrides`
- delegated gym support access:
  - `public.gym_support_access_grants`
  - `public.gym_support_access_sessions`
  - helper `public.platform_has_approved_gym_support_grant(...)`
- platform-level control surfaces:
  - `public.platform_kpi_daily_snapshots`
  - `public.platform_feature_overrides`
  - helper `public.get_platform_admin_overview()`
- data governance and controlled external monetization:
  - `public.user_data_sharing_preferences`
  - `public.data_partners`
  - `public.data_products`
  - `public.data_partner_access_grants`
  - `public.data_partner_exports`

This creates the “platform above everything” foundation with delegated, auditable access rather than unrestricted tenant-level visibility.

## Account Security Foundations

Part 5 s006 introduces:

- `public.user_security_settings`
- `public.user_trusted_devices`
- `public.user_auth_events`
- helper RPC `public.log_user_auth_event(...)`

This provides user-facing security controls (MFA/device/session preferences) and auditable auth event history with user-owned RLS.

## Add-ons + Partner Revenue + Data Ops Foundations

Part 5 s007 introduces:

- B2B2C add-ons:
  - `public.gym_addon_catalog`
  - `public.gym_addon_subscriptions`
  - `public.gym_advanced_analytics_views`
  - `public.gym_automation_playbooks`
  - `public.gym_automation_runs`
- Partner ecosystem:
  - `public.partner_marketplace_apps`
  - `public.gym_partner_app_installs`
  - `public.partner_revenue_events`
- Governed data ops:
  - `public.data_aggregation_jobs`
  - `public.data_anonymization_checks`
  - `public.data_release_approvals`

This enables scalable add-on monetization, partner-install revenue tracking, and approval-gated aggregate data product operations.

## Admin Runtime

- Service:
  - `apps/admin/src/services/customization-support-service.ts`
  - `apps/admin/src/services/platform-control-plane-service.ts`
- Flow:
  - `apps/admin/src/flows/phase10-customization-support.ts`
  - `apps/admin/src/flows/phase10-platform-control-plane.ts`
  - `apps/admin/src/flows/phase10-platform-control-plane-ui.ts`

Flow snapshot includes:

- `brandSettings`
- `featureSettings`
- `invoiceConnections`
- `complianceProfile`
- `invoiceDeliveryJobs`
- `supportTickets`
- `selectedTicketMessages`
- `selectedTicketAutomationRuns`

Supported mutation actions:

- branding upsert
- feature setting upsert/remove
- invoice provider upsert/default
- invoice compliance upsert
- invoice delivery job creation
- support ticket submit/update
- support message append
- support automation run create/approve

Founder control-plane flow snapshot includes:

- platform overview RPC payload + KPI snapshots
- operator accounts + permission overrides
- support access grants/sessions
- feature overrides
- data partner/product/grant/export governance
- add-on catalog/subscriptions + analytics/automation controls
- partner app installs + partner revenue events
- data aggregation/anonymization/release approval queues

## Mobile Runtime

- Service:
  - `apps/mobile/src/services/support-service.ts`
  - `apps/mobile/src/services/security-service.ts`
- Flow:
  - `apps/mobile/src/flows/phase10-support-center.ts`
  - `apps/mobile/src/flows/phase10-security-center.ts`
  - `apps/mobile/src/flows/phase10-security-center-ui.ts`

Flow snapshot includes:

- current-user tickets
- selected ticket conversation
- selected ticket automation runs

Supported mutation actions:

- submit ticket
- append ticket message
- approve/reject automation run

Security center flow mutation actions:

- upsert security settings
- upsert/revoke trusted device
- log auth/security event

Security center UI flow adds:

- risk summary counters (high-risk/failed login/revoked-device windows)
- timeline grouping buckets (24h / 7d / older)
- action-card recommendations for immediate security posture moves

## Index Exports Updated

- `apps/admin/src/services/index.ts`
- `apps/admin/src/index.ts`
- `apps/mobile/src/services/index.ts`
- `apps/mobile/src/index.ts`

## Recommended Wiring Order

1. Admin: connect `createPhase10CustomizationSupportFlow.load`.
2. Admin: wire branding + feature control save actions.
3. Admin: wire invoice connection/compliance/job actions.
4. Admin: wire support queue, thread, and automation approval actions.
5. Mobile: connect `createPhase10SupportCenterFlow.load`.
6. Mobile: wire ticket create + reply + approval actions.
