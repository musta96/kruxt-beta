#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const BZONE_DEMO_USERS = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    email: "demo.owner+bzone@kruxt.test"
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    email: "demo.pt+bzone@kruxt.test"
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    email: "demo.member.active+bzone@kruxt.test"
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    email: "demo.member.pending+bzone@kruxt.test"
  }
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BZONE_EMAIL_PATTERN = /^demo\.[^@]+\+bzone@kruxt\.test$/i;
const TEST_EMAIL_PATTERN = /@[^@]+\.test$/i;
const BZONE_PLAN_NAMES = new Set([
  "Action Light",
  "Action Medium",
  "Action Top",
  "Fit",
  "Perfect",
  "University",
  "DodiciSedici",
  "Spartan F.T.",
  "Free Card 2 Corsi",
  "One Drop-in"
]);
const BZONE_CLASS_TITLES = new Set([
  "Pilates Mattina",
  "Functional Training",
  "Tone UP",
  "ABS Stretch",
  "G.A.G.",
  "Pilates",
  "The Circuit Lunch",
  "Strong Cardio",
  "The Circuit",
  "Spartan Functional Training",
  "Tone UP Mattina"
]);
const STORAGE_SCOPES = [
  { bucket: "workout-proof", prefixes: (userId) => [`${userId}/`] },
  { bucket: "workout-proof-media", prefixes: (userId) => [`${userId}/`] },
  {
    bucket: "profile-avatars",
    prefixes: (userId) => [`${userId}/`, `users/${userId}/`]
  },
  { bucket: "privacy-exports", prefixes: (userId) => [`${userId}/`] }
];

const DEFAULTS = {
  mode: "dry-run",
  outputFile: "demo-data-purge-report.json",
  quarantineGymIds: [],
  confirm: null
};

