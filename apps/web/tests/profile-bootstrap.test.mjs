import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureProfileForUser, resolveAdminAccess } from "../src/lib/auth/access.ts";
import { authenticationErrorMessage } from "../src/lib/auth/auth-error.ts";

const input = { userId: "athlete", email: "athlete@example.test" };
function fixture({ user = { id: "athlete" }, authError = null, profile = { id: "athlete" }, readError = null, rpcProfile = { id: "athlete" }, rpcError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => { calls.push("verify"); return { data: { user }, error: authError }; } },
    from(table) {
      assert.equal(table, "profiles"); calls.push("read");
      return { select(columns) { assert.equal(columns, "id"); return this; }, eq(column, value) { assert.equal(column, "id"); assert.equal(value, "athlete"); return this; }, maybeSingle: async () => ({ data: profile, error: readError }) };
    },
    rpc: async (name, args) => { calls.push("create"); assert.equal(name, "ensure_self_profile"); assert.deepEqual(args, { p_preferred_username: "athlete", p_display_name: "athlete" }); return { data: rpcProfile, error: rpcError }; }
  };
  return { client, calls };
}

test("a verified existing profile does not require the undeployed creation RPC", async () => {
  const { client, calls } = fixture({ rpcError: { code: "PGRST202", message: "private schema details" } });
  await ensureProfileForUser(client, input);
  assert.deepEqual(calls, ["verify", "read"]);
});

test("missing profiles still use the server-owned creator and verify the returned identity", async () => {
  for (const rpcProfile of [{ id: "athlete" }, [{ id: "athlete" }]]) {
    const { client, calls } = fixture({ profile: null, rpcProfile });
    await ensureProfileForUser(client, input);
    assert.deepEqual(calls, ["verify", "read", "create"]);
  }
});

test("a missing creation RPC fails safely with a profile-setup diagnosis, not bad credentials", async () => {
  const { client } = fixture({ profile: null, rpcError: { code: "PGRST202", message: "private schema details" } });
  await assert.rejects(ensureProfileForUser(client, input), error => {
    assert.equal(error.code, "member_profile_setup_unavailable");
    assert.match(authenticationErrorMessage(error), /signed in.*profile setup/i);
    assert.doesNotMatch(authenticationErrorMessage(error), /private schema|password|Authentication could not/i);
    return true;
  });
});

test("missing, changed and unverified identities cannot read or create profiles", async () => {
  for (const options of [{ user: null }, { user: { id: "another-athlete" } }, { authError: new Error("unverified") }]) {
    const { client, calls } = fixture(options);
    await assert.rejects(ensureProfileForUser(client, input));
    assert.deepEqual(calls, ["verify"]);
  }
});

test("profile read failures never fall through into creation or expose backend messages", async () => {
  const { client, calls } = fixture({ readError: { message: "private policy detail" } });
  await assert.rejects(ensureProfileForUser(client, input), error => {
    assert.equal(error.code, "member_profile_setup_unavailable");
    assert.doesNotMatch(authenticationErrorMessage(error), /private policy/);
    return true;
  });
  assert.deepEqual(calls, ["verify", "read"]);
});

test("read and creator responses for another identity cannot satisfy profile setup", async () => {
  for (const options of [{ profile: { id: "another-athlete" } }, { profile: null, rpcProfile: { id: "another-athlete" } }, { profile: null, rpcProfile: null }]) {
    const { client } = fixture(options);
    await assert.rejects(ensureProfileForUser(client, input));
  }
});

test("existing-profile fast path is not an activation or consent bypass", async () => {
  for (const [activation, consent, expected] of [["active", false, "consent_required"], ["disabled", true, "disabled"], ["pending_activation", true, "activation_required"]]) {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "athlete" } }, error: null }) },
      rpc: async () => ({ data: consent, error: null }),
      from(table) { return { select() { return this; }, eq() { return this; }, in() { return this; }, maybeSingle: async () => ({ data: table === "profiles" ? { activation_status: activation } : null, error: null }), then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } }; }
    };
    const access = await resolveAdminAccess(client);
    assert.equal(access.status, expected);
  }
});
