export type GymRole = "leader" | "officer" | "coach" | "member";

export type WorkoutVisibility = "public" | "followers" | "gym" | "private";

export type WorkoutType =
  | "strength"
  | "functional"
  | "hyrox"
  | "crossfit"
  | "conditioning"
  | "custom";

export type WorkoutBlockType =
  | "straight_set"
  | "superset"
  | "circuit"
  | "emom"
  | "amrap";

export type IntegrationProvider =
  | "apple_health"
  | "garmin"
  | "fitbit"
  | "huawei_health"
  | "suunto"
  | "oura"
  | "whoop"
  | "manual";

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

export type GuildRole = "leader" | "officer" | "member";

export interface GuildRosterMember {
  membershipId: string;
  userId: string;
  role: GymRole;
  guildRole: GuildRole;
  membershipStatus: MembershipStatus;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  level: number;
  rankTier: RankTier;
  joinedAt?: string | null;
}

export interface GuildHallSnapshot {
  userId: string;
  gymId?: string;
  gymName?: string;
  gymSlug?: string;
  role?: GymRole;
  guildRole?: GuildRole;
  membershipStatus?: MembershipStatus;
  isStaff: boolean;
  rosterCount: number;
  pendingApprovals: number;
  upcomingClasses: number;
  rankTier?: RankTier;
  level?: number;
  xpTotal?: number;
  chainDays?: number;
}

export interface GymOpsSummary {
  gymId: string;
  pendingMemberships: number;
  activeOrTrialMembers: number;
  upcomingClasses: number;
  pendingWaitlistEntries: number;
  openPrivacyRequests: number;
}
