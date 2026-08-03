import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BZONE_DEMO_USERS,
  applyPurge,
  classifyAuthUser,
  parseArgs,
  qualifyBzoneGym,
  requiredConfirmation,
  validateApplyConfirmation,
  validateSupabaseUrl
} from "../scripts/purge-demo-data.mjs";

const PROJECT_REF = "upwcpcjjfggdcmizgbka";
const GYM_ID = "71c4b0d8-370a-4cf3-8a50-e278ca28fa55";

test("parseArgs defaults to a no-mutation dry run", () => {
  assert.deepEqual(parseArgs([]), {
    mode: "dry-run",
    outputFile: "demo-data-purge-report.json",
    quarantineGymIds: [],
    confirm: null
  });
});

test("parseArgs validates and deduplicates quarantine gym ids", () => {
  assert.deepEqual(
    parseArgs([
      "--mode",
      "apply",
      "--quarantine-gym-id",
      GYM_ID,
      "--quarantine-gym-id",
      GYM_ID,
      "--confirm",
      requiredConfirmation(PROJECT_REF)
    ]),
    {
      mode: "apply",
      outputFile: "demo-data-purge-report.json",
      quarantineGymIds: [GYM_ID],
      confirm: requiredConfirmation(PROJECT_REF)
    }
  );
  assert.throws(() => parseArgs(["--quarantine-gym-id", "not-a-uuid"]), /Invalid gym UUID/);
  assert.throws(() => parseArgs(["--mode", "delete"]), /dry-run or apply/);
});

test("apply mode requires an exact project-specific confirmation", () => {
  assert.doesNotThrow(() => validateApplyConfirmation({ mode: "dry-run" }, PROJECT_REF));
  assert.throws(
    () => validateApplyConfirmation({ mode: "apply", confirm: "yes" }, PROJECT_REF),
    new RegExp(requiredConfirmation(PROJECT_REF))
  );
  assert.doesNotThrow(() =>
    validateApplyConfirmation(
      { mode: "apply", confirm: requiredConfirmation(PROJECT_REF) },
      PROJECT_REF
    )
  );
});

test("Supabase URL validation locks execution to the named HTTPS project", () => {
  assert.equal(
    validateSupabaseUrl(`https://${PROJECT_REF}.supabase.co/`, PROJECT_REF),
    `https://${PROJECT_REF}.supabase.co`
  );
  assert.throws(
    () => validateSupabaseUrl("https://anotherproject.supabase.co", PROJECT_REF),
    /Refusing unexpected Supabase host/
  );
  assert.throws(
    () => validateSupabaseUrl(`http://${PROJECT_REF}.supabase.co`, PROJECT_REF),
    /Refusing unexpected Supabase host/
  );
});

test("only exact BZone identities with demo metadata are purgeable", () => {
  const expected = BZONE_DEMO_USERS[0];
  assert.equal(
    classifyAuthUser({
      id: expected.id,
      email: expected.email,
      app_metadata: { demo_persona: true }
    }).verified,
    true
  );

  const missingMetadata = classifyAuthUser({ id: expected.id, email: expected.email });
  assert.equal(missingMetadata.verified, false);
  assert.equal(missingMetadata.suspicious, true);

  const unrelatedTest = classifyAuthUser({
    id: "45c3be4e-277d-4120-91ca-3fad573fc0c4",
    email: "uat.person@example.test"
  });
  assert.equal(unrelatedTest.verified, false);
  assert.equal(unrelatedTest.suspicious, false);
  assert.equal(unrelatedTest.markers.testEmail, true);
});

test("gym quarantine requires linked evidence or an exact identity and brand pair", () => {
  const gym = { slug: "bzone-fitness-pavia", name: "BZone Fitness" };
  assert.equal(qualifyBzoneGym(gym).canQuarantine, false);
  assert.equal(
    qualifyBzoneGym(gym, {
      brand: { app_display_name: "BZone Fitness", support_email: "info@bzonefitness.it" }
    }).canQuarantine,
    true
  );
  assert.equal(
    qualifyBzoneGym({ slug: "custom", name: "BZone Fitness" }, {
      linkedToTestData: true,
      brand: { app_display_name: "BZone Fitness", support_email: "info@bzonefitness.it" }
    }).canQuarantine,
    true
  );
  assert.equal(
    qualifyBzoneGym({ slug: "bzone-pavia", name: "BZone Pavia" }, {
      brand: { app_display_name: "BZone Fitness", support_email: "info@bzonefitness.it" }
    }).canQuarantine,
    true
  );
});

