import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = fileURLToPath(new URL('.', import.meta.url));
const ref = 'hgomsmhsybrxjdxbgkjy';
const migrations = [
  '202608030001_guard_bzone_demo_seed.sql',
  '202608030002_atomic_class_booking_waitlist.sql',
  '202608030003_harden_class_cancellation_promotion.sql',
  '202608030004_consent_activation_hardening.sql',
  '202608030005_mobile_onboarding_contract.sql',
  '202608030006_harden_class_lifecycle.sql',
];
const functions = ['provider_webhook_ingest', 'sync_dispatcher', 'rank_recompute_weekly',
  'privacy_request_processor', 'audit_event_ingest', 'incident_notifier', 'complete-profile-activation'];

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kruxt deploy '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, value) => {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, value);
  };
  mkdirSync(join(root, 'scripts'));
  for (const name of ['bootstrap.sh', 'deploy_functions.sh', 'deployment_guard.sh']) {
    copyFileSync(join(scripts, name), join(root, 'scripts', name));
  }
  put('supabase/config.toml', 'project_id = "fixture"\n');
  put('supabase/.temp/project-ref', ref);
  put('supabase/seed.sql', '-- preserve seed\n');
  for (const name of migrations) {
    put(`packages/db/supabase/migrations/${name}`, '-- fixture\n');
    put(`supabase/migrations/${name}`, '-- fixture\n');
  }
  for (const name of functions) put(`supabase/functions/${name}/index.ts`, '// fixture\n');
  put('bin/supabase', '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALL_LOG"\nexit "${CLI_EXIT:-0}"\n');
  // All deployment tests use this fake CLI, never a hosted project.
  const chmod = spawnSync('chmod', ['+x', join(root, 'bin/supabase')]);
  assert.equal(chmod.status, 0);
  put('calls', '');
  const run = (script, args = [], env = {}) => spawnSync('bash', [join(root, 'scripts', script), ...args], {
    encoding: 'utf8', env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      CALL_LOG: join(root, 'calls'), ...env },
  });
  const calls = () => readFileSync(join(root, 'calls'), 'utf8');
  const snapshot = () => JSON.stringify(['supabase/migrations', 'packages/db/supabase/migrations'].map(dir =>
    readdirSync(join(root, dir)).sort().map(name => [dir, name, readFileSync(join(root, dir, name), 'utf8')])));
  return { root, put, run, calls, snapshot };
}

test('both defaults are local-only and preserve files', t => {
  const f = fixture(t);
  const before = f.snapshot();
  for (const script of ['bootstrap.sh', 'deploy_functions.sh']) assert.equal(f.run(script).status, 0);
  assert.equal(f.calls(), '');
  assert.equal(f.snapshot(), before);
});

test('unknown args, missing confirmation, and wrong confirmation execute nothing', t => {
  for (const script of ['bootstrap.sh', 'deploy_functions.sh']) {
    for (const args of [['--bad'], ['--apply'], ['--apply', '--confirm-dev-project', 'other'],
      ['--apply', '--dry-run'], ['--confirm-dev-project']]) {
      const f = fixture(t);
      assert.notEqual(f.run(script, args).status, 0);
      assert.equal(f.calls(), '');
    }
  }
});

test('missing migration and mismatched or extra files block before CLI calls', t => {
  for (const mismatch of ['missing', 'changed', 'extra']) {
    const f = fixture(t);
    if (mismatch === 'missing') rmSync(join(f.root, 'packages/db/supabase/migrations', migrations[0]));
    if (mismatch === 'changed') f.put(`supabase/migrations/${migrations[0]}`, '-- different\n');
    if (mismatch === 'extra') f.put('supabase/migrations/extra.sql', '-- extra\n');
    const before = f.snapshot();
    for (const script of ['bootstrap.sh', 'deploy_functions.sh']) {
      assert.notEqual(f.run(script, ['--apply', '--confirm-dev-project', ref]).status, 0);
    }
    assert.equal(f.calls(), '');
    assert.equal(f.snapshot(), before);
  }
});

test('wrong or absent linked DB project blocks even a dry run', t => {
  for (const linked of ['other', null]) {
    const f = fixture(t);
    if (linked) f.put('supabase/.temp/project-ref', linked);
    else rmSync(join(f.root, 'supabase/.temp/project-ref'));
    assert.notEqual(f.run('bootstrap.sh', ['--dry-run', '--confirm-dev-project', ref]).status, 0);
    assert.equal(f.calls(), '');
  }
});

test('DB dry-run is explicit; apply does not include seeds; CLI failure preserves files', t => {
  const f = fixture(t);
  const before = f.snapshot();
  assert.equal(f.run('bootstrap.sh', ['--dry-run', '--confirm-dev-project', ref]).status, 0);
  assert.match(f.calls(), /--dry-run/);
  assert.doesNotMatch(f.calls(), /--yes|--include-seed/);
  assert.equal(f.run('bootstrap.sh', ['--apply', '--confirm-dev-project', ref], { CLI_EXIT: '7' }).status, 7);
  assert.match(f.calls(), /--yes/);
  assert.doesNotMatch(f.calls(), /--include-seed/);
  assert.equal(f.snapshot(), before);
  assert.equal(readFileSync(join(f.root, 'supabase/seed.sql'), 'utf8'), '-- preserve seed\n');
});

test('Edge manifest includes activation, pins DEV, and stops at first failure', t => {
  const f = fixture(t);
  assert.equal(f.run('deploy_functions.sh', ['--apply', '--confirm-dev-project', ref]).status, 0);
  const calls = f.calls().trim().split('\n');
  assert.equal(calls.length, functions.length);
  for (const fn of functions) assert.ok(calls.some(call => call.includes(`functions deploy ${fn} --project-ref ${ref}`)));
  f.put('calls', '');
  assert.equal(f.run('deploy_functions.sh', ['--apply', '--confirm-dev-project', ref], { CLI_EXIT: '7' }).status, 7);
  assert.equal(f.calls().trim().split('\n').length, 1);
});

test('missing Edge source prevents partial deployment', t => {
  const f = fixture(t);
  rmSync(join(f.root, 'supabase/functions/complete-profile-activation/index.ts'));
  assert.notEqual(f.run('deploy_functions.sh', ['--apply', '--confirm-dev-project', ref]).status, 0);
  assert.equal(f.calls(), '');
});
