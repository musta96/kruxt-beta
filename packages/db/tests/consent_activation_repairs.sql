begin;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into auth.users (id, email) values
  ('7b000000-0000-0000-0000-000000000001', 'repair-owner@example.test'),
  ('7b000000-0000-0000-0000-000000000002', 'repair-member@example.test');
insert into public.profiles (id, username, display_name, activation_status) values
  ('7b000000-0000-0000-0000-000000000001', 'repair_owner', 'Repair Owner', 'active'),
  ('7b000000-0000-0000-0000-000000000002', 'repair_member', 'Repair Member', 'pending_activation');
insert into public.gyms (id, slug, name, owner_user_id) values
  ('7b000000-0000-0000-0000-000000000010', 'consent-repair-gym', 'Consent Repair Gym',
   '7b000000-0000-0000-0000-000000000001');
insert into public.gym_invite_codes (gym_id, code, created_by) values
  ('7b000000-0000-0000-0000-000000000010', 'REPAIR-CODE', '7b000000-0000-0000-0000-000000000001');
insert into public.gym_profile_invitations
  (id, gym_id, invited_user_id, email, display_name, requested_role, gym_role, expires_at)
values
  ('7b000000-0000-0000-0000-000000000020', '7b000000-0000-0000-0000-000000000010',
   '7b000000-0000-0000-0000-000000000002', 'repair-member@example.test', 'Repair Member',
   'owner', 'leader', now() + interval '1 day');
insert into public.policy_version_tracking
  (policy_type, version, label, document_url, checksum, effective_at, is_active, requires_reconsent)
