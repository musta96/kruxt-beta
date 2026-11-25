-- Disposable database only. The optional local runner applies the prototype first:
-- env -u KRUXT_CONSENT_TEST_DATABASE_URL KRUXT_PROCESSING_V2_CONTRACT=1 bash packages/db/tests/run_consent_contract.sh
-- All fixtures, helpers, and ACL changes roll back.
-- Namespace 8e200000: users 001/002, policies 1xx, scopes 2xx, requests 3xx.
-- A single connection tests sequential decision order, not concurrent lock contention.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

create function pg_temp.v2_id(n integer) returns uuid language sql immutable as $$
  select ('8e200000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

create function pg_temp.v2_assert(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'v2 fixture: %', message; end if;
end;
$$;

-- Invoker security is essential: rejection checks must exercise the client role.
create function pg_temp.v2_reject(statement text, expected_state text default null)
returns void language plpgsql as $$
declare state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics state = returned_sqlstate;
    if expected_state is not null and state <> expected_state then
      raise exception 'Expected SQLSTATE %, got % for %: %', expected_state, state, statement, sqlerrm;
    end if;
    return;
  end;
  raise exception 'v2 fixture: unexpectedly accepted %', statement;
end;
$$;

create function pg_temp.v2_decide(scope_number integer, action text, request_number integer)
returns uuid language sql as $$
  select public.record_my_policy_decision_v2(
    p_scope_id => pg_temp.v2_id(scope_number), p_action => action,
    p_request_id => pg_temp.v2_id(request_number))
$$;

-- Owner-only observations avoid audit/outbox RLS masking duplicate side effects.
create function pg_temp.v2_counts() returns jsonb language sql security definer as $$
  select jsonb_build_object(
    'decisions', (select count(*) from consent_v2.decisions),
    'audit', (select count(*) from public.audit_logs),
    'outbox', (select count(*) from public.event_outbox))
$$;
revoke all on function pg_temp.v2_counts() from public;

insert into auth.users(id, email) values
  (pg_temp.v2_id(1), 'processing-v2-one@example.test'),
  (pg_temp.v2_id(2), 'processing-v2-two@example.test');
insert into public.profiles(id, username, display_name, activation_status) values
  (pg_temp.v2_id(1), 'processing_v2_one', 'Processing V2 One', 'active'),
  (pg_temp.v2_id(2), 'processing_v2_two', 'Processing V2 Two', 'active');

insert into public.policy_version_tracking
  (id, policy_type, version, label, document_url, checksum, effective_at, is_active, requires_reconsent)
values
  (pg_temp.v2_id(101), 'terms', 'fixture-v2-terms', 'Fixture Terms',
    'https://example.test/v2/terms', repeat('a', 64), now() - interval '1 second', true, true),
  (pg_temp.v2_id(102), 'privacy', 'fixture-v2-privacy', 'Fixture Privacy',
    'https://example.test/v2/privacy', repeat('b', 64), now() - interval '1 second', true, true),
  (pg_temp.v2_id(103), 'health_data', 'fixture-v2-health', 'Fixture Health',
    'https://example.test/v2/health', repeat('c', 64), now() - interval '1 second', true, true),
  (pg_temp.v2_id(105), 'health_data', 'fixture-v2-retired', 'Fixture Retired',
    'https://example.test/v2/retired', repeat('d', 64), now(), false, true),
  (pg_temp.v2_id(106), 'health_data', 'fixture-v2-unbound', 'Fixture Unbound',
    'https://example.test/v2/unbound', null, now(), false, true);
select pg_temp.v2_assert(
  public.current_policy_version_id('terms') = pg_temp.v2_id(101)
  and public.current_policy_version_id('privacy') = pg_temp.v2_id(102)
  and public.current_policy_version_id('health_data') = pg_temp.v2_id(103),
  'synthetic policies must be current before exercising v2');

-- Real legacy grants demonstrate that v2 does not silently import legacy consent.
select public.record_user_consent('terms', true, pg_temp.v2_id(101), p_user_id => pg_temp.v2_id(1));
select public.record_user_consent('privacy', true, pg_temp.v2_id(102), p_user_id => pg_temp.v2_id(1));
select public.record_user_consent('health_data_processing', true, pg_temp.v2_id(103), p_user_id => pg_temp.v2_id(1));
select pg_temp.v2_assert(public.user_has_required_consents(pg_temp.v2_id(1)), 'legacy baseline not ready');
create temporary table v2_legacy_before as
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb) as rows from public.consents c;
create temporary table v2_counts_before (counts jsonb);

-- Defaults remain fail-closed; enable only within this transaction.
select pg_temp.v2_assert(not exists(select 1 from consent_v2.configuration where enabled),
  'prototype must ship globally disabled');
insert into consent_v2.configuration(singleton, enabled) values (true, false)
  on conflict (singleton) do update set enabled = false;
insert into consent_v2.policy_scopes(id, decision_key, scope_key, policy_version_id) values
  (pg_temp.v2_id(201), 'terms_agreement', 'account', pg_temp.v2_id(101)),
  (pg_temp.v2_id(202), 'privacy_acknowledgment', 'account', pg_temp.v2_id(102)),
  (pg_temp.v2_id(203), 'private_training', 'self', pg_temp.v2_id(103)),
  (pg_temp.v2_id(204), 'public_sharing', 'public', pg_temp.v2_id(103)),
  (pg_temp.v2_id(205), 'public_sharing', 'followers', pg_temp.v2_id(103)),
  (pg_temp.v2_id(206), 'coach_access', 'coach:8e200000-0000-4000-8000-000000000901', pg_temp.v2_id(103)),
  (pg_temp.v2_id(207), 'coach_access', 'coach:8e200000-0000-4000-8000-000000000902', pg_temp.v2_id(103)),
  (pg_temp.v2_id(208), 'coach_access', 'gym:8e200000-0000-4000-8000-000000000903', pg_temp.v2_id(103)),
  (pg_temp.v2_id(209), 'public_sharing', 'gym:8e200000-0000-4000-8000-000000000903', pg_temp.v2_id(103)),
  (pg_temp.v2_id(210), 'provider_import', 'fixture_provider_a', pg_temp.v2_id(103)),
  (pg_temp.v2_id(211), 'provider_import', 'fixture_provider_b', pg_temp.v2_id(103)),
  (pg_temp.v2_id(212), 'provider_import', 'fixture_retired', pg_temp.v2_id(105)),
  (pg_temp.v2_id(213), 'provider_import', 'fixture_unbound', pg_temp.v2_id(106));
select pg_temp.v2_assert(not exists(select 1 from consent_v2.policy_scopes
  where id between pg_temp.v2_id(201) and pg_temp.v2_id(213) and is_enabled),
  'catalog default must be disabled');

-- Check ACLs and actor-bound API shape independently of runtime RLS filtering.
do $$
declare r text; t text; f text; c record;
begin
  foreach f in array array[
    'public.record_my_policy_decision_v2(uuid,text,uuid)',
    'public.my_policy_scope_allowed_v2(uuid)', 'public.my_account_policy_ready_v2()'] loop
    perform pg_temp.v2_assert(has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated RPC missing: ' || f);
    perform pg_temp.v2_assert(not has_function_privilege('anon', f, 'EXECUTE'), 'anonymous RPC exposed: ' || f);
  end loop;
  perform pg_temp.v2_assert(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'record_my_policy_decision_v2', 'my_policy_scope_allowed_v2', 'my_account_policy_ready_v2')
      and 'p_user_id' = any(coalesce(p.proargnames, array[]::text[]))), 'self RPC exposes p_user_id');
  foreach r in array array['anon', 'authenticated'] loop
    foreach t in array array['consent_v2.configuration', 'consent_v2.policy_scopes', 'consent_v2.decisions'] loop
      perform pg_temp.v2_assert(not has_table_privilege(r, t, 'INSERT,UPDATE,DELETE,TRUNCATE'),
        'client has direct writes: ' || r || ' ' || t);
      for c in select attname from pg_attribute where attrelid = t::regclass and attnum > 0 and not attisdropped loop
        perform pg_temp.v2_assert(not has_column_privilege(r, t, c.attname, 'INSERT,UPDATE'),
          'client column write: ' || r || ' ' || t || '.' || c.attname);
      end loop;
    end loop;
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '8e200000-0000-4000-8000-000000000001', true);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2(), 'legacy consent implicitly imported');
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'disabled config allowed processing');
select pg_temp.v2_reject('select pg_temp.v2_decide(201, ''accept'', 301)');
-- Negative choices remain possible before rollout, even without prior positive choices.
select pg_temp.v2_decide(201, 'decline', 302);
select pg_temp.v2_decide(202, 'withdraw', 303);
select pg_temp.v2_decide(203, 'decline', 304);
reset role;
update consent_v2.configuration set enabled = true where singleton;

