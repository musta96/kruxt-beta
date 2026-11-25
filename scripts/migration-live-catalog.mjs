import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'hgomsmhsybrxjdxbgkjy';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
  );
  return value;
};
const stable = (value) => JSON.stringify(canonical(value));
const key = (object) => JSON.stringify([object.kind, object.identity]);

export function validateSnapshot(snapshot) {
  if (snapshot?.formatVersion !== 1 || snapshot.projectRef !== PROJECT ||
      snapshot.transaction_read_only !== 'on' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.captured_at ?? '') ||
      !Number.isFinite(Date.parse(snapshot.captured_at)) ||
      !/^[a-f0-9]{64}$/.test(snapshot.catalog_sha256 ?? '') ||
      !Array.isArray(snapshot.catalog_objects) || !snapshot.catalog_objects.length ||
      !Array.isArray(snapshot.scope?.schemas) || !snapshot.scope.schemas.length ||
      snapshot.scope.schemas.some((name) => typeof name !== 'string') ||
      new Set(snapshot.scope.schemas).size !== snapshot.scope.schemas.length) {
    throw new Error('Invalid catalog snapshot: project, read-only provenance, scope, or payload');
  }
  const keys = new Set();
  for (const object of snapshot.catalog_objects) {
    if (!object || typeof object.kind !== 'string' || !object.kind ||
        typeof object.identity !== 'string' || !object.identity ||
        !Object.hasOwn(object, 'definition')) throw new Error('Invalid catalog object');
    if (keys.has(key(object))) throw new Error(`Duplicate catalog object: ${key(object)}`);
    keys.add(key(object));
  }
  return snapshot;
}

export function summarize(snapshot) {
  validateSnapshot(snapshot);
  const objects = [...snapshot.catalog_objects].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  return {
    projectRef: snapshot.projectRef, capturedAt: snapshot.captured_at,
    serverVersion: snapshot.server_version, schemas: snapshot.scope.schemas,
    postgresJsonbSha256: snapshot.catalog_sha256,
    // This encoding is deliberately separate from PostgreSQL jsonb::text.
    canonicalObjectsSha256: sha(stable(objects)),
    counts: objects.reduce((counts, object) => {
      counts[object.kind] = (counts[object.kind] ?? 0) + 1;
      return counts;
    }, {}),
    objectCount: objects.length,
    equivalent: 'unproven',
  };
}

export function verifyPayload(snapshot, payload) {
  validateSnapshot(snapshot);
  // Evidence files have one framing LF, which is not part of jsonb::text.
  const text = payload.toString('utf8').replace(/\n$/, '');
  if (sha(text) !== snapshot.catalog_sha256) throw new Error('PostgreSQL payload SHA-256 mismatch');
  if (stable(JSON.parse(text)) !== stable(snapshot.catalog_objects)) {
    throw new Error('PostgreSQL payload objects differ from snapshot');
  }
  return { postgresPayloadSha256Verified: true, objectPayloadVerified: true };
}

export function compareSnapshots(before, after) {
  validateSnapshot(before);
  validateSnapshot(after);
  if (stable([...before.scope.schemas].sort()) !== stable([...after.scope.schemas].sort())) {
    throw new Error('Cannot compare different schema scopes');
  }
  const left = new Map(before.catalog_objects.map((o) => [key(o), o]));
  const right = new Map(after.catalog_objects.map((o) => [key(o), o]));
  const deltas = [];
  for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const a = left.get(id);
    const b = right.get(id);
    if (a && b && stable(a.definition) === stable(b.definition)) continue;
    const fields = a && b && a.definition && b.definition &&
      !Array.isArray(a.definition) && !Array.isArray(b.definition) &&
      typeof a.definition === 'object' && typeof b.definition === 'object'
      ? [...new Set([...Object.keys(a.definition), ...Object.keys(b.definition)])]
        .sort().filter((field) => stable(a.definition[field]) !== stable(b.definition[field]))
      : ['definition'];
    deltas.push({ kind: (a ?? b).kind, identity: (a ?? b).identity,
      disposition: !a ? 'added' : !b ? 'removed' : 'changed', fields,
      before: a?.definition ?? null, after: b?.definition ?? null });
  }
  return { before: summarize(before), after: summarize(after), deltas,
    catalogPayloadEqual: deltas.length === 0, schemaEquivalent: 'unproven',
    limitations: ['Catalog equality is not a restorable dump or upgrade proof.',
      'ACL and policy role arrays are compared exactly; no automatic equivalence waivers.'] };
}

