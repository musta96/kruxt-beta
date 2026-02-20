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

import {
  createAdminSupabaseClient,
  CustomizationSupportService,
  KruxtAdminError,
  type SupportTicketListOptions
} from "../services";

export type Phase10CustomizationSupportStep =
  | "branding"
  | "feature_controls"
  | "invoice_connections"
  | "invoice_compliance"
  | "invoice_delivery"
  | "support_queue"
  | "support_conversation"
  | "support_automation";

export interface Phase10CustomizationSupportError {
  code: string;
  step: Phase10CustomizationSupportStep;
  message: string;
  recoverable: boolean;
}

export interface Phase10CustomizationSupportLoadOptions {
  selectedTicketId?: string;
  supportStatuses?: SupportTicketStatus[];
  includeResolvedSupportTickets?: boolean;
  supportSearch?: string;
}

export interface Phase10CustomizationSupportSnapshot {
  brandSettings: GymBrandSettings | null;
  featureSettings: GymFeatureSetting[];
  invoiceConnections: InvoiceProviderConnection[];
  complianceProfile: InvoiceComplianceProfile | null;
  invoiceDeliveryJobs: InvoiceDeliveryJob[];
  supportTickets: SupportTicket[];
  selectedTicketId?: string;
  selectedTicket: SupportTicket | null;
  selectedTicketMessages: SupportTicketMessage[];
  selectedTicketAutomationRuns: SupportAutomationRun[];
}

export interface Phase10LoadSuccess {
  ok: true;
  snapshot: Phase10CustomizationSupportSnapshot;
}

export interface Phase10LoadFailure {
  ok: false;
  error: Phase10CustomizationSupportError;
}

export type Phase10LoadResult = Phase10LoadSuccess | Phase10LoadFailure;

export interface Phase10MutationSuccess {
  ok: true;
  action:
    | "upsert_branding"
    | "upsert_feature_setting"
    | "remove_feature_setting"
    | "upsert_invoice_connection"
    | "set_default_invoice_connection"
    | "upsert_invoice_compliance"
    | "create_invoice_delivery_job"
    | "submit_support_ticket"
    | "update_support_ticket"
    | "create_support_message"
    | "create_support_automation_run"
    | "approve_support_automation_run";
  snapshot: Phase10CustomizationSupportSnapshot;
  brandSettings?: GymBrandSettings;
  featureSetting?: GymFeatureSetting;
  invoiceConnection?: InvoiceProviderConnection;
  complianceProfile?: InvoiceComplianceProfile;
  invoiceDeliveryJob?: InvoiceDeliveryJob;
  supportTicket?: SupportTicket;
  supportMessage?: SupportTicketMessage;
  supportAutomationRun?: SupportAutomationRun;
}

export interface Phase10MutationFailure {
  ok: false;
  error: Phase10CustomizationSupportError;
}

export type Phase10MutationResult = Phase10MutationSuccess | Phase10MutationFailure;

export const phase10CustomizationSupportChecklist = [
  "Load gym branding + per-gym module controls",
  "Load invoice provider connection and compliance profile state",
  "Load invoice delivery queue for adapter monitoring",
  "Load support queue, conversation thread, and automation approval runs"
] as const;

function mapErrorStep(code: string): Phase10CustomizationSupportStep {
  if (code.includes("BRAND")) {
    return "branding";
  }

  if (code.includes("FEATURE")) {
    return "feature_controls";
  }

  if (code.includes("INVOICE_PROVIDER")) {
    return "invoice_connections";
  }

  if (code.includes("INVOICE_COMPLIANCE")) {
    return "invoice_compliance";
  }

  if (code.includes("INVOICE_DELIVERY")) {
    return "invoice_delivery";
  }

  if (code.includes("SUPPORT_MESSAGE")) {
    return "support_conversation";
  }

  if (code.includes("SUPPORT_AUTOMATION")) {
    return "support_automation";
  }

  if (code.includes("SUPPORT")) {
    return "support_queue";
  }

  return "support_queue";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "ADMIN_STAFF_ACCESS_DENIED") {
    return "Gym staff access is required to manage this workspace.";
  }

  if (code === "ADMIN_AUTH_REQUIRED") {
    return "Sign in is required before using admin operations.";
  }

  if (code === "ADMIN_SUPPORT_TICKET_SCOPE_MISMATCH") {
    return "The selected ticket belongs to a different gym workspace.";
  }

  if (code === "ADMIN_SUPPORT_AUTOMATION_RUN_NOT_FOUND") {
    return "Automation run not found. Refresh the support queue and retry.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase10CustomizationSupportError {
  const appError =
    error instanceof KruxtAdminError
      ? error
      : new KruxtAdminError(
          "ADMIN_PHASE10_CUSTOMIZATION_SUPPORT_ACTION_FAILED",
          "Unable to complete customization/support action.",
          error
        );

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: !["ADMIN_AUTH_REQUIRED", "ADMIN_STAFF_ACCESS_DENIED"].includes(appError.code)
  };
}

function resolveSelectedTicketId(
  options: Phase10CustomizationSupportLoadOptions,
  tickets: SupportTicket[]
): string | undefined {
  if (options.selectedTicketId && tickets.some((ticket) => ticket.id === options.selectedTicketId)) {
    return options.selectedTicketId;
  }

  return tickets[0]?.id;
}

