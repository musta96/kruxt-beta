select operator_test.assert_true(not exists (
  select 1 from pg_roles where rolname in ('authenticated','anon') and (rolsuper or rolbypassrls)
), 'client roles really enforce RLS');
select operator_test.assert_true(not exists (
  select 1 from pg_policies where schemaname = 'public'
  and tablename in ('platform_operator_accounts','platform_role_permissions','platform_permission_catalog','platform_operator_permission_overrides')
  and cmd <> 'SELECT' and permissive = 'PERMISSIVE'
), 'all permissive write policies removed');
select operator_test.assert_true(exists (
  select 1 from pg_policies where policyname = 'fixture_unknown_all' and cmd = 'SELECT'
), 'ALL policy SELECT behavior retained');
select operator_test.assert_true(not has_function_privilege('anon', 'public.platform_set_operator_permission_override(uuid,text,boolean,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.platform_clear_operator_permission_override(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.platform_mutate_operator_override_internal(uuid,text,boolean,text,boolean)', 'EXECUTE'), 'RPC ACLs');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', false);
select operator_test.assert_true((select count(*) from public.platform_operator_accounts) = 8, 'founder SELECT retained');
do $$
declare t text; i int;
begin
  for i in 1..9 loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-' || lpad(i::text,12,'0'), 'role','authenticated','aal','aal2')::text, false);
    foreach t in array array['platform_operator_accounts','platform_role_permissions','platform_permission_catalog','platform_operator_permission_overrides'] loop
      perform operator_test.denied(format('delete from public.%I', t), '42501');
      perform operator_test.denied(format('update public.%I set metadata = metadata', t), '42501');
      perform operator_test.denied(format('insert into public.%I select * from public.%I where false', t, t), '42501');
      perform operator_test.denied(format('truncate public.%I cascade', t), '42501');
    end loop;
  end loop;
end $$;
select operator_test.denied($q$select public.platform_mutate_operator_override_internal('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'test',false)$q$, '42501');
-- Real SET ROLE execution, not superuser-simulated policy evaluation.
do $$
declare i int; aal text;
begin
  for i in 1..9 loop
    foreach aal in array array['aal1', 'aal2', ''] loop
      perform set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-' || lpad(i::text,12,'0'), 'role','authenticated','aal',aal)::text, false);
      if i <> 1 or aal <> 'aal2' then
        perform operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'test')$q$, '42501');
        perform operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','test')$q$, '42501');
      end if;
    end loop;
  end loop;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', false);
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000001','platform.tenants.view',false,'test')$q$, '42501');
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000007','platform.tenants.view','test')$q$, '42501');
do $$
declare reason text; key text;
begin
  foreach reason in array array[null, '', '   ', E'\t\n'] loop
    perform operator_test.denied(format('select public.platform_set_operator_permission_override(%L,%L,true,%L)', '00000000-0000-4000-8000-000000000008','platform.tenants.view',reason), '22023');
    perform operator_test.denied(format('select public.platform_clear_operator_permission_override(%L,%L,%L)', '00000000-0000-4000-8000-000000000008','platform.tenants.view',reason), '22023');
  end loop;
  foreach key in array array['fixture.disabled','fixture.missing'] loop
    perform operator_test.denied(format('select public.platform_set_operator_permission_override(%L,%L,true,%L)', '00000000-0000-4000-8000-000000000008',key,'test'), '22023');
    perform operator_test.denied(format('select public.platform_clear_operator_permission_override(%L,%L,%L)', '00000000-0000-4000-8000-000000000008',key,'test'), '22023');
  end loop;
end $$;
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',null,'test')$q$, '22023');
select operator_test.assert_true(not public.platform_operator_has_permission('fixture.disabled','00000000-0000-4000-8000-000000000008'), 'disabled catalog beats override');
select operator_test.assert_true(not public.platform_operator_has_permission('fixture.disabled','00000000-0000-4000-8000-000000000006'), 'disabled catalog beats role grant');
select operator_test.assert_true(public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008',' PLATFORM.TENANTS.VIEW ',false,'  deny test  ')
  = '{"userId":"00000000-0000-4000-8000-000000000008","permissionKey":"platform.tenants.view","isAllowed":false}'::jsonb, 'compatible set acknowledgment');
select operator_test.assert_true(not public.platform_operator_has_permission('platform.tenants.view','00000000-0000-4000-8000-000000000008'), 'explicit denial beats default');
select operator_test.assert_true(public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','restore default')
  = '{"userId":"00000000-0000-4000-8000-000000000008","permissionKey":"platform.tenants.view","cleared":true}'::jsonb, 'compatible clear acknowledgment');
