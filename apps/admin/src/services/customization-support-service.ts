import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateInvoiceDeliveryJobInput,
  CreateSupportAutomationRunInput,
  CreateSupportTicketMessageInput,
  GymBrandSettings,
  GymFeatureSetting,
  InvoiceComplianceProfile,
  InvoiceDeliveryJob,
  InvoiceProviderConnection,
  SubmitSupportTicketInput,
  SupportAutomationRun,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus,
  UpdateSupportTicketInput,
  UpsertGymBrandSettingsInput,
  UpsertGymFeatureSettingInput,
  UpsertInvoiceComplianceProfileInput,
  UpsertInvoiceProviderConnectionInput
} from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type GymBrandSettingsRow = {
  gym_id: string;
  app_display_name: string | null;
  logo_url: string | null;
  icon_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  headline_font: string | null;
  body_font: string | null;
  stats_font: string | null;
  launch_screen_message: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  support_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymFeatureSettingRow = {
  id: string;
  gym_id: string;
  feature_key: string;
  enabled: boolean;
  rollout_percentage: number;
  config: Record<string, unknown>;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceProviderConnectionRow = {
  id: string;
  gym_id: string;
  provider_slug: string;
  display_name: string | null;
  connection_status: InvoiceProviderConnection["connectionStatus"];
  environment: InvoiceProviderConnection["environment"];
  account_identifier: string | null;
  credentials_reference: string | null;
  webhook_secret_reference: string | null;
  is_default: boolean;
  supported_countries: string[] | null;
  metadata: Record<string, unknown>;
  connected_at: string | null;
  disconnected_at: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceComplianceProfileRow = {
  gym_id: string;
  legal_entity_name: string;
  vat_number: string | null;
  tax_code: string | null;
  registration_number: string | null;
  tax_regime: string | null;
  country_code: string;
  default_currency: string;
  invoice_scheme: InvoiceComplianceProfile["invoiceScheme"];
  pec_email: string | null;
  sdi_destination_code: string | null;
  locale: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type InvoiceDeliveryJobRow = {
  id: string;
  invoice_id: string;
  gym_id: string;
  provider_connection_id: string | null;
  target_country_code: string;
  delivery_channel: InvoiceDeliveryJob["deliveryChannel"];
  payload_format: InvoiceDeliveryJob["payloadFormat"];
  status: InvoiceDeliveryJob["status"];
  idempotency_key: string;
  attempt_count: number;
  next_retry_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  provider_document_id: string | null;
  provider_response: Record<string, unknown>;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SupportTicketRow = {
  id: string;
  ticket_number: number | string;
  gym_id: string | null;
  reporter_user_id: string | null;
  reporter_email: string | null;
  channel: SupportTicket["channel"];
  category: string;
  priority: SupportTicket["priority"];
  status: SupportTicket["status"];
  subject: string;
  description: string;
  affected_surface: string | null;
  impacted_users_count: number;
  requires_human_approval: boolean;
  owner_user_id: string | null;
  ai_summary: string | null;
  ai_triage_labels: string[] | null;
  ai_recommended_actions: unknown;
  ai_confidence: number | null;
  last_customer_reply_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SupportTicketMessageRow = {
  id: string;
  ticket_id: string;
  actor_type: SupportTicketMessage["actorType"];
  actor_user_id: string | null;
  actor_label: string | null;
  is_internal: boolean;
  body: string;
  attachments: unknown;
  metadata: Record<string, unknown>;
  created_at: string;
};

type SupportAutomationRunRow = {
  id: string;
  ticket_id: string;
  agent_name: string;
  trigger_source: string;
  run_status: SupportAutomationRun["runStatus"];
  requires_approval: boolean;
  approval_status: SupportAutomationRun["approvalStatus"];
  plan_json: Record<string, unknown>;
  proposed_changes: unknown;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  notification_sent_at: string | null;
  result_summary: string | null;
  result_payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type SupportTicketLookupRow = {
  id: string;
  gym_id: string | null;
};

export interface SupportTicketListOptions {
  statuses?: SupportTicketStatus[];
  includeClosed?: boolean;
  limit?: number;
  search?: string;
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

function mapGymBrandSettings(row: GymBrandSettingsRow): GymBrandSettings {
  return {
    gymId: row.gym_id,
    appDisplayName: row.app_display_name,
    logoUrl: row.logo_url,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    surfaceColor: row.surface_color,
    textColor: row.text_color,
    headlineFont: row.headline_font,
    bodyFont: row.body_font,
    statsFont: row.stats_font,
    launchScreenMessage: row.launch_screen_message,
    termsUrl: row.terms_url,
    privacyUrl: row.privacy_url,
    supportEmail: row.support_email,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymFeatureSetting(row: GymFeatureSettingRow): GymFeatureSetting {
  return {
    id: row.id,
    gymId: row.gym_id,
    featureKey: row.feature_key,
    enabled: row.enabled,
    rolloutPercentage: row.rollout_percentage,
    config: row.config ?? {},
    note: row.note,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceProviderConnection(row: InvoiceProviderConnectionRow): InvoiceProviderConnection {
  return {
    id: row.id,
    gymId: row.gym_id,
    providerSlug: row.provider_slug,
    displayName: row.display_name,
    connectionStatus: row.connection_status,
    environment: row.environment,
    accountIdentifier: row.account_identifier,
    credentialsReference: row.credentials_reference,
    webhookSecretReference: row.webhook_secret_reference,
    isDefault: row.is_default,
    supportedCountries: row.supported_countries ?? [],
    metadata: row.metadata ?? {},
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceComplianceProfile(row: InvoiceComplianceProfileRow): InvoiceComplianceProfile {
  return {
    gymId: row.gym_id,
    legalEntityName: row.legal_entity_name,
    vatNumber: row.vat_number,
    taxCode: row.tax_code,
    registrationNumber: row.registration_number,
    taxRegime: row.tax_regime,
    countryCode: row.country_code,
    defaultCurrency: row.default_currency,
    invoiceScheme: row.invoice_scheme,
    pecEmail: row.pec_email,
    sdiDestinationCode: row.sdi_destination_code,
    locale: row.locale,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceDeliveryJob(row: InvoiceDeliveryJobRow): InvoiceDeliveryJob {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    gymId: row.gym_id,
    providerConnectionId: row.provider_connection_id,
    targetCountryCode: row.target_country_code,
    deliveryChannel: row.delivery_channel,
    payloadFormat: row.payload_format,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    providerDocumentId: row.provider_document_id,
    providerResponse: row.provider_response ?? {},
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportTicket(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    ticketNumber: Number(row.ticket_number),
    gymId: row.gym_id,
    reporterUserId: row.reporter_user_id,
    reporterEmail: row.reporter_email,
    channel: row.channel,
    category: row.category,
    priority: row.priority,
    status: row.status,
    subject: row.subject,
    description: row.description,
    affectedSurface: row.affected_surface,
    impactedUsersCount: row.impacted_users_count,
    requiresHumanApproval: row.requires_human_approval,
    ownerUserId: row.owner_user_id,
    aiSummary: row.ai_summary,
    aiTriageLabels: row.ai_triage_labels ?? [],
    aiRecommendedActions: toObjectArray(row.ai_recommended_actions),
    aiConfidence: row.ai_confidence,
    lastCustomerReplyAt: row.last_customer_reply_at,
    firstResponseDueAt: row.first_response_due_at,
    resolutionDueAt: row.resolution_due_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportTicketMessage(row: SupportTicketMessageRow): SupportTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    isInternal: row.is_internal,
    body: row.body,
    attachments: toObjectArray(row.attachments),
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function mapSupportAutomationRun(row: SupportAutomationRunRow): SupportAutomationRun {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    agentName: row.agent_name,
    triggerSource: row.trigger_source,
    runStatus: row.run_status,
    requiresApproval: row.requires_approval,
    approvalStatus: row.approval_status,
    planJson: row.plan_json ?? {},
    proposedChanges: toObjectArray(row.proposed_changes),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
    notificationSentAt: row.notification_sent_at,
    resultSummary: row.result_summary,
    resultPayload: row.result_payload ?? {},
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class CustomizationSupportService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  private async assertTicketBelongsToGym(gymId: string, ticketId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from("support_tickets")
      .select("id,gym_id")
      .eq("id", ticketId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_SUPPORT_TICKET_LOOKUP_FAILED", "Unable to validate support ticket scope.");

    if (!data) {
      throw new KruxtAdminError("ADMIN_SUPPORT_TICKET_NOT_FOUND", "Support ticket not found.");
    }

    const ticket = data as SupportTicketLookupRow;
    if (ticket.gym_id !== gymId) {
      throw new KruxtAdminError("ADMIN_SUPPORT_TICKET_SCOPE_MISMATCH", "Support ticket does not belong to this gym.");
    }
  }

  async getGymBrandSettings(gymId: string): Promise<GymBrandSettings | null> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_brand_settings")
      .select("*")
      .eq("gym_id", gymId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_GYM_BRAND_SETTINGS_READ_FAILED", "Unable to load gym brand settings.");
    return data ? mapGymBrandSettings(data as GymBrandSettingsRow) : null;
  }

  async upsertGymBrandSettings(gymId: string, input: UpsertGymBrandSettingsInput): Promise<GymBrandSettings> {
    await this.access.requireGymStaff(gymId);
    const payload: Record<string, unknown> = { gym_id: gymId };

    if (input.appDisplayName !== undefined) payload.app_display_name = input.appDisplayName;
    if (input.logoUrl !== undefined) payload.logo_url = input.logoUrl;
    if (input.iconUrl !== undefined) payload.icon_url = input.iconUrl;
    if (input.bannerUrl !== undefined) payload.banner_url = input.bannerUrl;
    if (input.primaryColor !== undefined) payload.primary_color = input.primaryColor;
    if (input.accentColor !== undefined) payload.accent_color = input.accentColor;
    if (input.backgroundColor !== undefined) payload.background_color = input.backgroundColor;
    if (input.surfaceColor !== undefined) payload.surface_color = input.surfaceColor;
    if (input.textColor !== undefined) payload.text_color = input.textColor;
    if (input.headlineFont !== undefined) payload.headline_font = input.headlineFont;
    if (input.bodyFont !== undefined) payload.body_font = input.bodyFont;
    if (input.statsFont !== undefined) payload.stats_font = input.statsFont;
    if (input.launchScreenMessage !== undefined) payload.launch_screen_message = input.launchScreenMessage;
    if (input.termsUrl !== undefined) payload.terms_url = input.termsUrl;
    if (input.privacyUrl !== undefined) payload.privacy_url = input.privacyUrl;
    if (input.supportEmail !== undefined) payload.support_email = input.supportEmail;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_brand_settings")
      .upsert(payload, { onConflict: "gym_id" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_BRAND_SETTINGS_UPSERT_FAILED", "Unable to save gym brand settings.");
    return mapGymBrandSettings(data as GymBrandSettingsRow);
  }

  async listGymFeatureSettings(gymId: string, limit = 500): Promise<GymFeatureSetting[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_feature_settings")
      .select("*")
      .eq("gym_id", gymId)
      .order("feature_key", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 1000));

    throwIfAdminError(error, "ADMIN_GYM_FEATURE_SETTINGS_READ_FAILED", "Unable to load gym feature settings.");
    return ((data as GymFeatureSettingRow[]) ?? []).map(mapGymFeatureSetting);
  }

  async upsertGymFeatureSetting(gymId: string, input: UpsertGymFeatureSettingInput): Promise<GymFeatureSetting> {
    await this.access.requireGymStaff(gymId);
    const user = await this.access.getCurrentUser();

    const payload = {
      gym_id: gymId,
      feature_key: input.featureKey.trim().toLowerCase(),
      enabled: input.enabled ?? true,
      rollout_percentage: input.rolloutPercentage ?? 100,
      config: input.config ?? {},
      note: input.note ?? null,
      updated_by: user.id
    };

    const { data, error } = await this.supabase
      .from("gym_feature_settings")
      .upsert(payload, { onConflict: "gym_id,feature_key" })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_GYM_FEATURE_SETTING_UPSERT_FAILED", "Unable to save gym feature setting.");
    return mapGymFeatureSetting(data as GymFeatureSettingRow);
  }

  async removeGymFeatureSetting(gymId: string, featureKey: string): Promise<void> {
    await this.access.requireGymStaff(gymId);

    const { error } = await this.supabase
      .from("gym_feature_settings")
      .delete()
      .eq("gym_id", gymId)
      .eq("feature_key", featureKey.trim().toLowerCase());

    throwIfAdminError(error, "ADMIN_GYM_FEATURE_SETTING_DELETE_FAILED", "Unable to remove gym feature setting.");
  }

  async listInvoiceProviderConnections(gymId: string, limit = 100): Promise<InvoiceProviderConnection[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("invoice_provider_connections")
      .select("*")
      .eq("gym_id", gymId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfAdminError(
      error,
      "ADMIN_INVOICE_PROVIDER_CONNECTIONS_READ_FAILED",
      "Unable to load invoice provider connections."
    );

    return ((data as InvoiceProviderConnectionRow[]) ?? []).map(mapInvoiceProviderConnection);
  }

  async upsertInvoiceProviderConnection(
    gymId: string,
    input: UpsertInvoiceProviderConnectionInput
  ): Promise<InvoiceProviderConnection> {
    await this.access.requireGymStaff(gymId);
    const payload: Record<string, unknown> = {
      gym_id: gymId,
      provider_slug: input.providerSlug.trim().toLowerCase()
    };

    if (input.displayName !== undefined) payload.display_name = input.displayName;
    if (input.connectionStatus !== undefined) payload.connection_status = input.connectionStatus;
    if (input.environment !== undefined) payload.environment = input.environment;
    if (input.accountIdentifier !== undefined) payload.account_identifier = input.accountIdentifier;
    if (input.credentialsReference !== undefined) payload.credentials_reference = input.credentialsReference;
    if (input.webhookSecretReference !== undefined) payload.webhook_secret_reference = input.webhookSecretReference;
    if (input.isDefault !== undefined) payload.is_default = input.isDefault;
    if (input.supportedCountries !== undefined) payload.supported_countries = input.supportedCountries;
    if (input.metadata !== undefined) payload.metadata = input.metadata;
    if (input.connectedAt !== undefined) payload.connected_at = input.connectedAt;
    if (input.disconnectedAt !== undefined) payload.disconnected_at = input.disconnectedAt;
    if (input.lastVerifiedAt !== undefined) payload.last_verified_at = input.lastVerifiedAt;
    if (input.lastError !== undefined) payload.last_error = input.lastError;

    const { data, error } = await this.supabase
      .from("invoice_provider_connections")
      .upsert(payload, { onConflict: "gym_id,provider_slug" })
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_INVOICE_PROVIDER_CONNECTION_UPSERT_FAILED",
      "Unable to save invoice provider connection."
    );

    const connection = mapInvoiceProviderConnection(data as InvoiceProviderConnectionRow);

    if (connection.isDefault) {
      await this.setDefaultInvoiceProviderConnection(gymId, connection.id);
      return (await this.getInvoiceProviderConnectionById(gymId, connection.id)) ?? connection;
    }

    return connection;
  }

  async getInvoiceProviderConnectionById(gymId: string, connectionId: string): Promise<InvoiceProviderConnection | null> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("invoice_provider_connections")
      .select("*")
      .eq("gym_id", gymId)
      .eq("id", connectionId)
      .maybeSingle();

    throwIfAdminError(
      error,
      "ADMIN_INVOICE_PROVIDER_CONNECTION_READ_FAILED",
      "Unable to load invoice provider connection."
    );

    return data ? mapInvoiceProviderConnection(data as InvoiceProviderConnectionRow) : null;
  }

  async setDefaultInvoiceProviderConnection(gymId: string, connectionId: string): Promise<InvoiceProviderConnection> {
    await this.access.requireGymStaff(gymId);

    const { error: unsetError } = await this.supabase
      .from("invoice_provider_connections")
      .update({ is_default: false })
      .eq("gym_id", gymId)
      .neq("id", connectionId);

    throwIfAdminError(
      unsetError,
      "ADMIN_INVOICE_PROVIDER_DEFAULT_RESET_FAILED",
      "Unable to reset invoice provider default state."
    );

    const { data, error } = await this.supabase
      .from("invoice_provider_connections")
      .update({ is_default: true })
      .eq("gym_id", gymId)
      .eq("id", connectionId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_INVOICE_PROVIDER_DEFAULT_SET_FAILED", "Unable to set default invoice provider.");
    return mapInvoiceProviderConnection(data as InvoiceProviderConnectionRow);
  }

  async getInvoiceComplianceProfile(gymId: string): Promise<InvoiceComplianceProfile | null> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("invoice_compliance_profiles")
      .select("*")
      .eq("gym_id", gymId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_INVOICE_COMPLIANCE_PROFILE_READ_FAILED", "Unable to load invoice compliance profile.");
    return data ? mapInvoiceComplianceProfile(data as InvoiceComplianceProfileRow) : null;
  }

  async upsertInvoiceComplianceProfile(
    gymId: string,
    input: UpsertInvoiceComplianceProfileInput
  ): Promise<InvoiceComplianceProfile> {
    await this.access.requireGymStaff(gymId);

    const payload = {
      gym_id: gymId,
      legal_entity_name: input.legalEntityName,
      vat_number: input.vatNumber ?? null,
      tax_code: input.taxCode ?? null,
      registration_number: input.registrationNumber ?? null,
      tax_regime: input.taxRegime ?? null,
      country_code: input.countryCode,
      default_currency: input.defaultCurrency ?? "EUR",
      invoice_scheme: input.invoiceScheme ?? "eu_vat",
      pec_email: input.pecEmail ?? null,
      sdi_destination_code: input.sdiDestinationCode ?? null,
      locale: input.locale ?? "en-US",
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("invoice_compliance_profiles")
      .upsert(payload, { onConflict: "gym_id" })
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_INVOICE_COMPLIANCE_PROFILE_UPSERT_FAILED",
      "Unable to save invoice compliance profile."
    );

    return mapInvoiceComplianceProfile(data as InvoiceComplianceProfileRow);
  }

  async listInvoiceDeliveryJobs(gymId: string, limit = 200): Promise<InvoiceDeliveryJob[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("invoice_delivery_jobs")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfAdminError(error, "ADMIN_INVOICE_DELIVERY_JOBS_READ_FAILED", "Unable to load invoice delivery jobs.");
    return ((data as InvoiceDeliveryJobRow[]) ?? []).map(mapInvoiceDeliveryJob);
  }

  async createInvoiceDeliveryJob(gymId: string, input: CreateInvoiceDeliveryJobInput): Promise<InvoiceDeliveryJob> {
    await this.access.requireGymStaff(gymId);
    const user = await this.access.getCurrentUser();

    const payload = {
      invoice_id: input.invoiceId,
      gym_id: gymId,
      provider_connection_id: input.providerConnectionId ?? null,
      target_country_code: input.targetCountryCode,
      delivery_channel: input.deliveryChannel ?? "provider_api",
      payload_format: input.payloadFormat ?? "json",
      status: input.status ?? "queued",
      idempotency_key: input.idempotencyKey,
      next_retry_at: input.nextRetryAt ?? null,
      submitted_at: input.submittedAt ?? null,
      completed_at: input.completedAt ?? null,
      provider_document_id: input.providerDocumentId ?? null,
      provider_response: input.providerResponse ?? {},
      error_message: input.errorMessage ?? null,
      created_by: user.id
    };

    const { data, error } = await this.supabase
      .from("invoice_delivery_jobs")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_INVOICE_DELIVERY_JOB_CREATE_FAILED", "Unable to create invoice delivery job.");
    return mapInvoiceDeliveryJob(data as InvoiceDeliveryJobRow);
  }

  async listSupportTickets(gymId: string, options: SupportTicketListOptions = {}): Promise<SupportTicket[]> {
    await this.access.requireGymStaff(gymId);

    const statuses = options.statuses ?? [];
    const includeClosed = options.includeClosed ?? false;
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
    const search = (options.search ?? "").trim();

    let query = this.supabase
      .from("support_tickets")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statuses.length > 0) {
      query = query.in("status", statuses);
    } else if (!includeClosed) {
      query = query.in("status", ["open", "triaged", "waiting_user", "in_progress", "waiting_approval"]);
    }

    if (search.length > 0) {
      query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_SUPPORT_TICKETS_READ_FAILED", "Unable to load support tickets.");

    return ((data as SupportTicketRow[]) ?? []).map(mapSupportTicket);
  }

  async getSupportTicket(gymId: string, ticketId: string): Promise<SupportTicket | null> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);

    const { data, error } = await this.supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_SUPPORT_TICKET_READ_FAILED", "Unable to load support ticket.");
    return data ? mapSupportTicket(data as SupportTicketRow) : null;
  }

  async submitSupportTicket(gymId: string, input: SubmitSupportTicketInput): Promise<SupportTicket> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase.rpc("submit_support_ticket", {
      p_subject: input.subject,
      p_description: input.description,
      p_gym_id: gymId,
      p_category: input.category ?? "general",
      p_priority: input.priority ?? "normal",
      p_channel: input.channel ?? "in_app",
      p_reporter_email: input.reporterEmail ?? null,
      p_metadata: input.metadata ?? {}
    });

    throwIfAdminError(error, "ADMIN_SUPPORT_TICKET_SUBMIT_FAILED", "Unable to submit support ticket.");

    const row = data as SupportTicketRow | null;
    if (!row) {
      throw new KruxtAdminError("ADMIN_SUPPORT_TICKET_SUBMIT_EMPTY", "Support ticket submission returned no data.");
    }

    return mapSupportTicket(row);
  }

  async updateSupportTicket(gymId: string, ticketId: string, input: UpdateSupportTicketInput): Promise<SupportTicket> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);

    const payload: Record<string, unknown> = {};

    if (input.status !== undefined) payload.status = input.status;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.ownerUserId !== undefined) payload.owner_user_id = input.ownerUserId;
    if (input.requiresHumanApproval !== undefined) payload.requires_human_approval = input.requiresHumanApproval;
    if (input.aiSummary !== undefined) payload.ai_summary = input.aiSummary;
    if (input.aiTriageLabels !== undefined) payload.ai_triage_labels = input.aiTriageLabels;
    if (input.aiRecommendedActions !== undefined) payload.ai_recommended_actions = input.aiRecommendedActions;
    if (input.aiConfidence !== undefined) payload.ai_confidence = input.aiConfidence;
    if (input.firstResponseDueAt !== undefined) payload.first_response_due_at = input.firstResponseDueAt;
    if (input.resolutionDueAt !== undefined) payload.resolution_due_at = input.resolutionDueAt;
    if (input.resolvedAt !== undefined) payload.resolved_at = input.resolvedAt;
    if (input.closedAt !== undefined) payload.closed_at = input.closedAt;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("support_tickets")
      .update(payload)
      .eq("id", ticketId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_TICKET_UPDATE_FAILED", "Unable to update support ticket.");
    return mapSupportTicket(data as SupportTicketRow);
  }

  async listSupportTicketMessages(gymId: string, ticketId: string, limit = 500): Promise<SupportTicketMessage[]> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);

    const { data, error } = await this.supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 1000));

    throwIfAdminError(error, "ADMIN_SUPPORT_MESSAGES_READ_FAILED", "Unable to load support ticket messages.");
    return ((data as SupportTicketMessageRow[]) ?? []).map(mapSupportTicketMessage);
  }

  async createSupportTicketMessage(
    gymId: string,
    ticketId: string,
    input: CreateSupportTicketMessageInput
  ): Promise<SupportTicketMessage> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);
    const user = await this.access.getCurrentUser();

    const payload = {
      ticket_id: ticketId,
      actor_type: input.actorType,
      actor_user_id: input.actorUserId ?? user.id,
      actor_label: input.actorLabel ?? null,
      is_internal: input.isInternal ?? false,
      body: input.body,
      attachments: input.attachments ?? [],
      metadata: input.metadata ?? {}
    };

    const { data, error } = await this.supabase
      .from("support_ticket_messages")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_SUPPORT_MESSAGE_CREATE_FAILED", "Unable to create support ticket message.");
    return mapSupportTicketMessage(data as SupportTicketMessageRow);
  }

  async listSupportAutomationRuns(gymId: string, ticketId: string, limit = 500): Promise<SupportAutomationRun[]> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);

    const { data, error } = await this.supabase
      .from("support_automation_runs")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 1000));

    throwIfAdminError(error, "ADMIN_SUPPORT_AUTOMATION_RUNS_READ_FAILED", "Unable to load support automation runs.");
    return ((data as SupportAutomationRunRow[]) ?? []).map(mapSupportAutomationRun);
  }

  async createSupportAutomationRun(
    gymId: string,
    ticketId: string,
    input: CreateSupportAutomationRunInput
  ): Promise<SupportAutomationRun> {
    await this.access.requireGymStaff(gymId);
    await this.assertTicketBelongsToGym(gymId, ticketId);

    const payload = {
      ticket_id: ticketId,
      agent_name: input.agentName,
      trigger_source: input.triggerSource ?? "manual",
      run_status: input.runStatus ?? "queued",
      requires_approval: input.requiresApproval ?? true,
      approval_status: input.approvalStatus ?? "pending",
      plan_json: input.planJson ?? {},
      proposed_changes: input.proposedChanges ?? [],
      result_summary: input.resultSummary ?? null,
      result_payload: input.resultPayload ?? {},
      error_message: input.errorMessage ?? null
    };

    const { data, error } = await this.supabase
      .from("support_automation_runs")
      .insert(payload)
      .select("*")
      .single();

    throwIfAdminError(
      error,
      "ADMIN_SUPPORT_AUTOMATION_RUN_CREATE_FAILED",
      "Unable to create support automation run."
    );

    return mapSupportAutomationRun(data as SupportAutomationRunRow);
  }

  async approveSupportAutomationRun(
    gymId: string,
    runId: string,
    approve: boolean,
    note?: string
  ): Promise<SupportAutomationRun> {
    await this.access.requireGymStaff(gymId);

    const { data: runLookup, error: runLookupError } = await this.supabase
      .from("support_automation_runs")
      .select("id,ticket_id")
      .eq("id", runId)
      .maybeSingle();

    throwIfAdminError(
      runLookupError,
      "ADMIN_SUPPORT_AUTOMATION_RUN_LOOKUP_FAILED",
      "Unable to validate support automation run."
    );

    if (!runLookup) {
      throw new KruxtAdminError("ADMIN_SUPPORT_AUTOMATION_RUN_NOT_FOUND", "Support automation run not found.");
    }

    await this.assertTicketBelongsToGym(gymId, (runLookup as { ticket_id: string }).ticket_id);

    const { data, error } = await this.supabase.rpc("approve_support_automation_run", {
      p_run_id: runId,
      p_approve: approve,
      p_note: note ?? null
    });

    throwIfAdminError(error, "ADMIN_SUPPORT_AUTOMATION_RUN_APPROVAL_FAILED", "Unable to approve automation run.");

    const row = data as SupportAutomationRunRow | null;
    if (!row) {
      throw new KruxtAdminError(
        "ADMIN_SUPPORT_AUTOMATION_RUN_APPROVAL_EMPTY",
        "Support automation run approval returned no row."
      );
    }

    return mapSupportAutomationRun(row);
  }
}
