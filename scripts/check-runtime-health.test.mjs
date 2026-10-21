import assert from "node:assert/strict";
import test from "node:test";
import { runHealthChecks } from "./check-runtime-health.mjs";

test("default checks are local-only, omit credentials and refuse redirects", async () => {
  const requests = [];
  const result = await runHealthChecks({ fetchImpl: async (url, options) => {
    requests.push(url);
    assert.equal(new URL(url).hostname, "127.0.0.1");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers, undefined);
    return new Response("fixture", { status: 200 });
  } });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 3);
});
test("hosted auth is not marked healthy without a public key or actual GoTrue response", async () => {
  const noKey = await runHealthChecks({ mode: "hosted", fetchImpl: async () => new Response("fixture") });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.checks.at(-1).reason, "public_key_not_configured");
  const wrongBody = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", fetchImpl: async () =>
    Response.json({ name: "not-auth" }) });
  assert.equal(wrongBody.ok, false);
});
test("privileged credentials are rejected before any network request", async () => {
  for (const key of ["sb_secret_fixture", `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.c`]) {
    await assert.rejects(runHealthChecks({ mode: "hosted", publicKey: key,
      fetchImpl: () => assert.fail("No network request allowed") }), /public|anon/);
  }
});
test("hosted checks use fixed targets and send the public key only to DEV Auth", async () => {
  const result = await runHealthChecks({ mode: "hosted", publicKey: "sb_publishable_fixture", fetchImpl: async (url, options) => {
    if (new URL(url).hostname.endsWith("supabase.co")) {
      assert.equal(url, "https://hgomsmhsybrxjdxbgkjy.supabase.co/auth/v1/health");
      assert.equal(options.headers.apikey, "sb_publishable_fixture");
      return Response.json({ name: "GoTrue" });
    }
    assert.equal(options.headers, undefined);
    return new Response("fixture");
  } });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /sb_publishable|apikey/);
});
test("network errors and failure response bodies cannot leak into reports", async () => {
  const result = await runHealthChecks({ fetchImpl: async () => { throw new Error("token=private"); } });
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result), /token=private/);
});
