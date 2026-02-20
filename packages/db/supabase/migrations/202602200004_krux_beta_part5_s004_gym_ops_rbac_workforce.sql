-- KRUXT beta part 5 (s004)
-- Gym operations extension:
-- 1) Granular gym permissions (role matrix + per-user overrides)
-- 2) Staff shifts and worked-hours tracking foundations
-- 3) Gym CRM leads + daily analytics snapshots for decision dashboards

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.staff_shift_status as enum (
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'missed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.staff_time_entry_status as enum ('open', 'submitted', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_lead_status as enum (
    'new',
    'contacted',
    'qualified',
    'trial_scheduled',
    'trial_completed',
    'won',
    'lost'
  );
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- RBAC TABLES
-- =====================================================

create table if not exists public.gym_permission_catalog (
  permission_key text primary key,
  category text not null,
  label text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (permission_key = lower(permission_key))
);

create table if not exists public.gym_role_permissions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role public.gym_role not null,
  permission_key text not null references public.gym_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, role, permission_key)
);

create table if not exists public.gym_user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.gym_permission_catalog(permission_key) on delete cascade,
  is_allowed boolean not null,
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, user_id, permission_key)
);

-- =====================================================
-- WORKFORCE + ANALYTICS + CRM TABLES
-- =====================================================

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null default 'Shift',
  shift_role text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.staff_shift_status not null default 'scheduled',
  hourly_rate_cents integer check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.staff_shifts(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  worked_minutes integer generated always as (
    case
      when clock_out_at is null then null
      else greatest(0, floor(extract(epoch from (clock_out_at - clock_in_at)) / 60)::integer - break_minutes)
    end
  ) stored,
  status public.staff_time_entry_status not null default 'open',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  source_channel text not null default 'admin_web',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);

create table if not exists public.gym_kpi_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  metric_date date not null,
  active_members integer not null default 0 check (active_members >= 0),
  new_memberships integer not null default 0 check (new_memberships >= 0),
  cancelled_memberships integer not null default 0 check (cancelled_memberships >= 0),
  checkins_count integer not null default 0 check (checkins_count >= 0),
  class_bookings_count integer not null default 0 check (class_bookings_count >= 0),
  class_attendance_count integer not null default 0 check (class_attendance_count >= 0),
  waitlist_promotions_count integer not null default 0 check (waitlist_promotions_count >= 0),
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  mrr_cents integer not null default 0 check (mrr_cents >= 0),
  average_class_fill_rate numeric(5,2) check (average_class_fill_rate is null or (average_class_fill_rate >= 0 and average_class_fill_rate <= 100)),
  average_chain_days numeric(6,2) check (average_chain_days is null or average_chain_days >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gym_id, metric_date)
);