set local role authenticated;
select pg_temp.v2_reject('select pg_temp.v2_decide(201, ''accept'', 305)');
select pg_temp.v2_assert(not public.my_account_policy_ready_v2(), 'disabled catalog accepted account');
reset role;
update consent_v2.policy_scopes set is_enabled = true
  where id between pg_temp.v2_id(201) and pg_temp.v2_id(213);

set local role authenticated;
select pg_temp.v2_reject('select pg_temp.v2_decide(201, ''grant'', 306)');
select pg_temp.v2_reject('select pg_temp.v2_decide(202, ''grant'', 307)');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''accept'', 308)');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''acknowledge'', 309)');
select pg_temp.v2_reject('select pg_temp.v2_decide(212, ''grant'', 310)');
select pg_temp.v2_reject('select pg_temp.v2_decide(213, ''grant'', 311)');
select pg_temp.v2_decide(212, 'withdraw', 312);
select pg_temp.v2_decide(213, 'decline', 313);
select pg_temp.v2_decide(201, 'accept', 314);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2(), 'terms alone made account ready');
select pg_temp.v2_decide(202, 'acknowledge', 315);
select pg_temp.v2_assert(public.my_account_policy_ready_v2(), 'terms and privacy did not make account ready');
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'account choices granted health');
select pg_temp.v2_decide(203, 'grant', 316);
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'exact private grant not allowed');
do $$
declare n integer;
begin
  for n in 204..211 loop
    perform pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(n)),
      'private grant leaked to another purpose/recipient: ' || n);
  end loop;
