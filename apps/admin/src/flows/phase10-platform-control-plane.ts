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
  UpdateGymAddonCatalogInput,
  UpdateGymAdvancedAnalyticsViewInput,
  UpdateGymAutomationPlaybookInput,
  UpdateGymAutomationRunInput,
  UpdateGymSupportAccessGrantInput,
  UpdateGymSupportAccessSessionInput,
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

import {
  createAdminSupabaseClient,
  KruxtAdminError,
  PlatformControlPlaneService,
  type PlatformControlPlaneLoadOptions
} from "../services";

export type Phase10PlatformControlPlaneStep =
  | "overview"
  | "operators"
  | "support_access"
  | "feature_overrides"
  | "data_governance"
  | "addons"
  | "partner_ecosystem"
  | "data_ops";

export interface Phase10PlatformControlPlaneError {
  code: string;
  step: Phase10PlatformControlPlaneStep;
  message: string;
  recoverable: boolean;
}

export interface Phase10PlatformControlPlaneSnapshot {
  overview: Record<string, unknown>;
  kpiSnapshots: PlatformKpiDailySnapshot[];
  operatorAccounts: PlatformOperatorAccount[];
  operatorPermissionOverrides: PlatformOperatorPermissionOverride[];
  supportAccessGrants: GymSupportAccessGrant[];
  supportAccessSessions: GymSupportAccessSession[];
  featureOverrides: PlatformFeatureOverride[];
  dataSharingPreferences: UserDataSharingPreference[];
  dataPartners: DataPartner[];
  dataProducts: DataProduct[];
  dataPartnerAccessGrants: DataPartnerAccessGrant[];
  dataPartnerExports: DataPartnerExport[];
  addonCatalog: GymAddonCatalogEntry[];
  addonSubscriptions: GymAddonSubscription[];
  advancedAnalyticsViews: GymAdvancedAnalyticsView[];
  automationPlaybooks: GymAutomationPlaybook[];
  automationRuns: GymAutomationRun[];
  partnerMarketplaceApps: PartnerMarketplaceApp[];
  partnerAppInstalls: GymPartnerAppInstall[];
  partnerRevenueEvents: PartnerRevenueEvent[];
  dataAggregationJobs: DataAggregationJob[];
  dataAnonymizationChecks: DataAnonymizationCheck[];
  dataReleaseApprovals: DataReleaseApproval[];
}

export type Phase10PlatformControlPlaneAction =
  | "upsert_operator_account"
  | "upsert_operator_permission_override"
  | "create_support_access_grant"
  | "update_support_access_grant"
  | "create_support_access_session"
  | "update_support_access_session"
  | "upsert_feature_override"
  | "create_data_partner"
  | "update_data_partner"
  | "create_data_product"
  | "update_data_product"
  | "upsert_data_partner_access_grant"
  | "create_data_partner_export"
  | "update_data_partner_export"
  | "create_addon_catalog_entry"
  | "update_addon_catalog_entry"
  | "upsert_addon_subscription"
  | "create_advanced_analytics_view"
  | "update_advanced_analytics_view"
  | "create_automation_playbook"
  | "update_automation_playbook"
  | "create_automation_run"
  | "update_automation_run"
  | "create_partner_marketplace_app"
  | "update_partner_marketplace_app"
  | "upsert_partner_app_install"
  | "create_partner_revenue_event"
  | "update_partner_revenue_event"
  | "create_data_aggregation_job"
  | "update_data_aggregation_job"
  | "upsert_data_anonymization_check"
  | "upsert_data_release_approval";

export interface Phase10PlatformControlPlaneLoadSuccess {
  ok: true;
  snapshot: Phase10PlatformControlPlaneSnapshot;
}

export interface Phase10PlatformControlPlaneLoadFailure {
  ok: false;
  error: Phase10PlatformControlPlaneError;
}

export type Phase10PlatformControlPlaneLoadResult =
  | Phase10PlatformControlPlaneLoadSuccess
  | Phase10PlatformControlPlaneLoadFailure;

