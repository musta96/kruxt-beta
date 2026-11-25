import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const database = process.argv[2];
assert.ok(database, 'Run through the disposable consent contract runner');
const url = new URL(database);
assert.ok(['', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only a local fixture database is allowed');
assert.ok(url.hostname || process.env.PGHOST?.includes('kruxt-consent.'), 'A runner-owned Unix socket is required');
assert.ok(!url.search, 'Connection query overrides are not allowed');
const repair = readFileSync(new URL('../dev-forward-repairs/20261024004407_legacy_workout_private_fallback.sql', import.meta.url), 'utf8');
const env = { ...process.env };
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR', 'PGOPTIONS']) delete env[key];
function sql(source, expectedFailure = false) {
  const result = spawnSync('psql', [database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    input: `begin;\n${source}\nrollback;`, encoding: 'utf8', maxBuffer: 1024 * 1024,
    env,
  });
  if (expectedFailure) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from reviewed DEV revision/);
  } else assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
const checks = `
create temp table original_rpc as select oid, proowner, proacl, prosecdef, proconfig
  from pg_proc where oid='public.log_workout_atomic(jsonb,jsonb)'::regprocedure;
insert into auth.users(id) values ('79000000-0000-4000-8000-000000000001');
insert into public.profiles(id,username,display_name)
  values ('79000000-0000-4000-8000-000000000001','rpc_privacy_fixture','Fixture');
create function pg_temp.check(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
-- The migration performs DDL only; prove existing workout visibility is untouched.
insert into public.workouts(id,user_id,title,started_at,visibility)
 values ('79000000-0000-4000-8000-000000000002','79000000-0000-4000-8000-000000000001','existing',now(),'public');
${repair}
${repair}
select pg_temp.check((select p.proowner=o.proowner and p.proacl is not distinct from o.proacl
 and p.prosecdef=o.prosecdef and p.proconfig is not distinct from o.proconfig
 from pg_proc p join original_rpc o on p.oid=o.oid), 'OID, owner, grants and execution configuration unchanged');
select pg_temp.check((select visibility='public' from public.workouts where id='79000000-0000-4000-8000-000000000002'), 'existing row unchanged');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"79000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.log_workout_atomic('{"title":"omitted"}', '[]');
select public.log_workout_atomic('{"title":"null","visibility":null}', '[]');
select public.log_workout_atomic('{"title":"explicit public","visibility":"public"}', '[]');
select public.log_workout_atomic('{"title":"explicit private","visibility":"private"}', '[]');
do $$ begin
  begin perform public.log_workout_atomic('{"title":"invalid","visibility":"not-a-visibility"}', '[]');
  exception when invalid_text_representation then return; end;
  raise exception 'Invalid visibility unexpectedly accepted';
end $$;
reset role;
select pg_temp.check((select count(*)=2 from public.workouts where title in ('omitted','null') and visibility='private'), 'omitted and JSON null are private');
select pg_temp.check((select count(*)=1 from public.workouts where title='explicit public' and visibility='public'), 'explicit public preserved');
select pg_temp.check((select count(*)=1 from public.workouts where title='explicit private' and visibility='private'), 'explicit private preserved');
select pg_temp.check(not exists(select 1 from public.workouts where title='invalid'), 'invalid visibility rolls back insert');
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  begin perform public.log_workout_atomic('{"title":"anonymous"}', '[]');
  exception when others then
    if sqlerrm='Authentication required' then return; end if;
    raise;
  end;
  raise exception 'Anonymous workout unexpectedly accepted';
end $$;
reset role;
select pg_temp.check(not exists(select 1 from public.workouts where title='anonymous'), 'anonymous insert denied');
`;
sql(checks);
sql(`create or replace function public.log_workout_atomic(p_workout jsonb,p_exercises jsonb)
 returns uuid language plpgsql security definer set search_path=public as $$ begin return null; end $$;
 ${repair}`, true);
console.log('[ok] Legacy DEV RPC private fallback, explicit sharing, anonymous denial, rollback, stable ACL/OID and drift refusal');
