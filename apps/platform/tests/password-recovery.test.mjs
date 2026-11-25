import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/services/password-recovery.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { captureRecoveryEvents, isRecoverySession, clearRecoverySession, initializeRecovery } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const session = () => ({ access_token: "mock-recovery-token", expires_at: Math.floor(Date.now() / 1000) + 600, user: { id: "mock-user" } });
function client() {
  let callback;
  return {
    auth: {
      onAuthStateChange(fn) { callback = fn; },
      async initialize() { return { error: null }; },
      async getSession() { return { data: { session: session() }, error: null }; },
    },
    emit(event, value = session()) { callback(event, value); },
  };
}

test("ordinary login, stored session and INITIAL_SESSION never prove recovery", () => {
  const c = client();
  captureRecoveryEvents(c, false);
  for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"]) {
    c.emit(event);
    assert.equal(isRecoverySession(c, session()), false);
  }
});

test("PASSWORD_RECOVERY proves only its matching, unexpired session", () => {
  const c = client();
  captureRecoveryEvents(c, false);
  c.emit("PASSWORD_RECOVERY");
  assert.equal(isRecoverySession(c, session()), true);
  assert.equal(isRecoverySession(c, { ...session(), access_token: "other-token" }), false);
  assert.equal(isRecoverySession(c, { ...session(), expires_at: 1 }), false);
  assert.equal(isRecoverySession(c, null), false);
});

test("same-browser PKCE marker permits one successful exchange, not a later login", () => {
  const c = client();
  captureRecoveryEvents(c, true);
  assert.equal(isRecoverySession(c, session()), false);
  c.emit("SIGNED_IN");
  assert.equal(isRecoverySession(c, session()), true);
  c.emit("SIGNED_IN");
  assert.equal(isRecoverySession(c, session()), true);
  c.emit("SIGNED_IN", { ...session(), access_token: "different-login-token" });
  assert.equal(isRecoverySession(c, session()), false);
});

test("signout and password update consumption invalidate recovery proof", () => {
  const c = client();
  captureRecoveryEvents(c, false);
  c.emit("PASSWORD_RECOVERY");
  clearRecoverySession(c);
  assert.equal(isRecoverySession(c, session()), false);
  c.emit("PASSWORD_RECOVERY");
  c.emit("SIGNED_OUT", null);
  assert.equal(isRecoverySession(c, session()), false);
});

test("initialization owns URL consumption; cleanup waits for SDK completion", async () => {
  const c = client();
  let complete;
  c.auth.initialize = () => new Promise((resolve) => { complete = resolve; });
  let cleaned = false;
  globalThis.window = { location: { pathname: "/reset-password" }, history: { state: null, replaceState(_state, _title, path) { cleaned = path === "/reset-password"; } } };
  captureRecoveryEvents(c, false);
  const result = initializeRecovery(c);
  assert.equal(cleaned, false);
  c.emit("PASSWORD_RECOVERY");
  complete({ error: null });
  assert.equal(await result, true);
  assert.equal(cleaned, true);
  delete globalThis.window;
});

test("failed exchange fails closed even if an ordinary session is present", async () => {
  const c = client();
  captureRecoveryEvents(c, true);
  c.auth.initialize = async () => ({ error: new Error("private expired link detail") });
  globalThis.window = { location: { pathname: "/reset-password" }, history: { replaceState() {} } };
  assert.equal(await initializeRecovery(c), false);
  assert.equal(isRecoverySession(c, session()), false);
  delete globalThis.window;
});

test("implicit recovery event dispatched after initialization is accepted", async () => {
  const c = client();
  captureRecoveryEvents(c, false);
  c.auth.initialize = async () => {
    setTimeout(() => c.emit("PASSWORD_RECOVERY"), 0);
    return { error: null };
  };
  globalThis.window = { location: { pathname: "/reset-password" }, history: { replaceState() {} } };
  assert.equal(await initializeRecovery(c), true);
  delete globalThis.window;
});