function requireValue(argument, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${argument} requires a value`);
  }
  return value;
}

export function parseArgs(argv) {
  const config = { ...DEFAULTS, quarantineGymIds: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--mode") {
      config.mode = requireValue(argument, value);
      index += 1;
    } else if (argument === "--output-file") {
      config.outputFile = requireValue(argument, value);
      index += 1;
    } else if (argument === "--quarantine-gym-id") {
      const gymId = requireValue(argument, value);
      if (!UUID_PATTERN.test(gymId)) {
        throw new Error(`Invalid gym UUID: ${gymId}`);
      }
      config.quarantineGymIds.push(gymId.toLowerCase());
      index += 1;
    } else if (argument === "--confirm") {
      config.confirm = requireValue(argument, value);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      config.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!["dry-run", "apply"].includes(config.mode)) {
    throw new Error("--mode must be dry-run or apply");
  }
  config.quarantineGymIds = [...new Set(config.quarantineGymIds)];
  return config;
}

export function validateSupabaseUrl(supabaseUrl, expectedProjectRef) {
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("KRUXT_SUPABASE_URL must be a valid URL");
  }

  if (!/^[a-z0-9]{10,40}$/.test(expectedProjectRef ?? "")) {
    throw new Error("KRUXT_SUPABASE_PROJECT_REF must be an explicit Supabase project ref");
  }
  const expectedHostname = `${expectedProjectRef}.supabase.co`;
  if (url.protocol !== "https:" || url.hostname !== expectedHostname) {
    throw new Error(`Refusing unexpected Supabase host; expected ${expectedHostname}`);
  }
  return url.origin;
}

export function requiredConfirmation(projectRef) {
  return `PURGE_BZONE_DEMO_FROM_${projectRef}`;
}

export function validateApplyConfirmation(config, projectRef) {
  if (config.mode !== "apply") return;
  const expected = requiredConfirmation(projectRef);
  if (config.confirm !== expected) {
    throw new Error(`Apply mode requires --confirm ${expected}`);
  }
}

function hasDemoMetadata(user) {
  return (
    user?.app_metadata?.demo_persona === true ||
    user?.raw_app_meta_data?.demo_persona === true ||
    user?.user_metadata?.demo_persona === true ||
    user?.raw_user_meta_data?.demo_persona === true
  );
}

export function classifyAuthUser(user) {
  const expected = BZONE_DEMO_USERS.find((entry) => entry.id === user?.id);
  const email = String(user?.email ?? "").toLowerCase();
  const markers = {
    knownId: Boolean(expected),
    expectedEmail: Boolean(expected && email === expected.email),
    bzoneEmail: BZONE_EMAIL_PATTERN.test(email),
    demoMetadata: hasDemoMetadata(user),
    testEmail: TEST_EMAIL_PATTERN.test(email)
  };
  const verified =
    markers.knownId &&
    markers.expectedEmail &&
    markers.bzoneEmail &&
    markers.demoMetadata;
  const suspicious = !verified && (
    markers.knownId || markers.bzoneEmail || markers.demoMetadata
  );
  return { verified, suspicious, markers };
}

export function buildPrivilegedHeaders(apiKey, extra = {}) {
  const isSecretKey = apiKey.startsWith("sb_secret_");
  const isLegacyServiceRoleJwt = apiKey.split(".").length === 3;
  if (!isSecretKey && !isLegacyServiceRoleJwt) {
    throw new Error("KRUXT Supabase key must be an sb_secret key or legacy service_role JWT");
  }
  return {
    apikey: apiKey,
    ...(isLegacyServiceRoleJwt ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...extra
  };
}

export class SupabaseAdminClient {
  constructor(supabaseUrl, privilegedKey, fetchImpl = fetch) {
    this.supabaseUrl = supabaseUrl.replace(/\/+$/, "");
    this.privilegedKey = privilegedKey;
    this.fetchImpl = fetchImpl;
  }

  headers(extra = {}) {
    return buildPrivilegedHeaders(this.privilegedKey, extra);
  }

  async requestJson(url, init = {}) {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async listAuthUsers() {
    const users = [];
    for (let page = 1; ; page += 1) {
      const url = new URL(`${this.supabaseUrl}/auth/v1/admin/users`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", "1000");
      const payload = await this.requestJson(url, { headers: this.headers() });
      const pageUsers = Array.isArray(payload) ? payload : payload?.users ?? [];
      users.push(...pageUsers);
      if (pageUsers.length < 1000) break;
    }
    return users;
  }

  async select(table, { select = "*", filters = {}, limit = 5000 } = {}) {
    const url = new URL(`${this.supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(limit));
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(key, value);
    }
    return this.requestJson(url, { headers: this.headers() });
  }

  async deleteAuthUser(userId) {
    const url = new URL(`${this.supabaseUrl}/auth/v1/admin/users/${userId}`);
    url.searchParams.set("should_soft_delete", "false");
    await this.requestJson(url, { method: "DELETE", headers: this.headers() });
  }

  async quarantineGym(gymId) {
    const url = new URL(`${this.supabaseUrl}/rest/v1/gyms`);
    url.searchParams.set("id", `eq.${gymId}`);
    const rows = await this.requestJson(url, {
      method: "PATCH",
      headers: this.headers({
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }),
      body: JSON.stringify({ is_public: false })
    });
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error(`Expected one gym to quarantine, received ${rows?.length ?? 0}`);
    }
  }

  async listStorageObjects(bucket, prefix) {
    const objects = [];
    for (let offset = 0; ; offset += 1000) {
      const url = `${this.supabaseUrl}/storage/v1/object/list/${bucket}`;
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prefix,
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" }
        })
      });
      if ([400, 404].includes(response.status)) {
        const message = await response.text();
        if (/bucket.*not found/i.test(message)) return [];
        throw new Error(`Storage list failed (${response.status}): ${message}`);
      }
      if (!response.ok) {
        throw new Error(`Storage list failed (${response.status}): ${await response.text()}`);
      }
      const page = await response.json();
      objects.push(...page.map((object) => ({
        bucket,
        path: `${prefix}${object.name}`
      })));
      if (page.length < 1000) break;
    }
    return objects;
  }

  async removeStorageObjects(bucket, paths) {
    if (paths.length === 0) return;
    const url = `${this.supabaseUrl}/storage/v1/object/${bucket}`;
    await this.requestJson(url, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: paths })
    });
  }
}

function inFilter(ids) {
  return `in.(${ids.join(",")})`;
}

function uniqueRows(rows) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function selectByIds(client, table, column, ids, select) {
  if (ids.length === 0) return [];
  const rows = [];
  for (let start = 0; start < ids.length; start += 100) {
    rows.push(...await client.select(table, {
      select,
      filters: { [column]: inFilter(ids.slice(start, start + 100)) }
    }));
  }
  return rows;
}

