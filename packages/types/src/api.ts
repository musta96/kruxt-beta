import type {
  AccessEventType,
  AccessResult,
  AnonymizationCheckStatus,
  AuthEventRiskLevel,
  AuthEventType,
  BillingInterval,
  BillingScope,
  BookingStatus,
  ChallengeType,
  ChallengeVisibility,
  ClassStatus,
  ConsentType,
  CrmLeadStatus,
  DataPartnerExportStatus,
  DataPartnerGrantStatus,
  DataPartnerStatus,
  DataProductAccessLevel,
  DataAggregationJobStatus,
  DataReleaseApprovalStatus,
  DiscountType,
  DunningStage,
  GymAddonCategory,
  GymAddonSubscriptionStatus,
  GymAutomationRunStatus,
  IntegrationConnectionStatus,
  IntegrationProvider,
  PartnerAppStatus,
  PartnerInstallStatus,
  PartnerRevenueEventStatus,
  PaymentStatus,
  PlatformOperatorRole,
  PricingAssignmentStatus,
  PricingExperimentStatus,
  ReactionType,
  LeaderboardScope,
  LeaderboardMetric,
  LeaderboardTimeframe,
  ReportTargetType,
  StaffShiftStatus,
  SupportAccessGrantStatus,
  SupportAccessSessionStatus,
  StaffTimeEntryStatus,
  SubscriptionStatus,
  SocialConnectionStatus,
  WaitlistStatus,
  WorkoutBlockType,
  WorkoutType,
  WorkoutVisibility,
  GymRole,
  MembershipStatus,
  IncidentNotificationChannel,
  IncidentSeverity,
  IncidentStatus,
  PrivacyRequestType,
  PrivacyRequestStatus,
  InvoiceConnectionStatus,
  InvoiceDeliveryStatus,
  InvoiceScheme,
  SupportActorType,
  SupportTicketChannel,
  SupportTicketPriority,
  SupportTicketStatus
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
  ipAddress?: string;
  userAgent?: string;
  evidence?: Record<string, unknown>;
}

export interface PublishPolicyVersionInput {
  policyType: "terms" | "privacy" | "health_data" | "waiver";
  version: string;
  documentUrl: string;
  effectiveAt?: string;
  label?: string;
  requiresReconsent?: boolean;
  changeSummary?: string;
  isActive?: boolean;
  supersedesPolicyVersionId?: string;
}

export interface SubmitPrivacyRequestInput {
  requestType: PrivacyRequestType;
  reason?: string;
}

export interface TransitionPrivacyRequestInput {
  requestId: string;
  nextStatus: PrivacyRequestStatus;
  notes?: string;
}

export interface UpdateMembershipInput {
  membershipId: string;
  membershipStatus?: MembershipStatus;
  role?: GymRole;
}

