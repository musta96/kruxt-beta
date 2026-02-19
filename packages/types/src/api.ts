import type {
  AccessEventType,
  AccessResult,
  BillingInterval,
  BookingStatus,
  ChallengeType,
  ChallengeVisibility,
  ClassStatus,
  ConsentType,
  DunningStage,
  IntegrationConnectionStatus,
  IntegrationProvider,
  PaymentStatus,
  ReactionType,
  LeaderboardScope,
  LeaderboardMetric,
  LeaderboardTimeframe,
  ReportTargetType,
  SubscriptionStatus,
  SocialConnectionStatus,
  WaitlistStatus,
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

export interface UpsertDeviceConnectionInput {
  provider: IntegrationProvider;
  status?: IntegrationConnectionStatus;
  providerUserId?: string | null;
  scopes?: string[];
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface QueueDeviceSyncJobInput {
  connectionId: string;
  jobType?: string;
  cursor?: Record<string, unknown>;
  sourceWebhookEventId?: string | null;
}

export interface ProviderWebhookIngestInput {
  provider: IntegrationProvider;
  providerEventId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
  payloadHash?: string;
  userId?: string;
  connectionId?: string;
  providerUserId?: string;
}

export interface CreateChallengeInput {
  gymId?: string | null;
  title: string;
  description?: string;
  challengeType: ChallengeType;
  visibility?: ChallengeVisibility;
  startsAt: string;
  endsAt: string;
  pointsPerUnit?: number;
}

export interface UpdateChallengeInput extends Partial<CreateChallengeInput> {}

export interface JoinChallengeInput {
  challengeId: string;
}

export interface SubmitChallengeProgressInput {
  challengeId: string;
  scoreDelta: number;
  markCompleted?: boolean;
}

export interface ListLeaderboardsInput {
  scope?: LeaderboardScope;
  metric?: LeaderboardMetric;
  timeframe?: LeaderboardTimeframe;
  gymId?: string;
  exerciseId?: string;
  challengeId?: string;
  activeOnly?: boolean;
  limit?: number;
}

export interface CreateMembershipPlanInput {
  name: string;
  billingCycle: BillingInterval;
  priceCents: number;
  currency?: string;
  classCreditsPerCycle?: number | null;
  trialDays?: number | null;
  cancelPolicy?: string;
  providerProductId?: string;
  providerPriceId?: string;
  isActive?: boolean;
}

export interface UpdateMembershipPlanInput extends Partial<CreateMembershipPlanInput> {}

export interface CreateGymClassInput {
  coachUserId?: string | null;
  title: string;
  description?: string;
  capacity: number;
  status?: ClassStatus;
  startsAt: string;
  endsAt: string;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
}

export interface UpdateGymClassInput extends Partial<CreateGymClassInput> {}

export interface UpsertClassBookingInput {
  classId: string;
  userId: string;
  status?: BookingStatus;
  sourceChannel?: string;
  checkedInAt?: string | null;
}

export interface UpdateClassWaitlistInput {
  status?: WaitlistStatus;
  notifiedAt?: string | null;
  expiresAt?: string | null;
}

export interface RecordGymCheckinInput {
  userId: string;
  membershipId?: string;
  classId?: string;
  eventType: AccessEventType;
  result: AccessResult;
  sourceChannel?: string;
  note?: string;
  checkedInAt?: string;
}

export interface RecordAccessLogInput {
  userId?: string | null;
  checkinId?: string | null;
  eventType: AccessEventType;
  result: AccessResult;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWaiverInput {
  title: string;
  policyVersion: string;
  languageCode?: string;
  documentUrl: string;
  isActive?: boolean;
  effectiveAt?: string;
}

export interface UpdateWaiverInput extends Partial<CreateWaiverInput> {}

export interface CreateContractInput {
  title: string;
  contractType?: string;
  policyVersion: string;
  languageCode?: string;
  documentUrl: string;
  isActive?: boolean;
  effectiveAt?: string;
}

export interface UpdateContractInput extends Partial<CreateContractInput> {}

export interface AdminRecordAcceptanceInput {
  userId: string;
  membershipId?: string;
  signatureData?: Record<string, unknown>;
}

export interface UpsertMemberSubscriptionInput {
  userId: string;
  membershipPlanId?: string;
  status?: SubscriptionStatus;
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  cancelAt?: string;
  canceledAt?: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateInvoiceInput {
  status?: PaymentStatus;
  amountPaidCents?: number;
  amountDueCents?: number;
  dueAt?: string | null;
  paidAt?: string | null;
  invoicePdfUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDunningEventInput {
  stage?: DunningStage;
  attemptNumber?: number;
  scheduledFor?: string | null;
  sentAt?: string | null;
  result?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
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