function collectGymIds(rowsByTable) {
  const ids = new Set();
  for (const rows of Object.values(rowsByTable)) {
    for (const row of rows) {
      if (row.gym_id) ids.add(row.gym_id);
      if (row.home_gym_id) ids.add(row.home_gym_id);
    }
  }
  return [...ids];
}

function summarizeLinkedRows(rowsByTable) {
  return Object.fromEntries(
    Object.entries(rowsByTable).map(([key, rows]) => [key, rows.length])
  );
}

export function qualifyBzoneGym(gym, evidence = {}) {
  const brand = evidence.brand ?? null;
  const bzoneIdentity =
    String(gym?.slug ?? "").toLowerCase().startsWith("bzone") ||
    String(gym?.name ?? "").toLowerCase().startsWith("bzone");
  const brandIdentity =
    String(brand?.app_display_name ?? "").toLowerCase() === "bzone fitness" &&
    String(brand?.support_email ?? "").toLowerCase() === "info@bzonefitness.it";
  const linkedToTestData = Boolean(evidence.linkedToTestData);
  return {
    bzoneIdentity,
    brandIdentity,
    linkedToTestData,
    canQuarantine: (bzoneIdentity && brandIdentity) || (linkedToTestData && (bzoneIdentity || brandIdentity))
  };
}

async function collectStorageObjects(client, userIds) {
  const objects = [];
  for (const userId of userIds) {
    for (const scope of STORAGE_SCOPES) {
      for (const prefix of scope.prefixes(userId)) {
        const scopedObjects = await client.listStorageObjects(scope.bucket, prefix);
        objects.push(...scopedObjects.map((object) => ({ ...object, userId })));
      }
    }
  }
  return uniqueRows(objects.map((object) => ({
    ...object,
    id: `${object.bucket}:${object.path}`
  }))).map(({ id: _id, ...object }) => object);
}

function buildGymEvidence(gym, gymRows, testGymIds) {
  const brand = gymRows.brands.find((row) => row.gym_id === gym.id) ?? null;
  const plans = gymRows.membershipPlans.filter((row) => row.gym_id === gym.id);
  const classes = gymRows.classes.filter((row) => row.gym_id === gym.id);
  const waivers = gymRows.waivers.filter((row) => row.gym_id === gym.id);
  const features = gymRows.featureSettings.filter((row) => row.gym_id === gym.id);
  const qualification = qualifyBzoneGym(gym, {
    brand,
    linkedToTestData: testGymIds.has(gym.id)
  });

  return {
    id: gym.id,
    slug: gym.slug,
    name: gym.name,
    isPublic: gym.is_public,
    ownerUserId: gym.owner_user_id,
    qualification,
    signatures: {
      bzonePlanRows: plans.filter((row) => BZONE_PLAN_NAMES.has(row.name)).length,
      bzoneClassRows: classes.filter((row) => BZONE_CLASS_TITLES.has(row.title)).length,
      bzoneWaiverRows: waivers.filter(
        (row) => row.title === "Liberatoria salute e responsabilita" && row.policy_version === "v1.0"
      ).length,
      bzoneBillingRows: features.filter(
        (row) => row.feature_key === "manual_billing" && row.note === "BZone demo manual payment instructions"
      ).length
    }
  };
}

