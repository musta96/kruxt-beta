import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareLineage, DEV_PROJECT_REF } from './migration-lineage.mjs';

const cli = fileURLToPath(new URL('./migration-lineage.mjs', import.meta.url));
const now = Date.parse('2026-10-23T12:00:00Z');
const sql = 'select 1;\n';
const dirs = ['supabase/migrations', 'packages/db/supabase/migrations'];
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'migration lineage '));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });
  const put = (tree, name, content = sql) => writeFileSync(join(root, dirs[tree], name), content);
  const both = (name, content = sql) => { put(0, name, content); put(1, name, content); };
  const applied = (rows = [{ version: '202601010001', name: 'first', statements: [sql] }]) =>
    ({ projectRef: DEV_PROJECT_REF, capturedAt: new Date(now).toISOString(), migrations: rows });
  const report = snapshot => compareLineage({ root, applied: snapshot, now });
  const snapshot = () => dirs.map(dir => readdirSync(join(root, dir)).sort().map(name =>
    [name, readFileSync(join(root, dir, name)).toString('hex')]));
  const run = args => spawnSync(process.execPath, [cli, '--root', root, ...args], { encoding: 'utf8' });
  return { root, put, both, applied, report, snapshot, run };
}
const codes = report => report.blockers.map(b => b.code);

test('identical applied files pass with byte-exact evidence; reports contain only hashes, not SQL', t => {
  const f = fixture(t);
  f.both('202601010001_first.sql');
  const before = f.snapshot();
  const r = f.report(f.applied());
  assert.equal(r.gate, 'pass');
  assert.equal(r.hosted.content.length, 2);
  assert.equal(r.hosted.content[0].status, 'exact');
  assert.match(r.inventories.root.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(r.inventories.root.files[0].bytes, Buffer.byteLength(sql));
  assert.ok(!JSON.stringify(r).includes(sql));
  assert.deepEqual(f.snapshot(), before);
});

test('inventory without hosted evidence blocks even identical trees', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  assert.deepEqual(codes(f.report()), ['applied-export-required']);
  const result = f.run([]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).gate, 'blocked');
});

test('root/package-only files, same-version renames and byte differences are distinct', t => {
  const f = fixture(t);
  f.put(0, '202601010001_first.sql', 'select 1;\r\n');
  f.put(1, '202601010001_renamed.sql');
  f.put(0, '202601010002_root_only.sql');
  f.put(1, '202601010003_package_only.sql');
  const before = f.snapshot();
  const r = f.report();
  assert.equal(r.comparison.rootOnly[0].version, '202601010002');
  assert.equal(r.comparison.packageOnly[0].version, '202601010003');
  assert.equal(r.comparison.conflicts[0].contentDiffers, true);
  assert.equal(r.comparison.conflicts[0].filenameDiffers, true);
  assert.ok(codes(r).includes('trees-diverge'));
  assert.deepEqual(f.snapshot(), before);
});

test('same filename changed SQL blocks, including trailing whitespace', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  f.put(1, '202601010001_first.sql', `${sql} `);
  const conflict = f.report().comparison.conflicts[0];
  assert.equal(conflict.filenameDiffers, false);
  assert.notEqual(conflict.root.sha256, conflict.package.sha256);
});

test('duplicate local versions, malformed filenames, directories and symlinks fail closed', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  f.put(0, '202601010001_second.sql');
  f.put(0, 'broken.sql');
  mkdirSync(join(f.root, dirs[1], 'nested'));
  symlinkSync(join(f.root, dirs[0], 'broken.sql'), join(f.root, dirs[1], '202601010002_link.sql'));
  const r = f.report(f.applied());
  assert.ok(codes(r).includes('duplicate-version'));
  assert.equal(codes(r).filter(c => c === 'invalid-migration-entry').length, 3);
  assert.equal(r.gate, 'blocked');
});

test('renumbered names and identical-content aliases never count as applied', t => {
  const f = fixture(t); f.put(0, '202601010001_first.sql'); f.put(1, '202601010002_first.sql');
  const r = f.report(f.applied());
  assert.equal(r.comparison.sameNameDifferentVersions.length, 1);
  assert.equal(r.comparison.identicalContentDifferentVersions.length, 1);
  assert.deepEqual(r.hosted.missingApplied.package, ['202601010001']);
  assert.deepEqual(r.hosted.pending.package, ['202601010002']);
  assert.ok(codes(r).includes('applied-version-missing-locally'));
});

test('applied versions absent from both trees and old pending versions block', t => {
  const f = fixture(t); f.both('00000000000000_baseline.sql'); f.both('202601010001_first.sql');
  const r = f.report(f.applied([{ version: '202602010001', name: 'unknown', statements: null }]));
  assert.deepEqual(r.hosted.missingApplied.root, ['202602010001']);
  assert.deepEqual(r.hosted.historicalPending.root, ['00000000000000', '202601010001']);
  assert.ok(codes(r).includes('baseline-replay-forbidden'));
  assert.ok(codes(r).includes('historical-pending-review-required'));
});

test('forward pending files are listed, not executed; empty history cannot authorize a baseline', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  f.both('20261023075329_next.sql', 'select 2;\n');
  const r = f.report(f.applied());
  assert.equal(r.gate, 'pass');
  assert.deepEqual(r.hosted.pending.root, ['20261023075329']);
  f.both('00000000000000_baseline.sql', '-- baseline\n');
  assert.ok(codes(f.report(f.applied([]))).includes('baseline-replay-forbidden'));
});

