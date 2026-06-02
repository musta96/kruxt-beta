-- Finalized gym staff enforcement predicates and B2B entitlement templates.
-- Keeps existing capability keys stable, with finalized spec aliases in metadata.

insert into public.platform_capability_catalog (
  capability_key,
  category,
  sort_order,
  label,
  description,
  value_type,
  global_bool_default,
  global_limit_default,
  is_billing_sensitive,
  metadata
)
values
  ('member_management', 'operations', 100, 'Member management', 'Create, approve, update, and manage gym memberships.', 'boolean', true, null, false, '{"specKey":"member_management"}'::jsonb),
  ('classes_scheduling', 'operations', 110, 'Classes & scheduling', 'Create and manage classes, capacity, and schedule visibility.', 'boolean', true, null, false, '{"specKey":"classes_scheduling"}'::jsonb),
  ('check_ins', 'operations', 120, 'Check-ins', 'Enable member check-ins and access event tracking.', 'boolean', true, null, false, '{"specKey":"checkins"}'::jsonb),
  ('basic_waivers', 'operations', 125, 'Basic waivers', 'Enable basic waiver collection and member acknowledgements.', 'boolean', true, null, false, '{"specKey":"basic_waivers"}'::jsonb),
  ('waivers_esign', 'operations', 130, 'Versioned waivers + e-sign', 'Enable versioned waiver templates, signatures, and compliance acknowledgements.', 'boolean', false, null, false, '{"specKey":"versioned_waivers_esign"}'::jsonb),
  ('wearable_integrations', 'operations', 140, 'Wearable / device integrations', 'Enable wearable device connections and synced activities.', 'boolean', false, null, false, '{"specKey":"wearable_integrations"}'::jsonb),
  ('staff_scheduling', 'operations', 150, 'Staff scheduling', 'Enable staff shifts, coverage planning, and worked-hours tracking.', 'boolean', false, null, false, '{"specKey":"staff_scheduling"}'::jsonb),
  ('pt_assignment', 'operations', 160, 'PT assignment', 'Assign personal trainers to members.', 'boolean', false, null, false, '{"specKey":"pt_assignment"}'::jsonb),
  ('workout_plans', 'operations', 170, 'Workout plans', 'Allow staff and PTs to log member workout plans.', 'boolean', false, null, false, '{"specKey":"workout_plans"}'::jsonb),
  ('private_coaching_workspace', 'operations', 180, 'PT/Coach coaching workspace', 'Coach-scoped athlete workspace with plan publishing, per-exercise swaps, messaging, sessions, notes, goals, and sensitive-data controls.', 'boolean', false, null, false, '{"specKey":"coaching_workspace","tier":"pro","sensitiveData":true,"warning":"Disabling hides the PT workspace and blocks plan/message/session actions."}'::jsonb),
  ('custom_staff_roles', 'operations', 190, 'Custom gym staff roles', 'Allow a gym to clone built-in roles and customize role-permission cells.', 'boolean', false, null, false, '{"specKey":"custom_staff_roles","tier":"pro"}'::jsonb),

  ('member_payments', 'billing', 10, 'Stripe / automated member payments', 'Collect membership fees from members through KRUXT and Stripe.', 'boolean', false, null, true, '{"specKey":"gym_member_billing_stripe","warning":"Disabling blocks active member payment collection."}'::jsonb),
  ('kruxt_subscription_billing', 'billing', 20, 'Gym -> KRUXT subscription billing', 'Controls the gym subscription KRUXT bills to this tenant.', 'boolean', true, null, true, '{"specKey":"kruxt_subscription_billing","planDriven":true}'::jsonb),
  ('payment_provider_connection', 'billing', 30, 'Payment provider connection', 'Allow the gym to connect a payment provider such as Stripe.', 'boolean', false, null, true, '{"specKey":"payment_provider_connection","provider":"stripe"}'::jsonb),
  ('manual_payment_recording', 'billing', 40, 'Manual payment recording / invoices', 'Allow staff to create invoices and record manual payments.', 'boolean', true, null, true, '{"specKey":"manual_payments_invoices"}'::jsonb),
  ('refunds_credits', 'billing', 50, 'Refunds & credits', 'Allow refund and credit workflows for member payments.', 'boolean', false, null, true, '{"specKey":"refunds_credits"}'::jsonb),
  ('dunning_retry', 'billing', 60, 'Dunning / failed-payment retry', 'Enable automated failed-payment retry and dunning workflows.', 'boolean', false, null, true, '{"specKey":"dunning_retry"}'::jsonb),

  ('public_page_publish', 'growth', 210, 'Public page publish', 'Allow draft, preview, and publish workflows for the public gym page.', 'boolean', true, null, false, '{"specKey":"public_page_publish"}'::jsonb),
  ('invite_links_qr', 'growth', 220, 'Invite links / QR', 'Allow staff to create invite links and QR codes.', 'boolean', true, null, false, '{"specKey":"invite_links_qr"}'::jsonb),
  ('self_serve_join_approval', 'growth', 230, 'Self-serve join + approval', 'Allow new people to request or activate gym access from public flows.', 'boolean', true, null, false, '{"specKey":"self_serve_join_approval"}'::jsonb),
  ('white_label_basic', 'growth', 240, 'White-label theming (basic)', 'Allow basic gym color palette, logo, and public-page brand customization.', 'boolean', false, null, false, '{"specKey":"white_label_basic"}'::jsonb),
  ('white_label_full', 'growth', 250, 'Full white-label', 'Enable custom domain, advanced brand controls, and KRUXT-brand removal.', 'boolean', false, null, false, '{"specKey":"white_label_full","tier":"pro"}'::jsonb),
  ('basic_reports_exports', 'growth', 260, 'Basic reports & exports', 'Enable attendance, revenue, retention, and consent exports.', 'boolean', false, null, false, '{"specKey":"basic_reports_exports"}'::jsonb),
  ('advanced_analytics', 'growth', 270, 'Advanced analytics / retention', 'Enable advanced retention, cohort, and performance analytics.', 'boolean', false, null, false, '{"specKey":"advanced_analytics","tier":"pro"}'::jsonb),
  ('automations', 'growth', 280, 'Automations', 'Enable renewal reminders, waiver expiry notices, win-back automations, and staff nudges.', 'boolean', false, null, false, '{"specKey":"automations","tier":"pro"}'::jsonb),
  ('ai_program_generator', 'growth', 290, 'AI program generator', 'Allow PTs to draft programs with AI before editing and publishing.', 'boolean', false, null, false, '{"specKey":"ai_program_generator","tier":"pro","metered":true}'::jsonb),
  ('ai_churn_prediction', 'growth', 300, 'Churn / retention prediction', 'Enable AI retention risk scoring and intervention prompts.', 'boolean', false, null, false, '{"specKey":"ai_churn_prediction","tier":"pro","metered":true}'::jsonb),
  ('ai_admin_copilot', 'growth', 305, 'Admin copilot', 'Natural-language operational queries for gym admins.', 'boolean', false, null, false, '{"specKey":"ai_admin_copilot","addonEligible":true,"metered":true}'::jsonb),
  ('ai_schedule_optimization', 'growth', 306, 'Schedule optimization', 'AI-assisted staff and class schedule optimization.', 'boolean', false, null, false, '{"specKey":"ai_schedule_optimization","addonEligible":true,"metered":true}'::jsonb),

  ('dsar_handling', 'compliance', 310, 'DSAR handling', 'Enable data subject request intake and fulfillment workflow.', 'boolean', true, null, false, '{"specKey":"gdpr_dsar_handling","neverGated":true}'::jsonb),
  ('data_export', 'compliance', 320, 'Data export', 'Allow staff and platform operators to export scoped gym/member data.', 'boolean', true, null, true, '{"specKey":"data_export","neverGated":true}'::jsonb),
  ('retention_override', 'compliance', 330, 'Retention override', 'Allow this tenant to use a custom retention period instead of the default.', 'boolean', false, null, true, '{"specKey":"retention_override"}'::jsonb),
  ('audit_activity_view', 'compliance', 340, 'Audit / activity view', 'Enable gym-scoped activity and audit visibility.', 'boolean', true, null, false, '{"specKey":"audit_activity_log","neverGated":true}'::jsonb),
  ('cross_location_reporting', 'compliance', 350, 'Cross-location reporting', 'Enable enterprise-level reporting across multiple locations.', 'boolean', false, null, false, '{"specKey":"cross_location_reporting","tier":"enterprise"}'::jsonb),
  ('sso', 'compliance', 360, 'SSO', 'Enable enterprise single sign-on for gym operators.', 'boolean', false, null, true, '{"specKey":"sso","tier":"enterprise"}'::jsonb),
  ('api_access', 'compliance', 370, 'API access', 'Enable tenant API access and integration credentials.', 'boolean', false, null, true, '{"specKey":"api_access","addonEligible":true}'::jsonb),
  ('custom_dpa_residency', 'compliance', 380, 'Custom DPA / data residency', 'Enable custom DPA terms and data-residency handling.', 'boolean', false, null, true, '{"specKey":"custom_dpa_residency","tier":"enterprise"}'::jsonb),
  ('per_gym_entitlement_overrides', 'compliance', 390, 'Per-gym entitlement overrides', 'Enable franchise-level entitlement overrides below the enterprise tenant.', 'boolean', false, null, true, '{"specKey":"per_gym_entitlement_overrides","tier":"enterprise"}'::jsonb),

  ('member_cap', 'limits', 410, 'Active members cap', 'Maximum active/trial members allowed for this gym.', 'limit', null, 50, true, '{"specKey":"members_cap","unit":"members"}'::jsonb),
  ('locations_cap', 'limits', 415, 'Locations / gyms', 'Maximum locations covered by this plan.', 'limit', null, 1, true, '{"specKey":"locations_cap","unit":"locations"}'::jsonb),
  ('staff_seats', 'limits', 420, 'Staff seats', 'Maximum active staff seats allowed for this gym.', 'limit', null, 2, true, '{"specKey":"staff_seats_cap","unit":"seats"}'::jsonb),
  ('storage_gb', 'limits', 430, 'Storage', 'Storage limit for files and generated assets.', 'limit', null, 5, true, '{"specKey":"storage","unit":"GB"}'::jsonb),
  ('api_rate_per_minute', 'limits', 440, 'API rate', 'API requests allowed per minute for tenant integrations.', 'limit', null, 60, true, '{"specKey":"api_rate","unit":"req/min"}'::jsonb),
  ('ai_credits_monthly', 'limits', 450, 'AI credits / month', 'Included AI credits per month.', 'limit', null, 0, true, '{"specKey":"ai_credits_monthly","unit":"credits"}'::jsonb)
