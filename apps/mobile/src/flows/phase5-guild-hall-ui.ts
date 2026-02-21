import type {
  AccessLog,
  ClassBooking,
  ClassWaitlistEntry,
  Contract,
  GymCheckin,
  GymClass,
  GymMembership,
  GymMembershipPlan,
  GuildHallSnapshot,
  GuildRosterMember,
  Waiver
} from "@kruxt/types";

import {
  createMobileSupabaseClient,
  GymService,
  KruxtAppError,
  type GymStaffOpsSnapshot
} from "../services";

export type Phase5GuildHallUiStep = "member_overview" | "staff_overview";
export type GuildHallViewMode = "member" | "staff";
export type GuildHallComplianceKind = "waiver" | "contract";
export type GuildHallStaffControlKey =
  | "promote_waitlist_member"
  | "resolve_checkin_anomaly"
  | "record_waiver_acceptance"
  | "record_contract_acceptance";

export interface Phase5GuildHallUiLoadOptions {
  classId?: string;
  rosterLimit?: number;
}

export interface GuildHallComplianceStatusItem {
  id: string;
  title: string;
  policyVersion: string;
  documentUrl: string;
  accepted: boolean;
  acceptedAt?: string;
  kind: GuildHallComplianceKind;
}

export interface GuildHallStaffClassPressure {
  classId: string;
  title: string;
  startsAt: string;
  capacity: number;
  bookedCount: number;
  waitlistCount: number;
  pressure: "low" | "medium" | "high";
}

export interface GuildHallCheckinAnomaly {
  accessLogId: string;
  eventType: AccessLog["eventType"];
  result: AccessLog["result"];
  createdAt: string;
  reason?: string | null;
}

export interface GuildHallStaffControl {
  key: GuildHallStaffControlKey;
  label: string;
  description: string;
  requiresConfirm: true;
  enabled: boolean;
}

export interface GuildHallStaffConfirmDialog {
  title: string;
  message: string;
  confirmLabel: string;
}

export interface GuildHallStaffBoard {
  operationsToday: {
    classesScheduled: number;
    selectedClassBookings: number;
    selectedClassWaitlist: number;
    pendingApprovals: number;
    unresolvedWaiverTasks: number;
    unresolvedContractTasks: number;
  };
  capacityPressure: GuildHallStaffClassPressure[];
  checkinAnomalies: GuildHallCheckinAnomaly[];
  opsSnapshot: {
    classes: GymClass[];
    selectedClassId?: string;
    selectedClassBookings: ClassBooking[];
    selectedClassWaitlist: ClassWaitlistEntry[];
    recentCheckins: GymCheckin[];
    recentAccessLogs: AccessLog[];
    waivers: Waiver[];
    contracts: Contract[];
  };
}

export interface Phase5GuildHallUiMicrocopy {
  proofFirst: string;
  rosterRule: string;
  staffGuardrail: string;
}

export interface Phase5GuildHallUiSnapshot {
  viewMode: GuildHallViewMode;
  guild: GuildHallSnapshot;
  roster: GuildRosterMember[];
  membership: GymMembership | null;
  membershipPlan: GymMembershipPlan | null;
  upcomingClasses: GymClass[];
  waitlistEntries: ClassWaitlistEntry[];
  recentCheckins: GymCheckin[];
  waiverStatus: GuildHallComplianceStatusItem[];
  contractStatus: GuildHallComplianceStatusItem[];
  staffBoard: GuildHallStaffBoard | null;
  staffControls: GuildHallStaffControl[];
  microcopy: Phase5GuildHallUiMicrocopy;
}

export interface Phase5GuildHallUiError {
  code: string;
  step: Phase5GuildHallUiStep;
  message: string;
  recoverable: boolean;
}

export interface Phase5GuildHallLoadSuccess {
  ok: true;
  snapshot: Phase5GuildHallUiSnapshot;
}

export interface Phase5GuildHallLoadFailure {
  ok: false;
  error: Phase5GuildHallUiError;
}

