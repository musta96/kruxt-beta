-- Run against a fully migrated disposable database.
-- The transaction rolls back all fixtures.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_user uuid := '7a000000-0000-0000-0000-000000000001';
  v_second_user uuid := '7a000000-0000-0000-0000-000000000002';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'consent-primary@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_second_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'consent-second@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, username, display_name)
  values (v_user, 'consent_primary', 'Consent Primary')
  on conflict (id) do nothing;

  insert into public.policy_version_tracking (
    policy_type,
    version,
    label,
    document_url,
    checksum,
    effective_at,
    is_active,
    requires_reconsent,
    change_summary
  )
  values (
    'terms',
    'test-provisional-seed-compat',
    'Provisional seed compatibility row',
    'https://kruxt.app/legal/test-provisional',
    null,
    now(),
    false,
    true,
    'Provisional seed only; not approved for clickwrap'
  );

  if public.policy_version_has_content_binding(
    (select id from public.policy_version_tracking where policy_type = 'terms' and version = 'test-provisional-seed-compat')
  ) then
    raise exception 'inactive provisional seed row unexpectedly became consent-ready';
  end if;

  insert into public.policy_version_tracking (
    policy_type,
    version,
    label,
    document_url,
    checksum,
    effective_at,
    is_active,
    requires_reconsent
  )
  values
    ('terms', 'test-consent-ready-terms', 'Test Terms', 'https://example.test/legal/terms', repeat('a', 64), now(), true, true),
    ('privacy', 'test-consent-ready-privacy', 'Test Privacy', 'https://example.test/legal/privacy', repeat('b', 64), now(), true, true),
    ('health_data', 'test-consent-ready-health', 'Test Health', 'https://example.test/legal/health', repeat('c', 64), now(), true, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7a000000-0000-0000-0000-000000000001', true);
select set_config('request.headers', '{}'::text, true);

do $$
declare
  v_user uuid := '7a000000-0000-0000-0000-000000000001';
  v_terms uuid;
  v_privacy uuid;
  v_health uuid;
  v_workout uuid;
begin
  begin
    update public.profiles
    set activation_status = 'disabled'
    where id = v_user;
    raise exception 'authenticated profile activation update unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  update public.profiles
  set display_name = 'Consent Primary Updated'
  where id = v_user;

  if not exists (
    select 1 from public.profiles
    where id = v_user
      and activation_status = 'active'
      and display_name = 'Consent Primary Updated'
  ) then
    raise exception 'safe profile update failed or activation state changed';
  end if;

  select id into v_terms
  from public.policy_version_tracking
  where policy_type = 'terms' and version = 'test-consent-ready-terms';

  select id into v_privacy
  from public.policy_version_tracking
  where policy_type = 'privacy' and version = 'test-consent-ready-privacy';

  select id into v_health
  from public.policy_version_tracking
  where policy_type = 'health_data' and version = 'test-consent-ready-health';

  begin
    insert into public.consents (user_id, consent_type, policy_version_id, granted)
    values (v_user, 'terms', v_terms, true);
    raise exception 'direct authenticated consent insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.workouts (user_id, title, started_at)
    values (v_user, 'Blocked direct workout', now());
    raise exception 'direct workout insert without required consent unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.log_workout_atomic(
      jsonb_build_object('title', 'Blocked RPC workout'),
      '[]'::jsonb
    );
    raise exception 'log_workout_atomic without required consent unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.accept_required_consents(
      array[v_terms, v_privacy, v_terms],
      'web',
      'en-GB'
    );
    raise exception 'atomic consent acceptance unexpectedly accepted mismatched policy IDs';
  exception
    when invalid_parameter_value then null;
  end;

  if exists (select 1 from public.consents where user_id = v_user) then
    raise exception 'failed atomic consent acceptance left partial consent records';
  end if;

  perform public.accept_required_consents(
    array[v_terms, v_privacy, v_health],
    'web',
    'en-GB'
  );

  perform public.record_user_consent(
    p_consent_type => 'terms',
    p_granted => true,
    p_policy_version_id => v_terms,
    p_source => 'web',
    p_locale => 'en-GB',
    p_user_id => v_user,
    p_ip_address => '203.0.113.9',
    p_user_agent => 'forged-agent',
    p_evidence => jsonb_build_object(
      'policy_checksum', 'forged',
      'target_user_id', '00000000-0000-0000-0000-000000000000',
      'client_context', 'behavioral-test'
    )
  );

  if not public.user_has_required_consents(v_user) then
    raise exception 'valid current required consents were not recognized';
  end if;

  if not exists (
    select 1
    from public.consents c
    where c.user_id = v_user
      and c.consent_type = 'terms'
      and c.policy_version_id = v_terms
      and c.ip_address is null
      and c.user_agent is null
      and c.evidence->>'policy_checksum' = repeat('a', 64)
      and c.evidence->>'target_user_id' = v_user::text
      and c.evidence->>'recorded_by_rpc' = 'true'
      and c.evidence->>'explicit_acceptance' = 'true'
      and not (c.evidence ? 'client_context')
  ) then
    raise exception 'consent evidence was not bound to server-validated policy and user facts';
  end if;

  insert into public.workouts (user_id, title, started_at)
  values (v_user, 'Allowed direct workout', now())
  returning id into v_workout;

  if v_workout is null then
    raise exception 'direct workout insert failed after valid consent';
  end if;

  v_workout := public.log_workout_atomic(
    jsonb_build_object('title', 'Allowed RPC workout'),
    '[]'::jsonb
  );

  if v_workout is null then
    raise exception 'log_workout_atomic failed after valid consent';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '7a000000-0000-0000-0000-000000000002', true);

do $$
declare
  v_user uuid := '7a000000-0000-0000-0000-000000000002';
  v_first record;
  v_second record;
begin
  select * into v_first
  from public.ensure_self_profile('CONSENT_PRIMARY!!', 'Second Member');

  if v_first.id <> v_user
    or v_first.username = 'consent_primary'
    or char_length(v_first.username) not between 3 and 24
    or v_first.activation_status <> 'active'
  then
    raise exception 'deterministic profile creation did not resolve invalid duplicate username safely';
  end if;

  select * into v_second
  from public.ensure_self_profile('different_name', 'Overwritten Name');

  if v_second.id <> v_first.id
    or v_second.username <> v_first.username
    or v_second.display_name <> v_first.display_name
  then
    raise exception 'retry-safe profile creation overwrote an existing profile';
  end if;
end;
$$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  insert into public.workouts (user_id, title, started_at)
  values (
    '7a000000-0000-0000-0000-000000000002',
    'Explicit service-role consent bypass',
    now()
  );
exception
  when others then
    raise exception 'legitimate service-role workout insert failed: %', sqlerrm;
end;
$$;

reset role;
rollback;