on conflict (capability_key) do update
set
  category = excluded.category,
  sort_order = excluded.sort_order,
  label = excluded.label,
  description = excluded.description,
  value_type = excluded.value_type,
  global_bool_default = excluded.global_bool_default,
  global_limit_default = excluded.global_limit_default,
  is_billing_sensitive = excluded.is_billing_sensitive,
  metadata = public.platform_capability_catalog.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_entitlement_templates (
  template_key,
  name,
  description,
  sort_order,
  metadata
)
values
  ('free', 'Launch', 'Free launch tier for early social/member growth with strict limits.', 0, '{"tier":"free","displayName":"Launch","supportLevel":"community","priceMonthly":0}'::jsonb),
  ('starter', 'Starter', 'Core paid gym operations with payments, staff scheduling, and basic reports.', 10, '{"tier":"starter","supportLevel":"standard","priceMonthly":39}'::jsonb),
  ('pro', 'Pro', 'Full BZone-ready operating tier with coaching workspace, automations, analytics, and AI credits.', 20, '{"tier":"pro","supportLevel":"priority","priceMonthly":129,"aiIncludedCredits":500}'::jsonb),
  ('enterprise', 'Enterprise', 'Custom enterprise tier for multi-location gyms, SSO, API access, and dedicated support.', 30, '{"tier":"enterprise","supportLevel":"dedicated","priceModel":"custom_per_location_or_per_member"}'::jsonb)
