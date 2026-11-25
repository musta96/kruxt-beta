import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Bundle the real service to support its parameter property and extensionless import.
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite"));
const { build } = viteRequire("esbuild");
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/services/feed-service.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false
});
const { FeedService } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

for (const proof of [
  {
    proof_media_url: "https://example.supabase.co/storage/v1/object/public/proofs/legacy.jpg",
    proof_media_type: "image",
    proof_media_thumbnail_url: "https://example.supabase.co/storage/v1/object/public/proofs/thumb.jpg"
  },
  {
    proof_media_url: "https://untrusted.example/tracking.mp4",
    proof_media_type: "video",
    proof_media_thumbnail_url: "javascript:alert('thumbnail')"
  },
  {
    proof_media_url: "javascript:alert('proof')",
    proof_media_type: "image",
    proof_media_thumbnail_url: "data:image/svg+xml,<svg onload=alert('proof') />"
  }
]) {
  test(`listHomeFeed quarantines legacy proof: ${proof.proof_media_url}`, async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      throw new Error("Feed must not fetch proof media");
    });
    let storageAccesses = 0;
    const queries: { table: string; columns?: string }[] = [];
    const createdAt = new Date().toISOString();
    const workout = {
      id: "workout-1",
      user_id: "athlete-1",
      gym_id: "gym-1",
      title: "Evening strength",
      workout_type: "strength",
      started_at: createdAt,
      visibility: "public",
      total_sets: 12,
      total_volume_kg: 2400,
      is_pr: true,
      ...proof
    };
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: "viewer-1" } }, error: null }) },
      get storage() {
        storageAccesses += 1;
        throw new Error("Feed must not access storage or sign proof URLs");
      },
      from(table: string) {
        const query: { table: string; columns?: string } = { table };
        queries.push(query);
        const chain = {
          select(columns: string) { query.columns = columns; return chain; },
          order() { return chain; },
          limit() { return chain; },
          eq() { return chain; },
          in() { return chain; },
          maybeSingle() { return chain; },
          then(resolve: (response: unknown) => unknown, reject: (error: unknown) => unknown) {
            const rows: Record<string, unknown> = {
              feed_events: [{
                id: "event-1", user_id: "athlete-1", workout_id: "workout-1",
                event_type: "pr_verified", caption: "New personal best",
                metadata: { sets: 12 }, created_at: createdAt
              }],
              // Deliberately return extra legacy fields even though not selected.
              workouts: [workout],
              profiles: query.columns === "id,home_gym_id"
                ? { id: "viewer-1", home_gym_id: "gym-1" }
                : [{
                    id: "athlete-1", username: "athlete", display_name: "Test Athlete",
                    avatar_url: null, rank_tier: "bronze", level: 3, home_gym_id: "gym-1"
                  }],
              social_interactions: [
                { workout_id: "workout-1", interaction_type: "reaction", reaction_type: "fire", actor_user_id: "viewer-1" },
                { workout_id: "workout-1", interaction_type: "comment", reaction_type: null, actor_user_id: "athlete-1" }
              ],
              social_connections: [{ followed_user_id: "athlete-1" }],
              feature_flags: { enabled: true }
            };
            assert.ok(Object.hasOwn(rows, table), `Unexpected table: ${table}`);
            return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject);
          }
        };
        return chain;
      }
    };

    const feed = await new FeedService(supabase).listHomeFeed({ limit: 10 });

    assert.equal(feed.length, 1);
    const item = feed[0];
    assert.deepEqual(item.workout, {
      id: workout.id, userId: workout.user_id, gymId: workout.gym_id,
      title: workout.title, workoutType: workout.workout_type, startedAt: createdAt,
      visibility: "public", totalSets: 12, totalVolumeKg: 2400, isPr: true,
      proofMediaUrl: null, proofMediaType: null, proofMediaThumbnailUrl: null
    });
    assert.equal(item.eventId, "event-1");
    assert.equal(item.eventType, "pr_verified");
    assert.equal(item.caption, "New personal best");
    assert.deepEqual(item.metadata, { sets: 12 });
    assert.equal(item.actor.displayName, "Test Athlete");
    assert.deepEqual(item.engagement, { reactionCount: 1, commentCount: 1, viewerReaction: "fire" });
    assert.equal(item.rankingSignals.socialBoost, 15);
    assert.equal(item.rankingSignals.gymBoost, 8);
    assert.equal(item.rankingSignals.experimentBoost, 5);
    assert.ok(Number.isFinite(item.score));
    const serialized = JSON.stringify(feed);
    assert.ok(!serialized.includes(proof.proof_media_url));
    assert.ok(!serialized.includes(proof.proof_media_thumbnail_url));
    const workoutQueries = queries.filter((query) => query.table === "workouts");
    assert.equal(workoutQueries.length, 1);
    assert.equal(workoutQueries[0].columns,
      "id,user_id,gym_id,title,workout_type,started_at,visibility,total_sets,total_volume_kg,is_pr");
    assert.equal(storageAccesses, 0);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}