create table if not exists public.gym_crm_leads (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'walk_in',
  status public.crm_lead_status not null default 'new',
  interested_services text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  converted_membership_id uuid references public.gym_memberships(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.gym_crm_leads(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null
    check (activity_type in (
      'note',
      'call',
      'email',
      'sms',
      'meeting',
      'trial_booked',
      'trial_completed',
      'status_change',
      'conversion'
    )),
  activity_at timestamptz not null default now(),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_gym_role_permissions_gym_role
  on public.gym_role_permissions(gym_id, role);
create index if not exists idx_gym_user_permission_overrides_gym_user
  on public.gym_user_permission_overrides(gym_id, user_id);
create index if not exists idx_staff_shifts_gym_time
  on public.staff_shifts(gym_id, starts_at desc);
create index if not exists idx_staff_shifts_user_time
  on public.staff_shifts(staff_user_id, starts_at desc);
create index if not exists idx_staff_time_entries_gym_time
  on public.staff_time_entries(gym_id, clock_in_at desc);
create index if not exists idx_staff_time_entries_user_time
  on public.staff_time_entries(staff_user_id, clock_in_at desc);
create index if not exists idx_gym_kpi_daily_snapshots_gym_date
  on public.gym_kpi_daily_snapshots(gym_id, metric_date desc);
create index if not exists idx_gym_crm_leads_gym_status_followup
  on public.gym_crm_leads(gym_id, status, next_follow_up_at);
create index if not exists idx_gym_crm_lead_activities_lead_time
  on public.gym_crm_lead_activities(lead_id, activity_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_gym_permission_catalog_set_updated_at on public.gym_permission_catalog;
create trigger trg_gym_permission_catalog_set_updated_at
before update on public.gym_permission_catalog
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_role_permissions_set_updated_at on public.gym_role_permissions;
create trigger trg_gym_role_permissions_set_updated_at
before update on public.gym_role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_user_permission_overrides_set_updated_at on public.gym_user_permission_overrides;
create trigger trg_gym_user_permission_overrides_set_updated_at
before update on public.gym_user_permission_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_shifts_set_updated_at on public.staff_shifts;
create trigger trg_staff_shifts_set_updated_at
before update on public.staff_shifts
for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_time_entries_set_updated_at on public.staff_time_entries;
create trigger trg_staff_time_entries_set_updated_at
before update on public.staff_time_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_kpi_daily_snapshots_set_updated_at on public.gym_kpi_daily_snapshots;
create trigger trg_gym_kpi_daily_snapshots_set_updated_at
before update on public.gym_kpi_daily_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_crm_leads_set_updated_at on public.gym_crm_leads;
create trigger trg_gym_crm_leads_set_updated_at
before update on public.gym_crm_leads
for each row execute function public.set_updated_at();

-- =====================================================
-- VALIDATION HELPERS
-- =====================================================

create or replace function public.validate_staff_shift_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.staff_user_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'staff_user_id must be active gym staff for this gym';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_shifts_validate_staff on public.staff_shifts;
create trigger trg_staff_shifts_validate_staff
before insert or update on public.staff_shifts
for each row execute function public.validate_staff_shift_assignment();

create or replace function public.validate_staff_time_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift record;
begin
  if not exists (
    select 1
    from public.gym_memberships gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.staff_user_id
      and gm.membership_status in ('trial', 'active')
      and gm.role in ('leader', 'officer', 'coach')
  ) then
    raise exception 'staff_user_id must be active gym staff for this gym';
  end if;

  if new.shift_id is not null then
    select s.gym_id, s.staff_user_id
    into v_shift
    from public.staff_shifts s
    where s.id = new.shift_id;

    if not found then
      raise exception 'shift_id is invalid';
    end if;

    if v_shift.gym_id <> new.gym_id then
      raise exception 'shift_id gym does not match gym_id';
    end if;

    if v_shift.staff_user_id <> new.staff_user_id then
      raise exception 'shift_id staff does not match staff_user_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_time_entries_validate on public.staff_time_entries;
create trigger trg_staff_time_entries_validate
before insert or update on public.staff_time_entries
for each row execute function public.validate_staff_time_entry();

-- =====================================================
-- PERMISSION MODEL HELPERS
-- =====================================================

insert into public.gym_permission_catalog (permission_key, category, label, description)
values
  ('admin.members.manage', 'admin', 'Manage Members', 'Approve memberships and update member status.'),
  ('admin.roles.manage', 'admin', 'Manage Roles', 'Assign and revoke gym staff/member roles.'),
  ('gym.brand.manage', 'settings', 'Manage Branding', 'Edit gym logos, colors, and brand settings.'),
  ('gym.features.manage', 'settings', 'Manage Feature Flags', 'Enable/disable gym modules and rollout percentages.'),
  ('ops.classes.manage', 'ops', 'Manage Classes', 'Create/update classes and schedules.'),
  ('ops.waitlist.manage', 'ops', 'Manage Waitlist', 'Promote and reorder class waitlist entries.'),
  ('ops.checkins.manage', 'ops', 'Manage Check-ins', 'Record and override access/check-in events.'),
  ('ops.waivers.manage', 'ops', 'Manage Waivers/Contracts', 'Publish and maintain legal acceptance documents.'),
  ('programs.manage', 'ops', 'Manage Programs', 'Maintain PT programs and athlete plans.'),
  ('staff.shifts.manage', 'staff', 'Manage Staff Shifts', 'Create and manage shift schedules.'),
  ('staff.time_entries.manage', 'staff', 'Manage Staff Time Entries', 'Approve and adjust worked-hour logs.'),
  ('analytics.view', 'analytics', 'View Analytics', 'Access gym KPIs and business dashboards.'),
  ('crm.leads.manage', 'crm', 'Manage CRM Leads', 'Track, update, and convert lead records.'),
  ('crm.members.export', 'crm', 'Export CRM Data', 'Export member and lead datasets.'),
  ('support.manage', 'support', 'Manage Support Queue', 'Handle support tickets and escalation queues.'),
  ('integrations.manage', 'integrations', 'Manage Integrations', 'Connect and monitor third-party providers.'),
  ('billing.view', 'billing', 'View Billing', 'View billing status, invoices, and payment telemetry.'),
  ('billing.manage', 'billing', 'Manage Billing', 'Edit billing providers and charging settings.'),
  ('compliance.manage', 'compliance', 'Manage Compliance', 'Operate privacy/compliance workflows.')
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  is_active = true,
  updated_at = now();

create or replace function public.seed_default_gym_permissions(_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gym_role_permissions (gym_id, role, permission_key, is_allowed)
  select
    _gym_id,
    d.role,
    d.permission_key,
    d.is_allowed
  from (
    values
      ('leader'::public.gym_role, 'admin.members.manage', true),
      ('leader'::public.gym_role, 'admin.roles.manage', true),
      ('leader'::public.gym_role, 'gym.brand.manage', true),
      ('leader'::public.gym_role, 'gym.features.manage', true),
      ('leader'::public.gym_role, 'ops.classes.manage', true),
      ('leader'::public.gym_role, 'ops.waitlist.manage', true),
      ('leader'::public.gym_role, 'ops.checkins.manage', true),
      ('leader'::public.gym_role, 'ops.waivers.manage', true),
      ('leader'::public.gym_role, 'programs.manage', true),
      ('leader'::public.gym_role, 'staff.shifts.manage', true),
      ('leader'::public.gym_role, 'staff.time_entries.manage', true),
      ('leader'::public.gym_role, 'analytics.view', true),
      ('leader'::public.gym_role, 'crm.leads.manage', true),
      ('leader'::public.gym_role, 'crm.members.export', true),
      ('leader'::public.gym_role, 'support.manage', true),
      ('leader'::public.gym_role, 'integrations.manage', true),
      ('leader'::public.gym_role, 'billing.view', true),
      ('leader'::public.gym_role, 'billing.manage', true),
      ('leader'::public.gym_role, 'compliance.manage', true),
      ('officer'::public.gym_role, 'admin.members.manage', true),
      ('officer'::public.gym_role, 'admin.roles.manage', true),
      ('officer'::public.gym_role, 'gym.brand.manage', true),
      ('officer'::public.gym_role, 'gym.features.manage', true),
      ('officer'::public.gym_role, 'ops.classes.manage', true),
      ('officer'::public.gym_role, 'ops.waitlist.manage', true),
      ('officer'::public.gym_role, 'ops.checkins.manage', true),
      ('officer'::public.gym_role, 'ops.waivers.manage', true),
      ('officer'::public.gym_role, 'programs.manage', true),
      ('officer'::public.gym_role, 'staff.shifts.manage', true),
      ('officer'::public.gym_role, 'staff.time_entries.manage', true),
      ('officer'::public.gym_role, 'analytics.view', true),
      ('officer'::public.gym_role, 'crm.leads.manage', true),
      ('officer'::public.gym_role, 'crm.members.export', true),
      ('officer'::public.gym_role, 'support.manage', true),
      ('officer'::public.gym_role, 'integrations.manage', true),
      ('officer'::public.gym_role, 'billing.view', true),
      ('officer'::public.gym_role, 'billing.manage', false),
      ('officer'::public.gym_role, 'compliance.manage', true),
      ('coach'::public.gym_role, 'admin.members.manage', false),
      ('coach'::public.gym_role, 'admin.roles.manage', false),
      ('coach'::public.gym_role, 'gym.brand.manage', false),
      ('coach'::public.gym_role, 'gym.features.manage', false),
      ('coach'::public.gym_role, 'ops.classes.manage', true),
      ('coach'::public.gym_role, 'ops.waitlist.manage', true),
      ('coach'::public.gym_role, 'ops.checkins.manage', true),
      ('coach'::public.gym_role, 'ops.waivers.manage', false),
      ('coach'::public.gym_role, 'programs.manage', true),
      ('coach'::public.gym_role, 'staff.shifts.manage', false),
      ('coach'::public.gym_role, 'staff.time_entries.manage', false),
      ('coach'::public.gym_role, 'analytics.view', true),
      ('coach'::public.gym_role, 'crm.leads.manage', false),
      ('coach'::public.gym_role, 'crm.members.export', false),
      ('coach'::public.gym_role, 'support.manage', false),
      ('coach'::public.gym_role, 'integrations.manage', false),
      ('coach'::public.gym_role, 'billing.view', false),
      ('coach'::public.gym_role, 'billing.manage', false),
      ('coach'::public.gym_role, 'compliance.manage', false),
      ('member'::public.gym_role, 'admin.members.manage', false),
      ('member'::public.gym_role, 'admin.roles.manage', false),
      ('member'::public.gym_role, 'gym.brand.manage', false),
      ('member'::public.gym_role, 'gym.features.manage', false),
      ('member'::public.gym_role, 'ops.classes.manage', false),
      ('member'::public.gym_role, 'ops.waitlist.manage', false),
      ('member'::public.gym_role, 'ops.checkins.manage', false),
      ('member'::public.gym_role, 'ops.waivers.manage', false),
      ('member'::public.gym_role, 'programs.manage', false),
      ('member'::public.gym_role, 'staff.shifts.manage', false),
      ('member'::public.gym_role, 'staff.time_entries.manage', false),
      ('member'::public.gym_role, 'analytics.view', false),
      ('member'::public.gym_role, 'crm.leads.manage', false),
      ('member'::public.gym_role, 'crm.members.export', false),
      ('member'::public.gym_role, 'support.manage', false),
      ('member'::public.gym_role, 'integrations.manage', false),
      ('member'::public.gym_role, 'billing.view', false),
      ('member'::public.gym_role, 'billing.manage', false),
      ('member'::public.gym_role, 'compliance.manage', false)
  ) as d(role, permission_key, is_allowed)
  on conflict (gym_id, role, permission_key) do nothing;
end;
$$;

create or replace function public.seed_default_gym_permissions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_gym_permissions(new.id);
  return new;
end;
$$;

drop trigger if exists trg_gyms_seed_default_permissions on public.gyms;
create trigger trg_gyms_seed_default_permissions
after insert on public.gyms
for each row execute function public.seed_default_gym_permissions_after_insert();

select public.seed_default_gym_permissions(g.id)
from public.gyms g;

create or replace function public.user_has_gym_permission(
  _gym_id uuid,
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
  v_role public.gym_role;
  v_override boolean;
  v_role_allowed boolean;
begin
  if public.is_service_role() then
    return true;
  end if;

  if _viewer is null then
    return false;
  end if;

  if exists (
    select 1
    from public.gyms g
    where g.id = _gym_id
      and g.owner_user_id = _viewer
  ) then
    return true;
  end if;

  select gm.role
  into v_role
  from public.gym_memberships gm
  where gm.gym_id = _gym_id
    and gm.user_id = _viewer
    and gm.membership_status in ('trial', 'active')
  order by case gm.role
    when 'leader' then 1
    when 'officer' then 2
    when 'coach' then 3
    else 4
  end
  limit 1;

  if v_role is null then
    return false;
  end if;

  select guo.is_allowed
  into v_override
  from public.gym_user_permission_overrides guo
  where guo.gym_id = _gym_id
    and guo.user_id = _viewer
    and guo.permission_key = lower(_permission_key)
  limit 1;

  if v_override is not null then
    return v_override;
  end if;

  select grp.is_allowed
  into v_role_allowed
  from public.gym_role_permissions grp
  where grp.gym_id = _gym_id
    and grp.role = v_role
    and grp.permission_key = lower(_permission_key)
  limit 1;

  return coalesce(v_role_allowed, false);
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.gym_permission_catalog enable row level security;
alter table public.gym_role_permissions enable row level security;
alter table public.gym_user_permission_overrides enable row level security;
alter table public.staff_shifts enable row level security;
alter table public.staff_time_entries enable row level security;
alter table public.gym_kpi_daily_snapshots enable row level security;
alter table public.gym_crm_leads enable row level security;
alter table public.gym_crm_lead_activities enable row level security;

drop policy if exists gym_permission_catalog_select on public.gym_permission_catalog;
create policy gym_permission_catalog_select
on public.gym_permission_catalog for select to authenticated
using (is_active = true or public.is_service_role());

drop policy if exists gym_permission_catalog_manage on public.gym_permission_catalog;
create policy gym_permission_catalog_manage
on public.gym_permission_catalog for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_role_permissions_select on public.gym_role_permissions;
create policy gym_role_permissions_select
on public.gym_role_permissions for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_role_permissions_manage on public.gym_role_permissions;
create policy gym_role_permissions_manage
on public.gym_role_permissions for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists gym_user_permission_overrides_select on public.gym_user_permission_overrides;
create policy gym_user_permission_overrides_select
on public.gym_user_permission_overrides for select to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
  or user_id = auth.uid()
);

drop policy if exists gym_user_permission_overrides_manage on public.gym_user_permission_overrides;
create policy gym_user_permission_overrides_manage
on public.gym_user_permission_overrides for all to authenticated
using (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
)
with check (
  public.is_service_role()
  or public.can_manage_gym_config(gym_id, auth.uid())
);

drop policy if exists staff_shifts_select on public.staff_shifts;
create policy staff_shifts_select
on public.staff_shifts for select to authenticated
using (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_insert on public.staff_shifts;
create policy staff_shifts_insert
on public.staff_shifts for insert to authenticated
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_update on public.staff_shifts;
create policy staff_shifts_update
on public.staff_shifts for update to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_shifts_delete on public.staff_shifts;
create policy staff_shifts_delete
on public.staff_shifts for delete to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.shifts.manage', auth.uid())
);

drop policy if exists staff_time_entries_select on public.staff_time_entries;
create policy staff_time_entries_select
on public.staff_time_entries for select to authenticated
using (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_insert on public.staff_time_entries;
create policy staff_time_entries_insert
on public.staff_time_entries for insert to authenticated
with check (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_update on public.staff_time_entries;
create policy staff_time_entries_update
on public.staff_time_entries for update to authenticated
using (
  public.is_service_role()
  or (
    staff_user_id = auth.uid()
    and status in ('open', 'submitted')
    and approved_at is null
  )
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
)
with check (
  public.is_service_role()
  or staff_user_id = auth.uid()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists staff_time_entries_delete on public.staff_time_entries;
create policy staff_time_entries_delete
on public.staff_time_entries for delete to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'staff.time_entries.manage', auth.uid())
);

drop policy if exists gym_kpi_daily_snapshots_select on public.gym_kpi_daily_snapshots;
create policy gym_kpi_daily_snapshots_select
on public.gym_kpi_daily_snapshots for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'analytics.view', auth.uid())
);

drop policy if exists gym_kpi_daily_snapshots_manage on public.gym_kpi_daily_snapshots;
create policy gym_kpi_daily_snapshots_manage
on public.gym_kpi_daily_snapshots for all to authenticated
using (public.is_service_role())
with check (public.is_service_role());

drop policy if exists gym_crm_leads_select on public.gym_crm_leads;
create policy gym_crm_leads_select
on public.gym_crm_leads for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_leads_manage on public.gym_crm_leads;
create policy gym_crm_leads_manage
on public.gym_crm_leads for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_lead_activities_select on public.gym_crm_lead_activities;
create policy gym_crm_lead_activities_select
on public.gym_crm_lead_activities for select to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);

drop policy if exists gym_crm_lead_activities_manage on public.gym_crm_lead_activities;
create policy gym_crm_lead_activities_manage
on public.gym_crm_lead_activities for all to authenticated
using (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
)
with check (
  public.is_service_role()
  or public.user_has_gym_permission(gym_id, 'crm.leads.manage', auth.uid())
);
