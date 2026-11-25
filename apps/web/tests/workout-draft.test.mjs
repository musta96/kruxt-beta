import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  readWorkoutDraft, writeWorkoutDraft, discardWorkoutDraft, WORKOUT_DRAFT_TTL, WORKOUT_DRAFT_MAX_BYTES,
  readWorkoutDraftRequest, writeWorkoutDraftRequest, clearWorkoutDraftRequest
} from "../src/lib/public/workout-draft.ts";

const owner = "73000000-0000-4000-8000-000000000001";
const other = "73000000-0000-4000-8000-000000000002";
const request = { idempotencyKey: other, startedAt: "2026-10-23T09:00:00.000Z" };
const now = Date.parse(request.startedAt);
const key = `kruxt:workout-draft:v1:${owner}`;
const data = {
  request, title: "Private session", notes: "Sensitive notes", workoutType: "strength", gymId: "",
  sessionRpe: "7", sessionGuidance: "Coach guidance",
  blocks: [{ clientId: "block-1", searchQuery: "Squat", selectedExercise: {
    id: other, name: "Squat", slug: "squat", category: "strength", equipment: "barbell", movementPattern: null
  }, stationLabel: "A", notes: "Keep form", blockType: "superset", reps: "5", weightKg: "20", distanceM: "", durationSeconds: "" }]
};
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test("round-trip restores exact editor content and stable submission identity", () => {
  const store = storage();
  writeWorkoutDraft(store, owner, data, "editing", now);
  assert.deepEqual(readWorkoutDraft(store, owner, now + 1), { version: 1, owner, savedAt: now, saveState: "editing", data });
  writeWorkoutDraft(store, owner, data, "unconfirmed", now + 2);
  assert.equal(readWorkoutDraft(store, owner, now + 3).saveState, "unconfirmed");
});

test("only the supplied verified viewer's key is read or removed", () => {
  const store = storage();
  writeWorkoutDraft(store, owner, data, "editing", now);
  assert.equal(readWorkoutDraft(store, other, now), null);
  discardWorkoutDraft(store, other);
  assert.ok(readWorkoutDraft(store, owner, now));
  const entry = JSON.parse(store.getItem(key)); entry.owner = other;
  store.setItem(key, JSON.stringify(entry));
  assert.equal(readWorkoutDraft(store, owner, now), null);
  assert.equal(store.getItem(key), null);
  for (const invalid of ["", "athlete", "../other"]) {
    assert.throws(() => readWorkoutDraft(store, invalid));
    assert.throws(() => writeWorkoutDraft(store, invalid, data));
  }
});

test("expiry boundary, future timestamps, versions and corrupt JSON fail closed and are purged", () => {
  const store = storage();
  writeWorkoutDraft(store, owner, data, "editing", now);
  const raw = store.getItem(key);
  assert.ok(readWorkoutDraft(store, owner, now + WORKOUT_DRAFT_TTL - 1));
  assert.equal(readWorkoutDraft(store, owner, now + WORKOUT_DRAFT_TTL), null);
  const entry = JSON.parse(raw);
  for (const value of ["{", "null", "[]", JSON.stringify({ ...entry, version: 2 }),
    JSON.stringify({ ...entry, savedAt: now + 1 }), JSON.stringify({ ...entry, saveState: "saved" })]) {
    store.setItem(key, value);
    assert.equal(readWorkoutDraft(store, owner, now), null);
    assert.equal(store.getItem(key), null);
  }
});