export function probeObjects(snapshot, probes) {
  validateSnapshot(snapshot);
  return probes.map((probe) => {
    const matches = snapshot.catalog_objects.filter((o) => o.kind === probe.kind &&
      (probe.routineName ? o.identity.startsWith(`${probe.routineName}(`) : o.identity === probe.identity));
    const fieldDeltas = matches.flatMap((object) => Object.entries(probe.expectedFields ?? {})
      .filter(([field, expected]) => stable(object.definition[field]) !== stable(expected))
      .map(([field, expected]) => ({ identity: object.identity, field, expected,
        actual: object.definition[field] })));
    const textObservations = matches.flatMap((object) => (probe.expectedSqlFragments ?? [])
      .map((fragment) => ({ identity: object.identity, fragment,
        present: object.definition.sql?.includes(fragment) ?? false })));
    return { ...probe, disposition: !matches.length ? 'absent' : fieldDeltas.length
      ? 'conflicting-selected-fields' : 'present-definition-review-required',
      equivalence: 'unproven', fieldDeltas, textObservations, matches };
  });
}

const relation = (identity) => ({ kind: 'relation', identity });
const column = (identity) => ({ kind: 'column', identity });
const routine = (name) => ({ kind: 'routine', routineName: `public.${name}` });
const policy = (identity) => ({ kind: 'policy', identity });
const trigger = (identity) => ({ kind: 'trigger', identity });
const constraint = (identity) => ({ kind: 'constraint', identity });

