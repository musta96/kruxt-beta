import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconciliationManifest } from './migration-lineage-manifest.mjs';

export const DEV_PROJECT_REF = 'hgomsmhsybrxjdxbgkjy';
const trees = { root: 'supabase/migrations', package: 'packages/db/supabase/migrations' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const groupBy = (items, key) => Map.groupBy(items, key);

export function inventory(root, directory) {
  const issues = [];
  const files = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = `${directory}/${entry.name}`;
    const match = /^(\d+)_(.+)\.sql$/.exec(entry.name);
    // Reject unexpected entries rather than silently omitting deployable input.
    if (!entry.isFile() || !match) {
      issues.push({ code: 'invalid-migration-entry', path });
      continue;
    }
    const bytes = readFileSync(resolve(root, path));
    files.push({ path, filename: entry.name, version: match[1], name: match[2],
      bytes: bytes.length, sha256: sha256(bytes) });
  }
  if (!files.length) issues.push({ code: 'empty-migration-tree', directory });
  for (const [version, entries] of groupBy(files, f => f.version)) {
    if (entries.length > 1) issues.push({ code: 'duplicate-version', directory, version,
      paths: entries.map(f => f.path) });
  }
  return { files, issues };
}

function validateApplied(snapshot, projectRef, now) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      typeof snapshot.projectRef !== 'string' || !Array.isArray(snapshot.migrations) ||
      typeof snapshot.capturedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(snapshot.capturedAt) ||
      !Number.isFinite(Date.parse(snapshot.capturedAt))) {
    throw new Error('Applied export must contain projectRef, ISO capturedAt, and migrations[].');
  }
  const issues = [];
  if (snapshot.projectRef !== projectRef) issues.push({ code: 'applied-project-mismatch',
    expected: projectRef, actual: snapshot.projectRef });
  const age = now - Date.parse(snapshot.capturedAt);
  if (age > 86400000 || age < -300000) issues.push({ code: 'applied-export-not-fresh',
    capturedAt: snapshot.capturedAt });
  const seen = new Set();
  for (const row of snapshot.migrations) {
    if (!row || typeof row.version !== 'string' || !/^\d+$/.test(row.version) ||
        !(row.name === null || typeof row.name === 'string') ||
        !(row.statements == null || (Array.isArray(row.statements) && row.statements.every(s => typeof s === 'string'))) ||
        !(row.statementsSha256 == null || (typeof row.statementsSha256 === 'string' && /^[a-f0-9]{64}$/.test(row.statementsSha256)))) {
      throw new Error('Each applied row needs a digit-string version, string/null name, and string[]/null statements.');
    }
    if (seen.has(row.version)) throw new Error(`Duplicate applied version: ${row.version}`);
    seen.add(row.version);
    if (row.statements != null && row.statementsSha256 != null &&
        sha256(row.statements.join('\n')) !== row.statementsSha256) {
      throw new Error(`Inconsistent statement hash for applied version: ${row.version}`);
    }
  }
  return issues;
}

