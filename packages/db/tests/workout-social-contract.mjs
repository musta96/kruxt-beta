import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { runPrivateProofRaces } from './private-proof-concurrency.mjs';

assert.ok(process.env.PGHOST?.startsWith('/tmp/kruxt-workout-social.'), 'Use the isolated local runner');
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const baseline = read('../supabase/migrations/00000000000000_baseline.sql');
function extract(pattern, label) {
  const match = baseline.match(pattern);
  assert.ok(match, `Missing baseline ${label}`);
  return match[0];
}
const table = (name) => extract(new RegExp(`create table if not exists public\\.${name} \\([\\s\\S]*?\\n\\);`), name);
const fn = (name) => extract(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as (\\$[a-z_]*\\$)[\\s\\S]*?\\1;`), name);
function sql(source) {
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    input: source, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'psql failed');
  return result.stdout.trim();
}
const tables = ['profiles', 'exercises', 'social_connections', 'workouts', 'workout_exercises',
  'workout_sets', 'feed_events', 'social_interactions', 'user_blocks', 'event_outbox'];
const policies = [...baseline.matchAll(/create policy [\s\S]*?;/g)]
  .map(([source]) => source).filter((source) => tables.some((name) => source.includes(`on public.${name} `)));
const enums = [...baseline.matchAll(/do \$\$ begin create type public\.[\s\S]*?end \$\$;/g)].map(([source]) => source);
const defaults = read('../supabase/migrations/20261020233833_privacy_export_inventory_and_defaults.sql');
const wrapperStart = defaults.indexOf('alter function public.log_workout_atomic(');
const wrapperEnd = defaults.indexOf('alter function public.build_privacy_export_payload', wrapperStart);
assert.ok(wrapperEnd > wrapperStart);
sql(read('./consent_supabase_bootstrap.sql') + enums.join('\n') + `
  create table public.gyms(id uuid primary key);
  create table public.gym_memberships(gym_id uuid, user_id uuid, membership_status public.membership_status);
` + tables.map(table).join('\n') +
  ['set_updated_at', 'calculate_level_from_xp', 'is_service_role', 'is_gym_member', 'can_view_workout',
    'refresh_workout_totals', 'log_workout_atomic', 'apply_workout_progress_trigger',
    'create_workout_feed_event_trigger'].map(fn).join('\n') +
  tables.map((name) => `alter table public.${name} enable row level security;`).join('\n') +
  policies.join('\n') + defaults.slice(wrapperStart, wrapperEnd) + `
  alter table public.workouts alter column visibility set default 'private';
  create trigger trg_workout_progress after insert on public.workouts for each row execute function public.apply_workout_progress_trigger();
  create trigger trg_workout_feed_event after insert on public.workouts for each row execute function public.create_workout_feed_event_trigger();
  grant all on storage.objects to authenticated, anon, service_role;
`);
// Exercise the packaged-only branch before also loading the optional private-media schema.
const migration = read('../supabase/migrations/20261023081440_workout_retry_and_social_boundaries.sql');
const testPrivateProof = process.env.KRUXT_PRIVATE_PROOF_CONTRACT === '1';
const publicProof = read('../supabase/migrations/20260531160000_workout_proof_media.sql');
if (testPrivateProof) {
  const packagedOnly = sql(`begin; ${publicProof} ${migration}
    select public and to_regclass('public.workout_proof_media') is null
      from storage.buckets where id = 'workout-proof';
    insert into storage.objects(bucket_id,name) values ('workout-proof','legacy-fixture.jpg');
    set local role anon;
    select exists (select 1 from storage.objects where name = 'legacy-fixture.jpg');
    rollback;`);
  assert.equal(packagedOnly, 't\nt', 'Packaged-only legacy media is public, not the private contract');
  console.log('PASS: packaged-only fixture confirms legacy bucket and anonymous object visibility');
} else {
  sql(`begin; ${migration} rollback;`);
}
sql(read('../../../supabase/migrations/20260309193000_workout_proof_media.sql'));
sql(read('./workout_social_contract_seed.sql'));
const legacyProbe = read('./private_proof_legacy_probe.sql');
if (testPrivateProof) console.log(sql(`set kruxt.proof_probe_root_only = 'on'; ${legacyProbe}`));
sql(migration);
console.log(sql(read('./workout_social_contract_assertions.sql')));

if (testPrivateProof) {
  console.log(sql(legacyProbe));
  const prototype = read('../media-prototypes/private-proof-bindings.sql');
  // Current Storage uses owner_id; the shared minimal historical fixture does not.
  sql(`alter table storage.objects add column owner_id text;
    alter table storage.objects add unique (bucket_id, name);`);
  assert.throws(() => sql(prototype), /Disposable private proof contract opt-in required/);
  sql(`begin; set local kruxt.disposable_private_proof_contract = 'on'; ${prototype} commit;`);
  console.log(sql(read('./private_proof_bindings_assertions.sql')));
  const races = await runPrivateProofRaces(sql);
  for (const race of races.results) console.log(`PASS: private proof ${race.race}: observed lock wait, ${race.contenderOutcome}`);
}

const owner = '00000000-0000-4000-8000-000000000001';
const key = '00000000-0000-4000-8000-000000000099';
const call = `select public.log_workout_atomic('{"title":"concurrent","idempotency_key":"${key}"}', workout_test.exercises());`;
const auth = `set role authenticated; select set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',false);`;
const holder = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
let errors = '';
holder.stderr.on('data', (chunk) => { errors += chunk; });
const exited = new Promise((resolve) => holder.on('exit', resolve));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Holder timeout: ${errors}`)), 10000);
    holder.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Holder exited ${code}: ${errors}`)); });
    holder.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('receipt-lock-held')) { clearTimeout(timer); resolve(); }
    });
    holder.stdin.write(`begin; ${auth} ${call} select 'receipt-lock-held';\n`);
  });
  const contender = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let contenderOutput = ''; let contenderErrors = '';
  contender.stdout.on('data', (chunk) => { contenderOutput += chunk; });
  contender.stderr.on('data', (chunk) => { contenderErrors += chunk; });
  const finished = new Promise((resolve) => contender.on('exit', resolve));
  contender.stdin.end(`${auth} ${call}`);
  // Wait for a real backend lock wait, not a timing assumption.
  let waiting = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    waiting = sql(`select exists(select 1 from pg_stat_activity where pid <> pg_backend_pid()
      and wait_event_type = 'Lock' and query like '%log_workout_atomic%');`) === 't';
    if (waiting) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(waiting, 'Concurrent duplicate must wait on the uncommitted claim');
  holder.stdin.end('commit;\n\\q\n');
  assert.equal(await exited, 0, errors);
  assert.equal(await finished, 0, contenderErrors);
  assert.ok(contenderOutput.includes(sql(`select workout_id from public.workout_create_receipts where idempotency_key = '${key}';`)));
  assert.equal(sql(`select count(*) from public.workouts where title = 'concurrent';`), '1');
  assert.equal(sql(`select count(*) from public.feed_events f join public.workouts w on w.id=f.workout_id where w.title='concurrent';`), '1');
  assert.equal(sql(`select count(*) from public.event_outbox e join public.workouts w on w.id=e.aggregate_id where w.title='concurrent';`), '1');
} finally {
  if (holder.exitCode === null) holder.stdin.end('rollback;\n\\q\n');
  await exited;
}
console.log('PASS: real PostgreSQL targeted workout/social RLS/RPC, private media, rollback and concurrent replay. Not full migration history or hosted Auth/Storage.');
