-- Atomic mobile onboarding consent capture and server-controlled completion.

alter table public.profiles
  add column if not exists mobile_onboarding_completed_at timestamptz;

comment on column public.profiles.mobile_onboarding_completed_at is
  'Server-controlled completion marker for the shipped NativeApp onboarding flow.';

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
grant execute on function public.policy_version_has_content_binding(uuid, timestamptz) to authenticated, service_role;

create or replace function public.mobile_user_has_bound_required_consents(
  p_user_id uuid,
  p_as_of timestamptz default now()
)
returns boolean
language sql
stable
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
  join lateral (
    select p.id
    from public.policy_version_tracking p
    where p.id = public.current_policy_version_id(required.policy_type, p_as_of)
      and public.policy_version_has_content_binding(p.id, p_as_of)
    limit 1
  ) policy on true
  join lateral (
    select c.granted, c.policy_version_id
    from public.consents c
    where c.user_id = p_user_id
      and c.consent_type = required.consent_type
    order by c.granted_at desc, c.created_at desc
    limit 1
  ) latest on latest.granted = true and latest.policy_version_id = policy.id;
$$;

revoke all on function public.mobile_user_has_bound_required_consents(uuid, timestamptz) from public;
grant execute on function public.mobile_user_has_bound_required_consents(uuid, timestamptz) to service_role;

create or replace function public.protect_mobile_onboarding_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' and new.mobile_onboarding_completed_at is not null then
      raise exception 'Mobile onboarding completion is server controlled'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
      and new.mobile_onboarding_completed_at is distinct from old.mobile_onboarding_completed_at then
      raise exception 'Mobile onboarding completion is server controlled'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_mobile_onboarding_completion on public.profiles;
create trigger trg_profiles_protect_mobile_onboarding_completion
before insert or update on public.profiles
for each row execute function public.protect_mobile_onboarding_completion();

