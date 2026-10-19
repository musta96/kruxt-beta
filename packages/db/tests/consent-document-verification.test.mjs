import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadTs(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { verifyRequiredConsentPolicyDocument, acceptRequiredConsentPolicies } =
  await loadTs("../../../apps/web/src/lib/auth/required-consents.ts");
const { resolveAdminAccess } = await loadTs("../../../apps/web/src/lib/auth/access.ts");
const bytes = Buffer.from("Approved terms version 1\n");
const policy = {
  id: "terms-v1", label: "Terms", documentUrl: "https://example.test/terms.txt",
  checksum: createHash("sha256").update(bytes).digest("hex")
};

test("review copy contains exactly the hashed bytes and fetch omits credentials", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, policy.documentUrl);
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(bytes, { headers: { "content-type": "text/plain; charset=utf-8" } });
  });
  const copy = await verifyRequiredConsentPolicyDocument({ ...policy, checksum: `SHA256:${policy.checksum}` });
  assert.equal(copy.policyId, policy.id);
  assert.equal(copy.byteLength, bytes.length);
  assert.deepEqual(Buffer.from(await copy.blob.arrayBuffer()), bytes);
});

test("changed, empty, oversized, executable and unavailable documents fail closed", async (t) => {
  const responses = [
    [new Response("changed", { headers: { "content-type": "text/plain" } }), /does not match/],
    [new Response("", { headers: { "content-type": "text/plain" } }), /empty/],
    [new Response(bytes, { headers: { "content-type": "text/plain", "content-length": "10485761" } }), /size limit/],
    [new Response(new Uint8Array(10485761), { headers: { "content-type": "text/plain" } }), /size limit/],
    [new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html" } }), /unsupported/],
    [new Response("Unavailable", { status: 503 }), /could not be downloaded/]
  ];
  const mockedFetch = t.mock.method(globalThis, "fetch");
  for (const [response, error] of responses) {
    mockedFetch.mock.mockImplementation(async () => response);
    await assert.rejects(verifyRequiredConsentPolicyDocument(policy), error);
  }
});

test("invalid bindings fail before network and network/CORS failures remain blocking", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new TypeError("CORS failure"); });
  await assert.rejects(verifyRequiredConsentPolicyDocument({ ...policy, documentUrl: "http://example.test/legal" }), /binding/);
  await assert.rejects(verifyRequiredConsentPolicyDocument({ ...policy, checksum: "invalid" }), /binding/);
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(verifyRequiredConsentPolicyDocument(policy), /CORS failure/);
});

function accessClient(activationStatus, consent, queryError = null) {
  const rows = {
    platform_operator_accounts: { role: "founder", is_active: true },
    gym_memberships: [{ gym_id: "private-gym" }],
    profiles: { activation_status: activationStatus }
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from(table) {
      const result = { data: rows[table], error: queryError };
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain,
        maybeSingle: async () => result, then: (resolve) => Promise.resolve(result).then(resolve)
      };
      return chain;
    },
    rpc: async () => ({ data: consent, error: null })
  };
}
test("founder role cannot make disabled, pending, unconsented or failed access ready", async () => {
  for (const [activation, consent, expected] of [
    ["disabled", true, "disabled"], ["pending_activation", true, "activation_required"],
    ["active", false, "consent_required"], ["active", true, "ready"]
  ]) {
    const result = await resolveAdminAccess(accessClient(activation, consent));
    assert.equal(result.status, expected);
  }
  assert.equal((await resolveAdminAccess(accessClient("active", true, { message: "offline" }))).status, "error");
});

test("atomic acceptance propagates RPC failure without reporting success", async () => {
  const row = {
    id: policy.id, policy_type: "terms", version: "1", label: "Terms", document_url: policy.documentUrl,
    checksum: policy.checksum, effective_at: "2026-01-01T00:00:00Z", is_active: true
  };
  const client = {
    rpc: async (name, params) => {
      if (name === "list_missing_required_consents") {
        return { data: [{ consent_type: "terms", required_policy_version_id: policy.id, reason: "missing" }], error: null };
      }
      assert.equal(name, "accept_required_consents");
      assert.deepEqual(params.p_policy_version_ids, [policy.id]);
      return { data: null, error: { message: "transaction failed" } };
    },
    from: () => ({ select: () => ({ in: async () => ({ data: [row], error: null }) }) })
  };
  await assert.rejects(acceptRequiredConsentPolicies(client, "user-1", [{ ...policy, consentType: "terms" }]), /transaction failed/);
  await assert.rejects(acceptRequiredConsentPolicies(client, "user-1", [{ ...policy, consentType: "terms", id: "stale" }]), /changed/);
});