export function compareLineage({ root, applied, projectRef = DEV_PROJECT_REF, now = Date.now() }) {
  const inventories = Object.fromEntries(Object.entries(trees).map(([key, dir]) => [key, inventory(root, dir)]));
  const blockers = Object.values(inventories).flatMap(i => i.issues);
  const rootFiles = inventories.root.files;
  const packageFiles = inventories.package.files;
  const rootMap = new Map(rootFiles.map(f => [f.version, f]));
  const packageMap = new Map(packageFiles.map(f => [f.version, f]));
  const comparison = { rootOnly: [], packageOnly: [], identical: [], conflicts: [],
    sameNameDifferentVersions: [], identicalContentDifferentVersions: [] };
  for (const version of [...new Set([...rootMap.keys(), ...packageMap.keys()])].sort()) {
    const a = rootMap.get(version);
    const b = packageMap.get(version);
    if (!a) comparison.packageOnly.push(b);
    else if (!b) comparison.rootOnly.push(a);
    else if (a.filename === b.filename && a.sha256 === b.sha256) comparison.identical.push(version);
    else comparison.conflicts.push({ version, root: a, package: b,
      contentDiffers: a.sha256 !== b.sha256, filenameDiffers: a.filename !== b.filename });
  }
  if (comparison.rootOnly.length || comparison.packageOnly.length || comparison.conflicts.length) {
    blockers.push({ code: 'trees-diverge' });
  }
  const all = [...rootFiles, ...packageFiles];
  for (const [name, files] of groupBy(all, f => f.name)) {
    if (new Set(files.map(f => f.version)).size > 1) comparison.sameNameDifferentVersions.push({ name, files });
  }
  for (const [hash, files] of groupBy(all, f => f.sha256)) {
    if (new Set(files.map(f => f.version)).size > 1) {
      comparison.identicalContentDifferentVersions.push({ sha256: hash, files });
    }
  }
  // Names and identical SQL are clues, never permission to alias applied versions.
  if (comparison.sameNameDifferentVersions.length) blockers.push({ code: 'same-name-different-versions' });
  if (comparison.identicalContentDifferentVersions.length) blockers.push({ code: 'same-content-different-versions' });

  let hosted = null;
  if (applied === undefined) blockers.push({ code: 'applied-export-required' });
  else {
    blockers.push(...validateApplied(applied, projectRef, now));
    const versions = new Set(applied.migrations.map(r => r.version));
    const latest = [...versions].sort().at(-1);
    hosted = { projectRef: applied.projectRef, capturedAt: applied.capturedAt,
      count: versions.size, latestAppliedVersion: latest ?? null, missingApplied: {}, pending: {},
      historicalPending: {}, content: [] };
    for (const [key, { files }] of Object.entries(inventories)) {
      const local = new Set(files.map(f => f.version));
      hosted.missingApplied[key] = [...versions].filter(v => !local.has(v)).sort();
      hosted.pending[key] = files.filter(f => !versions.has(f.version)).map(f => f.version);
      hosted.historicalPending[key] = hosted.pending[key].filter(v => latest && v < latest);
      if (hosted.missingApplied[key].length) blockers.push({ code: 'applied-version-missing-locally', tree: key,
        versions: hosted.missingApplied[key] });
      if (hosted.historicalPending[key].length) blockers.push({ code: 'historical-pending-review-required', tree: key,
        versions: hosted.historicalPending[key] });
      const baselines = files.filter(f => !versions.has(f.version) && (/^0+$/.test(f.version) || /baseline/i.test(f.name)));
      if (baselines.length) blockers.push({ code: 'baseline-replay-forbidden', tree: key,
        versions: baselines.map(f => f.version) });
      for (const row of applied.migrations) {
        for (const file of files.filter(f => f.version === row.version)) {
          // Supabase statements are not original file bytes. No SQL normalization or semantic claim.
          const statementsSha256 = row.statements?.length > 0 ? sha256(row.statements.join('\n')) :
            row.statementsSha256 ?? null;
          const status = !statementsSha256 ? 'unverified' :
            statementsSha256 === file.sha256 ? 'exact' : 'serialized-content-differs';
          hosted.content.push({ tree: key, version: row.version, path: file.path,
            localSha256: file.sha256, statementsSha256, status, nameMatches: row.name === file.name });
          if (status !== 'exact') blockers.push({ code: 'applied-content-review-required', tree: key,
            version: row.version, status });
          if (row.name !== file.name) blockers.push({ code: 'applied-name-mismatch', tree: key,
            version: row.version, local: file.name, applied: row.name });
        }
      }
    }
  }
  return { formatVersion: 1, gate: blockers.length ? 'blocked' : 'pass', projectRef,
    scope: 'Offline lineage evidence only; not schema equivalence or deployment authorization.',
    inventories, comparison, hosted, blockers,
    reconciliation: reconciliationManifest(root, all, applied?.migrations ?? []) };
}

export function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/migration-lineage.mjs [--root DIR] [--applied FILE] [--project-ref REF]\n' +
      'Read-only JSON report on stdout. Exit 0: lineage pass; 1: blocked; 2: invalid input.\n' +
      'No network, SQL execution, file writes, history repair, or apply mode.');
    return 0;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--root', '--applied', '--project-ref'].includes(flag) || !args[i + 1] ||
        args[i + 1].startsWith('--') || options[flag]) throw new Error(`Invalid or repeated option: ${flag}`);
    options[flag] = args[i + 1];
  }
  const report = compareLineage({ root: resolve(options['--root'] ?? fileURLToPath(new URL('..', import.meta.url))),
    projectRef: options['--project-ref'] ?? DEV_PROJECT_REF,
    applied: options['--applied'] ? JSON.parse(readFileSync(resolve(options['--applied']), 'utf8')) : undefined });
  console.log(JSON.stringify(report, null, 2));
  return report.gate === 'pass' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(`Migration lineage input error: ${error.message}`); process.exitCode = 2; }
}
