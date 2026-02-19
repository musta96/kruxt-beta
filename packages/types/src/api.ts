import type {
  ConsentType,
  GymRole,
  MembershipStatus,
  PrivacyRequestType
} from "./domain";

export interface LogWorkoutAtomicInput {
  workout: Record<string, unknown>;
  exercises: Array<Record<string, unknown>>;
}

export interface UpsertProfileInput {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  locale?: string;
  preferredUnits?: "metric" | "imperial";
}

export interface CreateGymInput {
  slug: string;
  name: string;
  motto?: string;
  description?: string;
  city?: string;
  countryCode?: string;
  timezone?: string;
  isPublic?: boolean;
}

export interface JoinGymInput {
  gymId: string;
}

export interface UpsertConsentInput {
  consentType: ConsentType;
  granted: boolean;
  policyVersionId?: string;
  source?: "mobile" | "admin" | "web";
  locale?: string;
}

export interface UpdateMembershipInput {
  membershipId: string;
  membershipStatus?: MembershipStatus;
  role?: GymRole;
}

export interface WaitlistJoinInput {
  classId: string;
}

export interface PrivacyRequestInput {
  requestType: PrivacyRequestType;
  reason?: string;
}

export interface WaiverAcceptanceInput {
  waiverId: string;
  membershipId?: string;
  signatureData?: Record<string, unknown>;
}
