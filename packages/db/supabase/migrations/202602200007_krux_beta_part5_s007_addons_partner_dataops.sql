-- KRUXT beta part 5 (s007)
-- Growth/revenue module foundations:
-- 1) B2B2C add-ons (advanced analytics/workforce/automation)
-- 2) Partner ecosystem installs + revenue events
-- 3) Governed aggregate data-product operations

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.gym_addon_category as enum (
    'analytics',
    'workforce',
    'automation',
    'engagement',
    'integrations',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gym_addon_subscription_status as enum (
    'trialing',
    'active',
    'paused',
    'past_due',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.gym_automation_run_status as enum (
    'queued',
    'running',
    'awaiting_approval',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_app_status as enum ('draft', 'active', 'suspended', 'retired');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_install_status as enum ('active', 'paused', 'revoked', 'error');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_revenue_event_status as enum ('pending', 'recognized', 'invoiced', 'paid', 'void');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_aggregation_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.anonymization_check_status as enum ('passed', 'failed', 'waived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_release_approval_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- ADD-ON TABLES
-- =====================================================

create table if not exists public.gym_addon_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category public.gym_addon_category not null,
  billing_scope public.billing_scope not null default 'b2b',
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  currency char(3) not null default 'EUR',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_addon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  addon_id uuid not null references public.gym_addon_catalog(id) on delete restrict,
  status public.gym_addon_subscription_status not null default 'trialing',
  starts_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  provider text not null default 'stripe',
  provider_subscription_id text,
  billing_reference text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique(gym_id, addon_id)
);

create table if not exists public.gym_advanced_analytics_views (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'staff' check (visibility in ('owner_only', 'staff')),
  query_spec jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_automation_playbooks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  addon_subscription_id uuid references public.gym_addon_subscriptions(id) on delete set null,
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  requires_human_approval boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_automation_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.gym_automation_playbooks(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  run_status public.gym_automation_run_status not null default 'queued',
  triggered_by text not null default 'system',
  trigger_payload jsonb not null default '{}'::jsonb,
  planned_actions jsonb not null default '[]'::jsonb,
  executed_actions jsonb not null default '[]'::jsonb,
  requires_human_approval boolean not null default true,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- PARTNER ECOSYSTEM TABLES
-- =====================================================

create table if not exists public.partner_marketplace_apps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  app_code text not null unique,
  name text not null,
  description text,
  category text not null,
  status public.partner_app_status not null default 'draft',
  pricing_model text not null default 'subscription'
    check (pricing_model in ('subscription', 'usage', 'revshare', 'hybrid')),
  revenue_share_bps integer check (revenue_share_bps is null or (revenue_share_bps >= 0 and revenue_share_bps <= 10000)),
  install_url text,
  docs_url text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_partner_app_installs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  partner_app_id uuid not null references public.partner_marketplace_apps(id) on delete cascade,
  install_status public.partner_install_status not null default 'active',
  external_account_id text,
  billing_reference text,
  installed_by uuid references public.profiles(id) on delete set null,
  installed_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, partner_app_id)
);

create table if not exists public.partner_revenue_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  partner_app_id uuid references public.partner_marketplace_apps(id) on delete set null,
  event_type text not null check (event_type in ('subscription_fee', 'usage_fee', 'revshare_credit', 'referral_bonus')),
  event_status public.partner_revenue_event_status not null default 'pending',
  period_start date,
  period_end date,
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  platform_amount_cents integer not null default 0 check (platform_amount_cents >= 0),
  partner_amount_cents integer not null default 0 check (partner_amount_cents >= 0),
  currency char(3) not null default 'EUR',
  source_reference text,
  recognized_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    gross_amount_cents = platform_amount_cents + partner_amount_cents
    or gross_amount_cents = 0
  )
);

create unique index if not exists uq_partner_revenue_events_source
  on public.partner_revenue_events(partner_app_id, source_reference, event_type)
  where source_reference is not null;

-- =====================================================
-- DATA OPS TABLES
-- =====================================================

create table if not exists public.data_aggregation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.data_products(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  job_status public.data_aggregation_job_status not null default 'queued',
  source_window_start timestamptz,
  source_window_end timestamptz,
  aggregation_spec jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  total_source_rows integer not null default 0 check (total_source_rows >= 0),
  output_row_count integer not null default 0 check (output_row_count >= 0),
  k_anonymity_floor integer not null default 50 check (k_anonymity_floor >= 10),
  min_group_size_observed integer,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    source_window_end is null
    or source_window_start is null
    or source_window_end > source_window_start
  )
);

