import type { PrivacyRequest, SubmitPrivacyRequestInput } from "@kruxt/types";

import { createMobileSupabaseClient, PrivacyRequestService } from "../services";

export interface Phase8PrivacyRequestsSnapshot {
  openRequests: PrivacyRequest[];
  recentRequests: PrivacyRequest[];
  overdueOpenCount: number;
}

export const phase8PrivacyRequestsChecklist = [
  "Submit access/export/delete requests from profile settings",
  "Load request timeline with status and due date",
  "Highlight overdue open requests for support follow-up"
] as const;

export function createPhase8PrivacyRequestsFlow() {
  const supabase = createMobileSupabaseClient();
  const privacyRequests = new PrivacyRequestService(supabase);

  return {
    checklist: phase8PrivacyRequestsChecklist,
    load: async (userId: string): Promise<Phase8PrivacyRequestsSnapshot> => {
      const [openRequests, recentRequests] = await Promise.all([
        privacyRequests.listMine(userId, { openOnly: true, limit: 30 }),
        privacyRequests.listMine(userId, { limit: 80 })
      ]);

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
        overdueOpenCount
      };
    },
    submit: async (userId: string, input: SubmitPrivacyRequestInput): Promise<PrivacyRequest> =>
      privacyRequests.submit(userId, input)
  };
}
