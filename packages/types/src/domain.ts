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

export type IntegrationConnectionStatus = "active" | "revoked" | "expired" | "error";

export type SyncJobStatus = "queued" | "running" | "succeeded" | "failed" | "retry_scheduled";

export type IntegrationProcessingStatus = "pending" | "processed" | "failed" | "ignored";

export type SocialConnectionStatus = "pending" | "accepted" | "blocked";

export type SocialInteractionType = "reaction" | "comment";

export type ReactionType = "fist" | "fire" | "shield" | "clap" | "crown";

export type ReportTargetType = "workout" | "comment" | "profile" | "gym";

export type ChallengeVisibility = "public" | "gym" | "invite_only";

export type ChallengeType = "volume" | "consistency" | "max_effort" | "time_based";

export type LeaderboardScope = "global" | "gym" | "exercise" | "challenge";

export type LeaderboardMetric =
  | "xp"
  | "volume_kg"
  | "estimated_1rm"
  | "consistency_days"
  | "challenge_score";

export type LeaderboardTimeframe = "daily" | "weekly" | "monthly" | "all_time";

export type ClassStatus = "scheduled" | "cancelled" | "completed";

export type BookingStatus = "booked" | "waitlisted" | "cancelled" | "attended" | "no_show";

export type BillingInterval = "monthly" | "quarterly" | "yearly" | "dropin";

export type WaitlistStatus = "pending" | "promoted" | "expired" | "cancelled";

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "unpaid";

export type PaymentStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "refunded"
  | "partially_refunded"
  | "failed";

export type RefundStatus = "pending" | "succeeded" | "failed" | "canceled";

export type DunningStage =
  | "payment_failed"
  | "retry_1"
  | "retry_2"
  | "retry_3"
  | "final_notice"
  | "cancelled";

export type AccessEventType =
  | "door_checkin"
  | "door_denied"
  | "frontdesk_checkin"
  | "manual_override";

export type AccessResult = "allowed" | "denied" | "override_allowed";

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

export type PrivacyRequestStatus =
  | "submitted"
  | "triaged"
  | "in_progress"
  | "in_review"
  | "fulfilled"
  | "completed"
  | "rejected";

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
  publishedAt: string;
  requiresReconsent: boolean;
  changeSummary?: string | null;
  supersedesPolicyVersionId?: string | null;
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

export interface RequiredConsentGap {
  consentType: ConsentType;
  requiredPolicyVersionId?: string | null;
  requiredPolicyVersion?: string | null;
  reason:
    | "missing_active_policy"
    | "missing_consent_record"
    | "latest_record_revoked"
    | "missing_policy_binding"
    | "reconsent_required";
}

