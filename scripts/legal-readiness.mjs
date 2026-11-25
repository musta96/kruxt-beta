import { constants, openSync, closeSync, fstatSync, readSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const POLICY_TYPES = ['terms', 'privacy', 'health_data'];
export const OPERATIONAL_REVIEWS = ['controller_contacts', 'age_territories', 'purpose_roles',
  'suppliers_transfers', 'retention_rights', 'consent_withdrawal'];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const unresolved = /\[(?:TO COMPLETE|TO CONFIRM|OWNER DECISION|LEGAL REVIEW|ROLE ALLOCATION|BEFORE PAID|identified |named |specific |confirmed )/i;
const draftLabel = /NOT EFFECTIVE|NOT APPROVED|DO NOT PUBLISH|^(?:#{1,6}\s*)?(?:\*\*)?DRAFT(?:\s*[-:]|\s+version\b)/im;

function readBounded(path, maximum) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > maximum) throw new Error('Invalid input');
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!count) break;
      offset += count;
    }
    if (offset !== stat.size) throw new Error('Input changed');
    return buffer.subarray(0, offset);
  } finally { closeSync(fd); }
}

function documentPath(root, source) {
  if (typeof source !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(source)) throw new Error('Invalid source');
  const parts = source.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid source');
  let path = realpathSync(root);
  for (const part of parts) {
    path = resolve(path, part);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Invalid source');
  }
  return path;
}

// Offline evidence consistency only: never authorizes publication or certifies legal compliance.
export function assessLegalReadiness(manifest, { root, now = Date.now() } = {}) {
  const report = {
    formatVersion: 1, scopedStatus: 'BLOCKED', releaseAuthorization: false,
    hostedPublicationVerified: false, humanApprovalProven: false, legalComplianceCertified: false,
    blockers: [], documents: [],
  };
  const block = (code, policyType) => report.blockers.push({ code, ...(policyType ? { policyType } : {}) });
  if (!record(manifest) || manifest.formatVersion !== 1 || !Array.isArray(manifest.documents)
    || manifest.documents.length !== POLICY_TYPES.length || !Number.isFinite(now)) {
    block('INVALID_MANIFEST'); return report;
  }
  const types = manifest.documents.map((item) => record(item) ? item.policyType : null);
  if (new Set(types).size !== POLICY_TYPES.length || !POLICY_TYPES.every((type) => types.includes(type))) {
    block('INVALID_POLICY_SET'); return report;
  }
  if (manifest.status !== 'reviewed_candidate') block('DRAFT_OR_UNREVIEWED_PACK');
  for (const review of OPERATIONAL_REVIEWS) {
    if (!record(manifest.operationalReviews) || manifest.operationalReviews[review] !== 'reviewed') {
      block(`REVIEW_REQUIRED_${review.toUpperCase()}`);
    }
  }
  for (const policyType of POLICY_TYPES) {
    const item = manifest.documents.find((entry) => entry.policyType === policyType);
    const before = report.blockers.length;
    if (typeof item.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(item.version)) block('FINAL_VERSION_REQUIRED', policyType);
    const effective = typeof item.effectiveAt === 'string' ? Date.parse(item.effectiveAt) : NaN;
    if (!Number.isFinite(effective) || new Date(effective).toISOString() !== item.effectiveAt) block('VALID_EFFECTIVE_DATE_REQUIRED', policyType);
    else if (effective > now) block('NOT_YET_EFFECTIVE', policyType);
    if (extname(typeof item.source === 'string' ? item.source : '') !== '.txt') block('PLAIN_TEXT_CANDIDATE_REQUIRED', policyType);
    let bytes;
    try { bytes = readBounded(documentPath(root, item.source), MAX_DOCUMENT_BYTES); }
    catch { block('SOURCE_UNAVAILABLE_OR_UNSAFE', policyType); }
    if (bytes) {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (text.includes('\0') || !text.trim()) block('INVALID_PLAIN_TEXT', policyType);
        if (draftLabel.test(text)) block('DRAFT_TEXT_PRESENT', policyType);
        if (unresolved.test(text)) block('UNRESOLVED_DECISION_FIELDS', policyType);
      } catch { block('INVALID_PLAIN_TEXT', policyType); }
      const actual = sha256(bytes);
      for (const field of ['ownerApprovedSha256', 'legalReviewedSha256']) {
        if (!digest(item[field]) || item[field] !== actual) {
          block(field === 'ownerApprovedSha256' ? 'EXACT_OWNER_REVIEW_BINDING_REQUIRED' : 'EXACT_LEGAL_REVIEW_BINDING_REQUIRED', policyType);
        }
      }
    }
    report.documents.push({ policyType, localCandidateConsistent: report.blockers.length === before });
  }
  if (!report.blockers.length) report.scopedStatus = 'LOCAL_CANDIDATES_CONSISTENT';
  return report;
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('Usage: node scripts/legal-readiness.mjs [--manifest /path/to/manifest.json]\nOffline only; reads local plain-text review candidates. Does not authorize release.\n');
    return;
  }
  if (args.length && (args.length !== 2 || args[0] !== '--manifest')) throw new Error('Invalid arguments');
  const path = args.length ? resolve(args[1]) : fileURLToPath(new URL('../docs/legal/review-manifest.json', import.meta.url));
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readBounded(path, 64 * 1024)));
  const report = assessLegalReadiness(manifest, { root: dirname(path) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.scopedStatus === 'LOCAL_CANDIDATES_CONSISTENT' ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(process.argv.slice(2)); }
  catch {
    process.stderr.write('Legal readiness input is invalid or unavailable. No publication was attempted.\n');
    process.exitCode = 2;
  }
}
