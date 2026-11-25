import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadMemberLanding,
  MEMBER_FALLBACK_PATH,
  resolveMemberLanding
} from "../src/lib/invite/member-landing.ts";

// Disposable synthetic identities only.
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const GYM = "33333333-3333-4333-8333-333333333333";
const OTHER_GYM = "44444444-4444-4444-8444-444444444444";
const MEMBERSHIP = "55555555-5555-4555-8555-555555555555";

const classes = { path: `/gyms/${GYM}/classes`, toGymClasses: true };
const fallback = { path: MEMBER_FALLBACK_PATH, toGymClasses: false };

function facts(overrides = {}) {
  return {
    userId: USER,
    inviteAccepted: true,
    activationStatus: "active",
    hasRequiredConsents: true,
    membership: { id: MEMBERSHIP, gym_id: GYM, user_id: USER, membership_status: "active" },
    expectedMembershipId: MEMBERSHIP,
    ...overrides
  };
}

test("accepted invite + active account + policies + bookable membership opens the gym's classes", () => {
  assert.deepEqual(resolveMemberLanding(facts()), classes);
  assert.deepEqual(resolveMemberLanding(facts({ membership: { ...facts().membership, membership_status: "trial" } })), classes);
  assert.deepEqual(
    resolveMemberLanding(facts({ expectedMembershipId: undefined, expectedGymId: GYM })),
    classes
  );
});

test("pending, paused, cancelled or missing memberships fall back to the member home", () => {
  for (const membership_status of ["pending", "paused", "cancelled", "", "ACTIVE"]) {
    assert.deepEqual(resolveMemberLanding(facts({ membership: { ...facts().membership, membership_status } })), fallback, membership_status);
  }
  assert.deepEqual(resolveMemberLanding(facts({ membership: null })), fallback);
  assert.deepEqual(resolveMemberLanding(facts({ membership: undefined })), fallback);
});

test("incomplete onboarding falls back", () => {
  assert.deepEqual(resolveMemberLanding(facts({ inviteAccepted: false })), fallback);
  assert.deepEqual(resolveMemberLanding(facts({ hasRequiredConsents: false })), fallback);
  for (const activationStatus of ["pending_activation", "disabled", null, undefined]) {
    assert.deepEqual(resolveMemberLanding(facts({ activationStatus })), fallback, String(activationStatus));
  }
});

test("a membership that is not this user's, this invite's or this gym's never opens classes", () => {
  assert.deepEqual(resolveMemberLanding(facts({ membership: { ...facts().membership, user_id: OTHER_USER } })), fallback);
  assert.deepEqual(resolveMemberLanding(facts({ expectedMembershipId: "66666666-6666-4666-8666-666666666666" })), fallback);
  assert.deepEqual(resolveMemberLanding(facts({ expectedMembershipId: undefined, expectedGymId: OTHER_GYM })), fallback);
  assert.deepEqual(resolveMemberLanding(facts({ expectedMembershipId: undefined, expectedGymId: undefined })), fallback);
});

test("malformed ids cannot shape the destination path", () => {
  for (const gym_id of ["../admin", `${GYM}/../../admin`, "", "not-a-uuid"]) {
    assert.deepEqual(resolveMemberLanding(facts({ membership: { ...facts().membership, gym_id } })), fallback, gym_id);
  }
  assert.deepEqual(resolveMemberLanding(facts({ userId: "x", membership: { ...facts().membership, user_id: "x" } })), fallback);
});

function fakeClient(tables, calls = []) {
  return {
    calls,
    from(table) {
      const call = { table, select: null, filters: [] };
      calls.push(call);
      const builder = {
        select(columns) { call.select = columns; return builder; },
        eq(column, value) { call.filters.push([column, value]); return builder; },
        async maybeSingle() {
          const result = tables[table];
          if (result instanceof Error) throw result;
          return typeof result === "function" ? result(call) : result;
        }
      };
      return builder;
    }
  };
}

const activeProfile = { data: { activation_status: "active" }, error: null };
const activeMembership = { data: { id: MEMBERSHIP, gym_id: GYM, user_id: USER, membership_status: "active" }, error: null };

test("loader reads fresh state scoped to the signed-in user and the invite", async () => {
  const client = fakeClient({ profiles: activeProfile, gym_memberships: activeMembership });
  const result = await loadMemberLanding(client, { userId: USER, membershipId: MEMBERSHIP, checkRequiredConsents: async () => true });
  assert.deepEqual(result, classes);
  const membershipCall = client.calls.find((c) => c.table === "gym_memberships");
  assert.deepEqual(membershipCall.filters, [["user_id", USER], ["id", MEMBERSHIP]]);
  const profileCall = client.calls.find((c) => c.table === "profiles");
  assert.deepEqual(profileCall.filters, [["id", USER]]);

  const byGym = fakeClient({ profiles: activeProfile, gym_memberships: activeMembership });
  assert.deepEqual(await loadMemberLanding(byGym, { userId: USER, gymId: GYM, checkRequiredConsents: async () => true }), classes);
  assert.deepEqual(byGym.calls.find((c) => c.table === "gym_memberships").filters, [["user_id", USER], ["gym_id", GYM]]);
});

test("loader fails closed on missing binding, errors, rejections and missing policies", async () => {
  const consents = async () => true;
  const none = fakeClient({});
  assert.deepEqual(await loadMemberLanding(none, { userId: USER, checkRequiredConsents: consents }), fallback);
  assert.equal(none.calls.length, 0, "no reads without an invite binding");

  const cases = [
    [{ profiles: { data: null, error: { message: "denied" } }, gym_memberships: activeMembership }, consents],
    [{ profiles: activeProfile, gym_memberships: { data: null, error: { message: "denied" } } }, consents],
    [{ profiles: activeProfile, gym_memberships: { data: null, error: null } }, consents],
    [{ profiles: new Error("offline"), gym_memberships: activeMembership }, consents],
    [{ profiles: activeProfile, gym_memberships: new Error("timeout") }, consents],
    [{ profiles: activeProfile, gym_memberships: activeMembership }, async () => false],
    [{ profiles: activeProfile, gym_memberships: activeMembership }, async () => { throw new Error("consent rpc failed"); }],
    [{ profiles: { data: { activation_status: "pending_activation" }, error: null }, gym_memberships: activeMembership }, consents]
  ];
  for (const [tables, checkRequiredConsents] of cases) {
    const result = await loadMemberLanding(fakeClient(tables), { userId: USER, membershipId: MEMBERSHIP, checkRequiredConsents });
    assert.deepEqual(result, fallback);
  }
});

test("settleMemberLanding returns the result, or the fallback on rejection or timeout", async () => {
  const { settleMemberLanding } = await import("../src/lib/invite/member-landing.ts");
  assert.deepEqual(await settleMemberLanding(Promise.resolve(classes), 50), classes);
  assert.deepEqual(await settleMemberLanding(Promise.reject(new Error("offline")), 50), fallback);
  assert.deepEqual(await settleMemberLanding(new Promise(() => {}), 20), fallback);
  const late = new Promise((resolve) => setTimeout(() => resolve(classes), 60));
  assert.deepEqual(await settleMemberLanding(late, 10), fallback, "late results never override the fallback");
});