create table if not exists public.data_anonymization_checks (
  id uuid primary key default gen_random_uuid(),
  aggregation_job_id uuid not null references public.data_aggregation_jobs(id) on delete cascade,
  check_type text not null check (check_type in ('k_anonymity', 'l_diversity', 't_closeness', 'small_cell_suppression', 'manual_review')),
  status public.anonymization_check_status not null default 'passed',
  threshold_value numeric,
  observed_value numeric,
  details jsonb not null default '{}'::jsonb,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(aggregation_job_id, check_type)
);

create table if not exists public.data_release_approvals (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.data_partner_exports(id) on delete cascade,
  required_approval_type text not null check (required_approval_type in ('compliance', 'security', 'business')),
  status public.data_release_approval_status not null default 'pending',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(export_id, required_approval_type)
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_gym_addon_subscriptions_gym_status
  on public.gym_addon_subscriptions(gym_id, status, ends_at);
create index if not exists idx_gym_advanced_analytics_views_gym
  on public.gym_advanced_analytics_views(gym_id, visibility);
create index if not exists idx_gym_automation_playbooks_gym_active
  on public.gym_automation_playbooks(gym_id, is_active);
create index if not exists idx_gym_automation_runs_gym_status
  on public.gym_automation_runs(gym_id, run_status, created_at desc);
create index if not exists idx_partner_marketplace_apps_status
  on public.partner_marketplace_apps(status, is_active);
create index if not exists idx_gym_partner_app_installs_gym_status
  on public.gym_partner_app_installs(gym_id, install_status);
create index if not exists idx_partner_revenue_events_status_time
  on public.partner_revenue_events(event_status, created_at desc);
create index if not exists idx_data_aggregation_jobs_status_time
  on public.data_aggregation_jobs(job_status, created_at desc);
create index if not exists idx_data_release_approvals_export_status
  on public.data_release_approvals(export_id, status);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_gym_addon_catalog_set_updated_at on public.gym_addon_catalog;
create trigger trg_gym_addon_catalog_set_updated_at
before update on public.gym_addon_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_addon_subscriptions_set_updated_at on public.gym_addon_subscriptions;
create trigger trg_gym_addon_subscriptions_set_updated_at
before update on public.gym_addon_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_advanced_analytics_views_set_updated_at on public.gym_advanced_analytics_views;
create trigger trg_gym_advanced_analytics_views_set_updated_at
before update on public.gym_advanced_analytics_views
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_automation_playbooks_set_updated_at on public.gym_automation_playbooks;
create trigger trg_gym_automation_playbooks_set_updated_at
before update on public.gym_automation_playbooks
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_automation_runs_set_updated_at on public.gym_automation_runs;
create trigger trg_gym_automation_runs_set_updated_at
before update on public.gym_automation_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_partner_marketplace_apps_set_updated_at on public.partner_marketplace_apps;
create trigger trg_partner_marketplace_apps_set_updated_at
before update on public.partner_marketplace_apps
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_partner_app_installs_set_updated_at on public.gym_partner_app_installs;
create trigger trg_gym_partner_app_installs_set_updated_at
before update on public.gym_partner_app_installs
for each row execute function public.set_updated_at();

drop trigger if exists trg_partner_revenue_events_set_updated_at on public.partner_revenue_events;
create trigger trg_partner_revenue_events_set_updated_at
before update on public.partner_revenue_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_aggregation_jobs_set_updated_at on public.data_aggregation_jobs;
create trigger trg_data_aggregation_jobs_set_updated_at
before update on public.data_aggregation_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_release_approvals_set_updated_at on public.data_release_approvals;
create trigger trg_data_release_approvals_set_updated_at
before update on public.data_release_approvals
for each row execute function public.set_updated_at();

-- =====================================================
-- PERMISSION SEED
-- =====================================================

insert into public.gym_permission_catalog (permission_key, category, label, description)
values
  ('addons.manage', 'billing', 'Manage Add-ons', 'Activate and configure gym add-on subscriptions.'),
  ('automation.manage', 'ops', 'Manage Automation', 'Create and run gym automation playbooks.'),
  ('analytics.advanced.view', 'analytics', 'View Advanced Analytics', 'Access advanced analytics dashboards and saved views.'),
  ('workforce.advanced.manage', 'staff', 'Manage Advanced Workforce', 'Operate shift/time-entry advanced workflows.'),
  ('partner.apps.manage', 'integrations', 'Manage Partner Apps', 'Install and configure partner marketplace apps.')
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_active = true,
  updated_at = now();

-- =====================================================
-- RLS
-- =====================================================

alter table public.gym_addon_catalog enable row level security;
alter table public.gym_addon_subscriptions enable row level security;
alter table public.gym_advanced_analytics_views enable row level security;
alter table public.gym_automation_playbooks enable row level security;
alter table public.gym_automation_runs enable row level security;
alter table public.partner_marketplace_apps enable row level security;
alter table public.gym_partner_app_installs enable row level security;
alter table public.partner_revenue_events enable row level security;
alter table public.data_aggregation_jobs enable row level security;
alter table public.data_anonymization_checks enable row level security;
alter table public.data_release_approvals enable row level security;

drop policy if exists gym_addon_catalog_select on public.gym_addon_catalog;
create policy gym_addon_catalog_select
on public.gym_addon_catalog for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists gym_addon_catalog_manage on public.gym_addon_catalog;
create policy gym_addon_catalog_manage
on public.gym_addon_catalog for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists gym_addon_subscriptions_select on public.gym_addon_subscriptions;
create policy gym_addon_subscriptions_select
on public.gym_addon_subscriptions for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'billing.view', auth.uid())
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
);

