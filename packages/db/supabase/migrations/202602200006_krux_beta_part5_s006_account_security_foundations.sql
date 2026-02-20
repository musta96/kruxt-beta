-- KRUXT beta part 5 (s006)
-- Account security foundations:
-- 1) User-managed security settings
-- 2) Trusted device registry
-- 3) Auth/security event trail

-- =====================================================
-- ENUMS
-- =====================================================

do $$ begin
  create type public.auth_event_type as enum (
    'login_success',
    'login_failed',
    'logout',
    'password_changed',
    'mfa_enabled',
    'mfa_disabled',
    'token_refreshed',
    'new_device_trusted',
    'trusted_device_revoked',
    'session_revoked'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.auth_event_risk_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

-- =====================================================
-- TABLES
-- =====================================================

create table if not exists public.user_security_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mfa_required boolean not null default false,
  mfa_enabled boolean not null default false,
  passkey_enabled boolean not null default false,
  new_device_alerts boolean not null default true,
  login_alert_channel text not null default 'email' check (login_alert_channel in ('email', 'push', 'none')),
  session_timeout_minutes integer not null default 10080 check (session_timeout_minutes between 15 and 43200),
  allow_multi_device_sessions boolean not null default true,
  password_updated_at timestamptz,
  last_security_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_name text,
  app_version text,
  os_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip inet,
  is_active boolean not null default true,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id)
);

create table if not exists public.user_auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.auth_event_type not null,
  risk_level public.auth_event_risk_level not null default 'low',
  device_id text,
  platform text,
  ip_address inet,
  user_agent text,
  success boolean not null default true,
  failure_reason text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.user_security_settings (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_user_trusted_devices_user_active
  on public.user_trusted_devices(user_id, is_active, last_seen_at desc);
create index if not exists idx_user_auth_events_user_time
  on public.user_auth_events(user_id, occurred_at desc);
create index if not exists idx_user_auth_events_risk
  on public.user_auth_events(risk_level, occurred_at desc);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

drop trigger if exists trg_user_security_settings_set_updated_at on public.user_security_settings;
create trigger trg_user_security_settings_set_updated_at
before update on public.user_security_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_trusted_devices_set_updated_at on public.user_trusted_devices;
create trigger trg_user_trusted_devices_set_updated_at
before update on public.user_trusted_devices
for each row execute function public.set_updated_at();

-- =====================================================
-- HELPERS
-- =====================================================

create or replace function public.ensure_user_security_settings(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_security_settings (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.log_user_auth_event(
  p_event_type public.auth_event_type,
  p_risk_level public.auth_event_risk_level default 'low',
  p_device_id text default null,
  p_platform text default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_success boolean default true,
  p_failure_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_auth_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.user_auth_events;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_user_security_settings(v_actor);

  insert into public.user_auth_events (
    user_id,
    event_type,
    risk_level,
    device_id,
    platform,
    ip_address,
    user_agent,
    success,
    failure_reason,
    metadata
  )
  values (
    v_actor,
    p_event_type,
    p_risk_level,
    p_device_id,
    p_platform,
    p_ip_address,
    p_user_agent,
    p_success,
    p_failure_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
  into v_event;

  return v_event;
end;
$$;

-- =====================================================
-- RLS
-- =====================================================

alter table public.user_security_settings enable row level security;
alter table public.user_trusted_devices enable row level security;
alter table public.user_auth_events enable row level security;

drop policy if exists user_security_settings_select on public.user_security_settings;
create policy user_security_settings_select
on public.user_security_settings for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_security_settings_manage on public.user_security_settings;
create policy user_security_settings_manage
on public.user_security_settings for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_trusted_devices_select on public.user_trusted_devices;
create policy user_trusted_devices_select
on public.user_trusted_devices for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_trusted_devices_manage on public.user_trusted_devices;
create policy user_trusted_devices_manage
on public.user_trusted_devices for all to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
)
with check (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_auth_events_select on public.user_auth_events;
create policy user_auth_events_select
on public.user_auth_events for select to authenticated
using (
  public.is_service_role()
  or user_id = auth.uid()
);

drop policy if exists user_auth_events_insert on public.user_auth_events;
create policy user_auth_events_insert
on public.user_auth_events for insert to authenticated
with check (
  public.is_service_role()
  or user_id = auth.uid()
);
