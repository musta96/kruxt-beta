import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";

assert.ok(process.env.PGHOST?.startsWith("/") && process.env.PGHOST.includes("kruxt-role-profile-pg."), "Run the isolated local runner");
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
function sql(source) {
  const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], { input: source, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const baseline = read("../supabase/migrations/00000000000000_baseline.sql");
const table = (name) => {
  const match = baseline.match(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`));
  assert.ok(match, name); return match[0];
};
const fn = (name) => {
  const match = baseline.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as (\\$[a-z_]*\\$)[\\s\\S]*?\\1;`));
  assert.ok(match, name); return match[0];
};
sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  create table public.profiles(id uuid primary key, display_name text, username text);
  create table auth.users(id uuid primary key, email text);
  create type public.platform_operator_role as enum ('founder','ops_admin','support_admin','compliance_admin','analyst','read_only');
  ${["platform_permission_catalog", "platform_role_permissions", "platform_operator_accounts", "platform_operator_permission_overrides", "audit_logs"].map(table).join("\n")}
  ${["is_service_role", "append_audit_log", "is_platform_operator", "platform_operator_has_permission"].map(fn).join("\n")}
  ${read("../supabase/migrations/202605300002_platform_operator_permission_matrix_v2.sql")}
  ${read("./operator_permission_contract_seed.sql")}
  ${read("../supabase/migrations/20261023075329_platform_operator_write_boundaries.sql")}
  ${read("../supabase/migrations/20261023081448_custom_operator_role_profiles.sql")}
`);
process.stdout.write(sql(read("./operator_role_profiles_contract_assertions.sql")));

// Hold a profile edit open on a second backend: assignment and other edits must
// serialize until its audit and transaction complete.
const holder = spawn("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
let errors = ""; holder.stderr.on("data", (chunk) => { errors += chunk; });
const exit = new Promise((resolve) => holder.on("exit", resolve));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Profile lock timeout: ${errors}`)), 10000);
    holder.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Holder exited ${code}: ${errors}`)); });
    holder.stdout.on("data", (chunk) => { if (chunk.toString().includes("profile-lock-held")) { clearTimeout(timer); resolve(); } });
    holder.stdin.write(`begin; set role authenticated;
      select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',false);
      select public.platform_mutate_operator_role_profile('create',null,null,'Concurrent profile','','{}',null,null,'concurrency test');
      select 'profile-lock-held';\n`);
  });
  sql(`select operator_test.assert_true(not pg_try_advisory_xact_lock(821046,1), 'profile mutations serialize through audit');
    select operator_test.denied($q$select * from public.platform_operator_accounts where user_id='00000000-0000-4000-8000-000000000001' for update nowait$q$, '55P03');`);
} finally {
  holder.stdin.end("rollback;\n\\q\n"); assert.equal(await exit, 0, errors);
}
console.log("PASS: role profile DDL/RPC/resolver/provenance/denial/audit atomicity and concurrent locking on isolated PostgreSQL.");