drop policy if exists gym_addon_subscriptions_manage on public.gym_addon_subscriptions;
create policy gym_addon_subscriptions_manage
on public.gym_addon_subscriptions for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'addons.manage', auth.uid())
);

drop policy if exists gym_advanced_analytics_views_select on public.gym_advanced_analytics_views;
create policy gym_advanced_analytics_views_select
on public.gym_advanced_analytics_views for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.view', auth.uid())
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
);

drop policy if exists gym_advanced_analytics_views_manage on public.gym_advanced_analytics_views;
create policy gym_advanced_analytics_views_manage
on public.gym_advanced_analytics_views for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.advanced.view', auth.uid())
);

drop policy if exists gym_automation_playbooks_select on public.gym_automation_playbooks;
create policy gym_automation_playbooks_select
on public.gym_automation_playbooks for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_playbooks_manage on public.gym_automation_playbooks;
create policy gym_automation_playbooks_manage
on public.gym_automation_playbooks for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_runs_select on public.gym_automation_runs;
create policy gym_automation_runs_select
on public.gym_automation_runs for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists gym_automation_runs_manage on public.gym_automation_runs;
create policy gym_automation_runs_manage
on public.gym_automation_runs for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'automation.manage', auth.uid())
);

drop policy if exists partner_marketplace_apps_select on public.partner_marketplace_apps;
create policy partner_marketplace_apps_select
on public.partner_marketplace_apps for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists partner_marketplace_apps_manage on public.partner_marketplace_apps;
create policy partner_marketplace_apps_manage
on public.partner_marketplace_apps for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists gym_partner_app_installs_select on public.gym_partner_app_installs;
create policy gym_partner_app_installs_select
on public.gym_partner_app_installs for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
);

drop policy if exists gym_partner_app_installs_manage on public.gym_partner_app_installs;
create policy gym_partner_app_installs_manage
on public.gym_partner_app_installs for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'partner.apps.manage', auth.uid())
  or public.user_has_gym_permission(gym_id, 'integrations.manage', auth.uid())
);

drop policy if exists partner_revenue_events_select on public.partner_revenue_events;
create policy partner_revenue_events_select
on public.partner_revenue_events for select to authenticated
using (
  public.is_service_role()
  or (gym_id is not null and public.user_has_gym_permission(gym_id, 'billing.view', auth.uid()))
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists partner_revenue_events_manage on public.partner_revenue_events;
create policy partner_revenue_events_manage
on public.partner_revenue_events for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_aggregation_jobs_select on public.data_aggregation_jobs;
create policy data_aggregation_jobs_select
on public.data_aggregation_jobs for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_aggregation_jobs_manage on public.data_aggregation_jobs;
create policy data_aggregation_jobs_manage
on public.data_aggregation_jobs for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_anonymization_checks_select on public.data_anonymization_checks;
create policy data_anonymization_checks_select
on public.data_anonymization_checks for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_anonymization_checks_manage on public.data_anonymization_checks;
create policy data_anonymization_checks_manage
on public.data_anonymization_checks for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_release_approvals_select on public.data_release_approvals;
create policy data_release_approvals_select
on public.data_release_approvals for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_release_approvals_manage on public.data_release_approvals;
create policy data_release_approvals_manage
on public.data_release_approvals for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);