export async function auditDemoData(client) {
  const authUsers = await client.listAuthUsers();
  const classified = authUsers.map((user) => ({ user, ...classifyAuthUser(user) }));
  const verifiedUsers = classified.filter((entry) => entry.verified).map((entry) => entry.user);
  const suspiciousUsers = classified.filter((entry) => entry.suspicious).map((entry) => ({
    id: entry.user.id,
    email: entry.user.email ?? null,
    markers: entry.markers
  }));
  const testUsers = classified.filter((entry) => entry.markers.testEmail).map((entry) => entry.user);
  const auditUserIds = [...new Set([
    ...BZONE_DEMO_USERS.map((entry) => entry.id),
    ...testUsers.map((user) => user.id)
  ])];

  const [
    profiles,
    memberships,
    joinRequests,
    shifts,
    memberPlans,
    coachedPlans,
    workouts,
    feedEvents,
    classBookings,
    classWaitlist,
    classAssignments,
    socialInteractions,
    ownedGyms,
    publicGyms,
    storageObjects
  ] = await Promise.all([
    selectByIds(client, "profiles", "id", auditUserIds, "id,username,display_name,home_gym_id,is_public"),
    selectByIds(client, "gym_memberships", "user_id", auditUserIds, "id,gym_id,user_id,role,membership_status"),
    selectByIds(client, "gym_join_requests", "user_id", auditUserIds, "id,gym_id,user_id,status,source"),
    selectByIds(client, "staff_shifts", "staff_user_id", auditUserIds, "id,gym_id,staff_user_id,metadata"),
    selectByIds(client, "gym_member_workout_plans", "member_user_id", auditUserIds, "id,gym_id,member_user_id,coach_user_id,title,status"),
    selectByIds(client, "gym_member_workout_plans", "coach_user_id", auditUserIds, "id,gym_id,member_user_id,coach_user_id,title,status"),
    selectByIds(client, "workouts", "user_id", auditUserIds, "id,gym_id,user_id,visibility,created_at"),
    selectByIds(client, "feed_events", "user_id", auditUserIds, "id,user_id,workout_id,event_type,created_at"),
    selectByIds(client, "class_bookings", "user_id", auditUserIds, "id,user_id,class_id,status"),
    selectByIds(client, "class_waitlist", "user_id", auditUserIds, "id,user_id,class_id,status"),
    selectByIds(client, "gym_classes", "coach_user_id", auditUserIds, "id,gym_id,coach_user_id,title,status,starts_at"),
    selectByIds(client, "social_interactions", "actor_user_id", auditUserIds, "id,actor_user_id,workout_id,interaction_type"),
    selectByIds(client, "gyms", "owner_user_id", auditUserIds, "id,slug,name,is_public,owner_user_id"),
    client.select("gyms", {
      select: "id,slug,name,is_public,owner_user_id",
      filters: { is_public: "eq.true" }
    }),
    collectStorageObjects(client, auditUserIds)
  ]);

  const rowsByTable = {
    profiles,
    memberships,
    joinRequests,
    staffShifts: shifts,
    workoutPlans: uniqueRows([...memberPlans, ...coachedPlans]),
    workouts,
    feedEvents,
    classBookings,
    classWaitlist,
    classAssignments,
    socialInteractions,
    ownedGyms
  };
  const testGymIds = new Set([
    ...collectGymIds(rowsByTable),
    ...ownedGyms.map((gym) => gym.id)
  ]);
  const publicBzoneIds = publicGyms
    .filter(
      (gym) =>
        String(gym.slug).toLowerCase().startsWith("bzone") ||
        String(gym.name).toLowerCase().startsWith("bzone")
    )
    .map((gym) => gym.id);
  const candidateGymIds = [...new Set([...testGymIds, ...publicBzoneIds])];

  const [gyms, brands, membershipPlans, classes, waivers, featureSettings] = await Promise.all([
    selectByIds(client, "gyms", "id", candidateGymIds, "id,slug,name,is_public,owner_user_id"),
    selectByIds(client, "gym_brand_settings", "gym_id", candidateGymIds, "gym_id,app_display_name,support_email,metadata"),
    selectByIds(client, "gym_membership_plans", "gym_id", candidateGymIds, "id,gym_id,name,is_active"),
    selectByIds(client, "gym_classes", "gym_id", candidateGymIds, "id,gym_id,title,status,coach_user_id,starts_at"),
    selectByIds(client, "waivers", "gym_id", candidateGymIds, "id,gym_id,title,policy_version,is_active"),
    selectByIds(client, "gym_feature_settings", "gym_id", candidateGymIds, "id,gym_id,feature_key,enabled,note")
  ]);
  const gymRows = { brands, membershipPlans, classes, waivers, featureSettings };
  const candidateGyms = gyms.map((gym) => buildGymEvidence(gym, gymRows, testGymIds));
  const visibleCandidateGyms = candidateGyms.filter(
    (gym) => gym.isPublic && gym.qualification.canQuarantine
  );

  const otherTestUsers = testUsers.filter(
    (user) => !verifiedUsers.some((verified) => verified.id === user.id)
  );
  const linkedCounts = summarizeLinkedRows(rowsByTable);
  const linkedRowTotal = Object.values(linkedCounts).reduce((total, count) => total + count, 0);

  return {
    auth: {
      verifiedBzoneDemoUsers: verifiedUsers.map(({ id, email }) => ({ id, email })),
      suspiciousDemoMarkers: suspiciousUsers,
      otherTestUsers: otherTestUsers.map(({ id, email }) => ({ id, email }))
    },
    linkedRows: linkedCounts,
    visibility: {
      publicGymCount: publicGyms.length,
      publicGyms: publicGyms.map(({ id, slug, name }) => ({ id, slug, name })),
      visibleBzoneDemoCandidates: visibleCandidateGyms.map(({ id, slug, name }) => ({ id, slug, name }))
    },
    storage: {
      objectCount: storageObjects.length,
      objects: storageObjects
    },
    ownership: {
      testOwnedGyms: ownedGyms
    },
    candidateGyms,
    readyForRealTesting:
      testUsers.length === 0 &&
      suspiciousUsers.length === 0 &&
      linkedRowTotal === 0 &&
      storageObjects.length === 0 &&
      visibleCandidateGyms.length === 0
  };
}

