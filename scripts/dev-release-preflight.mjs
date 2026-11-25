import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT, validateSnapshot, verifyPayload, probeObjects } from './migration-live-catalog.mjs';

export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FUTURE_SKEW_MS = 5 * 60 * 1000;
const requirement = (scope, kind, identity, expectedFields = {}) => ({ scope, kind, identity, expectedFields });
const table = (scope, name) => requirement(scope, 'relation', `public.${name}`, { kind: 'r', rls: true });
const column = (scope, name, type, notNull) => requirement(scope, 'column', `public.${name}`,
  { type, ...(notNull === undefined ? {} : { notNull }) });
const routine = (scope, signature, securityDefiner = true) => requirement(scope, 'routine', `public.${signature}`, { securityDefiner });
const policy = (scope, name, command, permissive = true, fields = {}) =>
  requirement(scope, 'policy', `public.${name}`, { command, permissive, roles: ['authenticated'], ...fields });
const constraint = (scope, name) => requirement(scope, 'constraint', `public.${name}`, { validated: true });

const classes = 'class-series';
const operators = 'operator-profiles';
const workouts = 'workout-retry-social';

// Curated minimums from the feature migrations, never an interpretation of all DDL.
export const requirements = [
  ...['gym_class_series', 'gym_class_series_subscriptions', 'gym_class_announcements',
    'gym_class_announcement_recipients'].map((name) => table(classes, name)),
  column(classes, 'gym_classes.series_id', 'uuid', false),
  column(classes, 'gym_classes.series_occurrence_key', 'text', false),
  column(classes, 'gym_class_series.request_hash', 'bytea', true),
  column(classes, 'gym_class_series.publication_receipt', 'jsonb', true),
  column(classes, 'gym_class_announcements.request_id', 'uuid', true),
  constraint(classes, 'gym_classes.gym_class_series_gym_fk'),
  constraint(classes, 'gym_classes.gym_class_series_key_check'),
  requirement(classes, 'index', 'public.gym_class_series_occurrence', { valid: true, ready: true }),
  routine(classes, 'require_class_series_staff(p_gym_id uuid)'),
  routine(classes, 'class_series_instant(p_local timestamp without time zone, p_zone text)', false),
  routine(classes, 'publish_gym_class_series(p_gym_id uuid, p_draft jsonb, p_capacity integer, p_description text, p_coach_user_id uuid)'),
  routine(classes, 'subscribe_gym_class_series(p_series_id uuid, p_subscribed boolean)'),
  routine(classes, 'announce_gym_class_series(p_series_id uuid, p_audience text, p_body text, p_request_id uuid, p_class_id uuid, p_cancel_occurrence boolean)'),
  policy(classes, 'gym_class_series.class_series_member_read', 'r'),
  policy(classes, 'gym_class_series_subscriptions.class_series_own_subscription', 'r'),
  policy(classes, 'gym_class_announcements.class_announcement_read', 'r'),
  policy(classes, 'gym_class_announcement_recipients.class_announcement_recipient_read', 'r'),

  ...['platform_operator_role_profiles', 'platform_operator_role_profile_assignments',
    'platform_operator_accounts', 'platform_role_permissions', 'platform_permission_catalog',
    'platform_operator_permission_overrides'].map((name) => table(operators, name)),
  column(operators, 'platform_operator_role_profiles.permissions', 'jsonb', true),
  column(operators, 'platform_operator_role_profiles.version', 'integer', true),
  column(operators, 'platform_operator_role_profile_assignments.profile_id', 'uuid', true),
  routine(operators, 'platform_operator_profile_keys()', false),
  routine(operators, 'platform_operator_role_profiles_snapshot()'),
  routine(operators, 'platform_mutate_operator_role_profile(p_action text, p_profile_id uuid, p_expected_version integer, p_name text, p_description text, p_permissions jsonb, p_user_id uuid, p_expected_profile_id uuid, p_reason text)'),
  routine(operators, 'platform_operator_has_permission(_permission_key text, _viewer uuid)'),
  routine(operators, 'platform_mutate_operator_override_internal(p_user_id uuid, p_permission_key text, p_is_allowed boolean, p_reason text, p_clear boolean)', false),
  ...['platform_operator_accounts', 'platform_role_permissions', 'platform_permission_catalog',
    'platform_operator_permission_overrides'].flatMap((name) => [
    ['insert', 'a', { check: 'false' }],
    ['update', 'w', { using: 'false', check: 'false' }],
    ['delete', 'd', { using: 'false' }],
  ].map(([operation, command, fields]) => requirement(operators, 'policy',
    `public.${name}.operator_boundary_${operation}`,
    { command, permissive: false, roles: ['anon', 'authenticated'], ...fields }))),

  ...['workout_create_receipts', 'social_connections', 'social_interactions', 'workout_proof_media']
    .map((name) => table(workouts, name)),
  column(workouts, 'workout_create_receipts.user_id', 'uuid', true),
  column(workouts, 'workout_create_receipts.idempotency_key', 'uuid', true),
  column(workouts, 'workout_create_receipts.payload_hash', 'bytea', true),
  constraint(workouts, 'workout_create_receipts.workout_create_receipts_pkey'),
  routine(workouts, 'log_workout_atomic(p_workout jsonb, p_exercises jsonb)'),
  routine(workouts, 'log_workout_atomic_legacy(p_workout jsonb, p_exercises jsonb)'),
  routine(workouts, 'social_pair_unblocked(_first uuid, _second uuid)'),
  routine(workouts, 'can_view_workout(_owner uuid, _visibility public.workout_visibility, _gym_id uuid, _viewer uuid)'),
  policy(workouts, 'social_connections.social_connections_block_select', 'r', false),
  policy(workouts, 'social_connections.social_connections_block_insert', 'a', false),
  policy(workouts, 'social_connections.social_connections_block_update', 'w', false),
  policy(workouts, 'social_interactions.social_interactions_safe_update', 'w', false),
  policy(workouts, 'social_interactions.social_interactions_block_select', 'r', false),
  policy(workouts, 'workout_proof_media.workout_proof_media_safe_update', 'w', false),
];

