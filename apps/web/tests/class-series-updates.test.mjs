import assert from "node:assert/strict";
import { test } from "node:test";
import { loadClassSeriesUpdates, subscribeToClassSeries } from "../src/lib/public/class-series-updates.ts";

const viewerId = "11111111-1111-4111-8111-111111111111";
const gymId = "22222222-2222-4222-8222-222222222222";
const seriesId = "33333333-3333-4333-8333-333333333333";
const classId = "44444444-4444-4444-8444-444444444444";
const announcementId = "55555555-5555-4555-8555-555555555555";
const otherId = "66666666-6666-4666-8666-666666666666";
const series = { id: seriesId, title: "Strength", time_zone: "Europe/Rome" };
const announcement = { id: announcementId, series_id: seriesId, class_id: classId, audience: "occurrence_attendees",
  occurrence_starts_at: "2099-01-05T18:00:00Z", time_zone: "Europe/Rome", body: "Class cancelled", created_at: "2099-01-04T12:00:00Z" };

function mockClient({ viewers = [viewerId], authError = null, lists = {}, readback, readError = null, readThrow,
  rpcData, rpcError = null, rpcThrow, beforeRead } = {}) {
  const calls = []; let authCount = 0;
  const client = {
    auth: { async getUser() {
      calls.push(["getUser"]); const id = viewers[Math.min(authCount++, viewers.length - 1)];
      return { data: { user: id ? { id } : null }, error: authError };
    } },
    async rpc(name, args) {
      calls.push(["rpc", name, structuredClone(args)]);
      if (rpcThrow) throw rpcThrow;
      return { data: rpcData === undefined ? { seriesId, subscribed: args.p_subscribed } : rpcData, error: rpcError };
    },
    from(table) {
      const call = ["from", table, []]; calls.push(call); let single = false;
      const query = {};
      for (const method of ["select", "eq", "order", "limit"]) query[method] = (...args) => { call[2].push([method, ...args]); return query; };
      query.maybeSingle = () => { single = true; call[2].push(["maybeSingle"]); return query; };
      query.then = (resolve, reject) => Promise.resolve().then(async () => {
        await beforeRead?.(); if (readThrow) throw readThrow;
        return { data: single ? (readback === undefined ? { series_id: seriesId } : readback) :
          (Object.hasOwn(lists, table) ? lists[table] : []), error: typeof readError === "function" ? readError(table) : readError };
      }).then(resolve, reject);
      return query;
    }
  };
  return { client, calls, authCount: () => authCount };
}

test("member load preserves audience, occurrence and timezone snapshots with scoped bounded queries", async () => {
  const mock = mockClient({ lists: { gym_class_series: [series], gym_class_series_subscriptions: [{ series_id: seriesId }], gym_class_announcements: [announcement] } });
  assert.deepEqual(await loadClassSeriesUpdates(mock.client, viewerId, gymId), { series: [series], subscriptions: [seriesId], announcements: [announcement] });
  assert.deepEqual(mock.calls, [["getUser"],
    ["from", "gym_class_series", [["select", "id,title,time_zone"], ["eq", "gym_id", gymId], ["order", "title"], ["limit", 200]]],
    ["from", "gym_class_series_subscriptions", [["select", "series_id"], ["eq", "user_id", viewerId]]],
    ["from", "gym_class_announcements", [["select", "id,series_id,class_id,audience,occurrence_starts_at,time_zone,body,created_at"], ["eq", "gym_id", gymId], ["order", "created_at", { ascending: false }], ["limit", 20]]], ["getUser"]]);
});

test("member load accepts empty and series-wide snapshots without fabricating occurrence times", async () => {
  assert.deepEqual(await loadClassSeriesUpdates(mockClient().client, viewerId, gymId), { series: [], subscriptions: [], announcements: [] });
  const row = { ...announcement, class_id: null, audience: "series_subscribers", occurrence_starts_at: null };
  const result = await loadClassSeriesUpdates(mockClient({ lists: { gym_class_announcements: [row] } }).client, viewerId, gymId);
  assert.deepEqual(result.announcements, [row]);
});

test("member load preserves occurrence snapshots after the original class has been deleted", async () => {
  const row = { ...announcement, class_id: null };
  const result = await loadClassSeriesUpdates(mockClient({ lists: { gym_class_announcements: [row] } }).client, viewerId, gymId);
  assert.deepEqual(result.announcements, [row]);
});

test("member load rejects each query failure and non-array result without partial data or raw details", async () => {
  for (const table of ["gym_class_series", "gym_class_series_subscriptions", "gym_class_announcements"]) {
    for (const options of [{ readError: name => name === table ? { message: "private" } : null }, { lists: { [table]: null } }, { lists: { [table]: {} } }]) {
      await assert.rejects(loadClassSeriesUpdates(mockClient(options).client, viewerId, gymId), error => /could not be loaded/.test(error.message) && !error.message.includes("private"));
    }
  }
});

