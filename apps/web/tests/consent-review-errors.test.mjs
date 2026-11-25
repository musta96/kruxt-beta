import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  acceptRequiredConsentPolicies,
  hasRequiredConsents,
  loadRequiredConsentPolicies,
  requiredConsentErrorMessage,
  verifyRequiredConsentPolicyDocument
} from "../src/lib/auth/required-consents.ts";

const secret = "<script>private-schema token=secret@example.test</script>";
const loadMessage = "Unable to load required policies. Try again or contact support.";
const acceptMessage = "Unable to record required consents. Try again or contact support.";
const bytes = Buffer.from("Approved review copy\n");
const row = {
  id: "terms-v1", policy_type: "terms", version: "1", label: secret,
  document_url: "https://example.test/terms.txt",
  checksum: createHash("sha256").update(bytes).digest("hex"),
  effective_at: "2020-01-01T00:00:00Z", is_active: true, change_summary: null
};
const policy = {
  id: row.id, consentType: "terms", label: secret,
  documentUrl: row.document_url, checksum: row.checksum
};
const gap = { consent_type: "terms", required_policy_version_id: row.id, reason: "missing" };

function client({ gaps = [gap], rows = [row], gapError = null, policyError = null, acceptError = null } = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, params) {
      calls.push([name, params]);
      if (name === "user_has_required_consents") return { data: false, error: gapError };
      if (name === "list_missing_required_consents") return { data: gaps, error: gapError };
      assert.equal(name, "accept_required_consents");
      return { error: acceptError };
    },
    from(table) {
      assert.equal(table, "policy_version_tracking");
      return { select: () => ({ in: async () => ({ data: rows, error: policyError }) }) };
    }
  };
}

async function rejection(promise) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof Error);
    return true;
  });
  return promise.catch((error) => error);
}

test("untrusted errors, lookalike codes and messages never become user-facing copy", () => {
  for (const error of [
    new Error(secret), new TypeError(`Failed to fetch ${secret}`),
    new DOMException(secret, "TimeoutError"), null, undefined, secret,
    { code: "configuration", message: secret },
    { code: "checksum", message: "Terms of Service does not match its published SHA-256 checksum." },
    new Error("Account access is paused because no approved, consent-ready Terms of Service is published.")
  ]) {
    assert.equal(requiredConsentErrorMessage(error), loadMessage);
    assert.equal(requiredConsentErrorMessage(error, "accept"), acceptMessage);
  }
});

test("RPC and schema errors are sanitized without claiming operator misconfiguration", async () => {
  for (const rawError of [new Error(secret), { code: "PGRST202", message: secret }, { message: secret }]) {
    for (const operation of [
      hasRequiredConsents(client({ gapError: rawError }), "member"),
      loadRequiredConsentPolicies(client({ gapError: rawError }), "member"),
      loadRequiredConsentPolicies(client({ policyError: rawError }), "member")
    ]) {
      const error = await rejection(operation);
      assert.equal(error.message, loadMessage);
      assert.equal(requiredConsentErrorMessage(error), loadMessage);
    }
  }
  const throwingClient = { rpc: async () => { throw new Error(secret); } };
  const error = await rejection(loadRequiredConsentPolicies(throwingClient, "member"));
  assert.equal(requiredConsentErrorMessage(error), loadMessage);
});

test("unknown backend types are redacted and remain a blocking configuration failure", async () => {
  for (const consent_type of [secret, "marketing", "__proto__", "toString", null, 42]) {
    const api = client({ gaps: [{ ...gap, consent_type }] });
    const error = await rejection(loadRequiredConsentPolicies(api, "member"));
    assert.equal(error.message, "Account access is paused because required policy configuration is unavailable. Contact support.");
    assert.equal(requiredConsentErrorMessage(error), error.message);
    assert.equal(api.calls.length, 1);
  }
});

test("known missing publications retain precise guidance for all required policies", async () => {
  for (const [consent_type, label] of [
    ["terms", "Terms of Service"], ["privacy", "Privacy Notice"],
    ["health_data_processing", "Health Data Processing Notice"]
  ]) {
    const error = await rejection(loadRequiredConsentPolicies(client({
      gaps: [{ consent_type, required_policy_version_id: null }]
    }), "member"));
    const expected = `Account access is paused because no approved, consent-ready ${label} is published.`;
    assert.equal(requiredConsentErrorMessage(error), expected);
    error.message = secret;
    assert.equal(requiredConsentErrorMessage(error), expected);
    assert.equal(requiredConsentErrorMessage(new Error(expected)), loadMessage);
  }
});

