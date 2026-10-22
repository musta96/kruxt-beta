begin;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into auth.users(id, email) values
  ('7c000000-0000-4000-8000-000000000001', 'privacy-subject@example.test'),
  ('7c000000-0000-4000-8000-000000000002', 'privacy-staff@example.test');
insert into public.profiles(id, username, display_name) values
  ('7c000000-0000-4000-8000-000000000001', 'privacy_subject', 'Privacy Subject'),
  ('7c000000-0000-4000-8000-000000000002', 'privacy_staff', 'Privacy Staff');
insert into public.privacy_requests(id, user_id, request_type) values
  ('7c000000-0000-4000-8000-000000000010', '7c000000-0000-4000-8000-000000000001', 'delete');

do $$
declare v_role text; v_column record;
begin
  foreach v_role in array array['anon','authenticated'] loop
    if has_function_privilege(v_role,
      'public.transition_privacy_request_status(uuid,public.privacy_request_status,text)', 'EXECUTE') then
      raise exception 'Client retains transition RPC privilege: %', v_role;
    end if;
    if has_table_privilege(v_role, 'public.privacy_requests', 'INSERT,UPDATE,DELETE') then
      raise exception 'Client retains privacy write privilege: %', v_role;
    end if;
    for v_column in select attname from pg_attribute
      where attrelid = 'public.privacy_requests'::regclass and attnum > 0 and not attisdropped loop
      if has_column_privilege(v_role, 'public.privacy_requests', v_column.attname, 'INSERT,UPDATE') then
        raise exception 'Client retains privacy column privilege: %', v_column.attname;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role',
    'public.transition_privacy_request_status(uuid,public.privacy_request_status,text)', 'EXECUTE') then
    raise exception 'Worker transition privilege missing';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000001', true);
do $$
declare v_id uuid;
begin
  v_id := public.submit_privacy_request('access', 'Local privacy regression');
  if not exists(select 1 from public.privacy_requests where id = v_id and status = 'submitted') then
    raise exception 'Subject intake/read no longer works';
  end if;
  begin
    perform public.transition_privacy_request_status(v_id, 'fulfilled', 'forged completion');
    raise exception 'Subject completed own request';
  exception when insufficient_privilege then null; end;
  begin
    update public.privacy_requests set response_location = 'https://attacker.test/' where id = v_id;
    raise exception 'Subject changed response location';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.privacy_requests(user_id, request_type, status) values(auth.uid(), 'export', 'fulfilled');
    raise exception 'Subject inserted completed request';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000002', true);
do $$ begin
  begin
    perform public.transition_privacy_request_status('7c000000-0000-4000-8000-000000000010', 'triaged');
    raise exception 'Other subject transitioned request';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
-- Test defense in depth even if a future change accidentally re-grants DML.
grant insert, update on public.privacy_requests to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    insert into public.privacy_requests(user_id, request_type, status) values(auth.uid(), 'export', 'fulfilled');
    raise exception 'Trigger permitted forged completion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Owner execution isolates the trigger from RLS/ACL checks; claims stay unprivileged.
do $$ begin
  begin
    update public.privacy_requests set notes = 'forged staff notes'
      where id = '7c000000-0000-4000-8000-000000000010';
    raise exception 'Trigger permitted state update';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.transition_privacy_request_status('7c000000-0000-4000-8000-000000000010', 'triaged');
select public.transition_privacy_request_status('7c000000-0000-4000-8000-000000000010', 'in_progress');
rollback;
