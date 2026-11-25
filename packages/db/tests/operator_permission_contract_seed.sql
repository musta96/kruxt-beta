-- Profiles and accounts are fixture identities only.
insert into public.profiles(id, display_name, username)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'fixture', 'fixture' || i
from generate_series(1, 9) i;
insert into public.platform_operator_accounts(user_id, role, is_active)
select id, (array['founder','ops_admin','support_admin','compliance_admin','analyst','read_only','founder','read_only'])[row_number() over (order by id)]::public.platform_operator_role,
  id <> '00000000-0000-4000-8000-000000000007'
from public.profiles where id <> '00000000-0000-4000-8000-000000000009';
insert into public.platform_permission_catalog(permission_key, category, label)
values ('platform.operators.manage', 'test', 'Legacy management'), ('fixture.disabled', 'test', 'Disabled');
insert into public.platform_role_permissions(role, permission_key, is_allowed)
values ('founder', 'platform.operators.manage', true), ('read_only', 'fixture.disabled', true);
-- Delegated matrix edit is deliberately insufficient without founder identity.
insert into public.platform_operator_permission_overrides(user_id, permission_key, is_allowed)
values ('00000000-0000-4000-8000-000000000002', 'platform.operators.roles_matrix_edit', true),
       ('00000000-0000-4000-8000-000000000008', 'fixture.disabled', true);
update public.platform_permission_catalog set is_active = false where permission_key = 'fixture.disabled';
-- Unknown historical names/roles must not leave permissive write paths behind.
create policy fixture_unknown_all on public.platform_operator_accounts for all to public using (true) with check (true);
create policy fixture_unknown_insert on public.platform_role_permissions for insert to public with check (true);
create policy fixture_anonymous_read on public.platform_permission_catalog for select to anon
using (public.platform_operator_has_permission('platform.tenants.view'));

create schema operator_test;
grant usage on schema operator_test to authenticated, anon, service_role;
create function operator_test.assert_true(ok boolean, label text) returns void
language plpgsql security invoker as $$ begin
  if ok is distinct from true then raise exception 'Assertion failed: %', label; end if;
end $$;
create function operator_test.denied(statement text, expected_state text) returns void
language plpgsql security invoker as $$
declare actual text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual <> expected_state then raise exception 'Expected %, got %: %', expected_state, actual, statement; end if;
    return;
  end;
  raise exception 'Unexpected success: %', statement;
end $$;
