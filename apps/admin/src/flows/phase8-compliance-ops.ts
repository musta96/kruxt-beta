import type { PrivacyRequestStatus } from "@kruxt/types";

import { createAdminSupabaseClient, GymAdminService, type OpenPrivacyRequest } from "../services";

export interface Phase8ComplianceOpsSnapshot {
  openRequests: OpenPrivacyRequest[];
  overdueRequests: OpenPrivacyRequest[];
}

export const phase8ComplianceOpsChecklist = [
  "Load open privacy requests for gym members",
  "Highlight overdue and SLA-breached requests",
  "Transition request status with auditable notes"
] as const;

export function createPhase8ComplianceOpsFlow() {
  const supabase = createAdminSupabaseClient();
  const admin = new GymAdminService(supabase);
  const loadSnapshot = async (gymId: string): Promise<Phase8ComplianceOpsSnapshot> => {
    const openRequests = await admin.listOpenPrivacyRequests(gymId);
    const overdueRequests = openRequests.filter((request) => request.isOverdue || Boolean(request.slaBreachedAt));

    return {
      openRequests,
      overdueRequests
    };
  };

  return {
    checklist: phase8ComplianceOpsChecklist,
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