end;
$$;
select pg_temp.v2_decide(206, 'grant', 317);
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(206))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(207))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(208)), 'coach grant leaked to coach/gym');
select pg_temp.v2_decide(210, 'grant', 318);
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(210))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(211)), 'provider grant leaked');
select pg_temp.v2_decide(204, 'grant', 319);
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(204))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(205))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(209)), 'public grant leaked to followers/gym');
select pg_temp.v2_decide(204, 'decline', 320);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(204)), 'latest decline lost');
select pg_temp.v2_decide(203, 'withdraw', 321);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'withdraw did not revoke');
select pg_temp.v2_decide(203, 'grant', 322);
select pg_temp.v2_decide(202, 'withdraw', 323);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'privacy withdrawal did not gate health');
select pg_temp.v2_decide(202, 'acknowledge', 324);
select pg_temp.v2_decide(201, 'decline', 325);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'terms decline did not gate health');
select pg_temp.v2_decide(201, 'accept', 326);

-- Retry a grant after its withdrawal: old requests must not reassert old state.
select pg_temp.v2_decide(203, 'withdraw', 353);
reset role;
insert into v2_counts_before values (pg_temp.v2_counts());
set local role authenticated;
select pg_temp.v2_assert(pg_temp.v2_decide(203, 'grant', 316) =
  (select id from consent_v2.decisions where request_id = pg_temp.v2_id(316)), 'replay changed ID');
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'replay resurrected withdrawn grant');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''withdraw'', 316)', '22023');
select pg_temp.v2_reject('select pg_temp.v2_decide(204, ''grant'', 316)', '22023');
reset role;
select pg_temp.v2_assert(pg_temp.v2_counts() = (select counts from v2_counts_before), 'replay/conflict emitted a side effect');
truncate v2_counts_before;
select pg_temp.v2_assert(not exists(select 1 from consent_v2.decisions
  where user_id = pg_temp.v2_id(1) and policy_scope_id = pg_temp.v2_id(203)
    and policy_checksum is distinct from repeat('c', 64)), 'decision checksum not bound to policy');
select pg_temp.v2_assert((select max(sequence) filter (where request_id = pg_temp.v2_id(322)) >
  max(sequence) filter (where request_id = pg_temp.v2_id(321)) from consent_v2.decisions),
  'sequential withdrawal/regrant order lost');