test('names-only metadata cannot pass; serialized SQL differences are not semantic proof', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  for (const statements of [null, [], ['select 2;'], ['select 1;']]) {
    const r = f.report(f.applied([{ version: '202601010001', name: 'other', statements }]));
    assert.ok(codes(r).includes('applied-content-review-required'));
    assert.ok(codes(r).includes('applied-name-mismatch'));
    assert.equal(r.hosted.content[0].status, statements?.length ? 'serialized-content-differs' : 'unverified');
  }
});

test('wrong project, stale and future exports block', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  assert.ok(codes(f.report({ ...f.applied(), projectRef: 'wrong' })).includes('applied-project-mismatch'));
  for (const offset of [-86400001, 300001]) {
    assert.ok(codes(f.report({ ...f.applied(), capturedAt: new Date(now + offset).toISOString() }))
      .includes('applied-export-not-fresh'));
  }
});

test('invalid exports reject numeric/truncated IDs, duplicate rows and malformed statements', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  for (const invalid of [null, [], {}, { ...f.applied(), capturedAt: 'not-a-date' },
    f.applied([{ version: 202601010001, name: 'first' }]),
    f.applied([{ version: '1e10', name: 'first' }]),
    f.applied([{ version: '202601010001', name: 'first', statements: [null] }]),
    f.applied([...f.applied().migrations, ...f.applied().migrations])]) {
    assert.throws(() => f.report(invalid));
  }
});

test('CLI rejects mutating/unknown/duplicate flags and unreadable/malformed input; does not write', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  writeFileSync(join(f.root, 'bad.json'), 'not json');
  const before = f.snapshot();
  for (const args of [['--apply'], ['--repair'], ['--root', f.root], ['--applied'],
    ['--applied', join(f.root, 'absent.json')], ['--applied', join(f.root, 'bad.json')]]) {
    const result = f.run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
  }
  assert.deepEqual(f.snapshot(), before);
  assert.equal(spawnSync(process.execPath, [cli, '--help']).status, 0);
});

test('missing or empty migration trees cannot pass', t => {
  const f = fixture(t);
  assert.ok(codes(f.report(f.applied([]))).includes('empty-migration-tree'));
  rmSync(join(f.root, dirs[1]), { recursive: true });
  assert.equal(f.run([]).status, 2);
});

test('CLI successful evidence path is read-only and returns zero', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  const exportPath = join(f.root, 'applied.json');
  writeFileSync(exportPath, JSON.stringify({ ...f.applied(), capturedAt: new Date().toISOString() }));
  const before = readFileSync(exportPath);
  const result = f.run(['--applied', exportPath, '--project-ref', DEV_PROJECT_REF]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).gate, 'pass');
  assert.deepEqual(readFileSync(exportPath), before);
});

test('PostgreSQL statement hashes work without SQL bodies; inconsistent evidence is rejected', t => {
  const f = fixture(t); f.both('202601010001_first.sql');
  const hash = f.report().inventories.root.files[0].sha256;
  const snapshot = f.applied([{ version: '202601010001', name: 'first', statementsSha256: hash }]);
  assert.equal(f.report(snapshot).gate, 'pass');
  snapshot.migrations[0].statementsSha256 = 'f'.repeat(64);
  assert.ok(codes(f.report(snapshot)).includes('applied-content-review-required'));
  snapshot.migrations[0].statements = [sql];
  assert.throws(() => f.report(snapshot), /Inconsistent statement hash/);
  snapshot.migrations[0].statementsSha256 = 'not a hash';
  assert.throws(() => f.report(snapshot));
});

test('manifest maps foundation source markers and timestamp candidates without claiming equivalence', t => {
  const f = fixture(t);
  f.put(1, '00000000000000_baseline.sql',
    '-- === original: 202602190001_krux_beta_foundation_part1.sql ===\nselect 1;\n' +
    '-- === original: 202602200007_krux_beta_part5_s007_addons_partner_dataops.sql ===\nselect 2;\n');
  f.put(0, '20260227132638_uuid.sql');
  f.put(1, '202605110001_member_coaching_and_workout_plans.sql');
  const r = f.report(f.applied([
    { version: '202602190001', name: 'krux_beta_foundation_part1' },
    { version: '20260227132637', name: '' },
    { version: '20260512064632', name: 'member_coaching_invites_workout_plans' },
    { version: '20260531173049', name: 'custom_gym_roles_permission_mutations' },
  ]));
  const manifest = r.reconciliation;
  assert.equal(manifest.status, 'proposal-only');
  assert.equal(manifest.baselineSourceMarkerCount, 2);
  assert.equal(manifest.entries[0].candidates[0].relationship, 'baseline-source-marker');
  assert.equal(manifest.entries[0].candidates[0].startLine, 1);
  assert.match(manifest.entries[0].candidates[0].segmentSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.entries[1].candidates[0].localVersion, '20260227132638');
  assert.equal(manifest.entries[2].candidates[0].localVersion, '202605110001');
  assert.deepEqual(manifest.unmappedAppliedVersions, ['20260531173049']);
  for (const entry of manifest.entries) {
    assert.equal(entry.proposedCanonicalVersion, entry.appliedVersion);
    assert.equal(entry.equivalence, 'unproven');
  }
  assert.equal(r.gate, 'blocked');
});
