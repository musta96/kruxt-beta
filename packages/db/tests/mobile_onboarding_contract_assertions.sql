insert into auth.users(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.profiles(id, username, display_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice_lifts', 'Alice Lifts'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bob_trains', 'Bob Trains');

insert into public.policy_version_tracking(
  id,
  policy_type,
  version,
  label,
  document_url,
  effective_at
) values
  ('11111111-1111-4111-8111-111111111111', 'terms', '1.0', 'Terms', 'https://example.test/terms', now() - interval '1 day'),
  ('22222222-2222-4222-8222-222222222222', 'privacy', '1.0', 'Privacy', 'https://example.test/privacy', now() - interval '1 day'),
  ('33333333-3333-4333-8333-333333333333', 'health_data', '1.0', 'Health', 'https://example.test/health', now() - interval '1 day');

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims = '{"role":"authenticated"}';

do $$
declare
  v_capture jsonb;
begin
  select public.capture_mobile_onboarding_consents(
    p_terms_policy_version_id => '11111111-1111-4111-8111-111111111111',
    p_privacy_policy_version_id => '22222222-2222-4222-8222-222222222222',
    p_health_data_policy_version_id => '33333333-3333-4333-8333-333333333333',
    p_accept_terms => true,
    p_accept_privacy => true,
    p_accept_health_data => true
  ) into v_capture;

  if jsonb_array_length(v_capture) <> 5 then
    raise exception 'Expected five atomic consent records';
  end if;

  if not exists (
    select 1 from public.consents
    where user_id = auth.uid()
      and consent_type = 'push_notifications'
      and granted = false
      and evidence->>'contract' = 'mobile_onboarding_v1'
  ) then
    raise exception 'Omitted push consent did not fail closed';
  end if;

  if not exists (
    select 1 from public.consents
    where user_id = auth.uid()
      and consent_type = 'marketing_email'
      and granted = false
  ) then
    raise exception 'Omitted marketing consent did not fail closed';
  end if;
end;
$$;

do $$
begin
  begin
    update public.profiles
    set mobile_onboarding_completed_at = now()
    where id = auth.uid();
    raise exception 'Direct completion update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

do $$
declare
  v_state jsonb;
begin
  select public.get_mobile_onboarding_state() into v_state;
  if v_state->>'status' <> 'incomplete' then
    raise exception 'Completion marker should be required';
  end if;

  select public.complete_mobile_onboarding() into v_state;
  if v_state->>'status' <> 'complete' then
    raise exception 'Completion RPC did not mark a valid user complete';
  end if;

  select public.get_mobile_onboarding_state() into v_state;
  if v_state->>'status' <> 'complete' then
    raise exception 'Completion state did not persist';
  end if;
end;
$$;

set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set test.fail_push = 'on';

do $$
begin
  begin
    perform public.capture_mobile_onboarding_consents(
      p_terms_policy_version_id => '11111111-1111-4111-8111-111111111111',
      p_privacy_policy_version_id => '22222222-2222-4222-8222-222222222222',
      p_health_data_policy_version_id => '33333333-3333-4333-8333-333333333333',
      p_accept_terms => true,
      p_accept_privacy => true,
      p_accept_health_data => true
    );
    raise exception 'Injected consent failure unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Injected consent failure unexpectedly succeeded' then
      raise;
    end if;
  end;

  if exists (
    select 1 from public.consents where user_id = auth.uid()
  ) then
    raise exception 'Consent RPC did not roll back all prior writes';
  end if;
end;
$$;

reset test.fail_push;
reset role;

insert into public.policy_version_tracking(
  id,
  policy_type,
  version,
  label,
  document_url,
  effective_at
) values (
  '55555555-5555-4555-8555-555555555555',
  'privacy',
  '2.0',
  'Privacy',
  'https://example.test/privacy-2',
  now()
);

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
  v_state jsonb;
begin
  select public.get_mobile_onboarding_state() into v_state;
  if v_state->>'status' <> 'incomplete' then
    raise exception 'A changed required policy must invalidate completion';
  end if;

  begin
    perform public.complete_mobile_onboarding();
    raise exception 'Completion unexpectedly ignored changed consent requirements';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;

select '[ok] mobile onboarding PostgreSQL contract' as result;
