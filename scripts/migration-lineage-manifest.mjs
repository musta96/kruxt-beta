import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');

// Observed ledger/local timestamp candidates, NOT equivalence assertions or repair instructions.
const timestampCandidates = {
  '20260227132637': '20260227132638',
  '20260227133103': '20260227133104',
  '20260227133446': '20260227133447',
  '20260227141005': '20260227141006',
  '20260512064632': '202605110001',
  '20260513121953': '202605130001',
  '20260513223008': '202605130002',
  '20260521125523': '202605210001',
  '20260521145342': '202605210002',
  '20260521150137': '202605210003',
  '20260521151019': '202605210004',
  '20260530080201': '202605300001',
  '20260530090417': '202605300002',
  '20260530103127': '20260530100943',
  '20260531172826': '20260531084228',
  '20260531173049': '20260531135106',
};

export function reconciliationManifest(root, files, applied) {
  const baseline = files.find(f => f.path === 'packages/db/supabase/migrations/00000000000000_baseline.sql');
  const segments = [];
  if (baseline) {
    const text = readFileSync(resolve(root, baseline.path), 'utf8');
    // These are explicit source-map comments, not an SQL parser or reconstruction of original bytes.
    const markers = [...text.matchAll(/^-- === original: (\d+)_(.+)\.sql ===\r?$/gm)];
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const start = marker.index + marker[0].length;
      const end = markers[i + 1]?.index ?? text.length;
      segments.push({ version: marker[1], name: marker[2], path: baseline.path,
        baselineSha256: baseline.sha256, segmentSha256: hash(text.slice(start, end)),
        startLine: text.slice(0, marker.index).split('\n').length,
        hashScope: 'UTF-8 text between source marker end and next source marker; not original file bytes' });
    }
  }
  const entries = applied.map(row => {
    const appliedStatementsSha256 = row.statements?.length ? hash(row.statements.join('\n')) :
      row.statementsSha256 ?? null;
    const candidates = files.filter(f => f.version === row.version ||
      f.version === timestampCandidates[row.version] || (row.name && f.name === row.name))
      .map(f => ({ path: f.path, localVersion: f.version, sha256: f.sha256,
        contentEvidence: !appliedStatementsSha256 ? 'unverified' :
          appliedStatementsSha256 === f.sha256 ? 'exact-serialized-bytes' : 'serialized-content-differs',
        relationship: f.version === row.version ? 'same-version' :
          f.version === timestampCandidates[row.version] ? 'observed-timestamp-candidate' : 'same-name-candidate' }));
    const chunks = segments.filter(s => s.version === row.version);
    for (const chunk of chunks) candidates.push({ ...chunk, relationship: 'baseline-source-marker' });
    return { appliedVersion: row.version, appliedName: row.name, appliedStatementsSha256,
      proposedCanonicalVersion: row.version, equivalence: 'unproven', candidates };
  });
  return { status: 'proposal-only', canonicalHistory: 'Preserve hosted applied versions; never replace chunks with baseline.',
    baselineSourceMarkerCount: segments.length,
    baselineSourceVersions: segments.map(s => s.version),
    entries, unmappedAppliedVersions: entries.filter(e => !e.candidates.length).map(e => e.appliedVersion),
    requiredEvidence: ['Full project-scoped ledger', 'Stored statement content comparison',
      'Read-only live catalog fingerprint', 'Isolated restored-schema forward contract tests', 'Human release review'] };
}