// Curated named probes, not a SQL parser or an exhaustive interpretation of DDL.
export const candidateProbes = [
  ['supabase/migrations/20260227161500_1f4e1d74-43e4-43f4-b0af-4ad97be958cb.sql', [
    relation('public.gym_staff_invites'), ...['select', 'insert', 'update', 'delete']
      .map((command) => policy(`public.gym_staff_invites.gym_staff_invites_${command}`)),
  ]],
  ['supabase/migrations/20260309193000_workout_proof_media.sql', [
    relation('public.workout_proof_media'), routine('can_view_workout_proof_media'),
    policy('public.workout_proof_media.workout_proof_media_update_owner'),
    policy('storage.objects.workout_proof_media_select_visible'),
    trigger('public.workout_proof_media.trg_workout_proof_media_set_updated_at'),
  ]],
  ['supabase/migrations/20260310113000_user_workout_templates.sql', [
    relation('public.user_workout_templates'),
    policy('public.user_workout_templates.user_workout_templates_select_owner'),
  ]],
  ['packages/db/supabase/migrations/20260531084228_gym_staff_enforcement_and_entitlement_templates.sql', [
    relation('public.gym_member_access_verifications'), routine('gym_staff_can'),
    routine('gym_has_member_access_verification'), routine('gym_actor_has_mfa'),
    relation('public.platform_entitlement_templates'),
  ]],
  ['packages/db/supabase/migrations/20260531135106_custom_gym_roles_permission_mutations.sql', [
    relation('public.gym_custom_roles'), relation('public.gym_custom_role_permissions'),
    relation('public.gym_custom_role_assignments'), routine('user_has_gym_permission'),
    routine('create_gym_custom_role'), routine('set_gym_custom_role_permission'),
  ]],
  ['packages/db/supabase/migrations/20260531160000_workout_proof_media.sql', [
    ...['url', 'type', 'thumbnail_url'].map((name) => column(`public.workouts.proof_media_${name}`)),
    policy('storage.objects.workout_proof_public_read'),
    policy('storage.objects.workout_proof_owner_update'),
  ]],
  ['packages/db/supabase/migrations/20260601080347_admin_ops_summary_platform_operator_access.sql', [
    { ...routine('admin_get_gym_ops_summary'), expectedSqlFragments: ['platform.gyms.manage', 'platform.tenants.impersonate'] },
  ]],
  ['packages/db/supabase/migrations/202606120001_bulk_member_access_mutations.sql', [
    routine('bulk_update_gym_memberships'), policy('public.gym_memberships.gym_memberships_update_self_or_staff'),
  ]],
  ['packages/db/supabase/migrations/202608030001_guard_bzone_demo_seed.sql', [
    routine('demo_seed_is_enabled'),
    { ...routine('seed_bzone_demo_people'), expectedSqlFragments: ['demo_seed_is_enabled'] },
  ]],
  ['packages/db/supabase/migrations/202608030002_atomic_class_booking_waitlist.sql', [
    routine('book_gym_class'), routine('join_waitlist'), routine('promote_waitlist_member'),
    routine('enforce_class_waitlist_position'), routine('enforce_class_booking_capacity'),
    policy('public.class_bookings.class_bookings_insert_staff_only'),
  ]],
  ['packages/db/supabase/migrations/202608030003_harden_class_cancellation_promotion.sql', [
    routine('cancel_gym_class_booking'), routine('leave_class_waitlist'),
    policy('public.class_bookings.class_bookings_update_staff_only'),
    policy('public.class_waitlist.class_waitlist_update_staff_only'),
  ]],
  ['packages/db/supabase/migrations/202608030004_consent_activation_hardening.sql', [
    routine('policy_version_has_content_binding'), routine('validate_policy_content_binding'),
    routine('publish_policy_version'), routine('record_user_consent'),
    routine('enforce_self_membership_access_prerequisites'), routine('enforce_workout_required_consents'),
    trigger('public.policy_version_tracking.trg_policy_version_content_binding'),
    trigger('public.workouts.trg_workouts_require_consents'),
  ]],
  ['packages/db/supabase/migrations/202608030005_mobile_onboarding_contract.sql', [
    column('public.profiles.mobile_onboarding_completed_at'), routine('capture_mobile_onboarding_consents'),
    routine('get_mobile_onboarding_state'), routine('complete_mobile_onboarding'),
  ]],
  ['packages/db/supabase/migrations/202608030006_harden_class_lifecycle.sql', [
    routine('enforce_gym_class_lifecycle'), routine('cascade_terminal_class_state'),
    routine('cancel_gym_class'), routine('lock_staff_class'), routine('update_gym_class_by_staff'),
    routine('upsert_class_booking_by_staff'), routine('update_class_waitlist_by_staff'),
    constraint('public.gym_classes.gym_classes_scheduled_booking_window_check'),
    trigger('public.gym_classes.trg_gym_classes_enforce_lifecycle'),
    trigger('public.gym_classes.trg_gym_classes_cascade_terminal_state'),
  ]],
  ['packages/db/supabase/migrations/20261019140050_privacy_state_authorization.sql', [
    routine('guard_privacy_request_state'),
  ]],
  ['packages/db/supabase/migrations/20261020233833_privacy_export_inventory_and_defaults.sql', [
    { ...column('public.profiles.is_public'), expectedFields: { default: 'false' } },
    { ...column('public.workouts.visibility'), expectedFields: { default: "'private'::public.workout_visibility" } },
    { ...routine('log_workout_atomic'), expectedSqlFragments: ['log_workout_atomic_legacy'] },
    routine('log_workout_atomic_legacy'), routine('build_privacy_export_payload'),
    routine('build_privacy_export_payload_legacy'), policy('storage.objects.privacy_export_owner_select'),
  ]],
  ['packages/db/supabase/migrations/20261021154255_privacy_erasure_account_disablement.sql', [
    { ...routine('apply_user_anonymization'), expectedSqlFragments: ['profile_disabled'] },
    routine('apply_user_anonymization_legacy'),
  ]],
  ['packages/db/supabase/migrations/20261023075329_platform_operator_write_boundaries.sql', [
    routine('platform_operator_has_permission'), routine('platform_mutate_operator_override_internal'),
    ...['platform_operator_accounts', 'platform_role_permissions', 'platform_permission_catalog',
      'platform_operator_permission_overrides'].flatMap((table) => ['insert', 'update', 'delete']
      .map((command) => policy(`public.${table}.operator_boundary_${command}`))),
  ]],
  ['packages/db/supabase/migrations/20261023081440_workout_retry_and_social_boundaries.sql', [
    relation('public.workout_create_receipts'), routine('social_pair_unblocked'),
    policy('public.social_connections.social_connections_block_select'),
    policy('public.social_interactions.social_interactions_safe_update'),
    policy('public.workout_proof_media.workout_proof_media_safe_update'),
  ]],
  ['packages/db/supabase/migrations/20261023081448_custom_operator_role_profiles.sql', [
    relation('public.platform_operator_role_profiles'), relation('public.platform_operator_role_profile_assignments'),
    routine('platform_operator_profile_keys'), routine('platform_operator_role_profiles_snapshot'),
    routine('platform_mutate_operator_role_profile'),
  ]],
];

