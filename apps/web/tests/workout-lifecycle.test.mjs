import assert from "node:assert/strict";
import { test } from "node:test";
import { submitWorkout, uploadWorkoutProofMedia, updateWorkoutAudience, WorkoutSaveUncertainError } from "../src/lib/public/workout-log.ts";

function chain(result, actions = []) {
  const builder = { then(resolve, reject) { return Promise.resolve().then(() => typeof result === "function" ? result() : result).then(resolve, reject); } };
  for (const method of ["select", "eq", "in", "order", "update", "insert", "maybeSingle", "single"]) {
    builder[method] = (...args) => { actions.push([method, ...args]); return builder; };
  }
  return builder;
}
const input = { title: "Session", workoutType: "strength", visibility: "private", exercises: [{ exerciseId: "exercise-1", set: { reps: 5, weightKg: 20 } }] };
test("persisted idempotency key and start time pass unchanged on retries", async () => {
  const payloads = [];
  const client = workoutClient({ data: {}, error: null });
  const rpc = client.rpc;
  client.rpc = async (name, args) => {
    if (name === "log_workout_atomic") payloads.push(args);
    return rpc(name, args);
  };
  const keyed = { ...input, idempotencyKey: "00000000-0000-4000-8000-000000000051", startedAt: "2026-10-23T08:00:00.000Z" };
  await submitWorkout(client, keyed);
  await submitWorkout(client, keyed);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(payloads[0].p_workout.idempotency_key, keyed.idempotencyKey);
  assert.equal(payloads[0].p_workout.started_at, keyed.startedAt);
});
test("keyed submission refuses a regenerated start time or invalid key", async () => {
  const client = workoutClient({ data: {}, error: null });
  await assert.rejects(submitWorkout(client, { ...input, idempotencyKey: "00000000-0000-4000-8000-000000000051" }), /stable startedAt/);
  await assert.rejects(submitWorkout(client, { ...input, idempotencyKey: "invalid", startedAt: "2026-10-23T08:00:00Z" }), /UUID/);
  assert.equal(client.writes, 0);
});
function workoutClient(after, logResult = { data: "workout-1", error: null }) {
  let reads = 0; let writes = 0;
  return {
    auth: { getUser: async () => ({ data: { user: { id: "athlete" } }, error: null }) },
    from: () => chain(() => ++reads === 1 ? { data: { xp_total: 10, level: 1, chain_days: 0, rank_tier: "initiate" }, error: null } : typeof after === "function" ? after() : after),
    rpc: async (name) => { if (name === "user_has_required_consents") return { data: true, error: null }; writes++; return typeof logResult === "function" ? logResult() : logResult; },
    get writes() { return writes; }
  };
}
test("committed workout survives failed progress readback without a second mutation", async () => {
  const client = workoutClient({ data: null, error: { message: "offline" } });
  const result = await submitWorkout(client, input);
  assert.equal(result.workoutId, "workout-1"); assert.equal(result.progressAvailable, false); assert.equal(client.writes, 1);
});
test("committed workout survives a thrown readback error", async () => {
  const result = await submitWorkout(workoutClient(() => { throw new Error("offline"); }), input);
  assert.equal(result.workoutId, "workout-1"); assert.equal(result.progressAvailable, false);
});
test("real progress is distinguished from unavailable progress", async () => {
  const result = await submitWorkout(workoutClient({ data: { xp_total: 25 }, error: null }), input);
  assert.equal(result.progressAvailable, true); assert.equal(result.xpDelta.xpAfter, 25);
});
test("unconfirmed network response and missing receipt forbid blind retry", async () => {
  for (const response of [{ data: null, error: { message: "Failed to fetch", code: "" } }, { data: null, error: null }, () => { throw new TypeError("network"); }]) {
    await assert.rejects(submitWorkout(workoutClient(null, response), input), WorkoutSaveUncertainError);
  }
});
test("confirmed database rejection remains a normal retryable failure", async () => {
  await assert.rejects(submitWorkout(workoutClient(null, { data: null, error: { code: "42501", message: "denied" } }), input), (error) => !(error instanceof WorkoutSaveUncertainError) && error.message === "denied");
});
test("audience mutation is owned and must return a confirmed audience", async () => {
  const actions = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: "athlete" } } }) }, from: () => chain({ data: { id: "workout", visibility: "followers" }, error: null }, actions) };
  await updateWorkoutAudience(client, "workout", "followers");
  assert.ok(actions.some(([method, key, value]) => method === "eq" && key === "user_id" && value === "athlete"));
  await assert.rejects(updateWorkoutAudience(client, "workout", "unknown"), /valid audience/);
  await assert.rejects(updateWorkoutAudience(client, "workout", "public"), /not confirmed/);
});
test("partial media failure preserves committed attachments and retry skips them", async () => {
  const registered = []; const uploads = []; let fail = true;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "athlete" } } }) },
    from: () => {
      const builder = chain(() => ({ data: registered, error: null }));
      builder.insert = (row) => chain(() => { registered.push(row); return { error: null }; });
      return builder;
    },
    storage: { from: () => ({ upload: async (path) => {
      uploads.push(path); if (path.includes("/2-") && fail) return { error: { message: "upload failed" } }; return { error: null };
    }, remove: async () => { assert.fail("Committed media must not be removed on a later file failure"); } }) }
  };
  const files = [new File(["photo-one"], "one.jpg", { type: "image/jpeg" }), new File(["photo-two"], "two.jpg", { type: "image/jpeg" })];
  await assert.rejects(uploadWorkoutProofMedia(client, { workoutId: "workout", files }), /upload failed/);
  assert.equal(registered.length, 1);
  fail = false;
  const result = await uploadWorkoutProofMedia(client, { workoutId: "workout", files });
  assert.equal(registered.length, 2); assert.equal(result.uploadedCount, 2);
  assert.equal(uploads.filter((path) => path.includes("/1-")).length, 1);
});

