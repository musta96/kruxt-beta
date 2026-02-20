import type { GymMembership, GymRole, MembershipStatus } from "@kruxt/types";

import {
  createAdminSupabaseClient,
  GymAdminService,
  KruxtAdminError,
  type GymClassScheduleItem,
  type OpenPrivacyRequest,
  type PendingWaitlistEntry,
  type PrivacyOpsMetrics
} from "../services";
import { phase2StaffOpsChecklist } from "./phase2-staff-ops";

export type StaffConsoleUiStep =
  | "access"
  | "queue"
  | "membership_status"
  | "role_assignment"
  | "snapshot_refresh";

export interface StaffMembershipItem extends GymMembership {
  isPending: boolean;
  canApprove: boolean;
  canReject: boolean;
  canAssignRole: boolean;
}

export interface Phase2StaffConsoleSnapshot {
  gymId: string;
  memberships: StaffMembershipItem[];
  pendingMemberships: StaffMembershipItem[];
  upcomingClasses: GymClassScheduleItem[];
  pendingWaitlist: PendingWaitlistEntry[];
  openPrivacyRequests: OpenPrivacyRequest[];
  privacyMetrics: PrivacyOpsMetrics;
}

export interface StaffConsoleUiError {
  code: string;
  step: StaffConsoleUiStep;
  message: string;
  recoverable: boolean;
}

export interface StaffConsoleLoadSuccess {
  ok: true;
  snapshot: Phase2StaffConsoleSnapshot;
}

export interface StaffConsoleLoadFailure {
  ok: false;
  error: StaffConsoleUiError;
}

export type StaffConsoleLoadResult = StaffConsoleLoadSuccess | StaffConsoleLoadFailure;

export interface StaffConsoleMutationSuccess {
  ok: true;
  action: "approve" | "reject" | "set_status" | "assign_role";
  updatedMembership: GymMembership;
  snapshot: Phase2StaffConsoleSnapshot;
}

export interface StaffConsoleMutationFailure {
  ok: false;
  error: StaffConsoleUiError;
}

export type StaffConsoleMutationResult = StaffConsoleMutationSuccess | StaffConsoleMutationFailure;

const STATUS_ORDER: MembershipStatus[] = ["pending", "trial", "active", "paused", "cancelled"];
const ROLE_ORDER: GymRole[] = ["leader", "officer", "coach", "member"];

export const phase2StaffConsoleUiChecklist = [
  ...phase2StaffOpsChecklist,
  "Approve or reject pending memberships",
  "Assign gym roles (leader/officer/coach/member)",
  "Refresh console snapshot after every membership mutation"
] as const;

function statusRank(status: MembershipStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index >= 0 ? index : STATUS_ORDER.length;
}

function roleRank(role: GymRole): number {
  const index = ROLE_ORDER.indexOf(role);
  return index >= 0 ? index : ROLE_ORDER.length;
}

function mapMembershipItem(membership: GymMembership): StaffMembershipItem {
  const isPending = membership.membershipStatus === "pending";

  return {
    ...membership,
    isPending,
    canApprove: isPending,
    canReject: isPending,
    canAssignRole: membership.membershipStatus === "trial" || membership.membershipStatus === "active"
  };
}

function sortMemberships(left: StaffMembershipItem, right: StaffMembershipItem): number {
  const statusDelta = statusRank(left.membershipStatus) - statusRank(right.membershipStatus);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const roleDelta = roleRank(left.role) - roleRank(right.role);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  return left.userId.localeCompare(right.userId);
}

function mapErrorStep(code: string): StaffConsoleUiStep {
  if (["ADMIN_AUTH_REQUIRED", "ADMIN_STAFF_ACCESS_DENIED", "ADMIN_STAFF_ACCESS_CHECK_FAILED"].includes(code)) {
    return "access";
  }

  if (["ADMIN_PENDING_MEMBERSHIPS_FAILED"].includes(code)) {
    return "queue";
  }

  if (["ADMIN_MEMBERSHIP_UPDATE_FAILED"].includes(code)) {
    return "membership_status";
  }

  if (["ADMIN_ROLE_ASSIGN_FAILED"].includes(code)) {
    return "role_assignment";
  }

  return "snapshot_refresh";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "ADMIN_STAFF_ACCESS_DENIED") {
    return "Staff access is required to manage this gym.";
  }

  if (code === "ADMIN_AUTH_REQUIRED") {
    return "Sign in is required before using staff actions.";
  }

  if (code === "ADMIN_MEMBERSHIP_UPDATE_FAILED") {
    return "Membership update failed. Refresh and retry.";
  }

  if (code === "ADMIN_ROLE_ASSIGN_FAILED") {
    return "Role assignment failed. Refresh and retry.";
  }

  return fallback;
}

function mapUiError(error: unknown): StaffConsoleUiError {
  const appError =
    error instanceof KruxtAdminError
      ? error
      : new KruxtAdminError("ADMIN_CONSOLE_ACTION_FAILED", "Unable to complete staff action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: !["ADMIN_STAFF_ACCESS_DENIED", "ADMIN_AUTH_REQUIRED"].includes(appError.code)
  };
}

export function createPhase2StaffConsoleUiFlow() {
  const supabase = createAdminSupabaseClient();
  const admin = new GymAdminService(supabase);

  const loadSnapshot = async (gymId: string): Promise<Phase2StaffConsoleSnapshot> => {
    const [memberships, upcomingClasses, pendingWaitlist, openPrivacyRequests, privacyMetrics] =
      await Promise.all([
        admin.listGymMemberships(gymId),
        admin.listUpcomingClasses(gymId, 20),
        admin.listPendingWaitlistEntries(gymId, 50),
        admin.listOpenPrivacyRequests(gymId),
        admin.getPrivacyOpsMetrics(gymId, 30)
      ]);

    const membershipItems = memberships.map(mapMembershipItem).sort(sortMemberships);

    return {
      gymId,
      memberships: membershipItems,
      pendingMemberships: membershipItems.filter((membership) => membership.membershipStatus === "pending"),
      upcomingClasses,
      pendingWaitlist,
      openPrivacyRequests,
      privacyMetrics
    };
  };

  const runMutation = async (
    gymId: string,
    action: StaffConsoleMutationSuccess["action"],
    mutate: () => Promise<GymMembership>
  ): Promise<StaffConsoleMutationResult> => {
    try {
      const updatedMembership = await mutate();
      const snapshot = await loadSnapshot(gymId);

      return {
        ok: true,
        action,
        updatedMembership,
        snapshot
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase2StaffConsoleUiChecklist],
    load: async (gymId: string): Promise<StaffConsoleLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(gymId)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    approvePendingMembership: async (gymId: string, membershipId: string): Promise<StaffConsoleMutationResult> =>
      runMutation(gymId, "approve", () => admin.approveMembership(gymId, membershipId)),
    rejectPendingMembership: async (gymId: string, membershipId: string): Promise<StaffConsoleMutationResult> =>
      runMutation(gymId, "reject", () => admin.updateMembershipStatus(gymId, membershipId, "cancelled")),
    setMembershipStatus: async (
      gymId: string,
      membershipId: string,
      status: MembershipStatus
    ): Promise<StaffConsoleMutationResult> =>
      runMutation(gymId, "set_status", () => admin.updateMembershipStatus(gymId, membershipId, status)),
    assignMembershipRole: async (
      gymId: string,
      membershipId: string,
      role: GymRole
    ): Promise<StaffConsoleMutationResult> =>
      runMutation(gymId, "assign_role", () => admin.assignMembershipRole(gymId, membershipId, role))
  };
}
