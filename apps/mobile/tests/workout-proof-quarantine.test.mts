import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const service = fileURLToPath(new URL("../src/services/workout-service.ts", import.meta.url));
const errors = fileURLToPath(new URL("../src/services/errors.ts", import.meta.url));
const flowPath = fileURLToPath(new URL("../src/flows/phase3-workout-logger-ui.ts", import.meta.url));
const bundle = await build({
  stdin: { resolveDir: fileURLToPath(new URL("..", import.meta.url)), contents:
    `export {WorkoutService} from ${JSON.stringify(service)};export {createPhase3WorkoutLoggerUiFlow} from ${JSON.stringify(flowPath)};` },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "native-proof-fixture", setup(builder) {
    builder.onResolve({ filter: /^@kruxt\/types$/ }, () => ({ path: "types", namespace: "fixture" }));
    builder.onResolve({ filter: /^\.\.\/services$/ }, () => ({ path: "services", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "types"
      ? "export const translateLegalText=key=>key;"
      : `export {WorkoutService} from ${JSON.stringify(service)};export {KruxtAppError} from ${JSON.stringify(errors)};export const createMobileSupabaseClient=()=>globalThis.__nativeProofClient;`,
      loader: "js", resolveDir: fileURLToPath(new URL("..", import.meta.url)) }));
  } }]
});
const { WorkoutService, createPhase3WorkoutLoggerUiFlow } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const legacy = "https://example.test/storage/v1/object/public/workout-proof/legacy.mp4";

function clientFixture() {
  const calls = { writes: 0, storage: 0, selections: [] as string[] };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "athlete" } }, error: null }) },
    get storage() { calls.storage++; throw Error("Storage must never be touched"); },
    rpc: async (name: string) => {
      if (name === "user_has_required_consents") return { data: true, error: null };
      assert.equal(name, "log_workout_atomic"); calls.writes++;
      return { data: "workout", error: null };
    },
    from(table: string) {
      const chain = {
        select(columns: string) { calls.selections.push(columns); return chain; }, eq() { return chain; }, order() { return chain; },
        maybeSingle() { return chain; },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          const data = table === "workouts" ? {
            id: "workout", user_id: "athlete", title: "Saved session", total_sets: 1, total_volume_kg: 100,
            proof_media_url: legacy, proof_media_type: "video", proof_media_thumbnail_url: legacy + "_thumb.jpg"
          } : table === "feed_events" ? [{ id: "event", workout_id: "workout", event_type: "workout_logged" }]
            : { id: "athlete", xp_total: 10, level: 1, rank_tier: "initiate", chain_days: 1, last_workout_at: "2026-11-01T10:00:00Z" };
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
      return chain;
    }
  };
  return { client, calls };
}

test("all proof inputs are blocked before authentication, file reads, storage or thumbnail access", async t => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw Error("Unexpected file/network access"); });
  const client = new Proxy({}, { get() { throw Error("Unexpected client access"); } });
  for (const uri of ["file:///photo.jpg", "file:///video.mov", legacy, "javascript:alert(1)", ""]) {
    for (const mimeType of ["image/jpeg", "video/mp4", null]) {
      await assert.rejects(new WorkoutService(client).attachProofMedia("workout", { uri, mimeType }), (error: { code: string; message: string }) => {
        assert.equal(error.code, "WORKOUT_PROOF_UNAVAILABLE");
        assert.ok(!error.message.includes(uri) || !uri);
        return true;
      });
    }
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("workout logging remains available and legacy proof fields cannot escape readback", async () => {
  const { client, calls } = clientFixture();
  const result = await new WorkoutService(client).logWorkoutAtomic({ workout: { title: "Saved session" }, exercises: [{ exerciseId: "squat", sets: [{ reps: 5 }] }] });
  assert.equal(result.workoutId, "workout");
  assert.equal(result.workout.totalSets, 1);
  assert.equal(result.workout.proofMediaUrl, null);
  assert.equal(result.workout.proofMediaType, null);
  assert.equal(result.workout.proofMediaThumbnailUrl, null);
  assert.equal(calls.writes, 1); assert.equal(calls.storage, 0);
  assert.ok(calls.selections.every(columns => !columns.includes("proof_media")));
  assert.ok(!JSON.stringify(result).includes(legacy));
});

for (const hasMedia of [false, true]) test(`logger returns saved success ${hasMedia ? "with an honest media warning" : "without a false media warning"}`, async t => {
  const { client, calls } = clientFixture();
  Object.assign(globalThis, { __nativeProofClient: client });
  t.after(() => { delete (globalThis as Record<string, unknown>).__nativeProofClient; });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw Error("Unexpected media read"); });
  const flow = createPhase3WorkoutLoggerUiFlow();
  const draft = flow.createDraft({ metadata: { title: "Training", workoutType: "strength", visibility: "private" },
    exercises: [{ clientId: "exercise", exerciseId: "squat", blockType: "straight_set", sets: [{ clientId: "set", reps: 5 }] }],
    proofMedia: hasMedia ? { uri: legacy, mimeType: "video/mp4" } : null });
  const result = await flow.submit(draft);
  assert.equal(result.ok, true);
  assert.equal(result.result.workoutId, "workout");
  assert.equal(calls.writes, 1); assert.equal(calls.storage, 0);
  assert.equal(fetchMock.mock.callCount(), 0);
  if (hasMedia) assert.match(result.mediaWarning, /saved without media/);
  else assert.equal(result.mediaWarning, undefined);
  assert.equal(result.result.workout.proofMediaUrl, null);
});

test("logger UI cannot request photo access or render old draft proof URLs", () => {
  const source = readFileSync(new URL("../src/screens/WorkoutLoggerScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ImagePicker|requestCameraPermissions|launchCamera|launchImageLibrary|proofMedia\.uri/);
  assert.match(source, /Media attachments are temporarily unavailable/);
  assert.match(source, /Remove media attachment/);
  assert.match(source, /"Workout saved"/);
  assert.match(source, /result\.mediaWarning/);
});
