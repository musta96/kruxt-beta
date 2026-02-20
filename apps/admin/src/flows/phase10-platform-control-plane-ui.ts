import {
  createPhase10PlatformControlPlaneFlow,
  phase10PlatformControlPlaneChecklist,
  type Phase10PlatformControlPlaneAction,
  type Phase10PlatformControlPlaneError,
  type Phase10PlatformControlPlaneMutationResult,
  type Phase10PlatformControlPlaneSnapshot
} from "./phase10-platform-control-plane";
import type { PlatformControlPlaneLoadOptions as Phase10PlatformControlPlaneLoadOptions } from "../services";

export type PlatformControlPlaneUiStep =
  | "overview"
  | "operator_access"
  | "support_access"
  | "feature_overrides"
  | "data_governance"
  | "growth_ops";

export interface PlatformControlPlaneAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  step: PlatformControlPlaneUiStep;
  title: string;
  detail: string;
}

export interface PlatformControlPlaneSummary {
  operatorCount: number;
  activeOperatorCount: number;
  supportGrantPendingCount: number;
  supportSessionActiveCount: number;
  openExportApprovalCount: number;
  addonActiveCount: number;
  addonAtRiskCount: number;
  partnerRevenuePendingCents: number;
  partnerRevenueRecognizedCents: number;
}

export interface Phase10PlatformControlPlaneUiSnapshot extends Phase10PlatformControlPlaneSnapshot {
  summary: PlatformControlPlaneSummary;
  alerts: PlatformControlPlaneAlert[];
}

export interface Phase10PlatformControlPlaneUiLoadSuccess {
  ok: true;
  snapshot: Phase10PlatformControlPlaneUiSnapshot;
}

export interface Phase10PlatformControlPlaneUiLoadFailure {
  ok: false;
  error: Phase10PlatformControlPlaneError;
}

export type Phase10PlatformControlPlaneUiLoadResult =
  | Phase10PlatformControlPlaneUiLoadSuccess
  | Phase10PlatformControlPlaneUiLoadFailure;

export interface Phase10PlatformControlPlaneUiMutationSuccess {
  ok: true;
  action: Phase10PlatformControlPlaneAction;
  snapshot: Phase10PlatformControlPlaneUiSnapshot;
}

export interface Phase10PlatformControlPlaneUiMutationFailure {
  ok: false;
  error: Phase10PlatformControlPlaneError;
}

export type Phase10PlatformControlPlaneUiMutationResult =
  | Phase10PlatformControlPlaneUiMutationSuccess
  | Phase10PlatformControlPlaneUiMutationFailure;

export const phase10PlatformControlPlaneUiChecklist = [
  ...phase10PlatformControlPlaneChecklist,
  "Promote critical governance signals (pending approvals, risky billing states, active support sessions)",
  "Render founder-ready summary cards for operator, support, revenue, and data release status"
] as const;

function sumByStatus(
  snapshot: Phase10PlatformControlPlaneSnapshot,
  status: "pending" | "recognized"
): number {
  return snapshot.partnerRevenueEvents
    .filter((event) => event.eventStatus === status)
    .reduce((total, event) => total + event.platformAmountCents, 0);
}

function buildAlerts(snapshot: Phase10PlatformControlPlaneSnapshot): PlatformControlPlaneAlert[] {
  const alerts: PlatformControlPlaneAlert[] = [];

  const pendingSupportGrants = snapshot.supportAccessGrants.filter((grant) => grant.status === "requested").length;
  if (pendingSupportGrants > 0) {
    alerts.push({
      id: "support-grants-pending",
      severity: pendingSupportGrants >= 5 ? "critical" : "warning",
      step: "support_access",
      title: "Pending support access approvals",
      detail: `${pendingSupportGrants} delegated support grants are waiting for approval.`
    });
  }

  const activeSessions = snapshot.supportAccessSessions.filter((session) => session.sessionStatus === "active").length;
  if (activeSessions > 0) {
    alerts.push({
      id: "support-sessions-active",
      severity: "info",
      step: "support_access",
      title: "Active support sessions",
      detail: `${activeSessions} delegated support sessions are currently active.`
    });
  }

  const unresolvedApprovals = snapshot.dataReleaseApprovals.filter((approval) => approval.status === "pending").length;
  if (unresolvedApprovals > 0) {
    alerts.push({
      id: "data-release-approvals-pending",
      severity: unresolvedApprovals >= 10 ? "critical" : "warning",
      step: "data_governance",
      title: "Pending data release approvals",
      detail: `${unresolvedApprovals} release approvals are still pending.`
    });
  }

  const atRiskAddons = snapshot.addonSubscriptions.filter((subscription) =>
    ["past_due", "paused"].includes(subscription.status)
  ).length;
  if (atRiskAddons > 0) {
    alerts.push({
      id: "addons-at-risk",
      severity: "warning",
      step: "growth_ops",
      title: "At-risk add-on subscriptions",
      detail: `${atRiskAddons} add-on subscriptions are paused or past due.`
    });
  }

  const failedAggregations = snapshot.dataAggregationJobs.filter((job) => job.jobStatus === "failed").length;
  if (failedAggregations > 0) {
    alerts.push({
      id: "aggregation-failures",
      severity: failedAggregations >= 3 ? "critical" : "warning",
      step: "growth_ops",
      title: "Failed data aggregation jobs",
      detail: `${failedAggregations} aggregation jobs failed and require review.`
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "control-plane-stable",
      severity: "info",
      step: "overview",
      title: "Control plane stable",
      detail: "No immediate governance blockers detected in this snapshot."
    });
  }

  return alerts;
}

