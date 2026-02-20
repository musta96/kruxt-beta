-- KRUXT beta part 5 (s005)
-- Platform control plane + governance:
-- 1) Founder/operator control-plane roles and permissions
-- 2) Delegated, time-boxed gym support access grants and sessions
-- 3) Platform KPI snapshots and global feature override model
-- 4) Data-product governance primitives for compliant monetization

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.platform_operator_role as enum (
    'founder',
    'ops_admin',
    'support_admin',
    'compliance_admin',
    'analyst',
    'read_only'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_access_grant_status as enum (
    'requested',
    'approved',
    'denied',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.support_access_session_status as enum ('active', 'ended', 'terminated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_status as enum ('prospect', 'active', 'suspended', 'terminated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_product_access_level as enum ('aggregate_anonymous', 'pseudonymous');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_grant_status as enum (
    'requested',
    'approved',
    'denied',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_partner_export_status as enum (
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- PLATFORM OPERATOR RBAC TABLES
-- =====================================================

create table if not exists public.platform_permission_catalog (
  permission_key text primary key,
  category text not null,
  label text not null,
  description text,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permission_key = lower(permission_key))
);

create table if not exists public.platform_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.platform_operator_role not null,
  permission_key text not null references public.platform_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, permission_key)
);

create table if not exists public.platform_operator_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.platform_operator_role not null default 'read_only',
  is_active boolean not null default true,
  mfa_required boolean not null default true,
  last_login_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_operator_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  permission_key text not null references public.platform_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null,
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

-- =====================================================
-- DELEGATED GYM SUPPORT ACCESS (HIGH-SECURITY)
-- =====================================================

create table if not exists public.gym_support_access_grants (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  operator_user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  requested_by_user_id uuid references public.profiles(id) on delete set null,
  approved_by_user_id uuid references public.profiles(id) on delete set null,
  status public.support_access_grant_status not null default 'requested',
  permission_scope text[] not null default '{}'::text[],
  reason text not null,
  note text,
  starts_at timestamptz,
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    ends_at is null
    or starts_at is null
    or ends_at > starts_at
  )
);

create table if not exists public.gym_support_access_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.gym_support_access_grants(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  operator_user_id uuid not null references public.platform_operator_accounts(user_id) on delete cascade,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  session_status public.support_access_session_status not null default 'active',
  justification text not null,
  actions_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  terminated_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- =====================================================
-- PLATFORM CONTROL PLANE SNAPSHOTS + FLAGS
-- =====================================================

create table if not exists public.platform_kpi_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null unique,
  total_users integer not null default 0 check (total_users >= 0),
  active_users_7d integer not null default 0 check (active_users_7d >= 0),
  active_gyms_7d integer not null default 0 check (active_gyms_7d >= 0),
  workouts_logged_count integer not null default 0 check (workouts_logged_count >= 0),
  proof_posts_count integer not null default 0 check (proof_posts_count >= 0),
  class_bookings_count integer not null default 0 check (class_bookings_count >= 0),
  support_tickets_open integer not null default 0 check (support_tickets_open >= 0),
  connected_devices_count integer not null default 0 check (connected_devices_count >= 0),
  mrr_cents integer not null default 0 check (mrr_cents >= 0),
  churn_rate_percent numeric(5,2) check (churn_rate_percent is null or (churn_rate_percent >= 0 and churn_rate_percent <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  target_scope text not null check (target_scope in ('global', 'region', 'segment')),
  target_value text not null default 'all',
  enabled boolean not null default true,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(feature_key, target_scope, target_value)
);

-- =====================================================
-- DATA MONETIZATION GOVERNANCE (COMPLIANCE-BY-DESIGN)
-- =====================================================

create table if not exists public.user_data_sharing_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allow_aggregated_analytics boolean not null default true,
  allow_third_party_aggregated_sharing boolean not null default false,
  allow_pseudonymous_research boolean not null default false,
  source text not null default 'in_app',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_partners (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  contact_email text not null,
  country_code char(2),
  status public.data_partner_status not null default 'prospect',
  dpa_signed_at timestamptz,
  dpa_reference text,
  allowed_regions text[] not null default '{}'::text[],
  prohibited_data_categories text[] not null default '{}'::text[],
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  access_level public.data_product_access_level not null default 'aggregate_anonymous',
  min_k_anonymity integer not null default 50 check (min_k_anonymity >= 10),
  requires_user_opt_in boolean not null default true,
  allowed_metrics text[] not null default '{}'::text[],
  retention_days integer check (retention_days is null or retention_days > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_partner_access_grants (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  product_id uuid not null references public.data_products(id) on delete cascade,
  status public.data_partner_grant_status not null default 'requested',
  legal_basis text not null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  unique(partner_id, product_id)
);

create table if not exists public.data_partner_exports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.data_partners(id) on delete cascade,
  product_id uuid not null references public.data_products(id) on delete cascade,
  access_grant_id uuid references public.data_partner_access_grants(id) on delete set null,
  export_status public.data_partner_export_status not null default 'queued',
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  generated_by uuid references public.profiles(id) on delete set null,
  export_level public.data_product_access_level not null default 'aggregate_anonymous',
  rows_exported integer not null default 0 check (rows_exported >= 0),
  includes_personal_data boolean not null default false,
  output_uri text,
  checksum_sha256 text,
  generated_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (export_level = 'aggregate_anonymous' and includes_personal_data = false)
    or export_level = 'pseudonymous'
  )
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_platform_role_permissions_role
  on public.platform_role_permissions(role);
create index if not exists idx_platform_operator_accounts_role_active
  on public.platform_operator_accounts(role, is_active);
create index if not exists idx_platform_operator_permission_overrides_user
  on public.platform_operator_permission_overrides(user_id);
create index if not exists idx_gym_support_access_grants_lookup
  on public.gym_support_access_grants(gym_id, operator_user_id, status, ends_at);
create index if not exists idx_gym_support_access_sessions_lookup
  on public.gym_support_access_sessions(gym_id, operator_user_id, session_status, started_at desc);
create index if not exists idx_platform_kpi_daily_snapshots_date
  on public.platform_kpi_daily_snapshots(metric_date desc);
create index if not exists idx_platform_feature_overrides_lookup
  on public.platform_feature_overrides(feature_key, target_scope, target_value);
create index if not exists idx_user_data_sharing_preferences_flags
  on public.user_data_sharing_preferences(allow_third_party_aggregated_sharing, allow_pseudonymous_research);
create index if not exists idx_data_partners_status
  on public.data_partners(status, created_at desc);
create index if not exists idx_data_products_access_level
  on public.data_products(access_level, requires_user_opt_in);
create index if not exists idx_data_partner_access_grants_status
  on public.data_partner_access_grants(status, starts_at, ends_at);
create index if not exists idx_data_partner_exports_status
  on public.data_partner_exports(export_status, created_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_platform_permission_catalog_set_updated_at on public.platform_permission_catalog;
create trigger trg_platform_permission_catalog_set_updated_at
before update on public.platform_permission_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_role_permissions_set_updated_at on public.platform_role_permissions;
create trigger trg_platform_role_permissions_set_updated_at
before update on public.platform_role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_operator_accounts_set_updated_at on public.platform_operator_accounts;
create trigger trg_platform_operator_accounts_set_updated_at
before update on public.platform_operator_accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_operator_permission_overrides_set_updated_at on public.platform_operator_permission_overrides;
create trigger trg_platform_operator_permission_overrides_set_updated_at
before update on public.platform_operator_permission_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_support_access_grants_set_updated_at on public.gym_support_access_grants;
create trigger trg_gym_support_access_grants_set_updated_at
before update on public.gym_support_access_grants
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_support_access_sessions_set_updated_at on public.gym_support_access_sessions;
create trigger trg_gym_support_access_sessions_set_updated_at
before update on public.gym_support_access_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_kpi_daily_snapshots_set_updated_at on public.platform_kpi_daily_snapshots;
create trigger trg_platform_kpi_daily_snapshots_set_updated_at
before update on public.platform_kpi_daily_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_feature_overrides_set_updated_at on public.platform_feature_overrides;
create trigger trg_platform_feature_overrides_set_updated_at
before update on public.platform_feature_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_data_sharing_preferences_set_updated_at on public.user_data_sharing_preferences;
create trigger trg_user_data_sharing_preferences_set_updated_at
before update on public.user_data_sharing_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partners_set_updated_at on public.data_partners;
create trigger trg_data_partners_set_updated_at
before update on public.data_partners
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_products_set_updated_at on public.data_products;
create trigger trg_data_products_set_updated_at
before update on public.data_products
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partner_access_grants_set_updated_at on public.data_partner_access_grants;
create trigger trg_data_partner_access_grants_set_updated_at
before update on public.data_partner_access_grants
for each row execute function public.set_updated_at();

drop trigger if exists trg_data_partner_exports_set_updated_at on public.data_partner_exports;
create trigger trg_data_partner_exports_set_updated_at
before update on public.data_partner_exports
for each row execute function public.set_updated_at();

-- =====================================================
-- ACCESS HELPERS
-- =====================================================

insert into public.platform_permission_catalog (permission_key, category, label, description, is_sensitive)
values
  ('platform.overview.read', 'platform', 'Platform Overview Read', 'Read global cross-tenant KPI overview.', false),
  ('platform.operators.manage', 'platform', 'Operator Access Manage', 'Manage platform operator accounts and overrides.', true),
  ('platform.flags.manage', 'platform', 'Feature Override Manage', 'Manage global/segment feature overrides.', true),
  ('platform.support.access.request', 'support', 'Support Access Request', 'Request delegated access to gym-sensitive areas.', true),
  ('platform.support.access.approve', 'support', 'Support Access Approve', 'Approve/revoke delegated support access grants.', true),
  ('platform.support.sessions.manage', 'support', 'Support Session Manage', 'Start/end delegated support access sessions.', true),
  ('platform.analytics.read', 'analytics', 'Analytics Read', 'Read platform analytics and KPI snapshots.', false),
  ('platform.data_governance.manage', 'data', 'Data Governance Manage', 'Manage partners, products, grants, and exports.', true),
  ('platform.data_exports.approve', 'data', 'Data Export Approve', 'Approve data export jobs to external partners.', true),
  ('platform.compliance.read', 'compliance', 'Compliance Read', 'Read compliance/legal operational panels.', true)
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  is_active = true,
  updated_at = now();

insert into public.platform_role_permissions (role, permission_key, is_allowed)
select r.role, p.permission_key, r.is_allowed
from (
  values
    ('founder'::public.platform_operator_role, 'platform.overview.read', true),
    ('founder'::public.platform_operator_role, 'platform.operators.manage', true),
    ('founder'::public.platform_operator_role, 'platform.flags.manage', true),
    ('founder'::public.platform_operator_role, 'platform.support.access.request', true),
    ('founder'::public.platform_operator_role, 'platform.support.access.approve', true),
    ('founder'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('founder'::public.platform_operator_role, 'platform.analytics.read', true),
    ('founder'::public.platform_operator_role, 'platform.data_governance.manage', true),
    ('founder'::public.platform_operator_role, 'platform.data_exports.approve', true),
    ('founder'::public.platform_operator_role, 'platform.compliance.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.flags.manage', true),
    ('ops_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('ops_admin'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('ops_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('ops_admin'::public.platform_operator_role, 'platform.compliance.read', true),
    ('support_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('support_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('support_admin'::public.platform_operator_role, 'platform.support.access.approve', false),
    ('support_admin'::public.platform_operator_role, 'platform.support.sessions.manage', true),
    ('support_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.overview.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.support.access.request', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.support.access.approve', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.analytics.read', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.data_governance.manage', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.data_exports.approve', true),
    ('compliance_admin'::public.platform_operator_role, 'platform.compliance.read', true),
    ('analyst'::public.platform_operator_role, 'platform.overview.read', true),
    ('analyst'::public.platform_operator_role, 'platform.analytics.read', true),
    ('read_only'::public.platform_operator_role, 'platform.overview.read', true)
) as r(role, permission_key, is_allowed)
join public.platform_permission_catalog p
  on p.permission_key = r.permission_key
on conflict (role, permission_key) do update
set
  is_allowed = excluded.is_allowed,
  updated_at = now();

create or replace function public.is_platform_operator(_viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_operator_accounts poa
    where poa.user_id = _viewer
      and poa.is_active = true
  );
$$;

create or replace function public.platform_operator_has_permission(
  _permission_key text,
  _viewer uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.platform_operator_role;
  v_override boolean;
  v_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _viewer is null then
    return false;
  end if;

  select poa.role
  into v_role
  from public.platform_operator_accounts poa
  where poa.user_id = _viewer
    and poa.is_active = true
  limit 1;

  if v_role is null then
    return false;
  end if;

  select ppo.is_allowed
  into v_override
  from public.platform_operator_permission_overrides ppo
  where ppo.user_id = _viewer
    and ppo.permission_key = lower(_permission_key)
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select prp.is_allowed
  into v_allowed
  from public.platform_role_permissions prp
  where prp.role = v_role
    and prp.permission_key = lower(_permission_key)
  limit 1;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function public.platform_has_approved_gym_support_grant(
  _gym_id uuid,
  _operator_user_id uuid default auth.uid(),
  _required_scope text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gym_support_access_grants g
    where g.gym_id = _gym_id
      and g.operator_user_id = _operator_user_id
      and g.status = 'approved'
      and (g.starts_at is null or g.starts_at <= now())
      and (g.ends_at is null or g.ends_at >= now())
      and (
        _required_scope is null
        or _required_scope = any(g.permission_scope)
      )
  );
$$;

create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if not public.platform_operator_has_permission('platform.overview.read', v_actor) then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'totalUsers', (select count(*) from public.profiles),
    'totalGyms', (select count(*) from public.gyms),
    'workoutsLast7d', (
      select count(*)
      from public.workouts w
      where w.created_at >= now() - interval '7 day'
    ),
    'openSupportTickets', (
      select count(*)
      from public.support_tickets st
      where st.status in ('open', 'triaged', 'in_progress', 'waiting_approval')
    ),
    'activeDeviceConnections', (
      select count(*)
      from public.device_connections dc
      where dc.status = 'active'
    ),
    'latestKpiSnapshot', (
      select to_jsonb(pks.*)
      from public.platform_kpi_daily_snapshots pks
      order by pks.metric_date desc
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.platform_permission_catalog enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_operator_accounts enable row level security;
alter table public.platform_operator_permission_overrides enable row level security;
alter table public.gym_support_access_grants enable row level security;
alter table public.gym_support_access_sessions enable row level security;
alter table public.platform_kpi_daily_snapshots enable row level security;
alter table public.platform_feature_overrides enable row level security;
alter table public.user_data_sharing_preferences enable row level security;
alter table public.data_partners enable row level security;
alter table public.data_products enable row level security;
alter table public.data_partner_access_grants enable row level security;
alter table public.data_partner_exports enable row level security;

drop policy if exists platform_permission_catalog_select on public.platform_permission_catalog;
create policy platform_permission_catalog_select
on public.platform_permission_catalog for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
  or (is_active and public.is_platform_operator(auth.uid()))
);

drop policy if exists platform_permission_catalog_manage on public.platform_permission_catalog;
create policy platform_permission_catalog_manage
on public.platform_permission_catalog for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_role_permissions_select on public.platform_role_permissions;
create policy platform_role_permissions_select
on public.platform_role_permissions for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
  or public.is_platform_operator(auth.uid())
);

drop policy if exists platform_role_permissions_manage on public.platform_role_permissions;
create policy platform_role_permissions_manage
on public.platform_role_permissions for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_accounts_select on public.platform_operator_accounts;
create policy platform_operator_accounts_select
on public.platform_operator_accounts for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_accounts_manage on public.platform_operator_accounts;
create policy platform_operator_accounts_manage
on public.platform_operator_accounts for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_permission_overrides_select on public.platform_operator_permission_overrides;
create policy platform_operator_permission_overrides_select
on public.platform_operator_permission_overrides for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists platform_operator_permission_overrides_manage on public.platform_operator_permission_overrides;
create policy platform_operator_permission_overrides_manage
on public.platform_operator_permission_overrides for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.operators.manage', auth.uid())
);

drop policy if exists gym_support_access_grants_select on public.gym_support_access_grants;
create policy gym_support_access_grants_select
on public.gym_support_access_grants for select to authenticated
using (
  public.is_service_role()
  or operator_user_id = auth.uid()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
);

drop policy if exists gym_support_access_grants_insert on public.gym_support_access_grants;
create policy gym_support_access_grants_insert
on public.gym_support_access_grants for insert to authenticated
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.access.request', auth.uid())
  )
);

drop policy if exists gym_support_access_grants_update on public.gym_support_access_grants;
create policy gym_support_access_grants_update
on public.gym_support_access_grants for update to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.access.approve', auth.uid())
);

drop policy if exists gym_support_access_sessions_select on public.gym_support_access_sessions;
create policy gym_support_access_sessions_select
on public.gym_support_access_sessions for select to authenticated
using (
  public.is_service_role()
  or operator_user_id = auth.uid()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
);

drop policy if exists gym_support_access_sessions_insert on public.gym_support_access_sessions;
create policy gym_support_access_sessions_insert
on public.gym_support_access_sessions for insert to authenticated
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
    and public.platform_has_approved_gym_support_grant(gym_id, auth.uid(), null)
  )
);

drop policy if exists gym_support_access_sessions_update on public.gym_support_access_sessions;
create policy gym_support_access_sessions_update
on public.gym_support_access_sessions for update to authenticated
using (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
  )
)
with check (
  public.is_service_role()
  or (
    operator_user_id = auth.uid()
    and public.platform_operator_has_permission('platform.support.sessions.manage', auth.uid())
  )
);

drop policy if exists platform_kpi_daily_snapshots_select on public.platform_kpi_daily_snapshots;
create policy platform_kpi_daily_snapshots_select
on public.platform_kpi_daily_snapshots for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists platform_kpi_daily_snapshots_manage on public.platform_kpi_daily_snapshots;
create policy platform_kpi_daily_snapshots_manage
on public.platform_kpi_daily_snapshots for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists platform_feature_overrides_select on public.platform_feature_overrides;
create policy platform_feature_overrides_select
on public.platform_feature_overrides for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
);