select pg_temp.v2_assert(public.user_has_required_consents(pg_temp.v2_id(1)), 'v2 choices mutated legacy readiness');

-- Cross-user SELECT isolation and actor-scoped request IDs.
set local role authenticated;
select set_config('request.jwt.claim.sub', '8e200000-0000-4000-8000-000000000002', true);
select pg_temp.v2_assert(not exists(select 1 from consent_v2.decisions), 'cross-user decisions visible');
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'another actor inherited permission');
select pg_temp.v2_decide(203, 'decline', 316);
select pg_temp.v2_assert((select count(*) = 1 and bool_and(user_id = auth.uid()) from consent_v2.decisions),
  'decisions not SELECT-own only');
select pg_temp.v2_reject('insert into consent_v2.decisions(user_id, request_id, policy_scope_id, action, policy_checksum)
  values(pg_temp.v2_id(1), pg_temp.v2_id(390), pg_temp.v2_id(203), ''grant'', repeat(''c'',64))', '42501');
select pg_temp.v2_reject('update consent_v2.decisions set action = ''grant''', '42501');
select pg_temp.v2_reject('delete from consent_v2.decisions', '42501');
select pg_temp.v2_reject('update consent_v2.configuration set enabled = false', '42501');
select pg_temp.v2_reject('update consent_v2.policy_scopes set is_enabled = false', '42501');
select set_config('request.jwt.claim.sub', '8e200000-0000-4000-8000-000000000001', true);
select pg_temp.v2_assert(not exists(select 1 from consent_v2.decisions where user_id <> auth.uid()), 'other actor decision visible');

-- Global and catalog switches fail closed without blocking negative decisions.
reset role;
update consent_v2.configuration set enabled = false where singleton;
set local role authenticated;
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'global off retained access');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''grant'', 327)');
select pg_temp.v2_decide(203, 'withdraw', 328);
select pg_temp.v2_decide(201, 'decline', 329);
select pg_temp.v2_decide(202, 'withdraw', 330);
reset role;
update consent_v2.configuration set enabled = true where singleton;
update consent_v2.policy_scopes set is_enabled = false where id = pg_temp.v2_id(203);
set local role authenticated;
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''grant'', 331)');
select pg_temp.v2_decide(203, 'decline', 332);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'disabled scope retained access');
select pg_temp.v2_decide(201, 'accept', 333);
select pg_temp.v2_decide(202, 'acknowledge', 334);
reset role;
update consent_v2.policy_scopes set is_enabled = true where id = pg_temp.v2_id(203);

-- A disabled profile cannot make positive choices; negative choices still persist.
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles set activation_status = 'disabled' where id = pg_temp.v2_id(1);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.v2_reject('select pg_temp.v2_decide(201, ''accept'', 335)');
select pg_temp.v2_reject('select pg_temp.v2_decide(202, ''acknowledge'', 336)');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''grant'', 337)');
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(206)), 'disabled profile retained access');
select pg_temp.v2_decide(201, 'withdraw', 338);
select pg_temp.v2_decide(202, 'decline', 339);
select pg_temp.v2_decide(203, 'withdraw', 340);
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles set activation_status = 'active' where id = pg_temp.v2_id(1);
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.v2_decide(201, 'accept', 341);
select pg_temp.v2_decide(202, 'acknowledge', 342);
select pg_temp.v2_decide(203, 'grant', 343);
reset role;

-- Replacing either required account policy gates existing health grants.
insert into public.policy_version_tracking
  (id, policy_type, version, label, document_url, checksum, effective_at, is_active, requires_reconsent)
values
  (pg_temp.v2_id(107), 'terms', 'fixture-v2-terms-next', 'Fixture Terms Next',
    'https://example.test/v2/terms-next', repeat('f', 64), now(), true, true),
  (pg_temp.v2_id(108), 'privacy', 'fixture-v2-privacy-next', 'Fixture Privacy Next',
    'https://example.test/v2/privacy-next', repeat('1', 64), now(), true, true);
update consent_v2.policy_scopes set is_enabled = false where id in (pg_temp.v2_id(201), pg_temp.v2_id(202));
insert into consent_v2.policy_scopes(id, decision_key, scope_key, policy_version_id, is_enabled) values
  (pg_temp.v2_id(215), 'terms_agreement', 'account', pg_temp.v2_id(107), true),
  (pg_temp.v2_id(216), 'privacy_acknowledgment', 'account', pg_temp.v2_id(108), true);