function buildSummary(snapshot: Phase10PlatformControlPlaneSnapshot): PlatformControlPlaneSummary {
  const operatorCount = snapshot.operatorAccounts.length;
  const activeOperatorCount = snapshot.operatorAccounts.filter((operator) => operator.isActive).length;
  const supportGrantPendingCount = snapshot.supportAccessGrants.filter((grant) => grant.status === "requested").length;
  const supportSessionActiveCount = snapshot.supportAccessSessions.filter((session) => session.sessionStatus === "active").length;
  const openExportApprovalCount = snapshot.dataReleaseApprovals.filter((approval) => approval.status === "pending").length;
  const addonActiveCount = snapshot.addonSubscriptions.filter((subscription) => subscription.status === "active").length;
  const addonAtRiskCount = snapshot.addonSubscriptions.filter((subscription) =>
    ["past_due", "paused"].includes(subscription.status)
  ).length;

  return {
    operatorCount,
    activeOperatorCount,
    supportGrantPendingCount,
    supportSessionActiveCount,
    openExportApprovalCount,
    addonActiveCount,
    addonAtRiskCount,
    partnerRevenuePendingCents: sumByStatus(snapshot, "pending"),
    partnerRevenueRecognizedCents: sumByStatus(snapshot, "recognized")
  };
}

function mapUiSnapshot(snapshot: Phase10PlatformControlPlaneSnapshot): Phase10PlatformControlPlaneUiSnapshot {
  return {
    ...snapshot,
    summary: buildSummary(snapshot),
    alerts: buildAlerts(snapshot)
  };
}

function toUiMutationResult(
  result: Phase10PlatformControlPlaneMutationResult
): Phase10PlatformControlPlaneUiMutationResult {
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    action: result.action,
    snapshot: mapUiSnapshot(result.snapshot)
  };
}

