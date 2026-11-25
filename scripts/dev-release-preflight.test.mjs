import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROJECT } from './migration-live-catalog.mjs';
import { preflight, requirements, MAX_AGE_MS, FUTURE_SKEW_MS } from './dev-release-preflight.mjs';

const now = Date.parse('2026-10-24T12:00:00.000Z');
const marker = 'SECRET_SQL_BODY_DO_NOT_REPORT';
function fixture() {
  return {
    formatVersion: 1, projectRef: PROJECT, transaction_read_only: 'on',
    captured_at: new Date(now).toISOString(), scope: { schemas: ['public', 'storage'] },
    catalog_objects: requirements.map(({ kind, identity, expectedFields }) => ({ kind, identity,
      definition: { ...structuredClone(expectedFields), sql: marker, acl: marker } })),
  };
}
function evidence(snapshot = fixture()) {
  const payload = `${JSON.stringify(snapshot.catalog_objects)}\n`;
  snapshot.catalog_sha256 = createHash('sha256').update(payload.slice(0, -1)).digest('hex');
  return { snapshot, payload, now };
}
const codes = (report) => report.blockers.map((blocker) => blocker.code);

test('complete synthetic minimums never authorize release or prove equivalence', () => {
  const report = preflight(evidence());
  assert.equal(report.scopedStatus, 'MINIMUM_CATALOG_PRESENT');
  assert.equal(report.evidenceVerified, true);
  assert.equal(report.checks.length, requirements.length);
  assert.deepEqual(report.blockers, []);
  assert.equal(report.releaseStatus, 'BLOCKED');
  assert.equal(report.schemaEquivalent, 'unproven');
  assert.equal(report.lineageGate, 'REQUIRED_NOT_EVALUATED');
  assert.ok(report.releaseHolds.includes('LINEAGE_GATE_REQUIRED'));
  assert.doesNotMatch(JSON.stringify(report), new RegExp(marker));
  assert.equal(new Set(requirements.map((r) => `${r.kind}/${r.identity}`)).size, requirements.length);
});

test('each required object fails closed with only its curated scope and identity', () => {
  for (const required of requirements) {
    const s = fixture();
    s.catalog_objects = s.catalog_objects.filter((o) => o.kind !== required.kind || o.identity !== required.identity);
    const report = preflight(evidence(s));
    assert.equal(report.scopedStatus, 'BLOCKED');
    assert.deepEqual(report.blockers, [{ scope: required.scope, kind: required.kind,
      identity: required.identity, code: 'MISSING_OBJECT', conflictingFields: [] }]);
  }
});

test('every selected field mismatch is scoped and actual values are redacted', () => {
  for (const [index, required] of requirements.entries()) {
    for (const field of Object.keys(required.expectedFields)) {
      const s = fixture();
      s.catalog_objects[index].definition[field] = marker;
      const report = preflight(evidence(s));
      assert.deepEqual(codes(report), ['SELECTED_FIELDS_CONFLICT']);
      assert.deepEqual(report.blockers[0].conflictingFields, [field]);
      assert.doesNotMatch(JSON.stringify(report), new RegExp(marker));
    }
  }
});

test('wrong overload cannot satisfy an exact routine identity', () => {
  const s = fixture();
  s.catalog_objects.find((o) => o.identity.startsWith('public.log_workout_atomic(')).identity =
    'public.log_workout_atomic(p_workout text, p_exercises jsonb)';
  assert.deepEqual(codes(preflight(evidence(s))), ['MISSING_OBJECT']);
});

