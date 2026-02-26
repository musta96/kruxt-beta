import type {
  Phase5OpsLoadResult,
  Phase5OpsMutationResult,
  Phase5OpsMutationSuccess
} from "../flows/phase5-ops-console-ui";
import type { Phase5B2BOpsLoadOptions, Phase5B2BOpsSnapshot } from "../flows/phase5-b2b-ops";
import type {
  AdminRecordAcceptanceInput,
  ClassBooking,
  CreateGymClassInput,
  GymClass,
  RecordAccessLogInput,
  RecordGymCheckinInput,
  UpdateClassWaitlistInput,
  UpdateGymClassInput,
  UpsertClassBookingInput
} from "@kruxt/types";

export interface OpsConsoleServices {
  load(gymId: string, options?: Phase5B2BOpsLoadOptions): Promise<Phase5OpsLoadResult>;
  createClass(gymId: string, input: CreateGymClassInput): Promise<Phase5OpsMutationResult>;
  updateClass(gymId: string, classId: string, input: UpdateGymClassInput): Promise<Phase5OpsMutationResult>;
  setClassStatus(gymId: string, classId: string, status: GymClass["status"]): Promise<Phase5OpsMutationResult>;
  upsertClassBooking(gymId: string, input: UpsertClassBookingInput): Promise<Phase5OpsMutationResult>;
  updateClassBookingStatus(gymId: string, bookingId: string, status: ClassBooking["status"], classIdForRefresh: string): Promise<Phase5OpsMutationResult>;
  updateWaitlistEntry(gymId: string, waitlistEntryId: string, input: UpdateClassWaitlistInput, classIdForRefresh: string): Promise<Phase5OpsMutationResult>;
  promoteWaitlistMember(gymId: string, classId: string): Promise<Phase5OpsMutationResult>;
  recordCheckinAndAccessLog(gymId: string, input: RecordGymCheckinInput, accessLogOverride?: Partial<RecordAccessLogInput>): Promise<Phase5OpsMutationResult>;
  recordWaiverAcceptance(gymId: string, waiverId: string, input: AdminRecordAcceptanceInput): Promise<Phase5OpsMutationResult>;
  recordContractAcceptance(gymId: string, contractId: string, input: AdminRecordAcceptanceInput): Promise<Phase5OpsMutationResult>;
}

const EMPTY_SNAPSHOT: Phase5B2BOpsSnapshot = {
  membershipPlans: [],
  classes: [],
  selectedClassBookings: [],
  selectedClassWaitlist: [],
  waivers: [],
  contracts: [],
  recentCheckins: [],
  recentAccessLogs: [],
  subscriptions: [],
  invoices: [],
  paymentTransactions: [],
  refunds: [],
  dunningEvents: []
};

const fallbackLoad = async (): Promise<Phase5OpsLoadResult> => ({
  ok: true,
  snapshot: EMPTY_SNAPSHOT
});

const fallbackUnavailableMutation = async (
  action: Phase5OpsMutationSuccess["action"]
): Promise<Phase5OpsMutationResult> => ({
  ok: true,
  action,
  snapshot: EMPTY_SNAPSHOT
});

const fallbackFailedMutation = async (
  message: string
): Promise<Phase5OpsMutationResult> => ({
  ok: false,
  error: {
    code: "ADMIN_OPS_RUNTIME_ACTION_FAILED",
    step: "class_management",
    message,
    recoverable: true
  }
});

export function createOpsConsoleRuntimeServices(): OpsConsoleServices {
  let flow: ReturnType<typeof import("../flows/phase5-ops-console-ui").createPhase5OpsConsoleUiFlow> | null = null;
  let failed = false;

  const getFlow = async () => {
    if (flow) return flow;
    if (failed) return null;
    try {
      const { createPhase5OpsConsoleUiFlow } = await import("../flows/phase5-ops-console-ui");
      flow = createPhase5OpsConsoleUiFlow();
      return flow;
    } catch (error) {
      failed = true;
      console.warn("[ops-console-runtime] Falling back to preview services:", error);
      return null;
    }
  };

  const wrap = async <T>(
    fn: (f: NonNullable<typeof flow>) => Promise<T>,
    fallbackUnavailable: () => Promise<T>,
    fallbackFailed: () => Promise<T>
  ): Promise<T> => {
    const f = await getFlow();
    if (!f) return fallbackUnavailable();
    try { return await fn(f); }
    catch (error) {
      console.warn("[ops-console-runtime] action failed:", error);
      return fallbackFailed();
    }
  };

  return {
    load: (gymId, options) => wrap(f => f.load(gymId, options), fallbackLoad),
    createClass: (gymId, input) =>
      wrap(
        (f) => f.createClass(gymId, input),
        () => fallbackUnavailableMutation("create_class"),
        () => fallbackFailedMutation("Unable to create class.")
      ),
    updateClass: (gymId, classId, input) =>
      wrap(
        (f) => f.updateClass(gymId, classId, input),
        () => fallbackUnavailableMutation("update_class"),
        () => fallbackFailedMutation("Unable to update class.")
      ),
    setClassStatus: (gymId, classId, status) =>
      wrap(
        (f) => f.setClassStatus(gymId, classId, status),
        () => fallbackUnavailableMutation("set_class_status"),
        () => fallbackFailedMutation("Unable to set class status.")
      ),
    upsertClassBooking: (gymId, input) =>
      wrap(
        (f) => f.upsertClassBooking(gymId, input),
        () => fallbackUnavailableMutation("upsert_booking"),
        () => fallbackFailedMutation("Unable to upsert booking.")
      ),
    updateClassBookingStatus: (gymId, bookingId, status, classIdForRefresh) =>
      wrap(
        (f) => f.updateClassBookingStatus(gymId, bookingId, status, classIdForRefresh),
        () => fallbackUnavailableMutation("update_booking_status"),
        () => fallbackFailedMutation("Unable to update booking status.")
      ),
    updateWaitlistEntry: (gymId, waitlistEntryId, input, classIdForRefresh) =>
      wrap(
        (f) => f.updateWaitlistEntry(gymId, waitlistEntryId, input, classIdForRefresh),
        () => fallbackUnavailableMutation("update_waitlist"),
        () => fallbackFailedMutation("Unable to update waitlist entry.")
      ),
    promoteWaitlistMember: (gymId, classId) =>
      wrap(
        (f) => f.promoteWaitlistMember(gymId, classId),
        () => fallbackUnavailableMutation("promote_waitlist"),
        () => fallbackFailedMutation("Unable to promote waitlist member.")
      ),
    recordCheckinAndAccessLog: (gymId, input, accessLogOverride) =>
      wrap(
        (f) => f.recordCheckinAndAccessLog(gymId, input, accessLogOverride),
        () => fallbackUnavailableMutation("record_checkin_access"),
        () => fallbackFailedMutation("Unable to record check-in.")
      ),
    recordWaiverAcceptance: (gymId, waiverId, input) =>
      wrap(
        (f) => f.recordWaiverAcceptance(gymId, waiverId, input),
        () => fallbackUnavailableMutation("record_waiver_acceptance"),
        () => fallbackFailedMutation("Unable to record waiver acceptance.")
      ),
    recordContractAcceptance: (gymId, contractId, input) =>
      wrap(
        (f) => f.recordContractAcceptance(gymId, contractId, input),
        () => fallbackUnavailableMutation("record_contract_acceptance"),
        () => fallbackFailedMutation("Unable to record contract acceptance.")
      )
  };
}
