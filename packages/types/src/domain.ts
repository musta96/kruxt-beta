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

export type BillingScope = "b2c" | "b2b";

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

export type PricingExperimentStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "archived";

export type PricingAssignmentStatus = "assigned" | "exposed" | "converted" | "expired";

export type DiscountType = "percent" | "amount" | "trial_days";

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

export type StaffShiftStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled";

export type StaffTimeEntryStatus = "open" | "submitted" | "approved" | "rejected";

export type CrmLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "trial_scheduled"
  | "trial_completed"
  | "won"
  | "lost";

export type PlatformOperatorRole =
  | "founder"
  | "ops_admin"
  | "support_admin"
  | "compliance_admin"
  | "analyst"
  | "read_only";

export type SupportAccessGrantStatus =
  | "requested"
  | "approved"
  | "denied"
  | "revoked"
  | "expired";

export type SupportAccessSessionStatus = "active" | "ended" | "terminated";

export type DataPartnerStatus = "prospect" | "active" | "suspended" | "terminated";

export type DataProductAccessLevel = "aggregate_anonymous" | "pseudonymous";

export type DataPartnerGrantStatus =
  | "requested"
  | "approved"
  | "denied"
  | "revoked"
  | "expired";

export type DataPartnerExportStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type GymAddonCategory =
  | "analytics"
  | "workforce"
  | "automation"
  | "engagement"
  | "integrations"
  | "other";

export type GymAddonSubscriptionStatus = "trialing" | "active" | "paused" | "past_due" | "canceled";

export type GymAutomationRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PartnerAppStatus = "draft" | "active" | "suspended" | "retired";

export type PartnerInstallStatus = "active" | "paused" | "revoked" | "error";

export type PartnerRevenueEventStatus = "pending" | "recognized" | "invoiced" | "paid" | "void";

export type DataAggregationJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type AnonymizationCheckStatus = "passed" | "failed" | "waived";

export type DataReleaseApprovalStatus = "pending" | "approved" | "rejected";

export type AuthEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "token_refreshed"
  | "new_device_trusted"
  | "trusted_device_revoked"
  | "session_revoked";

export type AuthEventRiskLevel = "low" | "medium" | "high";

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

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "detected"
  | "triaged"
  | "investigating"
  | "contained"
  | "notified"
  | "resolved"
  | "closed";

export type IncidentActionType =
  | "created"
  | "status_changed"
  | "deadline_recomputed"
  | "escalation_triggered"
  | "notification_queued"
  | "notification_sent"
  | "notification_failed"
  | "note_added";

export type IncidentNotificationChannel = "email" | "webhook";

export type IncidentDeliveryMode = "drill" | "live";

export type LegalHoldType =
  | "litigation"
  | "fraud_investigation"
  | "payment_dispute"
  | "safety_incident"
  | "regulatory_inquiry"
  | "other";

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

