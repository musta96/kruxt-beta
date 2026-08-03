#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
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
export const STORAGE_DELETE_BATCH_SIZE = 100;
const MAX_STORAGE_DEPTH = 20;
const MAX_STORAGE_OBJECTS_PER_SCOPE = 10_000;
const REPORT_SCHEMA_VERSION = 2;

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
  return user?.app_metadata?.demo_persona === true;
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

  async getAuthUser(userId) {
    const url = `${this.supabaseUrl}/auth/v1/admin/users/${userId}`;
    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
    }
    const payload = await response.json();
    return payload?.user ?? payload;
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

  async listStorageEntries(bucket, prefix) {
    const entries = [];
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
      entries.push(...page);
      if (page.length < 1000) break;
    }
    return entries;
  }

  async removeStorageObjects(bucket, paths) {
    if (paths.length === 0) return;
    if (paths.length > STORAGE_DELETE_BATCH_SIZE) {
      throw new Error(
        `Storage deletion exceeds ${STORAGE_DELETE_BATCH_SIZE}-object safety limit`
      );
    }
    if (paths.some((path) => typeof path !== "string" || path.length === 0 || path.endsWith("/"))) {
      throw new Error("Storage deletion requires exact object paths, not folder prefixes");
    }
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

function isStorageFolder(entry) {
  return entry?.id == null && entry?.metadata == null;
}

export async function enumerateStorageObjects(
  client,
  bucket,
  rootPrefix,
  {
    maxDepth = MAX_STORAGE_DEPTH,
    maxObjects = MAX_STORAGE_OBJECTS_PER_SCOPE
  } = {}
) {
  const objects = [];
  const pending = [{ prefix: rootPrefix, depth: 0 }];
  const visitedPrefixes = new Set();

  while (pending.length > 0) {
    const { prefix, depth } = pending.pop();
    if (visitedPrefixes.has(prefix)) continue;
    visitedPrefixes.add(prefix);

    const entries = await client.listStorageEntries(bucket, prefix);
    for (const entry of entries) {
      const name = String(entry?.name ?? "");
      if (!name || name === "." || name === ".." || name.includes("/")) {
        throw new Error(`Storage listing returned an unsafe child name in ${bucket}:${prefix}`);
      }
      const path = `${prefix}${name}`;
      if (isStorageFolder(entry)) {
        if (depth >= maxDepth) {
          throw new Error(`Storage traversal exceeded depth ${maxDepth} in ${bucket}:${rootPrefix}`);
        }
        pending.push({ prefix: `${path}/`, depth: depth + 1 });
        continue;
      }

      objects.push({ bucket, path });
      if (objects.length > maxObjects) {
        throw new Error(
          `Storage traversal exceeded ${maxObjects} objects in ${bucket}:${rootPrefix}`
        );
      }
    }
  }

  return objects.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectStorageObjects(client, userIds) {
  const objects = [];
  for (const userId of userIds) {
    for (const scope of STORAGE_SCOPES) {
      for (const prefix of scope.prefixes(userId)) {
        const scopedObjects = await enumerateStorageObjects(client, scope.bucket, prefix);
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

export function chunkItems(items, size = STORAGE_DELETE_BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Chunk size must be a positive integer");
  }
  const chunks = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

function operationId(type, target) {
  const digest = createHash("sha256")
    .update(`${type}:${JSON.stringify(target)}`)
    .digest("hex")
    .slice(0, 20);
  return `${type}:${digest}`;
}

function storagePathBelongsToUserScope(bucket, path, userId) {
  return STORAGE_SCOPES.some(
    (scope) =>
      scope.bucket === bucket &&
      scope.prefixes(userId).some((prefix) => path.startsWith(prefix))
  );
}

export function validatePurgePreflight(audit, config) {
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
}

export function buildPurgeOperations(audit, config) {
  validatePurgePreflight(audit, config);
  const operations = [];
  const verifiedUserIds = new Set(
    audit.auth.verifiedBzoneDemoUsers.map((user) => user.id)
  );
  const storageByBucket = new Map();
  for (const object of audit.storage?.objects ?? []) {
    if (!verifiedUserIds.has(object.userId)) continue;
    if (
      typeof object.bucket !== "string" ||
      typeof object.path !== "string" ||
      object.path.length === 0 ||
      object.path.endsWith("/") ||
      !storagePathBelongsToUserScope(object.bucket, object.path, object.userId)
    ) {
      throw new Error("Audit contains a storage folder or invalid object path");
    }
    const paths = storageByBucket.get(object.bucket) ?? new Set();
    paths.add(object.path);
    storageByBucket.set(object.bucket, paths);
  }

  for (const bucket of [...storageByBucket.keys()].sort()) {
    const paths = [...storageByBucket.get(bucket)].sort();
    for (const batch of chunkItems(paths)) {
      const target = { bucket, paths: batch };
      operations.push({
        id: operationId("storage.delete", target),
        type: "storage.delete",
        target,
        status: "pending",
        attempts: 0
      });
    }
  }

  for (const user of [...audit.auth.verifiedBzoneDemoUsers].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    const target = { id: user.id, email: user.email };
    operations.push({
      id: operationId("auth-user.delete", target),
      type: "auth-user.delete",
      target,
      status: "pending",
      attempts: 0
    });
  }

  // Gym quarantine is deliberately last so a partial purge never hides a gym
  // before the more precise object and identity operations have completed.
  for (const gymId of config.quarantineGymIds) {
    const target = { id: gymId };
    operations.push({
      id: operationId("gym.quarantine", target),
      type: "gym.quarantine",
      target,
      status: "pending",
      attempts: 0
    });
  }

  return operations;
}

export async function writeOwnerOnlyJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.chmod(0o600);
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function readPurgeReport(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Unable to read existing purge report: ${error.message}`);
  }
}

function serializeError(error, at) {
  return {
    at,
    name: error?.name ?? "Error",
    message: error?.message ?? String(error)
  };
}

function resumableReport(existingReport, projectRef) {
  return existingReport?.schemaVersion === REPORT_SCHEMA_VERSION &&
    existingReport?.mode === "apply" &&
    existingReport?.projectRef === projectRef
    ? existingReport
    : null;
}

function mergeOperations(existingOperations, plannedOperations, at) {
  const plannedIds = new Set(plannedOperations.map((operation) => operation.id));
  const existingById = new Map(
    (existingOperations ?? []).map((operation) => [operation.id, operation])
  );
  const history = (existingOperations ?? [])
    .filter((operation) => !plannedIds.has(operation.id))
    .map((operation) =>
      ["pending", "running"].includes(operation.status)
        ? { ...operation, status: "superseded", finishedAt: at }
        : operation
    );
  const current = plannedOperations.map((operation) => {
    const previous = existingById.get(operation.id);
    return {
      ...operation,
      attempts: Number(previous?.attempts ?? 0)
    };
  });
  return [...history, ...current];
}

async function executeOperation(client, operation) {
  if (operation.type === "storage.delete") {
    await client.removeStorageObjects(
      operation.target.bucket,
      operation.target.paths
    );
    return { deletedPaths: operation.target.paths.length };
  }

  if (operation.type === "auth-user.delete") {
    const currentUser = await client.getAuthUser(operation.target.id);
    if (!currentUser) return { alreadyAbsent: true };
    const classification = classifyAuthUser(currentUser);
    if (
      currentUser.id !== operation.target.id ||
      String(currentUser.email ?? "").toLowerCase() !== operation.target.email ||
      !classification.verified
    ) {
      throw new Error(
        `Refusing to delete revalidated user ${operation.target.id}; exact app_metadata marker or identity changed`
      );
    }
    await client.deleteAuthUser(operation.target.id);
    return { deleted: true };
  }

  if (operation.type === "gym.quarantine") {
    await client.quarantineGym(operation.target.id);
    return { quarantined: true };
  }

  throw new Error(`Unknown purge operation: ${operation.type}`);
}

export async function executePurgeRun({
  client,
  before,
  config,
  projectRef,
  supabaseOrigin,
  outputFile,
  existingReport = null,
  auditFn = auditDemoData,
  writeReport = writeOwnerOnlyJson,
  clock = () => new Date().toISOString()
}) {
  const plannedOperations = buildPurgeOperations(before, config);
  const prior = resumableReport(existingReport, projectRef);
  const startedAt = clock();
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    runId: prior?.runId ?? randomUUID(),
    projectRef,
    supabaseOrigin,
    mode: "apply",
    phase: "preflight",
    startedAt: prior?.startedAt ?? startedAt,
    updatedAt: startedAt,
    quarantineGymIds: [...config.quarantineGymIds],
    preflights: [
      ...(prior?.preflights ?? []),
      { auditedAt: startedAt, audit: before }
    ],
    before,
    after: null,
    operations: mergeOperations(prior?.operations, plannedOperations, startedAt),
    errors: [...(prior?.errors ?? [])]
  };
  const plannedIds = new Set(plannedOperations.map((operation) => operation.id));
  let primaryError = null;
  let finalizationError = null;

  const checkpoint = async () => {
    report.updatedAt = clock();
    await writeReport(outputFile, report);
  };

  try {
    // This owner-only preflight checkpoint must succeed before any mutation.
    await checkpoint();
    report.phase = "running";

    for (const operation of report.operations) {
      if (!plannedIds.has(operation.id) || operation.status !== "pending") continue;

      operation.status = "running";
      operation.attempts += 1;
      operation.startedAt = clock();
      delete operation.finishedAt;
      delete operation.result;
      delete operation.error;
      await checkpoint();

      try {
        operation.result = await executeOperation(client, operation);
        operation.status = "completed";
        operation.finishedAt = clock();
        await checkpoint();
      } catch (error) {
        operation.status = "failed";
        operation.finishedAt = clock();
        operation.error = serializeError(error, operation.finishedAt);
        report.errors.push({ operationId: operation.id, ...operation.error });
        try {
          await checkpoint();
        } catch (checkpointError) {
          report.errors.push({
            operationId: operation.id,
            stage: "failure-checkpoint",
            ...serializeError(checkpointError, clock())
          });
        }
        throw error;
      }
    }
  } catch (error) {
    primaryError = error;
    if (!report.errors.some((entry) => entry.message === error?.message)) {
      report.errors.push({ stage: "run", ...serializeError(error, clock()) });
    }
  } finally {
    try {
      report.after = await auditFn(client);
    } catch (error) {
      finalizationError = error;
      report.errors.push({ stage: "final-audit", ...serializeError(error, clock()) });
    }

    report.phase = primaryError || finalizationError ? "failed" : "completed";
    try {
      await checkpoint();
    } catch (error) {
      finalizationError ??= error;
    }
  }

  if (primaryError) throw primaryError;
  if (finalizationError) throw finalizationError;
  return report;
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
    const existingReport = await readPurgeReport(config.outputFile);
    const report = await executePurgeRun({
      client,
      before,
      config,
      projectRef,
      supabaseOrigin: origin,
      outputFile: config.outputFile,
      existingReport
    });
    console.log(`Report written to ${config.outputFile}`);
    console.log(`Ready for real testing: ${report.after?.readyForRealTesting ? "yes" : "no"}`);
    return;
  }

  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    runId: randomUUID(),
    generatedAt: new Date().toISOString(),
    projectRef,
    supabaseOrigin: origin,
    mode: config.mode,
    phase: "dry-run",
    quarantineGymIds: config.quarantineGymIds,
    before,
    after: null,
    operations: [],
    errors: []
  };
  await writeOwnerOnlyJson(config.outputFile, report);
  console.log(`Report written to ${config.outputFile}`);
  console.log(`Ready for real testing: ${before.readyForRealTesting ? "yes" : "no"}`);
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