export interface Phase10PlatformControlPlaneMutationSuccess {
  ok: true;
  action: Phase10PlatformControlPlaneAction;
  snapshot: Phase10PlatformControlPlaneSnapshot;
  operatorAccount?: PlatformOperatorAccount;
  operatorPermissionOverride?: PlatformOperatorPermissionOverride;
  supportAccessGrant?: GymSupportAccessGrant;
  supportAccessSession?: GymSupportAccessSession;
  featureOverride?: PlatformFeatureOverride;
  dataPartner?: DataPartner;
  dataProduct?: DataProduct;
  dataPartnerAccessGrant?: DataPartnerAccessGrant;
  dataPartnerExport?: DataPartnerExport;
  addonCatalogEntry?: GymAddonCatalogEntry;
  addonSubscription?: GymAddonSubscription;
  advancedAnalyticsView?: GymAdvancedAnalyticsView;
  automationPlaybook?: GymAutomationPlaybook;
  automationRun?: GymAutomationRun;
  partnerMarketplaceApp?: PartnerMarketplaceApp;
  partnerAppInstall?: GymPartnerAppInstall;
  partnerRevenueEvent?: PartnerRevenueEvent;
  dataAggregationJob?: DataAggregationJob;
  dataAnonymizationCheck?: DataAnonymizationCheck;
  dataReleaseApproval?: DataReleaseApproval;
}

export interface Phase10PlatformControlPlaneMutationFailure {
  ok: false;
  error: Phase10PlatformControlPlaneError;
}

export type Phase10PlatformControlPlaneMutationResult =
  | Phase10PlatformControlPlaneMutationSuccess
  | Phase10PlatformControlPlaneMutationFailure;

export const phase10PlatformControlPlaneChecklist = [
  "Load founder overview, operator controls, and delegated support access state",
  "Load platform feature overrides and governed data partner controls",
  "Load add-on subscriptions, partner revenue streams, and data ops approvals",
  "Execute high-sensitivity mutations with refresh-safe snapshots and recoverable errors"
] as const;

function mapErrorStep(code: string): Phase10PlatformControlPlaneStep {
  if (code.includes("OVERVIEW") || code.includes("KPI")) {
    return "overview";
  }

  if (code.includes("OPERATOR")) {
    return "operators";
  }

  if (code.includes("SUPPORT_ACCESS")) {
    return "support_access";
  }

  if (code.includes("FEATURE_OVERRIDE")) {
    return "feature_overrides";
  }

  if (code.includes("DATA_PARTNER") || code.includes("DATA_PRODUCT") || code.includes("DATA_SHARING")) {
    return "data_governance";
  }

  if (code.includes("ADDON") || code.includes("ANALYTICS_VIEW") || code.includes("AUTOMATION")) {
    return "addons";
  }

  if (code.includes("PARTNER_MARKETPLACE") || code.includes("PARTNER_APP_INSTALL") || code.includes("PARTNER_REVENUE")) {
    return "partner_ecosystem";
  }

  if (code.includes("AGGREGATION") || code.includes("ANONYMIZATION") || code.includes("RELEASE_APPROVAL")) {
    return "data_ops";
  }

  return "overview";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "ADMIN_AUTH_REQUIRED") {
    return "Sign in is required before using platform control plane actions.";
  }

  if (code === "ADMIN_STAFF_ACCESS_DENIED") {
    return "Gym staff access is required for the selected gym scope.";
  }

  if (code === "ADMIN_PLATFORM_OVERVIEW_READ_FAILED") {
    return "Platform overview is unavailable right now. Retry after refresh.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase10PlatformControlPlaneError {
  const appError =
    error instanceof KruxtAdminError
      ? error
      : new KruxtAdminError(
          "ADMIN_PHASE10_PLATFORM_CONTROL_PLANE_ACTION_FAILED",
          "Unable to complete platform control plane action.",
          error
        );

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: !["ADMIN_AUTH_REQUIRED"].includes(appError.code)
  };
}