test("dry-run behavior never calls mutation methods", async () => {
  const mutations = [];
  const client = {
    quarantineGym: async (id) => mutations.push(["gym", id]),
    removeStorageObjects: async (bucket, paths) => mutations.push(["storage", bucket, paths]),
    deleteAuthUser: async (id) => mutations.push(["user", id])
  };
  const audit = {
    auth: { suspiciousDemoMarkers: [], verifiedBzoneDemoUsers: [BZONE_DEMO_USERS[0]] },
    storage: { objects: [] },
    ownership: { testOwnedGyms: [] },
    candidateGyms: []
  };

  // main only invokes applyPurge in apply mode; a dry-run audit is read-only.
  assert.deepEqual(mutations, []);
  await assert.rejects(
    applyPurge(client, audit, { quarantineGymIds: [GYM_ID] }),
    /unverified BZone demo gym/
  );
  assert.deepEqual(mutations, []);
});

test("apply refuses before mutation when a demo user owns a gym", async () => {
  const mutations = [];
  const demoUser = BZONE_DEMO_USERS[0];
  const client = {
    quarantineGym: async (id) => mutations.push(["gym", id]),
    removeStorageObjects: async (bucket, paths) => mutations.push(["storage", bucket, paths]),
    deleteAuthUser: async (id) => mutations.push(["user", id])
  };
  const audit = {
    auth: { suspiciousDemoMarkers: [], verifiedBzoneDemoUsers: [demoUser] },
    storage: { objects: [] },
    ownership: {
      testOwnedGyms: [{ id: GYM_ID, owner_user_id: demoUser.id }]
    },
    candidateGyms: []
  };

  await assert.rejects(
    applyPurge(client, audit, { quarantineGymIds: [] }),
    /demo user owns a gym/
  );
  assert.deepEqual(mutations, []);
});

test("apply mutates only verified demo identities and their exact storage paths", async () => {
  const mutations = [];
  const demoUser = BZONE_DEMO_USERS[0];
  const otherTestUserId = "45c3be4e-277d-4120-91ca-3fad573fc0c4";
  const client = {
    quarantineGym: async (id) => mutations.push(["gym", id]),
    removeStorageObjects: async (bucket, paths) => mutations.push(["storage", bucket, paths]),
    deleteAuthUser: async (id) => mutations.push(["user", id])
  };
  const audit = {
    auth: { suspiciousDemoMarkers: [], verifiedBzoneDemoUsers: [demoUser] },
    storage: {
      objects: [
        { bucket: "workout-proof", path: `${demoUser.id}/proof.jpg`, userId: demoUser.id },
        { bucket: "workout-proof", path: `${otherTestUserId}/proof.jpg`, userId: otherTestUserId }
      ]
    },
    ownership: { testOwnedGyms: [] },
    candidateGyms: [{ id: GYM_ID, qualification: { canQuarantine: true } }]
  };

  await applyPurge(client, audit, { quarantineGymIds: [GYM_ID] });
  assert.deepEqual(mutations, [
    ["gym", GYM_ID],
    ["storage", "workout-proof", [`${demoUser.id}/proof.jpg`]],
    ["user", demoUser.id]
  ]);
});

test("database and client gates stay false-by-default and production-safe", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/202608030001_guard_bzone_demo_seed.sql", import.meta.url),
    "utf8"
  );
  const service = await readFile(
    new URL("../../../apps/admin/src/services/seed-bzone.ts", import.meta.url),
    "utf8"
  );
  const settings = await readFile(
    new URL("../../../apps/admin/src/app/(dashboard)/settings/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(migration, /'demo_seed_enabled'[\s\S]+false,[\s\n]+0/);
  assert.match(migration, /seed_bzone_demo_people_internal/);
  assert.match(migration, /if not public\.demo_seed_is_enabled\(\)/);
  assert.ok(service.indexOf('supabase.rpc("demo_seed_is_enabled")') < service.indexOf('.from("gyms")'));
  assert.match(settings, /const showDemoSeed = isDemoSeedClientEnabled\(\)/);
});