create or replace function public.capture_mobile_onboarding_consents(
  p_terms_policy_version_id uuid,
  p_privacy_policy_version_id uuid,
  p_health_data_policy_version_id uuid,
  p_accept_terms boolean,
  p_accept_privacy boolean,
  p_accept_health_data boolean,
  p_marketing_email_opt_in boolean default false,
  p_push_notifications_opt_in boolean default false,
  p_locale text default null,
  p_source text default 'mobile',
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_now timestamptz := now();
  v_terms_policy_id uuid;
  v_privacy_policy_id uuid;
  v_health_data_policy_id uuid;
  v_source text := case
    when v_is_service then coalesce(nullif(btrim(p_source), ''), 'mobile')
    else 'mobile'
  end;
  v_evidence jsonb;
  v_consent_ids uuid[] := array[]::uuid[];
begin
  if v_target_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot record onboarding consent for another user'
      using errcode = '42501';
  end if;

  if p_terms_policy_version_id is null
    or p_privacy_policy_version_id is null
    or p_health_data_policy_version_id is null then
    raise exception 'All reviewed baseline policy ids are required'
      using errcode = '22004';
  end if;

  if p_accept_terms is distinct from true
    or p_accept_privacy is distinct from true
    or p_accept_health_data is distinct from true then
    raise exception 'Terms, privacy, and health-data consent are required'
      using errcode = '22023';
  end if;

  -- Prevent a newly published policy from becoming current between validation
  -- and the final consent insert in this transaction.
  lock table public.policy_version_tracking in share mode;

  v_terms_policy_id := public.current_policy_version_id('terms'::public.policy_type, v_now);
  v_privacy_policy_id := public.current_policy_version_id('privacy'::public.policy_type, v_now);
  v_health_data_policy_id := public.current_policy_version_id('health_data'::public.policy_type, v_now);

  if v_terms_policy_id is null
    or v_privacy_policy_id is null
    or v_health_data_policy_id is null then
    raise exception 'Current baseline policy documents are unavailable'
      using errcode = '55000';
  end if;

  if not public.policy_version_has_content_binding(v_terms_policy_id, v_now)
    or not public.policy_version_has_content_binding(v_privacy_policy_id, v_now)
    or not public.policy_version_has_content_binding(v_health_data_policy_id, v_now) then
    raise exception 'Current baseline policy documents are not content-bound'
      using errcode = '55000';
  end if;

  if p_terms_policy_version_id <> v_terms_policy_id
    or p_privacy_policy_version_id <> v_privacy_policy_id
    or p_health_data_policy_version_id <> v_health_data_policy_id then
    raise exception 'Reviewed baseline policies are no longer current'
      using errcode = '40001';
  end if;

  v_evidence := jsonb_build_object(
    'contract', 'mobile_onboarding_v1',
    'capturedAt', v_now,
    'capturedByUserId', v_actor,
    'targetUserId', v_target_user,
    'reviewedPolicyIds', jsonb_build_object(
      'terms', v_terms_policy_id,
      'privacy', v_privacy_policy_id,
      'healthData', v_health_data_policy_id
    )
  );

  v_consent_ids := array_append(v_consent_ids, public.record_user_consent(
    'terms'::public.consent_type,
    true,
    v_terms_policy_id,
    v_source,
    p_locale,
    v_target_user,
    null,
    null,
    v_evidence || jsonb_build_object('decision', 'terms', 'granted', true)
  ));
  v_consent_ids := array_append(v_consent_ids, public.record_user_consent(
    'privacy'::public.consent_type,
    true,
    v_privacy_policy_id,
    v_source,
    p_locale,
    v_target_user,
    null,
    null,
    v_evidence || jsonb_build_object('decision', 'privacy', 'granted', true)
  ));
  v_consent_ids := array_append(v_consent_ids, public.record_user_consent(
    'health_data_processing'::public.consent_type,
    true,
    v_health_data_policy_id,
    v_source,
    p_locale,
    v_target_user,
    null,
    null,
    v_evidence || jsonb_build_object('decision', 'health_data_processing', 'granted', true)
  ));
  v_consent_ids := array_append(v_consent_ids, public.record_user_consent(
    'marketing_email'::public.consent_type,
    coalesce(p_marketing_email_opt_in, false),
    v_privacy_policy_id,
    v_source,
    p_locale,
    v_target_user,
    null,
    null,
    v_evidence || jsonb_build_object(
      'decision', 'marketing_email',
      'granted', coalesce(p_marketing_email_opt_in, false)
    )
  ));
  v_consent_ids := array_append(v_consent_ids, public.record_user_consent(
    'push_notifications'::public.consent_type,
    coalesce(p_push_notifications_opt_in, false),
    v_privacy_policy_id,
    v_source,
    p_locale,
    v_target_user,
    null,
    null,
    v_evidence || jsonb_build_object(
      'decision', 'push_notifications',
      'granted', coalesce(p_push_notifications_opt_in, false)
    )
  ));

  return (
    select coalesce(
      jsonb_agg(to_jsonb(c) order by array_position(v_consent_ids, c.id)),
      '[]'::jsonb
    )
    from public.consents c
    where c.id = any(v_consent_ids)
  );
end;
$$;

create or replace function public.get_mobile_onboarding_state(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_profile public.profiles%rowtype;
  v_profile_complete boolean := false;
  v_required_consents_complete boolean := false;
  v_marketing_email_opt_in boolean := false;
  v_push_notifications_opt_in boolean := false;
begin
  if v_target_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot inspect onboarding state for another user'
      using errcode = '42501';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = v_target_user;

  v_profile_complete := v_profile.id is not null
    and v_profile.activation_status = 'active'
    and char_length(btrim(v_profile.display_name)) between 2 and 80
    and v_profile.username ~ '^[a-z0-9_]{3,24}$';
  v_required_consents_complete := public.mobile_user_has_bound_required_consents(v_target_user);

  select coalesce(c.granted, false)
  into v_marketing_email_opt_in
  from public.consents c
  where c.user_id = v_target_user
    and c.consent_type = 'marketing_email'::public.consent_type
  order by c.granted_at desc, c.created_at desc
  limit 1;

  select coalesce(c.granted, false)
  into v_push_notifications_opt_in
  from public.consents c
  where c.user_id = v_target_user
    and c.consent_type = 'push_notifications'::public.consent_type
  order by c.granted_at desc, c.created_at desc
  limit 1;

  return jsonb_build_object(
    'status', case
      when v_profile.mobile_onboarding_completed_at is not null
        and v_profile_complete
        and v_required_consents_complete then 'complete'
      else 'incomplete'
    end,
    'completedAt', v_profile.mobile_onboarding_completed_at,
    'profileComplete', v_profile_complete,
    'requiredConsentsComplete', v_required_consents_complete,
    'marketingEmailOptIn', coalesce(v_marketing_email_opt_in, false),
    'pushNotificationsOptIn', coalesce(v_push_notifications_opt_in, false)
  );
end;
$$;

create or replace function public.complete_mobile_onboarding(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := public.is_service_role();
  v_target_user uuid := coalesce(p_user_id, v_actor);
  v_profile public.profiles%rowtype;
  v_profile_complete boolean := false;
  v_required_consents_complete boolean := false;
begin
  if v_target_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not v_is_service and v_actor is distinct from v_target_user then
    raise exception 'Cannot complete onboarding for another user'
      using errcode = '42501';
  end if;

  lock table public.policy_version_tracking in share mode;

  select p.* into v_profile
  from public.profiles p
  where p.id = v_target_user
  for update;

  if v_profile.id is null then
    raise exception 'A profile is required before onboarding can be completed'
      using errcode = '23503';
  end if;

  v_profile_complete := v_profile.activation_status = 'active'
    and char_length(btrim(v_profile.display_name)) between 2 and 80
    and v_profile.username ~ '^[a-z0-9_]{3,24}$';
  if not v_profile_complete then
    raise exception 'Profile is incomplete' using errcode = '23514';
  end if;

  v_required_consents_complete := public.mobile_user_has_bound_required_consents(v_target_user);
  if not v_required_consents_complete then
    raise exception 'Current required consents are incomplete'
      using errcode = '23514';
  end if;

  update public.profiles
  set mobile_onboarding_completed_at = coalesce(mobile_onboarding_completed_at, now())
  where id = v_target_user
  returning * into v_profile;

  return jsonb_build_object(
    'status', 'complete',
    'completedAt', v_profile.mobile_onboarding_completed_at,
    'profileComplete', true,
    'requiredConsentsComplete', true
  );
end;
$$;

do $$
declare
  v_previous_claims text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles p
  set mobile_onboarding_completed_at = now()
  where p.mobile_onboarding_completed_at is null
    and p.activation_status = 'active'
    and char_length(btrim(p.display_name)) between 2 and 80
    and p.username ~ '^[a-z0-9_]{3,24}$'
    and public.mobile_user_has_bound_required_consents(p.id);
  perform set_config('request.jwt.claims', coalesce(v_previous_claims, ''), true);
end;
$$;

revoke all on function public.protect_mobile_onboarding_completion() from public;

revoke all on function public.capture_mobile_onboarding_consents(
  uuid, uuid, uuid, boolean, boolean, boolean, boolean, boolean, text, text, uuid
) from public;
grant execute on function public.capture_mobile_onboarding_consents(
  uuid, uuid, uuid, boolean, boolean, boolean, boolean, boolean, text, text, uuid
) to authenticated, service_role;

revoke all on function public.get_mobile_onboarding_state(uuid) from public;
grant execute on function public.get_mobile_onboarding_state(uuid) to authenticated, service_role;

revoke all on function public.complete_mobile_onboarding(uuid) from public;
grant execute on function public.complete_mobile_onboarding(uuid) to authenticated, service_role;
