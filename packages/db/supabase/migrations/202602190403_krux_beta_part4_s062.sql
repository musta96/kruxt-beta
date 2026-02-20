create or replace function public.consent_policy_type_from_consent_type(
  p_consent_type public.consent_type
)
returns public.policy_type
language plpgsql
immutable
as $$
begin
  case p_consent_type
    when 'terms' then
      return 'terms'::public.policy_type;
    when 'privacy', 'marketing_email', 'push_notifications' then
      return 'privacy'::public.policy_type;
    when 'health_data_processing' then
      return 'health_data'::public.policy_type;
    else
      raise exception 'Unsupported consent type: %', p_consent_type;
  end case;
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

create or replace function public.publish_policy_version(
  p_policy_type public.policy_type,
  p_version text,
  p_document_url text,
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
  v_supersedes_id uuid := p_supersedes_policy_version_id;
  v_effective_at timestamptz := coalesce(p_effective_at, now());
begin
  if not public.is_service_role() then
    raise exception 'Service role required';
  end if;

  if v_version is null then
    raise exception 'Policy version is required';
  end if;

  if v_document_url is null then
    raise exception 'Policy document URL is required';
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
    select public.current_policy_version_id(p_policy_type, v_effective_at)
    into v_supersedes_id;
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
    null,
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
      'effective_at', v_effective_at,
      'requires_reconsent', coalesce(p_requires_reconsent, true),
      'supersedes_policy_version_id', v_supersedes_id
    )
  );

  return v_id;
end;
$$;
