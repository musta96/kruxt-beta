begin;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into auth.users(id, email) values
  ('7f000000-0000-4000-8000-000000000001', 'erase-one@example.test'),
  ('7f000000-0000-4000-8000-000000000002', 'erase-two@example.test');
insert into public.profiles(id, username, display_name, activation_status) values
  ('7f000000-0000-4000-8000-000000000001', 'erase_one', 'Erase One', 'active'),
  ('7f000000-0000-4000-8000-000000000002', 'erase_two', 'Erase Two', 'active');

do $$ begin
  if has_function_privilege('authenticated', 'public.apply_user_anonymization(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.apply_user_anonymization(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.apply_user_anonymization_legacy(uuid,uuid)', 'EXECUTE') then
    raise exception 'Anonymization execution boundary regressed';
  end if;
end $$;

set local role service_role;
do $$
declare result jsonb;
begin
  result := public.apply_user_anonymization('7f000000-0000-4000-8000-000000000001');
  if result->>'profile_disabled' <> 'true'
    or not exists(select 1 from public.profiles where id = '7f000000-0000-4000-8000-000000000001'
      and activation_status = 'disabled' and activated_at is null and not is_public)
    or not exists(select 1 from public.profiles where id = '7f000000-0000-4000-8000-000000000002'
      and activation_status = 'active' and display_name = 'Erase Two') then
    raise exception 'Profile disablement or subject isolation failed';
  end if;
  perform public.apply_user_anonymization('7f000000-0000-4000-8000-000000000001');
end $$;
reset role;

insert into public.legal_holds(user_id, hold_type, reason) values
  ('7f000000-0000-4000-8000-000000000002', 'other', 'Disposable test hold');
set local role service_role;
do $$ begin
  begin
    perform public.apply_user_anonymization('7f000000-0000-4000-8000-000000000002');
    raise exception 'Held subject unexpectedly anonymized';
  exception when raise_exception then
    if sqlerrm <> 'Cannot anonymize user with an active legal hold' then raise; end if;
  end;
  if not exists(select 1 from public.profiles where id = '7f000000-0000-4000-8000-000000000002'
    and activation_status = 'active' and display_name = 'Erase Two') then
    raise exception 'Held subject was modified';
  end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7f000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    update public.profiles set activation_status = 'active'
      where id = '7f000000-0000-4000-8000-000000000001';
    raise exception 'Erased subject unexpectedly reactivated';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