test("nested content, count, string, and byte bounds are enforced without truncating work", () => {
  const store = storage();
  const invalid = [
    { ...data, title: "x".repeat(501) }, { ...data, notes: "x".repeat(10001) },
    { ...data, gymId: "invalid" }, { ...data, workoutType: "bogus" }, { ...data, blocks: [] },
    { ...data, blocks: Array(101).fill(data.blocks[0]) }, { ...data, blocks: [data.blocks[0], data.blocks[0]] },
    { ...data, blocks: [{ ...data.blocks[0], reps: 5 }] },
    { ...data, blocks: [{ ...data.blocks[0], blockType: "bogus" }] },
    { ...data, blocks: [{ ...data.blocks[0], selectedExercise: { ...data.blocks[0].selectedExercise, id: "bogus" } }] },
    { ...data, request: { ...request, idempotencyKey: "invalid" } },
    { ...data, blocks: Array.from({ length: 100 }, (_, i) => ({ ...data.blocks[0], clientId: String(i), notes: "界".repeat(5000) })) }
  ];
  for (const value of invalid) assert.throws(() => writeWorkoutDraft(store, owner, value, "editing", now));
  store.setItem(key, " ".repeat(WORKOUT_DRAFT_MAX_BYTES + 1));
  assert.equal(readWorkoutDraft(store, owner, now), null);
});

test("files, file names, auth, audience and unrelated metadata are excluded by allowlist", () => {
  const store = storage();
  writeWorkoutDraft(store, owner, { ...data, files: [{ name: "secret.jpg" }], token: "secret-token", visibility: "public",
    blocks: [{ ...data.blocks[0], privateExtra: "secret-extra", selectedExercise: { ...data.blocks[0].selectedExercise, token: "secret-token" } }] }, "editing", now);
  const raw = store.getItem(key);
  for (const secret of ["secret.jpg", "secret-token", "secret-extra", "visibility", "files"]) assert.ok(!raw.includes(secret));
  assert.deepEqual(readWorkoutDraft(store, owner, now).data, data);
});

test("storage failures are exposed to the UI, not silently reported as saved", () => {
  const denied = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
  assert.throws(() => readWorkoutDraft(denied, owner), /blocked/);
  assert.throws(() => writeWorkoutDraft(denied, owner, data), /quota/);
  assert.throws(() => discardWorkoutDraft(denied, owner), /blocked/);
});

test("metadata-only request receipt survives recovery opt-out, remains owner-scoped, and resets explicitly", () => {
  const store = storage();
  writeWorkoutDraftRequest(store, owner, request);
  writeWorkoutDraft(store, owner, data, "unconfirmed", now);
  discardWorkoutDraft(store, owner);
  assert.deepEqual(readWorkoutDraftRequest(store, owner), request);
  assert.equal(readWorkoutDraftRequest(store, other), null);
  assert.ok(!JSON.stringify([...store.values]).includes(data.notes));
  clearWorkoutDraftRequest(store, other);
  assert.deepEqual(readWorkoutDraftRequest(store, owner), request);
  clearWorkoutDraftRequest(store, owner);
  assert.equal(readWorkoutDraftRequest(store, owner), null);
  assert.throws(() => writeWorkoutDraftRequest(store, owner, { ...request, startedAt: "invalid" }));
});

test("Log checks auth before storage, requires explicit recovery and clears after persistence before media", () => {
  const screen = readFileSync(new URL("../src/components/public/LogScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /const \[draftEnabled, setDraftEnabled\] = useState\(false\)/);
  assert.match(screen, /Restore draft/); assert.match(screen, /Discard draft/);
  assert.match(screen, /auth\.data\.user\?\.id !== owner/);
  assert.match(screen, /idempotencyKey: draftRequest\.idempotencyKey/);
  assert.match(screen, /startedAt: draftRequest\.startedAt/);
  assert.match(screen, /draft\.saveState === "unconfirmed"/);
  assert.ok(screen.indexOf("const result = await submitWorkout") < screen.indexOf("clearConfirmedDraft(owner);", screen.indexOf("const result = await submitWorkout")));
  const afterSave = screen.slice(screen.indexOf("persistReceipt(result.workoutId, owner)"));
  assert.ok(afterSave.indexOf("clearConfirmedDraft(owner)") < afterSave.indexOf("await uploadWorkoutProofMedia"));
  assert.doesNotMatch(screen, /localStorage/);
});
