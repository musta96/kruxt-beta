import assert from "node:assert/strict";
import test from "node:test";
import { loadOperatorRoleProfiles, mutateOperatorRoleProfile, resolveOperatorProfilePermission } from "../src/services/operator-role-profiles.ts";

const viewer = "00000000-0000-4000-8000-000000000001";
const profile = { id: "00000000-0000-4000-8000-000000000002", name: "Tenant reader", description: "", version: 1,
  permissions: { "platform.tenants.view": true } };
const base = { isActive: true, catalogActive: true, role: "read_only", roleDefault: false, permissionKey: "platform.tenants.view", profile };
const snapshot = () => ({ profiles: [profile], assignments: [], operators: [], catalog: [], can_write: true, effective_permissions: [] });
function fixture({ aal = "aal2", response = snapshot(), mutation } = {}) {
  const calls = [];
  return { calls, auth: {
    getUser: async () => ({ data: { user: { id: viewer } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal }, error: null }) }
  }, rpc: async (name, args) => { calls.push({ name, args }); return { data: name === "platform_mutate_operator_role_profile" ? mutation : response, error: null }; } };
}

test("resolved previews preserve inactive/catalog denial and explicit user override precedence", () => {
  assert.deepEqual(resolveOperatorProfilePermission(base), { is_allowed: true, source: "profile", profile_id: profile.id });
  assert.equal(resolveOperatorProfilePermission({ ...base, userOverride: false }).source, "user_override");
  assert.equal(resolveOperatorProfilePermission({ ...base, userOverride: false }).is_allowed, false);
  assert.equal(resolveOperatorProfilePermission({ ...base, isActive: false }).source, "inactive_operator");
  assert.equal(resolveOperatorProfilePermission({ ...base, catalogActive: false }).source, "inactive_catalog");
});
test("profiles cannot grant founder authority or out-of-scope capabilities", () => {
  assert.equal(resolveOperatorProfilePermission({ ...base, role: "founder" }).is_allowed, false);
  assert.equal(resolveOperatorProfilePermission({ ...base, permissionKey: "platform.operators.roles_matrix_edit" }).is_allowed, false);
});
test("snapshot validates identity and response structure", async () => {
  assert.deepEqual(await loadOperatorRoleProfiles(fixture(), viewer), snapshot());
  await assert.rejects(loadOperatorRoleProfiles(fixture({ response: { ...snapshot(), can_write: "yes" } }), viewer), /could not be verified/);
  await assert.rejects(loadOperatorRoleProfiles(fixture(), profile.id), /session changed/);
});
test("MFA and input validation prevent mutation calls", async () => {
  const client = fixture({ aal: "aal1" });
  await assert.rejects(mutateOperatorRoleProfile(client, viewer, { action: "create", name: "Reader", permissions: {}, reason: "Scoped view" }), /second authentication factor/);
  assert.equal(client.calls.length, 0);
  await assert.rejects(mutateOperatorRoleProfile(client, viewer, { action: "create", name: "Reader", permissions: { "platform.operators.manage": true }, reason: "Scoped view" }), /Review/);
  assert.equal(client.calls.length, 0);
});
test("committed profile changes require an owned authoritative readback", async () => {
  const client = fixture({ mutation: { committed: true, action: "create", profile_id: profile.id, profile } });
  const result = await mutateOperatorRoleProfile(client, viewer, { action: "create", name: profile.name, description: "", permissions: profile.permissions, reason: "Scoped reader" });
  assert.deepEqual(result, snapshot());
  assert.equal(client.calls[0].args.p_reason, "Scoped reader");
  const mismatched = fixture({ response: { ...snapshot(), profiles: [] }, mutation: { committed: true, action: "create", profile_id: profile.id, profile } });
  await assert.rejects(mutateOperatorRoleProfile(mismatched, viewer, { action: "create", name: profile.name, permissions: profile.permissions, reason: "Scoped reader" }), /may have committed/);
});
test("a malformed acknowledgement never reports successful mutation", async () => {
  await assert.rejects(mutateOperatorRoleProfile(fixture({ mutation: { committed: false } }), viewer, {
    action: "delete", profile, reason: "No longer needed"
  }), /could not be confirmed/);
});