export function createPhase10PlatformControlPlaneUiFlow() {
  const runtime = createPhase10PlatformControlPlaneFlow();

  return {
    checklist: [...phase10PlatformControlPlaneUiChecklist],
    load: async (options: Phase10PlatformControlPlaneLoadOptions = {}): Promise<Phase10PlatformControlPlaneUiLoadResult> => {
      const result = await runtime.load(options);
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        snapshot: mapUiSnapshot(result.snapshot)
      };
    },
    upsertOperatorAccount: async (...args: Parameters<typeof runtime.upsertOperatorAccount>) =>
      toUiMutationResult(await runtime.upsertOperatorAccount(...args)),
    upsertOperatorPermissionOverride: async (...args: Parameters<typeof runtime.upsertOperatorPermissionOverride>) =>
      toUiMutationResult(await runtime.upsertOperatorPermissionOverride(...args)),
    createSupportAccessGrant: async (...args: Parameters<typeof runtime.createSupportAccessGrant>) =>
      toUiMutationResult(await runtime.createSupportAccessGrant(...args)),
    updateSupportAccessGrant: async (...args: Parameters<typeof runtime.updateSupportAccessGrant>) =>
      toUiMutationResult(await runtime.updateSupportAccessGrant(...args)),
    createSupportAccessSession: async (...args: Parameters<typeof runtime.createSupportAccessSession>) =>
      toUiMutationResult(await runtime.createSupportAccessSession(...args)),
    updateSupportAccessSession: async (...args: Parameters<typeof runtime.updateSupportAccessSession>) =>
      toUiMutationResult(await runtime.updateSupportAccessSession(...args)),
    upsertFeatureOverride: async (...args: Parameters<typeof runtime.upsertFeatureOverride>) =>
      toUiMutationResult(await runtime.upsertFeatureOverride(...args)),
    createDataPartner: async (...args: Parameters<typeof runtime.createDataPartner>) =>
      toUiMutationResult(await runtime.createDataPartner(...args)),
    updateDataPartner: async (...args: Parameters<typeof runtime.updateDataPartner>) =>
      toUiMutationResult(await runtime.updateDataPartner(...args)),
    createDataProduct: async (...args: Parameters<typeof runtime.createDataProduct>) =>
      toUiMutationResult(await runtime.createDataProduct(...args)),
    updateDataProduct: async (...args: Parameters<typeof runtime.updateDataProduct>) =>
      toUiMutationResult(await runtime.updateDataProduct(...args)),
    upsertDataPartnerAccessGrant: async (...args: Parameters<typeof runtime.upsertDataPartnerAccessGrant>) =>
      toUiMutationResult(await runtime.upsertDataPartnerAccessGrant(...args)),
    createDataPartnerExport: async (...args: Parameters<typeof runtime.createDataPartnerExport>) =>
      toUiMutationResult(await runtime.createDataPartnerExport(...args)),
    updateDataPartnerExport: async (...args: Parameters<typeof runtime.updateDataPartnerExport>) =>
      toUiMutationResult(await runtime.updateDataPartnerExport(...args)),
    createAddonCatalogEntry: async (...args: Parameters<typeof runtime.createAddonCatalogEntry>) =>
      toUiMutationResult(await runtime.createAddonCatalogEntry(...args)),
    updateAddonCatalogEntry: async (...args: Parameters<typeof runtime.updateAddonCatalogEntry>) =>
      toUiMutationResult(await runtime.updateAddonCatalogEntry(...args)),
    upsertAddonSubscription: async (...args: Parameters<typeof runtime.upsertAddonSubscription>) =>
      toUiMutationResult(await runtime.upsertAddonSubscription(...args)),
    createAdvancedAnalyticsView: async (...args: Parameters<typeof runtime.createAdvancedAnalyticsView>) =>
      toUiMutationResult(await runtime.createAdvancedAnalyticsView(...args)),
    updateAdvancedAnalyticsView: async (...args: Parameters<typeof runtime.updateAdvancedAnalyticsView>) =>
      toUiMutationResult(await runtime.updateAdvancedAnalyticsView(...args)),
    createAutomationPlaybook: async (...args: Parameters<typeof runtime.createAutomationPlaybook>) =>
      toUiMutationResult(await runtime.createAutomationPlaybook(...args)),
    updateAutomationPlaybook: async (...args: Parameters<typeof runtime.updateAutomationPlaybook>) =>
      toUiMutationResult(await runtime.updateAutomationPlaybook(...args)),
    createAutomationRun: async (...args: Parameters<typeof runtime.createAutomationRun>) =>
      toUiMutationResult(await runtime.createAutomationRun(...args)),
    updateAutomationRun: async (...args: Parameters<typeof runtime.updateAutomationRun>) =>
      toUiMutationResult(await runtime.updateAutomationRun(...args)),
    createPartnerMarketplaceApp: async (...args: Parameters<typeof runtime.createPartnerMarketplaceApp>) =>
      toUiMutationResult(await runtime.createPartnerMarketplaceApp(...args)),
    updatePartnerMarketplaceApp: async (...args: Parameters<typeof runtime.updatePartnerMarketplaceApp>) =>
      toUiMutationResult(await runtime.updatePartnerMarketplaceApp(...args)),
    upsertPartnerAppInstall: async (...args: Parameters<typeof runtime.upsertPartnerAppInstall>) =>
      toUiMutationResult(await runtime.upsertPartnerAppInstall(...args)),
    createPartnerRevenueEvent: async (...args: Parameters<typeof runtime.createPartnerRevenueEvent>) =>
      toUiMutationResult(await runtime.createPartnerRevenueEvent(...args)),
    updatePartnerRevenueEvent: async (...args: Parameters<typeof runtime.updatePartnerRevenueEvent>) =>
      toUiMutationResult(await runtime.updatePartnerRevenueEvent(...args)),
    createDataAggregationJob: async (...args: Parameters<typeof runtime.createDataAggregationJob>) =>
      toUiMutationResult(await runtime.createDataAggregationJob(...args)),
    updateDataAggregationJob: async (...args: Parameters<typeof runtime.updateDataAggregationJob>) =>
      toUiMutationResult(await runtime.updateDataAggregationJob(...args)),
    upsertDataAnonymizationCheck: async (...args: Parameters<typeof runtime.upsertDataAnonymizationCheck>) =>
      toUiMutationResult(await runtime.upsertDataAnonymizationCheck(...args)),
    upsertDataReleaseApproval: async (...args: Parameters<typeof runtime.upsertDataReleaseApproval>) =>
      toUiMutationResult(await runtime.upsertDataReleaseApproval(...args))
  };
}
