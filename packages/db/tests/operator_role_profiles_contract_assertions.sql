-- Actual production DDL/resolver/audit functions, with local auth-claim shims.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',false);
select public.platform_mutate_operator_role_profile('create',null,null,'Desk monitor','Read-only operations',
  '{"platform.system_health.view":true,"platform.tenants.view":false}',null,null,'Initial desk profile');
reset role;
create table operator_test.ids as select id from public.platform_operator_role_profiles where name='Desk monitor';
grant select on operator_test.ids to authenticated;
create function operator_test.mutate(action text, ver integer default 1, target uuid default null, expected uuid default null, permissions jsonb default '{}') returns jsonb
language sql security invoker as $$ select public.platform_mutate_operator_role_profile(action,
  (select id from operator_test.ids),ver,'Desk monitor','Read-only operations',permissions,target,expected,'Profile contract test') $$;
grant execute on function operator_test.mutate(text,integer,uuid,uuid,jsonb) to authenticated;

set role authenticated;
select operator_test.mutate('assign',1,'00000000-0000-4000-8000-000000000008');
select operator_test.assert_true(public.platform_operator_has_permission('platform.system_health.view','00000000-0000-4000-8000-000000000008'), 'profile grant resolves on server');
select operator_test.assert_true(not public.platform_operator_has_permission('platform.tenants.view','00000000-0000-4000-8000-000000000008'), 'profile deny overrides role grant');
select operator_test.assert_true(not public.platform_operator_has_permission('unknown','00000000-0000-4000-8000-000000000008'), 'unknown defaults deny');
select operator_test.assert_true(exists(select 1 from jsonb_array_elements(public.platform_operator_role_profiles_snapshot()->'effective_permissions') r
  where r->>'user_id'='00000000-0000-4000-8000-000000000008' and r->>'permission_key'='platform.system_health.view' and r->>'source'='profile' and (r->>'is_allowed')::boolean), 'authoritative profile provenance');
select operator_test.denied($q$select operator_test.mutate('assign',1,'00000000-0000-4000-8000-000000000001')$q$,'42501');
select operator_test.denied($q$select operator_test.mutate('assign',1,'00000000-0000-4000-8000-000000000009')$q$,'42501');
select operator_test.denied($q$select operator_test.mutate('assign',1,'00000000-0000-4000-8000-000000000008')$q$,'40001');
select operator_test.denied($q$select operator_test.mutate('update',999)$q$,'40001');
select operator_test.denied($q$select operator_test.mutate('delete')$q$,'22023');
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.operators.roles_matrix_edit":true}')$q$,'22023');
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.support.access.approve":true}')$q$,'22023');
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.support.grants.approve":true}')$q$,'22023');
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.flags.manage":true}')$q$,'22023');
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.tenants.view":"true"}')$q$,'22023');
select operator_test.denied($q$select public.platform_mutate_operator_role_profile('create',null,null,'Invalid','','{}',null,null,' ')$q$,'22023');
select operator_test.denied($q$update public.platform_operator_role_profiles set permissions='{}'$q$,'42501');
select operator_test.denied($q$delete from public.platform_operator_role_profile_assignments$q$,'42501');

-- Explicit user deny wins over the assigned profile's grant.
select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.system_health.view',false,'Explicit denial');
select operator_test.assert_true(not public.platform_operator_has_permission('platform.system_health.view','00000000-0000-4000-8000-000000000008'), 'user deny wins');
select operator_test.assert_true(exists(select 1 from jsonb_array_elements(public.platform_operator_role_profiles_snapshot()->'effective_permissions') r
  where r->>'user_id'='00000000-0000-4000-8000-000000000008' and r->>'permission_key'='platform.system_health.view' and r->>'source'='user_override' and not (r->>'is_allowed')::boolean), 'deny provenance');
