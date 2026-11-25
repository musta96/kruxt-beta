import assert from "node:assert/strict";
import { test } from "node:test";
import { loadOperatorPermissionSnapshot, saveOperatorPermissionChanges } from "../src/services/operator-permissions.ts";

const viewerId = "81000000-0000-4000-8000-000000000001";
const targetUserId = "81000000-0000-4000-8000-000000000002";
const first = "platform.analytics.read";
const second = "platform.flags.view";
function fixture() {
  const state = { viewerId, actorRole: "founder", active: true, targetRole: "analyst", aal: "aal2", rpcCalls: [], actions: [], overrides: new Map(), failAt: 0, malformed: false, failReadback: false, inactiveCatalog: false, switchAfter: false };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: state.viewerId } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.aal }, error: null }) }
    },
    from(table) {
      const filters = {};
      const builder = { then(resolve, reject) {
        let result;
        if (table === "platform_operator_accounts") result = { data: [{ user_id: viewerId, role: state.actorRole, is_active: state.active }, { user_id: targetUserId, role: state.targetRole, is_active: true }] };
        if (table === "platform_permission_catalog") result = { data: [first, second].map(permission_key => ({ permission_key, is_active: !state.inactiveCatalog, label: permission_key, category: "system", metadata: {} })) };
        if (table === "platform_role_permissions") result = { data: [{ role: "compliance_admin", permission_key: first, is_allowed: false, metadata: {} }, { role: "analyst", permission_key: first, is_allowed: true, metadata: {} }] };
        if (table === "platform_operator_permission_overrides") {
          const rows = [...state.overrides].map(([permission_key, is_allowed]) => ({ user_id: targetUserId, permission_key, is_allowed, reason: "fixture" }));
          result = filters.permission_key ? { data: rows.find(row => row.permission_key === filters.permission_key) ?? null } : { data: rows };
          if (filters.permission_key && state.failReadback) result = { data: null, error: { message: "offline" } };
        }
        return Promise.resolve(result ?? { data: [], error: null }).then(resolve, reject);
      } };
      for (const method of ["select", "in", "order", "eq", "maybeSingle"]) builder[method] = (...args) => {
        state.actions.push([table, method, ...args]); if (method === "eq") filters[args[0]] = args[1]; return builder;
      };
      return builder;
    },
    async rpc(name, args) {
      if (name === "platform_list_operator_accounts") return { data: [{ user_id: targetUserId, role: state.targetRole, is_active: true, mfa_required: true, display_name: "Fixture operator", created_at: "2026-10-23" }] };
      state.rpcCalls.push({ name, args });
      if (state.failAt === state.rpcCalls.length) return { error: { message: "denied" } };
      if (name === "platform_clear_operator_permission_override") state.overrides.delete(args.p_permission_key);
      else state.overrides.set(args.p_permission_key, args.p_is_allowed);
      if (state.switchAfter) state.viewerId = targetUserId;
      return { data: state.malformed ? {} : { userId: targetUserId, permissionKey: args.p_permission_key, isAllowed: args.p_is_allowed, cleared: true } };
    }
  };
  return { state, client };
}
const change = (permissionKey = first, value = true, previousValue = null) => ({ permissionKey, value, previousValue });
const input = (changes = [change()]) => ({ viewerId, targetUserId, reason: "Reviewed support task", changes });

test("all real role rows are retained; no compliance/admin or analyst/read-only remapping", async () => {
  const { client } = fixture();
  const result = await loadOperatorPermissionSnapshot(client, viewerId);
  assert.equal(result.operators[0].role, "analyst");
  assert.deepEqual(result.rolePermissions.map(row => row.role), ["compliance_admin", "analyst"]);
});
test("loading fails closed on account switch", async () => {
  const { client, state } = fixture(); state.viewerId = targetUserId;
  await assert.rejects(loadOperatorPermissionSnapshot(client, viewerId), /session changed/);
  assert.equal(state.actions.length, 0);
});
test("only active founders with verified second factor may submit an override", async () => {
  for (const settings of [{ actorRole: "ops_admin" }, { active: false }, { aal: "aal1" }, { targetRole: "founder" }, { viewerId: targetUserId }]) {
    const { client, state } = fixture(); Object.assign(state, settings);
    await assert.rejects(saveOperatorPermissionChanges(client, input()));
    assert.equal(state.rpcCalls.length, 0);
  }
});
test("reason, shape, duplicates and active catalog are checked before writes", async () => {
  for (const invalid of [{ reason: " " }, { targetUserId: "not-a-uuid" }, { changes: [change(), change()] }, { changes: [change(first, "true")] }, { changes: [] }]) {
    const { client, state } = fixture(); await assert.rejects(saveOperatorPermissionChanges(client, { ...input(), ...invalid })); assert.equal(state.rpcCalls.length, 0);
  }
  const { client, state } = fixture(); state.inactiveCatalog = true;
  await assert.rejects(saveOperatorPermissionChanges(client, input()), /no longer active/);
  assert.equal(state.rpcCalls.length, 0);
});
test("stale drafts cannot overwrite an already changed override", async () => {
  const { client, state } = fixture(); state.overrides.set(first, false);
  await assert.rejects(saveOperatorPermissionChanges(client, input()), /changed since/);
  assert.equal(state.rpcCalls.length, 0);
});
test("allow, deny and inherit are confirmed using acknowledgement and scoped readback", async () => {
  const { client, state } = fixture();
  for (const [value, previous] of [[true, null], [false, true], [null, false]]) {
    assert.equal((await saveOperatorPermissionChanges(client, input([change(first, value, previous)]))).outcome, "complete");
  }
  assert.equal(state.overrides.size, 0);
  assert.ok(state.actions.some(([table, method, key, value]) => table === "platform_operator_permission_overrides" && method === "eq" && key === "user_id" && value === targetUserId));
});
test("partial batches stop immediately and do not imply rollback or resubmit completed keys", async () => {
  const { client, state } = fixture(); state.failAt = 2;
  const result = await saveOperatorPermissionChanges(client, input([change(), change(second)]));
  assert.deepEqual(result, { confirmedKeys: [first], unconfirmedKeys: [second], outcome: "partial" });
  assert.equal(state.overrides.get(first), true); assert.equal(state.rpcCalls.length, 2);
});
test("malformed acknowledgement, readback failure and identity change cannot claim success", async () => {
  for (const settings of [{ malformed: true }, { failReadback: true }, { switchAfter: true }]) {
    const { client, state } = fixture(); Object.assign(state, settings);
    const result = await saveOperatorPermissionChanges(client, input([change(), change(second)]));
    assert.equal(result.outcome, "unconfirmed"); assert.deepEqual(result.confirmedKeys, []); assert.equal(state.rpcCalls.length, 1);
  }
});
