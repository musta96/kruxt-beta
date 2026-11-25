import assert from "node:assert/strict";
import { test } from "node:test";
import { publishClassSeries, announceClassSeries, loadPublishedClassSeries, ClassSeriesUnconfirmedError } from "../src/services/class-series-publishing.ts";

const viewerId = "11111111-1111-4111-8111-111111111111";
const gymId = "22222222-2222-4222-8222-222222222222";
const seriesId = "33333333-3333-4333-8333-333333333333";
const classId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const announcementId = "66666666-6666-4666-8666-666666666666";
const otherId = "77777777-7777-4777-8777-777777777777";

function publication(patch = {}) {
  return { viewerId, gymId, capacity: 20, description: "Strength training",
    draft: { version: 1, id: seriesId, title: "Strength", timeZone: "UTC", startDate: "2099-01-05", endDate: "2099-01-05",
      slots: [{ id: "mon", weekday: 1, startTime: "18:00", endTime: "19:00" }], excludedDates: [] },
    occurrences: [{ key: `${seriesId}:2099-01-05:mon`, slotId: "mon", date: "2099-01-05", startTime: "18:00", endTime: "19:00",
      startsAt: "2099-01-05T18:00:00.000Z", endsAt: "2099-01-05T19:00:00.000Z", status: "planned" }], ...patch };
}
function receipt(input = publication(), patch = {}) {
  return { seriesId, replayed: false, occurrences: input.occurrences.filter(row => row.status === "planned")
    .map((row, i) => ({ id: i ? otherId : classId, key: row.key, startsAt: row.startsAt, endsAt: row.endsAt })), ...patch };
}
function announcement(patch = {}) {
  return { seriesId, audience: "series_subscribers", body: " Schedule update ", requestId, classId: null, cancelOccurrence: false, ...patch };
}
function mockClient({ viewers = [viewerId], authError = null, rpcResult, rpcThrow, readback, readError = null, readThrow,
  lists = {}, beforeRead } = {}) {
  const calls = [];
  let authCount = 0;
  const client = {
    auth: { async getUser() {
      calls.push(["getUser"]);
      const id = viewers[Math.min(authCount++, viewers.length - 1)];
      return { data: { user: id ? { id } : null }, error: authError };
    } },
    async rpc(name, args) {
      calls.push(["rpc", name, structuredClone(args)]);
      if (rpcThrow) throw rpcThrow;
      return rpcResult ?? { data: name === "publish_gym_class_series" ? receipt() : { announcementId, recipientCount: 2, channel: "in_app", replayed: false }, error: null };
    },
    from(table) {
      const call = ["from", table, []]; calls.push(call);
      let single = false;
      const query = {};
      for (const method of ["select", "eq", "not", "gte", "order", "limit"]) query[method] = (...args) => { call[2].push([method, ...args]); return query; };
      query.maybeSingle = () => { single = true; call[2].push(["maybeSingle"]); return query; };
      query.then = (resolve, reject) => Promise.resolve().then(async () => {
        await beforeRead?.();
        if (readThrow) throw readThrow;
        const fallback = table === "gym_class_series" ? { id: seriesId, gym_id: gymId, title: "Strength" }
          : { id: announcementId, gym_id: gymId, recipient_count: 2 };
        return { data: single ? (readback === undefined ? fallback : readback) : (lists[table] ?? []), error: readError };
      }).then(resolve, reject);
      return query;
    }
  };
  return { client, calls, authCount: () => authCount };
}
const actions = {
  publication: client => publishClassSeries(client, publication()),
  announcement: client => announceClassSeries(client, viewerId, gymId, announcement())
};

test("publication verifies exact receipt, scoped readback and identity before returning", async () => {
  const mock = mockClient();
  assert.deepEqual(await actions.publication(mock.client), { seriesId, count: 1, replayed: false });
  assert.deepEqual(mock.calls, [
    ["getUser"], ["rpc", "publish_gym_class_series", { p_gym_id: gymId, p_draft: publication().draft, p_capacity: 20, p_description: "Strength training", p_coach_user_id: null }],
    ["from", "gym_class_series", [["select", "id,gym_id,title"], ["eq", "id", seriesId], ["eq", "gym_id", gymId], ["maybeSingle"]]], ["getUser"]
  ]);
});

test("publication matches occurrence keys and instants, not receipt order or timezone spelling", async () => {
  const input = publication();
  input.occurrences.push({ ...input.occurrences[0], key: "second-slot", startsAt: "2099-01-05T20:00:00Z", endsAt: "2099-01-05T21:00:00Z" });
  input.occurrences.push({ ...input.occurrences[0], key: "excluded", status: "excluded", startsAt: null, endsAt: null });
  const data = receipt(input);
  data.occurrences.reverse();
  data.occurrences[1].startsAt = "2099-01-05T19:00:00+01:00";
  assert.deepEqual(await publishClassSeries(mockClient({ rpcResult: { data, error: null } }).client, input), { seriesId, count: 2, replayed: false });
});

