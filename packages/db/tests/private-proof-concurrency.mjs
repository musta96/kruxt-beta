import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const owner = '00000000-0000-4000-8000-000000000001';
const workout = '00000000-0000-4000-8000-000000000031';
const bucket = 'workout-proof-media';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function until(check, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(25);
  }
  throw new Error(`Timeout: ${label}`);
}

function session(name) {
  const child = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-v', 'VERBOSITY=verbose'], {
    env: { ...process.env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state = { child, name, stdout: '', stderr: '', done: false, code: null, signal: null };
  child.stdout.on('data', (chunk) => { state.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { state.stderr += chunk.toString(); });
  child.stdin.on('error', (error) => { state.stderr += `\nstdin: ${error.message}`; });
  child.on('error', (error) => { state.stderr += `\nspawn: ${error.message}`; });
  child.on('close', (code, signal) => {
    Object.assign(state, { done: true, code, signal });
  });
  return state;
}

async function finish(state) {
  await until(() => state.done, `${state.name} exit: ${state.stderr}`);
  return state;
}

async function stop(state, sql) {
  if (state.done) return;
  if (!state.child.stdin.destroyed && !state.child.stdin.writableEnded) {
    state.child.stdin.end('rollback;\n\\q\n');
  }
  await delay(100);
  if (state.done) return;
  // A queued ROLLBACK cannot interrupt a lock wait. Target only this fixture's session.
  try {
    sql(`select pg_terminate_backend(pid) from pg_stat_activity
      where application_name = ${literal(state.name)} and pid <> pg_backend_pid();`);
  } finally {
    if (!state.done) state.child.kill('SIGTERM');
    await delay(100);
    if (!state.done) state.child.kill('SIGKILL');
    await until(() => state.done, `${state.name} forced shutdown`, 2000);
  }
}

// SQL fixture only, not actual Storage SDK uploads, signing, or hosted operations.
// The caller supplies the isolated local database connection and superuser sql().
export async function runPrivateProofRaces(sql) {
  const run = randomUUID();
  const fixtures = [];
  const results = [];
  const children = [];
  const firstPosition = Number(sql(`select greatest(70, coalesce(max(sort_order), 0) + 1)
    from public.workout_proof_media where workout_id = '${workout}';`).trim());
  assert.ok(Number.isSafeInteger(firstPosition), 'Expected numeric fixture sort order');
  const auth = `set role authenticated;
    set statement_timeout = '12s';
    select set_config('request.jwt.claims', '${JSON.stringify({ sub: owner, role: 'authenticated' })}', false);`;
  try {
    for (const [index, name] of ['registration-commit', 'orphan-delete-commit', 'registration-rollback'].entries()) {
      const fixture = {
        race: name, ownerId: owner, workoutId: workout, bucket,
        attemptId: randomUUID(), objectId: randomUUID(), metadataId: randomUUID(),
        sortOrder: firstPosition + index,
      };
      fixture.path = `${owner}/${workout}/${fixture.attemptId}/${name}.jpg`;
      fixtures.push(fixture);
      const inserted = sql(`reset role;
        insert into storage.objects(id,bucket_id,name,owner_id)
        values (${literal(fixture.objectId)}, '${bucket}', ${literal(fixture.path)}, '${owner}') returning id;`);
      assert.ok(inserted.includes(fixture.objectId), 'Seed returns actual object ID');
      const register = `insert into public.workout_proof_media
        (id,workout_id,uploader_user_id,storage_bucket,storage_path,media_kind,mime_type,sort_order)
        values (${literal(fixture.metadataId)}, '${workout}', '${owner}', '${bucket}',
          ${literal(fixture.path)}, 'image', 'image/jpeg', ${fixture.sortOrder});`;
      const remove = `delete from storage.objects where id=${literal(fixture.objectId)}
        and bucket_id='${bucket}' returning id;`;
      const holder = session(`proof-${run}-${index}-h`);
      children.push(holder);
      const marker = `holder-ready-${index}`;
      holder.child.stdin.write(`begin; ${auth}\n${index === 1 ? remove : register}\nselect '${marker}';\n`);
      await until(() => {
        assert.ok(!holder.done, `Holder exited early: ${holder.stderr}`);
        return holder.stdout.includes(marker);
      }, `${name} holder lock`);
      const contender = session(`proof-${run}-${index}-c`);
      children.push(contender);
      contender.child.stdin.end(`begin; ${auth}\n${index === 1 ? register : remove}\ncommit;\n`);
      await until(() => {
        assert.ok(!contender.done, `Contender did not wait: ${contender.stderr}`);
        return sql(`select exists (
          select 1 from pg_stat_activity c join pg_stat_activity h
            on h.pid = any(pg_blocking_pids(c.pid))
          where c.application_name=${literal(contender.name)}
            and h.application_name=${literal(holder.name)} and c.wait_event_type='Lock'
        );`).trim() === 't';
      }, `${name} observed contender lock wait`);
      holder.child.stdin.end(`${index === 2 ? 'rollback' : 'commit'};\n\\q\n`);
      await finish(holder);
      assert.equal(holder.code, 0, holder.stderr);
      await finish(contender);
      if (index === 2) {
        assert.equal(contender.code, 0, contender.stderr);
        assert.ok(contender.stdout.includes(fixture.objectId), 'Waiting delete removed actual object');
      } else {
        assert.equal(contender.code, 3, `Expected psql SQL failure: ${contender.stderr}`);
        assert.match(contender.stderr, /\b42501\b/, 'Race must fail with authorization SQLSTATE');
      }
      const remaining = JSON.parse(sql(`select json_build_object(
        'objects', (select count(*) from storage.objects where id=${literal(fixture.objectId)}),
        'metadata', (select count(*) from public.workout_proof_media where id=${literal(fixture.metadataId)})
      );`).trim());
      assert.deepEqual(remaining, index === 0 ? { objects: 1, metadata: 1 } : { objects: 0, metadata: 0 },
        `${name} final binding state`);
      results.push({ ...fixture, observedLockWait: true,
        holderOutcome: index === 2 ? 'rollback' : 'commit',
        contenderOutcome: index === 2 ? 'deleted' : '42501', remaining });
    }
  } finally {
    // Complete every shutdown even if another child or cleanup operation fails.
    const shutdown = await Promise.allSettled(children.map((child) => stop(child, sql)));
    if (fixtures.length) {
      sql(`reset role;
        delete from public.workout_proof_media where id in (${fixtures.map((f) => literal(f.metadataId)).join(',')});
        delete from storage.objects where id in (${fixtures.map((f) => literal(f.objectId)).join(',')})
          and bucket_id='${bucket}';`);
    }
    for (const result of shutdown) {
      if (result.status === 'rejected') throw result.reason;
    }
  }
  return { fixtureOnly: true, storageSdkTested: false, cleanedUp: true, results };
}
