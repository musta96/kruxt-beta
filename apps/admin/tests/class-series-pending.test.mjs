import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPending, savePending, clearPending, reconcilePending, redactExpiredPending, startPendingCleanup, PENDING_TTL, PENDING_NOTICE } from "../src/services/class-series-pending.ts";

const viewerId = "78000000-0000-4000-8000-000000000001";
const gymId = "78000000-0000-4000-8000-000000000010";
const requestId = "78000000-0000-4000-8000-000000000020";
const other = "78000000-0000-4000-8000-000000000099";
const publication = () => ({ draft: { version: 1, id: requestId, title: "Private class", timeZone: "Europe/Rome", startDate: "2099-05-04", endDate: "2099-05-11", slots: [{ id: "mon", weekday: 1, startTime: "20:00", endTime: "21:00" }], excludedDates: ["2099-05-11"] }, capacity: 17, description: "Private description" });
const announcement = () => ({ seriesId: other, requestId, audience: "occurrence_attendees", body: " Private announcement\n", classId: other, cancelOccurrence: true });
function fixture(kind = "publication") {
  const values = new Map();
  const calls = [];
  let now = 1800000000000, user = viewerId, current = true, row = null, error = null;
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(k) { calls.push("read"); return values.get(k) ?? null; },
    setItem(k, v) { calls.push("write"); values.set(k, v); },
    removeItem(k) { calls.push("remove"); values.delete(k); }
  };
  const client = {
    auth: { async getUser() { calls.push("auth"); return { data: { user: user ? { id: user } : null }, error: null }; } },
    from(table) {
      calls.push(["table", table]);
      return { select(columns) { calls.push(["select", columns]); return this; }, eq(k, v) { calls.push(["eq", k, v]); return this; }, async maybeSingle() { return { data: row, error }; } };
    }
  };
  const ctx = { client, scope: { viewerId, gymId, kind }, current: () => current, storage, now: () => now };
  return { ctx, values, calls, setNow(v) { now = v; }, setUser(v) { user = v; }, invalidate() { current = false; }, setRow(v) { row = v; }, setError(v) { error = v; }, raw() { return [...values.values()][0]; } };
}

for (const [kind, payload] of [["publication", publication], ["announcement", announcement]]) {
  test(`${kind}: exact complete payload and stable identifier survive reload`, async () => {
    const f = fixture(kind);
    const entry = await savePending(f.ctx, payload());
    assert.equal(entry.version, 1);
    assert.equal(entry.createdAt, 1800000000000);
    assert.equal(entry.requestId, requestId);
    assert.deepEqual((await loadPending({ ...f.ctx })).payload, payload());
    assert.deepEqual(f.calls.slice(0, 2), ["auth", "read"]);
    await assert.rejects(() => savePending(f.ctx, payload()), /existing pending/);
  });
  test(`${kind}: TTL removes sensitive content, retains tombstone indefinitely and blocks new requests`, async () => {
    const f = fixture(kind);
    const saved = await savePending(f.ctx, payload());
    f.setNow(saved.createdAt + PENDING_TTL - 1);
    assert.notEqual((await loadPending(f.ctx)).payload, null);
    f.setNow(saved.createdAt + PENDING_TTL);
    const expired = await loadPending(f.ctx);
    assert.equal(expired.payload, null);
    assert.equal(expired.requestId, requestId);
    assert.equal(f.raw().includes("Private"), false);
    assert.equal(f.raw().includes("2099-05"), false);
    f.setNow(saved.createdAt + PENDING_TTL * 900);
    assert.deepEqual(await loadPending(f.ctx), expired);
    await assert.rejects(() => savePending(f.ctx, payload()), /existing pending/);
    await clearPending(f.ctx, expired);
    assert.equal(await loadPending(f.ctx), null);
  });
}

test("storage is never read before server-verified identity, including signed-out and switched accounts", async () => {
  const f = fixture();
  await savePending(f.ctx, publication());
  for (const user of [null, other]) {
    f.setUser(user); f.calls.length = 0;
    await assert.rejects(() => loadPending(f.ctx), /account changed/);
    assert.deepEqual(f.calls, ["auth"]);
  }
});

test("an auth response arriving after cleanup cannot resurrect a payload or save it", async () => {
  for (const operation of [ctx => loadPending(ctx), ctx => savePending(ctx, publication())]) {
    const f = fixture();
    let finish;
    f.ctx.client.auth.getUser = () => new Promise(resolve => { finish = resolve; });
    const promise = operation(f.ctx);
    f.invalidate(); finish({ data: { user: { id: viewerId } }, error: null });
    await assert.rejects(promise, /account changed/);
    assert.equal(f.calls.includes("read"), false);
    assert.equal(f.values.size, 0);
  }
});

