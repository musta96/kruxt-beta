import assert from "node:assert/strict";
import test from "node:test";
import { loadPrivacySnapshot, privacyErrorMessage, submitPrivacyRequest } from "../src/lib/public/privacy.ts";

const secret = "private-schema token=secret@example.test <script>";
const id = "c885ca1e-3b92-4c46-97a4-3207db78c45b";
const gap = { consent_type: "terms", required_policy_version_id: "v1", required_policy_version: "1", reason: "missing" };
const row = {
  id, user_id: "own-user", request_type: "export", status: "fulfilled",
  due_at: "2000-01-01", response_location: "https://example.test/export.zip",
  response_expires_at: "2999-01-01T00:00:00Z"
};

function mockClient(options = {}) {
  const calls = [];
  return {
    calls,
    auth: { async getUser() {
      calls.push(["getUser"]);
      if (options.authThrows) throw new Error(secret);
      return { data: { user: options.unauth ? null : { id: "own-user" } }, error: options.authError ?? null };
    } },
    async rpc(name, params) {
      calls.push([name, params]);
      if (name === "submit_privacy_request") {
        if (options.submitThrows) throw new TypeError(secret);
        return { data: Object.hasOwn(options, "submitData") ? options.submitData : id, error: options.submitError ?? null };
      }
      if (options.consentFailure === name) {
        if (options.consentThrows) throw new Error(secret);
        return { data: null, error: { message: secret } };
      }
      return { data: name === "user_has_required_consents" ? true : [gap], error: null };
    },
    from(table) {
      calls.push(["from", table]);
      const filters = [];
      const query = {
        select(columns) { calls.push(["select", columns]); return query; },
        eq(column, value) { filters.push([column, value]); calls.push(["eq", column, value]); return query; },
        order() { return query; }, limit() { return query; },
        in() { return query; }, not() { return query; },
        then(resolve, reject) {
          assert.deepEqual(filters[0], ["user_id", "own-user"]);
          if (options.listThrows) return Promise.reject(new Error(secret)).then(resolve, reject);
          return Promise.resolve({ data: options.rows ?? [row], error: options.listError ?? null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

async function rejectsSafely(promise, operation, expected) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.message, expected);
    assert.equal(privacyErrorMessage(error, operation), expected);
    assert.ok(!error.message.includes(secret));
    return true;
  });
}

test("either consent RPC may fail or throw without blocking own requests", async () => {
  for (const consentFailure of ["user_has_required_consents", "list_missing_required_consents"]) {
    for (const consentThrows of [false, true]) {
      const api = mockClient({ consentFailure, consentThrows });
      const snapshot = await loadPrivacySnapshot(api);
      assert.equal(snapshot.consentStatusUnavailable, true);
      assert.equal(snapshot.hasRequiredConsents, false);
      assert.deepEqual(snapshot.missingRequiredConsents, []);
      assert.equal(snapshot.recentRequests[0].id, id);
      assert.equal(snapshot.openRequests.length, 1);
      assert.equal(snapshot.downloadableExports.length, 1);
      assert.equal(snapshot.overdueOpenCount, 1);
      assert.equal(api.calls.filter(([name]) => name === "from").length, 3);
      for (const [, params] of api.calls.filter(([name]) => name.includes("consents"))) {
        assert.deepEqual(params, { p_user_id: "own-user" });
      }
      assert.equal(api.calls.filter(([name, column, value]) => name === "eq" && column === "user_id" && value === "own-user").length, 3);
    }
  }
});

test("available consent fields remain intact", async () => {
  const snapshot = await loadPrivacySnapshot(mockClient());
  assert.equal(snapshot.consentStatusUnavailable, false);
  assert.equal(snapshot.hasRequiredConsents, true);
  assert.deepEqual(snapshot.missingRequiredConsents, [{
    consentType: "terms", requiredPolicyVersionId: "v1", requiredPolicyVersion: "1", reason: "missing"
  }]);
});

test("malformed optional consent metadata cannot block privacy intake or claim acceptance", async () => {
  for (const [name, data] of [
    ["user_has_required_consents", "true"], ["user_has_required_consents", null],
    ["list_missing_required_consents", null], ["list_missing_required_consents", {}],
    ["list_missing_required_consents", [null]], ["list_missing_required_consents", [{ ...gap, consent_type: secret }]]
  ]) {
    const client = mockClient();
    const rpc = client.rpc;
    client.rpc = async (method, params) => method === name ? { data, error: null } : rpc(method, params);
    const snapshot = await loadPrivacySnapshot(client);
    assert.equal(snapshot.consentStatusUnavailable, true);
    assert.equal(snapshot.hasRequiredConsents, false);
    assert.deepEqual(snapshot.missingRequiredConsents, []);
    assert.equal(snapshot.recentRequests[0].id, id);
  }
});

test("unauthenticated, failed and throwing auth do not issue RPCs or reads", async () => {
  for (const options of [{ unauth: true }, { authError: { message: secret } }, { authThrows: true }]) {
    for (const operation of ["load", "submit"]) {
      const api = mockClient(options);
      await rejectsSafely(operation === "load" ? loadPrivacySnapshot(api) : submitPrivacyRequest(api, { requestType: "access" }), operation, "Authentication required.");
      assert.deepEqual(api.calls, [["getUser"]]);
    }
  }
});

test("own request read failures remain blocking and redacted even when consents fail", async () => {
  for (const options of [{ listError: { message: secret } }, { listThrows: true }]) {
    await rejectsSafely(loadPrivacySnapshot(mockClient({ ...options, consentFailure: "user_has_required_consents" })), "load", "Unable to load privacy requests.");
  }
});

test("submission returns only its UUID with no consent calls or followup reads", async () => {
  for (const requestType of ["access", "export", "delete", "rectify", "restrict_processing"]) {
    const api = mockClient({ listThrows: true, consentThrows: true });
    assert.equal(await submitPrivacyRequest(api, { requestType, reason: "  Please help  ", userId: "victim" }), id);
    assert.deepEqual(api.calls, [["getUser"], ["submit_privacy_request", { p_request_type: requestType, p_reason: "Please help" }]]);
  }
  const api = mockClient();
  await submitPrivacyRequest(api, { requestType: "access", reason: "   " });
  assert.equal(api.calls[1][1].p_reason, null);
});

test("failed writes and invalid UUID responses never report success", async () => {
  for (const options of [
    { submitError: { message: secret } }, { submitThrows: true },
    ...[null, undefined, "", " ", "not-a-uuid", "00000000-0000-0000-0000-000000000000", ` ${id}`, [id], { id }].map((submitData) => ({ submitData }))
  ]) {
    const api = mockClient(options);
    await rejectsSafely(submitPrivacyRequest(api, { requestType: "access" }), "submit", "Unable to submit privacy request.");
    assert.equal(api.calls.length, 2);
  }
});

test("unknown types and unbounded reasons are rejected locally", async () => {
  for (const requestType of ["unknown", "__proto__", "toString", null, 42, undefined]) {
    const api = mockClient();
    await rejectsSafely(submitPrivacyRequest(api, { requestType }), "submit", "Choose a valid privacy request type.");
    assert.equal(api.calls.length, 1);
  }
  for (const reason of ["x".repeat(2001), " ".repeat(2001), null, 42, {}]) {
    const api = mockClient();
    await rejectsSafely(submitPrivacyRequest(api, { requestType: "access", reason }), "submit", "Privacy request reason must be no more than 2000 characters.");
    assert.equal(api.calls.length, 1);
  }
  assert.equal(await submitPrivacyRequest(mockClient(), { requestType: "access", reason: "x".repeat(2000) }), id);
});

test("unsafe URLs and invalid or expired expiries are removed from every request view", async () => {
  const invalidRows = [
    ...["javascript:alert(1)", "data:text/plain,secret", "http://example.test/export", "https://user:pass@example.test/export", "https://user@example.test/export", "/export", "invalid", null].map((response_location) => ({ ...row, response_location })),
    ...[null, "invalid", "2000-01-01", "Infinity"].map((response_expires_at) => ({ ...row, response_expires_at }))
  ];
  const snapshot = await loadPrivacySnapshot(mockClient({ rows: [...invalidRows, row] }));
  for (const requests of [snapshot.openRequests, snapshot.recentRequests]) {
    assert.ok(requests.slice(0, -1).every((request) => request.responseLocation === null));
    assert.equal(requests.at(-1).responseLocation, row.response_location);
  }
  assert.deepEqual(snapshot.downloadableExports.map((request) => request.responseLocation), [row.response_location]);
});

test("untrusted errors, lookalike messages and mutated errors cannot leak backend text", async () => {
  for (const error of [new Error(secret), new Error("Authentication required."), { code: "auth", message: secret }, secret, null, undefined]) {
    assert.equal(privacyErrorMessage(error, "load"), "Unable to load privacy requests.");
    assert.equal(privacyErrorMessage(error, "submit"), "Unable to submit privacy request.");
  }
  const error = await loadPrivacySnapshot(mockClient({ unauth: true })).catch((error) => error);
  error.message = secret;
  assert.equal(privacyErrorMessage(error, "load"), "Authentication required.");
});