test("publication rejects duplicate saved IDs even with the correct receipt count", async () => {
  const input = publication();
  input.occurrences.push({ ...input.occurrences[0], key: "second-slot" });
  const data = receipt(input); data.occurrences[1].id = classId;
  await assert.rejects(publishClassSeries(mockClient({ rpcResult: { data, error: null } }).client, input), ClassSeriesUnconfirmedError);
});

test("changed-payload key reuse rejection is terminal and does not rotate either request key", async () => {
  const changed = publication({ description: "Changed after an unknown outcome" });
  const publish = mockClient({ rpcResult: { data: null, error: { code: "22023" } } });
  await assert.rejects(publishClassSeries(publish.client, changed), error => !(error instanceof ClassSeriesUnconfirmedError) && /rejected/.test(error.message));
  assert.equal(publish.calls.filter(call => call[0] === "rpc").length, 1);
  assert.equal(publish.calls[1][2].p_draft.id, seriesId);
  const message = mockClient({ rpcResult: { data: null, error: { code: "22023" } } });
  await assert.rejects(announceClassSeries(message.client, viewerId, gymId, announcement({ body: "Changed message" })), error => !(error instanceof ClassSeriesUnconfirmedError) && /rejected/.test(error.message));
  assert.equal(message.calls.filter(call => call[0] === "rpc").length, 1);
  assert.equal(message.calls[1][2].p_request_id, requestId);
});

for (const [name, mutate] of [
  ["null", () => null], ["wrong series", d => ({ ...d, seriesId: otherId })], ["missing replay", d => ({ ...d, replayed: undefined })],
  ["string replay", d => ({ ...d, replayed: "false" })], ["missing occurrences", d => ({ ...d, occurrences: null })],
  ["zero occurrences", d => ({ ...d, occurrences: [] })], ["duplicate occurrence", d => ({ ...d, occurrences: [...d.occurrences, ...d.occurrences] })],
  ["bad id", d => ({ ...d, occurrences: [{ ...d.occurrences[0], id: "bad" }] })],
  ["wrong key", d => ({ ...d, occurrences: [{ ...d.occurrences[0], key: "foreign" }] })],
  ["wrong start", d => ({ ...d, occurrences: [{ ...d.occurrences[0], startsAt: "2099-01-06T18:00:00Z" }] })],
  ["wrong end", d => ({ ...d, occurrences: [{ ...d.occurrences[0], endsAt: null }] })],
  ["null occurrence", d => ({ ...d, occurrences: [null] })]
]) test(`publication rejects malformed acknowledgement: ${name}`, async () => {
  const mock = mockClient({ rpcResult: { data: mutate(receipt()), error: null } });
  await assert.rejects(actions.publication(mock.client), ClassSeriesUnconfirmedError);
  assert.equal(mock.calls.filter(call => call[0] === "from").length, 0);
});