on conflict (template_key) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  metadata = public.platform_entitlement_templates.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_entitlement_template_capabilities (template_key, capability_key, bool_value, limit_value, metadata)
values
  ('free', 'member_cap', null, 50, '{}'::jsonb),
  ('free', 'locations_cap', null, 1, '{}'::jsonb),
  ('free', 'staff_seats', null, 2, '{}'::jsonb),
  ('free', 'storage_gb', null, 5, '{}'::jsonb),
  ('free', 'api_rate_per_minute', null, 60, '{}'::jsonb),
  ('free', 'ai_credits_monthly', null, 0, '{}'::jsonb),
  ('free', 'member_management', true, null, '{}'::jsonb),
  ('free', 'classes_scheduling', true, null, '{}'::jsonb),
  ('free', 'check_ins', true, null, '{}'::jsonb),
  ('free', 'manual_payment_recording', true, null, '{}'::jsonb),
  ('free', 'basic_waivers', true, null, '{}'::jsonb),
  ('free', 'waivers_esign', false, null, '{}'::jsonb),
  ('free', 'public_page_publish', true, null, '{}'::jsonb),
  ('free', 'invite_links_qr', true, null, '{}'::jsonb),
  ('free', 'self_serve_join_approval', true, null, '{}'::jsonb),
  ('free', 'member_payments', false, null, '{}'::jsonb),
  ('free', 'kruxt_subscription_billing', false, null, '{}'::jsonb),
  ('free', 'payment_provider_connection', false, null, '{}'::jsonb),
  ('free', 'refunds_credits', false, null, '{}'::jsonb),
  ('free', 'dunning_retry', false, null, '{}'::jsonb),
  ('free', 'white_label_basic', false, null, '{}'::jsonb),
  ('free', 'white_label_full', false, null, '{}'::jsonb),
  ('free', 'staff_scheduling', false, null, '{}'::jsonb),
  ('free', 'pt_assignment', false, null, '{}'::jsonb),
  ('free', 'workout_plans', false, null, '{}'::jsonb),
  ('free', 'private_coaching_workspace', false, null, '{}'::jsonb),
  ('free', 'custom_staff_roles', false, null, '{}'::jsonb),
  ('free', 'basic_reports_exports', false, null, '{}'::jsonb),
  ('free', 'advanced_analytics', false, null, '{}'::jsonb),
  ('free', 'automations', false, null, '{}'::jsonb),
  ('free', 'wearable_integrations', false, null, '{}'::jsonb),
  ('free', 'ai_program_generator', false, null, '{}'::jsonb),
  ('free', 'ai_churn_prediction', false, null, '{}'::jsonb),
  ('free', 'ai_admin_copilot', false, null, '{"availableAsAddon":false}'::jsonb),
  ('free', 'ai_schedule_optimization', false, null, '{"availableAsAddon":false}'::jsonb),
  ('free', 'cross_location_reporting', false, null, '{}'::jsonb),
  ('free', 'sso', false, null, '{}'::jsonb),
  ('free', 'api_access', false, null, '{"availableAsAddon":false}'::jsonb),
  ('free', 'custom_dpa_residency', false, null, '{}'::jsonb),
  ('free', 'per_gym_entitlement_overrides', false, null, '{}'::jsonb),
  ('free', 'dsar_handling', true, null, '{"neverGated":true}'::jsonb),
  ('free', 'data_export', true, null, '{"neverGated":true}'::jsonb),
  ('free', 'retention_override', false, null, '{}'::jsonb),
  ('free', 'audit_activity_view', true, null, '{"neverGated":true}'::jsonb),

  ('starter', 'member_cap', null, 200, '{}'::jsonb),
  ('starter', 'locations_cap', null, 1, '{}'::jsonb),
  ('starter', 'staff_seats', null, 5, '{}'::jsonb),
  ('starter', 'storage_gb', null, 10, '{}'::jsonb),
  ('starter', 'api_rate_per_minute', null, 120, '{}'::jsonb),
  ('starter', 'ai_credits_monthly', null, 0, '{}'::jsonb),
  ('starter', 'member_management', true, null, '{}'::jsonb),
  ('starter', 'classes_scheduling', true, null, '{}'::jsonb),
  ('starter', 'check_ins', true, null, '{}'::jsonb),
  ('starter', 'manual_payment_recording', true, null, '{}'::jsonb),
  ('starter', 'basic_waivers', true, null, '{}'::jsonb),
  ('starter', 'waivers_esign', true, null, '{}'::jsonb),
  ('starter', 'public_page_publish', true, null, '{}'::jsonb),
  ('starter', 'invite_links_qr', true, null, '{}'::jsonb),
  ('starter', 'self_serve_join_approval', true, null, '{}'::jsonb),
  ('starter', 'member_payments', true, null, '{}'::jsonb),
  ('starter', 'kruxt_subscription_billing', true, null, '{}'::jsonb),
  ('starter', 'payment_provider_connection', true, null, '{}'::jsonb),
  ('starter', 'refunds_credits', true, null, '{}'::jsonb),
  ('starter', 'dunning_retry', false, null, '{}'::jsonb),
  ('starter', 'white_label_basic', true, null, '{}'::jsonb),
  ('starter', 'white_label_full', false, null, '{}'::jsonb),
  ('starter', 'staff_scheduling', true, null, '{}'::jsonb),
  ('starter', 'pt_assignment', true, null, '{}'::jsonb),
  ('starter', 'workout_plans', true, null, '{}'::jsonb),
  ('starter', 'private_coaching_workspace', false, null, '{}'::jsonb),
  ('starter', 'custom_staff_roles', false, null, '{}'::jsonb),
  ('starter', 'basic_reports_exports', true, null, '{}'::jsonb),
  ('starter', 'advanced_analytics', false, null, '{}'::jsonb),
  ('starter', 'automations', false, null, '{}'::jsonb),
  ('starter', 'wearable_integrations', false, null, '{}'::jsonb),
  ('starter', 'ai_program_generator', false, null, '{}'::jsonb),
  ('starter', 'ai_churn_prediction', false, null, '{}'::jsonb),
  ('starter', 'ai_admin_copilot', false, null, '{"availableAsAddon":false}'::jsonb),
  ('starter', 'ai_schedule_optimization', false, null, '{"availableAsAddon":false}'::jsonb),
  ('starter', 'cross_location_reporting', false, null, '{}'::jsonb),
  ('starter', 'sso', false, null, '{}'::jsonb),
  ('starter', 'api_access', false, null, '{"availableAsAddon":false}'::jsonb),
  ('starter', 'custom_dpa_residency', false, null, '{}'::jsonb),
  ('starter', 'per_gym_entitlement_overrides', false, null, '{}'::jsonb),
  ('starter', 'dsar_handling', true, null, '{"neverGated":true}'::jsonb),
  ('starter', 'data_export', true, null, '{"neverGated":true}'::jsonb),
  ('starter', 'retention_override', false, null, '{}'::jsonb),
  ('starter', 'audit_activity_view', true, null, '{"neverGated":true}'::jsonb),

  ('pro', 'member_cap', null, 2147483647, '{"displayValue":"Unlimited"}'::jsonb),
  ('pro', 'locations_cap', null, 1, '{}'::jsonb),
  ('pro', 'staff_seats', null, 2147483647, '{"displayValue":"Unlimited"}'::jsonb),
  ('pro', 'storage_gb', null, 100, '{}'::jsonb),
  ('pro', 'api_rate_per_minute', null, 600, '{}'::jsonb),
  ('pro', 'ai_credits_monthly', null, 500, '{}'::jsonb),
  ('pro', 'member_management', true, null, '{}'::jsonb),
  ('pro', 'classes_scheduling', true, null, '{}'::jsonb),
  ('pro', 'check_ins', true, null, '{}'::jsonb),
  ('pro', 'manual_payment_recording', true, null, '{}'::jsonb),
  ('pro', 'basic_waivers', true, null, '{}'::jsonb),
  ('pro', 'waivers_esign', true, null, '{}'::jsonb),
  ('pro', 'public_page_publish', true, null, '{}'::jsonb),
  ('pro', 'invite_links_qr', true, null, '{}'::jsonb),
  ('pro', 'self_serve_join_approval', true, null, '{}'::jsonb),
  ('pro', 'member_payments', true, null, '{}'::jsonb),
  ('pro', 'kruxt_subscription_billing', true, null, '{}'::jsonb),
  ('pro', 'payment_provider_connection', true, null, '{}'::jsonb),
  ('pro', 'refunds_credits', true, null, '{}'::jsonb),
  ('pro', 'dunning_retry', true, null, '{}'::jsonb),
  ('pro', 'white_label_basic', true, null, '{}'::jsonb),
  ('pro', 'white_label_full', true, null, '{}'::jsonb),
  ('pro', 'staff_scheduling', true, null, '{}'::jsonb),
  ('pro', 'pt_assignment', true, null, '{}'::jsonb),
  ('pro', 'workout_plans', true, null, '{}'::jsonb),
  ('pro', 'private_coaching_workspace', true, null, '{}'::jsonb),
  ('pro', 'custom_staff_roles', true, null, '{}'::jsonb),
  ('pro', 'basic_reports_exports', true, null, '{}'::jsonb),
  ('pro', 'advanced_analytics', true, null, '{}'::jsonb),
  ('pro', 'automations', true, null, '{}'::jsonb),
  ('pro', 'wearable_integrations', true, null, '{}'::jsonb),
  ('pro', 'ai_program_generator', true, null, '{}'::jsonb),
  ('pro', 'ai_churn_prediction', true, null, '{}'::jsonb),
  ('pro', 'ai_admin_copilot', false, null, '{"availableAsAddon":true}'::jsonb),
  ('pro', 'ai_schedule_optimization', false, null, '{"availableAsAddon":true}'::jsonb),
  ('pro', 'cross_location_reporting', false, null, '{}'::jsonb),
  ('pro', 'sso', false, null, '{}'::jsonb),
  ('pro', 'api_access', false, null, '{"availableAsAddon":true}'::jsonb),
  ('pro', 'custom_dpa_residency', false, null, '{}'::jsonb),
  ('pro', 'per_gym_entitlement_overrides', false, null, '{}'::jsonb),
  ('pro', 'dsar_handling', true, null, '{"neverGated":true}'::jsonb),
  ('pro', 'data_export', true, null, '{"neverGated":true}'::jsonb),
  ('pro', 'retention_override', false, null, '{}'::jsonb),
  ('pro', 'audit_activity_view', true, null, '{"neverGated":true}'::jsonb),

  ('enterprise', 'member_cap', null, 2147483647, '{"displayValue":"Unlimited"}'::jsonb),
  ('enterprise', 'locations_cap', null, 2147483647, '{"displayValue":"Multi"}'::jsonb),
  ('enterprise', 'staff_seats', null, 2147483647, '{"displayValue":"Unlimited"}'::jsonb),
  ('enterprise', 'storage_gb', null, 1000, '{}'::jsonb),
  ('enterprise', 'api_rate_per_minute', null, 5000, '{}'::jsonb),
  ('enterprise', 'ai_credits_monthly', null, 2147483647, '{"displayValue":"Custom pool"}'::jsonb),
  ('enterprise', 'member_management', true, null, '{}'::jsonb),
  ('enterprise', 'classes_scheduling', true, null, '{}'::jsonb),
  ('enterprise', 'check_ins', true, null, '{}'::jsonb),
  ('enterprise', 'manual_payment_recording', true, null, '{}'::jsonb),
  ('enterprise', 'basic_waivers', true, null, '{}'::jsonb),
  ('enterprise', 'waivers_esign', true, null, '{}'::jsonb),
  ('enterprise', 'public_page_publish', true, null, '{}'::jsonb),
  ('enterprise', 'invite_links_qr', true, null, '{}'::jsonb),
  ('enterprise', 'self_serve_join_approval', true, null, '{}'::jsonb),
  ('enterprise', 'member_payments', true, null, '{}'::jsonb),
  ('enterprise', 'kruxt_subscription_billing', true, null, '{}'::jsonb),
  ('enterprise', 'payment_provider_connection', true, null, '{}'::jsonb),
  ('enterprise', 'refunds_credits', true, null, '{}'::jsonb),
  ('enterprise', 'dunning_retry', true, null, '{}'::jsonb),
  ('enterprise', 'white_label_basic', true, null, '{}'::jsonb),
  ('enterprise', 'white_label_full', true, null, '{}'::jsonb),
  ('enterprise', 'staff_scheduling', true, null, '{}'::jsonb),
  ('enterprise', 'pt_assignment', true, null, '{}'::jsonb),
  ('enterprise', 'workout_plans', true, null, '{}'::jsonb),
  ('enterprise', 'private_coaching_workspace', true, null, '{}'::jsonb),
  ('enterprise', 'custom_staff_roles', true, null, '{}'::jsonb),
  ('enterprise', 'basic_reports_exports', true, null, '{}'::jsonb),
  ('enterprise', 'advanced_analytics', true, null, '{}'::jsonb),
  ('enterprise', 'automations', true, null, '{}'::jsonb),
  ('enterprise', 'wearable_integrations', true, null, '{}'::jsonb),
  ('enterprise', 'ai_program_generator', true, null, '{}'::jsonb),
  ('enterprise', 'ai_churn_prediction', true, null, '{}'::jsonb),
  ('enterprise', 'ai_admin_copilot', true, null, '{}'::jsonb),
  ('enterprise', 'ai_schedule_optimization', true, null, '{}'::jsonb),
  ('enterprise', 'cross_location_reporting', true, null, '{}'::jsonb),
  ('enterprise', 'sso', true, null, '{}'::jsonb),
  ('enterprise', 'api_access', true, null, '{}'::jsonb),
  ('enterprise', 'custom_dpa_residency', true, null, '{}'::jsonb),
  ('enterprise', 'per_gym_entitlement_overrides', true, null, '{}'::jsonb),
  ('enterprise', 'dsar_handling', true, null, '{"neverGated":true}'::jsonb),
  ('enterprise', 'data_export', true, null, '{"neverGated":true}'::jsonb),
  ('enterprise', 'retention_override', true, null, '{}'::jsonb),
  ('enterprise', 'audit_activity_view', true, null, '{"neverGated":true}'::jsonb)