test("account changes before the workout mutation cannot save the previous viewer's draft", async () => {
  const client = workoutClient({ data: {}, error: null });
  let reads = 0;
  client.auth.getUser = async () => ({ data: { user: { id: ++reads === 1 ? "athlete" : "different" } } });
  await assert.rejects(submitWorkout(client, input, "athlete"), /account changed/);
  assert.equal(client.writes, 0);
});

test("media and audience mutations reject an editor owned by another account", async () => {
  const client = workoutClient({});
  await assert.rejects(uploadWorkoutProofMedia(client, { workoutId: "workout", files: [], expectedUserId: "different" }), /account changed/);
  await assert.rejects(updateWorkoutAudience(client, "workout", "public", "different"), /account changed/);
});

test("metadata failure retries a new object path without overwriting unselectable orphans", async () => {
  const uploads = []; const removals = []; let fail = true;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "athlete" } } }) },
    from() {
      const builder = chain({ data: [], error: null });
      builder.insert = () => chain(fail ? { error: { code: "23514", message: "metadata unavailable" } } : { error: null });
      return builder;
    },
    storage: { from: () => ({
      upload: async (path, _file, options) => { assert.equal(options.upsert, false); uploads.push(path); return { error: null }; },
      remove: async (paths) => { removals.push(...paths); return { error: { message: "cleanup unavailable" } }; }
    }) }
  };
  const files = [new File(["photo"], "proof.jpg", { type: "image/jpeg" })];
  await assert.rejects(uploadWorkoutProofMedia(client, { workoutId: "workout", files }), /metadata unavailable/);
  fail = false;
  await uploadWorkoutProofMedia(client, { workoutId: "workout", files });
  assert.equal(uploads.length, 2); assert.notEqual(uploads[0], uploads[1]);
  assert.deepEqual(removals, [uploads[0]]);
});

