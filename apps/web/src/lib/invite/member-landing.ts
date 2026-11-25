import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where a newly invited member goes after accepting a gym invite.
 *
 * They are sent to their gym's class schedule only when every check passes:
 * the invite was accepted for this user, the account is active, the required
 * policies are accepted, and a fresh read of the membership shows it belongs to
 * this user and this invite, with an active or trial status. Anything else,
 * including a failed lookup, falls back to the existing member home.
 *
 * Navigation only: the class page and the database still enforce access.
 */
export const MEMBER_FALLBACK_PATH = "/feed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKABLE_STATUSES = new Set(["active", "trial"]);

export type LandingMembership = {
  id: string;
  gym_id: string;
  user_id: string;
  membership_status: string;
};

export type MemberLandingFacts = {
  userId: string;
  inviteAccepted: boolean;
  activationStatus: string | null | undefined;
  hasRequiredConsents: boolean;
  membership: LandingMembership | null | undefined;
  /** The membership the invite created or returned (code redemption). */
  expectedMembershipId?: string | null;
  /** The gym the invite was issued for (staff-created profile invites). */
  expectedGymId?: string | null;
};

export type MemberLanding = { path: string; toGymClasses: boolean };

export const MEMBER_LANDING_FALLBACK: MemberLanding = { path: MEMBER_FALLBACK_PATH, toGymClasses: false };
const FALLBACK = MEMBER_LANDING_FALLBACK;

/** How long the landing check may take before the member gets the safe fallback. */
export const MEMBER_LANDING_TIMEOUT_MS = 10_000;

/** Resolves to the landing, or to the fallback if the check rejects or takes longer than timeoutMs. */
export function settleMemberLanding(
  pending: Promise<MemberLanding>,
  timeoutMs: number = MEMBER_LANDING_TIMEOUT_MS
): Promise<MemberLanding> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(FALLBACK), timeoutMs);
    pending.then(
      (landing) => {
        clearTimeout(timer);
        resolve(landing);
      },
      () => {
        clearTimeout(timer);
        resolve(FALLBACK);
      }
    );
  });
}

export function resolveMemberLanding(facts: MemberLandingFacts): MemberLanding {
  const membership = facts.membership;
  const bound = Boolean(facts.expectedMembershipId) || Boolean(facts.expectedGymId);
  const eligible =
    facts.inviteAccepted === true &&
    facts.activationStatus === "active" &&
    facts.hasRequiredConsents === true &&
    bound &&
    !!membership &&
    UUID.test(facts.userId) &&
    membership.user_id === facts.userId &&
    UUID.test(membership.gym_id) &&
    BOOKABLE_STATUSES.has(membership.membership_status) &&
    (!facts.expectedMembershipId || membership.id === facts.expectedMembershipId) &&
    (!facts.expectedGymId || membership.gym_id === facts.expectedGymId);

  return eligible && membership
    ? { path: `/gyms/${membership.gym_id}/classes`, toGymClasses: true }
    : FALLBACK;
}

export type LoadMemberLandingOptions = {
  userId: string;
  membershipId?: string | null;
  gymId?: string | null;
  checkRequiredConsents: (userId: string) => Promise<boolean>;
};

/** Reads activation, consents and membership fresh; any error falls back. */
export async function loadMemberLanding(
  client: SupabaseClient,
  options: LoadMemberLandingOptions
): Promise<MemberLanding> {
  if (!options.membershipId && !options.gymId) return FALLBACK;
  try {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("activation_status")
      .eq("id", options.userId)
      .maybeSingle();
    if (profileError) return FALLBACK;

    const consents = await options.checkRequiredConsents(options.userId);

    let query = client
      .from("gym_memberships")
      .select("id,gym_id,user_id,membership_status")
      .eq("user_id", options.userId);
    query = options.membershipId ? query.eq("id", options.membershipId) : query.eq("gym_id", options.gymId as string);
    const { data: membership, error: membershipError } = await query.maybeSingle();
    if (membershipError) return FALLBACK;

    return resolveMemberLanding({
      userId: options.userId,
      inviteAccepted: true,
      activationStatus: (profile as { activation_status?: string } | null)?.activation_status,
      hasRequiredConsents: consents,
      membership: membership as LandingMembership | null,
      expectedMembershipId: options.membershipId,
      expectedGymId: options.gymId,
    });
  } catch {
    return FALLBACK;
  }
}