on conflict (template_key, capability_key) do update
set
  bool_value = excluded.bool_value,
  limit_value = excluded.limit_value,
  metadata = public.platform_entitlement_template_capabilities.metadata || excluded.metadata,
  updated_at = now();

insert into public.platform_plans (
  code,
  name,
  description,
  is_active,
  amount_cents,
  currency,
  billing_period,
  trial_days,
  modules,
  entitlement_template_key,
  metadata
)
values
  ('free', 'Launch', 'Free KRUXT launch tier with community support and hard usage limits.', true, 0, 'EUR', 'monthly', 0, array['core', 'community'], 'free', '{"source":"staff_enforcement_templates","priceAnchor":"free"}'::jsonb),
  ('starter', 'Starter', 'Core paid gym operations with Starter entitlement defaults.', true, 3900, 'EUR', 'monthly', 14, array['core', 'operations', 'payments'], 'starter', '{"source":"staff_enforcement_templates","priceAnchor":"starter_39"}'::jsonb),
  ('pro', 'Pro', 'Full operating tier for BZone-style gyms.', true, 12900, 'EUR', 'monthly', 14, array['core', 'operations', 'growth', 'payments', 'coaching', 'ai'], 'pro', '{"source":"staff_enforcement_templates","priceAnchor":"pro_129"}'::jsonb),
  ('enterprise', 'Enterprise', 'Custom enterprise tenant operating tier with expanded limits.', true, 0, 'EUR', 'monthly', 30, array['core', 'operations', 'growth', 'payments', 'compliance', 'enterprise'], 'enterprise', '{"source":"staff_enforcement_templates","priceModel":"custom"}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  trial_days = excluded.trial_days,
  modules = excluded.modules,
  entitlement_template_key = excluded.entitlement_template_key,
  metadata = public.platform_plans.metadata || excluded.metadata,
  updated_at = now();

create table if not exists public.gym_member_access_verifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  verifier_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  justification text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > verified_at)
);