export function createPhase10CustomizationSupportFlow() {
  const supabase = createAdminSupabaseClient();
  const service = new CustomizationSupportService(supabase);

  const loadSnapshot = async (
    gymId: string,
    options: Phase10CustomizationSupportLoadOptions = {}
  ): Promise<Phase10CustomizationSupportSnapshot> => {
    const supportOptions: SupportTicketListOptions = {
      statuses: options.supportStatuses,
      includeClosed: options.includeResolvedSupportTickets,
      search: options.supportSearch
    };

    const [brandSettings, featureSettings, invoiceConnections, complianceProfile, invoiceDeliveryJobs, supportTickets] =
      await Promise.all([
        service.getGymBrandSettings(gymId),
        service.listGymFeatureSettings(gymId),
        service.listInvoiceProviderConnections(gymId),
        service.getInvoiceComplianceProfile(gymId),
        service.listInvoiceDeliveryJobs(gymId),
        service.listSupportTickets(gymId, supportOptions)
      ]);

    const selectedTicketId = resolveSelectedTicketId(options, supportTickets);
    const [selectedTicketMessages, selectedTicketAutomationRuns] = selectedTicketId
      ? await Promise.all([
          service.listSupportTicketMessages(gymId, selectedTicketId),
          service.listSupportAutomationRuns(gymId, selectedTicketId)
        ])
      : [[], []];

    return {
      brandSettings,
      featureSettings,
      invoiceConnections,
      complianceProfile,
      invoiceDeliveryJobs,
      supportTickets,
      selectedTicketId,
      selectedTicket: selectedTicketId ? supportTickets.find((ticket) => ticket.id === selectedTicketId) ?? null : null,
      selectedTicketMessages,
      selectedTicketAutomationRuns
    };
  };

  const runMutation = async (
    gymId: string,
    action: Phase10MutationSuccess["action"],
    mutate: () => Promise<Partial<Phase10MutationSuccess>>,
    options: Phase10CustomizationSupportLoadOptions = {}
  ): Promise<Phase10MutationResult> => {
    try {
      const payload = await mutate();
      const nextSelectedTicketId = payload.supportTicket?.id ?? options.selectedTicketId;
      const snapshot = await loadSnapshot(gymId, {
        ...options,
        selectedTicketId: nextSelectedTicketId
      });

      return {
        ok: true,
        action,
        snapshot,
        ...payload
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase10CustomizationSupportChecklist],
    load: async (
      gymId: string,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10LoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(gymId, options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    upsertBrandSettings: async (
      gymId: string,
      input: UpsertGymBrandSettingsInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "upsert_branding", async () => {
        const brandSettings = await service.upsertGymBrandSettings(gymId, input);
        return { brandSettings };
      }, options),
    upsertFeatureSetting: async (
      gymId: string,
      input: UpsertGymFeatureSettingInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "upsert_feature_setting", async () => {
        const featureSetting = await service.upsertGymFeatureSetting(gymId, input);
        return { featureSetting };
      }, options),
    removeFeatureSetting: async (
      gymId: string,
      featureKey: string,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "remove_feature_setting", async () => {
        await service.removeGymFeatureSetting(gymId, featureKey);
        return {};
      }, options),
    upsertInvoiceProviderConnection: async (
      gymId: string,
      input: UpsertInvoiceProviderConnectionInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "upsert_invoice_connection", async () => {
        const invoiceConnection = await service.upsertInvoiceProviderConnection(gymId, input);
        return { invoiceConnection };
      }, options),
    setDefaultInvoiceProviderConnection: async (
      gymId: string,
      connectionId: string,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "set_default_invoice_connection", async () => {
        const invoiceConnection = await service.setDefaultInvoiceProviderConnection(gymId, connectionId);
        return { invoiceConnection };
      }, options),
    upsertInvoiceComplianceProfile: async (
      gymId: string,
      input: UpsertInvoiceComplianceProfileInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "upsert_invoice_compliance", async () => {
        const complianceProfile = await service.upsertInvoiceComplianceProfile(gymId, input);
        return { complianceProfile };
      }, options),
    createInvoiceDeliveryJob: async (
      gymId: string,
      input: CreateInvoiceDeliveryJobInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "create_invoice_delivery_job", async () => {
        const invoiceDeliveryJob = await service.createInvoiceDeliveryJob(gymId, input);
        return { invoiceDeliveryJob };
      }, options),
    submitSupportTicket: async (
      gymId: string,
      input: SubmitSupportTicketInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "submit_support_ticket", async () => {
        const supportTicket = await service.submitSupportTicket(gymId, input);
        return { supportTicket };
      }, options),
    updateSupportTicket: async (
      gymId: string,
      ticketId: string,
      input: UpdateSupportTicketInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "update_support_ticket", async () => {
        const supportTicket = await service.updateSupportTicket(gymId, ticketId, input);
        return { supportTicket };
      }, { ...options, selectedTicketId: ticketId }),
    createSupportMessage: async (
      gymId: string,
      ticketId: string,
      input: CreateSupportTicketMessageInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "create_support_message", async () => {
        const supportMessage = await service.createSupportTicketMessage(gymId, ticketId, input);
        return { supportMessage };
      }, { ...options, selectedTicketId: ticketId }),
    createSupportAutomationRun: async (
      gymId: string,
      ticketId: string,
      input: CreateSupportAutomationRunInput,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "create_support_automation_run", async () => {
        const supportAutomationRun = await service.createSupportAutomationRun(gymId, ticketId, input);
        return { supportAutomationRun };
      }, { ...options, selectedTicketId: ticketId }),
    approveSupportAutomationRun: async (
      gymId: string,
      runId: string,
      approve: boolean,
      note?: string,
      selectedTicketId?: string,
      options: Phase10CustomizationSupportLoadOptions = {}
    ): Promise<Phase10MutationResult> =>
      runMutation(gymId, "approve_support_automation_run", async () => {
        const supportAutomationRun = await service.approveSupportAutomationRun(gymId, runId, approve, note);
        return { supportAutomationRun };
      }, { ...options, selectedTicketId })
  };
}
