create schema auth;

create role authenticated nologin;
create role service_role nologin;

create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create type public.policy_type as enum ('terms', 'privacy', 'health_data', 'waiver');
create type public.consent_type as enum (
  'terms',
  'privacy',
  'health_data_processing',
  'marketing_email',
  'push_notifications'
);

create table public.policy_version_tracking (
  id uuid primary key,
  policy_type public.policy_type not null,
  version text not null,
  label text,
  document_url text not null,
  effective_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id),
  username text not null,
  display_name text not null
);

create table public.consents (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  consent_type public.consent_type not null,
  policy_version_id uuid references public.policy_version_tracking(id),
  granted boolean not null,
  granted_at timestamptz not null,
  revoked_at timestamptz,
  source text not null,
  locale text,
  ip_address text,
  user_agent text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role';
$$;

create or replace function public.consent_policy_type_from_consent_type(
  p_consent_type public.consent_type
)
returns public.policy_type
language sql
immutable
as $$
  select case p_consent_type
    when 'terms' then 'terms'::public.policy_type
    when 'privacy' then 'privacy'::public.policy_type
    when 'health_data_processing' then 'health_data'::public.policy_type
    else 'privacy'::public.policy_type
  end;
$$;

create or replace function public.current_policy_version_id(
  p_policy_type public.policy_type,
  p_as_of timestamptz default now()
)
returns uuid
language sql
stable
as $$
  select p.id
  from public.policy_version_tracking p
  where p.policy_type = p_policy_type
    and p.is_active = true
    and p.effective_at <= p_as_of
  order by p.effective_at desc, p.created_at desc
  limit 1;
$$;

create or replace function public.record_user_consent(
  p_consent_type public.consent_type,
  p_granted boolean,
  p_policy_version_id uuid default null,
  p_source text default 'mobile',
  p_locale text default null,
  p_user_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_target_user uuid := coalesce(p_user_id, auth.uid());
begin
  if current_setting('test.fail_push', true) = 'on'
    and p_consent_type = 'push_notifications'::public.consent_type then
    raise exception 'Injected push failure';
  end if;

  insert into public.consents(
    id,
    user_id,
    consent_type,
    policy_version_id,
    granted,
    granted_at,
    revoked_at,
    source,
    locale,
    ip_address,
    user_agent,
    evidence
  ) values (
    v_id,
    v_target_user,
    p_consent_type,
    p_policy_version_id,
    p_granted,
    now(),
    case when p_granted then null else now() end,
    p_source,
    p_locale,
    p_ip_address,
    p_user_agent,
    p_evidence
  );

  return v_id;
end;
$$;

create or replace function public.user_has_required_consents(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) = 3
  from (
    values
      ('terms'::public.consent_type, 'terms'::public.policy_type),
      ('privacy'::public.consent_type, 'privacy'::public.policy_type),
      ('health_data_processing'::public.consent_type, 'health_data'::public.policy_type)
  ) required(consent_type, policy_type)
  where exists (
    select 1
    from public.consents c
    where c.user_id = p_user_id
      and c.consent_type = required.consent_type
      and c.granted = true
      and c.policy_version_id = public.current_policy_version_id(required.policy_type, now())
  );
$$;

grant usage on schema public, auth to authenticated, service_role;
grant select, insert, update on public.profiles to authenticated, service_role;
grant select on public.consents, public.policy_version_tracking to authenticated, service_role;
