-- Consent, activation, and profile-creation hardening.
-- Existing unbound policy rows remain immutable but are not consent-ready.

create or replace function public.policy_version_has_content_binding(
  p_policy_version_id uuid,
  p_as_of timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.policy_version_tracking p
    where p.id = p_policy_version_id
      and p.is_active = true
      and p.effective_at <= coalesce(p_as_of, now())
      and p.document_url ~* '^https://[^[:space:]]+$'
      and btrim(coalesce(p.checksum, '')) ~* '^(sha256:)?[0-9a-f]{64}$'
  );
$$;

revoke all on function public.policy_version_has_content_binding(uuid, timestamptz) from public;
grant execute on function public.policy_version_has_content_binding(uuid, timestamptz) to authenticated;
grant execute on function public.policy_version_has_content_binding(uuid, timestamptz) to service_role;

create or replace function public.current_policy_version_id(
  p_policy_type public.policy_type,
  p_as_of timestamptz default now()
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.policy_version_tracking p
  where p.policy_type = p_policy_type
    and public.policy_version_has_content_binding(p.id, p_as_of)
  order by p.effective_at desc, p.created_at desc
  limit 1;
$$;

create or replace function public.validate_policy_content_binding()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.document_url := btrim(new.document_url);
  new.checksum := lower(nullif(btrim(new.checksum), ''));

  if new.is_active and new.document_url !~* '^https://[^[:space:]]+$' then
    raise exception using
      errcode = '22023',
      message = 'Active policy versions require an HTTPS document URL';
  end if;

  if new.is_active and coalesce(new.checksum, '') !~* '^(sha256:)?[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'Active policy versions require a SHA-256 content checksum';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_policy_version_content_binding on public.policy_version_tracking;
create trigger trg_policy_version_content_binding
before insert on public.policy_version_tracking
for each row execute function public.validate_policy_content_binding();

drop function if exists public.publish_policy_version(
  public.policy_type,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
);

create function public.publish_policy_version(
  p_policy_type public.policy_type,
  p_version text,
  p_document_url text,
  p_checksum text,
  p_effective_at timestamptz default now(),
  p_label text default null,
  p_requires_reconsent boolean default true,
  p_change_summary text default null,
  p_is_active boolean default true,
  p_supersedes_policy_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_version text := nullif(btrim(p_version), '');
  v_document_url text := nullif(btrim(p_document_url), '');
  v_checksum text := lower(nullif(btrim(p_checksum), ''));
  v_supersedes_id uuid := p_supersedes_policy_version_id;
  v_effective_at timestamptz := coalesce(p_effective_at, now());
begin
  if not public.is_service_role() then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  if v_version is null then
    raise exception using errcode = '22023', message = 'Policy version is required';
  end if;

  if v_document_url is null or v_document_url !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'An HTTPS policy document URL is required';
  end if;

  if v_checksum is null or v_checksum !~* '^(sha256:)?[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'A SHA-256 policy content checksum is required';
  end if;

  if exists (
    select 1
    from public.policy_version_tracking p
    where p.policy_type = p_policy_type
      and p.version = v_version
  ) then
    raise exception 'Policy version already exists for policy type %: %', p_policy_type, v_version;
  end if;

  if v_supersedes_id is null then
    select p.id
    into v_supersedes_id
    from public.policy_version_tracking p
    where p.policy_type = p_policy_type
      and p.is_active = true
      and p.effective_at <= v_effective_at
    order by p.effective_at desc, p.created_at desc
    limit 1;
  end if;

  insert into public.policy_version_tracking(
    policy_type,
    version,
    label,
    document_url,
    checksum,
    effective_at,
    is_active,
    created_by,
    published_at,
    change_summary,
    requires_reconsent,
    supersedes_policy_version_id
  )
  values (
    p_policy_type,
    v_version,
    nullif(btrim(p_label), ''),
    v_document_url,
    v_checksum,
    v_effective_at,
    coalesce(p_is_active, true),
    auth.uid(),
    now(),
    nullif(btrim(p_change_summary), ''),
    coalesce(p_requires_reconsent, true),
    v_supersedes_id
  )
  returning id into v_id;

  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'policy.version_published',
    'policy_version',
    v_id,
    jsonb_build_object(
      'policy_version_id', v_id,
      'policy_type', p_policy_type,
      'version', v_version,
      'checksum', v_checksum,
      'effective_at', v_effective_at,
      'requires_reconsent', coalesce(p_requires_reconsent, true),
      'supersedes_policy_version_id', v_supersedes_id
    )
  );

  perform public.append_audit_log(
    'policy.version_published',
    'policy_version_tracking',
    v_id,
    'Published policy version',
    jsonb_build_object(
      'policy_type', p_policy_type,
      'version', v_version,
      'checksum', v_checksum,
      'effective_at', v_effective_at,
      'requires_reconsent', coalesce(p_requires_reconsent, true),
      'supersedes_policy_version_id', v_supersedes_id
    )
  );

  return v_id;
end;
$$;

revoke all on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) from public;
grant execute on function public.publish_policy_version(
  public.policy_type,
  text,
  text,
  text,
  timestamptz,
  text,
  boolean,
  text,
  boolean,
  uuid
) to service_role;

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
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid;
  v_policy_type public.policy_type;
  v_policy public.policy_version_tracking%rowtype;
  v_now timestamptz := now();
  v_id uuid;
  v_headers jsonb := '{}'::jsonb;
  v_source text := lower(coalesce(nullif(btrim(p_source), ''), 'unknown'));
  v_ip_address text;
  v_user_agent text;
  v_evidence jsonb;