test("all member entrypoints check expected getUser before reads/writes and again after success", async () => {
  for (const action of [client => loadClassSeriesUpdates(client, viewerId, gymId), client => subscribeToClassSeries(client, viewerId, seriesId, true)]) {
    for (const options of [{ viewers: [null] }, { viewers: [otherId] }, { authError: { message: "private" } }]) {
      const mock = mockClient(options); await assert.rejects(action(mock.client), /account changed/);
      assert.deepEqual(mock.calls, [["getUser"]]);
    }
    const mock = mockClient({ viewers: [viewerId, otherId] });
    await assert.rejects(action(mock.client), /account changed/);
    assert.equal(mock.authCount(), 2);
  }
});

test("member inputs reject invalid UUIDs and non-boolean subscription decisions before access", async () => {
  for (const [viewer, gym] of [["bad", gymId], [viewerId, "bad"]]) {
    const mock = mockClient(); await assert.rejects(loadClassSeriesUpdates(mock.client, viewer, gym)); assert.equal(mock.calls.length, 0);
  }
  for (const [viewer, id, decision] of [["bad", seriesId, true], [viewerId, "bad", true], ...["true", 1, null, undefined].map(value => [viewerId, seriesId, value])]) {
    const mock = mockClient(); await assert.rejects(subscribeToClassSeries(mock.client, viewer, id, decision)); assert.equal(mock.calls.length, 0);
  }
});

for (const subscribed of [true, false]) {
  test(`${subscribed ? "subscribe" : "unsubscribe"} requires exact acknowledgement and viewer/series readback`, async () => {
    const mock = mockClient({ readback: subscribed ? { series_id: seriesId } : null });
    assert.equal(await subscribeToClassSeries(mock.client, viewerId, seriesId, subscribed), undefined);
    assert.deepEqual(mock.calls, [["getUser"], ["rpc", "subscribe_gym_class_series", { p_series_id: seriesId, p_subscribed: subscribed }],
      ["from", "gym_class_series_subscriptions", [["select", "series_id"], ["eq", "series_id", seriesId], ["eq", "user_id", viewerId], ["maybeSingle"]]], ["getUser"]]);
  });
  test(`${subscribed ? "subscribe" : "unsubscribe"} rejects coerced, missing or mismatched acknowledgements`, async () => {
    for (const rpcData of [null, {}, [], true, { seriesId: otherId, subscribed }, { seriesId, subscribed: !subscribed }, { seriesId, subscribed: String(subscribed) }, { seriesId }]) {
      const mock = mockClient({ rpcData });
      await assert.rejects(subscribeToClassSeries(mock.client, viewerId, seriesId, subscribed), /could not be confirmed/);
      assert.equal(mock.calls.length, 2);
    }
  });
  test(`${subscribed ? "subscribe" : "unsubscribe"} never reports success on wrong or failed persisted state`, async () => {
    for (const options of [{ readback: subscribed ? null : { series_id: seriesId } }, { readback: { series_id: otherId } }, { readError: { message: "private" } }]) {
      const mock = mockClient(options);
      await assert.rejects(subscribeToClassSeries(mock.client, viewerId, seriesId, subscribed), /readback failed/);
      assert.equal(mock.authCount(), 2);
    }
  });
}

test("subscription stays pending through readback and never books or cancels a class", async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const mock = mockClient({ beforeRead: () => gate }); let complete = false;
  const pending = subscribeToClassSeries(mock.client, viewerId, seriesId, true).then(() => { complete = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(complete, false); assert.equal(mock.authCount(), 1);
  release(); await pending; assert.equal(mock.authCount(), 2);
  assert.deepEqual(mock.calls.filter(call => call[0] === "rpc").map(call => call[1]), ["subscribe_gym_class_series"]);
});

test("subscription transport errors, server errors and denied readback never resolve successfully", async () => {
  for (const options of [{ rpcThrow: new Error("offline") }, { rpcError: { code: "42501", message: "private" } }, { readThrow: new Error("offline") }]) {
    await assert.rejects(subscribeToClassSeries(mockClient(options).client, viewerId, seriesId, true));
  }
});

for (const [table, row] of [
  ["gym_class_series", null], ["gym_class_series", {}], ["gym_class_series", { ...series, id: "bad" }],
  ["gym_class_series", { ...series, title: 42 }], ["gym_class_series", { ...series, time_zone: "Mars/Base" }],
  ["gym_class_series_subscriptions", {}], ["gym_class_series_subscriptions", { series_id: "bad" }],
  ["gym_class_announcements", null], ["gym_class_announcements", {}],
  ...[{ body: null }, { id: "bad" }, { audience: "everyone" }, { created_at: "not-a-date" },
    { occurrence_starts_at: "not-a-date" }, { time_zone: "Mars/Base" }, { class_id: "bad" }, { series_id: "bad" }]
    .map(patch => ["gym_class_announcements", { ...announcement, ...patch }])
]) test(`member load rejects malformed ${table} row ${JSON.stringify(row)}`, async () => {
  await assert.rejects(loadClassSeriesUpdates(mockClient({ lists: { [table]: [row] } }).client, viewerId, gymId));
});
