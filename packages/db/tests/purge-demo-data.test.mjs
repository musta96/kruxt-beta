import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  BZONE_DEMO_USERS,
  STORAGE_DELETE_BATCH_SIZE,
  SupabaseAdminClient,
  buildPurgeOperations,
  classifyAuthUser,
  enumerateStorageObjects,
  executePurgeRun,
  parseArgs,
  qualifyBzoneGym,
  requiredConfirmation,
  validateApplyConfirmation,
  validateSupabaseUrl,
  writeOwnerOnlyJson
} from "../scripts/purge-demo-data.mjs";

const PROJECT_REF = "upwcpcjjfggdcmizgbka";
const ORIGIN = `https://${PROJECT_REF}.supabase.co`;
const GYM_ID = "71c4b0d8-370a-4cf3-8a50-e278ca28fa55";

function markedUser(user = BZONE_DEMO_USERS[0]) {
  return { ...user, app_metadata: { demo_persona: true } };
}

function auditFixture({ users = [], storage = [], candidateGyms = [] } = {}) {
  return {
    auth: {
      suspiciousDemoMarkers: [],
      verifiedBzoneDemoUsers: users,
      otherTestUsers: []
    },
    linkedRows: {},
    visibility: {
      publicGymCount: 0,
      publicGyms: [],
      visibleBzoneDemoCandidates: []
    },
    storage: { objectCount: storage.length, objects: storage },
    ownership: { testOwnedGyms: [] },
    candidateGyms,
    readyForRealTesting: false
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
  assert.equal(validateSupabaseUrl(`${ORIGIN}/`, PROJECT_REF), ORIGIN);
  assert.throws(
    () => validateSupabaseUrl("https://anotherproject.supabase.co", PROJECT_REF),
    /Refusing unexpected Supabase host/
  );
  assert.throws(
    () => validateSupabaseUrl(`http://${PROJECT_REF}.supabase.co`, PROJECT_REF),
    /Refusing unexpected Supabase host/
  );
});

test("only the server-controlled app_metadata marker can verify an exact demo identity", () => {
  const expected = BZONE_DEMO_USERS[0];
  assert.equal(classifyAuthUser(markedUser(expected)).verified, true);

  for (const metadata of [
    { user_metadata: { demo_persona: true } },
    { raw_user_meta_data: { demo_persona: true } },
    { raw_app_meta_data: { demo_persona: true } }
  ]) {
    const classification = classifyAuthUser({ ...expected, ...metadata });
    assert.equal(classification.verified, false);
    assert.equal(classification.suspicious, true);
  }

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
});

test("storage enumeration recursively returns exact files from nested folders", async () => {
  const root = `${BZONE_DEMO_USERS[0].id}/`;
  const fixtures = new Map([
    [root, [
      { name: "root.jpg", id: "file-1", metadata: { size: 1 } },
      { name: "proofs", id: null, metadata: null }
    ]],
    [`${root}proofs/`, [
      { name: "set-a", id: null, metadata: null },
      { name: "warmup.mp4", id: "file-2", metadata: { size: 2 } }
    ]],
    [`${root}proofs/set-a/`, [
      { name: "deep.jpg", id: "file-3", metadata: { size: 3 } }
    ]]
  ]);
  const visited = [];
  const client = {
    listStorageEntries: async (_bucket, prefix) => {
      visited.push(prefix);
      return fixtures.get(prefix) ?? [];
    }
  };

  assert.deepEqual(
    await enumerateStorageObjects(client, "workout-proof", root),
    [
      { bucket: "workout-proof", path: `${root}proofs/set-a/deep.jpg` },
      { bucket: "workout-proof", path: `${root}proofs/warmup.mp4` },
      { bucket: "workout-proof", path: `${root}root.jpg` }
    ]
  );
  assert.deepEqual(new Set(visited), new Set(fixtures.keys()));
});

test("storage deletion accepts exact paths only and enforces the batch ceiling", async () => {
  const requests = [];
  const client = new SupabaseAdminClient(ORIGIN, "sb_secret_test", async (url, init) => {
    requests.push({ url, init });
    return {
      ok: true,
      status: 204,
      text: async () => ""
    };
  });
  const exactPaths = ["user/nested/one.jpg", "user/two.jpg"];
  await client.removeStorageObjects("workout-proof", exactPaths);
  assert.deepEqual(JSON.parse(requests[0].init.body), { prefixes: exactPaths });
  await assert.rejects(
    client.removeStorageObjects("workout-proof", ["user/folder/"]),
    /exact object paths/
  );
  await assert.rejects(
    client.removeStorageObjects(
      "workout-proof",
      Array.from({ length: STORAGE_DELETE_BATCH_SIZE + 1 }, (_, index) => `user/${index}.jpg`)
    ),
    /safety limit/
  );
  assert.equal(requests.length, 1);
});