export interface PrivacyRequest {
  id: string;
  userId: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  reason?: string | null;
  submittedAt: string;
  dueAt: string;
  triagedAt?: string | null;
  inProgressAt?: string | null;
  resolvedAt?: string | null;
  responseLocation?: string | null;
  responseExpiresAt?: string | null;
  responseContentType?: string | null;
  responseBytes?: number | null;
  handledBy?: string | null;
  notes?: string | null;
  slaBreachedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyExportJob {
  id: string;
  privacyRequestId: string;
  userId: string;
  status: Extract<SyncJobStatus, "queued" | "running" | "succeeded" | "failed" | "retry_scheduled">;
  storageBucket?: string | null;
  storagePath?: string | null;
  signedUrl?: string | null;
  signedUrlExpiresAt?: string | null;
  fileBytes?: number | null;
  recordCount?: number | null;
  retryCount: number;
  nextRetryAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface SocialConnection {
  id: string;
  followerUserId: string;
  followedUserId: string;
  status: SocialConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SocialInteraction {
  id: string;
  workoutId: string;
  actorUserId: string;
  interactionType: SocialInteractionType;
  reactionType?: ReactionType | null;
  commentText?: string | null;
  parentInteractionId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  marketingEnabled: boolean;
  workoutReactionsEnabled: boolean;
  commentsEnabled: boolean;
  challengeUpdatesEnabled: boolean;
  classRemindersEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface PushNotificationToken {
  id: string;
  userId: string;
  deviceId: string;
  platform: "ios" | "android" | "web";
  pushToken: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceConnection {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
  providerUserId?: string | null;
  scopes: string[];
  tokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSyncJob {
  id: string;
  connectionId: string;
  userId: string;
  provider: IntegrationProvider;
  jobType: string;
  status: SyncJobStatus;
  cursor: Record<string, unknown>;
  requestedBy?: string | null;
  retryCount: number;
  nextRetryAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  sourceWebhookEventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSyncCursor {
  id: string;
  connectionId: string;
  userId: string;
  provider: IntegrationProvider;
  cursor: Record<string, unknown>;
  lastSyncedAt?: string | null;
  lastJobId?: string | null;
  lastWebhookEventId?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalActivityImport {
  id: string;
  userId: string;
  connectionId: string;
  provider: IntegrationProvider;
  externalActivityId: string;
  activityType?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  calories?: number | null;
  averageHr?: number | null;
  maxHr?: number | null;
  rawData: Record<string, unknown>;
  mappedWorkoutId?: string | null;
  importedAt: string;
  createdAt: string;
}

export interface IntegrationWebhookEvent {
  id: string;
  provider: IntegrationProvider;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  payloadJson: Record<string, unknown>;
  processingStatus: IntegrationProcessingStatus;
  retryCount: number;
  nextRetryAt?: string | null;
  errorMessage?: string | null;
  receivedAt: string;
  processedAt?: string | null;
}

export interface Challenge {
  id: string;
  creatorUserId: string;
  gymId?: string | null;
  title: string;
  description?: string | null;
  challengeType: ChallengeType;
  visibility: ChallengeVisibility;
  startsAt: string;
  endsAt: string;
  pointsPerUnit: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  score: number;
  completed: boolean;
  joinedAt: string;
  updatedAt: string;
}

export interface Leaderboard {
  id: string;
  name: string;
  scope: LeaderboardScope;
  scopeGymId?: string | null;
  scopeExerciseId?: string | null;
  scopeChallengeId?: string | null;
  metric: LeaderboardMetric;
  timeframe: LeaderboardTimeframe;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  leaderboardId: string;
  userId: string;
  rank: number;
  score: number;
  details: Record<string, unknown>;
  calculatedAt: string;
}

export interface GymMembershipPlan {
  id: string;
  gymId: string;
  name: string;
  billingCycle: BillingInterval;
  priceCents: number;
  currency: string;
  classCreditsPerCycle?: number | null;
  trialDays?: number | null;
  cancelPolicy?: string | null;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GymClass {
  id: string;
  gymId: string;
  coachUserId?: string | null;
  title: string;
  description?: string | null;
  capacity: number;
  status: ClassStatus;
  startsAt: string;
  endsAt: string;
  bookingOpensAt?: string | null;
  bookingClosesAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassBooking {
  id: string;
  classId: string;
  userId: string;
  status: BookingStatus;
  bookedAt: string;
  checkedInAt?: string | null;
  sourceChannel: string;
  updatedAt: string;
}

export interface ClassWaitlistEntry {
  id: string;
  classId: string;
  userId: string;
  position: number;
  status: WaitlistStatus;
  notifiedAt?: string | null;
  expiresAt?: string | null;
  promotedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Waiver {
  id: string;
  gymId: string;
  title: string;
  policyVersion: string;
  languageCode: string;
  documentUrl: string;
  isActive: boolean;
  effectiveAt: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaiverAcceptance {
  id: string;
  waiverId: string;
  userId: string;
  gymMembershipId?: string | null;
  acceptedAt: string;
  source: string;
  locale?: string | null;
  signatureData: Record<string, unknown>;
  createdAt: string;
}

export interface Contract {
  id: string;
  gymId: string;
  title: string;
  contractType: string;
  policyVersion: string;
  languageCode: string;
  documentUrl: string;
  isActive: boolean;
  effectiveAt: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractAcceptance {
  id: string;
  contractId: string;
  userId: string;
  gymMembershipId?: string | null;
  acceptedAt: string;
  source: string;
  locale?: string | null;
  signatureData: Record<string, unknown>;
  createdAt: string;
}

export interface GymCheckin {
  id: string;
  gymId: string;
  userId: string;
  membershipId?: string | null;
  classId?: string | null;
  eventType: AccessEventType;
  result: AccessResult;
  sourceChannel: string;
  note?: string | null;
  checkedInAt: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface AccessLog {
  id: string;
  gymId: string;
  userId?: string | null;
  checkinId?: string | null;
  eventType: AccessEventType;
  result: AccessResult;
  reason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  createdBy?: string | null;
}

export interface MemberSubscription {
  id: string;
  gymId: string;
  userId: string;
  membershipPlanId?: string | null;
  status: SubscriptionStatus;
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAt?: string | null;
  canceledAt?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodBrand?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  subscriptionId?: string | null;
  gymId: string;
  userId: string;
  providerInvoiceId?: string | null;
  status: PaymentStatus;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  dueAt?: string | null;
  paidAt?: string | null;
  invoicePdfUrl?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  gymId: string;
  userId?: string | null;
  provider: string;
  providerPaymentIntentId?: string | null;
  providerChargeId?: string | null;
  status: PaymentStatus;
  paymentMethodType?: string | null;
  amountCents: number;
  feeCents: number;
  taxCents: number;
  netCents: number;
  currency: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  capturedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentTransactionId: string;
  providerRefundId?: string | null;
  status: RefundStatus;
  amountCents: number;
  currency: string;
  reason?: string | null;
  processedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DunningEvent {
  id: string;
  subscriptionId: string;
  invoiceId?: string | null;
  stage: DunningStage;
  attemptNumber: number;
  scheduledFor?: string | null;
  sentAt?: string | null;
  result?: string | null;
  note?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
