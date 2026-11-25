import type { MembershipStatus } from "@kruxt/types";

export interface BaselinePolicyIdsLike {
  termsPolicyId: string;
  privacyPolicyId: string;
  healthDataPolicyId: string;
}

export type OnboardingResumeStep = "profile" | "consents" | "gym";

export function onboardingResumeStep(input: {
  profileComplete: boolean;
  requiredConsentsComplete: boolean;
}): OnboardingResumeStep {
  if (!input.profileComplete) return "profile";
  if (!input.requiredConsentsComplete) return "consents";
  return "gym";
}

export function isExplicitOptIn(value: unknown): boolean {
  return value === true;
}

export function isHomeGymEligibleMembershipStatus(status: MembershipStatus): boolean {
  return status === "active" || status === "trial";
}

export function homeGymIdForEligibleMembership(
  membership: { gymId: string; membershipStatus: MembershipStatus } | undefined,
): string | undefined {
  return membership && isHomeGymEligibleMembershipStatus(membership.membershipStatus)
    ? membership.gymId
    : undefined;
}

export function reviewedBaselinePoliciesAreCurrent(
  reviewed: BaselinePolicyIdsLike,
  current: BaselinePolicyIdsLike,
): boolean {
  return (
    reviewed.termsPolicyId === current.termsPolicyId &&
    reviewed.privacyPolicyId === current.privacyPolicyId &&
    reviewed.healthDataPolicyId === current.healthDataPolicyId
  );
}