export type Phase5GuildHallLoadResult = Phase5GuildHallLoadSuccess | Phase5GuildHallLoadFailure;

const DEFAULT_ROSTER_LIMIT = 60;
const MAX_CAPACITY_PRESSURE_CLASSES = 20;

const PHASE5_GUILD_HALL_MICROCOPY: Phase5GuildHallUiMicrocopy = {
  proofFirst: "Proof first.",
  rosterRule: "Roster updates weekly.",
  staffGuardrail: "Staff controls require explicit confirmation."
};

const PHASE5_STAFF_CONFIRM_DIALOGS: Record<GuildHallStaffControlKey, GuildHallStaffConfirmDialog> = {
  promote_waitlist_member: {
    title: "Confirm waitlist promotion",
    message: "Promoting from waitlist changes class occupancy immediately. Confirm to continue.",
    confirmLabel: "Promote now"
  },
  resolve_checkin_anomaly: {
    title: "Confirm anomaly resolution",
    message: "Resolving a check-in anomaly writes an auditable operations event. Confirm to continue.",
    confirmLabel: "Resolve anomaly"
  },
  record_waiver_acceptance: {
    title: "Confirm waiver evidence",
    message: "Recording waiver acceptance creates immutable legal evidence. Confirm member identity first.",
    confirmLabel: "Record waiver"
  },
  record_contract_acceptance: {
    title: "Confirm contract evidence",
    message: "Recording contract acceptance creates immutable legal evidence. Confirm member identity first.",
    confirmLabel: "Record contract"
  }
};

export const phase5GuildHallUiChecklist = [
  "Load role-aware guild hall snapshot",
  "Render member status for classes, waitlist, check-ins, waivers, and contracts",
  "Render staff operations board with class pressure and anomaly visibility",
  "Keep staff controls confirmation-gated and hidden for member-only users"
] as const;

function mapErrorStep(code: string): Phase5GuildHallUiStep {
  if (code.includes("STAFF") || code.includes("ACCESS_LOG") || code.includes("PENDING_APPROVALS")) {
    return "staff_overview";
  }
  return "member_overview";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "GUILD_STAFF_REQUIRED") {
    return "Staff controls are locked for non-staff members.";
  }

  if (code === "GUILD_STAFF_INACTIVE") {
    return "Staff controls are unavailable because your staff membership is inactive.";
  }

  if (code === "GUILD_MEMBERSHIP_REQUIRED") {
    return "Join a guild before opening Guild Hall operations.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase5GuildHallUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("GUILD_HALL_UI_LOAD_FAILED", "Unable to load Guild Hall.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: appError.code !== "AUTH_REQUIRED"
  };
}

function buildWaiverStatus(waivers: Waiver[], acceptedWaiverIds: Map<string, string>): GuildHallComplianceStatusItem[] {
  return waivers.map((waiver) => ({
    id: waiver.id,
    title: waiver.title,
    policyVersion: waiver.policyVersion,
    documentUrl: waiver.documentUrl,
    accepted: acceptedWaiverIds.has(waiver.id),
    acceptedAt: acceptedWaiverIds.get(waiver.id),
    kind: "waiver"
  }));
}

function buildContractStatus(
  contracts: Contract[],
  acceptedContractIds: Map<string, string>
): GuildHallComplianceStatusItem[] {
  return contracts.map((contract) => ({
    id: contract.id,
    title: contract.title,
    policyVersion: contract.policyVersion,
    documentUrl: contract.documentUrl,
    accepted: acceptedContractIds.has(contract.id),
    acceptedAt: acceptedContractIds.get(contract.id),
    kind: "contract"
  }));
}