test('missing, wrong target, malformed and non-read-only evidence is rejected without echoes', () => {
  assert.deepEqual(codes(preflight()), ['SNAPSHOT_REQUIRED']);
  for (const [mutate, code] of [
    [(s) => { s.projectRef = marker; }, 'WRONG_TARGET'],
    [(s) => { s.transaction_read_only = 'off'; }, 'INVALID_SNAPSHOT'],
    [(s) => { s.formatVersion = 2; }, 'INVALID_SNAPSHOT'],
    [(s) => { s.captured_at = marker; }, 'INVALID_SNAPSHOT'],
    [(s) => { s.captured_at = '2026-02-30T12:00:00.000Z'; }, 'INVALID_CAPTURE_TIME'],
    [(s) => { s.catalog_objects = []; }, 'INVALID_SNAPSHOT'],
    [(s) => { s.catalog_objects.push(s.catalog_objects[0]); }, 'INVALID_SNAPSHOT'],
    [(s) => { s.scope.schemas = ['public']; }, 'INCOMPLETE_SCHEMA_SCOPE'],
    [(s) => { s.catalog_objects[0].definition = null; }, 'INVALID_REQUIRED_DEFINITION'],
    [(s) => { s.catalog_objects[0].definition = marker; }, 'INVALID_REQUIRED_DEFINITION'],
  ]) {
    const s = fixture();
    mutate(s);
    const report = preflight(evidence(s));
    assert.deepEqual(codes(report), [code]);
    assert.equal(report.evidenceVerified, false);
    assert.deepEqual(report.checks, []);
    assert.doesNotMatch(JSON.stringify(report), new RegExp(marker));
  }
});

test('freshness uses a fixed 24 hour window and five minute future tolerance', () => {
  for (const [offset, code] of [
    [-MAX_AGE_MS, undefined], [-MAX_AGE_MS - 1, 'STALE_SNAPSHOT'],
    [FUTURE_SKEW_MS, undefined], [FUTURE_SKEW_MS + 1, 'FUTURE_SNAPSHOT'],
  ]) {
    const s = fixture();
    s.captured_at = new Date(now + offset).toISOString();
    assert.deepEqual(codes(preflight(evidence(s))), code ? [code] : []);
  }
  assert.deepEqual(codes(preflight({ ...evidence(), now: NaN })), ['INVALID_CLOCK']);
});

test('payload is mandatory and both byte hash and object equality must verify', () => {
  for (const payload of [undefined, '', {}, Buffer.alloc(0)]) {
    assert.deepEqual(codes(preflight({ ...evidence(), payload })), ['PAYLOAD_REQUIRED']);
  }
  const input = evidence();
  assert.deepEqual(codes(preflight({ ...input, payload: `${input.payload} ` })), ['PAYLOAD_MISMATCH']);
  input.snapshot.catalog_objects[0].definition.rls = false;
  assert.deepEqual(codes(preflight(input)), ['PAYLOAD_MISMATCH']);
  assert.deepEqual(codes(preflight({ ...evidence(), payload: marker })), ['PAYLOAD_MISMATCH']);
});

test('untrusted extra identities and definitions never enter the report', () => {
  const s = fixture();
  s.catalog_objects.push({ kind: marker, identity: marker, definition: { secret: marker } });
  assert.doesNotMatch(JSON.stringify(preflight(evidence(s))), new RegExp(marker));
});

test('CLI is offline, leaves input bytes unchanged, holds release and sanitizes errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-release-preflight-'));
  const script = new URL('./dev-release-preflight.mjs', import.meta.url);
  const run = (args) => spawnSync(process.execPath, [fileURLToPath(script), ...args], { encoding: 'utf8' });
  try {
    const input = evidence();
    input.snapshot.captured_at = new Date().toISOString();
    const snapshotPath = join(directory, 'snapshot.json');
    const payloadPath = join(directory, 'payload.jsonb');
    const snapshotText = JSON.stringify(input.snapshot);
    await writeFile(snapshotPath, snapshotText);
    await writeFile(payloadPath, input.payload);
    const args = ['--snapshot', snapshotPath, '--payload', payloadPath];
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).scopedStatus, 'MINIMUM_CATALOG_PRESENT');
    assert.equal(result.stderr, '');
    const { readFile } = await import('node:fs/promises');
    assert.equal(await readFile(snapshotPath, 'utf8'), snapshotText);
    assert.equal(await readFile(payloadPath, 'utf8'), input.payload);
    for (const invalid of [[], [...args, '--apply', 'yes'], [...args, '--snapshot', snapshotPath],
      ['--snapshot', marker, '--payload', payloadPath]]) {
      const failed = run(invalid);
      assert.equal(failed.status, 2);
      assert.equal(failed.stdout, '');
      assert.doesNotMatch(failed.stderr, new RegExp(marker));
    }
    await writeFile(snapshotPath, `{"sql":"${marker}"`);
    const malformed = run(args);
    assert.equal(malformed.status, 2);
    assert.doesNotMatch(malformed.stderr, new RegExp(marker));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