export interface GymPermissionCatalogEntry {
  permissionKey: string;
  category: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymRolePermission {
  id: string;
  gymId: string;
  role: GymRole;
  permissionKey: string;
  isAllowed: boolean;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymUserPermissionOverride {
  id: string;
  gymId: string;
  userId: string;
  permissionKey: string;
  isAllowed: boolean;
  reason?: string | null;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface PrivacyDeleteJob {
  id: string;
  privacyRequestId: string;
  userId: string;
  status: Extract<SyncJobStatus, "queued" | "running" | "succeeded" | "failed" | "retry_scheduled">;
  anonymizationSummary: Record<string, unknown>;
  retryCount: number;
  nextRetryAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalHold {
  id: string;
  userId: string;
  privacyRequestId?: string | null;
  holdType: LegalHoldType;
  reason: string;
  isActive: boolean;
  startsAt: string;
  endsAt?: string | null;
  createdBy?: string | null;
  releasedBy?: string | null;
  releasedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityIncident {
  id: string;
  gymId?: string | null;
  title: string;
  description?: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  drillMode: boolean;
  requiresFtcNotice: boolean;
  requiresGdprNotice: boolean;
  detectedAt: string;
  ftcNoticeDueAt?: string | null;
  gdprNoticeDueAt?: string | null;
  firstTriagedAt?: string | null;
  investigationStartedAt?: string | null;
  containedAt?: string | null;
  notifiedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  affectedUserCount: number;
  affectedGymCount: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentAction {
  id: string;
  incidentId: string;
  actionType: IncidentActionType;
  actionNote?: string | null;
  metadata: Record<string, unknown>;
  actorUserId?: string | null;
  actorRole?: string | null;
  createdAt: string;
}

export interface IncidentNotificationJob {
  id: string;
  incidentId: string;
  channel: IncidentNotificationChannel;
  destination: string;
  templateKey: string;
  payload: Record<string, unknown>;
  deliveryMode: IncidentDeliveryMode;
  provider: string;
  status: Extract<SyncJobStatus, "queued" | "running" | "succeeded" | "failed" | "retry_scheduled">;
  attemptCount: number;
  nextAttemptAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastError?: string | null;
  responsePayload: Record<string, unknown>;
  createdBy?: string | null;
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

export interface UserSecuritySettings {
  userId: string;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  passkeyEnabled: boolean;
  newDeviceAlerts: boolean;
  loginAlertChannel: "email" | "push" | "none";
  sessionTimeoutMinutes: number;
  allowMultiDeviceSessions: boolean;
  passwordUpdatedAt?: string | null;
  lastSecurityReviewedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserTrustedDevice {
  id: string;
  userId: string;
  deviceId: string;
  platform: "ios" | "android" | "web" | "unknown";
  deviceName?: string | null;
  appVersion?: string | null;
  osVersion?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp?: string | null;
  isActive: boolean;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserAuthEvent {
  id: string;
  userId: string;
  eventType: AuthEventType;
  riskLevel: AuthEventRiskLevel;
  deviceId?: string | null;
  platform?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  failureReason?: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
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

export interface StaffShift {
  id: string;
  gymId: string;
  staffUserId: string;
  createdBy?: string | null;
  title: string;
  shiftRole?: string | null;
  startsAt: string;
  endsAt: string;
  status: StaffShiftStatus;
  hourlyRateCents?: number | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTimeEntry {
  id: string;
  shiftId?: string | null;
  gymId: string;
  staffUserId: string;
  clockInAt: string;
  clockOutAt?: string | null;
  breakMinutes: number;
  workedMinutes?: number | null;
  status: StaffTimeEntryStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  sourceChannel: string;
  note?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymKpiDailySnapshot {
  id: string;
  gymId: string;
  metricDate: string;
  activeMembers: number;
  newMemberships: number;
  cancelledMemberships: number;
  checkinsCount: number;
  classBookingsCount: number;
  classAttendanceCount: number;
  waitlistPromotionsCount: number;
  revenueCents: number;
  mrrCents: number;
  averageClassFillRate?: number | null;
  averageChainDays?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymCrmLead {
  id: string;
  gymId: string;
  ownerUserId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source: string;
  status: CrmLeadStatus;
  interestedServices: string[];
  tags: string[];
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  convertedMembershipId?: string | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymCrmLeadActivity {
  id: string;
  leadId: string;
  gymId: string;
  actorUserId?: string | null;
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
  activityAt: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformPermissionCatalogEntry {
  permissionKey: string;
  category: string;
  label: string;
  description?: string | null;
  isSensitive: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformRolePermission {
  id: string;
  role: PlatformOperatorRole;
  permissionKey: string;
  isAllowed: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOperatorAccount {
  userId: string;
  role: PlatformOperatorRole;
  isActive: boolean;
  mfaRequired: boolean;
  lastLoginAt?: string | null;
  createdBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOperatorPermissionOverride {
  id: string;
  userId: string;
  permissionKey: string;
  isAllowed: boolean;
  reason?: string | null;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymSupportAccessGrant {
  id: string;
  gymId: string;
  operatorUserId: string;
  requestedByUserId?: string | null;
  approvedByUserId?: string | null;
  status: SupportAccessGrantStatus;
  permissionScope: string[];
  reason: string;
  note?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymSupportAccessSession {
  id: string;
  grantId: string;
  gymId: string;
  operatorUserId: string;
  supportTicketId?: string | null;
  sessionStatus: SupportAccessSessionStatus;
  justification: string;
  actionsSummary: Array<Record<string, unknown>>;
  startedAt: string;
  endedAt?: string | null;
  terminatedReason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformKpiDailySnapshot {
  id: string;
  metricDate: string;
  totalUsers: number;
  activeUsers7d: number;
  activeGyms7d: number;
  workoutsLoggedCount: number;
  proofPostsCount: number;
  classBookingsCount: number;
  supportTicketsOpen: number;
  connectedDevicesCount: number;
  mrrCents: number;
  churnRatePercent?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeatureOverride {
  id: string;
  featureKey: string;
  targetScope: "global" | "region" | "segment";
  targetValue: string;
  enabled: boolean;
  rolloutPercentage: number;
  note?: string | null;
  updatedBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserDataSharingPreference {
  userId: string;
  allowAggregatedAnalytics: boolean;
  allowThirdPartyAggregatedSharing: boolean;
  allowPseudonymousResearch: boolean;
  source: string;
  grantedAt: string;
  revokedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataPartner {
  id: string;
  legalName: string;
  displayName: string;
  contactEmail: string;
  countryCode?: string | null;
  status: DataPartnerStatus;
  dpaSignedAt?: string | null;
  dpaReference?: string | null;
  allowedRegions: string[];
  prohibitedDataCategories: string[];
  notes?: string | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  accessLevel: DataProductAccessLevel;
  minKAnonymity: number;
  requiresUserOptIn: boolean;
  allowedMetrics: string[];
  retentionDays?: number | null;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataPartnerAccessGrant {
  id: string;
  partnerId: string;
  productId: string;
  status: DataPartnerGrantStatus;
  legalBasis: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataPartnerExport {
  id: string;
  partnerId: string;
  productId: string;
  accessGrantId?: string | null;
  exportStatus: DataPartnerExportStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
  generatedBy?: string | null;
  exportLevel: DataProductAccessLevel;
  rowsExported: number;
  includesPersonalData: boolean;
  outputUri?: string | null;
  checksumSha256?: string | null;
  generatedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymAddonCatalogEntry {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: GymAddonCategory;
  billingScope: BillingScope;
  defaultPriceCents: number;
  currency: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymAddonSubscription {
  id: string;
  gymId: string;
  addonId: string;
  status: GymAddonSubscriptionStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  provider: string;
  providerSubscriptionId?: string | null;
  billingReference?: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymAdvancedAnalyticsView {
  id: string;
  gymId: string;
  name: string;
  description?: string | null;
  visibility: "owner_only" | "staff";
  querySpec: Record<string, unknown>;
  createdBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymAutomationPlaybook {
  id: string;
  gymId: string;
  addonSubscriptionId?: string | null;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionPlan: Array<Record<string, unknown>>;
  isActive: boolean;
  requiresHumanApproval: boolean;
  createdBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymAutomationRun {
  id: string;
  playbookId: string;
  gymId: string;
  runStatus: GymAutomationRunStatus;
  triggeredBy: string;
  triggerPayload: Record<string, unknown>;
  plannedActions: Array<Record<string, unknown>>;
  executedActions: Array<Record<string, unknown>>;
  requiresHumanApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected" | "not_required";
  approvedBy?: string | null;
  approvedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerMarketplaceApp {
  id: string;
  partnerId: string;
  appCode: string;
  name: string;
  description?: string | null;
  category: string;
  status: PartnerAppStatus;
  pricingModel: "subscription" | "usage" | "revshare" | "hybrid";
  revenueShareBps?: number | null;
  installUrl?: string | null;
  docsUrl?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymPartnerAppInstall {
  id: string;
  gymId: string;
  partnerAppId: string;
  installStatus: PartnerInstallStatus;
  externalAccountId?: string | null;
  billingReference?: string | null;
  installedBy?: string | null;
  installedAt: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerRevenueEvent {
  id: string;
  gymId?: string | null;
  partnerId: string;
  partnerAppId?: string | null;
  eventType: "subscription_fee" | "usage_fee" | "revshare_credit" | "referral_bonus";
  eventStatus: PartnerRevenueEventStatus;
  periodStart?: string | null;
  periodEnd?: string | null;
  grossAmountCents: number;
  platformAmountCents: number;
  partnerAmountCents: number;
  currency: string;
  sourceReference?: string | null;
  recognizedAt?: string | null;
  paidAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataAggregationJob {
  id: string;
  productId: string;
  requestedBy?: string | null;
  jobStatus: DataAggregationJobStatus;
  sourceWindowStart?: string | null;
  sourceWindowEnd?: string | null;
  aggregationSpec: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  totalSourceRows: number;
  outputRowCount: number;
  kAnonymityFloor: number;
  minGroupSizeObserved?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataAnonymizationCheck {
  id: string;
  aggregationJobId: string;
  checkType: "k_anonymity" | "l_diversity" | "t_closeness" | "small_cell_suppression" | "manual_review";
  status: AnonymizationCheckStatus;
  thresholdValue?: number | null;
  observedValue?: number | null;
  details: Record<string, unknown>;
  checkedBy?: string | null;
  checkedAt: string;
  createdAt: string;
}

export interface DataReleaseApproval {
  id: string;
  exportId: string;
  requiredApprovalType: "compliance" | "security" | "business";
  status: DataReleaseApprovalStatus;
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface ConsumerPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumerPlanPrice {
  id: string;
  planId: string;
  provider: string;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  countryCode?: string | null;
  currency: string;
  amountCents: number;
  billingPeriod: "weekly" | "monthly" | "quarterly" | "yearly" | "one_time";
  billingPeriodCount: number;
  trialDays?: number | null;
  isDefault: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumerEntitlement {
  id: string;
  userId: string;
  planId?: string | null;
  status: SubscriptionStatus;
  provider: string;
  providerCustomerId?: string | null;
  providerOriginalTransactionId?: string | null;
  providerSubscriptionId?: string | null;
  startedAt?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  canceledAt?: string | null;
  lastVerifiedAt?: string | null;
  rawReceipt: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PricingExperiment {
  id: string;
  scope: BillingScope;
  gymId?: string | null;
  name: string;
  hypothesis?: string | null;
  status: PricingExperimentStatus;
  targetFilters: Record<string, unknown>;
  startsAt?: string | null;
  endsAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingExperimentVariant {
  id: string;
  experimentId: string;
  variantKey: string;
  allocationPercent: number;
  targetType: "consumer_plan_price" | "gym_membership_plan";
  targetId: string;
  isControl: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PricingExperimentAssignment {
  id: string;
  experimentId: string;
  variantId: string;
  userId?: string | null;
  gymId?: string | null;
  assignmentStatus: PricingAssignmentStatus;
  assignedAt: string;
  firstExposedAt?: string | null;
  convertedAt?: string | null;
  conversionReference?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCampaign {
  id: string;
  scope: BillingScope;
  gymId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  discountType: DiscountType;
  percentOff?: number | null;
  amountOffCents?: number | null;
  trialDaysOff?: number | null;
  currency?: string | null;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  eligibleFilters: Record<string, unknown>;
  createdBy?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountRedemption {
  id: string;
  campaignId: string;
  userId?: string | null;
  gymId?: string | null;
  memberSubscriptionId?: string | null;
  consumerEntitlementId?: string | null;
  invoiceId?: string | null;
  amountDiscountCents: number;
  currency?: string | null;
  redeemedAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  amountCents: number;
  currency: string;
  billingPeriod: "monthly" | "quarterly" | "yearly";
  trialDays?: number | null;
  provider: string;
  providerProductId?: string | null;
  providerPriceId?: string | null;
  modules: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymPlatformSubscription {
  id: string;
  gymId: string;
  platformPlanId?: string | null;
  status: SubscriptionStatus;
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAt?: string | null;
  canceledAt?: string | null;
  billingContactEmail?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymPlatformInvoice {
  id: string;
  gymPlatformSubscriptionId?: string | null;
  gymId: string;
  provider: string;
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

export interface GymPlatformPaymentTransaction {
  id: string;
  gymPlatformInvoiceId?: string | null;
  gymId: string;
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

export interface GymPlatformRefund {
  id: string;
  gymPlatformPaymentTransactionId: string;
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

export type InvoiceConnectionStatus = "disconnected" | "pending" | "active" | "error" | "revoked";

export type InvoiceDeliveryStatus =
  | "queued"
  | "processing"
  | "submitted"
  | "accepted"
  | "rejected"
  | "failed"
  | "cancelled";

export type InvoiceScheme = "eu_vat" | "it_fatturapa" | "uk_vat" | "us_sales_tax" | "custom";

export interface GymBrandSettings {
  gymId: string;
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
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GymFeatureSetting {
  id: string;
  gymId: string;
  featureKey: string;
  enabled: boolean;
  rolloutPercentage: number;
  config: Record<string, unknown>;
  note?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceProviderConnection {
  id: string;
  gymId: string;
  providerSlug: string;
  displayName?: string | null;
  connectionStatus: InvoiceConnectionStatus;
  environment: "test" | "live";
  accountIdentifier?: string | null;
  credentialsReference?: string | null;
  webhookSecretReference?: string | null;
  isDefault: boolean;
  supportedCountries: string[];
  metadata: Record<string, unknown>;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceComplianceProfile {
  gymId: string;
  legalEntityName: string;
  vatNumber?: string | null;
  taxCode?: string | null;
  registrationNumber?: string | null;
  taxRegime?: string | null;
  countryCode: string;
  defaultCurrency: string;
  invoiceScheme: InvoiceScheme;
  pecEmail?: string | null;
  sdiDestinationCode?: string | null;
  locale: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDeliveryJob {
  id: string;
  invoiceId: string;
  gymId: string;
  providerConnectionId?: string | null;
  targetCountryCode: string;
  deliveryChannel: "provider_api" | "sdi" | "email" | "manual_export";
  payloadFormat: "json" | "xml_fatturapa" | "pdf" | "csv";
  status: InvoiceDeliveryStatus;
  idempotencyKey: string;
  attemptCount: number;
  nextRetryAt?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  providerDocumentId?: string | null;
  providerResponse: Record<string, unknown>;
  errorMessage?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SupportTicketChannel = "in_app" | "email" | "web" | "phone" | "api";

export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicketStatus =
  | "open"
  | "triaged"
  | "waiting_user"
  | "in_progress"
  | "waiting_approval"
  | "resolved"
  | "closed"
  | "spam";

export type SupportActorType = "user" | "staff" | "agent" | "system";

export type SupportRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "cancelled";

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  gymId?: string | null;
  reporterUserId?: string | null;
  reporterEmail?: string | null;
  channel: SupportTicketChannel;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  description: string;
  affectedSurface?: string | null;
  impactedUsersCount: number;
  requiresHumanApproval: boolean;
  ownerUserId?: string | null;
  aiSummary?: string | null;
  aiTriageLabels: string[];
  aiRecommendedActions: Array<Record<string, unknown>>;
  aiConfidence?: number | null;
  lastCustomerReplyAt?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  actorType: SupportActorType;
  actorUserId?: string | null;
  actorLabel?: string | null;
  isInternal: boolean;
  body: string;
  attachments: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SupportAutomationRun {
  id: string;
  ticketId: string;
  agentName: string;
  triggerSource: string;
  runStatus: SupportRunStatus;
  requiresApproval: boolean;
  approvalStatus: "pending" | "approved" | "rejected" | "not_required";
  planJson: Record<string, unknown>;
  proposedChanges: Array<Record<string, unknown>>;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  notificationSentAt?: string | null;
  resultSummary?: string | null;
  resultPayload: Record<string, unknown>;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}
