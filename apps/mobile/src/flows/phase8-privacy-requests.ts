import type { PrivacyRequest, SubmitPrivacyRequestInput } from "@kruxt/types";
import {
  formatLegalTimestamp,
  type LegalTranslationKey,
  translateLegalText
} from "@kruxt/types";

import { createMobileSupabaseClient, PrivacyRequestService } from "../services";

export interface LocalizedPrivacyRequestTimelineItem {
  requestId: string;
  submittedAtLabel: string;
  dueAtLabel?: string | null;
  resolvedAtLabel?: string | null;
  responseExpiresAtLabel?: string | null;
}

export interface Phase8PrivacyRequestsSnapshot {
  openRequests: PrivacyRequest[];
  recentRequests: PrivacyRequest[];
  downloadableExports: PrivacyRequest[];
  localizedTimeline: LocalizedPrivacyRequestTimelineItem[];
  overdueOpenCount: number;
}

const PHASE8_PRIVACY_REQUESTS_CHECKLIST_KEYS = [
  "legal.flow.phase8.submit_requests",
  "legal.flow.phase8.load_request_timeline",
  "legal.flow.phase8.load_export_receipts",
  "legal.flow.phase8.highlight_overdue_requests"
] as const satisfies readonly LegalTranslationKey[];

export const phase8PrivacyRequestsChecklistKeys = [...PHASE8_PRIVACY_REQUESTS_CHECKLIST_KEYS] as const;

export const phase8PrivacyRequestsChecklist = phase8PrivacyRequestsChecklistKeys.map((key) =>
  translateLegalText(key)
);

export function createPhase8PrivacyRequestsFlow(options: { locale?: string | null; timeZone?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const privacyRequests = new PrivacyRequestService(supabase);
  const fallbackTimestamp = translateLegalText("legal.timestamp.not_available", {
    locale: options.locale
  });
  const checklist = phase8PrivacyRequestsChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  const toLocalizedTimelineItem = (
    request: PrivacyRequest
  ): LocalizedPrivacyRequestTimelineItem => ({
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
    resolvedAtLabel: request.resolvedAt
      ? formatLegalTimestamp(request.resolvedAt, {
          locale: options.locale,
          timeZone: options.timeZone
        }) ?? fallbackTimestamp
      : null,
    responseExpiresAtLabel: request.responseExpiresAt
      ? formatLegalTimestamp(request.responseExpiresAt, {
          locale: options.locale,
          timeZone: options.timeZone
        }) ?? fallbackTimestamp
      : null
  });

  return {
    checklist,
    checklistKeys: phase8PrivacyRequestsChecklistKeys,
    load: async (userId: string): Promise<Phase8PrivacyRequestsSnapshot> => {
      const [openRequests, recentRequests, downloadableExports] = await Promise.all([
        privacyRequests.listMine(userId, { openOnly: true, limit: 30 }),
        privacyRequests.listMine(userId, { limit: 80 }),
        privacyRequests.listDownloadableExports(userId, 12)
      ]);
      const localizedTimeline = recentRequests.map(toLocalizedTimelineItem);

      const now = Date.now();
      const overdueOpenCount = openRequests.filter((request) => {
        if (request.slaBreachedAt) {
          return true;
        }

        return Number.isFinite(Date.parse(request.dueAt)) && Date.parse(request.dueAt) < now;
      }).length;

      return {
        openRequests,
        recentRequests,
        downloadableExports,
        localizedTimeline,
        overdueOpenCount
      };
    },
    submit: async (userId: string, input: SubmitPrivacyRequestInput): Promise<PrivacyRequest> =>
      privacyRequests.submit(userId, input)
  };
}