export async function auditCandidates(root, snapshot) {
  validateSnapshot(snapshot);
  const inventory = [];
  const sources = new Map();
  for (const directory of ['supabase/migrations', 'packages/db/supabase/migrations']) {
    for (const entry of (await readdir(resolve(root, directory), { withFileTypes: true }))
      .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (!entry.isFile() || !entry.name.endsWith('.sql')) throw new Error(`Unexpected migration entry: ${entry.name}`);
      const path = `${directory}/${entry.name}`;
      const bytes = await readFile(resolve(root, path));
      sources.set(path, bytes.toString('utf8'));
      inventory.push({ path, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  for (const [path, probes] of candidateProbes) {
    const sql = sources.get(path);
    if (sql === undefined) throw new Error(`Missing candidate source: ${path}`);
    for (const probe of probes) {
      for (const fragment of probe.expectedSqlFragments ?? []) {
        if (!sql.includes(fragment)) throw new Error(`Stale source fragment probe in ${path}`);
      }
    }
  }
  const candidates = candidateProbes.map(([path, probes]) => ({
    ...inventory.find((file) => file.path === path), path,
    probes: probeObjects(snapshot, probes), equivalence: 'unproven',
  }));
  if (candidates.some((file) => !file.sha256)) throw new Error('Missing candidate source');
  return { generatedAt: new Date().toISOString(), snapshot: summarize(snapshot), inventory, candidates, releaseStatus: 'BLOCKED',
    limitations: ['Curated named-object probes only, not exhaustive DDL or semantic comparison.',
      'No seeds, routines, migrations, schema restore, or SQL are executed.',
      'All overloads are reported; routine name presence proves neither signature nor body equivalence.',
      'New parent-owned class migration is inventoried but deliberately not interpreted.',
      'Restricted output includes routine bodies and grants; keep mode 0600.'] };
}

async function main(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--snapshot', '--payload', '--before', '--after', '--root'].includes(args[i]) ||
        !args[i + 1] || args[i + 1].startsWith('--') || flags[args[i]]) throw new Error('Invalid arguments');
    flags[args[i]] = args[i + 1];
  }
  const load = async (path) => validateSnapshot(JSON.parse(await readFile(resolve(path), 'utf8')));
  let report;
  let status = 0;
  if (flags['--before'] && flags['--after'] && !flags['--snapshot'] && !flags['--root'] && !flags['--payload']) {
    report = compareSnapshots(await load(flags['--before']), await load(flags['--after']));
    status = report.catalogPayloadEqual ? 0 : 1;
  } else if (flags['--snapshot'] && !flags['--before'] && !flags['--after']) {
    const snapshot = await load(flags['--snapshot']);
    report = flags['--root'] ? await auditCandidates(resolve(flags['--root']), snapshot) : summarize(snapshot);
    if (flags['--payload']) report.integrity = verifyPayload(snapshot, await readFile(resolve(flags['--payload'])));
    status = flags['--root'] ? 1 : 0;
  } else throw new Error('Use --snapshot FILE [--payload FILE] [--root DIR], or --before FILE --after FILE');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}