test("viewer, gym and operation have separate storage scopes", async () => {
  const f = fixture(); await savePending(f.ctx, publication());
  assert.equal(await loadPending({ ...f.ctx, scope: { ...f.ctx.scope, gymId: other } }), null);
  assert.equal(await loadPending({ ...f.ctx, scope: { ...f.ctx.scope, kind: "announcement" } }), null);
  f.setUser(other);
  assert.equal(await loadPending({ ...f.ctx, scope: { ...f.ctx.scope, viewerId: other } }), null);
  assert.equal(f.values.size, 1);
});

test("blocked, quota-failing or non-durable session storage never produces a dispatchable entry", async () => {
  const f = fixture();
  await assert.rejects(() => savePending({ ...f.ctx, storage: { ...f.ctx.storage, setItem() { throw new Error("QuotaExceededError"); } } }, publication()), /Quota/);
  await assert.rejects(() => savePending({ ...f.ctx, storage: { ...f.ctx.storage, setItem() {} } }, publication()), /durably save/);
  await assert.rejects(() => loadPending({ ...f.ctx, storage: { ...f.ctx.storage, getItem() { throw new Error("SecurityError"); } } }), /SecurityError/);
});

test("malformed, cross-scope, future, oversized and unsupported entries block instead of disappearing", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication()); const k = [...f.values.keys()][0];
  for (const raw of ["{", "x".repeat(100001), JSON.stringify({ ...saved, version: 2 }), JSON.stringify({ ...saved, viewerId: other }), JSON.stringify({ ...saved, gymId: other }), JSON.stringify({ ...saved, createdAt: saved.createdAt + 60001 }), JSON.stringify({ ...saved, payload: {} })]) {
    f.values.set(k, raw);
    await assert.rejects(() => loadPending(f.ctx), /blocked/);
    assert.equal(f.values.get(k), raw);
  }
});

test("payload bounds reject invalid dates, capacities, slots, private text and audience combinations", async () => {
  const invalidPublications = [
    { ...publication(), capacity: 0 }, { ...publication(), capacity: 10001 }, { ...publication(), description: "x".repeat(2001) },
    { ...publication(), draft: { ...publication().draft, startDate: "2099-02-30" } },
    { ...publication(), draft: { ...publication().draft, slots: [] } },
    { ...publication(), draft: { ...publication().draft, slots: Array(29).fill(publication().draft.slots[0]) } },
    { ...publication(), draft: { ...publication().draft, excludedDates: Array(367).fill("2099-05-04") } }
  ];
  for (const p of invalidPublications) { const f = fixture(); await assert.rejects(() => savePending(f.ctx, p)); assert.equal(f.values.size, 0); }
  for (const p of [{ ...announcement(), body: "x".repeat(2001) }, { ...announcement(), body: " " }, { ...announcement(), audience: "series_subscribers" }, { ...announcement(), classId: null }]) {
    const f = fixture("announcement"); await assert.rejects(() => savePending(f.ctx, p)); assert.equal(f.values.size, 0);
  }
});

test("failed and absent authoritative readbacks preserve both full requests and expired tombstones", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  assert.equal(await reconcilePending(f.ctx, saved), false);
  assert.notEqual(await loadPending(f.ctx), null);
  f.setNow(saved.createdAt + PENDING_TTL);
  f.setError({ code: "42501" });
  await assert.rejects(() => reconcilePending(f.ctx, saved), /Could not verify/);
  assert.equal((await loadPending(f.ctx)).payload, null);
  f.setError(null);
  f.setRow({ id: requestId, gym_id: gymId, created_by: other, publication_receipt: [{}] });
  assert.equal(await reconcilePending(f.ctx, saved), false);
  assert.equal(f.values.size, 1);
});

for (const kind of ["publication", "announcement"]) {
  test(`${kind}: positive authoritative receipt clears only the matching scoped request`, async () => {
    const f = fixture(kind); const saved = await savePending(f.ctx, kind === "publication" ? publication() : announcement());
    f.setNow(saved.createdAt + PENDING_TTL);
    f.setRow({ id: kind === "publication" ? requestId : other, gym_id: gymId, created_by: viewerId, request_id: requestId, publication_receipt: [{ id: other, key: `${requestId}/mon/2099-05-04`, startsAt: "2099-05-04T18:00:00Z", endsAt: "2099-05-04T19:00:00Z" }] });
    assert.equal(await reconcilePending(f.ctx, saved), true);
    assert.equal(await loadPending(f.ctx), null);
    assert.ok(f.calls.some(call => Array.isArray(call) && call[0] === "eq" && call[1] === "created_by" && call[2] === viewerId));
    assert.ok(f.calls.some(call => Array.isArray(call) && call[0] === "eq" && call[1] === "gym_id" && call[2] === gymId));
  });
}

