import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessLegalReadiness, POLICY_TYPES, OPERATIONAL_REVIEWS } from './legal-readiness.mjs';

const now = Date.parse('2026-10-26T12:00:00.000Z');
const marker = 'PRIVATE_CONTACT_OR_BACKEND_PAYLOAD';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const codes = (report) => report.blockers.map((item) => item.code);
function fixture(t, text = 'Synthetic fixture only. An optional workout draft is not an approval.\n') {
  const root = mkdtempSync(join(tmpdir(), 'kruxt-legal-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const manifest = {
    formatVersion: 1, status: 'reviewed_candidate',
    operationalReviews: Object.fromEntries(OPERATIONAL_REVIEWS.map((key) => [key, 'reviewed'])),
    documents: POLICY_TYPES.map((policyType) => {
      const source = `${policyType}.txt`;
      writeFileSync(join(root, source), text);
      return { policyType, version: '1.0.0', source, effectiveAt: '2026-10-26T00:00:00.000Z',
        ownerApprovedSha256: digest(text), legalReviewedSha256: digest(text) };
    }),
  };
  return { root, manifest, check: () => assessLegalReadiness(manifest, { root, now }) };
}

test('synthetic exact candidates can be consistent but never authorize release or prove human/legal/hosted approval', (t) => {
  const { check } = fixture(t);
  const report = check();
  assert.equal(report.scopedStatus, 'LOCAL_CANDIDATES_CONSISTENT');
  assert.deepEqual(report.blockers, []);
  for (const key of ['releaseAuthorization', 'humanApprovalProven', 'hostedPublicationVerified', 'legalComplianceCertified']) assert.equal(report[key], false);
});

test('actual local draft pack stays blocked and output contains no document contents or personal contact details', () => {
  const url = new URL('../docs/legal/review-manifest.json', import.meta.url);
  const manifest = JSON.parse(readFileSync(url, 'utf8'));
  const report = assessLegalReadiness(manifest, { root: fileURLToPath(new URL('.', url)), now });
  assert.equal(report.scopedStatus, 'BLOCKED');
  for (const code of ['DRAFT_OR_UNREVIEWED_PACK', 'DRAFT_TEXT_PRESENT', 'UNRESOLVED_DECISION_FIELDS', 'EXACT_OWNER_REVIEW_BINDING_REQUIRED']) assert.ok(codes(report).includes(code));
  assert.doesNotMatch(JSON.stringify(report), /@|Via Case|Mustarelli|\[TO COMPLETE/);
});

test('missing duplicate unknown or excessive document sets fail with sanitized identifiers', (t) => {
  for (const mutate of [m => m.documents.pop(), m => m.documents.push(m.documents[0]), m => m.documents[0].policyType = marker,
    m => m.documents[1].policyType = m.documents[0].policyType]) {
    const { manifest, check } = fixture(t); mutate(manifest);
    assert.equal(check().scopedStatus, 'BLOCKED'); assert.doesNotMatch(JSON.stringify(check()), new RegExp(marker));
  }
  for (const value of [null, [], {}, { formatVersion: 2 }, { formatVersion: 1, documents: [] }]) assert.equal(assessLegalReadiness(value).scopedStatus, 'BLOCKED');
});

test('every operational review remains mandatory and is not inferred from owner-supplied identity', (t) => {
  for (const key of OPERATIONAL_REVIEWS) {
    const { manifest, check } = fixture(t); manifest.operationalReviews[key] = 'owner_supplied';
    assert.ok(codes(check()).includes(`REVIEW_REQUIRED_${key.toUpperCase()}`));
  }
});

test('exact byte changes, malformed hashes and review of different bytes block', (t) => {
  for (const field of ['ownerApprovedSha256', 'legalReviewedSha256']) {
    for (const value of [null, '0'.repeat(64), marker]) {
      const { manifest, check } = fixture(t); manifest.documents[0][field] = value;
      assert.equal(check().scopedStatus, 'BLOCKED'); assert.doesNotMatch(JSON.stringify(check()), new RegExp(marker));
    }
  }
  const { root, manifest, check } = fixture(t);
  writeFileSync(join(root, manifest.documents[0].source), 'Edited after review.\n');
  assert.ok(codes(check()).includes('EXACT_OWNER_REVIEW_BINDING_REQUIRED'));
});

test('draft labels and unresolved fields cannot be hidden behind matching review hashes', (t) => {
  for (const text of ['DRAFT - NOT EFFECTIVE\n', '**DRAFT - NOT APPROVED**\n', 'Draft version: 0.2\n', '[TO COMPLETE: contact]\n', '[OWNER DECISION REQUIRED: age]\n', '[identified training features]\n']) {
    const { check } = fixture(t, text);
    assert.equal(check().scopedStatus, 'BLOCKED');
  }
});

test('non-final versions, invalid/future dates and non-text formats remain blocked', (t) => {
  for (const patch of [{ version: '1.0.0-draft' }, { version: '' }, { effectiveAt: '2026-02-30T00:00:00.000Z' },
    { effectiveAt: null }, { effectiveAt: '2027-01-01T00:00:00.000Z' }, { source: 'terms.pdf' }]) {
    const { manifest, check } = fixture(t); Object.assign(manifest.documents[0], patch);
    assert.equal(check().scopedStatus, 'BLOCKED');
  }
});

test('path traversal, absolute paths and symbolic links are not read', (t) => {
  for (const source of ['../private.txt', '/private/file.txt', 'https://example.test/file.txt', 'dir/../terms.txt', 'dir\\file.txt', './terms.txt']) {
    const { manifest, check } = fixture(t); manifest.documents[0].source = source;
    assert.ok(codes(check()).includes('SOURCE_UNAVAILABLE_OR_UNSAFE'));
  }
  const { root, manifest, check } = fixture(t);
  symlinkSync(join(root, 'privacy.txt'), join(root, 'link.txt'));
  manifest.documents[0].source = 'link.txt';
  assert.ok(codes(check()).includes('SOURCE_UNAVAILABLE_OR_UNSAFE'));
});

test('oversized, empty, binary or invalid UTF-8 candidates fail without reporting contents', (t) => {
  for (const content of ['', '\0' + marker, Buffer.from([0xff, 0xfe, 0xff])]) {
    const { check } = fixture(t, content); assert.equal(check().scopedStatus, 'BLOCKED');
    assert.doesNotMatch(JSON.stringify(check()), new RegExp(marker));
  }
  const { root, manifest, check } = fixture(t);
  truncateSync(join(root, manifest.documents[0].source), 10 * 1024 * 1024 + 1);
  assert.ok(codes(check()).includes('SOURCE_UNAVAILABLE_OR_UNSAFE'));
});

test('CLI is offline, rejects mutation flags without echoes and does not change inputs', (t) => {
  const { root, manifest } = fixture(t);
  const path = join(root, 'manifest.json'); const body = JSON.stringify(manifest);
  writeFileSync(path, body);
  const script = fileURLToPath(new URL('./legal-readiness.mjs', import.meta.url));
  for (const args of [['--manifest', path], ['--help'], ['--publish', marker], ['--manifest', marker]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, args[0] === '--publish' || args[1] === marker ? 2 : 0);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker));
  }
  assert.equal(readFileSync(path, 'utf8'), body);
  const actual = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(actual.status, 1); assert.equal(JSON.parse(actual.stdout).scopedStatus, 'BLOCKED');
});