set local role authenticated;
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'stale account choices retained health access');
select pg_temp.v2_reject('select pg_temp.v2_decide(201, ''accept'', 355)');
select pg_temp.v2_reject('select pg_temp.v2_decide(202, ''acknowledge'', 356)');
select pg_temp.v2_decide(215, 'accept', 357);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'stale privacy choice retained health access');
select pg_temp.v2_decide(216, 'acknowledge', 358);
select pg_temp.v2_assert(public.my_account_policy_ready_v2()
  and public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'fresh account choices not recognized');
select pg_temp.v2_decide(201, 'withdraw', 359);
select pg_temp.v2_assert(not public.my_account_policy_ready_v2()
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203)), 'old-version terms withdrawal lost');
select pg_temp.v2_decide(215, 'accept', 360);
reset role;

-- New versions invalidate old grants. Latest negative state across versions wins.
insert into public.policy_version_tracking
  (id, policy_type, version, label, document_url, checksum, effective_at, is_active, requires_reconsent)
values (pg_temp.v2_id(104), 'health_data', 'fixture-v2-health-next', 'Fixture Health Next',
  'https://example.test/v2/health-next', repeat('e', 64), now(), true, true);
update consent_v2.policy_scopes set is_enabled = false where id = pg_temp.v2_id(203);
insert into consent_v2.policy_scopes(id, decision_key, scope_key, policy_version_id, is_enabled)
  values (pg_temp.v2_id(214), 'private_training', 'self', pg_temp.v2_id(104), true);
set local role authenticated;
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(203))
  and not public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'old grant survived version change');
select pg_temp.v2_reject('select pg_temp.v2_decide(203, ''grant'', 344)');
select pg_temp.v2_decide(214, 'grant', 345);
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'current version grant not recognized');
select pg_temp.v2_decide(203, 'withdraw', 346);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'old-version withdrawal lost to current grant');
select pg_temp.v2_decide(214, 'grant', 347);
select pg_temp.v2_decide(203, 'decline', 348);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'old-version decline lost to current grant');
select pg_temp.v2_decide(214, 'grant', 349);
reset role;

-- An audit insert failure must roll back the decision and any outbox side effects.
create function pg_temp.v2_fail_audit() returns trigger language plpgsql as $$
begin
  if new.actor_user_id = pg_temp.v2_id(1) then
    raise exception using errcode = 'ZX001', message = 'fixture-v2 injected audit failure';
  end if;
  return new;
end;
$$;
create trigger fixture_v2_fail_audit before insert on public.audit_logs
  for each row execute function pg_temp.v2_fail_audit();
insert into v2_counts_before values (pg_temp.v2_counts());
set local role authenticated;
select pg_temp.v2_reject('select pg_temp.v2_decide(214, ''withdraw'', 350)', 'ZX001');
select pg_temp.v2_assert(public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'failed withdrawal changed permission');
reset role;
select pg_temp.v2_assert(pg_temp.v2_counts() = (select counts from v2_counts_before), 'audit failure left partial state');
drop trigger fixture_v2_fail_audit on public.audit_logs;
set local role authenticated;
select pg_temp.v2_decide(214, 'withdraw', 350);
select pg_temp.v2_assert(not public.my_policy_scope_allowed_v2(pg_temp.v2_id(214)), 'retry after audit failure not recorded');

-- No usable actor, even if authenticated EXECUTE was granted by role.
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.v2_reject('select pg_temp.v2_decide(214, ''withdraw'', 351)', '42501');
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.v2_reject('select public.record_my_policy_decision_v2(pg_temp.v2_id(214), ''withdraw'', pg_temp.v2_id(352))', '42501');
select pg_temp.v2_reject('select public.my_policy_scope_allowed_v2(pg_temp.v2_id(214))', '42501');
select pg_temp.v2_reject('select public.my_account_policy_ready_v2()', '42501');
reset role;

select pg_temp.v2_assert((select rows from v2_legacy_before) =
  (select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb) from public.consents c),
  'v2 mutated legacy consents');
select pg_temp.v2_assert((select count(*) = 2 from consent_v2.decisions where request_id = pg_temp.v2_id(316)),
  'request ID namespace must be actor scoped');

rollback;
