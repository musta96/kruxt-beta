import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPublicFeed, loadWorkoutComments, requestFeedFollow } from "../src/lib/public/feed.ts";

function clientFor(rows, actions = []) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) },
    from(table) {
      const builder = { then(resolve, reject) { return Promise.resolve(rows[table] ?? { data: [], error: null }).then(resolve, reject); } };
      for (const method of ["select", "eq", "or", "in", "is", "order", "limit", "maybeSingle", "insert"]) {
        builder[method] = (...args) => { actions.push([table, method, ...args]); return builder; };
      }
      return builder;
    }
  };
}
test("feed fails closed when block preferences cannot be read", async () => {
  await assert.rejects(loadPublicFeed(clientFor({ user_blocks: { error: { message: "offline" } } }), "viewer"), /Safety preferences/);
});
test("viewer mismatch cannot load another person's feed or comments", async () => {
  await assert.rejects(loadPublicFeed(clientFor({}), "someone-else"), /session changed/);
  await assert.rejects(loadWorkoutComments(clientFor({}), "workout", "someone-else"), /session changed/);
});
test("blocked feed actors and comment authors stay hidden in both directions", async () => {
  const client = clientFor({
    user_blocks: { data: [{ blocker_user_id: "other", blocked_user_id: "viewer" }] },
    feed_events: { data: [{ id: "event", user_id: "other", workout_id: "workout" }] },
    social_interactions: { data: [{ id: "comment", actor_user_id: "other", comment_text: "hidden" }] }
  });
  assert.deepEqual(await loadPublicFeed(client, "viewer"), []);
  assert.deepEqual(await loadWorkoutComments(client, "workout", "viewer"), []);
});
test("follow requests distinguish accepted, pending, and blocked records", async () => {
  for (const status of ["accepted", "pending"]) {
    const actions = [];
    const result = await requestFeedFollow(clientFor({ social_connections: { data: { id: "connection", status } } }, actions), "other");
    assert.equal(result, status);
    assert.equal(actions.some(([, method]) => method === "insert"), false);
  }
  await assert.rejects(requestFeedFollow(clientFor({ social_connections: { data: { status: "blocked" } } }), "other"), /unavailable/);
});
test("new follow requests are always pending and scoped to the authenticated viewer", async () => {
  const actions = [];
  assert.equal(await requestFeedFollow(clientFor({ social_connections: { data: null } }, actions), "other"), "pending");
  assert.deepEqual(actions.find(([, method]) => method === "insert")[2], { follower_user_id: "viewer", followed_user_id: "other", status: "pending" });
});
