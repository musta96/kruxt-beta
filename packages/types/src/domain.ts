export type GymRole = "leader" | "officer" | "coach" | "member";

export type MembershipStatus =
  | "pending"
  | "trial"
  | "active"
  | "paused"
  | "cancelled";

export type ConsentType =
  | "terms"
  | "privacy"
  | "health_data_processing"
  | "marketing_email"
  | "push_notifications";

export type PrivacyRequestType =
  | "access"
  | "export"
  | "delete"
  | "rectify"
  | "restrict_processing";

export type RankTier =
  | "initiate"
  | "apprentice"
  | "trainee"
  | "grinder"
  | "forged"
  | "vanguard"
  | "sentinel"
  | "warden"
  | "champion"
  | "paragon"
  | "titan"
  | "legend";

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  homeGymId?: string | null;
  isPublic: boolean;
  xpTotal: number;
  level: number;
  rankTier: RankTier;
  chainDays: number;
  lastWorkoutAt?: string | null;
  locale?: string | null;
  preferredUnits: "metric" | "imperial";
}

export interface Gym {
  id: string;
  slug: string;
  name: string;
  motto?: string | null;
  description?: string | null;
  sigilUrl?: string | null;
  bannerUrl?: string | null;
  city?: string | null;
  countryCode?: string | null;
  timezone: string;
  isPublic: boolean;
  ownerUserId: string;
}

export interface GymMembership {
  id: string;
  gymId: string;
  userId: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
  membershipPlanId?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
}

export interface PolicyVersion {
  id: string;
  policyType: "terms" | "privacy" | "health_data" | "waiver";
  version: string;
  label?: string | null;
  documentUrl: string;
  effectiveAt: string;
  isActive: boolean;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  policyVersionId?: string | null;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string | null;
  source: string;
  locale?: string | null;
}