test("a stale clear cannot remove a replacement request", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  await clearPending(f.ctx, saved);
  f.setNow(saved.createdAt + 1);
  const next = await savePending(f.ctx, publication());
  await assert.rejects(() => clearPending(f.ctx, saved), /blocked/);
  assert.deepEqual(await loadPending(f.ctx), next);
});

test("identity or lifecycle changes during readback cannot clear recovery", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  f.ctx.client.from = () => ({ select() { return this; }, eq() { return this; }, async maybeSingle() { f.invalidate(); return { data: { id: requestId, gym_id: gymId, created_by: viewerId, publication_receipt: [{}] }, error: null }; } });
  await assert.rejects(() => reconcilePending(f.ctx, saved));
  assert.equal(f.values.size, 1);
});

test("incomplete or malformed publication receipts never clear a tombstone", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  f.setNow(saved.createdAt + PENDING_TTL);
  const occurrence = { id: other, key: `${requestId}/mon/2099-05-04`, startsAt: "2099-05-04T18:00:00Z", endsAt: "2099-05-04T19:00:00Z" };
  for (const receipt of [null, [], [{}], [occurrence, occurrence], [{ ...occurrence, key: `${other}/mon/2099-05-04` }], [{ ...occurrence, startsAt: "not a date" }]]) {
    f.setRow({ id: requestId, gym_id: gymId, created_by: viewerId, publication_receipt: receipt });
    assert.equal(await reconcilePending(f.ctx, saved), false);
    assert.equal((await loadPending(f.ctx)).payload, null);
  }
});

test("failed retries do not age, replace, or clear an unknown request", async () => {
  const f = fixture("announcement"); const saved = await savePending(f.ctx, announcement());
  const raw = f.raw();
  f.setNow(saved.createdAt + 10000);
  for (let i = 0; i < 3; i++) {
    const restored = await loadPending(f.ctx);
    assert.deepEqual(restored, saved);
    // A transport failure or rejected replay has no authority to clear storage.
    await assert.rejects(async () => { throw new Error(i ? "Replay rejected" : "Network unavailable"); });
    assert.equal(f.raw(), raw);
  }
});

test("failed removal and changed identities preserve a recovery block", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  await assert.rejects(() => clearPending({ ...f.ctx, storage: { ...f.ctx.storage, removeItem() {} } }, saved), /blocked/);
  assert.equal(f.values.size, 1);
  f.setUser(other);
  await assert.rejects(() => clearPending(f.ctx, saved), /account changed/);
  assert.equal(f.values.size, 1);
});

test("consent notice explicitly describes unencrypted private tab storage and expiry", () => {
  assert.match(PENDING_NOTICE, /unencrypted/); assert.match(PENDING_NOTICE, /private/);
  assert.match(PENDING_NOTICE, /tab/); assert.match(PENDING_NOTICE, /24 hours/);
  assert.match(PENDING_NOTICE, /identifier-only/);
  assert.match(PENDING_NOTICE, /when the app resumes/);
  assert.match(PENDING_NOTICE, /Browsers may restore tab storage/);
  assert.doesNotMatch(PENDING_NOTICE, /at most|up to|Closing this tab ends/);
});

for (const [kind, payload] of [["publication", publication], ["announcement", announcement]]) {
  test(`${kind}: unauthenticated cleanup returns nothing, redacts only expired content and preserves recovery`, async () => {
    const f = fixture(kind);
    const saved = await savePending(f.ctx, payload());
    const raw = f.raw();
    f.setUser(null); f.invalidate(); f.calls.length = 0;
    assert.equal(redactExpiredPending(() => f.ctx.storage, saved.createdAt + PENDING_TTL - 1), undefined);
    assert.equal(f.raw(), raw);
    assert.equal(redactExpiredPending(() => f.ctx.storage, saved.createdAt + PENDING_TTL), undefined);
    assert.deepEqual(JSON.parse(f.raw()), { ...saved, payload: null });
    assert.equal(f.calls.includes("auth"), false);
    assert.equal(f.calls.includes("remove"), false);
    assert.equal(f.calls.some(call => Array.isArray(call)), false);
    const restored = { ...f.ctx, current: () => true };
    f.setUser(other);
    await assert.rejects(() => loadPending(restored), /account changed/);
    f.setUser(viewerId);
    assert.equal((await loadPending(restored)).payload, null);
    await assert.rejects(() => savePending(restored, payload()), /existing pending/);
    redactExpiredPending(() => f.ctx.storage, saved.createdAt + PENDING_TTL * 900);
    assert.deepEqual(JSON.parse(f.raw()), { ...saved, payload: null });
  });
}

