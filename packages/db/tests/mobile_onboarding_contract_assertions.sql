set request.jwt.claims = '{"role":"service_role"}';

do $$
declare
  v_state jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and p.mobile_onboarding_completed_at is not null
  ) then
    raise exception 'Eligible legacy profile was not backfilled as complete';
  end if;

  select public.get_mobile_onboarding_state('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  into v_state;
  if v_state->>'status' <> 'complete'
    or (v_state->>'marketingEmailOptIn')::boolean is not true
    or (v_state->>'pushNotificationsOptIn')::boolean is not true then
    raise exception 'Legacy onboarding state did not preserve completion and optional choices';
  end if;
end;
$$;

set role anon;
set request.jwt.claim.sub = '';
set request.jwt.claims = '{"role":"anon"}';

do $$
begin
  begin
    perform public.get_mobile_onboarding_state();
    raise exception 'Anonymous onboarding state lookup unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims = '{"role":"authenticated"}';

do $$
declare
  v_capture jsonb;
begin
  begin
    perform public.get_mobile_onboarding_state('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Cross-user onboarding state lookup unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.complete_mobile_onboarding('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Cross-user onboarding completion unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

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
      and (
        evidence->>'contract' = 'mobile_onboarding_v1'
        or evidence->>'recorded_by_rpc' = 'true'
      )
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
  if v_state->>'status' <> 'incomplete'
    or (v_state->>'marketingEmailOptIn')::boolean is not false
    or (v_state->>'pushNotificationsOptIn')::boolean is not false then
    raise exception 'Incomplete state or optional consent choices were incorrect';
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

reset role;

set request.jwt.claims = '{"role":"service_role"}';
update public.profiles
set activation_status = 'disabled'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set role authenticated;
set request.jwt.claims = '{"role":"authenticated"}';

do $$
declare
  v_state jsonb;
begin
  select public.get_mobile_onboarding_state() into v_state;
  if v_state->>'status' <> 'incomplete' then
    raise exception 'Disabled account unexpectedly retained mobile access';
  end if;
  begin
    perform public.complete_mobile_onboarding();
    raise exception 'Disabled account unexpectedly completed onboarding';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;
set request.jwt.claims = '{"role":"service_role"}';
update public.profiles
set activation_status = 'active'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

create or replace function public.test_reject_push_consent()
returns trigger
language plpgsql
as $$
begin
  if new.user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    and new.consent_type = 'push_notifications'::public.consent_type then
    raise exception 'Injected push failure';
  end if;
  return new;
end;
$$;

create trigger trg_test_reject_push_consent
before insert on public.consents
for each row execute function public.test_reject_push_consent();

set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set request.jwt.claims = '{"role":"authenticated"}';

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

reset role;
drop trigger trg_test_reject_push_consent on public.consents;
drop function public.test_reject_push_consent();

insert into public.policy_version_tracking(
  id,
  policy_type,
  version,
  label,
  document_url,
  checksum,
  effective_at,
  is_active
)
values (
  '55555555-5555-4555-8555-555555555555',
  'privacy',
  '2.0-unbound',
  'Privacy',
  'https://example.test/privacy-v2',
  null,
  now(),
  true
);

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims = '{"role":"authenticated"}';

do $$
declare
  v_state jsonb;
begin
  select public.get_mobile_onboarding_state() into v_state;
  if v_state->>'status' <> 'incomplete' then
    raise exception 'An unbound current policy must invalidate completion';
  end if;

  begin
    perform public.capture_mobile_onboarding_consents(
      p_terms_policy_version_id => '11111111-1111-4111-8111-111111111111',
      p_privacy_policy_version_id => '55555555-5555-4555-8555-555555555555',
      p_health_data_policy_version_id => '33333333-3333-4333-8333-333333333333',
      p_accept_terms => true,
      p_accept_privacy => true,
      p_accept_health_data => true
    );
    raise exception 'Unbound policy consent unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  begin
    perform public.complete_mobile_onboarding();
    raise exception 'Completion unexpectedly ignored unbound current policy';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;

select '[ok] mobile onboarding PostgreSQL contract' as result;
