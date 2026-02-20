import type { PrivacyRequestStatus } from "@kruxt/types";
import {
  formatLegalTimestamp,
  type LegalTranslationKey,
  translateLegalText
} from "@kruxt/types";

import { createAdminSupabaseClient, GymAdminService, type OpenPrivacyRequest } from "../services";

export interface LocalizedComplianceRequestTimelineItem {
  requestId: string;
  submittedAtLabel: string;
  dueAtLabel?: string | null;
  slaBreachedAtLabel?: string | null;
}

export interface Phase8ComplianceOpsSnapshot {
  openRequests: OpenPrivacyRequest[];
  overdueRequests: OpenPrivacyRequest[];
  localizedTimeline: LocalizedComplianceRequestTimelineItem[];
}

const PHASE8_COMPLIANCE_OPS_CHECKLIST_KEYS = [
  "legal.flow.admin.phase8.load_open_requests",
  "legal.flow.admin.phase8.highlight_overdue",
  "legal.flow.admin.phase8.transition_status_notes"
] as const satisfies readonly LegalTranslationKey[];

export const phase8ComplianceOpsChecklistKeys = [...PHASE8_COMPLIANCE_OPS_CHECKLIST_KEYS] as const;

export const phase8ComplianceOpsChecklist = phase8ComplianceOpsChecklistKeys.map((key) =>
  translateLegalText(key)
);

export function createPhase8ComplianceOpsFlow(options: {
  locale?: string | null;
  timeZone?: string | null;
} = {}) {
  const supabase = createAdminSupabaseClient();
  const admin = new GymAdminService(supabase);
  const fallbackTimestamp = translateLegalText("legal.timestamp.not_available", {
    locale: options.locale
  });
  const checklist = phase8ComplianceOpsChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  const loadSnapshot = async (gymId: string): Promise<Phase8ComplianceOpsSnapshot> => {
    const openRequests = await admin.listOpenPrivacyRequests(gymId);
    const overdueRequests = openRequests.filter((request) => request.isOverdue || Boolean(request.slaBreachedAt));
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
      openRequests,
      overdueRequests,
      localizedTimeline
    };
  };

  return {
    checklist,
    checklistKeys: phase8ComplianceOpsChecklistKeys,
    load: loadSnapshot,
    transition: async (
      gymId: string,
      requestId: string,
      nextStatus: Extract<PrivacyRequestStatus, "triaged" | "in_progress" | "fulfilled" | "rejected">,
      notes?: string
    ): Promise<Phase8ComplianceOpsSnapshot> => {
      await admin.transitionPrivacyRequest(gymId, requestId, nextStatus, notes);
      return loadSnapshot(gymId);
    }
  };
}