select operator_test.assert_true(public.platform_operator_has_permission('platform.tenants.view','00000000-0000-4000-8000-000000000008'), 'clear restores default');
reset role;

insert into public.platform_operator_permission_overrides(user_id, permission_key, is_allowed)
values ('00000000-0000-4000-8000-000000000001','platform.operators.roles_matrix_edit',false);
set role authenticated;
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'test')$q$, '42501');
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','test')$q$, '42501');
reset role;
delete from public.platform_operator_permission_overrides where user_id = '00000000-0000-4000-8000-000000000001';
update public.platform_permission_catalog set is_active = false where permission_key = 'platform.operators.roles_matrix_edit';
set role authenticated;
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'test')$q$, '42501');
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','test')$q$, '42501');
reset role;
update public.platform_permission_catalog set is_active = true where permission_key = 'platform.operators.roles_matrix_edit';
update public.platform_operator_accounts set is_active = false where user_id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
-- Claims remain unchanged: row deactivation must defeat the existing AAL2 JWT.
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'stale token')$q$, '42501');
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','stale token')$q$, '42501');
reset role;
update public.platform_operator_accounts set is_active = true where user_id = '00000000-0000-4000-8000-000000000001';
select operator_test.assert_true((select count(*) from public.audit_logs) = 2, 'denials never audit or mutate');
select operator_test.assert_true(exists(select from public.audit_logs where reason = 'deny test' and metadata->>'nextOverride' = 'false'), 'audit reason and metadata');

-- Grant ACLs back temporarily: restrictive RLS still defeats permissive policies.
grant insert, update, delete on public.platform_operator_accounts to authenticated;
create policy fixture_future_all on public.platform_operator_accounts for all to authenticated using (true) with check (true);
set role authenticated;
with changed as (delete from public.platform_operator_accounts where role = 'founder' returning *)
select operator_test.assert_true((select count(*) from changed) = 0, 'last founder deletion blocked by RLS');
with changed as (update public.platform_operator_accounts set role = 'founder' returning *)
select operator_test.assert_true((select count(*) from changed) = 0, 'promotion blocked by RLS');
select operator_test.denied($q$insert into public.platform_operator_accounts(user_id,role) values ('00000000-0000-4000-8000-000000000009','founder')$q$, '42501');
reset role;

-- Audit failures must roll the mutation back, not acknowledge unaudited success.
create function operator_test.reject_audit() returns trigger language plpgsql as $$ begin raise exception 'fixture audit failure' using errcode = 'P0001'; end $$;
create trigger fixture_reject_audit before insert on public.audit_logs for each row execute function operator_test.reject_audit();
set role authenticated;
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',false,'must roll back')$q$, 'P0001');
reset role;
select operator_test.assert_true(not exists(select from public.platform_operator_permission_overrides where permission_key = 'platform.tenants.view'), 'audit failure rolls back set');
drop trigger fixture_reject_audit on public.audit_logs;
set role authenticated;
select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',false,'setup clear rollback');
reset role;
create trigger fixture_reject_audit before insert on public.audit_logs for each row execute function operator_test.reject_audit();
set role authenticated;
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','must roll back')$q$, 'P0001');
reset role;
select operator_test.assert_true(exists(select from public.platform_operator_permission_overrides where permission_key = 'platform.tenants.view' and not is_allowed), 'audit failure rolls back clear');

set role anon;
select set_config('request.jwt.claims', '{}', false);
select operator_test.assert_true(not public.platform_operator_has_permission('platform.tenants.view'), 'anonymous resolver EXECUTE compatibility');
select operator_test.assert_true((select count(*) from public.platform_permission_catalog) = 0, 'anonymous public RLS resolver path remains callable');
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'anonymous')$q$, '42501');
select operator_test.denied($q$select public.platform_clear_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view','anonymous')$q$, '42501');
reset role;
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select operator_test.assert_true(public.platform_operator_has_permission('fixture.disabled'), 'trusted service resolver bypass retained');
select operator_test.denied($q$select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',true,'service')$q$, '42501');
-- Trusted service maintenance can still remove founder accounts: not an API invariant.
delete from public.platform_operator_accounts where role = 'founder';
reset role;
select operator_test.assert_true(not exists(select from public.platform_operator_accounts where role = 'founder'), 'explicit breakglass boundary');