create index if not exists idx_gym_member_access_verifications_lookup
  on public.gym_member_access_verifications(gym_id, verifier_user_id, member_user_id, expires_at desc);

drop trigger if exists trg_gym_member_access_verifications_set_updated_at on public.gym_member_access_verifications;
create trigger trg_gym_member_access_verifications_set_updated_at
before update on public.gym_member_access_verifications
for each row execute function public.set_updated_at();

create or replace function public.gym_is_owner(
  p_gym_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_service_role()
    or exists (
      select 1
      from public.gyms g
      where g.id = p_gym_id
        and g.owner_user_id = p_actor
    )
    or exists (
      select 1
      from public.gym_memberships gm
      where gm.gym_id = p_gym_id
        and gm.user_id = p_actor
        and gm.role = 'leader'
        and gm.membership_status in ('trial', 'active')
    );
$$;

create or replace function public.gym_is_officer(
  p_gym_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_actor
      and gm.role = 'officer'
      and gm.membership_status in ('trial', 'active')
  );
$$;

create or replace function public.gym_is_coach(
  p_gym_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_actor
      and gm.role = 'coach'
      and gm.membership_status in ('trial', 'active')
  );
$$;

create or replace function public.gym_is_member_role(
  p_gym_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_actor
      and gm.role = 'member'
      and gm.membership_status in ('trial', 'active', 'paused')
  );
$$;

create or replace function public.gym_owns_athlete(
  p_gym_id uuid,
  p_actor uuid,
  p_member_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = p_gym_id
      and gm.user_id = p_member_user_id
      and gm.coach_user_id = p_actor
      and gm.role = 'member'
      and gm.membership_status in ('trial', 'active', 'paused')
  );
$$;

create or replace function public.gym_has_member_access_verification(
  p_gym_id uuid,
  p_actor uuid,
  p_member_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_member_access_verifications gmav
    where gmav.gym_id = p_gym_id
      and gmav.verifier_user_id = p_actor
      and gmav.member_user_id = p_member_user_id
      and gmav.expires_at > now()
  );
$$;

create or replace function public.gym_actor_has_mfa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role() or coalesce(auth.jwt()->>'aal', '') = 'aal2';
$$;

create or replace function public.gym_capability_enabled(
  p_gym_id uuid,
  p_capability_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_capability_key, '')));
  v_template_key text;
  v_enabled boolean;
