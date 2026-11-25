import assert from "node:assert/strict";
import test from "node:test";
import { canManagePrivacy } from "../src/lib/auth/privacy-access.ts";

const state = (status = "consent_required") => ({
  status, user: { id: "member" }, error: null,
  access: { status, user: { id: "member" }, isAuthenticated: true, activationStatus: "active", error: null }
});

test("active verified members can manage privacy without changing consent state", () => {
  for (const status of ["ready", "consent_required"]) {
    const input = state(status);
    const before = structuredClone(input);
    assert.equal(canManagePrivacy(input), true);
    assert.deepEqual(input, before);
  }
});

test("unverified, mismatched, disabled, pending and failed sessions remain blocked", () => {
  for (const patch of [
    { user: null }, { access: null }, { user: { id: "other" } }, { user: { id: "" } },
    { error: "failed" }, ...["loading", "error", "access_blocked", "unknown"].map(status => ({ status }))
  ]) assert.equal(canManagePrivacy({ ...state(), ...patch }), false);
  for (const patch of [
    { user: null }, { user: { id: "other" } }, { isAuthenticated: false }, { error: "failed" },
    ...[null, "disabled", "pending_activation", "unknown"].map(activationStatus => ({ activationStatus })),
    ...["ready", "error", "loading", "disabled", "activation_required"].map(status => ({ status }))
  ]) assert.equal(canManagePrivacy({ ...state(), access: { ...state().access, ...patch } }), false);
});