test("operation planning batches storage and always puts gym quarantine last", () => {
  const user = BZONE_DEMO_USERS[0];
  const storage = Array.from({ length: 205 }, (_, index) => ({
    bucket: "workout-proof",
    path: `${user.id}/nested/${String(index).padStart(3, "0")}.jpg`,
    userId: user.id
  }));
  const operations = buildPurgeOperations(
    auditFixture({
      users: [user],
      storage,
      candidateGyms: [{ id: GYM_ID, qualification: { canQuarantine: true } }]
    }),
    { quarantineGymIds: [GYM_ID] }
  );
  const storageOperations = operations.filter((operation) => operation.type === "storage.delete");

  assert.deepEqual(
    storageOperations.map((operation) => operation.target.paths.length),
    [100, 100, 5]
  );
  assert.equal(operations.at(-1).type, "gym.quarantine");
});

test("preflight refuses to delete a demo identity that still owns a gym", () => {
  const user = BZONE_DEMO_USERS[0];
  const audit = auditFixture({ users: [user] });
  audit.ownership.testOwnedGyms = [{ id: GYM_ID, owner_user_id: user.id }];
  assert.throws(
    () => buildPurgeOperations(audit, { quarantineGymIds: [] }),
    /demo user owns a gym/
  );
});

test("owner-only report writes replace permissive files with mode 0600", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kruxt-purge-report-"));
  const reportPath = join(directory, "report.json");
  try {
    await writeFile(reportPath, "permissive\n", { mode: 0o644 });
    await chmod(reportPath, 0o644);
    await writeOwnerOnlyJson(reportPath, { phase: "preflight" });
    assert.equal((await stat(reportPath)).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(await readFile(reportPath, "utf8")), { phase: "preflight" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("apply persists an owner-only preflight checkpoint before its first mutation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kruxt-purge-preflight-"));
  const reportPath = join(directory, "report.json");
  const user = BZONE_DEMO_USERS[0];
  let observedCheckpoint;
  try {
    await executePurgeRun({
      client: {
        removeStorageObjects: async () => {},
        getAuthUser: async () => {
          observedCheckpoint = JSON.parse(await readFile(reportPath, "utf8"));
          assert.equal((await stat(reportPath)).mode & 0o777, 0o600);
          return markedUser(user);
        },
        deleteAuthUser: async () => {},
        quarantineGym: async () => {}
      },
      before: auditFixture({ users: [user] }),
      config: { quarantineGymIds: [] },
      projectRef: PROJECT_REF,
      supabaseOrigin: ORIGIN,
      outputFile: reportPath,
      auditFn: async () => auditFixture()
    });
    assert.equal(observedCheckpoint.phase, "running");
    assert.equal(
      observedCheckpoint.operations.find((operation) => operation.type === "auth-user.delete").status,
      "running"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failure checkpoints the operation and always records a final re-audit", async () => {
  const user = BZONE_DEMO_USERS[0];
  const before = auditFixture({
    users: [user],
    storage: [{
      bucket: "workout-proof",
      path: `${user.id}/nested/proof.jpg`,
      userId: user.id
    }],
    candidateGyms: [{ id: GYM_ID, qualification: { canQuarantine: true } }]
  });
  const events = [];
  const snapshots = [];
  const client = {
    removeStorageObjects: async () => {
      events.push("storage");
      throw new Error("injected storage failure");
    },
    getAuthUser: async () => events.push("get-user"),
    deleteAuthUser: async () => events.push("delete-user"),
    quarantineGym: async () => events.push("gym")
  };

  await assert.rejects(
    executePurgeRun({
      client,
      before,
      config: { quarantineGymIds: [GYM_ID] },
      projectRef: PROJECT_REF,
      supabaseOrigin: ORIGIN,
      outputFile: "unused.json",
      writeReport: async (_path, report) => {
        events.push(`write:${report.phase}`);
        snapshots.push(clone(report));
      },
      auditFn: async () => {
        events.push("final-audit");
        return { ...before, readyForRealTesting: false };
      }
    }),
    /injected storage failure/
  );

  assert.match(events[0], /^write:preflight$/);
  assert.ok(events.indexOf("storage") > events.indexOf("write:running"));
  assert.equal(events.includes("get-user"), false);
  assert.equal(events.includes("gym"), false);
  assert.ok(events.indexOf("final-audit") > events.indexOf("storage"));
  assert.equal(snapshots.at(-1).phase, "failed");
  assert.ok(snapshots.at(-1).after);
  const storageSnapshots = snapshots.map((snapshot) =>
    snapshot.operations.find((operation) => operation.type === "storage.delete")?.status
  );
  assert.ok(storageSnapshots.includes("running"));
  assert.ok(storageSnapshots.includes("failed"));
});

test("apply revalidates app_metadata immediately before identity deletion", async () => {
  const user = BZONE_DEMO_USERS[0];
  const before = auditFixture({ users: [user] });
  const events = [];
  const snapshots = [];
  const client = {
    getAuthUser: async () => {
      events.push("get-user");
      return { ...user, user_metadata: { demo_persona: true } };
    },
    deleteAuthUser: async () => events.push("delete-user"),
    removeStorageObjects: async () => events.push("storage"),
    quarantineGym: async () => events.push("gym")
  };

  await assert.rejects(
    executePurgeRun({
      client,
      before,
      config: { quarantineGymIds: [] },
      projectRef: PROJECT_REF,
      supabaseOrigin: ORIGIN,
      outputFile: "unused.json",
      writeReport: async (_path, report) => snapshots.push(clone(report)),
      auditFn: async () => before
    }),
    /revalidated user/
  );
  assert.deepEqual(events, ["get-user"]);
  assert.equal(snapshots.at(-1).phase, "failed");
});

test("a failed run resumes from the next audit and preserves operation attempts", async () => {
  const user = BZONE_DEMO_USERS[0];
  const storageObject = {
    bucket: "workout-proof",
    path: `${user.id}/proof.jpg`,
    userId: user.id
  };
  const firstBefore = auditFixture({ users: [user], storage: [storageObject] });
  const firstSnapshots = [];
  const firstEvents = [];
  await assert.rejects(
    executePurgeRun({
      client: {
        removeStorageObjects: async () => firstEvents.push("storage"),
        getAuthUser: async () => markedUser(user),
        deleteAuthUser: async () => {
          firstEvents.push("user");
          throw new Error("injected user failure");
        },
        quarantineGym: async () => firstEvents.push("gym")
      },
      before: firstBefore,
      config: { quarantineGymIds: [] },
      projectRef: PROJECT_REF,
      supabaseOrigin: ORIGIN,
      outputFile: "unused.json",
      writeReport: async (_path, report) => firstSnapshots.push(clone(report)),
      auditFn: async () => firstBefore
    }),
    /injected user failure/
  );
  assert.deepEqual(firstEvents, ["storage", "user"]);

  const resumedEvents = [];
  const secondBefore = auditFixture({ users: [user], storage: [] });
  const resumed = await executePurgeRun({
    client: {
      removeStorageObjects: async () => resumedEvents.push("storage"),
      getAuthUser: async () => {
        resumedEvents.push("get-user");
        return markedUser(user);
      },
      deleteAuthUser: async () => resumedEvents.push("delete-user"),
      quarantineGym: async () => resumedEvents.push("gym")
    },
    before: secondBefore,
    config: { quarantineGymIds: [] },
    projectRef: PROJECT_REF,
    supabaseOrigin: ORIGIN,
    outputFile: "unused.json",
    existingReport: firstSnapshots.at(-1),
    writeReport: async () => {},
    auditFn: async () => ({ ...secondBefore, readyForRealTesting: true })
  });

  assert.deepEqual(resumedEvents, ["get-user", "delete-user"]);
  const userOperation = resumed.operations.find(
    (operation) => operation.type === "auth-user.delete"
  );
  assert.equal(userOperation.status, "completed");
  assert.equal(userOperation.attempts, 2);
  assert.equal(
    resumed.operations.find((operation) => operation.type === "storage.delete").status,
    "completed"
  );
});

test("successful operations delete exact data before quarantining the gym", async () => {
  const user = BZONE_DEMO_USERS[0];
  const events = [];
  const before = auditFixture({
    users: [user],
    storage: [{
      bucket: "workout-proof",
      path: `${user.id}/proof.jpg`,
      userId: user.id
    }],
    candidateGyms: [{ id: GYM_ID, qualification: { canQuarantine: true } }]
  });
  await executePurgeRun({
    client: {
      removeStorageObjects: async () => events.push("storage"),
      getAuthUser: async () => {
        events.push("get-user");
        return markedUser(user);
      },
      deleteAuthUser: async () => events.push("delete-user"),
      quarantineGym: async () => events.push("gym")
    },
    before,
    config: { quarantineGymIds: [GYM_ID] },
    projectRef: PROJECT_REF,
    supabaseOrigin: ORIGIN,
    outputFile: "unused.json",
    writeReport: async () => {},
    auditFn: async () => ({ ...before, readyForRealTesting: true })
  });
  assert.deepEqual(events, ["storage", "get-user", "delete-user", "gym"]);
});

test("seed migration enforces the destructive authorization SQL contract", async () => {
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

  assert.match(
    migration,
    /on conflict \(key\) do update[\s\S]+enabled = false[\s\S]+rollout_percentage = 0/
  );
  assert.match(migration, /public\.is_service_role\(\)/);
  assert.match(
    migration,
    /public\.user_has_gym_permission\([\s\S]+?'danger\.destructive'/
  );
  assert.match(
    migration,
    /public\.platform_operator_has_permission\([\s\S]+?'platform\.gyms\.manage'/
  );
  assert.doesNotMatch(migration, /public\.is_gym_staff\(/);
  assert.match(migration, /set_config\('request\.jwt\.claims'/);
  assert.match(migration, /exception when others[\s\S]+set_config/);
  assert.ok(migration.indexOf("'danger.destructive'") < migration.indexOf("perform set_config"));
  assert.match(
    migration,
    /grant execute on function public\.seed_bzone_demo_people\(uuid\) to service_role/
  );
  assert.match(migration, /seed_bzone_demo_people_internal/);
  assert.match(migration, /if not public\.demo_seed_is_enabled\(\)/);
  assert.ok(service.indexOf('supabase.rpc("demo_seed_is_enabled")') < service.indexOf('.from("gyms")'));
  assert.match(settings, /const showDemoSeed = isDemoSeedClientEnabled\(\)/);
});
