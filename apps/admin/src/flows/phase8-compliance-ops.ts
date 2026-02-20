import type { PrivacyRequestStatus } from "@kruxt/types";
import {
  formatLegalTimestamp,
  type LegalTranslationKey,
  translateLegalText
} from "@kruxt/types";

import {
  createAdminSupabaseClient,
  GymAdminService,
  type OpenPrivacyRequest,
  type PrivacyOpsMetrics
} from "../services";

export type ComplianceSlaBadge = "breached" | "at_risk" | "on_track" | "no_due_date";
export type ComplianceSlaFilter = "all" | ComplianceSlaBadge;

export interface ComplianceQueueFilters {
  statuses?: Array<Extract<PrivacyRequestStatus, "submitted" | "triaged" | "in_progress">>;
  requestTypes?: OpenPrivacyRequest["type"][];
  sla?: ComplianceSlaFilter;
  userQuery?: string;
}

export interface LocalizedComplianceRequestTimelineItem {
  requestId: string;
  submittedAtLabel: string;
  dueAtLabel?: string | null;
  slaBreachedAtLabel?: string | null;
}

export interface ComplianceQueueItem extends OpenPrivacyRequest {
  slaBadge: ComplianceSlaBadge;
  hoursToDue?: number | null;
  submittedAtLabel: string;
  dueAtLabel?: string | null;
  slaBreachedAtLabel?: string | null;
}

export interface ComplianceRunbookAction {
  id: string;
  title: string;
  action: string;
  when: string;
  escalationTrigger?: string;
}

export interface Phase8ComplianceOpsSnapshot {
  queue: ComplianceQueueItem[];
  openRequests: OpenPrivacyRequest[];
  overdueRequests: OpenPrivacyRequest[];
  metrics: PrivacyOpsMetrics;
  localizedTimeline: LocalizedComplianceRequestTimelineItem[];
  filtersApplied: Required<ComplianceQueueFilters>;
  runbookPath: string;
  runbookActions: ComplianceRunbookAction[];
}

export interface Phase8ComplianceOpsFlowOptions {
  locale?: string | null;
  timeZone?: string | null;
  slaAtRiskHours?: number;
  metricsWindowDays?: number;
}

const PHASE8_COMPLIANCE_OPS_CHECKLIST_KEYS = [
  "legal.flow.admin.phase8.load_open_requests",
  "legal.flow.admin.phase8.load_queue_filters",
  "legal.flow.admin.phase8.highlight_overdue",
  "legal.flow.admin.phase8.show_sla_badges",
  "legal.flow.admin.phase8.load_privacy_metrics",
  "legal.flow.admin.phase8.transition_status_notes",
  "legal.flow.admin.phase8.open_runbook"
] as const satisfies readonly LegalTranslationKey[];

const OPEN_QUEUE_STATUSES = ["submitted", "triaged", "in_progress"] as const satisfies ReadonlyArray<
  Extract<PrivacyRequestStatus, "submitted" | "triaged" | "in_progress">
>;

const OPEN_QUEUE_REQUEST_TYPES = [
  "access",
  "export",
  "delete",
  "rectify",
  "restrict_processing"
] as const satisfies ReadonlyArray<OpenPrivacyRequest["type"]>;

const PHASE8_COMPLIANCE_RUNBOOK_PATH = "docs/compliance-ops-runbook.md";

export const phase8ComplianceOpsRunbookActions: readonly ComplianceRunbookAction[] = [
  {
    id: "triage-submitted",
    title: "Triage submitted requests",
    action: "Filter queue by `submitted`, review reason/context, move to `triaged` with notes.",
    when: "Run at least every 4 hours on staffed days."
  },
  {
    id: "start-fulfillment",
    title: "Move to in-progress",
    action: "When owner confirms execution, transition request to `in_progress` and attach operator notes.",
    when: "Immediately after assignment to avoid stale queue state."
  },
  {
    id: "complete-or-reject",
    title: "Fulfill or reject with evidence",
    action: "Complete request with fulfillment proof or reject with legal rationale in auditable notes.",
    when: "Before due date or SLA breach threshold."
  },
  {
    id: "escalate-sla-breach",
    title: "Escalate breached queue items",
    action: "Open security incident workflow and notify compliance owner via incident notifier path.",
    when: "Any request with `breached` SLA badge.",
    escalationTrigger: "SLA badge = breached OR due date passed with no transition."
  }
] as const;

export const phase8ComplianceOpsChecklistKeys = [...PHASE8_COMPLIANCE_OPS_CHECKLIST_KEYS] as const;

export const phase8ComplianceOpsChecklist = phase8ComplianceOpsChecklistKeys.map((key) =>
  translateLegalText(key)
);

function normalizeFilters(filters: ComplianceQueueFilters = {}): Required<ComplianceQueueFilters> {
  const requestedStatuses = filters.statuses ?? [];
  const requestedTypes = filters.requestTypes ?? [];
  const requestedSla =
    filters.sla && ["all", "breached", "at_risk", "on_track", "no_due_date"].includes(filters.sla)
      ? filters.sla
      : "all";

  return {
    statuses: requestedStatuses.length > 0 ? requestedStatuses : [...OPEN_QUEUE_STATUSES],
    requestTypes: requestedTypes.length > 0 ? requestedTypes : [...OPEN_QUEUE_REQUEST_TYPES],
    sla: requestedSla,
    userQuery: (filters.userQuery ?? "").trim().toLowerCase()
  };
}