function calculatePressure(
  gymClass: GymClass,
  bookings: ClassBooking[],
  waitlist: ClassWaitlistEntry[]
): GuildHallStaffClassPressure {
  const bookedCount = bookings.filter((row) => row.status === "booked" || row.status === "attended").length;
  const waitlistCount = waitlist.filter((row) => row.status === "pending" || row.status === "promoted").length;
  const occupancyRatio = gymClass.capacity > 0 ? bookedCount / gymClass.capacity : 1;

  let pressure: GuildHallStaffClassPressure["pressure"] = "low";
  if (occupancyRatio >= 0.95 || waitlistCount > 0) {
    pressure = "high";
  } else if (occupancyRatio >= 0.75) {
    pressure = "medium";
  }

  return {
    classId: gymClass.id,
    title: gymClass.title,
    startsAt: gymClass.startsAt,
    capacity: gymClass.capacity,
    bookedCount,
    waitlistCount,
    pressure
  };
}

async function buildStaffBoard(
  gyms: GymService,
  gymId: string,
  staffSnapshot: GymStaffOpsSnapshot,
  waivers: Waiver[],
  contracts: Contract[]
): Promise<GuildHallStaffBoard> {
  const classesForPressure = staffSnapshot.classes.slice(0, MAX_CAPACITY_PRESSURE_CLASSES);
  const pressureRows = await Promise.all(
    classesForPressure.map(async (gymClass) => {
      const [bookings, waitlist] = await Promise.all([
        gyms.listClassBookings(gymId, gymClass.id, 500),
        gyms.listClassWaitlist(gymId, gymClass.id, 500)
      ]);

      return calculatePressure(gymClass, bookings, waitlist);
    })
  );

  const checkinAnomalies: GuildHallCheckinAnomaly[] = staffSnapshot.recentAccessLogs
    .filter((row) => row.result === "denied" || row.result === "override_allowed")
    .slice(0, 30)
    .map((row) => ({
      accessLogId: row.id,
      eventType: row.eventType,
      result: row.result,
      createdAt: row.createdAt,
      reason: row.reason
    }));

  return {
    operationsToday: {
      classesScheduled: staffSnapshot.classes.length,
      selectedClassBookings: staffSnapshot.selectedClassBookings.length,
      selectedClassWaitlist: staffSnapshot.selectedClassWaitlist.length,
      pendingApprovals: staffSnapshot.pendingApprovals,
      unresolvedWaiverTasks: staffSnapshot.complianceTasks.unresolvedWaiverTasks,
      unresolvedContractTasks: staffSnapshot.complianceTasks.unresolvedContractTasks
    },
    capacityPressure: pressureRows.sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    checkinAnomalies,
    opsSnapshot: {
      classes: staffSnapshot.classes,
      selectedClassId: staffSnapshot.selectedClassId,
      selectedClassBookings: staffSnapshot.selectedClassBookings,
      selectedClassWaitlist: staffSnapshot.selectedClassWaitlist,
      recentCheckins: staffSnapshot.recentCheckins,
      recentAccessLogs: staffSnapshot.recentAccessLogs,
      waivers,
      contracts
    }
  };
}

function buildStaffControls(staffBoard: GuildHallStaffBoard | null): GuildHallStaffControl[] {
  if (!staffBoard) {
    return [];
  }

  return [
    {
      key: "promote_waitlist_member",
      label: "Promote waitlist member",
      description: "Advance first pending athlete to booking.",
      requiresConfirm: true,
      enabled: staffBoard.operationsToday.selectedClassWaitlist > 0
    },
    {
      key: "resolve_checkin_anomaly",
      label: "Resolve check-in anomaly",
      description: "Review denied and override access logs.",
      requiresConfirm: true,
      enabled: staffBoard.checkinAnomalies.length > 0
    },
    {
      key: "record_waiver_acceptance",
      label: "Record waiver acceptance",
      description: "Capture member waiver evidence from staff console.",
      requiresConfirm: true,
      enabled: staffBoard.operationsToday.unresolvedWaiverTasks > 0
    },
    {
      key: "record_contract_acceptance",
      label: "Record contract acceptance",
      description: "Capture member contract evidence from staff console.",
      requiresConfirm: true,
      enabled: staffBoard.operationsToday.unresolvedContractTasks > 0
    }
  ];
}