begin
  if p_gym_id is null or v_key = '' then
    return false;
  end if;

  if v_key in ('coaching_workspace', 'pt_coach_coaching_workspace') then
    v_key := 'private_coaching_workspace';
  elsif v_key = 'checkins' then
    v_key := 'check_ins';
  elsif v_key = 'manual_payments_invoices' then
    v_key := 'manual_payment_recording';
  elsif v_key = 'gym_member_billing_stripe' then
    v_key := 'member_payments';
  elsif v_key = 'public_page_invites' then
    v_key := 'invite_links_qr';
  elsif v_key = 'versioned_waivers_esign' then
    v_key := 'waivers_esign';
  elsif v_key = 'audit_activity_log' then
    v_key := 'audit_activity_view';
  elsif v_key = 'gdpr_dsar_handling' then
    v_key := 'dsar_handling';
  end if;

  select gta.template_key
  into v_template_key
  from public.gym_entitlement_template_assignments gta
  join public.platform_entitlement_templates pet
    on pet.template_key = gta.template_key
   and pet.is_active = true
  where gta.gym_id = p_gym_id
  limit 1;

  if v_template_key is null then
    select pp.entitlement_template_key
    into v_template_key
    from public.gym_platform_subscriptions gps
    join public.platform_plans pp on pp.id = gps.platform_plan_id
    where gps.gym_id = p_gym_id
      and gps.status in ('trialing', 'active', 'past_due', 'unpaid')
      and pp.entitlement_template_key is not null
    order by gps.created_at desc
    limit 1;
  end if;

  select coalesce(go.bool_value, ptc.bool_value, c.global_bool_default)
  into v_enabled
  from public.platform_capability_catalog c
  left join public.platform_entitlement_template_capabilities ptc
    on ptc.template_key = v_template_key
   and ptc.capability_key = c.capability_key
  left join public.gym_capability_overrides go
    on go.gym_id = p_gym_id
   and go.capability_key = c.capability_key
  where c.capability_key = v_key
    and c.value_type = 'boolean'
  limit 1;

  return coalesce(v_enabled, false);