function computeSlaBadge(
  request: OpenPrivacyRequest,
  nowMs: number,
  atRiskThresholdHours: number
): { badge: ComplianceSlaBadge; hoursToDue: number | null } {
  if (request.slaBreachedAt || request.isOverdue) {
    return { badge: "breached", hoursToDue: null };
  }

  if (!request.dueAt) {
    return { badge: "no_due_date", hoursToDue: null };
  }

  const dueMs = Date.parse(request.dueAt);
  if (!Number.isFinite(dueMs)) {
    return { badge: "no_due_date", hoursToDue: null };
  }

  const hoursToDue = (dueMs - nowMs) / 3_600_000;
  if (hoursToDue <= 0) {
    return { badge: "breached", hoursToDue };
  }

  if (hoursToDue <= atRiskThresholdHours) {
    return { badge: "at_risk", hoursToDue };
  }

  return { badge: "on_track", hoursToDue };
}

function queueMatchesFilters(item: ComplianceQueueItem, filters: Required<ComplianceQueueFilters>): boolean {
  if (!filters.statuses.includes(item.status)) {
    return false;
  }

  if (!filters.requestTypes.includes(item.type)) {
    return false;
  }

  if (filters.sla !== "all" && item.slaBadge !== filters.sla) {
    return false;
  }

  if (filters.userQuery && !item.userId.toLowerCase().includes(filters.userQuery)) {
    return false;
  }

  return true;
}

export function createPhase8ComplianceOpsFlow(options: Phase8ComplianceOpsFlowOptions = {}) {
  const supabase = createAdminSupabaseClient();
  const admin = new GymAdminService(supabase);
  const atRiskThresholdHours = Math.max(1, Math.min(options.slaAtRiskHours ?? 24, 168));
  const metricsWindowDays = Math.max(1, Math.min(options.metricsWindowDays ?? 30, 365));
  const fallbackTimestamp = translateLegalText("legal.timestamp.not_available", {
    locale: options.locale
  });
  const checklist = phase8ComplianceOpsChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  const loadSnapshot = async (
    gymId: string,
    filters: ComplianceQueueFilters = {}
  ): Promise<Phase8ComplianceOpsSnapshot> => {
    const normalizedFilters = normalizeFilters(filters);
    const [openRequests, metrics] = await Promise.all([
      admin.listOpenPrivacyRequests(gymId),
      admin.getPrivacyOpsMetrics(gymId, metricsWindowDays)
    ]);
    const nowMs = Date.now();
    const overdueRequests = openRequests.filter((request) => request.isOverdue || Boolean(request.slaBreachedAt));
    const queue = openRequests
      .map((request) => {
        const { badge, hoursToDue } = computeSlaBadge(request, nowMs, atRiskThresholdHours);
        const item = {
          ...request,
          slaBadge: badge,
          hoursToDue,
          submittedAtLabel:
            formatLegalTimestamp(request.submittedAt, {
              locale: options.locale,
              timeZone: options.timeZone
            }) ?? fallbackTimestamp,
          dueAtLabel: request.dueAt
            ? formatLegalTimestamp(request.dueAt, {
                locale: options.locale,
                timeZone: options.timeZone
              }) ?? fallbackTimestamp
            : null,
          slaBreachedAtLabel: request.slaBreachedAt
            ? formatLegalTimestamp(request.slaBreachedAt, {
                locale: options.locale,
                timeZone: options.timeZone
              }) ?? fallbackTimestamp
            : null
        } satisfies ComplianceQueueItem;

        return item;
      })
      .filter((item) => queueMatchesFilters(item, normalizedFilters));

    const localizedTimeline = openRequests.map((request) => ({
      requestId: request.id,
      submittedAtLabel:
        formatLegalTimestamp(request.submittedAt, {
          locale: options.locale,
          timeZone: options.timeZone
        }) ?? fallbackTimestamp,
      dueAtLabel: request.dueAt
        ? formatLegalTimestamp(request.dueAt, {
            locale: options.locale,
            timeZone: options.timeZone
          }) ?? fallbackTimestamp
        : null,
      slaBreachedAtLabel: request.slaBreachedAt
        ? formatLegalTimestamp(request.slaBreachedAt, {
            locale: options.locale,
            timeZone: options.timeZone
          }) ?? fallbackTimestamp
        : null
    }));

    return {
      queue,
      openRequests,
      overdueRequests,
      metrics,
      localizedTimeline,
      filtersApplied: normalizedFilters,
      runbookPath: PHASE8_COMPLIANCE_RUNBOOK_PATH,
      runbookActions: [...phase8ComplianceOpsRunbookActions]
    };
  };

  return {
    checklist,
    checklistKeys: phase8ComplianceOpsChecklistKeys,
    runbookPath: PHASE8_COMPLIANCE_RUNBOOK_PATH,
    runbookActions: [...phase8ComplianceOpsRunbookActions],
    load: loadSnapshot,
    transition: async (
      gymId: string,
      requestId: string,
      nextStatus: Extract<PrivacyRequestStatus, "triaged" | "in_progress" | "fulfilled" | "rejected">,
      notes?: string,
      filters: ComplianceQueueFilters = {}
    ): Promise<Phase8ComplianceOpsSnapshot> => {
      await admin.transitionPrivacyRequest(gymId, requestId, nextStatus, notes);
      return loadSnapshot(gymId, filters);
    }
  };
}