reset role;
update public.platform_permission_catalog set is_active=false where permission_key='platform.system_health.view';
select operator_test.assert_true(not public.platform_operator_has_permission('platform.system_health.view','00000000-0000-4000-8000-000000000008'), 'inactive catalog denied');
set role authenticated;
select operator_test.denied($q$select operator_test.mutate('update',1,null,null,'{"platform.system_health.view":true}')$q$,'22023');
reset role;
update public.platform_permission_catalog set is_active=true where permission_key='platform.system_health.view';

-- All six role identities remain; no delegated capability can replace founder.
do $$ declare i integer; begin
  for i in 2..7 loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal','aal2')::text,false);
    set local role authenticated;
    perform operator_test.denied($q$select operator_test.mutate('update')$q$,'42501');
    reset role;
  end loop;
end $$;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',false);
select operator_test.denied($q$select operator_test.mutate('update')$q$,'42501');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',false);
reset role;
insert into public.platform_operator_permission_overrides(user_id,permission_key,is_allowed)
values('00000000-0000-4000-8000-000000000001','platform.operators.roles_matrix_edit',false);
set role authenticated;
select operator_test.denied($q$select operator_test.mutate('update')$q$,'42501');
reset role;
delete from public.platform_operator_permission_overrides where user_id='00000000-0000-4000-8000-000000000001';
set role anon;
select operator_test.denied($q$select public.platform_operator_role_profiles_snapshot()$q$,'42501');
select operator_test.denied($q$select operator_test.mutate('update')$q$,'42501');
reset role;
set role service_role;
select operator_test.denied($q$select operator_test.mutate('update')$q$,'42501');
reset role;

-- Force the production audit insert to fail. Neither the profile write nor an
-- assignment nor deletion may survive the RPC subtransaction.
create function operator_test.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Fixture audit unavailable' using errcode='23514'; end $$;
create trigger role_profile_audit_failure before insert on public.audit_logs for each row execute function operator_test.fail_audit();
create table operator_test.audit_count as select count(*) as n from public.audit_logs;
set role authenticated;
select operator_test.denied($q$select operator_test.mutate('update')$q$,'23514');
select operator_test.denied($q$select operator_test.mutate('assign',1,'00000000-0000-4000-8000-000000000008',(select id from operator_test.ids))$q$,'23514');
select operator_test.denied($q$select public.platform_mutate_operator_role_profile('create',null,null,'Must roll back','','{}',null,null,'Audit rollback')$q$,'23514');
select operator_test.denied($q$select public.platform_mutate_operator_role_profile('assign',null,null,null,null,null,'00000000-0000-4000-8000-000000000008',(select id from operator_test.ids),'Unassign rollback')$q$,'23514');
reset role;
select operator_test.assert_true((select count(*) from public.audit_logs)=(select n from operator_test.audit_count),'no partial audit');
select operator_test.assert_true((select version from public.platform_operator_role_profiles where id=(select id from operator_test.ids))=1,'profile update rolled back');
select operator_test.assert_true(not exists(select 1 from public.platform_operator_role_profiles where name='Must roll back'),'create rolled back');
select operator_test.assert_true(exists(select 1 from public.platform_operator_role_profile_assignments where user_id='00000000-0000-4000-8000-000000000008'),'assignment retained');
drop trigger role_profile_audit_failure on public.audit_logs;
set role authenticated;
select public.platform_mutate_operator_role_profile('assign',null,null,null,null,null,'00000000-0000-4000-8000-000000000008',(select id from operator_test.ids),'Unassign');
select operator_test.mutate('update',1,null,null,'{"platform.flags.view":true}');
select operator_test.mutate('delete',2);
reset role;
select operator_test.assert_true(not exists(select 1 from public.platform_operator_role_profiles),'CRUD complete');
select operator_test.assert_true((select count(*) from public.audit_logs where action like 'platform.operator.role_profile.%')=5,'each committed mutation audited once');
select operator_test.assert_true((select count(*) from unnest(enum_range(null::public.platform_operator_role)))=6,'six enum roles stable');