end;
$$;

create or replace function public.gym_staff_can(
  p_gym_id uuid,
  p_action text,
  p_member_user_id uuid default null,
  p_class_id uuid default null,
  p_requires_mfa boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_class_coach uuid;
begin
  if public.is_service_role() then
    return true;
  end if;

  if v_actor is null or p_gym_id is null or v_action = '' then
    return false;
  end if;

  if p_requires_mfa and not public.gym_actor_has_mfa() then
    return false;
  end if;

  if v_action in ('coaching.read', 'coaching.plan.write', 'coaching.plan.publish', 'coaching.exercise.swap', 'coaching.message') then
    if not public.gym_capability_enabled(p_gym_id, 'private_coaching_workspace') then
      return false;
    end if;

    if public.gym_is_owner(p_gym_id, v_actor) then
      return true;
    end if;

    if p_member_user_id is null and public.gym_is_officer(p_gym_id, v_actor) and v_action = 'coaching.read' then
      return true;
    end if;

    if p_member_user_id is not null and public.gym_owns_athlete(p_gym_id, v_actor, p_member_user_id) then
      return true;
    end if;

    return coalesce(p_member_user_id = v_actor, false) and v_action = 'coaching.message';
  end if;

  if v_action = 'member.pii.full' then
    return public.gym_is_owner(p_gym_id, v_actor)
      or coalesce(p_member_user_id = v_actor, false)
      or (public.gym_is_officer(p_gym_id, v_actor) and public.gym_has_member_access_verification(p_gym_id, v_actor, p_member_user_id))
      or public.gym_owns_athlete(p_gym_id, v_actor, p_member_user_id);
  end if;

  if v_action in ('billing.record_payment', 'billing.retry_payment') then
    return public.gym_capability_enabled(p_gym_id, 'member_payments')
      and public.gym_actor_has_mfa()
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  if v_action = 'billing.refund_credit' then
    return public.gym_capability_enabled(p_gym_id, 'refunds_credits')
      and public.gym_actor_has_mfa()
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  if v_action = 'billing.edit_pricing' then
    return public.gym_capability_enabled(p_gym_id, 'member_payments')
      and public.gym_actor_has_mfa()
      and public.gym_is_owner(p_gym_id, v_actor);
  end if;

  if v_action = 'staff.invite' then
    return public.gym_is_owner(p_gym_id, v_actor);
  end if;

  if v_action = 'member.profile_invite' then
    return public.gym_is_owner(p_gym_id, v_actor)
      or public.gym_is_officer(p_gym_id, v_actor)
      or public.gym_is_coach(p_gym_id, v_actor);
  end if;

  if v_action in ('class.edit', 'class.cancel', 'class.capacity') then
    if not public.gym_capability_enabled(p_gym_id, 'classes_scheduling') then
      return false;
    end if;

    if public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor) then
      return true;
    end if;

    if p_class_id is null then
      return false;
    end if;

    select gc.coach_user_id into v_class_coach
    from public.gym_classes gc
    where gc.id = p_class_id
      and gc.gym_id = p_gym_id;

    return v_class_coach = v_actor;
  end if;

  if v_action = 'class.assign_coach' then
    return public.gym_capability_enabled(p_gym_id, 'classes_scheduling')
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  if v_action = 'settings.edit_public_draft' then
    return public.gym_capability_enabled(p_gym_id, 'public_page_publish')
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  if v_action in ('settings.publish', 'settings.identity', 'settings.security', 'danger.destructive') then
    return public.gym_is_owner(p_gym_id, v_actor);
  end if;

  if v_action = 'dsar.view' then
    return public.gym_capability_enabled(p_gym_id, 'dsar_handling')
      and (
        public.gym_is_owner(p_gym_id, v_actor)
        or public.gym_is_officer(p_gym_id, v_actor)
        or coalesce(p_member_user_id = v_actor, false)
      );
  end if;

  if v_action = 'dsar.export' then
    return public.gym_capability_enabled(p_gym_id, 'data_export')
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  if v_action = 'dsar.erase' then
    return public.gym_capability_enabled(p_gym_id, 'dsar_handling')
      and public.gym_is_owner(p_gym_id, v_actor);
  end if;

  if v_action = 'audit.view' then
    return public.gym_capability_enabled(p_gym_id, 'audit_activity_view')
      and (public.gym_is_owner(p_gym_id, v_actor) or public.gym_is_officer(p_gym_id, v_actor));
  end if;

  return false;