export interface UpsertGymRolePermissionInput {
  role: GymRole;
  permissionKey: string;
  isAllowed: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpsertGymUserPermissionOverrideInput {
  userId: string;
  permissionKey: string;
  isAllowed: boolean;
  reason?: string | null;
  metadata?: Record<string, unknown>;
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

export interface UpsertUserSecuritySettingsInput {
  mfaRequired?: boolean;
  mfaEnabled?: boolean;
  passkeyEnabled?: boolean;
  newDeviceAlerts?: boolean;
  loginAlertChannel?: "email" | "push" | "none";
  sessionTimeoutMinutes?: number;
  allowMultiDeviceSessions?: boolean;
  passwordUpdatedAt?: string | null;
  lastSecurityReviewedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpsertTrustedDeviceInput {
  deviceId: string;
  platform?: "ios" | "android" | "web" | "unknown";
  deviceName?: string;
  appVersion?: string;
  osVersion?: string;
  lastSeenAt?: string;
  lastIp?: string | null;
  isActive?: boolean;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LogUserAuthEventInput {
  eventType: AuthEventType;
  riskLevel?: AuthEventRiskLevel;
  deviceId?: string | null;
  platform?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
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

export interface CreateStaffShiftInput {
  staffUserId: string;
  title?: string;
  shiftRole?: string;
  startsAt: string;
  endsAt: string;
  status?: StaffShiftStatus;
  hourlyRateCents?: number | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateStaffShiftInput extends Partial<CreateStaffShiftInput> {}

export interface CreateStaffTimeEntryInput {
  shiftId?: string | null;
  staffUserId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  breakMinutes?: number;
  status?: StaffTimeEntryStatus;
  sourceChannel?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateStaffTimeEntryInput extends Partial<CreateStaffTimeEntryInput> {
  approvedBy?: string | null;
  approvedAt?: string | null;
}

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

export interface CreateConsumerPlanInput {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateConsumerPlanInput extends Partial<CreateConsumerPlanInput> {}

export interface CreateConsumerPlanPriceInput {
  planId: string;
  provider?: string;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  countryCode?: string | null;
  currency?: string;
  amountCents: number;
  billingPeriod?: "weekly" | "monthly" | "quarterly" | "yearly" | "one_time";
  billingPeriodCount?: number;
  trialDays?: number | null;
  isDefault?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateConsumerPlanPriceInput extends Partial<CreateConsumerPlanPriceInput> {}

export interface UpsertConsumerEntitlementInput {
  userId: string;
  planId?: string | null;
  status?: SubscriptionStatus;
  provider?: string;
  providerCustomerId?: string | null;
  providerOriginalTransactionId?: string | null;
  providerSubscriptionId?: string | null;
  startedAt?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
  lastVerifiedAt?: string | null;
  rawReceipt?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreatePricingExperimentInput {
  scope: BillingScope;
  gymId?: string | null;
  name: string;
  hypothesis?: string;
  status?: PricingExperimentStatus;
  targetFilters?: Record<string, unknown>;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface UpdatePricingExperimentInput extends Partial<CreatePricingExperimentInput> {}

export interface CreatePricingExperimentVariantInput {
  experimentId: string;
  variantKey: string;
  allocationPercent: number;
  targetType: "consumer_plan_price" | "gym_membership_plan";
  targetId: string;
  isControl?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpsertPricingExperimentAssignmentInput {
  experimentId: string;
  variantId: string;
  userId?: string | null;
  gymId?: string | null;
  assignmentStatus?: PricingAssignmentStatus;
  assignedAt?: string;
  firstExposedAt?: string | null;
  convertedAt?: string | null;
  conversionReference?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateDiscountCampaignInput {
  scope: BillingScope;
  gymId?: string | null;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  percentOff?: number | null;
  amountOffCents?: number | null;
  trialDaysOff?: number | null;
  currency?: string | null;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  eligibleFilters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateDiscountCampaignInput extends Partial<CreateDiscountCampaignInput> {}

export interface RecordDiscountRedemptionInput {
  campaignId: string;
  userId?: string | null;
  gymId?: string | null;
  memberSubscriptionId?: string | null;
  consumerEntitlementId?: string | null;
  invoiceId?: string | null;
  amountDiscountCents: number;
  currency?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreatePlatformPlanInput {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  amountCents: number;
  currency?: string;
  billingPeriod?: "monthly" | "quarterly" | "yearly";
  trialDays?: number | null;
  provider?: string;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  modules?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePlatformPlanInput extends Partial<CreatePlatformPlanInput> {}

export interface UpsertGymPlatformSubscriptionInput {
  platformPlanId?: string | null;
  status?: SubscriptionStatus;
  provider?: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAt?: string | null;
  canceledAt?: string | null;
  billingContactEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateGymPlatformInvoiceInput {
  gymPlatformSubscriptionId?: string | null;
  provider?: string;
  providerInvoiceId?: string | null;
  status?: PaymentStatus;
  currency?: string;
  subtotalCents?: number;
  taxCents?: number;
  totalCents?: number;
  amountPaidCents?: number;
  amountDueCents?: number;
  dueAt?: string | null;
  paidAt?: string | null;
  invoicePdfUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateGymPlatformPaymentTransactionInput {
  gymPlatformInvoiceId?: string | null;
  provider?: string;
  providerPaymentIntentId?: string | null;
  providerChargeId?: string | null;
  status?: PaymentStatus;
  paymentMethodType?: string | null;
  amountCents: number;
  feeCents?: number;
  taxCents?: number;
  netCents?: number;
  currency?: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateGymPlatformRefundInput {
  gymPlatformPaymentTransactionId: string;
  providerRefundId?: string | null;
  status?: "pending" | "succeeded" | "failed" | "canceled";
  amountCents: number;
  currency?: string;
  reason?: string | null;
  processedAt?: string | null;
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

export interface CreateGymCrmLeadInput {
  ownerUserId?: string | null;
  fullName: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: CrmLeadStatus;
  interestedServices?: string[];
  tags?: string[];
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymCrmLeadInput extends Partial<CreateGymCrmLeadInput> {
  convertedMembershipId?: string | null;
}

export interface CreateGymCrmLeadActivityInput {
  leadId: string;
  activityType:
    | "note"
    | "call"
    | "email"
    | "sms"
    | "meeting"
    | "trial_booked"
    | "trial_completed"
    | "status_change"
    | "conversion";
  activityAt?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface UpsertPlatformOperatorAccountInput {
  userId: string;
  role?: PlatformOperatorRole;
  isActive?: boolean;
  mfaRequired?: boolean;
  lastLoginAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpsertPlatformOperatorPermissionOverrideInput {
  userId: string;
  permissionKey: string;
  isAllowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateGymSupportAccessGrantInput {
  gymId: string;
  operatorUserId: string;
  status?: SupportAccessGrantStatus;
  permissionScope?: string[];
  reason: string;
  note?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymSupportAccessGrantInput
  extends Partial<Omit<CreateGymSupportAccessGrantInput, "gymId" | "operatorUserId" | "reason">> {
  approvedByUserId?: string | null;
  requestedByUserId?: string | null;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
}

export interface CreateGymSupportAccessSessionInput {
  grantId: string;
  gymId: string;
  operatorUserId: string;
  supportTicketId?: string | null;
  sessionStatus?: SupportAccessSessionStatus;
  justification: string;
  actionsSummary?: Array<Record<string, unknown>>;
  endedAt?: string | null;
  terminatedReason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymSupportAccessSessionInput
  extends Partial<Omit<CreateGymSupportAccessSessionInput, "grantId" | "gymId" | "operatorUserId" | "justification">> {}

export interface UpsertPlatformFeatureOverrideInput {
  featureKey: string;
  targetScope?: "global" | "region" | "segment";
  targetValue?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertUserDataSharingPreferenceInput {
  allowAggregatedAnalytics?: boolean;
  allowThirdPartyAggregatedSharing?: boolean;
  allowPseudonymousResearch?: boolean;
  source?: string;
  grantedAt?: string;
  revokedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateDataPartnerInput {
  legalName: string;
  displayName: string;
  contactEmail: string;
  countryCode?: string | null;
  status?: DataPartnerStatus;
  dpaSignedAt?: string | null;
  dpaReference?: string | null;
  allowedRegions?: string[];
  prohibitedDataCategories?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDataPartnerInput extends Partial<CreateDataPartnerInput> {}

export interface CreateDataProductInput {
  code: string;
  name: string;
  description?: string;
  accessLevel?: DataProductAccessLevel;
  minKAnonymity?: number;
  requiresUserOptIn?: boolean;
  allowedMetrics?: string[];
  retentionDays?: number | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDataProductInput extends Partial<CreateDataProductInput> {}

export interface UpsertDataPartnerAccessGrantInput {
  partnerId: string;
  productId: string;
  status?: DataPartnerGrantStatus;
  legalBasis: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDataPartnerExportInput {
  partnerId: string;
  productId: string;
  accessGrantId?: string | null;
  exportStatus?: DataPartnerExportStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
  generatedBy?: string | null;
  exportLevel?: DataProductAccessLevel;
  rowsExported?: number;
  includesPersonalData?: boolean;
  outputUri?: string | null;
  checksumSha256?: string | null;
  generatedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDataPartnerExportInput extends Partial<CreateDataPartnerExportInput> {}

export interface CreateGymAddonCatalogInput {
  code: string;
  name: string;
  description?: string;
  category: GymAddonCategory;
  billingScope?: BillingScope;
  defaultPriceCents?: number;
  currency?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymAddonCatalogInput extends Partial<CreateGymAddonCatalogInput> {}

export interface UpsertGymAddonSubscriptionInput {
  addonId: string;
  status?: GymAddonSubscriptionStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  provider?: string;
  providerSubscriptionId?: string | null;
  billingReference?: string | null;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateGymAdvancedAnalyticsViewInput {
  name: string;
  description?: string;
  visibility?: "owner_only" | "staff";
  querySpec?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymAdvancedAnalyticsViewInput extends Partial<CreateGymAdvancedAnalyticsViewInput> {}

export interface CreateGymAutomationPlaybookInput {
  addonSubscriptionId?: string | null;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  actionPlan?: Array<Record<string, unknown>>;
  isActive?: boolean;
  requiresHumanApproval?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymAutomationPlaybookInput extends Partial<CreateGymAutomationPlaybookInput> {}

export interface CreateGymAutomationRunInput {
  playbookId: string;
  runStatus?: GymAutomationRunStatus;
  triggeredBy?: string;
  triggerPayload?: Record<string, unknown>;
  plannedActions?: Array<Record<string, unknown>>;
  executedActions?: Array<Record<string, unknown>>;
  requiresHumanApproval?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected" | "not_required";
  approvedBy?: string | null;
  approvedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateGymAutomationRunInput extends Partial<CreateGymAutomationRunInput> {}

export interface CreatePartnerMarketplaceAppInput {
  partnerId: string;
  appCode: string;
  name: string;
  description?: string;
  category: string;
  status?: PartnerAppStatus;
  pricingModel?: "subscription" | "usage" | "revshare" | "hybrid";
  revenueShareBps?: number | null;
  installUrl?: string | null;
  docsUrl?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdatePartnerMarketplaceAppInput extends Partial<CreatePartnerMarketplaceAppInput> {}

export interface UpsertGymPartnerAppInstallInput {
  partnerAppId: string;
  installStatus?: PartnerInstallStatus;
  externalAccountId?: string | null;
  billingReference?: string | null;
  installedAt?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreatePartnerRevenueEventInput {
  gymId?: string | null;
  partnerId: string;
  partnerAppId?: string | null;
  eventType: "subscription_fee" | "usage_fee" | "revshare_credit" | "referral_bonus";
  eventStatus?: PartnerRevenueEventStatus;
  periodStart?: string | null;
  periodEnd?: string | null;
  grossAmountCents?: number;
  platformAmountCents?: number;
  partnerAmountCents?: number;
  currency?: string;
  sourceReference?: string | null;
  recognizedAt?: string | null;
  paidAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdatePartnerRevenueEventInput extends Partial<CreatePartnerRevenueEventInput> {}

export interface CreateDataAggregationJobInput {
  productId: string;
  jobStatus?: DataAggregationJobStatus;
  sourceWindowStart?: string | null;
  sourceWindowEnd?: string | null;
  aggregationSpec?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  totalSourceRows?: number;
  outputRowCount?: number;
  kAnonymityFloor?: number;
  minGroupSizeObserved?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDataAggregationJobInput extends Partial<CreateDataAggregationJobInput> {}

export interface UpsertDataAnonymizationCheckInput {
  aggregationJobId: string;
  checkType: "k_anonymity" | "l_diversity" | "t_closeness" | "small_cell_suppression" | "manual_review";
  status?: AnonymizationCheckStatus;
  thresholdValue?: number | null;
  observedValue?: number | null;
  details?: Record<string, unknown>;
  checkedBy?: string | null;
  checkedAt?: string;
}

export interface UpsertDataReleaseApprovalInput {
  exportId: string;
  requiredApprovalType: "compliance" | "security" | "business";
  status?: DataReleaseApprovalStatus;
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PrivacyRequestInput {
  requestType: PrivacyRequestType;
  reason?: string;
}

export interface CreateSecurityIncidentInput {
  gymId?: string | null;
  title: string;
  description?: string;
  severity?: IncidentSeverity;
  source?: string;
  drillMode?: boolean;
  requiresFtcNotice?: boolean;
  requiresGdprNotice?: boolean;
  detectedAt?: string;
  ftcDeadlineHours?: number;
  gdprDeadlineHours?: number;
  affectedUserCount?: number;
  affectedGymCount?: number;
  metadata?: Record<string, unknown>;
}

export interface TransitionSecurityIncidentInput {
  incidentId: string;
  nextStatus: IncidentStatus;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueIncidentEscalationInput {
  incidentId: string;
  reason?: string;
  channels?: IncidentNotificationChannel[];
  emailDestination?: string;
  webhookDestination?: string;
  payload?: Record<string, unknown>;
  forceLive?: boolean;
  templateKey?: string;
}

export interface RunIncidentNotifierInput {
  claimLimit?: number;
  retryDelaySeconds?: number;
  maxRetries?: number;
  forceDrill?: boolean;
}

export interface WaiverAcceptanceInput {
  waiverId: string;
  membershipId?: string;
  signatureData?: Record<string, unknown>;
}

export interface UpsertGymBrandSettingsInput {
  appDisplayName?: string | null;
  logoUrl?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  surfaceColor?: string | null;
  textColor?: string | null;
  headlineFont?: string | null;
  bodyFont?: string | null;
  statsFont?: string | null;
  launchScreenMessage?: string | null;
  termsUrl?: string | null;
  privacyUrl?: string | null;
  supportEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpsertGymFeatureSettingInput {
  featureKey: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  config?: Record<string, unknown>;
  note?: string | null;
}

export interface UpsertInvoiceProviderConnectionInput {
  providerSlug: string;
  displayName?: string | null;
  connectionStatus?: InvoiceConnectionStatus;
  environment?: "test" | "live";
  accountIdentifier?: string | null;
  credentialsReference?: string | null;
  webhookSecretReference?: string | null;
  isDefault?: boolean;
  supportedCountries?: string[];
  metadata?: Record<string, unknown>;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
}

export interface UpsertInvoiceComplianceProfileInput {
  legalEntityName: string;
  vatNumber?: string | null;
  taxCode?: string | null;
  registrationNumber?: string | null;
  taxRegime?: string | null;
  countryCode: string;
  defaultCurrency?: string;
  invoiceScheme?: InvoiceScheme;
  pecEmail?: string | null;
  sdiDestinationCode?: string | null;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInvoiceDeliveryJobInput {
  invoiceId: string;
  providerConnectionId?: string | null;
  targetCountryCode: string;
  deliveryChannel?: "provider_api" | "sdi" | "email" | "manual_export";
  payloadFormat?: "json" | "xml_fatturapa" | "pdf" | "csv";
  status?: InvoiceDeliveryStatus;
  idempotencyKey: string;
  nextRetryAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  providerDocumentId?: string | null;
  providerResponse?: Record<string, unknown>;
  errorMessage?: string | null;
}

export interface SubmitSupportTicketInput {
  subject: string;
  description: string;
  gymId?: string | null;
  category?: string;
  priority?: SupportTicketPriority;
  channel?: SupportTicketChannel;
  reporterEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateSupportTicketInput {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  ownerUserId?: string | null;
  requiresHumanApproval?: boolean;
  aiSummary?: string | null;
  aiTriageLabels?: string[];
  aiRecommendedActions?: Array<Record<string, unknown>>;
  aiConfidence?: number | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateSupportTicketMessageInput {
  actorType: SupportActorType;
  actorUserId?: string | null;
  actorLabel?: string | null;
  isInternal?: boolean;
  body: string;
  attachments?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface CreateSupportAutomationRunInput {
  agentName: string;
  triggerSource?: string;
  runStatus?: "queued" | "running" | "awaiting_approval";
  requiresApproval?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected" | "not_required";
  planJson?: Record<string, unknown>;
  proposedChanges?: Array<Record<string, unknown>>;
  resultSummary?: string | null;
  resultPayload?: Record<string, unknown>;
  errorMessage?: string | null;
}
