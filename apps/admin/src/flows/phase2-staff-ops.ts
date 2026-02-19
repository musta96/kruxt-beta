import type { GymMembership, GymOpsSummary } from "@kruxt/types";

import {
  createAdminSupabaseClient,
  GymAdminService,
  type GymClassScheduleItem,
  type OpenPrivacyRequest,
  type PendingWaitlistEntry
} from "../services";

export interface Phase2StaffOpsSnapshot {
  summary: GymOpsSummary;
  pendingMemberships: GymMembership[];
  upcomingClasses: GymClassScheduleItem[];
  pendingWaitlist: PendingWaitlistEntry[];
  openPrivacyRequests: OpenPrivacyRequest[];
}

export const phase2StaffOpsChecklist = [
  "Validate staff role",
  "Load gym ops summary",
  "Load pending memberships",
  "Load pending waitlist",
  "Load privacy triage queue"
] as const;

export function createPhase2StaffOpsFlow() {
  const supabase = createAdminSupabaseClient();
  const service = new GymAdminService(supabase);

  return {
    checklist: phase2StaffOpsChecklist,
    load: async (gymId: string): Promise<Phase2StaffOpsSnapshot> => {
      const [summary, pendingMemberships, upcomingClasses, pendingWaitlist, openPrivacyRequests] =
        await Promise.all([
          service.getGymOpsSummary(gymId),
          service.listPendingMemberships(gymId),
          service.listUpcomingClasses(gymId, 20),
          service.listPendingWaitlistEntries(gymId, 50),
          service.listOpenPrivacyRequests(gymId)
        ]);

      return {
        summary,
        pendingMemberships,
        upcomingClasses,
        pendingWaitlist,
        openPrivacyRequests
      };
    }
  };
}