test("cleanup scans all viewer/gym/kind scopes without touching unrelated or uncertain records", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  const name = [...f.values.keys()][0];
  const scoped = { ...saved, viewerId: other, gymId: other, kind: "announcement", payload: { private: "expired malformed payload" }, extra: "Private extra data" };
  const secondKey = `kruxt:class-series-pending:v1:${other}:${other}:announcement`;
  f.values.set(secondKey, JSON.stringify(scoped));
  const untouched = new Map([
    ["unrelated", f.raw()],
    [name + ":extra", f.raw()],
    [name.replace(":v1:", ":v2:"), f.raw()],
    [`kruxt:class-series-pending:v1:${other}:${gymId}:publication`, JSON.stringify({ ...saved, version: 2 })],
    [`kruxt:class-series-pending:v1:${viewerId}:${other}:publication`, "{"],
    [`kruxt:class-series-pending:v1:${viewerId}:${other}:announcement`, "x".repeat(100001)]
  ]);
  for (const [k, v] of untouched) f.values.set(k, v);
  redactExpiredPending(() => f.ctx.storage, saved.createdAt + PENDING_TTL);
  assert.deepEqual(JSON.parse(f.values.get(name)), { ...saved, payload: null });
  const { extra, ...expected } = scoped;
  assert.deepEqual(JSON.parse(f.values.get(secondKey)), { ...expected, payload: null });
  for (const [k, v] of untouched) assert.equal(f.values.get(k), v);
});

test("cleanup tolerates inaccessible storage and retries failed writes without removing tombstones", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  const now = saved.createdAt + PENDING_TTL;
  const raw = f.raw();
  assert.doesNotThrow(() => redactExpiredPending(() => { throw new Error("SecurityError"); }, now));
  assert.doesNotThrow(() => redactExpiredPending(() => ({ ...f.ctx.storage, setItem() { throw new Error("QuotaExceededError"); } }), now));
  assert.equal(f.raw(), raw);
  redactExpiredPending(() => f.ctx.storage, now);
  assert.equal(JSON.parse(f.raw()).payload, null);
  assert.equal(f.values.size, 1);
});

test("cleanup rejects mismatched/future envelopes and does not overwrite a replacement record", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  const name = [...f.values.keys()][0];
  const now = saved.createdAt + PENDING_TTL;
  for (const patch of [{ viewerId: other }, { gymId: other }, { kind: "announcement" }, { requestId: "bad" }, { createdAt: -1 }, { createdAt: now + 1 }]) {
    const raw = JSON.stringify({ ...saved, ...patch });
    f.values.set(name, raw);
    redactExpiredPending(() => f.ctx.storage, now);
    assert.equal(f.raw(), raw);
  }
  f.values.set(name, JSON.stringify(saved));
  let reads = 0;
  const replacement = JSON.stringify({ ...saved, requestId: other, createdAt: now });
  redactExpiredPending(() => ({ ...f.ctx.storage, getItem(k) {
    if (++reads === 2) f.values.set(k, replacement);
    return f.ctx.storage.getItem(k);
  } }), now);
  assert.equal(f.raw(), replacement);
});

test("global cleanup handles route/logout restart, periodic ticks, visibility/pageshow resume and teardown", async () => {
  const f = fixture(); const saved = await savePending(f.ctx, publication());
  const win = new EventTarget(), doc = new EventTarget();
  let tick, oldTick, interval, clears = 0, now = saved.createdAt;
  win.setInterval = (callback, ms) => { tick = callback; interval = ms; return 1; };
  win.clearInterval = () => { clears++; };
  const options = { window: win, document: doc, storage: () => f.ctx.storage, now: () => now };
  let stop = startPendingCleanup(options);
  assert.equal(interval, 60000);
  assert.notEqual(JSON.parse(f.raw()).payload, null);
  // The root provider restarts cleanup on route/account changes, not the series route.
  oldTick = tick; stop(); f.setUser(null); f.invalidate();
  now += PENDING_TTL;
  stop = startPendingCleanup(options);
  assert.equal(JSON.parse(f.raw()).payload, null);
  for (const trigger of [() => tick(), () => doc.dispatchEvent(new Event("visibilitychange")), () => win.dispatchEvent(new Event("pageshow"))]) {
    f.values.set([...f.values.keys()][0], JSON.stringify(saved));
    now += PENDING_TTL;
    trigger();
    assert.deepEqual(JSON.parse(f.raw()), { ...saved, payload: null });
  }
  stop();
  const calls = f.calls.length;
  tick(); oldTick();
  doc.dispatchEvent(new Event("visibilitychange")); win.dispatchEvent(new Event("pageshow"));
  assert.equal(f.calls.length, calls);
  assert.equal(clears, 2);
});
