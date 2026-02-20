import type {
  AccessLog,
  AdminRecordAcceptanceInput,
  ClassBooking,
  ContractAcceptance,
  CreateGymClassInput,
  GymCheckin,
  GymClass,
  RecordAccessLogInput,
  RecordGymCheckinInput,
  UpdateClassWaitlistInput,
  UpdateGymClassInput,
  UpsertClassBookingInput,
  WaiverAcceptance
} from "@kruxt/types";

import { B2BOpsService, createAdminSupabaseClient, KruxtAdminError } from "../services";
import {
  createPhase5B2BOpsFlow,
  phase5B2BOpsChecklist,
  type Phase5B2BOpsLoadOptions,
  type Phase5B2BOpsSnapshot
} from "./phase5-b2b-ops";

export type Phase5OpsUiStep =
  | "class_management"
  | "waitlist"
  | "checkin_access"
  | "waiver_contract"
  | "billing_telemetry";

export interface Phase5OpsUiError {
  code: string;
  step: Phase5OpsUiStep;
  message: string;
  recoverable: boolean;
}

export interface Phase5OpsLoadSuccess {
  ok: true;
  snapshot: Phase5B2BOpsSnapshot;
}

export interface Phase5OpsLoadFailure {
  ok: false;
  error: Phase5OpsUiError;
}

export type Phase5OpsLoadResult = Phase5OpsLoadSuccess | Phase5OpsLoadFailure;

export interface Phase5OpsMutationSuccess {
  ok: true;
  action:
    | "create_class"
    | "update_class"
    | "set_class_status"
    | "upsert_booking"
    | "update_booking_status"
    | "update_waitlist"
    | "promote_waitlist"
    | "record_checkin_access"
    | "record_waiver_acceptance"
    | "record_contract_acceptance";
  snapshot: Phase5B2BOpsSnapshot;
  gymClass?: GymClass;
  booking?: ClassBooking;
  promotedBookingId?: string;
  checkin?: GymCheckin;
  accessLog?: AccessLog;
  waiverAcceptanceId?: string;
  waiverAcceptances?: WaiverAcceptance[];
  contractAcceptanceId?: string;
  contractAcceptances?: ContractAcceptance[];
}

export interface Phase5OpsMutationFailure {
  ok: false;
  error: Phase5OpsUiError;
}

export type Phase5OpsMutationResult = Phase5OpsMutationSuccess | Phase5OpsMutationFailure;

export const phase5OpsConsoleUiChecklist = [
  ...phase5B2BOpsChecklist,
  "Manage classes and bookings from one operations surface",
  "Promote waitlist and immediately refresh booking state",
  "Record check-in/access, waiver, and contract evidence with auditable snapshots"
] as const;

function mapErrorStep(code: string): Phase5OpsUiStep {
  if (code.includes("WAITLIST")) {
    return "waitlist";
  }

  if (
    code.includes("CLASS") ||
    code.includes("BOOKING")
  ) {
    return "class_management";
  }

  if (code.includes("CHECKIN") || code.includes("ACCESS_LOG")) {
    return "checkin_access";
  }

  if (code.includes("WAIVER") || code.includes("CONTRACT")) {
    return "waiver_contract";
  }

  if (
    code.includes("SUBSCRIPTION") ||
    code.includes("INVOICE") ||
    code.includes("PAYMENT") ||
    code.includes("REFUND") ||
    code.includes("DUNNING")
  ) {
    return "billing_telemetry";
  }

  return "class_management";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "ADMIN_STAFF_ACCESS_DENIED") {
    return "Staff access is required for gym operations actions.";
  }

  if (code === "ADMIN_AUTH_REQUIRED") {
    return "Sign in is required before using staff operations.";
  }

  if (code === "ADMIN_WAITLIST_PROMOTE_NO_BOOKING") {
    return "Promotion completed without booking confirmation. Refresh and retry.";
  }

  if (code === "ADMIN_WAIVER_ACCEPTANCE_NO_ID" || code === "ADMIN_CONTRACT_ACCEPTANCE_NO_ID") {
    return "Acceptance was recorded without evidence id. Refresh evidence lists before proceeding.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase5OpsUiError {
  const appError =
    error instanceof KruxtAdminError
      ? error
      : new KruxtAdminError("ADMIN_PHASE5_ACTION_FAILED", "Unable to complete operations action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: !["ADMIN_STAFF_ACCESS_DENIED", "ADMIN_AUTH_REQUIRED"].includes(appError.code)
  };
}