test("missing and invalid active policies remain distinct from provider loading errors", async () => {
  const missing = await rejection(loadRequiredConsentPolicies(client({ rows: [] }), "member"));
  assert.equal(requiredConsentErrorMessage(missing), "The active Terms of Service could not be loaded.");
  for (const invalid of [
    { is_active: false }, { policy_type: secret }, { effective_at: "invalid" },
    { effective_at: "2999-01-01" }, { version: " " },
    { document_url: "http://example.test/legal" }, { checksum: secret }
  ]) {
    const error = await rejection(loadRequiredConsentPolicies(client({ rows: [{ ...row, ...invalid }] }), "member"));
    assert.equal(requiredConsentErrorMessage(error), "The active Terms of Service is not available for review.");
  }
});

test("document errors use fixed policy names, never backend labels", async (t) => {
  const mockedFetch = t.mock.method(globalThis, "fetch");
  const invalid = await rejection(verifyRequiredConsentPolicyDocument({ ...policy, checksum: secret }));
  assert.equal(requiredConsentErrorMessage(invalid), "Terms of Service has no valid HTTPS document binding.");
  assert.equal(mockedFetch.mock.callCount(), 0);
  for (const [response, suffix] of [
    [new Response("offline", { status: 503 }), "could not be downloaded for checksum verification."],
    [new Response(bytes, { headers: { "content-type": "text/html" } }), "was published with an unsupported document format."],
    [new Response(bytes, { headers: { "content-type": "text/plain", "content-length": "10485761" } }), "exceeds the verified review size limit."],
    [new Response(null, { headers: { "content-type": "text/plain" } }), "has no reviewable document body."],
    [new Response("", { headers: { "content-type": "text/plain" } }), "is empty or exceeds the verified review size limit."],
    [new Response("changed", { headers: { "content-type": "text/plain" } }), "does not match its published SHA-256 checksum."]
  ]) {
    mockedFetch.mock.mockImplementation(async () => response);
    const error = await rejection(verifyRequiredConsentPolicyDocument(policy));
    assert.equal(requiredConsentErrorMessage(error), `Terms of Service ${suffix}`);
    assert.ok(!error.message.includes(secret));
  }
  mockedFetch.mock.mockImplementation(async () => { throw new TypeError(`CORS ${secret}`); });
  const error = await rejection(verifyRequiredConsentPolicyDocument(policy));
  assert.equal(requiredConsentErrorMessage(error), loadMessage);
});

test("acceptance remains atomic, identity-bound, rechecked and fail closed", async () => {
  const api = client({ acceptError: { message: secret } });
  const error = await rejection(acceptRequiredConsentPolicies(api, "member", [policy]));
  assert.equal(error.message, acceptMessage);
  assert.equal(requiredConsentErrorMessage(error, "accept"), acceptMessage);
  assert.deepEqual(api.calls[0], ["list_missing_required_consents", { p_user_id: "member" }]);
  const acceptCalls = api.calls.filter(([name]) => name === "accept_required_consents");
  assert.equal(acceptCalls.length, 1);
  assert.deepEqual(acceptCalls[0][1].p_policy_version_ids, [row.id]);
  assert.equal(acceptCalls[0][1].p_source, "web");
  assert.deepEqual(Object.keys(acceptCalls[0][1]).sort(), ["p_locale", "p_policy_version_ids", "p_source"]);

  const staleApi = client();
  const changed = await rejection(acceptRequiredConsentPolicies(staleApi, "member", [{ ...policy, id: "stale" }]));
  assert.match(requiredConsentErrorMessage(changed, "accept"), /^A required policy changed/);
  assert.ok(!staleApi.calls.some(([name]) => name === "accept_required_consents"));
  const incompleteApi = client();
  const incomplete = await rejection(acceptRequiredConsentPolicies(incompleteApi, "member", [policy]));
  assert.match(requiredConsentErrorMessage(incomplete, "accept"), /^Required consent verification did not complete/);
  assert.equal(incompleteApi.calls.filter(([name]) => name === "list_missing_required_consents").length, 2);
});

test("review routes both load and submit errors through the allowlist boundary", () => {
  const source = readFileSync(new URL("../src/components/consent/RequiredConsentReview.tsx", import.meta.url), "utf8");
  assert.match(source, /requiredConsentErrorMessage\(loadError\)/);
  assert.match(source, /requiredConsentErrorMessage\(submitError, "accept"\)/);
  assert.doesNotMatch(source, /(?:loadError|submitError)\.message/);
});
