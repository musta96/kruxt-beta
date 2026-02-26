import type {
  StaffConsoleLoadResult,
  StaffConsoleMutationResult
} from "../flows/phase2-staff-console-ui";

export interface StaffConsoleServices {
  load(gymId: string): Promise<StaffConsoleLoadResult>;
  approvePendingMembership(gymId: string, membershipId: string): Promise<StaffConsoleMutationResult>;
  rejectPendingMembership(gymId: string, membershipId: string): Promise<StaffConsoleMutationResult>;
  setMembershipStatus(
    gymId: string,
    membershipId: string,
    status: "pending" | "trial" | "active" | "paused" | "cancelled"
  ): Promise<StaffConsoleMutationResult>;
  assignMembershipRole(
    gymId: string,
    membershipId: string,
    role: "leader" | "officer" | "coach" | "member"
  ): Promise<StaffConsoleMutationResult>;
}

export function createStaffConsoleRuntimeServices(): StaffConsoleServices {
  let flow: ReturnType<typeof import("../flows/phase2-staff-console-ui").createPhase2StaffConsoleUiFlow> | null = null;
  let failed = false;

  const getFlow = async () => {
    if (flow) return flow;
    if (failed) return null;

    try {
      const { createPhase2StaffConsoleUiFlow } = await import("../flows/phase2-staff-console-ui");
      flow = createPhase2StaffConsoleUiFlow();
      return flow;
    } catch (error) {
      failed = true;
      console.warn("[staff-console-runtime] Falling back to preview services:", error);
      return null;
    }
  };

  const fallbackLoad = async (): Promise<StaffConsoleLoadResult> => ({
    ok: true,
    snapshot: {
      gymId: "preview-gym-id",
      memberships: [],
      pendingMemberships: [],
      upcomingClasses: [],
      pendingWaitlist: [],
      openPrivacyRequests: [],
      privacyMetrics: {
        gymId: "preview-gym-id",
        openRequests: 0,
        overdueRequests: 0,
        avgCompletionHours: 0,
        fulfilledRequestsWindow: 0,
        rejectedRequestsWindow: 0,
        measuredWindowDays: 30
      }
    }
  });

  const fallbackMutation = async (message: string): Promise<StaffConsoleMutationResult> => ({
    ok: false,
    error: {
      code: "ADMIN_STAFF_RUNTIME_UNAVAILABLE",
      step: "snapshot_refresh",
      message,
      recoverable: true
    }
  });

  return {
    load: async (gymId) => {
      const f = await getFlow();
      if (!f) return fallbackLoad();
      try {
        return await f.load(gymId);
      } catch (error) {
        console.warn("[staff-console-runtime] load failed:", error);
        return fallbackLoad();
      }
    },
    approvePendingMembership: async (gymId, membershipId) => {
      const f = await getFlow();
      if (!f) return fallbackMutation("Staff actions are unavailable in preview mode.");
      try {
        return await f.approvePendingMembership(gymId, membershipId);
      } catch (error) {
        console.warn("[staff-console-runtime] approve failed:", error);
        return fallbackMutation("Unable to approve membership.");
      }
    },
    rejectPendingMembership: async (gymId, membershipId) => {
      const f = await getFlow();
      if (!f) return fallbackMutation("Staff actions are unavailable in preview mode.");
      try {
        return await f.rejectPendingMembership(gymId, membershipId);
      } catch (error) {
        console.warn("[staff-console-runtime] reject failed:", error);
        return fallbackMutation("Unable to reject membership.");
      }
    },
    setMembershipStatus: async (gymId, membershipId, status) => {
      const f = await getFlow();
      if (!f) return fallbackMutation("Staff actions are unavailable in preview mode.");
      try {
        return await f.setMembershipStatus(gymId, membershipId, status);
      } catch (error) {
        console.warn("[staff-console-runtime] set status failed:", error);
        return fallbackMutation("Unable to update membership status.");
      }
    },
    assignMembershipRole: async (gymId, membershipId, role) => {
      const f = await getFlow();
      if (!f) return fallbackMutation("Staff actions are unavailable in preview mode.");
      try {
        return await f.assignMembershipRole(gymId, membershipId, role);
      } catch (error) {
        console.warn("[staff-console-runtime] assign role failed:", error);
        return fallbackMutation("Unable to assign role.");
      }
    }
  };
}
