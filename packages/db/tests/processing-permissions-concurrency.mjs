import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const database = process.argv[2];
assert.ok(database && process.argv.length === 3, 'A disposable local PostgreSQL URL is required');
const url = new URL(database);
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && !url.hash, 'Invalid database URL');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
  (!url.hostname && process.env.PGHOST?.startsWith('/') && !/[\s,]/.test(process.env.PGHOST)),
  'Hosted databases are forbidden');
for (const [key] of url.searchParams) assert.ok(['sslmode', 'connect_timeout'].includes(key), 'Unsupported connection option');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
if (!url.hostname) env.PGHOST = process.env.PGHOST;
if (process.env.PGUSER) env.PGUSER = process.env.PGUSER;
if (process.env.PGPORT) {
  assert.match(process.env.PGPORT, /^\d{1,5}$/);
  env.PGPORT = process.env.PGPORT;
}
env.PGCONNECT_TIMEOUT = '5';
env.PGOPTIONS = '-c statement_timeout=15000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=20000 -c client_min_messages=warning';
const args = [database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
function sql(query) {
  const result = spawnSync('psql', args, { env, input: `set request.jwt.claim.role='service_role';\n${query}`, encoding: 'utf8', timeout: 25000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Local query failed');
  return result.stdout.trim();
}
assert.equal(sql(`select (select count(*)=1 and bool_and(not enabled) from consent_v2.configuration)
  and not exists(select 1 from consent_v2.policy_scopes)
  and not exists(select 1 from consent_v2.decisions);`), 't', 'Only a fresh disabled prototype is accepted');
const actor = randomUUID();
const policies = [randomUUID(), randomUUID(), randomUUID()];
const scopes = [randomUUID(), randomUUID(), randomUUID()];
const auth = `set role authenticated;set request.jwt.claim.role='authenticated';set request.jwt.claim.sub='${actor}';`;
const call = (action, request, scope = scopes[2]) => `select jsonb_build_object('receipt',public.record_my_policy_decision_v2('${scope}','${action}','${request}'));`;
const sessions = new Set();
function session(name) {
  const child = spawn('psql', args, { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, output: '', errors: '', code: undefined };
  sessions.add(state);
  child.stdout.on('data', chunk => { state.output += chunk; });
  child.stderr.on('data', chunk => { state.errors += chunk; });
  child.stdin.on('error', () => {});
  state.done = new Promise(resolve => {
    child.on('error', error => { state.errors += error.message; });
    child.on('close', code => { state.code = code; sessions.delete(state); resolve(code); });
  });
  return state;
}
async function until(predicate, label, states) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (predicate()) return;
    for (const state of states) assert.equal(state.code, undefined, `${label}: ${state.errors}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${label}`);
}
const receipt = state => JSON.parse(state.output.split('\n').findLast(line => line.startsWith('{'))).receipt;
async function race(label, first, second, { conflict = false, rollback = false } = {}) {
  const holderName = `processing_holder_${randomUUID().replaceAll('-', '')}`;
  const contenderName = `processing_contender_${randomUUID().replaceAll('-', '')}`;
  const holder = session(holderName);
  holder.child.stdin.write(`begin;${auth}${first}select 'holder-ready';\n`);
  await until(() => holder.output.includes('holder-ready'), label + ' holder', [holder]);
  const contender = session(contenderName);
  contender.child.stdin.end(`${auth}${second}\n`);
  await until(() => sql(`select exists(select 1 from pg_stat_activity c join pg_stat_activity h
    on h.application_name='${holderName}' where c.application_name='${contenderName}'
    and c.wait_event_type='Lock' and h.pid=any(pg_blocking_pids(c.pid)));`) === 't', label + ' actual lock wait', [holder, contender]);
  holder.child.stdin.end(`${rollback ? 'rollback' : 'commit'};\n\\q\n`);
  assert.equal(await holder.done, 0, holder.errors);
  assert.equal(await contender.done, conflict ? 3 : 0, contender.errors);
  if (conflict) assert.match(contender.errors, /22023/);
  console.log(`[ok] ${label}: observed real competing backend lock wait`);
  return { first: receipt(holder), second: conflict ? null : receipt(contender) };
}
const allowed = () => sql(`${auth}select public.my_policy_scope_allowed_v2('${scopes[2]}');`);
const count = request => sql(`select count(*) from consent_v2.decisions where user_id='${actor}' and request_id='${request}';`);
try {
  sql(`begin;
    insert into auth.users(id,email) values('${actor}','processing-${actor}@example.test');
    insert into public.profiles(id,username,display_name) values('${actor}','pc_${actor.replaceAll('-', '').slice(0, 16)}','Disposable processing contender');
    insert into public.policy_version_tracking(id,policy_type,version,label,document_url,checksum,effective_at,is_active,requires_reconsent) values
      ('${policies[0]}','terms','race-${policies[0]}','Fixture Terms','https://example.test/terms',repeat('a',64),now(),true,true),
      ('${policies[1]}','privacy','race-${policies[1]}','Fixture Privacy','https://example.test/privacy',repeat('b',64),now(),true,true),
      ('${policies[2]}','health_data','race-${policies[2]}','Fixture Health','https://example.test/health',repeat('c',64),now(),true,true);
    update consent_v2.configuration set enabled=true;
    insert into consent_v2.policy_scopes(id,decision_key,scope_key,policy_version_id,is_enabled) values
      ('${scopes[0]}','terms_agreement','account','${policies[0]}',true),
      ('${scopes[1]}','privacy_acknowledgment','account','${policies[1]}',true),
      ('${scopes[2]}','private_training','self','${policies[2]}',true);
    commit;${auth}${call('accept', randomUUID(), scopes[0])}${call('acknowledge', randomUUID(), scopes[1])}`);
  const sameRequest = randomUUID();
  const duplicate = await race('same decision retry', call('grant', sameRequest), call('grant', sameRequest));
  assert.equal(duplicate.first, duplicate.second);
  assert.equal(count(sameRequest), '1');
  const conflictRequest = randomUUID();
  await race('changed decision conflicts', call('grant', conflictRequest), call('withdraw', conflictRequest), { conflict: true });
  assert.equal(count(conflictRequest), '1');
  const grantRequest = randomUUID(), withdrawalRequest = randomUUID();
  await race('grant followed by withdrawal', call('grant', grantRequest), call('withdraw', withdrawalRequest));
  assert.equal(allowed(), 'f');
  assert.equal(sql(`select (select sequence from consent_v2.decisions where user_id='${actor}' and request_id='${grantRequest}')
    < (select sequence from consent_v2.decisions where user_id='${actor}' and request_id='${withdrawalRequest}');`), 't');
  await race('old grant retry cannot undo withdrawal', call('withdraw', randomUUID()), call('grant', sameRequest));
  assert.equal(allowed(), 'f');
  assert.equal(count(sameRequest), '1');
  const rollbackRequest = randomUUID();
  const rolledBack = await race('rolled-back decision permits a fresh retry', call('grant', rollbackRequest), call('grant', rollbackRequest), { rollback: true });
  assert.notEqual(rolledBack.first, rolledBack.second);
  assert.equal(count(rollbackRequest), '1');
  assert.equal(allowed(), 't');
  assert.equal(sql(`select (select count(*) from consent_v2.decisions where user_id='${actor}')
    = (select count(*) from public.audit_logs where actor_user_id='${actor}' and action='processing.decision_recorded_v2');`), 't');
  sql('update consent_v2.configuration set enabled=false;');
  assert.equal(allowed(), 'f');
  console.log('PASS: local processing decision replay, conflict, withdrawal ordering and rollback contention. Not hosted enforcement or load testing.');
} finally {
  for (const state of [...sessions]) {
    state.child.kill('SIGTERM');
    await state.done;
  }
}