export function createPhase10PlatformControlPlaneFlow() {
  const supabase = createAdminSupabaseClient();
  const service = new PlatformControlPlaneService(supabase);

  const loadSnapshot = async (
    options: PlatformControlPlaneLoadOptions = {}
  ): Promise<Phase10PlatformControlPlaneSnapshot> => {
    const [
      overview,
      kpiSnapshots,
      operatorAccounts,
      operatorPermissionOverrides,
      supportAccessGrants,
      supportAccessSessions,
      featureOverrides,
      dataSharingPreferences,
      dataPartners,
      dataProducts,
      dataPartnerAccessGrants,
      dataPartnerExports,
      addonCatalog,
      addonSubscriptions,
      partnerMarketplaceApps,
      partnerAppInstalls,
      partnerRevenueEvents,
      dataAggregationJobs,
      dataAnonymizationChecks,
      dataReleaseApprovals
    ] = await Promise.all([
      service.getPlatformAdminOverview(),
      service.listPlatformKpiDailySnapshots(options.limit),
      service.listPlatformOperatorAccounts(options.limit),
      service.listPlatformOperatorPermissionOverrides(undefined, options.limit),
      service.listSupportAccessGrants(options),
      service.listSupportAccessSessions(options),
      service.listPlatformFeatureOverrides(options.limit),
      service.listUserDataSharingPreferences(options.limit),
      service.listDataPartners(options.limit),
      service.listDataProducts(options.limit),
      service.listDataPartnerAccessGrants(options),
      service.listDataPartnerExports(options),
      service.listGymAddonCatalog(options.limit),
      service.listGymAddonSubscriptions(options),
      service.listPartnerMarketplaceApps(options.limit),
      service.listGymPartnerAppInstalls(options),
      service.listPartnerRevenueEvents(options),
      service.listDataAggregationJobs(options),
      service.listDataAnonymizationChecks(options),
      service.listDataReleaseApprovals(options)
    ]);

    const [advancedAnalyticsViews, automationPlaybooks, automationRuns] = options.gymId
      ? await Promise.all([
          service.listGymAdvancedAnalyticsViews(options.gymId, options.limit),
          service.listGymAutomationPlaybooks(options.gymId, options.limit),
          service.listGymAutomationRuns(options.gymId, options.limit)
        ])
      : [[], [], []];

    return {
      overview,
      kpiSnapshots,
      operatorAccounts,
      operatorPermissionOverrides,
      supportAccessGrants,
      supportAccessSessions,
      featureOverrides,
      dataSharingPreferences,
      dataPartners,
      dataProducts,
      dataPartnerAccessGrants,
      dataPartnerExports,
      addonCatalog,
      addonSubscriptions,
      advancedAnalyticsViews,
      automationPlaybooks,
      automationRuns,
      partnerMarketplaceApps,
      partnerAppInstalls,
      partnerRevenueEvents,
      dataAggregationJobs,
      dataAnonymizationChecks,
      dataReleaseApprovals
    };
  };

  const runMutation = async (
    action: Phase10PlatformControlPlaneAction,
    mutate: () => Promise<Partial<Phase10PlatformControlPlaneMutationSuccess>>,
    options: PlatformControlPlaneLoadOptions = {}
  ): Promise<Phase10PlatformControlPlaneMutationResult> => {
    try {
      const payload = await mutate();
      const snapshot = await loadSnapshot(options);

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
    checklist: [...phase10PlatformControlPlaneChecklist],
    load: async (options: PlatformControlPlaneLoadOptions = {}): Promise<Phase10PlatformControlPlaneLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    upsertOperatorAccount: async (
      input: UpsertPlatformOperatorAccountInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_operator_account",
        async () => {
          const operatorAccount = await service.upsertPlatformOperatorAccount(input);
          return { operatorAccount };
        },
        options
      ),
    upsertOperatorPermissionOverride: async (
      input: UpsertPlatformOperatorPermissionOverrideInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_operator_permission_override",
        async () => {
          const operatorPermissionOverride = await service.upsertPlatformOperatorPermissionOverride(input);
          return { operatorPermissionOverride };
        },
        options
      ),
    createSupportAccessGrant: async (
      input: CreateGymSupportAccessGrantInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_support_access_grant",
        async () => {
          const supportAccessGrant = await service.createSupportAccessGrant(input);
          return { supportAccessGrant };
        },
        { ...options, gymId: input.gymId }
      ),
    updateSupportAccessGrant: async (
      grantId: string,
      input: UpdateGymSupportAccessGrantInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_support_access_grant",
        async () => {
          const supportAccessGrant = await service.updateSupportAccessGrant(grantId, input);
          return { supportAccessGrant };
        },
        options
      ),
    createSupportAccessSession: async (
      input: CreateGymSupportAccessSessionInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_support_access_session",
        async () => {
          const supportAccessSession = await service.createSupportAccessSession(input);
          return { supportAccessSession };
        },
        { ...options, gymId: input.gymId }
      ),
    updateSupportAccessSession: async (
      sessionId: string,
      input: UpdateGymSupportAccessSessionInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_support_access_session",
        async () => {
          const supportAccessSession = await service.updateSupportAccessSession(sessionId, input);
          return { supportAccessSession };
        },
        options
      ),
    upsertFeatureOverride: async (
      input: UpsertPlatformFeatureOverrideInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_feature_override",
        async () => {
          const featureOverride = await service.upsertPlatformFeatureOverride(input);
          return { featureOverride };
        },
        options
      ),
    createDataPartner: async (
      input: CreateDataPartnerInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_data_partner",
        async () => {
          const dataPartner = await service.createDataPartner(input);
          return { dataPartner };
        },
        options
      ),
    updateDataPartner: async (
      partnerId: string,
      input: UpdateDataPartnerInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_data_partner",
        async () => {
          const dataPartner = await service.updateDataPartner(partnerId, input);
          return { dataPartner };
        },
        { ...options, partnerId }
      ),
    createDataProduct: async (
      input: CreateDataProductInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_data_product",
        async () => {
          const dataProduct = await service.createDataProduct(input);
          return { dataProduct };
        },
        options
      ),
    updateDataProduct: async (
      productId: string,
      input: UpdateDataProductInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_data_product",
        async () => {
          const dataProduct = await service.updateDataProduct(productId, input);
          return { dataProduct };
        },
        { ...options, productId }
      ),
    upsertDataPartnerAccessGrant: async (
      input: UpsertDataPartnerAccessGrantInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_data_partner_access_grant",
        async () => {
          const dataPartnerAccessGrant = await service.upsertDataPartnerAccessGrant(input);
          return { dataPartnerAccessGrant };
        },
        {
          ...options,
          partnerId: input.partnerId,
          productId: input.productId
        }
      ),
    createDataPartnerExport: async (
      input: CreateDataPartnerExportInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_data_partner_export",
        async () => {
          const dataPartnerExport = await service.createDataPartnerExport(input);
          return { dataPartnerExport };
        },
        {
          ...options,
          partnerId: input.partnerId,
          productId: input.productId
        }
      ),
    updateDataPartnerExport: async (
      exportId: string,
      input: UpdateDataPartnerExportInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_data_partner_export",
        async () => {
          const dataPartnerExport = await service.updateDataPartnerExport(exportId, input);
          return { dataPartnerExport };
        },
        {
          ...options,
          exportId
        }
      ),
    createAddonCatalogEntry: async (
      input: CreateGymAddonCatalogInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_addon_catalog_entry",
        async () => {
          const addonCatalogEntry = await service.createGymAddonCatalogEntry(input);
          return { addonCatalogEntry };
        },
        options
      ),
    updateAddonCatalogEntry: async (
      addonId: string,
      input: UpdateGymAddonCatalogInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_addon_catalog_entry",
        async () => {
          const addonCatalogEntry = await service.updateGymAddonCatalogEntry(addonId, input);
          return { addonCatalogEntry };
        },
        options
      ),
    upsertAddonSubscription: async (
      gymId: string,
      input: UpsertGymAddonSubscriptionInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_addon_subscription",
        async () => {
          const addonSubscription = await service.upsertGymAddonSubscription(gymId, input);
          return { addonSubscription };
        },
        { ...options, gymId }
      ),
    createAdvancedAnalyticsView: async (
      gymId: string,
      input: CreateGymAdvancedAnalyticsViewInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_advanced_analytics_view",
        async () => {
          const advancedAnalyticsView = await service.createGymAdvancedAnalyticsView(gymId, input);
          return { advancedAnalyticsView };
        },
        { ...options, gymId }
      ),
    updateAdvancedAnalyticsView: async (
      gymId: string,
      viewId: string,
      input: UpdateGymAdvancedAnalyticsViewInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_advanced_analytics_view",
        async () => {
          const advancedAnalyticsView = await service.updateGymAdvancedAnalyticsView(gymId, viewId, input);
          return { advancedAnalyticsView };
        },
        { ...options, gymId }
      ),
    createAutomationPlaybook: async (
      gymId: string,
      input: CreateGymAutomationPlaybookInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_automation_playbook",
        async () => {
          const automationPlaybook = await service.createGymAutomationPlaybook(gymId, input);
          return { automationPlaybook };
        },
        { ...options, gymId }
      ),
    updateAutomationPlaybook: async (
      gymId: string,
      playbookId: string,
      input: UpdateGymAutomationPlaybookInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_automation_playbook",
        async () => {
          const automationPlaybook = await service.updateGymAutomationPlaybook(gymId, playbookId, input);
          return { automationPlaybook };
        },
        { ...options, gymId }
      ),
    createAutomationRun: async (
      gymId: string,
      input: CreateGymAutomationRunInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_automation_run",
        async () => {
          const automationRun = await service.createGymAutomationRun(gymId, input);
          return { automationRun };
        },
        { ...options, gymId }
      ),
    updateAutomationRun: async (
      gymId: string,
      runId: string,
      input: UpdateGymAutomationRunInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_automation_run",
        async () => {
          const automationRun = await service.updateGymAutomationRun(gymId, runId, input);
          return { automationRun };
        },
        { ...options, gymId }
      ),
    createPartnerMarketplaceApp: async (
      input: CreatePartnerMarketplaceAppInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_partner_marketplace_app",
        async () => {
          const partnerMarketplaceApp = await service.createPartnerMarketplaceApp(input);
          return { partnerMarketplaceApp };
        },
        options
      ),
    updatePartnerMarketplaceApp: async (
      appId: string,
      input: UpdatePartnerMarketplaceAppInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_partner_marketplace_app",
        async () => {
          const partnerMarketplaceApp = await service.updatePartnerMarketplaceApp(appId, input);
          return { partnerMarketplaceApp };
        },
        options
      ),
    upsertPartnerAppInstall: async (
      gymId: string,
      input: UpsertGymPartnerAppInstallInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_partner_app_install",
        async () => {
          const partnerAppInstall = await service.upsertGymPartnerAppInstall(gymId, input);
          return { partnerAppInstall };
        },
        { ...options, gymId }
      ),
    createPartnerRevenueEvent: async (
      input: CreatePartnerRevenueEventInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_partner_revenue_event",
        async () => {
          const partnerRevenueEvent = await service.createPartnerRevenueEvent(input);
          return { partnerRevenueEvent };
        },
        {
          ...options,
          gymId: input.gymId ?? options.gymId,
          partnerId: input.partnerId
        }
      ),
    updatePartnerRevenueEvent: async (
      eventId: string,
      input: UpdatePartnerRevenueEventInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_partner_revenue_event",
        async () => {
          const partnerRevenueEvent = await service.updatePartnerRevenueEvent(eventId, input);
          return { partnerRevenueEvent };
        },
        options
      ),
    createDataAggregationJob: async (
      input: CreateDataAggregationJobInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "create_data_aggregation_job",
        async () => {
          const dataAggregationJob = await service.createDataAggregationJob(input);
          return { dataAggregationJob };
        },
        {
          ...options,
          productId: input.productId
        }
      ),
    updateDataAggregationJob: async (
      jobId: string,
      input: UpdateDataAggregationJobInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "update_data_aggregation_job",
        async () => {
          const dataAggregationJob = await service.updateDataAggregationJob(jobId, input);
          return { dataAggregationJob };
        },
        {
          ...options,
          productId: input.productId ?? options.productId
        }
      ),
    upsertDataAnonymizationCheck: async (
      input: UpsertDataAnonymizationCheckInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_data_anonymization_check",
        async () => {
          const dataAnonymizationCheck = await service.upsertDataAnonymizationCheck(input);
          return { dataAnonymizationCheck };
        },
        options
      ),
    upsertDataReleaseApproval: async (
      input: UpsertDataReleaseApprovalInput,
      options: PlatformControlPlaneLoadOptions = {}
    ): Promise<Phase10PlatformControlPlaneMutationResult> =>
      runMutation(
        "upsert_data_release_approval",
        async () => {
          const dataReleaseApproval = await service.upsertDataReleaseApproval(input);
          return { dataReleaseApproval };
        },
        {
          ...options,
          exportId: input.exportId
        }
      )
  };
}
