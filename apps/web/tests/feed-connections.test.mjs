import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFeedConnections, mutateFeedConnection } from "../src/lib/public/feed-connections.ts";

const viewer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const third = "33333333-3333-4333-8333-333333333333";
const connectionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function connection(id, follower, followed, status = "pending") {
  return { id, follower_user_id: follower, followed_user_id: followed, status };
}

function mockClient({ connections = [], blocks = [], profiles = [], viewers = [viewer], authError = false,
  fail, denyWrites = false, beforeExecute } = {}) {
  const tables = structuredClone({ social_connections: connections, user_blocks: blocks, profiles });
  const calls = [];
  let authCalls = 0;
  const client = {
    auth: {
      async getUser() {
        const id = viewers[Math.min(authCalls++, viewers.length - 1)];
        return { data: { user: id ? { id } : null }, error: authError ? { message: "private auth error" } : null };
      }
    },
    from(table) {
      const call = { table, action: "read", filters: [], selection: null, values: null };
      calls.push(call);
      let single = false;
      const query = {
        select(selection) { call.selection = selection; return query; },
        eq(column, value) { call.filters.push(["eq", column, value]); return query; },
        in(column, values) { call.filters.push(["in", column, values]); return query; },
        update(values) { call.action = "update"; call.values = values; return query; },
        delete() { call.action = "delete"; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(async () => {
            await beforeExecute?.(call);
            if (fail?.(call)) return { data: null, error: { message: "private database error" } };
            const rows = tables[table].filter((row) => call.filters.every(([op, column, value]) =>
              op === "eq" ? row[column] === value : value.includes(row[column])));
            const affected = call.action !== "read" && denyWrites ? [] : rows;
            if (call.action === "update") affected.forEach((row) => Object.assign(row, call.values));
            if (call.action === "delete") tables[table] = tables[table].filter((row) => !affected.includes(row));
            return { data: structuredClone(single ? affected[0] ?? null : affected), error: null };
          }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { client, calls, tables, authCalls: () => authCalls };
}

test("load queries only own incoming pending, outgoing pending/accepted, and own blocks", async () => {
  const mock = mockClient({
    connections: [
      connection(connectionId, other, viewer), connection(secondId, viewer, third, "accepted"),
      connection("wrong-incoming", other, third), connection("wrong-outgoing", third, other),
      connection("accepted-incoming", third, viewer, "accepted"), connection("social-blocked", viewer, other, "blocked")
    ],
    blocks: [{ blocker_user_id: viewer, blocked_user_id: other }, { blocker_user_id: third, blocked_user_id: viewer }],
    profiles: [{ id: other, display_name: "Alex", username: "alex" }, { id: third, display_name: null, username: "taylor" }]
  });
  const result = await loadFeedConnections(mock.client);
  assert.equal(result.viewerId, viewer);
  assert.deepEqual(result.incoming, []);
  assert.deepEqual(result.outgoing, [{ id: secondId, userId: third, label: "@taylor", status: "accepted" }]);
  assert.deepEqual(result.blocked, [{ userId: other, label: "Alex" }]);
  assert.deepEqual(mock.calls[0].filters, [["eq", "followed_user_id", viewer], ["eq", "status", "pending"]]);
  assert.deepEqual(mock.calls[1].filters, [["eq", "follower_user_id", viewer], ["in", "status", ["pending", "accepted"]]]);
  assert.deepEqual(mock.calls[2].filters, [["eq", "blocker_user_id", viewer]]);
  assert.equal(mock.calls[3].selection, "id,display_name,username");
  assert.equal(mock.authCalls(), 2);
});

test("incoming and outgoing retain real profile labels without exposing emails or raw IDs", async () => {
  for (const profile of [
    { id: other, display_name: "Casey", username: "casey" },
    { id: other, display_name: "private@example.test", username: "casey" },
    { id: other, display_name: other, username: "private@example.test" },
    { id: other, display_name: "   ", username: null }, null
  ]) {
    const mock = mockClient({ connections: [connection(connectionId, other, viewer), connection(secondId, viewer, other)], profiles: profile ? [profile] : [] });
    const result = await loadFeedConnections(mock.client);
    const expected = profile?.display_name === "Casey" ? "Casey" : profile?.username === "casey" ? "@casey" : "Member";
    assert.equal(result.incoming[0].label, expected);
    assert.equal(result.outgoing[0].label, expected);
  }
});

test("empty load avoids a profile query and does not fabricate rows", async () => {
  const mock = mockClient();
  assert.deepEqual(await loadFeedConnections(mock.client), { viewerId: viewer, incoming: [], outgoing: [], blocked: [] });
  assert.equal(mock.calls.length, 3);
});

test("all entrypoints require verified auth before any table access", async () => {
  for (const options of [{ viewers: [null] }, { authError: true }]) {
    const mock = mockClient(options);
    await assert.rejects(loadFeedConnections(mock.client), /Authentication required/);
    for (const action of ["accept", "decline", "remove", "unblock"]) {
      await assert.rejects(mutateFeedConnection(mock.client, viewer, action, connectionId), /Authentication required/);
    }
    assert.equal(mock.calls.length, 0);
  }
});

test("account switching invalidates loads and prevents stale UI mutations", async () => {
  const load = mockClient({ viewers: [viewer, other] });
  await assert.rejects(loadFeedConnections(load.client), /account changed/);
  for (const action of ["accept", "decline", "remove", "unblock"]) {
    const mutation = mockClient({ viewers: [other] });
    await assert.rejects(mutateFeedConnection(mutation.client, viewer, action, connectionId), /account changed/);
    assert.equal(mutation.calls.length, 0);
  }
});

test("accept and decline target only pending requests addressed to the verified viewer", async () => {
  for (const action of ["accept", "decline"]) {
    const mock = mockClient({ connections: [connection(connectionId, other, viewer)] });
    await mutateFeedConnection(mock.client, viewer, action, connectionId);
    assert.equal(mock.calls[0].action, action === "accept" ? "update" : "delete");
    assert.deepEqual(mock.calls[0].filters, [["eq", "id", connectionId], ["eq", "followed_user_id", viewer], ["eq", "status", "pending"]]);
    assert.equal(mock.calls[0].selection, "id");
    assert.deepEqual(mock.calls[0].values, action === "accept" ? { status: "accepted" } : null);
    assert.equal(mock.authCalls(), 2);
    assert.deepEqual(mock.tables.social_connections, action === "accept" ? [connection(connectionId, other, viewer, "accepted")] : []);
  }
});

test("cancel and unfollow delete only own pending or accepted outgoing records", async () => {
  for (const status of ["pending", "accepted"]) {
    const mock = mockClient({ connections: [connection(connectionId, viewer, other, status), connection(secondId, third, other)] });
    await mutateFeedConnection(mock.client, viewer, "remove", connectionId);
    assert.deepEqual(mock.calls[0].filters, [["eq", "id", connectionId], ["eq", "follower_user_id", viewer], ["in", "status", ["pending", "accepted"]]]);
    assert.deepEqual(mock.tables.social_connections, [connection(secondId, third, other)]);
  }
});

test("unblock deletes only the viewer-owned block pair and confirms the returned target", async () => {
  const reverse = { blocker_user_id: other, blocked_user_id: viewer };
  const mock = mockClient({ blocks: [{ blocker_user_id: viewer, blocked_user_id: other }, reverse] });
  await mutateFeedConnection(mock.client, viewer, "unblock", other);
  assert.deepEqual(mock.calls[0].filters, [["eq", "blocker_user_id", viewer], ["eq", "blocked_user_id", other]]);
  assert.equal(mock.calls[0].selection, "blocked_user_id");
  assert.deepEqual(mock.tables.user_blocks, [reverse]);
});

test("forged references, wrong directions and stale statuses never report success", async () => {
  const cases = [
    ["accept", connection(connectionId, viewer, other)], ["decline", connection(connectionId, viewer, other)],
    ["accept", connection(connectionId, other, viewer, "accepted")], ["decline", connection(connectionId, other, viewer, "blocked")],
    ["remove", connection(connectionId, other, viewer, "accepted")], ["remove", connection(connectionId, viewer, other, "blocked")]
  ];
  for (const [action, row] of cases) {
    const mock = mockClient({ connections: [row] });
    await assert.rejects(mutateFeedConnection(mock.client, viewer, action, connectionId), /not confirmed/);
    assert.deepEqual(mock.tables.social_connections, [row]);
  }
  const reverse = mockClient({ blocks: [{ blocker_user_id: other, blocked_user_id: viewer }] });
  await assert.rejects(mutateFeedConnection(reverse.client, viewer, "unblock", other), /not confirmed/);
});

test("RLS zero-row writes and database failures fail closed, with retry possible", async () => {
  for (const action of ["accept", "decline", "remove", "unblock"]) {
    for (const options of [{ denyWrites: true }, { fail: () => true }]) {
      const mock = mockClient({ ...options, connections: [connection(connectionId, other, viewer)], blocks: [{ blocker_user_id: viewer, blocked_user_id: other }] });
      await assert.rejects(mutateFeedConnection(mock.client, viewer, action, action === "unblock" ? other : connectionId), /not confirmed/);
    }
  }
  let failed = true;
  const mock = mockClient({ connections: [connection(connectionId, other, viewer)], fail: () => failed });
  await assert.rejects(mutateFeedConnection(mock.client, viewer, "accept", connectionId), /not confirmed/);
  failed = false;
  await mutateFeedConnection(mock.client, viewer, "accept", connectionId);
});

test("load errors from each table are surfaced without partial snapshots or raw server details", async () => {
  for (const table of ["social_connections", "user_blocks", "profiles"]) {
    const mock = mockClient({ connections: [connection(connectionId, other, viewer)], fail: (call) => call.table === table });
    await assert.rejects(loadFeedConnections(mock.client), (error) => /Unable to load/.test(error.message) && !error.message.includes("private"));
  }
});

test("invalid actions and references cannot reach a write query", async () => {
  for (const [action, id] of [["accept", "bad-id"], ["unknown", connectionId]]) {
    const mock = mockClient();
    await assert.rejects(mutateFeedConnection(mock.client, viewer, action, id), /Invalid/);
    assert.equal(mock.calls.length, 0);
  }
});

test("identity change during a confirmed write still rejects stale success", async () => {
  const mock = mockClient({ viewers: [viewer, other], connections: [connection(connectionId, other, viewer)] });
  await assert.rejects(mutateFeedConnection(mock.client, viewer, "accept", connectionId), /account changed/);
});

test("mutation promise stays pending until a returned row confirms the change", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const mock = mockClient({ connections: [connection(connectionId, other, viewer)], beforeExecute: () => gate });
  let completed = false;
  const mutation = mutateFeedConnection(mock.client, viewer, "accept", connectionId).then(() => { completed = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  release();
  await mutation;
  assert.equal(completed, true);
});
