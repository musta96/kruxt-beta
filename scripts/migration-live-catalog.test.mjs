import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compareSnapshots, probeObjects, summarize, validateSnapshot, verifyPayload, PROJECT } from './migration-live-catalog.mjs';

const object = (kind, identity, definition) => ({ kind, identity, definition });
const snapshot = (objects) => ({ formatVersion: 1, projectRef: PROJECT,
  transaction_read_only: 'on', captured_at: '2026-10-23T15:21:55.888Z',
  catalog_sha256: 'a'.repeat(64), catalog_objects: objects,
  scope: { schemas: ['public', 'storage'] }, server_version: '17.6' });
const base = () => snapshot([
  object('relation', 'public.example', { rls: true, forceRls: false, acl: '{authenticated=r/postgres}' }),
  object('routine', 'public.example(p_id uuid)', { sql: 'SELECT 1', securityDefiner: false }),
]);

test('canonical summary is independent of object/key order, not SQL or ACL normalization', () => {
  const a = base();
  const b = base();
  b.catalog_objects.reverse();
  b.catalog_objects[1].definition = { acl: '{authenticated=r/postgres}', forceRls: false, rls: true };
  assert.equal(summarize(a).canonicalObjectsSha256, summarize(b).canonicalObjectsSha256);
  assert.notEqual(summarize(a).canonicalObjectsSha256, a.catalog_sha256);
  assert.equal(compareSnapshots(a, b).catalogPayloadEqual, true);
  assert.equal(compareSnapshots(a, b).schemaEquivalent, 'unproven');
});

test('named deltas retain RLS/ACL fields and exact values', () => {
  const a = base();
  const b = base();
  b.catalog_objects[0].definition.rls = false;
  b.catalog_objects[0].definition.acl = '{anon=arwd/postgres}';
  const report = compareSnapshots(a, b);
  assert.equal(report.deltas.length, 1);
  assert.deepEqual(report.deltas[0].fields, ['acl', 'rls']);
  assert.equal(report.deltas[0].after.rls, false);
});

test('exact PostgreSQL text hash and parsed objects must both agree', () => {
  const s = base();
  const text = JSON.stringify(s.catalog_objects);
  s.catalog_sha256 = createHash('sha256').update(text).digest('hex');
  assert.equal(verifyPayload(s, Buffer.from(`${text}\n`)).postgresPayloadSha256Verified, true);
  assert.throws(() => verifyPayload(s, Buffer.from(`${text} \n`)), /SHA-256/);
  s.catalog_objects[0].definition.rls = false;
  assert.throws(() => verifyPayload(s, Buffer.from(text)), /differ/);
});

test('overloads, added/removed objects, and array ordering remain distinct', () => {
  const a = base();
  const b = base();
  b.catalog_objects[1].identity = 'public.example(p_id text)';
  assert.deepEqual(compareSnapshots(a, b).deltas.map((d) => d.disposition).sort(), ['added', 'removed']);
  const first = snapshot([object('policy', 'public.t.p', { roles: ['anon', 'authenticated'] })]);
  const second = snapshot([object('policy', 'public.t.p', { roles: ['authenticated', 'anon'] })]);
  assert.equal(compareSnapshots(first, second).catalogPayloadEqual, false);
});

test('scope/project/read-only provenance/duplicates/empty evidence fail closed', () => {
  for (const mutate of [
    (s) => { s.projectRef = 'wrong'; },
    (s) => { s.transaction_read_only = 'off'; },
    (s) => { s.captured_at = 'yesterday'; },
    (s) => { s.catalog_sha256 = 'invalid'; },
    (s) => { s.catalog_objects = []; },
    (s) => { s.catalog_objects.push(s.catalog_objects[0]); },
    (s) => { s.scope.schemas = ['public', 'public']; },
  ]) {
    const s = base();
    mutate(s);
    assert.throws(() => validateSnapshot(s));
  }
  const other = base();
  other.scope.schemas = ['auth'];
  assert.throws(() => compareSnapshots(base(), other), /scope/);
});

test('presence cannot establish routine equivalence; absent names remain absent', () => {
  const probes = probeObjects(base(), [
    { kind: 'routine', routineName: 'public.example', expectedSqlFragments: ['SELECT 2'] },
    { kind: 'relation', identity: 'public.missing' },
    { kind: 'relation', identity: 'public.example', expectedFields: { rls: false } },
  ]);
  assert.equal(probes[0].equivalence, 'unproven');
  assert.equal(probes[0].textObservations[0].present, false);
  assert.equal(probes[1].disposition, 'absent');
  assert.equal(probes[2].disposition, 'conflicting-selected-fields');
});

test('invalid CLI has no repair, write, or network operation', () => {
  const result = spawnSync(process.execPath, ['scripts/migration-live-catalog.mjs', '--repair', 'yes'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
});

test('saved queries explicitly use read-only snapshots and rollback', async () => {
  for (const file of ['migration-live-catalog.sql', 'migration-live-catalog-fingerprint.sql', 'migration-live-catalog-support.sql',
    'migration-live-catalog-restore-metadata.sql']) {
    const sql = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(sql, /^begin isolation level repeatable read read only;/);
    assert.match(sql, /rollback;\s*$/);
    assert.doesNotMatch(sql, /\b(insert|update|delete|create|alter|drop|copy|pg_read_file|pg_ls_dir|lo_import)\b/i);
    assert.doesNotMatch(sql, /\b(last_value|encrypted_password|rolpassword)\b/i);
  }
});

test('captured DEV payload verifies byte fingerprint and named catalog evidence', async () => {
  const directory = new URL('../docs/security/evidence/', import.meta.url);
  const s = JSON.parse(await readFile(new URL('dev-live-catalog-2026-10-23.restricted.json', directory), 'utf8'));
  const bytes = await readFile(new URL('dev-live-catalog-payload-2026-10-23.restricted.jsonb', directory));
  assert.equal(verifyPayload(s, bytes).objectPayloadVerified, true);
  assert.equal(summarize(s).objectCount, 3821);
  const objects = s.catalog_objects;
  assert.equal(objects.filter((o) => o.kind === 'relation' && o.identity.startsWith('public.') && o.definition.kind === 'r').length, 131);
  assert.equal(objects.filter((o) => o.kind === 'index' && o.identity.startsWith('public.')).length, 385);
  assert.equal(objects.find((o) => o.kind === 'column' && o.identity === 'public.profiles.is_public').definition.default, 'true');
});
