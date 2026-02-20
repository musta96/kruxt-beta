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
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_policy_type public.policy_type;
  v_policy public.policy_version_tracking%rowtype;
  v_now timestamptz := now();
  v_id uuid;
begin
  if p_granted is null then
    raise exception 'Consent grant flag is required';
  end if;

  if v_target_user is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot record consent for another user';
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(p_consent_type);

  if p_policy_version_id is null then
    select p.*
    into v_policy
    from public.policy_version_tracking p
    where p.id = public.current_policy_version_id(v_policy_type, v_now);
  else
    select p.*
    into v_policy
    from public.policy_version_tracking p
    where p.id = p_policy_version_id;
  end if;

  if v_policy.id is null then
    raise exception 'No active policy version found for consent type %', p_consent_type;
  end if;

  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy type mismatch for consent type %', p_consent_type;
  end if;

  if v_policy.effective_at > v_now then
    raise exception 'Cannot accept a policy version before its effective date';
  end if;

  if not v_policy.is_active then
    raise exception 'Policy version is not active';
  end if;

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
    coalesce(nullif(btrim(p_source), ''), 'mobile'),
    nullif(btrim(p_locale), ''),
    nullif(btrim(p_ip_address), ''),
    nullif(btrim(p_user_agent), ''),
    coalesce(p_evidence, '{}'::jsonb)
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
  if new.user_id is null then
    raise exception 'Consent user id is required';
  end if;

  if new.consent_type is null then
    raise exception 'Consent type is required';
  end if;

  if new.granted is null then
    raise exception 'Consent grant flag is required';
  end if;

  new.granted_at := coalesce(new.granted_at, now());
  new.source := coalesce(nullif(btrim(new.source), ''), 'mobile');
  new.locale := nullif(btrim(new.locale), '');

  if new.policy_version_id is null then
    new.policy_version_id := public.current_policy_version_id(
      public.consent_policy_type_from_consent_type(new.consent_type),
      new.granted_at
    );
  end if;

  if new.policy_version_id is null then
    raise exception 'A valid policy version is required for consent type %', new.consent_type;
  end if;

  select p.*
  into v_policy
  from public.policy_version_tracking p
  where p.id = new.policy_version_id;

  if v_policy.id is null then
    raise exception 'Policy version not found';
  end if;

  v_policy_type := public.consent_policy_type_from_consent_type(new.consent_type);
  if v_policy.policy_type <> v_policy_type then
    raise exception 'Policy version type mismatch for consent type %', new.consent_type;
  end if;

  if not v_policy.is_active then
    raise exception 'Policy version is not active';
  end if;

  if v_policy.effective_at > new.granted_at then
    raise exception 'Policy version cannot be accepted before effective date';
  end if;

  if new.granted then
    new.revoked_at := null;
  else
    new.revoked_at := coalesce(new.revoked_at, new.granted_at);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_consents_validate_insert on public.consents;
create trigger trg_consents_validate_insert
before insert on public.consents
for each row execute function public.validate_consent_insert();

create or replace function public.emit_consent_recorded_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (
    'consent.recorded',
    'consent',
    new.id,
    jsonb_build_object(
      'consent_id', new.id,
      'user_id', new.user_id,
      'consent_type', new.consent_type,
      'policy_version_id', new.policy_version_id,
      'granted', new.granted,
      'source', new.source,
      'at', new.granted_at
    )
  );

  perform public.append_audit_log(
    'consent.recorded',
    'consents',
    new.id,
    'Recorded consent decision',
    jsonb_build_object(
      'user_id', new.user_id,
      'consent_type', new.consent_type,
      'policy_version_id', new.policy_version_id,
      'granted', new.granted,
      'source', new.source
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_consents_emit_recorded_event on public.consents;
create trigger trg_consents_emit_recorded_event
after insert on public.consents
for each row execute function public.emit_consent_recorded_event();

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
    raise exception 'Authentication required';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot inspect consent gaps for another user';
  end if;

  foreach v_consent_type in array array[
    'terms'::public.consent_type,
    'privacy'::public.consent_type,
    'health_data_processing'::public.consent_type
  ]
  loop
    select
      p.id,
      p.version,
      p.requires_reconsent
    into
      v_policy_id,
      v_policy_version,
      v_requires_reconsent
    from public.policy_version_tracking p
    where p.policy_type = public.consent_policy_type_from_consent_type(v_consent_type)
      and p.is_active = true
      and p.effective_at <= now()
    order by p.effective_at desc, p.created_at desc
    limit 1;

    if v_policy_id is null then
      consent_type := v_consent_type;
      required_policy_version_id := null;
      required_policy_version := null;
      reason := 'missing_active_policy';
      return next;
      continue;
    end if;

    select
      c.id,
      c.granted,
      c.policy_version_id
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

create or replace function public.user_has_required_consents(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.list_missing_required_consents(p_user_id)
  );
$$;