export async function applyPurge(client, audit, config) {
  if (audit.auth.suspiciousDemoMarkers.length > 0) {
    throw new Error("Refusing apply while ambiguous BZone demo markers require manual review");
  }

  const verifiedUserIds = new Set(
    audit.auth.verifiedBzoneDemoUsers.map((user) => user.id)
  );
  const verifiedOwnedGyms = (audit.ownership?.testOwnedGyms ?? []).filter((gym) =>
    verifiedUserIds.has(gym.owner_user_id)
  );
  if (verifiedOwnedGyms.length > 0) {
    throw new Error(
      "Refusing apply because a verified demo user owns a gym; transfer or remove that gym first"
    );
  }

  const candidateById = new Map(audit.candidateGyms.map((gym) => [gym.id, gym]));
  for (const gymId of config.quarantineGymIds) {
    const candidate = candidateById.get(gymId);
    if (!candidate?.qualification.canQuarantine) {
      throw new Error(`Refusing to quarantine unverified BZone demo gym: ${gymId}`);
    }
  }

  for (const gymId of config.quarantineGymIds) {
    await client.quarantineGym(gymId);
  }
  const storageByBucket = new Map();
  for (const object of audit.storage?.objects ?? []) {
    if (!verifiedUserIds.has(object.userId)) continue;
    const paths = storageByBucket.get(object.bucket) ?? [];
    paths.push(object.path);
    storageByBucket.set(object.bucket, paths);
  }
  for (const [bucket, paths] of storageByBucket) {
    await client.removeStorageObjects(bucket, paths);
  }
  for (const user of audit.auth.verifiedBzoneDemoUsers) {
    await client.deleteAuthUser(user.id);
  }
}

function printHelp() {
  console.log(`Audit and purge KRUXT demo/test data.

Usage:
  node packages/db/scripts/purge-demo-data.mjs [options]

Options:
  --mode dry-run|apply          Default: dry-run
  --quarantine-gym-id UUID     Reversibly hide one verified demo gym; repeatable
  --confirm TOKEN              Required only for apply mode
  --output-file path           Default: demo-data-purge-report.json

Required environment:
  KRUXT_SUPABASE_URL
  KRUXT_SUPABASE_PROJECT_REF
  KRUXT_SUPABASE_SECRET_KEY (preferred) or
  KRUXT_SUPABASE_SERVICE_ROLE_KEY (legacy JWT)

Apply confirmation:
  PURGE_BZONE_DEMO_FROM_<project-ref>`);
}

export async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) {
    printHelp();
    return;
  }

  const projectRef = process.env.KRUXT_SUPABASE_PROJECT_REF;
  const supabaseUrl = process.env.KRUXT_SUPABASE_URL;
  const privilegedKey =
    process.env.KRUXT_SUPABASE_SECRET_KEY ??
    process.env.KRUXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!projectRef || !supabaseUrl || !privilegedKey) {
    throw new Error("KRUXT Supabase URL, project ref, and secret/service-role key are required");
  }

  const origin = validateSupabaseUrl(supabaseUrl, projectRef);
  validateApplyConfirmation(config, projectRef);
  const client = new SupabaseAdminClient(origin, privilegedKey);
  const before = await auditDemoData(client);

  if (config.mode === "apply") {
    await applyPurge(client, before, config);
  }

  const after = config.mode === "apply" ? await auditDemoData(client) : null;
  const report = {
    generatedAt: new Date().toISOString(),
    supabaseOrigin: origin,
    mode: config.mode,
    quarantineGymIds: config.quarantineGymIds,
    before,
    after
  };
  await writeFile(config.outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report written to ${config.outputFile}`);
  console.log(`Ready for real testing: ${(after ?? before).readyForRealTesting ? "yes" : "no"}`);
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
