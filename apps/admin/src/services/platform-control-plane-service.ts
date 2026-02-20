import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  CreateDataAggregationJobInput,
  CreateDataPartnerExportInput,
  CreateDataPartnerInput,
  CreateDataProductInput,
  CreateGymAddonCatalogInput,
  CreateGymAdvancedAnalyticsViewInput,
  CreateGymAutomationPlaybookInput,
  CreateGymAutomationRunInput,
  CreateGymSupportAccessGrantInput,
  CreateGymSupportAccessSessionInput,
  CreatePartnerMarketplaceAppInput,
  CreatePartnerRevenueEventInput,
  DataAggregationJob,
  DataAnonymizationCheck,
  DataPartner,
  DataPartnerAccessGrant,
  DataPartnerExport,
  DataProduct,
  DataReleaseApproval,
  GymAddonCatalogEntry,
  GymAddonSubscription,
  GymAdvancedAnalyticsView,
  GymAutomationPlaybook,
  GymAutomationRun,
  GymPartnerAppInstall,
  GymSupportAccessGrant,
  GymSupportAccessSession,
  PartnerMarketplaceApp,
  PartnerRevenueEvent,
  PlatformFeatureOverride,
  PlatformKpiDailySnapshot,
  PlatformOperatorAccount,
  PlatformOperatorPermissionOverride,
  UpdateDataAggregationJobInput,
  UpdateDataPartnerExportInput,
  UpdateDataPartnerInput,
  UpdateDataProductInput,
  UpdateGymAdvancedAnalyticsViewInput,
  UpdateGymAutomationPlaybookInput,
  UpdateGymAutomationRunInput,
  UpdateGymSupportAccessGrantInput,
  UpdateGymSupportAccessSessionInput,
  UpdateGymAddonCatalogInput,
  UpdatePartnerMarketplaceAppInput,
  UpdatePartnerRevenueEventInput,
  UpsertDataAnonymizationCheckInput,
  UpsertDataPartnerAccessGrantInput,
  UpsertDataReleaseApprovalInput,
  UpsertGymAddonSubscriptionInput,
  UpsertGymPartnerAppInstallInput,
  UpsertPlatformFeatureOverrideInput,
  UpsertPlatformOperatorAccountInput,
  UpsertPlatformOperatorPermissionOverrideInput,
  UserDataSharingPreference
} from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type PlatformOperatorAccountRow = {
  user_id: string;
  role: PlatformOperatorAccount["role"];
  is_active: boolean;
  mfa_required: boolean;
  last_login_at: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PlatformOperatorPermissionOverrideRow = {
  id: string;
  user_id: string;
  permission_key: string;
  is_allowed: boolean;
  reason: string | null;
  updated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymSupportAccessGrantRow = {
  id: string;
  gym_id: string;
  operator_user_id: string;
  requested_by_user_id: string | null;
  approved_by_user_id: string | null;
  status: GymSupportAccessGrant["status"];
  permission_scope: string[];
  reason: string;
  note: string | null;
  starts_at: string | null;
  ends_at: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymSupportAccessSessionRow = {
  id: string;
  grant_id: string;
  gym_id: string;
  operator_user_id: string;
  support_ticket_id: string | null;
  session_status: GymSupportAccessSession["sessionStatus"];
  justification: string;
  actions_summary: unknown;
  started_at: string;
  ended_at: string | null;
  terminated_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PlatformKpiDailySnapshotRow = {
  id: string;
  metric_date: string;
  total_users: number;
  active_users_7d: number;
  active_gyms_7d: number;
  workouts_logged_count: number;
  proof_posts_count: number;
  class_bookings_count: number;
  support_tickets_open: number;
  connected_devices_count: number;
  mrr_cents: number;
  churn_rate_percent: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PlatformFeatureOverrideRow = {
  id: string;
  feature_key: string;
  target_scope: PlatformFeatureOverride["targetScope"];
  target_value: string;
  enabled: boolean;
  rollout_percentage: number;
  note: string | null;
  updated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type UserDataSharingPreferenceRow = {
  user_id: string;
  allow_aggregated_analytics: boolean;
  allow_third_party_aggregated_sharing: boolean;
  allow_pseudonymous_research: boolean;
  source: string;
  granted_at: string;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DataPartnerRow = {
  id: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  country_code: string | null;
  status: DataPartner["status"];
  dpa_signed_at: string | null;
  dpa_reference: string | null;
  allowed_regions: string[] | null;
  prohibited_data_categories: string[] | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DataProductRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  access_level: DataProduct["accessLevel"];
  min_k_anonymity: number;
  requires_user_opt_in: boolean;
  allowed_metrics: string[] | null;
  retention_days: number | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DataPartnerAccessGrantRow = {
  id: string;
  partner_id: string;
  product_id: string;
  status: DataPartnerAccessGrant["status"];
  legal_basis: string;
  approved_by: string | null;
  approved_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DataPartnerExportRow = {
  id: string;
  partner_id: string;
  product_id: string;
  access_grant_id: string | null;
  export_status: DataPartnerExport["exportStatus"];
  requested_by: string | null;
  approved_by: string | null;
  generated_by: string | null;
  export_level: DataPartnerExport["exportLevel"];
  rows_exported: number;
  includes_personal_data: boolean;
  output_uri: string | null;
  checksum_sha256: string | null;
  generated_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymAddonCatalogEntryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: GymAddonCatalogEntry["category"];
  billing_scope: GymAddonCatalogEntry["billingScope"];
  default_price_cents: number;
  currency: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymAddonSubscriptionRow = {
  id: string;
  gym_id: string;
  addon_id: string;
  status: GymAddonSubscription["status"];
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  provider: string;
  provider_subscription_id: string | null;
  billing_reference: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type GymAdvancedAnalyticsViewRow = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  visibility: GymAdvancedAnalyticsView["visibility"];
  query_spec: Record<string, unknown>;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymAutomationPlaybookRow = {
  id: string;
  gym_id: string;
  addon_subscription_id: string | null;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_plan: unknown;
  is_active: boolean;
  requires_human_approval: boolean;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymAutomationRunRow = {
  id: string;
  playbook_id: string;
  gym_id: string;
  run_status: GymAutomationRun["runStatus"];
  triggered_by: string;
  trigger_payload: Record<string, unknown>;
  planned_actions: unknown;
  executed_actions: unknown;
  requires_human_approval: boolean;
  approval_status: GymAutomationRun["approvalStatus"];
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PartnerMarketplaceAppRow = {
  id: string;
  partner_id: string;
  app_code: string;
  name: string;
  description: string | null;
  category: string;
  status: PartnerMarketplaceApp["status"];
  pricing_model: PartnerMarketplaceApp["pricingModel"];
  revenue_share_bps: number | null;
  install_url: string | null;
  docs_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymPartnerAppInstallRow = {
  id: string;
  gym_id: string;
  partner_app_id: string;
  install_status: GymPartnerAppInstall["installStatus"];
  external_account_id: string | null;
  billing_reference: string | null;
  installed_by: string | null;
  installed_at: string;
  last_sync_at: string | null;
  last_error: string | null;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PartnerRevenueEventRow = {
  id: string;
  gym_id: string | null;
  partner_id: string;
  partner_app_id: string | null;
  event_type: PartnerRevenueEvent["eventType"];
  event_status: PartnerRevenueEvent["eventStatus"];
  period_start: string | null;
  period_end: string | null;
  gross_amount_cents: number;
  platform_amount_cents: number;
  partner_amount_cents: number;
  currency: string;
  source_reference: string | null;
  recognized_at: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DataAggregationJobRow = {
  id: string;
  product_id: string;
  requested_by: string | null;
  job_status: DataAggregationJob["jobStatus"];
  source_window_start: string | null;
  source_window_end: string | null;
  aggregation_spec: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  total_source_rows: number;
  output_row_count: number;
  k_anonymity_floor: number;
  min_group_size_observed: number | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DataAnonymizationCheckRow = {
  id: string;
  aggregation_job_id: string;
  check_type: DataAnonymizationCheck["checkType"];
  status: DataAnonymizationCheck["status"];
  threshold_value: number | null;
  observed_value: number | null;
  details: Record<string, unknown>;
  checked_by: string | null;
  checked_at: string;
  created_at: string;
};

type DataReleaseApprovalRow = {
  id: string;
  export_id: string;
  required_approval_type: DataReleaseApproval["requiredApprovalType"];
  status: DataReleaseApproval["status"];
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export interface PlatformControlPlaneLoadOptions {
  gymId?: string;
  partnerId?: string;
  productId?: string;
  exportId?: string;
  limit?: number;
}

function limitToRange(value: number | undefined, fallback: number, max: number): number {
  return Math.min(Math.max(value ?? fallback, 1), max);
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

function mapPlatformOperatorAccount(row: PlatformOperatorAccountRow): PlatformOperatorAccount {
  return {
    userId: row.user_id,
    role: row.role,
    isActive: row.is_active,
    mfaRequired: row.mfa_required,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlatformOperatorPermissionOverride(
  row: PlatformOperatorPermissionOverrideRow
): PlatformOperatorPermissionOverride {
  return {
    id: row.id,
    userId: row.user_id,
    permissionKey: row.permission_key,
    isAllowed: row.is_allowed,
    reason: row.reason,
    updatedBy: row.updated_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymSupportAccessGrant(row: GymSupportAccessGrantRow): GymSupportAccessGrant {
  return {
    id: row.id,
    gymId: row.gym_id,
    operatorUserId: row.operator_user_id,
    requestedByUserId: row.requested_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    status: row.status,
    permissionScope: row.permission_scope ?? [],
    reason: row.reason,
    note: row.note,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by_user_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymSupportAccessSession(row: GymSupportAccessSessionRow): GymSupportAccessSession {
  return {
    id: row.id,
    grantId: row.grant_id,
    gymId: row.gym_id,
    operatorUserId: row.operator_user_id,
    supportTicketId: row.support_ticket_id,
    sessionStatus: row.session_status,
    justification: row.justification,
    actionsSummary: toObjectArray(row.actions_summary),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    terminatedReason: row.terminated_reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlatformKpiDailySnapshot(row: PlatformKpiDailySnapshotRow): PlatformKpiDailySnapshot {
  return {
    id: row.id,
    metricDate: row.metric_date,
    totalUsers: row.total_users,
    activeUsers7d: row.active_users_7d,
    activeGyms7d: row.active_gyms_7d,
    workoutsLoggedCount: row.workouts_logged_count,
    proofPostsCount: row.proof_posts_count,
    classBookingsCount: row.class_bookings_count,
    supportTicketsOpen: row.support_tickets_open,
    connectedDevicesCount: row.connected_devices_count,
    mrrCents: row.mrr_cents,
    churnRatePercent: row.churn_rate_percent,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlatformFeatureOverride(row: PlatformFeatureOverrideRow): PlatformFeatureOverride {
  return {
    id: row.id,
    featureKey: row.feature_key,
    targetScope: row.target_scope,
    targetValue: row.target_value,
    enabled: row.enabled,
    rolloutPercentage: row.rollout_percentage,
    note: row.note,
    updatedBy: row.updated_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserDataSharingPreference(row: UserDataSharingPreferenceRow): UserDataSharingPreference {
  return {
    userId: row.user_id,
    allowAggregatedAnalytics: row.allow_aggregated_analytics,
    allowThirdPartyAggregatedSharing: row.allow_third_party_aggregated_sharing,
    allowPseudonymousResearch: row.allow_pseudonymous_research,
    source: row.source,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataPartner(row: DataPartnerRow): DataPartner {
  return {
    id: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    countryCode: row.country_code,
    status: row.status,
    dpaSignedAt: row.dpa_signed_at,
    dpaReference: row.dpa_reference,
    allowedRegions: row.allowed_regions ?? [],
    prohibitedDataCategories: row.prohibited_data_categories ?? [],
    notes: row.notes,
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataProduct(row: DataProductRow): DataProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    accessLevel: row.access_level,
    minKAnonymity: row.min_k_anonymity,
    requiresUserOptIn: row.requires_user_opt_in,
    allowedMetrics: row.allowed_metrics ?? [],
    retentionDays: row.retention_days,
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataPartnerAccessGrant(row: DataPartnerAccessGrantRow): DataPartnerAccessGrant {
  return {
    id: row.id,
    partnerId: row.partner_id,
    productId: row.product_id,
    status: row.status,
    legalBasis: row.legal_basis,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataPartnerExport(row: DataPartnerExportRow): DataPartnerExport {
  return {
    id: row.id,
    partnerId: row.partner_id,
    productId: row.product_id,
    accessGrantId: row.access_grant_id,
    exportStatus: row.export_status,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    generatedBy: row.generated_by,
    exportLevel: row.export_level,
    rowsExported: row.rows_exported,
    includesPersonalData: row.includes_personal_data,
    outputUri: row.output_uri,
    checksumSha256: row.checksum_sha256,
    generatedAt: row.generated_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymAddonCatalogEntry(row: GymAddonCatalogEntryRow): GymAddonCatalogEntry {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    billingScope: row.billing_scope,
    defaultPriceCents: row.default_price_cents,
    currency: row.currency,
    isActive: row.is_active,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymAddonSubscription(row: GymAddonSubscriptionRow): GymAddonSubscription {
  return {
    id: row.id,
    gymId: row.gym_id,
    addonId: row.addon_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    trialEndsAt: row.trial_ends_at,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    billingReference: row.billing_reference,
    config: row.config ?? {},
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymAdvancedAnalyticsView(row: GymAdvancedAnalyticsViewRow): GymAdvancedAnalyticsView {
  return {
    id: row.id,
    gymId: row.gym_id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    querySpec: row.query_spec ?? {},
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymAutomationPlaybook(row: GymAutomationPlaybookRow): GymAutomationPlaybook {
  return {
    id: row.id,
    gymId: row.gym_id,
    addonSubscriptionId: row.addon_subscription_id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config ?? {},
    actionPlan: toObjectArray(row.action_plan),
    isActive: row.is_active,
    requiresHumanApproval: row.requires_human_approval,
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymAutomationRun(row: GymAutomationRunRow): GymAutomationRun {
  return {
    id: row.id,
    playbookId: row.playbook_id,
    gymId: row.gym_id,
    runStatus: row.run_status,
    triggeredBy: row.triggered_by,
    triggerPayload: row.trigger_payload ?? {},
    plannedActions: toObjectArray(row.planned_actions),
    executedActions: toObjectArray(row.executed_actions),
    requiresHumanApproval: row.requires_human_approval,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartnerMarketplaceApp(row: PartnerMarketplaceAppRow): PartnerMarketplaceApp {
  return {
    id: row.id,
    partnerId: row.partner_id,
    appCode: row.app_code,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    pricingModel: row.pricing_model,
    revenueShareBps: row.revenue_share_bps,
    installUrl: row.install_url,
    docsUrl: row.docs_url,
    isActive: row.is_active,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymPartnerAppInstall(row: GymPartnerAppInstallRow): GymPartnerAppInstall {
  return {
    id: row.id,
    gymId: row.gym_id,
    partnerAppId: row.partner_app_id,
    installStatus: row.install_status,
    externalAccountId: row.external_account_id,
    billingReference: row.billing_reference,
    installedBy: row.installed_by,
    installedAt: row.installed_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    config: row.config ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPartnerRevenueEvent(row: PartnerRevenueEventRow): PartnerRevenueEvent {
  return {
    id: row.id,
    gymId: row.gym_id,
    partnerId: row.partner_id,
    partnerAppId: row.partner_app_id,
    eventType: row.event_type,
    eventStatus: row.event_status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    grossAmountCents: row.gross_amount_cents,
    platformAmountCents: row.platform_amount_cents,
    partnerAmountCents: row.partner_amount_cents,
    currency: row.currency,
    sourceReference: row.source_reference,
    recognizedAt: row.recognized_at,
    paidAt: row.paid_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataAggregationJob(row: DataAggregationJobRow): DataAggregationJob {
  return {
    id: row.id,
    productId: row.product_id,
    requestedBy: row.requested_by,
    jobStatus: row.job_status,
    sourceWindowStart: row.source_window_start,
    sourceWindowEnd: row.source_window_end,
    aggregationSpec: row.aggregation_spec ?? {},
    outputSummary: row.output_summary ?? {},
    totalSourceRows: row.total_source_rows,
    outputRowCount: row.output_row_count,
    kAnonymityFloor: row.k_anonymity_floor,
    minGroupSizeObserved: row.min_group_size_observed,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDataAnonymizationCheck(row: DataAnonymizationCheckRow): DataAnonymizationCheck {
  return {
    id: row.id,
    aggregationJobId: row.aggregation_job_id,
    checkType: row.check_type,
    status: row.status,
    thresholdValue: row.threshold_value,
    observedValue: row.observed_value,
    details: row.details ?? {},
    checkedBy: row.checked_by,
    checkedAt: row.checked_at,
    createdAt: row.created_at
  };
}

function mapDataReleaseApproval(row: DataReleaseApprovalRow): DataReleaseApproval {
  return {
    id: row.id,
    exportId: row.export_id,
    requiredApprovalType: row.required_approval_type,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PlatformControlPlaneService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  private async getCurrentUser(): Promise<User> {
    return this.access.getCurrentUser();
  }

  private async requireGymStaff(gymId: string): Promise<void> {
    await this.access.requireGymStaff(gymId);
  }

  async getPlatformAdminOverview(): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase.rpc("get_platform_admin_overview");
    throwIfAdminError(error, "ADMIN_PLATFORM_OVERVIEW_READ_FAILED", "Unable to load platform overview.");
    return toObject(data);
  }

  async listPlatformKpiDailySnapshots(limit = 30): Promise<PlatformKpiDailySnapshot[]> {
    const { data, error } = await this.supabase
      .from("platform_kpi_daily_snapshots")
      .select("*")
      .order("metric_date", { ascending: false })
      .limit(limitToRange(limit, 30, 365));

    throwIfAdminError(error, "ADMIN_PLATFORM_KPI_SNAPSHOTS_READ_FAILED", "Unable to load platform KPI snapshots.");
    return ((data as PlatformKpiDailySnapshotRow[]) ?? []).map(mapPlatformKpiDailySnapshot);
  }

  async listPlatformOperatorAccounts(limit = 200): Promise<PlatformOperatorAccount[]> {
    const { data, error } = await this.supabase
      .from("platform_operator_accounts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_PLATFORM_OPERATOR_ACCOUNTS_READ_FAILED", "Unable to load platform operators.");
    return ((data as PlatformOperatorAccountRow[]) ?? []).map(mapPlatformOperatorAccount);
  }

  async upsertPlatformOperatorAccount(input: UpsertPlatformOperatorAccountInput): Promise<PlatformOperatorAccount> {
    const user = await this.getCurrentUser();

    const payload: Record<string, unknown> = {
      user_id: input.userId
    };

    if (input.role !== undefined) payload.role = input.role;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.mfaRequired !== undefined) payload.mfa_required = input.mfaRequired;
    if (input.lastLoginAt !== undefined) payload.last_login_at = input.lastLoginAt;
    if (input.metadata !== undefined) payload.metadata = input.metadata;
    payload.created_by = user.id;

    const { data, error } = await this.supabase
      .from("platform_operator_accounts")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PLATFORM_OPERATOR_ACCOUNT_UPSERT_FAILED", "Unable to upsert platform operator.");
    return mapPlatformOperatorAccount(data as PlatformOperatorAccountRow);
  }

  async listPlatformOperatorPermissionOverrides(
    userId?: string,
    limit = 500
  ): Promise<PlatformOperatorPermissionOverride[]> {
    let query = this.supabase
      .from("platform_operator_permission_overrides")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 500, 1000));

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    throwIfAdminError(
      error,
      "ADMIN_PLATFORM_OPERATOR_PERMISSION_OVERRIDES_READ_FAILED",
      "Unable to load operator permission overrides."
    );

    return ((data as PlatformOperatorPermissionOverrideRow[]) ?? []).map(mapPlatformOperatorPermissionOverride);
  }

  async upsertPlatformOperatorPermissionOverride(
    input: UpsertPlatformOperatorPermissionOverrideInput
  ): Promise<PlatformOperatorPermissionOverride> {
    const user = await this.getCurrentUser();
    const payload = {
      user_id: input.userId,
      permission_key: input.permissionKey.trim().toLowerCase(),
      is_allowed: input.isAllowed,
      reason: input.reason ?? null,
      updated_by: user.id,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("platform_operator_permission_overrides")
      .upsert(payload, { onConflict: "user_id,permission_key" })
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_PLATFORM_OPERATOR_PERMISSION_OVERRIDE_UPSERT_FAILED",
      "Unable to upsert operator permission override."
    );

    return mapPlatformOperatorPermissionOverride(data as PlatformOperatorPermissionOverrideRow);
  }

  async listSupportAccessGrants(options: PlatformControlPlaneLoadOptions = {}): Promise<GymSupportAccessGrant[]> {
    let query = this.supabase
      .from("gym_support_access_grants")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_GRANTS_READ_FAILED", "Unable to load support access grants.");
    return ((data as GymSupportAccessGrantRow[]) ?? []).map(mapGymSupportAccessGrant);
  }

  async createSupportAccessGrant(input: CreateGymSupportAccessGrantInput): Promise<GymSupportAccessGrant> {
    const user = await this.getCurrentUser();
    const payload = {
      gym_id: input.gymId,
      operator_user_id: input.operatorUserId,
      requested_by_user_id: user.id,
      approved_by_user_id: null,
      status: input.status ?? "requested",
      permission_scope: input.permissionScope ?? ["read_only"],
      reason: input.reason,
      note: input.note ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_support_access_grants")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_GRANT_CREATE_FAILED", "Unable to create support access grant.");
    return mapGymSupportAccessGrant(data as GymSupportAccessGrantRow);
  }

  async updateSupportAccessGrant(grantId: string, input: UpdateGymSupportAccessGrantInput): Promise<GymSupportAccessGrant> {
    const payload: Record<string, unknown> = {};

    if (input.status !== undefined) payload.status = input.status;
    if (input.permissionScope !== undefined) payload.permission_scope = input.permissionScope;
    if (input.note !== undefined) payload.note = input.note;
    if (input.startsAt !== undefined) payload.starts_at = input.startsAt;
    if (input.endsAt !== undefined) payload.ends_at = input.endsAt;
    if (input.approvedByUserId !== undefined) payload.approved_by_user_id = input.approvedByUserId;
    if (input.requestedByUserId !== undefined) payload.requested_by_user_id = input.requestedByUserId;
    if (input.revokedAt !== undefined) payload.revoked_at = input.revokedAt;
    if (input.revokedByUserId !== undefined) payload.revoked_by_user_id = input.revokedByUserId;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_support_access_grants")
      .update(payload)
      .eq("id", grantId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_GRANT_UPDATE_FAILED", "Unable to update support access grant.");
    return mapGymSupportAccessGrant(data as GymSupportAccessGrantRow);
  }

  async listSupportAccessSessions(options: PlatformControlPlaneLoadOptions = {}): Promise<GymSupportAccessSession[]> {
    let query = this.supabase
      .from("gym_support_access_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_SESSIONS_READ_FAILED", "Unable to load support access sessions.");
    return ((data as GymSupportAccessSessionRow[]) ?? []).map(mapGymSupportAccessSession);
  }

  async createSupportAccessSession(input: CreateGymSupportAccessSessionInput): Promise<GymSupportAccessSession> {
    const payload = {
      grant_id: input.grantId,
      gym_id: input.gymId,
      operator_user_id: input.operatorUserId,
      support_ticket_id: input.supportTicketId ?? null,
      session_status: input.sessionStatus ?? "active",
      justification: input.justification,
      actions_summary: input.actionsSummary ?? [],
      started_at: new Date().toISOString(),
      ended_at: input.endedAt ?? null,
      terminated_reason: input.terminatedReason ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_support_access_sessions")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_SESSION_CREATE_FAILED", "Unable to create support access session.");
    return mapGymSupportAccessSession(data as GymSupportAccessSessionRow);
  }

  async updateSupportAccessSession(
    sessionId: string,
    input: UpdateGymSupportAccessSessionInput
  ): Promise<GymSupportAccessSession> {
    const payload: Record<string, unknown> = {};

    if (input.supportTicketId !== undefined) payload.support_ticket_id = input.supportTicketId;
    if (input.sessionStatus !== undefined) payload.session_status = input.sessionStatus;
    if (input.actionsSummary !== undefined) payload.actions_summary = input.actionsSummary;
    if (input.endedAt !== undefined) payload.ended_at = input.endedAt;
    if (input.terminatedReason !== undefined) payload.terminated_reason = input.terminatedReason;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_support_access_sessions")
      .update(payload)
      .eq("id", sessionId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_ACCESS_SESSION_UPDATE_FAILED", "Unable to update support access session.");
    return mapGymSupportAccessSession(data as GymSupportAccessSessionRow);
  }

  async listPlatformFeatureOverrides(limit = 500): Promise<PlatformFeatureOverride[]> {
    const { data, error } = await this.supabase
      .from("platform_feature_overrides")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 500, 2000));

    throwIfAdminError(error, "ADMIN_PLATFORM_FEATURE_OVERRIDES_READ_FAILED", "Unable to load feature overrides.");
    return ((data as PlatformFeatureOverrideRow[]) ?? []).map(mapPlatformFeatureOverride);
  }

  async upsertPlatformFeatureOverride(input: UpsertPlatformFeatureOverrideInput): Promise<PlatformFeatureOverride> {
    const user = await this.getCurrentUser();

    const payload = {
      feature_key: input.featureKey.trim().toLowerCase(),
      target_scope: input.targetScope ?? "global",
      target_value: input.targetValue ?? "all",
      enabled: input.enabled ?? true,
      rollout_percentage: input.rolloutPercentage ?? 100,
      note: input.note ?? null,
      updated_by: user.id,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("platform_feature_overrides")
      .upsert(payload, { onConflict: "feature_key,target_scope,target_value" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PLATFORM_FEATURE_OVERRIDE_UPSERT_FAILED", "Unable to upsert feature override.");
    return mapPlatformFeatureOverride(data as PlatformFeatureOverrideRow);
  }

  async listUserDataSharingPreferences(limit = 500): Promise<UserDataSharingPreference[]> {
    const { data, error } = await this.supabase
      .from("user_data_sharing_preferences")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 500, 2000));

    throwIfAdminError(
      error,
      "ADMIN_USER_DATA_SHARING_PREFERENCES_READ_FAILED",
      "Unable to load user data sharing preferences."
    );

    return ((data as UserDataSharingPreferenceRow[]) ?? []).map(mapUserDataSharingPreference);
  }

  async listDataPartners(limit = 200): Promise<DataPartner[]> {
    const { data, error } = await this.supabase
      .from("data_partners")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_DATA_PARTNERS_READ_FAILED", "Unable to load data partners.");
    return ((data as DataPartnerRow[]) ?? []).map(mapDataPartner);
  }

  async createDataPartner(input: CreateDataPartnerInput): Promise<DataPartner> {
    const user = await this.getCurrentUser();
    const payload = {
      legal_name: input.legalName,
      display_name: input.displayName,
      contact_email: input.contactEmail,
      country_code: input.countryCode ?? null,
      status: input.status ?? "prospect",
      dpa_signed_at: input.dpaSignedAt ?? null,
      dpa_reference: input.dpaReference ?? null,
      allowed_regions: input.allowedRegions ?? [],
      prohibited_data_categories: input.prohibitedDataCategories ?? [],
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      created_by: user.id
    };

    const { data, error } = await this.supabase
      .from("data_partners")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PARTNER_CREATE_FAILED", "Unable to create data partner.");
    return mapDataPartner(data as DataPartnerRow);
  }

  async updateDataPartner(partnerId: string, input: UpdateDataPartnerInput): Promise<DataPartner> {
    const payload: Record<string, unknown> = {};

    if (input.legalName !== undefined) payload.legal_name = input.legalName;
    if (input.displayName !== undefined) payload.display_name = input.displayName;
    if (input.contactEmail !== undefined) payload.contact_email = input.contactEmail;
    if (input.countryCode !== undefined) payload.country_code = input.countryCode;
    if (input.status !== undefined) payload.status = input.status;
    if (input.dpaSignedAt !== undefined) payload.dpa_signed_at = input.dpaSignedAt;
    if (input.dpaReference !== undefined) payload.dpa_reference = input.dpaReference;
    if (input.allowedRegions !== undefined) payload.allowed_regions = input.allowedRegions;
    if (input.prohibitedDataCategories !== undefined) payload.prohibited_data_categories = input.prohibitedDataCategories;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("data_partners")
      .update(payload)
      .eq("id", partnerId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PARTNER_UPDATE_FAILED", "Unable to update data partner.");
    return mapDataPartner(data as DataPartnerRow);
  }

  async listDataProducts(limit = 200): Promise<DataProduct[]> {
    const { data, error } = await this.supabase
      .from("data_products")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_DATA_PRODUCTS_READ_FAILED", "Unable to load data products.");
    return ((data as DataProductRow[]) ?? []).map(mapDataProduct);
  }

  async createDataProduct(input: CreateDataProductInput): Promise<DataProduct> {
    const user = await this.getCurrentUser();
    const payload = {
      code: input.code.trim().toLowerCase(),
      name: input.name,
      description: input.description ?? null,
      access_level: input.accessLevel ?? "aggregate_anonymous",
      min_k_anonymity: input.minKAnonymity ?? 50,
      requires_user_opt_in: input.requiresUserOptIn ?? false,
      allowed_metrics: input.allowedMetrics ?? [],
      retention_days: input.retentionDays ?? null,
      metadata: input.metadata ?? {},
      created_by: user.id
    };

    const { data, error } = await this.supabase
      .from("data_products")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PRODUCT_CREATE_FAILED", "Unable to create data product.");
    return mapDataProduct(data as DataProductRow);
  }

  async updateDataProduct(productId: string, input: UpdateDataProductInput): Promise<DataProduct> {
    const payload: Record<string, unknown> = {};

    if (input.code !== undefined) payload.code = input.code.trim().toLowerCase();
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.accessLevel !== undefined) payload.access_level = input.accessLevel;
    if (input.minKAnonymity !== undefined) payload.min_k_anonymity = input.minKAnonymity;
    if (input.requiresUserOptIn !== undefined) payload.requires_user_opt_in = input.requiresUserOptIn;
    if (input.allowedMetrics !== undefined) payload.allowed_metrics = input.allowedMetrics;
    if (input.retentionDays !== undefined) payload.retention_days = input.retentionDays;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("data_products")
      .update(payload)
      .eq("id", productId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PRODUCT_UPDATE_FAILED", "Unable to update data product.");
    return mapDataProduct(data as DataProductRow);
  }

  async listDataPartnerAccessGrants(options: PlatformControlPlaneLoadOptions = {}): Promise<DataPartnerAccessGrant[]> {
    let query = this.supabase
      .from("data_partner_access_grants")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.partnerId) {
      query = query.eq("partner_id", options.partnerId);
    }

    if (options.productId) {
      query = query.eq("product_id", options.productId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_DATA_PARTNER_ACCESS_GRANTS_READ_FAILED", "Unable to load data access grants.");
    return ((data as DataPartnerAccessGrantRow[]) ?? []).map(mapDataPartnerAccessGrant);
  }

  async upsertDataPartnerAccessGrant(input: UpsertDataPartnerAccessGrantInput): Promise<DataPartnerAccessGrant> {
    const payload = {
      partner_id: input.partnerId,
      product_id: input.productId,
      status: input.status ?? "proposed",
      legal_basis: input.legalBasis,
      approved_by: input.approvedBy ?? null,
      approved_at: input.approvedAt ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("data_partner_access_grants")
      .upsert(payload, { onConflict: "partner_id,product_id" })
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_DATA_PARTNER_ACCESS_GRANT_UPSERT_FAILED",
      "Unable to upsert data partner access grant."
    );

    return mapDataPartnerAccessGrant(data as DataPartnerAccessGrantRow);
  }

  async listDataPartnerExports(options: PlatformControlPlaneLoadOptions = {}): Promise<DataPartnerExport[]> {
    let query = this.supabase
      .from("data_partner_exports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.partnerId) {
      query = query.eq("partner_id", options.partnerId);
    }

    if (options.productId) {
      query = query.eq("product_id", options.productId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_DATA_PARTNER_EXPORTS_READ_FAILED", "Unable to load data partner exports.");
    return ((data as DataPartnerExportRow[]) ?? []).map(mapDataPartnerExport);
  }

  async createDataPartnerExport(input: CreateDataPartnerExportInput): Promise<DataPartnerExport> {
    const user = await this.getCurrentUser();
    const payload = {
      partner_id: input.partnerId,
      product_id: input.productId,
      access_grant_id: input.accessGrantId ?? null,
      export_status: input.exportStatus ?? "queued",
      requested_by: input.requestedBy ?? user.id,
      approved_by: input.approvedBy ?? null,
      generated_by: input.generatedBy ?? null,
      export_level: input.exportLevel ?? "aggregate_anonymous",
      rows_exported: input.rowsExported ?? 0,
      includes_personal_data: input.includesPersonalData ?? false,
      output_uri: input.outputUri ?? null,
      checksum_sha256: input.checksumSha256 ?? null,
      generated_at: input.generatedAt ?? null,
      completed_at: input.completedAt ?? null,
      failed_at: input.failedAt ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("data_partner_exports")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PARTNER_EXPORT_CREATE_FAILED", "Unable to create data partner export.");
    return mapDataPartnerExport(data as DataPartnerExportRow);
  }

  async updateDataPartnerExport(exportId: string, input: UpdateDataPartnerExportInput): Promise<DataPartnerExport> {
    const payload: Record<string, unknown> = {};

    if (input.accessGrantId !== undefined) payload.access_grant_id = input.accessGrantId;
    if (input.exportStatus !== undefined) payload.export_status = input.exportStatus;
    if (input.requestedBy !== undefined) payload.requested_by = input.requestedBy;
    if (input.approvedBy !== undefined) payload.approved_by = input.approvedBy;
    if (input.generatedBy !== undefined) payload.generated_by = input.generatedBy;
    if (input.exportLevel !== undefined) payload.export_level = input.exportLevel;
    if (input.rowsExported !== undefined) payload.rows_exported = input.rowsExported;
    if (input.includesPersonalData !== undefined) payload.includes_personal_data = input.includesPersonalData;
    if (input.outputUri !== undefined) payload.output_uri = input.outputUri;
    if (input.checksumSha256 !== undefined) payload.checksum_sha256 = input.checksumSha256;
    if (input.generatedAt !== undefined) payload.generated_at = input.generatedAt;
    if (input.completedAt !== undefined) payload.completed_at = input.completedAt;
    if (input.failedAt !== undefined) payload.failed_at = input.failedAt;
    if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("data_partner_exports")
      .update(payload)
      .eq("id", exportId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_PARTNER_EXPORT_UPDATE_FAILED", "Unable to update data partner export.");
    return mapDataPartnerExport(data as DataPartnerExportRow);
  }

  async listGymAddonCatalog(limit = 300): Promise<GymAddonCatalogEntry[]> {
    const { data, error } = await this.supabase
      .from("gym_addon_catalog")
      .select("*")
      .order("name", { ascending: true })
      .limit(limitToRange(limit, 300, 1000));

    throwIfAdminError(error, "ADMIN_GYM_ADDON_CATALOG_READ_FAILED", "Unable to load add-on catalog.");
    return ((data as GymAddonCatalogEntryRow[]) ?? []).map(mapGymAddonCatalogEntry);
  }

  async createGymAddonCatalogEntry(input: CreateGymAddonCatalogInput): Promise<GymAddonCatalogEntry> {
    const payload = {
      code: input.code.trim().toLowerCase(),
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      billing_scope: input.billingScope ?? "b2b",
      default_price_cents: input.defaultPriceCents ?? 0,
      currency: input.currency ?? "EUR",
      is_active: input.isActive ?? true,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_addon_catalog")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_ADDON_CATALOG_CREATE_FAILED", "Unable to create add-on catalog entry.");
    return mapGymAddonCatalogEntry(data as GymAddonCatalogEntryRow);
  }

  async updateGymAddonCatalogEntry(addonId: string, input: UpdateGymAddonCatalogInput): Promise<GymAddonCatalogEntry> {
    const payload: Record<string, unknown> = {};

    if (input.code !== undefined) payload.code = input.code.trim().toLowerCase();
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.category !== undefined) payload.category = input.category;
    if (input.billingScope !== undefined) payload.billing_scope = input.billingScope;
    if (input.defaultPriceCents !== undefined) payload.default_price_cents = input.defaultPriceCents;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_addon_catalog")
      .update(payload)
      .eq("id", addonId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_ADDON_CATALOG_UPDATE_FAILED", "Unable to update add-on catalog entry.");
    return mapGymAddonCatalogEntry(data as GymAddonCatalogEntryRow);
  }

  async listGymAddonSubscriptions(options: PlatformControlPlaneLoadOptions = {}): Promise<GymAddonSubscription[]> {
    let query = this.supabase
      .from("gym_addon_subscriptions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_GYM_ADDON_SUBSCRIPTIONS_READ_FAILED", "Unable to load add-on subscriptions.");
    return ((data as GymAddonSubscriptionRow[]) ?? []).map(mapGymAddonSubscription);
  }

  async upsertGymAddonSubscription(gymId: string, input: UpsertGymAddonSubscriptionInput): Promise<GymAddonSubscription> {
    await this.requireGymStaff(gymId);
    const user = await this.getCurrentUser();

    const payload = {
      gym_id: gymId,
      addon_id: input.addonId,
      status: input.status ?? "trialing",
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      trial_ends_at: input.trialEndsAt ?? null,
      provider: input.provider ?? "stripe",
      provider_subscription_id: input.providerSubscriptionId ?? null,
      billing_reference: input.billingReference ?? null,
      config: input.config ?? {},
      metadata: input.metadata ?? {},
      created_by: user.id
    };

    const { data, error } = await this.supabase
      .from("gym_addon_subscriptions")
      .upsert(payload, { onConflict: "gym_id,addon_id" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_ADDON_SUBSCRIPTION_UPSERT_FAILED", "Unable to upsert add-on subscription.");
    return mapGymAddonSubscription(data as GymAddonSubscriptionRow);
  }

  async listGymAdvancedAnalyticsViews(gymId: string, limit = 200): Promise<GymAdvancedAnalyticsView[]> {
    await this.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_advanced_analytics_views")
      .select("*")
      .eq("gym_id", gymId)
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(
      error,
      "ADMIN_GYM_ADVANCED_ANALYTICS_VIEWS_READ_FAILED",
      "Unable to load advanced analytics views."
    );

    return ((data as GymAdvancedAnalyticsViewRow[]) ?? []).map(mapGymAdvancedAnalyticsView);
  }

  async createGymAdvancedAnalyticsView(
    gymId: string,
    input: CreateGymAdvancedAnalyticsViewInput
  ): Promise<GymAdvancedAnalyticsView> {
    await this.requireGymStaff(gymId);
    const user = await this.getCurrentUser();

    const payload = {
      gym_id: gymId,
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility ?? "staff",
      query_spec: input.querySpec ?? {},
      created_by: user.id,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_advanced_analytics_views")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_GYM_ADVANCED_ANALYTICS_VIEW_CREATE_FAILED",
      "Unable to create advanced analytics view."
    );

    return mapGymAdvancedAnalyticsView(data as GymAdvancedAnalyticsViewRow);
  }

  async updateGymAdvancedAnalyticsView(
    gymId: string,
    viewId: string,
    input: UpdateGymAdvancedAnalyticsViewInput
  ): Promise<GymAdvancedAnalyticsView> {
    await this.requireGymStaff(gymId);

    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.visibility !== undefined) payload.visibility = input.visibility;
    if (input.querySpec !== undefined) payload.query_spec = input.querySpec;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_advanced_analytics_views")
      .update(payload)
      .eq("id", viewId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_GYM_ADVANCED_ANALYTICS_VIEW_UPDATE_FAILED",
      "Unable to update advanced analytics view."
    );

    return mapGymAdvancedAnalyticsView(data as GymAdvancedAnalyticsViewRow);
  }

  async listGymAutomationPlaybooks(gymId: string, limit = 200): Promise<GymAutomationPlaybook[]> {
    await this.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_automation_playbooks")
      .select("*")
      .eq("gym_id", gymId)
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_PLAYBOOKS_READ_FAILED", "Unable to load automation playbooks.");
    return ((data as GymAutomationPlaybookRow[]) ?? []).map(mapGymAutomationPlaybook);
  }

  async createGymAutomationPlaybook(
    gymId: string,
    input: CreateGymAutomationPlaybookInput
  ): Promise<GymAutomationPlaybook> {
    await this.requireGymStaff(gymId);
    const user = await this.getCurrentUser();

    const payload = {
      gym_id: gymId,
      addon_subscription_id: input.addonSubscriptionId ?? null,
      name: input.name,
      description: input.description ?? null,
      trigger_type: input.triggerType,
      trigger_config: input.triggerConfig ?? {},
      action_plan: input.actionPlan ?? [],
      is_active: input.isActive ?? true,
      requires_human_approval: input.requiresHumanApproval ?? true,
      created_by: user.id,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_automation_playbooks")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_PLAYBOOK_CREATE_FAILED", "Unable to create automation playbook.");
    return mapGymAutomationPlaybook(data as GymAutomationPlaybookRow);
  }

  async updateGymAutomationPlaybook(
    gymId: string,
    playbookId: string,
    input: UpdateGymAutomationPlaybookInput
  ): Promise<GymAutomationPlaybook> {
    await this.requireGymStaff(gymId);

    const payload: Record<string, unknown> = {};
    if (input.addonSubscriptionId !== undefined) payload.addon_subscription_id = input.addonSubscriptionId;
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.triggerType !== undefined) payload.trigger_type = input.triggerType;
    if (input.triggerConfig !== undefined) payload.trigger_config = input.triggerConfig;
    if (input.actionPlan !== undefined) payload.action_plan = input.actionPlan;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.requiresHumanApproval !== undefined) payload.requires_human_approval = input.requiresHumanApproval;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_automation_playbooks")
      .update(payload)
      .eq("id", playbookId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_PLAYBOOK_UPDATE_FAILED", "Unable to update automation playbook.");
    return mapGymAutomationPlaybook(data as GymAutomationPlaybookRow);
  }

  async listGymAutomationRuns(gymId: string, limit = 200): Promise<GymAutomationRun[]> {
    await this.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_automation_runs")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_RUNS_READ_FAILED", "Unable to load automation runs.");
    return ((data as GymAutomationRunRow[]) ?? []).map(mapGymAutomationRun);
  }

  async createGymAutomationRun(gymId: string, input: CreateGymAutomationRunInput): Promise<GymAutomationRun> {
    await this.requireGymStaff(gymId);
    const user = await this.getCurrentUser();

    const payload = {
      playbook_id: input.playbookId,
      gym_id: gymId,
      run_status: input.runStatus ?? "queued",
      triggered_by: input.triggeredBy ?? user.id,
      trigger_payload: input.triggerPayload ?? {},
      planned_actions: input.plannedActions ?? [],
      executed_actions: input.executedActions ?? [],
      requires_human_approval: input.requiresHumanApproval ?? true,
      approval_status: input.approvalStatus ?? "pending",
      approved_by: input.approvedBy ?? null,
      approved_at: input.approvedAt ?? null,
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_automation_runs")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_RUN_CREATE_FAILED", "Unable to create automation run.");
    return mapGymAutomationRun(data as GymAutomationRunRow);
  }

  async updateGymAutomationRun(gymId: string, runId: string, input: UpdateGymAutomationRunInput): Promise<GymAutomationRun> {
    await this.requireGymStaff(gymId);

    const payload: Record<string, unknown> = {};
    if (input.runStatus !== undefined) payload.run_status = input.runStatus;
    if (input.triggeredBy !== undefined) payload.triggered_by = input.triggeredBy;
    if (input.triggerPayload !== undefined) payload.trigger_payload = input.triggerPayload;
    if (input.plannedActions !== undefined) payload.planned_actions = input.plannedActions;
    if (input.executedActions !== undefined) payload.executed_actions = input.executedActions;
    if (input.requiresHumanApproval !== undefined) payload.requires_human_approval = input.requiresHumanApproval;
    if (input.approvalStatus !== undefined) payload.approval_status = input.approvalStatus;
    if (input.approvedBy !== undefined) payload.approved_by = input.approvedBy;
    if (input.approvedAt !== undefined) payload.approved_at = input.approvedAt;
    if (input.startedAt !== undefined) payload.started_at = input.startedAt;
    if (input.completedAt !== undefined) payload.completed_at = input.completedAt;
    if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_automation_runs")
      .update(payload)
      .eq("id", runId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_AUTOMATION_RUN_UPDATE_FAILED", "Unable to update automation run.");
    return mapGymAutomationRun(data as GymAutomationRunRow);
  }

  async listPartnerMarketplaceApps(limit = 200): Promise<PartnerMarketplaceApp[]> {
    const { data, error } = await this.supabase
      .from("partner_marketplace_apps")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(limit, 200, 1000));

    throwIfAdminError(error, "ADMIN_PARTNER_MARKETPLACE_APPS_READ_FAILED", "Unable to load partner marketplace apps.");
    return ((data as PartnerMarketplaceAppRow[]) ?? []).map(mapPartnerMarketplaceApp);
  }

  async createPartnerMarketplaceApp(input: CreatePartnerMarketplaceAppInput): Promise<PartnerMarketplaceApp> {
    const payload = {
      partner_id: input.partnerId,
      app_code: input.appCode.trim().toLowerCase(),
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      status: input.status ?? "draft",
      pricing_model: input.pricingModel ?? "subscription",
      revenue_share_bps: input.revenueShareBps ?? null,
      install_url: input.installUrl ?? null,
      docs_url: input.docsUrl ?? null,
      is_active: input.isActive ?? true,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("partner_marketplace_apps")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PARTNER_MARKETPLACE_APP_CREATE_FAILED", "Unable to create partner app.");
    return mapPartnerMarketplaceApp(data as PartnerMarketplaceAppRow);
  }

  async updatePartnerMarketplaceApp(appId: string, input: UpdatePartnerMarketplaceAppInput): Promise<PartnerMarketplaceApp> {
    const payload: Record<string, unknown> = {};

    if (input.partnerId !== undefined) payload.partner_id = input.partnerId;
    if (input.appCode !== undefined) payload.app_code = input.appCode.trim().toLowerCase();
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.category !== undefined) payload.category = input.category;
    if (input.status !== undefined) payload.status = input.status;
    if (input.pricingModel !== undefined) payload.pricing_model = input.pricingModel;
    if (input.revenueShareBps !== undefined) payload.revenue_share_bps = input.revenueShareBps;
    if (input.installUrl !== undefined) payload.install_url = input.installUrl;
    if (input.docsUrl !== undefined) payload.docs_url = input.docsUrl;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("partner_marketplace_apps")
      .update(payload)
      .eq("id", appId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PARTNER_MARKETPLACE_APP_UPDATE_FAILED", "Unable to update partner app.");
    return mapPartnerMarketplaceApp(data as PartnerMarketplaceAppRow);
  }

  async listGymPartnerAppInstalls(options: PlatformControlPlaneLoadOptions = {}): Promise<GymPartnerAppInstall[]> {
    let query = this.supabase
      .from("gym_partner_app_installs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_GYM_PARTNER_APP_INSTALLS_READ_FAILED", "Unable to load partner app installs.");
    return ((data as GymPartnerAppInstallRow[]) ?? []).map(mapGymPartnerAppInstall);
  }

  async upsertGymPartnerAppInstall(gymId: string, input: UpsertGymPartnerAppInstallInput): Promise<GymPartnerAppInstall> {
    await this.requireGymStaff(gymId);
    const user = await this.getCurrentUser();

    const payload = {
      gym_id: gymId,
      partner_app_id: input.partnerAppId,
      install_status: input.installStatus ?? "active",
      external_account_id: input.externalAccountId ?? null,
      billing_reference: input.billingReference ?? null,
      installed_by: user.id,
      installed_at: input.installedAt ?? new Date().toISOString(),
      last_sync_at: input.lastSyncAt ?? null,
      last_error: input.lastError ?? null,
      config: input.config ?? {},
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("gym_partner_app_installs")
      .upsert(payload, { onConflict: "gym_id,partner_app_id" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_PARTNER_APP_INSTALL_UPSERT_FAILED", "Unable to upsert partner app install.");
    return mapGymPartnerAppInstall(data as GymPartnerAppInstallRow);
  }

  async listPartnerRevenueEvents(options: PlatformControlPlaneLoadOptions = {}): Promise<PartnerRevenueEvent[]> {
    let query = this.supabase
      .from("partner_revenue_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.gymId) {
      query = query.eq("gym_id", options.gymId);
    }

    if (options.partnerId) {
      query = query.eq("partner_id", options.partnerId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_PARTNER_REVENUE_EVENTS_READ_FAILED", "Unable to load partner revenue events.");
    return ((data as PartnerRevenueEventRow[]) ?? []).map(mapPartnerRevenueEvent);
  }

  async createPartnerRevenueEvent(input: CreatePartnerRevenueEventInput): Promise<PartnerRevenueEvent> {
    const payload = {
      gym_id: input.gymId ?? null,
      partner_id: input.partnerId,
      partner_app_id: input.partnerAppId ?? null,
      event_type: input.eventType,
      event_status: input.eventStatus ?? "pending",
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      gross_amount_cents: input.grossAmountCents ?? 0,
      platform_amount_cents: input.platformAmountCents ?? 0,
      partner_amount_cents: input.partnerAmountCents ?? 0,
      currency: input.currency ?? "EUR",
      source_reference: input.sourceReference ?? null,
      recognized_at: input.recognizedAt ?? null,
      paid_at: input.paidAt ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("partner_revenue_events")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PARTNER_REVENUE_EVENT_CREATE_FAILED", "Unable to create partner revenue event.");
    return mapPartnerRevenueEvent(data as PartnerRevenueEventRow);
  }

  async updatePartnerRevenueEvent(eventId: string, input: UpdatePartnerRevenueEventInput): Promise<PartnerRevenueEvent> {
    const payload: Record<string, unknown> = {};

    if (input.gymId !== undefined) payload.gym_id = input.gymId;
    if (input.partnerId !== undefined) payload.partner_id = input.partnerId;
    if (input.partnerAppId !== undefined) payload.partner_app_id = input.partnerAppId;
    if (input.eventType !== undefined) payload.event_type = input.eventType;
    if (input.eventStatus !== undefined) payload.event_status = input.eventStatus;
    if (input.periodStart !== undefined) payload.period_start = input.periodStart;
    if (input.periodEnd !== undefined) payload.period_end = input.periodEnd;
    if (input.grossAmountCents !== undefined) payload.gross_amount_cents = input.grossAmountCents;
    if (input.platformAmountCents !== undefined) payload.platform_amount_cents = input.platformAmountCents;
    if (input.partnerAmountCents !== undefined) payload.partner_amount_cents = input.partnerAmountCents;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.sourceReference !== undefined) payload.source_reference = input.sourceReference;
    if (input.recognizedAt !== undefined) payload.recognized_at = input.recognizedAt;
    if (input.paidAt !== undefined) payload.paid_at = input.paidAt;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("partner_revenue_events")
      .update(payload)
      .eq("id", eventId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_PARTNER_REVENUE_EVENT_UPDATE_FAILED", "Unable to update partner revenue event.");
    return mapPartnerRevenueEvent(data as PartnerRevenueEventRow);
  }

  async listDataAggregationJobs(options: PlatformControlPlaneLoadOptions = {}): Promise<DataAggregationJob[]> {
    let query = this.supabase
      .from("data_aggregation_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.productId) {
      query = query.eq("product_id", options.productId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_DATA_AGGREGATION_JOBS_READ_FAILED", "Unable to load data aggregation jobs.");
    return ((data as DataAggregationJobRow[]) ?? []).map(mapDataAggregationJob);
  }

  async createDataAggregationJob(input: CreateDataAggregationJobInput): Promise<DataAggregationJob> {
    const user = await this.getCurrentUser();
    const payload = {
      product_id: input.productId,
      requested_by: user.id,
      job_status: input.jobStatus ?? "queued",
      source_window_start: input.sourceWindowStart ?? null,
      source_window_end: input.sourceWindowEnd ?? null,
      aggregation_spec: input.aggregationSpec ?? {},
      output_summary: input.outputSummary ?? {},
      total_source_rows: input.totalSourceRows ?? 0,
      output_row_count: input.outputRowCount ?? 0,
      k_anonymity_floor: input.kAnonymityFloor ?? 50,
      min_group_size_observed: input.minGroupSizeObserved ?? null,
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
      failed_at: input.failedAt ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("data_aggregation_jobs")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_AGGREGATION_JOB_CREATE_FAILED", "Unable to create data aggregation job.");
    return mapDataAggregationJob(data as DataAggregationJobRow);
  }

  async updateDataAggregationJob(jobId: string, input: UpdateDataAggregationJobInput): Promise<DataAggregationJob> {
    const payload: Record<string, unknown> = {};

    if (input.productId !== undefined) payload.product_id = input.productId;
    if (input.jobStatus !== undefined) payload.job_status = input.jobStatus;
    if (input.sourceWindowStart !== undefined) payload.source_window_start = input.sourceWindowStart;
    if (input.sourceWindowEnd !== undefined) payload.source_window_end = input.sourceWindowEnd;
    if (input.aggregationSpec !== undefined) payload.aggregation_spec = input.aggregationSpec;
    if (input.outputSummary !== undefined) payload.output_summary = input.outputSummary;
    if (input.totalSourceRows !== undefined) payload.total_source_rows = input.totalSourceRows;
    if (input.outputRowCount !== undefined) payload.output_row_count = input.outputRowCount;
    if (input.kAnonymityFloor !== undefined) payload.k_anonymity_floor = input.kAnonymityFloor;
    if (input.minGroupSizeObserved !== undefined) payload.min_group_size_observed = input.minGroupSizeObserved;
    if (input.startedAt !== undefined) payload.started_at = input.startedAt;
    if (input.completedAt !== undefined) payload.completed_at = input.completedAt;
    if (input.failedAt !== undefined) payload.failed_at = input.failedAt;
    if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("data_aggregation_jobs")
      .update(payload)
      .eq("id", jobId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_AGGREGATION_JOB_UPDATE_FAILED", "Unable to update data aggregation job.");
    return mapDataAggregationJob(data as DataAggregationJobRow);
  }

  async listDataAnonymizationChecks(options: PlatformControlPlaneLoadOptions = {}): Promise<DataAnonymizationCheck[]> {
    let query = this.supabase
      .from("data_anonymization_checks")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.productId) {
      const { data: jobs, error: jobsError } = await this.supabase
        .from("data_aggregation_jobs")
        .select("id")
        .eq("product_id", options.productId)
        .limit(1000);

      throwIfAdminError(
        jobsError,
        "ADMIN_DATA_ANONYMIZATION_CHECKS_PRODUCT_SCOPE_FAILED",
        "Unable to resolve product-scope anonymization checks."
      );

      const jobIds = ((jobs as Array<{ id: string }>) ?? []).map((job) => job.id);
      if (jobIds.length === 0) {
        return [];
      }

      query = query.in("aggregation_job_id", jobIds);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_DATA_ANONYMIZATION_CHECKS_READ_FAILED", "Unable to load anonymization checks.");
    return ((data as DataAnonymizationCheckRow[]) ?? []).map(mapDataAnonymizationCheck);
  }

  async upsertDataAnonymizationCheck(input: UpsertDataAnonymizationCheckInput): Promise<DataAnonymizationCheck> {
    const payload = {
      aggregation_job_id: input.aggregationJobId,
      check_type: input.checkType,
      status: input.status ?? "passed",
      threshold_value: input.thresholdValue ?? null,
      observed_value: input.observedValue ?? null,
      details: input.details ?? {},
      checked_by: input.checkedBy ?? null,
      checked_at: input.checkedAt ?? new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from("data_anonymization_checks")
      .upsert(payload, { onConflict: "aggregation_job_id,check_type" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_ANONYMIZATION_CHECK_UPSERT_FAILED", "Unable to upsert anonymization check.");
    return mapDataAnonymizationCheck(data as DataAnonymizationCheckRow);
  }

  async listDataReleaseApprovals(options: PlatformControlPlaneLoadOptions = {}): Promise<DataReleaseApproval[]> {
    let query = this.supabase
      .from("data_release_approvals")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limitToRange(options.limit, 200, 1000));

    if (options.exportId) {
      query = query.eq("export_id", options.exportId);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_DATA_RELEASE_APPROVALS_READ_FAILED", "Unable to load data release approvals.");
    return ((data as DataReleaseApprovalRow[]) ?? []).map(mapDataReleaseApproval);
  }

  async upsertDataReleaseApproval(input: UpsertDataReleaseApprovalInput): Promise<DataReleaseApproval> {
    const payload = {
      export_id: input.exportId,
      required_approval_type: input.requiredApprovalType,
      status: input.status ?? "pending",
      decided_by: input.decidedBy ?? null,
      decided_at: input.decidedAt ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("data_release_approvals")
      .upsert(payload, { onConflict: "export_id,required_approval_type" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_DATA_RELEASE_APPROVAL_UPSERT_FAILED", "Unable to upsert data release approval.");
    return mapDataReleaseApproval(data as DataReleaseApprovalRow);
  }
}
