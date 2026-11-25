import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Only a new uniquely named database is changed. Never load .env or Supabase links.
const env = { ...process.env };
if (env.KRUXT_OPERATOR_TEST_DATABASE_URL) {
  const url = new URL(env.KRUXT_OPERATOR_TEST_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only loopback fixture URLs are allowed');
  assert.equal(url.search, '', 'Connection URL options are not allowed');
  Object.assign(env, { PGHOST: url.hostname.replaceAll(/[\[\]]/g, ''),
    PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)) });
} else {
  assert.ok(env.PGHOST?.startsWith('/') && env.PGHOST.includes('kruxt-operator-pg.'), 'Use the isolated runner or explicit loopback fixture URL');
}
// Do not inherit libpq service files, options, or alternate host routing.
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR']) delete env[key];
function sql(source, database = env.PGDATABASE) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q'], {
    env: { ...env, PGDATABASE: database }, input: source, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'psql failed');
  return result.stdout;
}
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const baseline = read('../supabase/migrations/00000000000000_baseline.sql');
function table(name) {
  const match = baseline.match(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match, `Missing source table ${name}`);
  return match[0];
}
function fn(name) {
  const match = baseline.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as (\\$[a-z_]*\\$)[\\s\\S]*?\\1;`));
  assert.ok(match, `Missing source function ${name}`);
  return match[0];
}
const database = `operator_contract_${process.pid}_${randomBytes(4).toString('hex')}`;
let created = false;
try {
  sql(`create database ${database};`);
  created = true;
  const bootstrap = `
    do $$ begin
      if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create table public.profiles(id uuid primary key, display_name text, username text);
    create table auth.users(id uuid primary key, email text);
    create type public.platform_operator_role as enum ('founder','ops_admin','support_admin','compliance_admin','analyst','read_only');
  `;
  const tables = ['platform_permission_catalog', 'platform_role_permissions',
    'platform_operator_accounts', 'platform_operator_permission_overrides'];
  const policyStart = baseline.indexOf('drop policy if exists platform_permission_catalog_select');
  const policyEnd = baseline.indexOf('drop policy if exists gym_support_access_grants_select', policyStart);
  assert.ok(policyStart > 0 && policyEnd > policyStart);
  const fixture = bootstrap + tables.map(table).join('\n') + table('audit_logs') +
    ['is_service_role', 'append_audit_log', 'is_platform_operator', 'platform_operator_has_permission'].map(fn).join('\n') +
    tables.map((name) => `alter table public.${name} enable row level security; grant all on public.${name} to authenticated, anon, service_role;`).join('\n') +
    baseline.slice(policyStart, policyEnd) +
    read('../supabase/migrations/202605300002_platform_operator_permission_matrix_v2.sql') +
    read('./operator_permission_contract_seed.sql');
  sql(fixture, database);
  sql(read('../supabase/migrations/20261023075329_platform_operator_write_boundaries.sql'), database);
  // A second real backend must be unable to change authority/target/catalog
  // while the first backend's mutation and audit transaction remain open.
  const holder = spawn('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...env, PGDATABASE: database }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let errors = '';
  holder.stderr.on('data', (chunk) => { errors += chunk; });
  const exited = new Promise((resolve) => holder.on('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Lock holder timeout: ${errors}`)), 10000);
      holder.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Lock holder exited ${code}: ${errors}`)); });
      holder.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('operator-locks-held')) { clearTimeout(timer); resolve(); }
      });
      holder.stdin.write(`begin; set role authenticated;
        select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',false);
        select public.platform_set_operator_permission_override('00000000-0000-4000-8000-000000000008','platform.tenants.view',false,'lock fixture');
        select 'operator-locks-held';\n`);
    });
    sql(`
      select operator_test.denied($q$select * from public.platform_operator_accounts where user_id = '00000000-0000-4000-8000-000000000001' for update nowait$q$, '55P03');
      select operator_test.denied($q$select * from public.platform_operator_accounts where user_id = '00000000-0000-4000-8000-000000000008' for update nowait$q$, '55P03');
      select operator_test.denied($q$select * from public.platform_permission_catalog where permission_key = 'platform.tenants.view' for update nowait$q$, '55P03');
    `, database);
  } finally {
    holder.stdin.end('rollback;\n\\q\n');
    assert.equal(await exited, 0, errors);
  }
  process.stdout.write(sql(read('./operator_permission_contract_assertions.sql'), database));
  console.log('PASS: targeted operator DDL/RLS/RPC contract on real PostgreSQL (not full baseline or hosted Auth).');
} finally {
  if (created) sql(`drop database ${database} with (force);`);
}
