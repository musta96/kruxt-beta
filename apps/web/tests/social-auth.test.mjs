import assert from "node:assert/strict";
import { test } from "node:test";
import { hasProviderReturnError, sanitizedAuthReturnUrl, safeInternalNextPath, startSocialSignIn, PROVIDER_RETURN_ERROR } from "../src/lib/auth/social-auth.ts";

test("callback errors are detected by presence, not reflected content", () => {
  for (const tail of ["?error=", "#error_description=secret", "?error_code=bad"]) {
    assert.equal(hasProviderReturnError(new URL("https://app.test/" + tail)), true);
  }
  assert.equal(hasProviderReturnError(new URL("https://app.test/#member-login")), false);
  assert.ok(!PROVIDER_RETURN_ERROR.includes("secret"));
});

test("cleanup removes auth secrets but preserves invite verification and internal next", () => {
  const result = sanitizedAuthReturnUrl(new URL("https://app.test/login?code=secret&token_hash=invite&type=invite&next=%2Fclasses#error_description=secret&refresh_token=secret&keep=1"));
  assert.equal(result, "/login?token_hash=invite&type=invite&next=%2Fclasses#keep=1");
  assert.equal(sanitizedAuthReturnUrl(new URL("https://app.test/?code=secret#member-login")), "/#member-login");
});

test("next rejects external URLs, backslashes, whitespace and login loops", () => {
  for (const value of [null, "https://evil.test", "//evil.test", "/\\\\evil.test", "/ /evil", "/\n/evil", "/login?next=/"]) {
    assert.equal(safeInternalNextPath(value), "/", String(value));
  }
  assert.equal(safeInternalNextPath("/classes?day=today#bookings"), "/classes?day=today#bookings");
});

test("provider checks fail closed, retry fresh, and only redirect after explicit true", async (t) => {
  const calls = [];
  const client = { auth: { signInWithOAuth: async (options) => { calls.push(options); return { error: null }; } } };
  const config = { url: "https://auth.test/", anonKey: "public-key" };
  let payload = { external: { google: false, apple: false } };
  let checks = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    checks++;
    assert.equal(url, "https://auth.test/auth/v1/settings");
    assert.equal(options.headers.apikey, "public-key");
    assert.equal(options.cache, "no-store");
    return new Response(JSON.stringify(payload));
  });
  for (const provider of ["google", "apple"]) {
    await assert.rejects(startSocialSignIn(client, config, provider, "https://app.test/login"), /not configured yet/);
  }
  for (payload of [{}, { external: { google: "true" } }, { external: {} }]) {
    await assert.rejects(startSocialSignIn(client, config, "google", "https://app.test/login"), /Cannot check/);
  }
  assert.equal(calls.length, 0);
  payload = { external: { google: true, apple: true } };
  for (const provider of ["google", "apple"]) {
    await startSocialSignIn(client, config, provider, "https://app.test/login");
    assert.deepEqual(calls.at(-1), { provider, options: { redirectTo: "https://app.test/login" } });
  }
  assert.equal(checks, 7);
});

test("HTTP, invalid JSON, offline and SDK failures are safe and retryable", async (t) => {
  let response = () => new Response("private upstream error", { status: 503 });
  t.mock.method(globalThis, "fetch", async () => response());
  const client = { auth: { signInWithOAuth: async () => { throw new Error("secret raw SDK message"); } } };
  const config = { url: "https://auth.test", anonKey: "public-key" };
  for (response of [
    () => new Response("private upstream error", { status: 503 }),
    () => new Response("not json"),
    () => { throw new Error("offline"); }
  ]) {
    await assert.rejects(startSocialSignIn(client, config, "apple", "https://app.test/login"), /Cannot check/);
  }
  response = () => new Response(JSON.stringify({ external: { apple: true } }));
  await assert.rejects(startSocialSignIn(client, config, "apple", "https://app.test/login"), { message: PROVIDER_RETURN_ERROR });
});