values
  ('terms', 'repair-terms', 'Terms', 'https://example.test/terms.pdf', repeat('a',64), now(), true, true),
  ('privacy', 'repair-privacy', 'Privacy', 'https://example.test/privacy.pdf', repeat('b',64), now(), true, true),
  ('health_data', 'repair-health', 'Health', 'https://example.test/health.pdf', repeat('c',64), now(), true, true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7b000000-0000-0000-0000-000000000002', true);
do $$
declare v_profile record;
begin
  begin
    delete from public.profiles where id = auth.uid();
    raise exception 'self-delete unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  select * into v_profile from public.ensure_self_profile('new_name', 'New Name');
  if v_profile.activation_status <> 'pending_activation' then
    raise exception 'ensure_self_profile bypassed pending activation';
  end if;
  -- Exercise PostgREST's id-bearing ON CONFLICT UPDATE rather than a plain UPDATE.
  insert into public.profiles (id, username, display_name)
  values (auth.uid(), 'repair_member', 'Updated Member')
  on conflict (id) do update set id = excluded.id, username = excluded.username, display_name = excluded.display_name;
  if not exists (select 1 from public.profiles where id = auth.uid()
      and display_name = 'Updated Member' and activation_status = 'pending_activation') then
    raise exception 'safe upsert failed or changed activation';
  end if;
  begin
    perform public.complete_profile_activation_atomic(
      '7b000000-0000-0000-0000-000000000020', auth.uid(), 1, true);
    raise exception 'authenticated activation RPC unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.redeem_gym_invite_code('REPAIR-CODE');
    raise exception 'pending user redeemed invite';
  exception when insufficient_privilege then null; end;
  begin
    perform public.request_gym_membership('7b000000-0000-0000-0000-000000000010');
    raise exception 'pending user requested membership';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles set activation_status = 'disabled' where id = '7b000000-0000-0000-0000-000000000002';
do $$
begin
  if (public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000002', 1, true)->>'status') <> 'disabled' then
    raise exception 'pending invitation reactivated a disabled profile';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
declare v_profile record;
begin
  begin
    delete from public.profiles where id = auth.uid();
    raise exception 'disabled profile self-delete unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  select * into v_profile from public.ensure_self_profile();
  if v_profile.activation_status <> 'disabled' then raise exception 'disabled profile recreated active'; end if;
  begin
    perform public.redeem_gym_invite_code('REPAIR-CODE');
    raise exception 'disabled user redeemed invite';
  exception when insufficient_privilege then null; end;
  begin
    perform public.request_gym_membership('7b000000-0000-0000-0000-000000000010');
    raise exception 'disabled user requested membership';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles set activation_status = 'pending_activation' where id = '7b000000-0000-0000-0000-000000000002';
-- Force failure at the last write to prove ALL activation side effects roll back.
create function public.test_reject_activation_audit() returns trigger language plpgsql as $$
begin
  if new.action = 'gym.profile_invite.activated' then raise exception 'test audit failure' using errcode = '23514'; end if;
  return new;
end $$;
create trigger test_reject_activation_audit before insert on public.audit_logs
  for each row execute function public.test_reject_activation_audit();
set local role service_role;
do $$
begin
  if (public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000002', 2, true)->>'status') <> 'stale_attempt' then
    raise exception 'stale activation attempt accepted';
  end if;
  if (public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000001', 1, true)->>'status') <> 'forbidden' then
    raise exception 'wrong activation account accepted';
  end if;
  if (public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000002', 1, false)->>'status') <> 'owner_consent_required' then
    raise exception 'owner acceptance bypassed';
  end if;
  begin
    perform public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000002', 1, true);
    raise exception 'injected audit failure did not abort activation';
  exception when check_violation then null; end;
  if exists (select 1 from public.gym_memberships where user_id = '7b000000-0000-0000-0000-000000000002')
    or exists (select 1 from public.profiles where id = '7b000000-0000-0000-0000-000000000002' and activation_status <> 'pending_activation')
    or exists (select 1 from public.gym_profile_invitations where id = '7b000000-0000-0000-0000-000000000020' and status <> 'pending_activation')
    or exists (select 1 from public.gyms where id = '7b000000-0000-0000-0000-000000000010' and owner_user_id <> '7b000000-0000-0000-0000-000000000001') then
    raise exception 'failed activation left partial profile/membership/owner/invite writes';
  end if;
end $$;
reset role;
drop trigger test_reject_activation_audit on public.audit_logs;
set local role service_role;
do $$
declare v_result jsonb;
begin
  v_result := public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
    '7b000000-0000-0000-0000-000000000002', 1, true);
  if v_result->>'ok' <> 'true' then raise exception 'valid activation failed: %', v_result; end if;
  perform public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
    '7b000000-0000-0000-0000-000000000002', 1, true);
  if (select count(*) from public.audit_logs where action = 'gym.profile_invite.activated'
      and target_id = '7b000000-0000-0000-0000-000000000020') <> 1 then
    raise exception 'activation retry duplicated audit';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
begin
  begin
    perform public.redeem_gym_invite_code('REPAIR-CODE');
    raise exception 'active but unconsented user redeemed invite';
  exception when insufficient_privilege then null; end;
  begin
    perform public.request_gym_membership('7b000000-0000-0000-0000-000000000010');
    raise exception 'active but unconsented user requested membership';
  exception when insufficient_privilege then null; end;
  perform public.accept_required_consents(array[
    public.current_policy_version_id('terms'), public.current_policy_version_id('privacy'),
    public.current_policy_version_id('health_data')], 'web', 'en-GB');
  perform public.redeem_gym_invite_code('REPAIR-CODE');
  perform public.request_gym_membership('7b000000-0000-0000-0000-000000000010');
end $$;
reset role;
do $$
begin
  if (select redeemed_count from public.gym_invite_codes where code = 'REPAIR-CODE') <> 1 then
    raise exception 'blocked redemptions changed invite usage';
  end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.accept_required_consents('{}');
    raise exception 'anonymous consent RPC permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.complete_profile_activation_atomic('7b000000-0000-0000-0000-000000000020',
      '7b000000-0000-0000-0000-000000000002', 1, true);
    raise exception 'anonymous activation RPC permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