export function createPhase5OpsConsoleUiFlow() {
  const supabase = createAdminSupabaseClient();
  const b2b = new B2BOpsService(supabase);
  const baseFlow = createPhase5B2BOpsFlow();

  const loadSnapshot = async (
    gymId: string,
    options: Phase5B2BOpsLoadOptions = {}
  ): Promise<Phase5B2BOpsSnapshot> => baseFlow.load(gymId, options);

  const runMutation = async (
    gymId: string,
    action: Phase5OpsMutationSuccess["action"],
    mutate: () => Promise<Partial<Phase5OpsMutationSuccess>>,
    options: Phase5B2BOpsLoadOptions = {}
  ): Promise<Phase5OpsMutationResult> => {
    try {
      const payload = await mutate();
      const snapshot = await loadSnapshot(gymId, options);

      return {
        ok: true,
        action,
        snapshot,
        ...payload
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase5OpsConsoleUiChecklist],
    load: async (gymId: string, options: Phase5B2BOpsLoadOptions = {}): Promise<Phase5OpsLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(gymId, options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    createClass: async (
      gymId: string,
      input: CreateGymClassInput
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "create_class",
        async () => {
          const gymClass = await b2b.createGymClass(gymId, input);
          return { gymClass };
        },
        { classId: undefined }
      ),
    updateClass: async (
      gymId: string,
      classId: string,
      input: UpdateGymClassInput
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "update_class",
        async () => {
          const gymClass = await b2b.updateGymClass(gymId, classId, input);
          return { gymClass };
        },
        { classId }
      ),
    setClassStatus: async (
      gymId: string,
      classId: string,
      status: GymClass["status"]
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "set_class_status",
        async () => {
          const gymClass = await b2b.setGymClassStatus(gymId, classId, status);
          return { gymClass };
        },
        { classId }
      ),
    upsertClassBooking: async (
      gymId: string,
      input: UpsertClassBookingInput
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "upsert_booking",
        async () => {
          const booking = await b2b.upsertClassBookingByStaff(gymId, input);
          return { booking };
        },
        { classId: input.classId }
      ),
    updateClassBookingStatus: async (
      gymId: string,
      bookingId: string,
      status: ClassBooking["status"],
      classIdForRefresh: string
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "update_booking_status",
        async () => {
          const booking = await b2b.updateClassBookingStatus(gymId, bookingId, status);
          return { booking };
        },
        { classId: classIdForRefresh }
      ),
    updateWaitlistEntry: async (
      gymId: string,
      waitlistEntryId: string,
      input: UpdateClassWaitlistInput,
      classIdForRefresh: string
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "update_waitlist",
        async () => {
          await b2b.updateClassWaitlistEntry(gymId, waitlistEntryId, input);
          return {};
        },
        { classId: classIdForRefresh }
      ),
    promoteWaitlistMember: async (gymId: string, classId: string): Promise<Phase5OpsMutationResult> =>
      runMutation(
        gymId,
        "promote_waitlist",
        async () => {
          const promotedBookingId = await b2b.promoteWaitlistMember(gymId, classId);
          return { promotedBookingId };
        },
        { classId }
      ),
    recordCheckinAndAccessLog: async (
      gymId: string,
      input: RecordGymCheckinInput,
      accessLogOverride: Partial<RecordAccessLogInput> = {}
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(gymId, "record_checkin_access", async () => {
        const checkin = await b2b.recordCheckin(gymId, input);
        const accessLog = await b2b.recordAccessLog(gymId, {
          userId: input.userId,
          checkinId: checkin.id,
          eventType: accessLogOverride.eventType ?? input.eventType,
          result: accessLogOverride.result ?? input.result,
          reason: accessLogOverride.reason,
          metadata: {
            source_channel: input.sourceChannel ?? "admin_panel",
            ...(accessLogOverride.metadata ?? {})
          }
        });

        return {
          checkin,
          accessLog
        };
      }),
    recordWaiverAcceptance: async (
      gymId: string,
      waiverId: string,
      input: AdminRecordAcceptanceInput
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(gymId, "record_waiver_acceptance", async () => {
        const waiverAcceptanceId = await b2b.recordWaiverAcceptanceByStaff(gymId, waiverId, input);
        const waiverAcceptances = await b2b.listWaiverAcceptances(gymId, waiverId, 200);

        return {
          waiverAcceptanceId,
          waiverAcceptances
        };
      }),
    recordContractAcceptance: async (
      gymId: string,
      contractId: string,
      input: AdminRecordAcceptanceInput
    ): Promise<Phase5OpsMutationResult> =>
      runMutation(gymId, "record_contract_acceptance", async () => {
        const contractAcceptanceId = await b2b.recordContractAcceptanceByStaff(gymId, contractId, input);
        const contractAcceptances = await b2b.listContractAcceptances(gymId, contractId, 200);

        return {
          contractAcceptanceId,
          contractAcceptances
        };
      })
  };
}
