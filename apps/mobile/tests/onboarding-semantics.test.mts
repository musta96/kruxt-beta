import assert from "node:assert/strict";
import test from "node:test";

import {
  homeGymIdForEligibleMembership,
  isExplicitOptIn,
  isHomeGymEligibleMembershipStatus,
  onboardingResumeStep,
  reviewedBaselinePoliciesAreCurrent,
} from "../src/services/onboarding-semantics.ts";

test("notification consent requires an explicit true opt-in", () => {
  assert.equal(isExplicitOptIn(true), true);
  for (const value of [undefined, null, false, 1, "true", {}]) {
    assert.equal(isExplicitOptIn(value), false);
  }
});

test("onboarding resumes at the first incomplete server-verified step", () => {
  assert.equal(
    onboardingResumeStep({ profileComplete: false, requiredConsentsComplete: false }),
    "profile",
  );
  assert.equal(
    onboardingResumeStep({ profileComplete: true, requiredConsentsComplete: false }),
    "consents",
  );
  assert.equal(
    onboardingResumeStep({ profileComplete: true, requiredConsentsComplete: true }),
    "gym",
  );
});

test("only active and trial memberships are eligible to become home gym", () => {
  assert.equal(isHomeGymEligibleMembershipStatus("active"), true);
  assert.equal(isHomeGymEligibleMembershipStatus("trial"), true);
  assert.equal(isHomeGymEligibleMembershipStatus("pending"), false);
  assert.equal(isHomeGymEligibleMembershipStatus("paused"), false);
  assert.equal(isHomeGymEligibleMembershipStatus("cancelled"), false);

  assert.equal(
    homeGymIdForEligibleMembership({ gymId: "gym-active", membershipStatus: "active" }),
    "gym-active",
  );
  assert.equal(
    homeGymIdForEligibleMembership({ gymId: "gym-pending", membershipStatus: "pending" }),
    undefined,
  );
});

test("consent capture rejects any policy id changed since review", () => {
  const reviewed = {
    termsPolicyId: "terms-v1",
    privacyPolicyId: "privacy-v1",
    healthDataPolicyId: "health-v1",
  };

  assert.equal(reviewedBaselinePoliciesAreCurrent(reviewed, reviewed), true);
  assert.equal(
    reviewedBaselinePoliciesAreCurrent(reviewed, {
      ...reviewed,
      privacyPolicyId: "privacy-v2",
    }),
    false,
  );
});