drop policy if exists platform_feature_overrides_manage on public.platform_feature_overrides;
create policy platform_feature_overrides_manage
on public.platform_feature_overrides for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.flags.manage', auth.uid())
);

drop policy if exists user_data_sharing_preferences_select on public.user_data_sharing_preferences;
create policy user_data_sharing_preferences_select
on public.user_data_sharing_preferences for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
  or public.platform_operator_has_permission('platform.compliance.read', auth.uid())
);

drop policy if exists user_data_sharing_preferences_manage on public.user_data_sharing_preferences;
create policy user_data_sharing_preferences_manage
on public.user_data_sharing_preferences for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists data_partners_select on public.data_partners;
create policy data_partners_select
on public.data_partners for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partners_manage on public.data_partners;
create policy data_partners_manage
on public.data_partners for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_products_select on public.data_products;
create policy data_products_select
on public.data_products for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.analytics.read', auth.uid())
);

drop policy if exists data_products_manage on public.data_products;
create policy data_products_manage
on public.data_products for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_access_grants_select on public.data_partner_access_grants;
create policy data_partner_access_grants_select
on public.data_partner_access_grants for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partner_access_grants_manage on public.data_partner_access_grants;
create policy data_partner_access_grants_manage
on public.data_partner_access_grants for all to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_exports_select on public.data_partner_exports;
create policy data_partner_exports_select
on public.data_partner_exports for select to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);

drop policy if exists data_partner_exports_insert on public.data_partner_exports;
create policy data_partner_exports_insert
on public.data_partner_exports for insert to authenticated
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
);

drop policy if exists data_partner_exports_update on public.data_partner_exports;
create policy data_partner_exports_update
on public.data_partner_exports for update to authenticated
using (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
)
with check (
  public.is_service_role()
  or public.platform_operator_has_permission('platform.data_governance.manage', auth.uid())
  or public.platform_operator_has_permission('platform.data_exports.approve', auth.uid())
);
