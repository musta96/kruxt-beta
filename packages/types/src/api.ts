import type {
  ConsentType,
  IntegrationProvider,
  ReactionType,
  ReportTargetType,
  SocialConnectionStatus,
  WorkoutBlockType,
  WorkoutType,
  WorkoutVisibility,
  GymRole,
  MembershipStatus,
  PrivacyRequestType
} from "./domain";

export interface LogWorkoutSetInput {
  setIndex?: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceM?: number;
  rpe?: number;
  isPr?: boolean;
}

export interface LogWorkoutExerciseInput {
  exerciseId: string;
  orderIndex?: number;
  blockId?: string;
  blockType?: WorkoutBlockType;
  targetReps?: string;
  targetWeightKg?: number;
  notes?: string;
  sets?: LogWorkoutSetInput[];
}

export interface LogWorkoutInput {
  gymId?: string;
  title?: string;
  workoutType?: WorkoutType;
  notes?: string;
  startedAt?: string;
  endedAt?: string;
  rpe?: number;
  visibility?: WorkoutVisibility;
  source?: IntegrationProvider;
  externalActivityId?: string;
}

export interface LogWorkoutAtomicInput {
  workout: LogWorkoutInput;
  exercises: LogWorkoutExerciseInput[];
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

export interface FollowUserInput {
  followedUserId: string;
}

export interface RespondFollowRequestInput {
  connectionId: string;
  status: Extract<SocialConnectionStatus, "accepted" | "blocked">;
}

export interface ReactionInput {
  workoutId: string;
  reactionType: ReactionType;
}

export interface CommentInput {
  workoutId: string;
  commentText: string;
  parentInteractionId?: string;
}

export interface BlockUserInput {
  blockedUserId: string;
  reason?: string;
}

export interface UserReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

export interface UpsertNotificationPreferencesInput {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  marketingEnabled?: boolean;
  workoutReactionsEnabled?: boolean;
  commentsEnabled?: boolean;
  challengeUpdatesEnabled?: boolean;
  classRemindersEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
}

export interface RegisterPushTokenInput {
  deviceId: string;
  platform: "ios" | "android" | "web";
  pushToken: string;
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
