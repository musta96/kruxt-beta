-- Run as the owner against a fully migrated disposable PostgreSQL database.
-- No policies, grants, fixtures, or RPC side effects survive this transaction.
begin;

select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

insert into auth.users(id, email) values
  ('8d260000-0000-4000-8000-000000000001', 'privacy-no-consent-one@example.test'),
  ('8d260000-0000-4000-8000-000000000002', 'privacy-no-consent-two@example.test');
insert into public.profiles(id, username, display_name, activation_status) values
  ('8d260000-0000-4000-8000-000000000001', 'privacy_no_consent_one', 'Privacy No Consent One', 'active'),
  ('8d260000-0000-4000-8000-000000000002', 'privacy_no_consent_two', 'Privacy No Consent Two', 'active');

do $$
begin
  if exists (select 1 from public.consents where user_id in (
    '8d260000-0000-4000-8000-000000000001', '8d260000-0000-4000-8000-000000000002'
  )) then
    raise exception 'Profile creation automatically recorded consent';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.privacy_requests'::regclass) then
    raise exception 'Privacy request RLS is disabled';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_actor uuid;
  v_type public.privacy_request_type;
  v_id uuid;
begin
  foreach v_actor in array array[
    '8d260000-0000-4000-8000-000000000001'::uuid,
    '8d260000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    if not exists (select 1 from public.profiles where id = auth.uid() and activation_status = 'active')
      or public.is_service_role()
      or public.user_has_required_consents(v_actor)
      or exists (select 1 from public.consents where user_id = v_actor) then
      raise exception 'Expected an authenticated active own profile with no consents: %', v_actor;
    end if;

    foreach v_type in array array[
      'access'::public.privacy_request_type,
      'export'::public.privacy_request_type,
      'delete'::public.privacy_request_type
    ] loop
      v_id := public.submit_privacy_request(v_type, 'Privacy without consent contract');
      if v_id is null or not exists (
        select 1 from public.privacy_requests
        where id = v_id and user_id = v_actor and request_type = v_type
          and status = 'submitted' and reason = 'Privacy without consent contract'
          and due_at is not null and resolved_at is null and handled_by is null
          and response_location is null and notes is null
      ) then
        raise exception 'Unconsented intake/read failed or RPC did not bind actor/type/state: %, %', v_actor, v_type;
      end if;
      if v_type = 'access' then
        perform set_config(
          case when v_actor = '8d260000-0000-4000-8000-000000000001'::uuid
            then 'privacy_without_consent.one' else 'privacy_without_consent.two' end,
          v_id::text, true);
      end if;
    end loop;

    begin
      insert into public.workouts(user_id, title, started_at)
      values (v_actor, 'Blocked privacy-without-consent workout', now());
      raise exception 'Unconsented workout insertion unexpectedly succeeded';
    exception when insufficient_privilege then
      if sqlerrm <> 'Current required policy consent is required before creating workouts' then
        raise;
      end if;
    end;

    if public.user_has_required_consents(v_actor)
      or exists (select 1 from public.consents where user_id = v_actor) then
      raise exception 'Privacy submission automatically recorded consent: %', v_actor;
    end if;
  end loop;
end $$;

-- Each actor must see exactly their own three requests, never the other actor's.
do $$
declare
  v_actor uuid;
  v_foreign uuid;
begin
  foreach v_actor in array array[
    '8d260000-0000-4000-8000-000000000001'::uuid,
    '8d260000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    v_foreign := current_setting(
      case when v_actor = '8d260000-0000-4000-8000-000000000001'::uuid
        then 'privacy_without_consent.two' else 'privacy_without_consent.one' end)::uuid;
    if (select count(*) from public.privacy_requests where user_id = v_actor) <> 3
      or exists (select 1 from public.privacy_requests where user_id <> v_actor)
      or exists (select 1 from public.privacy_requests where id = v_foreign) then
      raise exception 'Privacy SELECT RLS failed for actor %', v_actor;
    end if;
    begin
      insert into public.privacy_requests(user_id, request_type)
      values (v_actor, 'access');
      raise exception 'Direct privacy insertion bypassed RPC-only intake';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.privacy_requests set reason = 'Foreign ACL mutation' where id = v_foreign;
      raise exception 'Foreign privacy UPDATE privilege unexpectedly available';
    exception when insufficient_privilege then null;
    end;
    begin
      delete from public.privacy_requests where id = v_foreign;
      raise exception 'Foreign privacy DELETE privilege unexpectedly available';
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

-- The public RPC denies anonymous execution and an authenticated role without a subject.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.submit_privacy_request('access', 'Anonymous attempt');
    raise exception 'Anonymous privacy submission unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$ begin
  begin
    perform public.submit_privacy_request('access', 'Missing subject attempt');
    raise exception 'Subjectless privacy submission unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'Authentication required' then raise; end if;
  end;
end $$;

reset role;
-- Isolate RLS from the production ACL denial; these grants also roll back.
grant update, delete on public.privacy_requests to authenticated;
set local role authenticated;
do $$
declare
  v_actor uuid;
  v_foreign uuid;
  v_count bigint;
begin
  foreach v_actor in array array[
    '8d260000-0000-4000-8000-000000000001'::uuid,
    '8d260000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    v_foreign := current_setting(
      case when v_actor = '8d260000-0000-4000-8000-000000000001'::uuid
        then 'privacy_without_consent.two' else 'privacy_without_consent.one' end)::uuid;
    update public.privacy_requests set reason = 'Foreign RLS mutation' where id = v_foreign;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'Foreign privacy UPDATE escaped RLS'; end if;
    delete from public.privacy_requests where id = v_foreign;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'Foreign privacy DELETE escaped RLS'; end if;
  end loop;
end $$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  -- Owner checks prevent RLS from concealing accidental writes or deletions.
  if (select count(*) from public.privacy_requests where user_id in (
    '8d260000-0000-4000-8000-000000000001', '8d260000-0000-4000-8000-000000000002'
  )) <> 6 or exists (
    select 1 from public.privacy_requests where user_id in (
      '8d260000-0000-4000-8000-000000000001', '8d260000-0000-4000-8000-000000000002'
    ) and (reason is distinct from 'Privacy without consent contract' or status <> 'submitted')
  ) then
    raise exception 'Privacy requests were changed, deleted, or unexpectedly created';
  end if;
  if exists (select 1 from public.consents where user_id in (
    '8d260000-0000-4000-8000-000000000001', '8d260000-0000-4000-8000-000000000002'
  )) then
    raise exception 'Privacy workflow left automatically created consent records';
  end if;
  if exists (select 1 from public.workouts where user_id in (
    '8d260000-0000-4000-8000-000000000001', '8d260000-0000-4000-8000-000000000002'
  )) then
    raise exception 'Unconsented workout insertion left a persisted row';
  end if;
end $$;

rollback;
