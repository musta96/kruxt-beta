import assert from "node:assert/strict";
import test from "node:test";
import { openWorkspace, receiveWorkspace, resolveWorkspaceOrigin, trustedWorkspaceOrigin } from "./workspace-session.ts";

const platform = "https://kruxt-platform.vercel.app";
const admin = "https://kruxt-admin.vercel.app";
const projectUrl = "https://fixture.supabase.co";
const user = "00000000-0000-4000-8000-000000000001";
const session = { user: { id: user }, access_token: "SYNTHETIC_ACCESS", refresh_token: "SYNTHETIC_REFRESH" };
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

function client(initial) {
  let current = initial;
  const listeners = new Set();
  const calls = [];
  return { calls, emit(event, next) { current = next; for (const fn of [...listeners]) fn(event, next); }, auth: {
    async getUser() { return { data: { user: current?.user ?? null }, error: null }; },
    async getSession() { return { data: { session: current }, error: null }; },
    async setSession(tokens) { calls.push(tokens); current = { ...tokens, user: { id: user } }; return { data: { session: current }, error: null }; },
    async signOut() { current = null; },
    onAuthStateChange(fn) { listeners.add(fn); return { data: { subscription: { unsubscribe() { listeners.delete(fn); } } } }; }
  } };
}

function windowFixture(origin) {
  const win = new EventTarget();
  const values = new Map();
  let url = new URL(origin);
  win.location = { get origin() { return url.origin; }, get hash() { return url.hash; }, get pathname() { return url.pathname; },
    get href() { return url.href; }, set href(value) { url = new URL(value); win.navigate?.(); } };
  win.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  win.history = { replaceState(_a, _b, path) { url = new URL(path, url); } };
  win.crypto = globalThis.crypto;
  win.setTimeout = setTimeout;
  win.clearTimeout = clearTimeout;
  win.closed = false;
  win.close = () => { win.closed = true; };
  win.deliver = (data, origin, source) => {
    const event = new Event("message");
    Object.assign(event, { data, origin, source });
    win.dispatchEvent(event);
  };
  return win;
}

function pair(destinationSession = null) {
  const source = windowFixture(platform), target = windowFixture(admin);
  const sourceClient = client(session), targetClient = client(destinationSession);
  const messages = [];
  target.opener = source;
  source.open = () => target;
  source.postMessage = (data, origin) => { assert.equal(origin, platform); messages.push(data); source.deliver(data, admin, target); };
  target.postMessage = (data, origin) => { assert.equal(origin, admin); messages.push(data); target.deliver(data, platform, source); };
  return { source, target, sourceClient, targetClient, messages };
}

test("workspace destinations reject production loopback, wildcards, credentials and unexpected paths", () => {
  for (const bad of ["http://localhost:3100", "https://evil.vercel.app", `${platform}/login`, `https://name:pass@${new URL(platform).host}`, `${platform}?next=evil`]) {
    assert.equal(trustedWorkspaceOrigin(bad, "platform", admin), null);
  }
  assert.equal(resolveWorkspaceOrigin("platform", admin, ["http://localhost:3100"]), platform);
  assert.equal(trustedWorkspaceOrigin("http://localhost:3100", "platform", "http://localhost:3000"), "http://localhost:3100");
});

test("explicit handoff verifies the same account, installs once and keeps credentials out of URLs", async () => {
  const f = pair();
  let completed;
  let cancel;
  f.target.navigate = () => { cancel = receiveWorkspace({ win: f.target, client: f.targetClient, workspace: "admin", projectUrl,
    onComplete: path => { completed = path; }, onError: assert.fail }); };
  await openWorkspace({ win: f.source, client: f.sourceClient, workspace: "admin", projectUrl, origin: admin,
    expectedUser: user, prepare: async () => "/?gymId=fixture&source=platform" });
  assert.equal(completed, "/?gymId=fixture&source=platform");
  assert.deepEqual(f.targetClient.calls, [{ access_token: session.access_token, refresh_token: session.refresh_token }]);
  assert.doesNotMatch(f.target.location.href, /SYNTHETIC|access_token|refresh_token/);
  assert.equal(f.target.sessionStorage.getItem("kruxt-workspace-return-origin"), platform);
  const ready = f.messages.find(m => m.type === "ready");
  f.target.deliver({ ...ready, type: "credentials", ...session }, platform, f.source);
  await pause();
  assert.equal(f.targetClient.calls.length, 1);
  cancel();
});

test("a different destination identity is never overwritten", async () => {
  const f = pair({ ...session, user: { id: "other-account" } });
  let failure;
  f.target.navigate = () => receiveWorkspace({ win: f.target, client: f.targetClient, workspace: "admin", projectUrl,
    onComplete: assert.fail, onError: message => { failure = message; } });
  await assert.rejects(openWorkspace({ win: f.source, client: f.sourceClient, workspace: "admin", projectUrl, origin: admin,
    expectedUser: user, prepare: async () => "/" }), /destination could not verify/);
  assert.match(failure, /different account/);
  assert.equal(f.targetClient.calls.length, 0);
});

test("wrong-origin and wrong-window messages cannot obtain credentials", async () => {
  const f = pair();
  const pending = openWorkspace({ win: f.source, client: f.sourceClient, workspace: "admin", projectUrl, origin: admin,
    expectedUser: user, prepare: async () => "/", timeoutMs: 25 });
  const rejection = assert.rejects(pending, /timed out/);
  await pause(); await pause();
  const hash = new URLSearchParams(f.target.location.hash.slice(1));
  const ready = { protocol: "kruxt-workspace-v1", type: "ready", nonce: hash.get("nonce"), project: projectUrl, user };
  f.source.deliver(ready, "https://evil.vercel.app", f.target);
  f.source.deliver(ready, admin, {});
  await rejection;
  assert.ok(f.target.closed);
  assert.equal(f.messages.length, 0);
});

test("popup blocking and signout cancel without granting access", async () => {
  const f = pair();
  f.source.open = () => null;
  await assert.rejects(openWorkspace({ win: f.source, client: f.sourceClient, workspace: "admin", projectUrl, origin: admin,
    expectedUser: user, prepare: async () => "/" }), /blocked/);
  f.source.open = () => f.target;
  const pending = openWorkspace({ win: f.source, client: f.sourceClient, workspace: "admin", projectUrl, origin: admin,
    expectedUser: user, prepare: async () => "/" });
  const rejection = assert.rejects(pending, /cancelled/);
  f.sourceClient.emit("SIGNED_OUT", null);
  await rejection;
  assert.ok(f.target.closed);
  assert.equal(f.targetClient.calls.length, 0);
});