function uncertainMediaClient({ committed = false, thrown = false, readbackFails = false, readback, errorCode, changeAccount = false } = {}) {
  const rows = []; const uploads = []; const removals = [];
  let attempts = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: changeAccount && attempts ? "other-athlete" : "athlete" } } }) },
    from() {
      const filters = [];
      const builder = chain(() => {
        if (readbackFails && filters.some(([key]) => key === "storage_path")) throw new TypeError("offline readback");
        const matches = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (readback && filters.some(([key]) => key === "storage_path")) return readback(matches[0]);
        return { data: filters.some(([key]) => key === "storage_path") ? matches[0] ?? null : matches, error: null };
      });
      builder.eq = (key, value) => { filters.push([key, value]); return builder; };
      builder.insert = (row) => chain(() => {
        attempts++;
        if (committed || attempts > 1) rows.push(row);
        if (attempts > 1) return { error: null };
        if (thrown) throw new TypeError("lost registration response");
        return { error: { code: errorCode, message: "Failed to fetch" } };
      });
      return builder;
    },
    storage: { from: () => ({
      upload: async (path, _file, options) => { assert.equal(options.upsert, false); uploads.push(path); return { error: null }; },
      remove: async (paths) => { removals.push(...paths); return { error: null }; }
    }) }
  };
  return { client, rows, uploads, removals };
}

for (const thrown of [false, true]) {
  test(`committed attachment survives a ${thrown ? "thrown" : "returned"} lost registration response`, async () => {
    const fixture = uncertainMediaClient({ committed: true, thrown });
    const files = [new File(["photo"], "proof.jpg", { type: "image/jpeg" })];
    assert.deepEqual(await uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files }), { uploadedCount: 1 });
    assert.deepEqual(await uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files }), { uploadedCount: 1 });
    assert.equal(fixture.uploads.length, 1);
    assert.equal(fixture.rows.length, 1);
    assert.deepEqual(fixture.removals, []);
  });
}

test("unconfirmed registration preserves its object even when readback also fails", async () => {
  const fixture = uncertainMediaClient({ committed: true, readbackFails: true });
  const files = [new File(["photo"], "proof.jpg", { type: "image/jpeg" })];
  await assert.rejects(uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files }), /could not be confirmed.*Retry attachments only/);
  assert.deepEqual(fixture.removals, []);
  assert.deepEqual(await uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files }), { uploadedCount: 1 });
  assert.equal(fixture.uploads.length, 1);
});

test("an empty readback is not proof that an uncertain write rolled back", async () => {
  const fixture = uncertainMediaClient();
  const files = [new File(["photo"], "proof.jpg", { type: "image/jpeg" })];
  await assert.rejects(uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files }), /could not be confirmed/);
  assert.deepEqual(fixture.removals, []);
  await uploadWorkoutProofMedia(fixture.client, { workoutId: "workout", files });
  assert.equal(fixture.uploads.length, 2);
  assert.notEqual(fixture.uploads[0], fixture.uploads[1]);
});

test("registration confirmation rejects mismatched receipts and errored data", async () => {
  for (const patch of [
    { workout_id: "other-workout" }, { uploader_user_id: "other-athlete" },
    { storage_bucket: "public-bucket" }, { storage_path: "unrelated-path" }, { sort_order: 2 }, null
  ]) {
    const fixture = uncertainMediaClient({ committed: true, readback: (row) => ({
      data: { ...row, ...patch }, error: patch === null ? { message: "untrusted readback" } : null
    }) });
    await assert.rejects(uploadWorkoutProofMedia(fixture.client, {
      workoutId: "workout", files: [new File(["photo"], "proof.jpg", { type: "image/jpeg" })]
    }), /could not be confirmed/);
    assert.deepEqual(fixture.removals, []);
  }
});

test("unclassified and timeout error codes do not authorize object deletion", async () => {
  for (const errorCode of ["57014", "08006", "PGRST000", "UNKNOWN"]) {
    const fixture = uncertainMediaClient({ errorCode });
    await assert.rejects(uploadWorkoutProofMedia(fixture.client, {
      workoutId: "workout", files: [new File(["photo"], "proof.jpg", { type: "image/jpeg" })]
    }), /could not be confirmed/);
    assert.deepEqual(fixture.removals, []);
  }
});

test("account changes after registration prevent reconciliation and cleanup", async () => {
  const fixture = uncertainMediaClient({ committed: true, changeAccount: true, errorCode: "23514" });
  await assert.rejects(uploadWorkoutProofMedia(fixture.client, {
    workoutId: "workout", files: [new File(["photo"], "proof.jpg", { type: "image/jpeg" })]
  }), /account changed/);
  assert.deepEqual(fixture.removals, []);
});