begin
  if p_granted is null then
    raise exception using errcode = '22023', message = 'Consent grant flag is required';
  end if;

  if v_is_service then
    v_target_user := coalesce(p_user_id, v_actor);
  else
    if v_actor is null then
      raise exception using errcode = '42501', message = 'Authentication required';
    end if;
    if p_user_id is not null and p_user_id is distinct from v_actor then
      raise exception using errcode = '42501', message = 'Cannot record consent for another user';
    end if;
    v_target_user := v_actor;
  end if;

  if v_target_user is null then
    raise exception using errcode = '22023', message = 'Consent target user is required';
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(p_consent_type);

  select p.*
  into v_policy
  from public.policy_version_tracking p
  where p.id = coalesce(
    p_policy_version_id,
    public.current_policy_version_id(v_policy_type, v_now)
  );

  if v_policy.id is null then
    raise exception 'No consent-ready policy version found for consent type %', p_consent_type;
  end if;

  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy type mismatch for consent type %', p_consent_type;
  end if;

  if not public.policy_version_has_content_binding(v_policy.id, v_now) then
    raise exception 'Policy version is not active with an HTTPS document and immutable checksum';
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception
    when others then v_headers := '{}'::jsonb;
  end;

  v_ip_address := nullif(btrim(split_part(coalesce(
    v_headers->>'cf-connecting-ip',
    v_headers->>'x-forwarded-for',
    case when v_is_service then p_ip_address else null end,
    ''
  ), ',', 1)), '');
  v_user_agent := nullif(btrim(coalesce(
    v_headers->>'user-agent',
    case when v_is_service then p_user_agent else null end,
    ''
  )), '');

  if v_source not in ('web', 'mobile', 'admin', 'platform', 'service') then
    v_source := case when v_is_service then 'service' else 'unknown' end;
  end if;

  v_evidence := (
    case when v_is_service then coalesce(p_evidence, '{}'::jsonb) else '{}'::jsonb end
      - array[
        'actor_user_id',
        'explicit_acceptance',
        'policy_checksum',
        'policy_document_url',
        'policy_type',
        'policy_version',
        'policy_version_id',
        'recorded_by_rpc',
        'recorded_by_service_role',
        'target_user_id'
      ]::text[]
  ) || jsonb_build_object(
    'actor_user_id', v_actor,
    'explicit_acceptance', p_granted,
    'policy_checksum', v_policy.checksum,
    'policy_document_url', v_policy.document_url,
    'policy_type', v_policy.policy_type,
    'policy_version', v_policy.version,
    'policy_version_id', v_policy.id,
    'recorded_by_rpc', true,
    'recorded_by_service_role', v_is_service,
    'target_user_id', v_target_user
  );

  insert into public.consents(
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
  )
  values (
    v_target_user,
    p_consent_type,
    v_policy.id,
    p_granted,
    v_now,
    case when p_granted then null else v_now end,
    v_source,
    nullif(btrim(p_locale), ''),
    v_ip_address,
    v_user_agent,
    v_evidence
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.validate_consent_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_policy public.policy_version_tracking%rowtype;
  v_policy_type public.policy_type;
begin
  if new.user_id is null or new.consent_type is null or new.granted is null then
    raise exception using errcode = '22023', message = 'Consent user, type, and grant flag are required';
  end if;

  new.granted_at := coalesce(new.granted_at, now());
  new.source := coalesce(nullif(btrim(new.source), ''), 'unknown');
  new.locale := nullif(btrim(new.locale), '');

  if new.policy_version_id is null then
    new.policy_version_id := public.current_policy_version_id(
      public.consent_policy_type_from_consent_type(new.consent_type),
      new.granted_at
    );
  end if;

  select p.* into v_policy
  from public.policy_version_tracking p
  where p.id = new.policy_version_id;

  if v_policy.id is null or not public.policy_version_has_content_binding(v_policy.id, new.granted_at) then
    raise exception 'A consent-ready policy version is required for consent type %', new.consent_type;
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(new.consent_type);
  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy version type mismatch for consent type %', new.consent_type;
  end if;

  if new.granted then
    new.revoked_at := null;
  else
    new.revoked_at := coalesce(new.revoked_at, new.granted_at);
  end if;

  return new;
end;
$$;

drop policy if exists consents_insert_self_or_service on public.consents;
drop policy if exists consents_insert_self on public.consents;
drop policy if exists consents_insert_service_only on public.consents;
revoke insert on table public.consents from authenticated;
revoke insert on table public.consents from service_role;

create or replace function public.list_missing_required_consents(
  p_user_id uuid default auth.uid()
)
returns table (
  consent_type public.consent_type,
  required_policy_version_id uuid,
  required_policy_version text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_consent_type public.consent_type;
  v_policy_id uuid;
  v_policy_version text;
  v_requires_reconsent boolean;
  v_latest record;
begin
  if v_target_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception using errcode = '42501', message = 'Cannot inspect consent gaps for another user';
  end if;

  foreach v_consent_type in array array[
    'terms'::public.consent_type,
    'privacy'::public.consent_type,
    'health_data_processing'::public.consent_type
  ]
  loop
    select p.id, p.version, p.requires_reconsent
    into v_policy_id, v_policy_version, v_requires_reconsent
    from public.policy_version_tracking p
    where p.id = public.current_policy_version_id(
      public.consent_policy_type_from_consent_type(v_consent_type),
      now()
    );

    if v_policy_id is null then
      consent_type := v_consent_type;
      required_policy_version_id := null;
      required_policy_version := null;
      reason := 'missing_consent_ready_policy';
      return next;
      continue;
    end if;

    select c.id, c.granted, c.policy_version_id
    into v_latest
    from public.consents c
    where c.user_id = v_target_user
      and c.consent_type = v_consent_type
    order by c.granted_at desc, c.created_at desc
    limit 1;

    if v_latest.id is null then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'missing_consent_record';
      return next;
      continue;
    end if;

    if not coalesce(v_latest.granted, false) then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'latest_record_revoked';
      return next;
      continue;
    end if;

    if v_latest.policy_version_id is null then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'missing_policy_binding';
      return next;
      continue;
    end if;

    if coalesce(v_requires_reconsent, true) and v_latest.policy_version_id <> v_policy_id then
      consent_type := v_consent_type;
      required_policy_version_id := v_policy_id;
      required_policy_version := v_policy_version;
      reason := 'reconsent_required';
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.accept_required_consents(
  p_policy_version_ids uuid[],
  p_source text default 'web',
  p_locale text default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_required_policy_ids uuid[];
  v_required_consent_types public.consent_type[];
  v_consent_ids uuid[] := array[]::uuid[];
  v_consent_id uuid;
  v_index integer;
begin
  if v_actor is null or public.is_service_role() then
    raise exception using errcode = '42501', message = 'Authenticated user context is required';
  end if;

  select
    array_agg(m.required_policy_version_id order by m.consent_type::text),
    array_agg(m.consent_type order by m.consent_type::text)
  into v_required_policy_ids, v_required_consent_types
  from public.list_missing_required_consents(v_actor) m;

  v_required_policy_ids := coalesce(v_required_policy_ids, array[]::uuid[]);
  v_required_consent_types := coalesce(v_required_consent_types, array[]::public.consent_type[]);
  p_policy_version_ids := coalesce(p_policy_version_ids, array[]::uuid[]);

  if cardinality(v_required_policy_ids) = 0 then
    if cardinality(p_policy_version_ids) <> 0 then
      raise exception using errcode = '22023', message = 'No required consent policies are awaiting acceptance';
    end if;
    return v_consent_ids;
  end if;

  if array_position(v_required_policy_ids, null) is not null then
    raise exception using errcode = '55000', message = 'A required consent policy is not ready for acceptance';
  end if;

  if array_position(p_policy_version_ids, null) is not null
    or cardinality(p_policy_version_ids) <> (
      select count(distinct policy_id)
      from unnest(p_policy_version_ids) submitted(policy_id)
    )
  then
    raise exception using errcode = '22023', message = 'Submitted policy version IDs must be non-null and unique';
  end if;

  if cardinality(p_policy_version_ids) <> cardinality(v_required_policy_ids)
    or not (p_policy_version_ids @> v_required_policy_ids)
    or not (v_required_policy_ids @> p_policy_version_ids)
  then
    raise exception using
      errcode = '22023',
      message = 'Required policies changed while they were being reviewed';
  end if;

  for v_index in 1..cardinality(v_required_policy_ids)
  loop
    v_consent_id := public.record_user_consent(
      p_consent_type => v_required_consent_types[v_index],
      p_granted => true,
      p_policy_version_id => v_required_policy_ids[v_index],
      p_source => p_source,
      p_locale => p_locale,
      p_user_id => v_actor
    );
    v_consent_ids := array_append(v_consent_ids, v_consent_id);
  end loop;

  if exists (select 1 from public.list_missing_required_consents(v_actor)) then
    raise exception using errcode = '55000', message = 'Required consent verification did not complete';
  end if;

  return v_consent_ids;
end;
$$;

revoke all on function public.accept_required_consents(uuid[], text, text) from public;
grant execute on function public.accept_required_consents(uuid[], text, text) to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Profiles can only be changed by their owner';
  end if;

  if tg_op = 'INSERT' then
    new.activation_status := 'active';
    new.activation_status_updated_at := now();
    new.activated_at := now();
    return new;
  end if;

  if new.activation_status is distinct from old.activation_status
    or new.activation_status_updated_at is distinct from old.activation_status_updated_at
    or new.activated_at is distinct from old.activated_at
  then
    raise exception using errcode = '42501', message = 'Profile activation fields are system-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_security_fields on public.profiles;
create trigger trg_profiles_protect_security_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_security_fields();

revoke insert, update on table public.profiles from authenticated;
grant insert (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  home_gym_id,
  is_public,
  locale,
  preferred_units
) on table public.profiles to authenticated;
grant update (
  username,
  display_name,
  avatar_url,
  bio,
  home_gym_id,
  is_public,
  locale,
  preferred_units
) on table public.profiles to authenticated;

create or replace function public.ensure_self_profile(
  p_preferred_username text default null,
  p_display_name text default null
)
returns table (
  id uuid,
  username text,
  display_name text,
  activation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_base text;
  v_display_name text;
  v_suffix text;
  v_candidate text;
  v_inserted_username text;
  v_candidates text[];
begin
  if v_actor is null or public.is_service_role() then
    raise exception using errcode = '42501', message = 'Authenticated user context is required';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_actor) then
    return query
    select p.id, p.username, p.display_name, p.activation_status
    from public.profiles p
    where p.id = v_actor;
    return;
  end if;

  v_base := regexp_replace(lower(coalesce(p_preferred_username, '')), '[^a-z0-9_]+', '', 'g');
  v_base := btrim(v_base, '_');
  if char_length(v_base) < 3 then
    v_base := 'member';
  end if;
  v_base := left(v_base, 24);
  v_suffix := replace(v_actor::text, '-', '');
  v_display_name := left(coalesce(nullif(btrim(p_display_name), ''), 'KRUXT Member'), 80);

  v_candidates := array[
    v_base,
    left(v_base, 15) || '_' || left(v_suffix, 8),
    left(v_base, 11) || '_' || left(v_suffix, 12),
    'member_' || left(v_suffix, 17)
  ];

  foreach v_candidate in array v_candidates
  loop
    v_inserted_username := null;
    insert into public.profiles(
      id,
      username,
      display_name,
      activation_status,
      activation_status_updated_at,
      activated_at
    )
    values (
      v_actor,
      v_candidate,
      v_display_name,
      'active',
      now(),
      now()
    )
    on conflict do nothing
    returning profiles.username into v_inserted_username;

    if v_inserted_username is not null then
      return query
      select p.id, p.username, p.display_name, p.activation_status
      from public.profiles p
      where p.id = v_actor;
      return;
    end if;

    if exists (select 1 from public.profiles p where p.id = v_actor) then
      return query
      select p.id, p.username, p.display_name, p.activation_status
      from public.profiles p
      where p.id = v_actor;
      return;
    end if;
  end loop;

  raise exception using errcode = '23505', message = 'Unable to allocate a deterministic unique username';
end;
$$;

revoke all on function public.ensure_self_profile(text, text) from public;
grant execute on function public.ensure_self_profile(text, text) to authenticated;

create or replace function public.enforce_workout_required_consents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required to create workouts';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Workouts can only be created for the authenticated user';
  end if;

  if not public.user_has_required_consents(new.user_id) then
    raise exception using errcode = '42501', message = 'Current required policy consent is required before creating workouts';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_workouts_require_consents on public.workouts;
create trigger trg_workouts_require_consents
before insert on public.workouts
for each row execute function public.enforce_workout_required_consents();
