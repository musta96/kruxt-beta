-- Run against a fully migrated disposable database.
-- The transaction rolls back all fixtures.

begin;

do $$
declare
  v_owner uuid := '79000000-0000-0000-0000-000000000001';
  v_officer uuid := '79000000-0000-0000-0000-000000000002';
  v_member_one uuid := '79000000-0000-0000-0000-000000000003';
  v_member_two uuid := '79000000-0000-0000-0000-000000000004';
  v_gym uuid := '79000000-0000-0000-0000-000000000010';
  v_owner_membership uuid := '79000000-0000-0000-0000-000000000011';
  v_officer_membership uuid := '79000000-0000-0000-0000-000000000012';
  v_member_one_membership uuid := '79000000-0000-0000-0000-000000000013';
  v_member_two_membership uuid := '79000000-0000-0000-0000-000000000014';
  v_missing_membership uuid := '79000000-0000-0000-0000-000000000099';
  v_success_count integer;
  v_failure_count integer;
  v_audit_count integer;
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
  select
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email,
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  from (
    values
      (v_owner, 'issue79-owner@example.test'),
      (v_officer, 'issue79-officer@example.test'),
      (v_member_one, 'issue79-member-one@example.test'),
      (v_member_two, 'issue79-member-two@example.test')
  ) as fixtures(user_id, email)
  on conflict (id) do nothing;

  insert into public.profiles (id, username, display_name)
  values
    (v_owner, 'issue79-owner', 'Issue 79 Owner'),
    (v_officer, 'issue79-officer', 'Issue 79 Officer'),
    (v_member_one, 'issue79-member-one', 'Issue 79 Member One'),
    (v_member_two, 'issue79-member-two', 'Issue 79 Member Two')
  on conflict (id) do update
  set display_name = excluded.display_name;

  insert into public.gyms (id, owner_user_id, name, slug)
  values (v_gym, v_owner, 'Issue 79 Gym', 'issue-79-gym')
  on conflict (id) do nothing;

  insert into public.gym_memberships (
    id,
    gym_id,
    user_id,
    role,
    membership_status
  )
  values
    (v_owner_membership, v_gym, v_owner, 'leader', 'active'),
    (v_officer_membership, v_gym, v_officer, 'officer', 'active'),
    (v_member_one_membership, v_gym, v_member_one, 'member', 'active'),
    (v_member_two_membership, v_gym, v_member_two, 'member', 'active')
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  create temporary table issue79_results on commit drop as
  select *
  from public.bulk_update_gym_memberships(
    v_gym,
    array[v_member_one_membership, v_missing_membership],
    'paused',
    null,
    'Issue 79 partial failure test'
  );

  select count(*) filter (where success), count(*) filter (where not success)
  into v_success_count, v_failure_count
  from issue79_results;

  if v_success_count <> 1 or v_failure_count <> 1 then
    raise exception 'partial failure contract failed: successes %, failures %', v_success_count, v_failure_count;
  end if;

  if not exists (
    select 1
    from public.gym_memberships
    where id = v_member_one_membership
      and membership_status = 'paused'
  ) then
    raise exception 'successful membership mutation was not persisted';
  end if;

  select count(*)
  into v_audit_count
  from public.audit_logs
  where target_id = v_member_one_membership
    and action = 'gym.member.access.updated'
    and reason = 'Issue 79 partial failure test'
    and metadata->>'result' = 'updated';

  if v_audit_count <> 1 then
    raise exception 'expected one persisted audit event, found %', v_audit_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_officer::text, true);

  begin
    perform public.bulk_update_gym_memberships(
      v_gym,
      array[v_member_two_membership],
      null,
      'coach',
      'Officer unauthorized role test'
    );
    raise exception 'officer role mutation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  if exists (
    select 1
    from public.gym_memberships
    where id = v_member_two_membership
      and role <> 'member'
  ) then
    raise exception 'unauthorized role mutation changed the member';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_two::text, true);

  begin
    perform public.bulk_update_gym_memberships(
      v_gym,
      array[v_member_two_membership],
      'paused',
      null,
      'Member unauthorized status test'
    );
    raise exception 'member status mutation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  if exists (
    select 1
    from public.gym_memberships
    where id = v_member_two_membership
      and membership_status <> 'active'
  ) then
    raise exception 'unauthorized status mutation changed the member';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '79000000-0000-0000-0000-000000000004',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    update public.gym_memberships
    set role = 'leader'
    where id = '79000000-0000-0000-0000-000000000014';
    raise exception 'direct role update unexpectedly bypassed the audited RLS guard';
  exception
    when insufficient_privilege then null;
  end;

  if exists (
    select 1
    from public.gym_memberships
    where id = '79000000-0000-0000-0000-000000000014'
      and role <> 'member'
  ) then
    raise exception 'direct unauthorized role mutation changed the member';
  end if;
end;
$$;

reset role;
rollback;