end;
$$;

alter table public.gym_member_access_verifications enable row level security;

drop policy if exists gym_member_access_verifications_select on public.gym_member_access_verifications;
create policy gym_member_access_verifications_select
on public.gym_member_access_verifications for select to authenticated
using (
  public.is_service_role()
  or public.gym_is_owner(gym_id, auth.uid())
  or verifier_user_id = auth.uid()
);

drop policy if exists gym_member_access_verifications_insert on public.gym_member_access_verifications;
create policy gym_member_access_verifications_insert
on public.gym_member_access_verifications for insert to authenticated
with check (
  public.is_service_role()
  or public.gym_is_owner(gym_id, auth.uid())
  or public.gym_is_officer(gym_id, auth.uid())
);

grant select, insert on public.gym_member_access_verifications to authenticated;
grant select, insert, update, delete on public.gym_member_access_verifications to service_role;

revoke all on function public.gym_is_owner(uuid, uuid) from public;
grant execute on function public.gym_is_owner(uuid, uuid) to authenticated;
grant execute on function public.gym_is_owner(uuid, uuid) to service_role;

revoke all on function public.gym_is_officer(uuid, uuid) from public;
grant execute on function public.gym_is_officer(uuid, uuid) to authenticated;
grant execute on function public.gym_is_officer(uuid, uuid) to service_role;

revoke all on function public.gym_is_coach(uuid, uuid) from public;
grant execute on function public.gym_is_coach(uuid, uuid) to authenticated;
grant execute on function public.gym_is_coach(uuid, uuid) to service_role;

revoke all on function public.gym_is_member_role(uuid, uuid) from public;
grant execute on function public.gym_is_member_role(uuid, uuid) to authenticated;
grant execute on function public.gym_is_member_role(uuid, uuid) to service_role;

revoke all on function public.gym_owns_athlete(uuid, uuid, uuid) from public;
grant execute on function public.gym_owns_athlete(uuid, uuid, uuid) to authenticated;
grant execute on function public.gym_owns_athlete(uuid, uuid, uuid) to service_role;

revoke all on function public.gym_has_member_access_verification(uuid, uuid, uuid) from public;
grant execute on function public.gym_has_member_access_verification(uuid, uuid, uuid) to authenticated;
grant execute on function public.gym_has_member_access_verification(uuid, uuid, uuid) to service_role;

revoke all on function public.gym_actor_has_mfa() from public;
grant execute on function public.gym_actor_has_mfa() to authenticated;
grant execute on function public.gym_actor_has_mfa() to service_role;

revoke all on function public.gym_staff_can(uuid, text, uuid, uuid, boolean) from public;
grant execute on function public.gym_staff_can(uuid, text, uuid, uuid, boolean) to authenticated;
grant execute on function public.gym_staff_can(uuid, text, uuid, uuid, boolean) to service_role;