export function preflight({ snapshot, payload, now = Date.now() } = {}) {
  const report = {
    formatVersion: 1, expectedProjectRef: PROJECT, releaseStatus: 'BLOCKED',
    scopedStatus: 'BLOCKED', schemaEquivalent: 'unproven', lineageGate: 'REQUIRED_NOT_EVALUATED',
    evidenceVerified: false, checks: [], blockers: [],
    releaseHolds: ['LINEAGE_GATE_REQUIRED', 'DEFINITION_ACL_AND_RUNTIME_REVIEW_REQUIRED',
      'ISOLATED_UPGRADE_EVIDENCE_REQUIRED'],
  };
  const block = (code) => { report.blockers.push({ scope: 'evidence', code }); return report; };
  if (!Number.isFinite(now)) return block('INVALID_CLOCK');
  if (!snapshot) return block('SNAPSHOT_REQUIRED');
  if (snapshot.projectRef !== PROJECT) return block('WRONG_TARGET');
  try { validateSnapshot(snapshot); } catch { return block('INVALID_SNAPSHOT'); }
  const captured = Date.parse(snapshot.captured_at);
  if (new Date(captured).toISOString() !== snapshot.captured_at) return block('INVALID_CAPTURE_TIME');
  if (now - captured > MAX_AGE_MS) return block('STALE_SNAPSHOT');
  if (captured - now > FUTURE_SKEW_MS) return block('FUTURE_SNAPSHOT');
  if (!['public', 'storage'].every((schema) => snapshot.scope.schemas.includes(schema))) {
    return block('INCOMPLETE_SCHEMA_SCOPE');
  }
  if (!(typeof payload === 'string' || Buffer.isBuffer(payload)) || !payload.length) return block('PAYLOAD_REQUIRED');
  try { verifyPayload(snapshot, payload); } catch { return block('PAYLOAD_MISMATCH'); }
  // probeObjects includes definitions and actual values. Never forward its results.
  let probes;
  try {
    if (snapshot.catalog_objects.some((o) => requirements.some((r) => r.kind === o.kind && r.identity === o.identity) &&
          (!o.definition || typeof o.definition !== 'object' || Array.isArray(o.definition)))) {
      return block('INVALID_REQUIRED_DEFINITION');
    }
    probes = probeObjects(snapshot, requirements);
  } catch { return block('INVALID_REQUIRED_DEFINITION'); }
  report.evidenceVerified = true;
  report.capturedAt = snapshot.captured_at;
  report.catalogSha256 = snapshot.catalog_sha256;
  report.checks = probes.map((probe, i) => {
    const { scope, kind, identity } = requirements[i];
    const code = !probe.matches.length ? 'MISSING_OBJECT' : probe.fieldDeltas.length
      ? 'SELECTED_FIELDS_CONFLICT' : 'MINIMUM_PRESENT';
    const check = { scope, kind, identity, code,
      conflictingFields: probe.fieldDeltas.map((delta) => delta.field) };
    if (code !== 'MINIMUM_PRESENT') report.blockers.push(check);
    return check;
  });
  report.scopedStatus = report.blockers.length ? 'BLOCKED' : 'MINIMUM_CATALOG_PRESENT';
  return report;
}

async function main(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--snapshot', '--payload'].includes(args[i]) || !args[i + 1] ||
        args[i + 1].startsWith('--') || Object.hasOwn(flags, args[i])) throw new Error('Invalid arguments');
    flags[args[i]] = args[i + 1];
  }
  if (!flags['--snapshot'] || !flags['--payload']) throw new Error('Missing evidence paths');
  const snapshot = JSON.parse(await readFile(resolve(flags['--snapshot']), 'utf8'));
  const payload = await readFile(resolve(flags['--payload']));
  process.stdout.write(`${JSON.stringify(preflight({ snapshot, payload }), null, 2)}\n`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // Parser and filesystem errors can contain untrusted input, paths or SQL.
    process.stderr.write('Preflight input error: provide readable JSON snapshot and matching payload via --snapshot FILE --payload FILE.\n');
    process.exitCode = 2;
  });
}