for (const [name, action] of Object.entries(actions)) {
  test(`${name} refuses stale or unverified expected viewer before RPC`, async () => {
    for (const options of [{ viewers: [null] }, { viewers: [otherId] }, { authError: { message: "private" } }]) {
      const mock = mockClient(options);
      await assert.rejects(action(mock.client), /account changed/);
      assert.deepEqual(mock.calls, [["getUser"]]);
    }
  });
  test(`${name} cannot succeed until readback and post-operation getUser complete`, async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const mock = mockClient({ beforeRead: () => gate });
    let complete = false;
    const pending = action(mock.client).then(() => { complete = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(complete, false);
    assert.equal(mock.authCount(), 1);
    release(); await pending;
    assert.equal(mock.authCount(), 2);
  });
  test(`${name} classifies uncertain outcomes and readback failure without raw details`, async () => {
    for (const options of [
      { rpcThrow: new Error("private transport") }, { rpcResult: { data: null, error: { code: "08006", message: "private" } } },
      { readback: null }, { readback: { id: otherId, gym_id: gymId, recipient_count: 2 } },
      { readback: { id: name === "publication" ? seriesId : announcementId, gym_id: otherId, recipient_count: 2 } },
      { readError: { message: "private" } }, { readThrow: new Error("private") }, { viewers: [viewerId, otherId] }
    ]) await assert.rejects(action(mockClient(options).client), error => error instanceof ClassSeriesUnconfirmedError && !error.message.includes("private"));
  });
  test(`${name} distinguishes explicit rejection and unavailable migration from unknown outcome`, async () => {
    for (const code of ["42501", "22023", "22007", "22008", "23514", "40001", "P0001", "PGRST202", "42883"]) {
      const mock = mockClient({ rpcResult: { data: null, error: { code, message: "private" } } });
      await assert.rejects(action(mock.client), error => !(error instanceof ClassSeriesUnconfirmedError) && /rejected|not available/.test(error.message) && !error.message.includes("private"));
      assert.equal(mock.calls.length, 2);
    }
  });
  test(`${name} unknown outcome retries reuse the complete unchanged RPC request`, async () => {
    const lost = mockClient({ rpcThrow: new Error("lost acknowledgement") });
    await assert.rejects(action(lost.client), ClassSeriesUnconfirmedError);
    const data = name === "publication" ? receipt(publication(), { replayed: true }) : { announcementId, recipientCount: 2, channel: "in_app", replayed: true };
    const retry = mockClient({ rpcResult: { data, error: null } });
    assert.equal((await action(retry.client)).replayed, true);
    assert.deepEqual(retry.calls.find(call => call[0] === "rpc"), lost.calls.find(call => call[0] === "rpc"));
  });
}

test("publication replay after first start uses immutable receipt, not editable occurrence readback", async () => {
  const input = publication();
  input.occurrences[0] = { ...input.occurrences[0], startsAt: "2020-01-05T18:00:00Z", endsAt: "2020-01-05T19:00:00Z" };
  input.draft = { ...input.draft, startDate: "2020-01-05", endDate: "2020-01-05", slots: [{ id: "mon", weekday: 7, startTime: "18:00", endTime: "19:00" }] };
  input.occurrences[0].key = `${seriesId}:2020-01-05:mon`;
  input.occurrences[0].date = "2020-01-05";
  const mock = mockClient({ rpcResult: { data: receipt(input, { replayed: true }), error: null } });
  assert.deepEqual(await publishClassSeries(mock.client, input), { seriesId, count: 1, replayed: true });
  assert.deepEqual(mock.calls.filter(call => call[0] === "from").map(call => call[1]), ["gym_class_series"], "editable gym_classes must not override immutable receipt times");
});

test("publication input boundaries reject before RPC", async () => {
  for (const patch of [{ gymId: "bad" }, { draft: { ...publication().draft, id: "bad" } },
    ...[0, 10001, 1.5, NaN, "20"].map(capacity => ({ capacity })), { description: "x".repeat(2001) },
    { occurrences: [] }, { occurrences: Array(1501).fill(publication().occurrences[0]) },
    { occurrences: [{ ...publication().occurrences[0], status: "invalid_time" }] }]) {
    const mock = mockClient();
    await assert.rejects(publishClassSeries(mock.client, publication(patch)));
    assert.equal(mock.calls.length, 0);
  }
  for (const capacity of [1, 10000]) await publishClassSeries(mockClient().client, publication({ capacity, description: "x".repeat(2000) }));
});

test("publication rejects unparsable or reversed instants before RPC", async () => {
  for (const times of [{ startsAt: "not-a-date" }, { endsAt: "not-a-date" }, { endsAt: "2099-01-05T17:00:00Z" }]) {
    const input = publication(); input.occurrences[0] = { ...input.occurrences[0], ...times };
    const mock = mockClient({ rpcResult: { data: receipt(input), error: null } });
    await assert.rejects(publishClassSeries(mock.client, input));
    assert.equal(mock.calls.filter(call => call[0] === "rpc").length, 0);
  }
});

test("announcement sends separate audience/cancellation intents and trusts only confirmed recipient count", async () => {
  for (const input of [announcement(), announcement({ audience: "occurrence_attendees", classId, cancelOccurrence: true }), announcement({ audience: "occurrence_attendees", classId })]) {
    const mock = mockClient();
    assert.deepEqual(await announceClassSeries(mock.client, viewerId, gymId, input), { announcementId, recipientCount: 2, replayed: false });
    assert.deepEqual(mock.calls[1], ["rpc", "announce_gym_class_series", { p_series_id: seriesId, p_audience: input.audience, p_body: "Schedule update", p_request_id: requestId, p_class_id: input.classId, p_cancel_occurrence: input.cancelOccurrence }]);
    assert.deepEqual(mock.calls[2], ["from", "gym_class_announcements", [["select", "id,gym_id,recipient_count"], ["eq", "id", announcementId], ["eq", "gym_id", gymId], ["maybeSingle"]]]);
    assert.equal(mock.authCount(), 2);
    assert.equal(mock.calls.some(call => /recipients|bookings|waitlist|subscriptions/.test(call[1] ?? "")), false, "client must not calculate a distinct recipient count from overlapping audience rows");
  }
});

test("announcement rejects invalid acknowledgement fields and mismatched count readback", async () => {
  for (const patch of [{ announcementId: "bad" }, { recipientCount: -1 }, { recipientCount: 1.5 }, { recipientCount: "2" }, { channel: "email" }, { replayed: "true" }]) {
    const mock = mockClient({ rpcResult: { data: { announcementId, recipientCount: 2, channel: "in_app", replayed: false, ...patch }, error: null } });
    await assert.rejects(actions.announcement(mock.client), ClassSeriesUnconfirmedError);
    assert.equal(mock.calls.length, 2);
  }
  await assert.rejects(actions.announcement(mockClient({ readback: { id: announcementId, gym_id: gymId, recipient_count: 3 } }).client), ClassSeriesUnconfirmedError);
  const zero = mockClient({ rpcResult: { data: { announcementId, recipientCount: 0, channel: "in_app", replayed: false }, error: null }, readback: { id: announcementId, gym_id: gymId, recipient_count: 0 } });
  assert.equal((await actions.announcement(zero.client)).recipientCount, 0);
});

test("announcement validates body, identifiers and audience combinations before auth", async () => {
  for (const patch of [{ seriesId: "bad" }, { requestId: "bad" }, { body: " \n " }, { body: "x".repeat(2001) }, { audience: "everyone" },
    { classId }, { cancelOccurrence: true }, { audience: "occurrence_attendees", classId: null }]) {
    const mock = mockClient(); await assert.rejects(announceClassSeries(mock.client, viewerId, gymId, announcement(patch)));
    assert.equal(mock.calls.length, 0);
  }
  await announceClassSeries(mockClient().client, viewerId, gymId, announcement({ body: "x".repeat(2000) }));
});

test("announcement rejects non-boolean cancellation decisions before RPC", async () => {
  for (const cancelOccurrence of [undefined, null, 0, "false"]) {
    const mock = mockClient();
    await assert.rejects(announceClassSeries(mock.client, viewerId, gymId, announcement({ audience: "occurrence_attendees", classId, cancelOccurrence })));
    assert.equal(mock.calls.length, 0);
  }
});

test("admin lists are gym scoped, ordered, bounded, future filtered and identity checked twice", async () => {
  const mock = mockClient();
  assert.deepEqual(await loadPublishedClassSeries(mock.client, viewerId, gymId), { series: [], occurrences: [] });
  assert.equal(mock.authCount(), 2);
  const reads = mock.calls.filter(call => call[0] === "from");
  assert.deepEqual(reads[0], ["from", "gym_class_series", [["select", "id,title,time_zone,capacity"], ["eq", "gym_id", gymId], ["order", "created_at", { ascending: false }], ["limit", 200]]]);
  assert.deepEqual(reads[1][2].filter(([method]) => method !== "gte"), [["select", "id,series_id,title,starts_at,ends_at,status"], ["eq", "gym_id", gymId], ["not", "series_id", "is", null], ["order", "starts_at"], ["limit", 500]]);
  const cutoff = reads[1][2].find(([method]) => method === "gte");
  assert.equal(cutoff[1], "ends_at"); assert.ok(Number.isFinite(Date.parse(cutoff[2])));
});

test("admin list rejects auth changes, errors and non-array snapshots", async () => {
  for (const options of [{ viewers: [null] }, { viewers: [viewerId, otherId] }, { readError: { message: "private" } },
    { lists: { gym_class_series: {} } }, { lists: { gym_classes: {} } }]) {
    await assert.rejects(loadPublishedClassSeries(mockClient(options).client, viewerId, gymId), error => !error.message.includes("private"));
  }
});

test("admin list accepts complete valid rows without rewriting persisted occurrence times", async () => {
  const series = { id: seriesId, title: "Strength", time_zone: "Europe/Rome", capacity: 20 };
  const occurrence = { id: classId, series_id: seriesId, title: "Strength", starts_at: "2099-01-06T20:00:00Z", ends_at: "2099-01-06T21:00:00Z", status: "scheduled" };
  const mock = mockClient({ lists: { gym_class_series: [series], gym_classes: [occurrence] } });
  assert.deepEqual(await loadPublishedClassSeries(mock.client, viewerId, gymId), { series: [series], occurrences: [occurrence] });
});

for (const [table, row] of [
  ["gym_class_series", null], ["gym_class_series", {}], ["gym_class_series", { id: seriesId, title: "Strength", time_zone: "Mars/Base", capacity: 20 }],
  ["gym_class_series", { id: seriesId, title: "Strength", time_zone: "UTC", capacity: "20" }],
  ["gym_classes", null], ["gym_classes", {}],
  ["gym_classes", { id: classId, series_id: seriesId, title: "Strength", starts_at: "invalid", ends_at: "2099-01-05T19:00:00Z", status: "scheduled" }]
]) test(`admin list rejects malformed ${table} row ${JSON.stringify(row)}`, async () => {
  await assert.rejects(loadPublishedClassSeries(mockClient({ lists: { [table]: [row] } }).client, viewerId, gymId));
});
