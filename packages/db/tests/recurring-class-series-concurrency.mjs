import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

// This runner consumes the parent's already migrated disposable database.
const database = process.argv[2];
assert.ok(database && process.argv.length === 3, 'Usage: node recurring-class-series-concurrency.mjs "$CONSENT_DB"');
const url = new URL(database);
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Only PostgreSQL URLs are accepted');
assert.ok(!url.hash, 'URL fragments are not accepted');
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
assert.ok(loopback || (!url.hostname && process.env.PGHOST?.startsWith('/')
  && !/[\s,]/.test(process.env.PGHOST)), 'Only loopback URLs or an absolute local Unix PGHOST are accepted; no hosted databases');
for (const [key] of url.searchParams) {
  assert.ok(['sslmode', 'connect_timeout'].includes(key), `Unsupported URL parameter: ${key}`);
}
// In particular, never inherit PGHOSTADDR, PGSERVICE, PGSERVICEFILE or PGOPTIONS.
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
function sql(source) {
  const result = spawnSync('psql', args, { env,
    input: `set request.jwt.claim.role = 'service_role';\n${source}`,
    encoding: 'utf8', timeout: 25000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'psql failed');
  return result.stdout.trim();
}
const json = (query) => JSON.parse(sql(query));
const suffix = randomUUID().slice(8);
const id = (prefix) => `${prefix}${suffix}`;
const owner = id('79000001');
const member = id('79000002');
const waiter = id('79000003');
const gym = id('79000010');
const series = id('79000020');
const conflictSeries = id('79000021');
const failedSeries = id('79000022');
const request = id('79000030');
const failedRequest = id('79000031');
const auth = (user = owner) => `set role authenticated;
  select set_config('request.jwt.claim.role','authenticated',false);
  select set_config('request.jwt.claim.sub','${user}',false);
  select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',false);`;
const draft = (seriesId) => JSON.stringify({ version: 1, id: seriesId, title: 'Concurrency series',
  timeZone: 'Europe/Rome', startDate: '2099-05-04', endDate: '2099-05-17',
  slots: [{ id: 'mon', weekday: 1, startTime: '20:00', endTime: '21:00' },
    { id: 'wed', weekday: 3, startTime: '20:00', endTime: '21:00' },
    { id: 'tue', weekday: 2, startTime: '18:00', endTime: '19:00' },
    { id: 'thu', weekday: 4, startTime: '18:00', endTime: '19:00' }],
  excludedDates: ['2099-05-05'] });
const publish = (seriesId, capacity = 12) => `select public.publish_gym_class_series('${gym}','${draft(seriesId)}',${capacity},'Concurrency fixture',null);`;
const sessions = new Set();
function session(name) {
  const child = spawn('psql', args, { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, output: '', errors: '', code: undefined };
  sessions.add(state);
  child.stdout.on('data', (chunk) => { state.output += chunk; });
  child.stderr.on('data', (chunk) => { state.errors += chunk; });
  state.done = new Promise((resolve) => {
    child.on('error', (error) => { state.errors += error.message; state.code = -1; resolve(-1); });
    child.on('close', (code) => { state.code = code; sessions.delete(state); resolve(code); });
  });
  child.stdin.on('error', () => {});
  return state;
}
async function until(predicate, description, states) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    for (const state of states) assert.equal(state.code, undefined, `${description}: backend exited: ${state.errors}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${description}`);
}
function result(state) {
  return JSON.parse(state.output.trim().split('\n').findLast((line) => line.startsWith('{')));
}
async function race(label, first, second, { conflict = false, rollback = false } = {}) {
  const holderName = `series_holder_${randomUUID().replaceAll('-', '')}`;
  const contenderName = `series_retry_${randomUUID().replaceAll('-', '')}`;
  const holder = session(holderName);
  holder.child.stdin.write(`begin; ${auth()} ${first} select 'holder-ready';\n`);
  await until(() => holder.output.includes('holder-ready'), `${label} holder ready`, [holder]);
  const contender = session(contenderName);
  contender.child.stdin.end(`${auth()} ${second}\n`);
  await until(() => sql(`select exists(select 1 from pg_stat_activity c
    join pg_stat_activity h on h.application_name='${holderName}'
    where c.application_name='${contenderName}' and c.wait_event_type='Lock'
      and h.pid=any(pg_blocking_pids(c.pid)));`) === 't', `${label} real lock wait`, [holder, contender]);
  holder.child.stdin.end(`${rollback ? 'rollback' : 'commit'};\n\\q\n`);
  assert.equal(await holder.done, 0, holder.errors);
  assert.equal(await contender.done, conflict ? 3 : 0, contender.errors);
  if (conflict) assert.match(contender.errors, /40001:[\s\S]*conflicts/, label);
  console.log(`[ok] ${label}: observed contender blocked by holder backend`);
  return { first: result(holder), second: conflict ? null : result(contender) };
}
const count = (query, expected) => assert.equal(sql(query), String(expected), query);
function snapshotQuery(classId) {
  return `select jsonb_build_object(
    'class',(select to_jsonb(c) from public.gym_classes c where id='${classId}'),
    'bookings',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.class_bookings b where class_id='${classId}'),
    'waitlist',(select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]') from public.class_waitlist w where class_id='${classId}'),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.event_outbox e where aggregate_id='${classId}'),
    'audits',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.audit_logs a where actor_user_id='${owner}'),
    'announcements',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.gym_class_announcements a where gym_id='${gym}'),
    'recipients',(select coalesce(jsonb_agg(to_jsonb(r) order by announcement_id,user_id),'[]') from public.gym_class_announcement_recipients r where gym_id='${gym}'))`;
}
const snapshot = (classId) => json(snapshotQuery(classId));
let seeded = false;
try {
  sql(`begin;
    insert into auth.users(id,email) values ('${owner}','series-${owner}@example.test'),
      ('${member}','series-${member}@example.test'),('${waiter}','series-${waiter}@example.test');
    insert into public.profiles(id,username,display_name) values
      ('${owner}','sc-${owner.slice(0, 8)}-${owner.slice(-10)}','Series concurrency owner'),
      ('${member}','sc-${member.slice(0, 8)}-${member.slice(-10)}','Series concurrency member'),
      ('${waiter}','sc-${waiter.slice(0, 8)}-${waiter.slice(-10)}','Series concurrency waiter');
    insert into public.gyms(id,owner_user_id,name,slug) values ('${gym}','${owner}','Series concurrency','series-${gym}');
    insert into public.gym_memberships(gym_id,user_id,role,membership_status) values
      ('${gym}','${owner}','leader','active'),('${gym}','${member}','member','active'),('${gym}','${waiter}','member','active');
    commit;`);
  seeded = true;
  const replay = await race('same-series publication retry', publish(series), publish(series));
  assert.equal(replay.first.seriesId, series);
  assert.equal(replay.first.replayed, false);
  assert.equal(replay.second.replayed, true);
  assert.equal(replay.second.seriesId, series);
  assert.equal(replay.first.occurrences.length, 7);
  assert.deepEqual(replay.second.occurrences, replay.first.occurrences);
  count(`select count(*) from public.gym_classes where series_id='${series}';`, 7);
  count(`select count(distinct series_occurrence_key) from public.gym_classes where series_id='${series}';`, 7);
  count(`select count(*) from public.audit_logs where target_id='${series}' and action='class.series_published';`, 1);
  await race('changed publication payload conflicts', publish(conflictSeries), publish(conflictSeries, 13), { conflict: true });
  count(`select count(*) from public.gym_classes where series_id='${conflictSeries}' and capacity=12;`, 7);
  count(`select count(*) from public.gym_classes where series_id='${conflictSeries}';`, 7);
  count(`select count(*) from public.audit_logs where target_id='${conflictSeries}' and action='class.series_published';`, 1);

  const classId = replay.first.occurrences[0].id;
  const rollbackClass = replay.first.occurrences[1].id;
  async function testStaffSelfBooking() {
    const selfBookingClass = replay.first.occurrences[2].id;
    const bookingName = `series_self_book_${randomUUID().replaceAll('-', '')}`;
    const announcementName = `series_self_announce_${randomUUID().replaceAll('-', '')}`;
    const booking = session(bookingName);
    booking.child.stdin.write(`begin;
      select id from public.gym_classes where id='${selfBookingClass}' for update;
      ${auth()} select 'parent-lock-ready';\n`);
    await until(() => booking.output.includes('parent-lock-ready'), 'staff booking parent lock', [booking]);
    const announcement = session(announcementName);
    announcement.child.stdin.end(`${auth()} select public.announce_gym_class_series(
      '${series}','occurrence_attendees','Staff self-booking race','${id('79000032')}','${selfBookingClass}',false);\n`);
    await until(() => sql(`select exists(select 1 from pg_stat_activity a
      join pg_stat_activity b on b.application_name='${bookingName}'
      where a.application_name='${announcementName}' and a.wait_event_type='Lock'
        and b.pid=any(pg_blocking_pids(a.pid)));`) === 't', 'announcement waits for occurrence', [booking, announcement]);
    // Under the old membership-before-class order this upgrade deadlocks.
    booking.child.stdin.end(`select public.upsert_class_booking_by_staff('${selfBookingClass}','${owner}'); commit;\n\\q\n`);
    assert.equal(await booking.done, 0, booking.errors);
    assert.equal(await announcement.done, 0, announcement.errors);
    const selfAnnouncement = result(announcement);
    assert.equal(selfAnnouncement.recipientCount, 1);
    count(`select count(*) from public.class_bookings where class_id='${selfBookingClass}' and user_id='${owner}' and status='booked';`, 1);
    assert.deepEqual(json(`select jsonb_agg(user_id) from public.gym_class_announcement_recipients where announcement_id='${selfAnnouncement.announcementId}';`), [owner]);
    console.log('[ok] occurrence-first announcement vs staff self-booking completed without deadlock and included committed booking');
  }
  sql(`insert into public.class_bookings(class_id,user_id,status) values
      ('${classId}','${member}','booked'),('${rollbackClass}','${member}','booked');
    insert into public.class_waitlist(class_id,user_id,position) values
      ('${classId}','${waiter}',1),('${rollbackClass}','${waiter}',1);`);
  const announce = (target, key = request, body = 'Occurrence cancelled') => `select public.announce_gym_class_series(
    '${series}','occurrence_attendees','${body}','${key}','${target}',true);`;
  const cancellation = await race('same-request announcement/cancellation retry', announce(classId), announce(classId));
  assert.equal(cancellation.first.replayed, false);
  assert.equal(cancellation.second.replayed, true);
  assert.equal(cancellation.first.recipientCount, 2);
  assert.equal(cancellation.second.recipientCount, 2);
  assert.equal(cancellation.second.announcementId, cancellation.first.announcementId);
  assert.equal(cancellation.second.channel, 'in_app');
  const message = cancellation.first.announcementId;
  count(`select count(*) from public.gym_class_announcements where gym_id='${gym}' and request_id='${request}';`, 1);
  assert.deepEqual(json(`select jsonb_agg(user_id order by user_id) from public.gym_class_announcement_recipients where announcement_id='${message}';`), [member, waiter].sort());
  const afterCancel = snapshot(classId);
  assert.equal(afterCancel.class.status, 'cancelled');
  assert.equal(afterCancel.bookings.length, 1);
  assert.equal(afterCancel.bookings[0].status, 'cancelled');
  assert.equal(afterCancel.waitlist.length, 1);
  assert.equal(afterCancel.waitlist[0].status, 'cancelled');
  count(`select count(*) from public.event_outbox where aggregate_id='${classId}' and event_type='class.cancelled';`, 1);
  count(`select count(*) from public.audit_logs where target_id='${classId}' and action='class.cancelled';`, 1);
  count(`select count(*) from public.audit_logs where target_id='${message}' and action='class.announcement_posted';`, 1);
  // A post-commit retry must preserve the original inbox even though attendees are now cancelled.
  sql(`${auth()} ${announce(classId)}`);
  assert.deepEqual(snapshot(classId), afterCancel, 'Replay must not update children, timestamps, events, audits or recipient snapshot');
  await race('changed announcement payload conflicts', announce(classId), announce(classId, request, 'Changed cancellation'), { conflict: true });
  assert.deepEqual(snapshot(classId), afterCancel, 'Conflicting announcement must preserve the original receipt and all side effects');

  const beforeFailure = snapshot(rollbackClass);
  const failureTrigger = `create function pg_temp.fail_series_concurrency_audit() returns trigger language plpgsql as $$
    begin if new.actor_user_id='${owner}' and new.action in ('class.series_published','class.announcement_posted')
      then raise exception 'series concurrency audit unavailable'; end if; return new; end $$;
    create trigger series_concurrency_audit_failure before insert on public.audit_logs
      for each row execute function pg_temp.fail_series_concurrency_audit();`;
  sql(`begin; ${failureTrigger} ${auth()}
    do $test$ begin
      begin ${publish(failedSeries).replace(/^select /, 'perform ')} raise exception 'Expected publication failure';
      exception when others then if sqlerrm <> 'series concurrency audit unavailable' then raise; end if; end;
      begin ${announce(rollbackClass, failedRequest).replace(/^select /, 'perform ')} raise exception 'Expected announcement failure';
      exception when others then if sqlerrm <> 'series concurrency audit unavailable' then raise; end if; end;
    end $test$;
    reset role;
    do $test$ begin
      if exists(select 1 from public.gym_class_series where id='${failedSeries}')
        or exists(select 1 from public.gym_classes where series_id='${failedSeries}')
        or exists(select 1 from public.gym_class_announcements where request_id='${failedRequest}' and gym_id='${gym}')
      then raise exception 'Audit failure left partial rows'; end if;
      if (${snapshotQuery(rollbackClass)}) is distinct from '${JSON.stringify(beforeFailure).replaceAll("'", "''")}'::jsonb
      then raise exception 'Audit failure left partial cancellation or lifecycle state'; end if;
    end $test$;
    rollback;`);
  assert.deepEqual(snapshot(rollbackClass), beforeFailure, 'Audit failure must roll back cancellation, children, inbox and lifecycle records');
  console.log('[ok] injected publication/announcement audit failure rolled back all relational side effects');
  const recovered = await race('rolled-back publication holder permits fresh retry', publish(failedSeries), publish(failedSeries), { rollback: true });
  assert.equal(recovered.second.replayed, false);
  assert.equal(recovered.second.occurrences.length, 7);
  count(`select count(*) from public.gym_classes where series_id='${failedSeries}';`, 7);
  count(`select count(*) from public.audit_logs where target_id='${failedSeries}' and action='class.series_published';`, 1);
  await testStaffSelfBooking();
  console.log('PASS: full-schema local PostgreSQL publication/cancellation contention, replay, conflicts and audit rollback. Not hosted Auth, delivery, exhaustive interleavings or load testing.');
} finally {
  for (const state of sessions) state.child.kill('SIGTERM');
  await Promise.all([...sessions].map((state) => state.done));
  if (seeded) sql(`begin;
    delete from public.gym_class_announcements where gym_id='${gym}';
    delete from public.class_bookings where class_id in (select id from public.gym_classes where gym_id='${gym}');
    delete from public.class_waitlist where class_id in (select id from public.gym_classes where gym_id='${gym}');
    delete from public.event_outbox where aggregate_id in (select id from public.gym_classes where gym_id='${gym}');
    delete from public.gym_classes where gym_id='${gym}';
    delete from public.gym_class_series where gym_id='${gym}';
    delete from public.gym_memberships where gym_id='${gym}';
    delete from public.gyms where id='${gym}';
    commit;`);
}