export function createPhase5GuildHallUiFlow() {
  const supabase = createMobileSupabaseClient();
  const gyms = new GymService(supabase);

  const loadSnapshot = async (
    userId: string,
    options: Phase5GuildHallUiLoadOptions = {}
  ): Promise<Phase5GuildHallUiSnapshot> => {
    const guild = await gyms.getGuildHallSnapshot(userId);
    const rosterLimit = options.rosterLimit ?? DEFAULT_ROSTER_LIMIT;

    if (!guild.gymId) {
      return {
        viewMode: "member",
        guild,
        roster: [],
        membership: null,
        membershipPlan: null,
        upcomingClasses: [],
        waitlistEntries: [],
        recentCheckins: [],
        waiverStatus: [],
        contractStatus: [],
        staffBoard: null,
        staffControls: [],
        microcopy: { ...PHASE5_GUILD_HALL_MICROCOPY }
      };
    }

    const [roster, membership, upcomingClasses, waitlistEntries, recentCheckins, waivers, contracts] =
      await Promise.all([
        gyms.listGuildRoster(guild.gymId, rosterLimit),
        gyms.getMembershipForGymUser(guild.gymId, userId),
        gyms.listUpcomingClassesForMember(guild.gymId, userId, 20),
        gyms.listWaitlistEntriesForMember(guild.gymId, userId, 20),
        gyms.listRecentCheckinsForMember(guild.gymId, userId, 20),
        gyms.listActiveWaivers(guild.gymId),
        gyms.listActiveContracts(guild.gymId)
      ]);

    const [waiverAcceptances, contractAcceptances] = await Promise.all([
      gyms.listMyWaiverAcceptances(userId, waivers.map((waiver) => waiver.id)),
      gyms.listMyContractAcceptances(userId, contracts.map((contract) => contract.id))
    ]);

    const waiverAcceptedById = new Map<string, string>();
    for (const acceptance of waiverAcceptances) {
      if (!waiverAcceptedById.has(acceptance.waiverId)) {
        waiverAcceptedById.set(acceptance.waiverId, acceptance.acceptedAt);
      }
    }

    const contractAcceptedById = new Map<string, string>();
    for (const acceptance of contractAcceptances) {
      if (!contractAcceptedById.has(acceptance.contractId)) {
        contractAcceptedById.set(acceptance.contractId, acceptance.acceptedAt);
      }
    }

    const membershipPlan =
      membership?.membershipPlanId && guild.gymId
        ? await gyms.getMembershipPlan(guild.gymId, membership.membershipPlanId)
        : null;

    let staffBoard: GuildHallStaffBoard | null = null;
    if (guild.isStaff) {
      const staffSnapshot = await gyms.loadStaffOpsSnapshot(guild.gymId, userId, options.classId);
      staffBoard = await buildStaffBoard(gyms, guild.gymId, staffSnapshot, waivers, contracts);
    }

    return {
      viewMode: guild.isStaff ? "staff" : "member",
      guild,
      roster,
      membership,
      membershipPlan,
      upcomingClasses,
      waitlistEntries,
      recentCheckins,
      waiverStatus: buildWaiverStatus(waivers, waiverAcceptedById),
      contractStatus: buildContractStatus(contracts, contractAcceptedById),
      staffBoard,
      staffControls: buildStaffControls(staffBoard),
      microcopy: { ...PHASE5_GUILD_HALL_MICROCOPY }
    };
  };

  return {
    checklist: [...phase5GuildHallUiChecklist],
    microcopy: { ...PHASE5_GUILD_HALL_MICROCOPY },
    getStaffConfirmDialog: (controlKey: GuildHallStaffControlKey): GuildHallStaffConfirmDialog =>
      PHASE5_STAFF_CONFIRM_DIALOGS[controlKey],
    load: async (
      userId: string,
      options: Phase5GuildHallUiLoadOptions = {}
    ): Promise<Phase5GuildHallLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(userId, options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    }
  };
}
