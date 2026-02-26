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
import { createAdminSupabaseClient } from "../services";

export interface OpsConsoleServices {
  load(gymId: string, options?: Phase5B2BOpsLoadOptions): Promise<Phase5OpsLoadResult>;
  listClassSchedulingOptions(gymId: string): Promise<ClassSchedulingOptions>;
  saveClassSchedulingOptions(gymId: string, input: ClassSchedulingCatalogInput): Promise<SaveClassSchedulingOptionsResult>;
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

export interface CoachOption {
  userId: string;
  displayName: string;
}

export interface ClassTemplateOption {
  id: string;
  name: string;
  location: string;
  defaultCapacity: number;
  defaultDurationMinutes: number;
}

export interface ClassSchedulingOptions {
  locations: string[];
  templates: ClassTemplateOption[];
  coaches: CoachOption[];
}

export interface ClassSchedulingCatalogInput {
  locations: string[];
  templates: ClassTemplateOption[];
}

export interface SaveClassSchedulingOptionsResult {
  ok: boolean;
  options?: ClassSchedulingOptions;
  error?: { message: string };
}

type GymMembershipStaffRow = {
  user_id: string;
  role: "leader" | "officer" | "coach";
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

const DEFAULT_CLASS_TEMPLATES: ClassTemplateOption[] = [
  {
    id: "functional_training",
    name: "Functional Training",
    location: "Main Floor",
    defaultCapacity: 20,
    defaultDurationMinutes: 60
  },
  {
    id: "hyrox",
    name: "Hyrox",
    location: "Main Floor",
    defaultCapacity: 24,
    defaultDurationMinutes: 60
  }
];

const BZONE_CLASS_TEMPLATES: ClassTemplateOption[] = [
  {
    id: "pilates_reformer_wz",
    name: "Pilates Reformer",
    location: "Wellness Zone",
    defaultCapacity: 8,
    defaultDurationMinutes: 55
  },
  {
    id: "pilates_bodyweight_bz",
    name: "Pilates Bodyweight",
    location: "BZone",
    defaultCapacity: 30,
    defaultDurationMinutes: 55
  },
  {
    id: "spartan_training_bz",
    name: "Spartan Training",
    location: "BZone",
    defaultCapacity: 20,
    defaultDurationMinutes: 60
  },
  {
    id: "hyrox_bz",
    name: "Hyrox",
    location: "BZone",
    defaultCapacity: 18,
    defaultDurationMinutes: 60
  },
  {
    id: "functional_training_bz",
    name: "Functional Training",
    location: "BZone",
    defaultCapacity: 20,
    defaultDurationMinutes: 60
  }
];

const GYM_TEMPLATE_OVERRIDES: Record<string, ClassTemplateOption[]> = {
  "3306f501-3f50-4a30-8552-b47bf9cce199": BZONE_CLASS_TEMPLATES
};

const CATALOG_STORAGE_PREFIX = "kruxt_admin_class_catalog_v1:";

type StoredCatalog = {
  locations: string[];
  templates: ClassTemplateOption[];
};

function createEmptySnapshot(): Phase5B2BOpsSnapshot {
  return {
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
}

function createPreviewId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSnapshot(snapshot: Phase5B2BOpsSnapshot): Phase5B2BOpsSnapshot {
  return {
    ...snapshot,
    membershipPlans: [...snapshot.membershipPlans],
    classes: [...snapshot.classes],
    selectedClassBookings: [...snapshot.selectedClassBookings],
    selectedClassWaitlist: [...snapshot.selectedClassWaitlist],
    waivers: [...snapshot.waivers],
    contracts: [...snapshot.contracts],
    recentCheckins: [...snapshot.recentCheckins],
    recentAccessLogs: [...snapshot.recentAccessLogs],
    subscriptions: [...snapshot.subscriptions],
    invoices: [...snapshot.invoices],
    paymentTransactions: [...snapshot.paymentTransactions],
    refunds: [...snapshot.refunds],
    dunningEvents: [...snapshot.dunningEvents]
  };
}

function getTemplatesForGym(gymId: string): ClassTemplateOption[] {
  return GYM_TEMPLATE_OVERRIDES[gymId] ?? DEFAULT_CLASS_TEMPLATES;
}

function deriveLocations(templates: ClassTemplateOption[]): string[] {
  const unique = new Set<string>();
  for (const item of templates) {
    unique.add(item.location);
  }
  return Array.from(unique);
}

function normalizeCatalog(input: ClassSchedulingCatalogInput): StoredCatalog {
  const rawLocations = input.locations.map((item) => item.trim()).filter(Boolean);
  const locationSet = new Set<string>(rawLocations);
  const templates: ClassTemplateOption[] = [];

  for (const item of input.templates) {
    const location = item.location.trim();
    const name = item.name.trim();
    if (!location || !name) continue;
    locationSet.add(location);
    templates.push({
      id: item.id || createPreviewId("template"),
      name,
      location,
      defaultCapacity: Math.max(1, Math.floor(item.defaultCapacity || 1)),
      defaultDurationMinutes: Math.max(15, Math.floor(item.defaultDurationMinutes || 60))
    });
  }

  const locations = Array.from(locationSet);
  return { locations, templates };
}

function readCatalogFromStorage(gymId: string): StoredCatalog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CATALOG_STORAGE_PREFIX}${gymId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCatalog;
    return normalizeCatalog(parsed);
  } catch {
    return null;
  }
}

function writeCatalogToStorage(gymId: string, catalog: StoredCatalog): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CATALOG_STORAGE_PREFIX}${gymId}`, JSON.stringify(catalog));
  } catch {
    // noop
  }
}

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
  let adminSupabase: ReturnType<typeof createAdminSupabaseClient> | null = null;
  const catalogByGym = new Map<string, StoredCatalog>();

  let previewGymId = "preview-gym-id";
  let previewClasses: Phase5B2BOpsSnapshot["classes"] = [];
  let previewBookings: Phase5B2BOpsSnapshot["selectedClassBookings"] = [];
  let previewWaitlist: Phase5B2BOpsSnapshot["selectedClassWaitlist"] = [];
  let previewRecentCheckins: Phase5B2BOpsSnapshot["recentCheckins"] = [];
  let previewRecentAccessLogs: Phase5B2BOpsSnapshot["recentAccessLogs"] = [];
  let previewSelectedClassId: string | undefined;

  const previewSeedTs = nowIso();
  let previewWaivers: Phase5B2BOpsSnapshot["waivers"] = [
    {
      id: createPreviewId("waiver"),
      gymId: previewGymId,
      title: "General Liability Waiver",
      policyVersion: "v1",
      languageCode: "en",
      documentUrl: "https://example.com/waivers/general",
      isActive: true,
      effectiveAt: previewSeedTs,
      createdBy: null,
      createdAt: previewSeedTs,
      updatedAt: previewSeedTs
    }
  ];
  let previewContracts: Phase5B2BOpsSnapshot["contracts"] = [
    {
      id: createPreviewId("contract"),
      gymId: previewGymId,
      title: "Membership Contract",
      contractType: "membership",
      policyVersion: "v1",
      languageCode: "en",
      documentUrl: "https://example.com/contracts/membership",
      isActive: true,
      effectiveAt: previewSeedTs,
      createdBy: null,
      createdAt: previewSeedTs,
      updatedAt: previewSeedTs
    }
  ];

  const getCatalogForGym = (gymId: string): StoredCatalog => {
    const cached = catalogByGym.get(gymId);
    if (cached) return cached;

    const fromStorage = readCatalogFromStorage(gymId);
    if (fromStorage) {
      catalogByGym.set(gymId, fromStorage);
      return fromStorage;
    }

    const templates = getTemplatesForGym(gymId);
    const defaultCatalog: StoredCatalog = {
      templates,
      locations: deriveLocations(templates)
    };
    catalogByGym.set(gymId, defaultCatalog);
    return defaultCatalog;
  };

  const ensurePreviewGymId = (gymId: string) => {
    if (!gymId || gymId === previewGymId) return;
    previewGymId = gymId;
    previewClasses = previewClasses.map((item) => ({ ...item, gymId }));
    previewWaivers = previewWaivers.map((item) => ({ ...item, gymId }));
    previewContracts = previewContracts.map((item) => ({ ...item, gymId }));
    previewRecentCheckins = previewRecentCheckins.map((item) => ({ ...item, gymId }));
    previewRecentAccessLogs = previewRecentAccessLogs.map((item) => ({ ...item, gymId }));
  };

  const resolveSelectedClassId = (preferredClassId?: string): string | undefined => {
    if (preferredClassId && previewClasses.some((item) => item.id === preferredClassId)) {
      return preferredClassId;
    }
    if (previewSelectedClassId && previewClasses.some((item) => item.id === previewSelectedClassId)) {
      return previewSelectedClassId;
    }
    const scheduled = previewClasses.find((item) => item.status === "scheduled");
    return scheduled?.id ?? previewClasses[0]?.id;
  };

  const buildPreviewSnapshot = (gymId: string, preferredClassId?: string): Phase5B2BOpsSnapshot => {
    ensurePreviewGymId(gymId);
    const selectedClassId = resolveSelectedClassId(preferredClassId);
    previewSelectedClassId = selectedClassId;

    return {
      ...createEmptySnapshot(),
      classes: [...previewClasses],
      selectedClassId,
      selectedClassBookings: selectedClassId
        ? previewBookings.filter((item) => item.classId === selectedClassId)
        : [],
      selectedClassWaitlist: selectedClassId
        ? previewWaitlist.filter((item) => item.classId === selectedClassId)
        : [],
      waivers: [...previewWaivers],
      contracts: [...previewContracts],
      recentCheckins: [...previewRecentCheckins],
      recentAccessLogs: [...previewRecentAccessLogs]
    };
  };

  const getAdminSupabase = () => {
    if (adminSupabase) return adminSupabase;
    adminSupabase = createAdminSupabaseClient();
    return adminSupabase;
  };

  const fallbackLoad = async (
    gymId: string,
    options?: Phase5B2BOpsLoadOptions
  ): Promise<Phase5OpsLoadResult> => ({
    ok: true,
    snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, options?.classId))
  });

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
    try {
      return await fn(f);
    } catch (error) {
      console.warn("[ops-console-runtime] action failed:", error);
      return fallbackFailed();
    }
  };

  return {
    load: (gymId, options) =>
      wrap(
        (f) => f.load(gymId, options),
        () => fallbackLoad(gymId, options),
        () => fallbackLoad(gymId, options)
      ),
    listClassSchedulingOptions: async (gymId) => {
      const catalog = getCatalogForGym(gymId);
      const fallback: ClassSchedulingOptions = {
        locations: [...catalog.locations],
        templates: [...catalog.templates],
        coaches: []
      };

      const f = await getFlow();
      if (!f) return fallback;

      try {
        const supabase = getAdminSupabase();
        const { data: memberships, error: membershipError } = await supabase
          .from("gym_memberships")
          .select("user_id,role")
          .eq("gym_id", gymId)
          .in("membership_status", ["trial", "active"])
          .in("role", ["leader", "officer", "coach"]);

        if (membershipError) {
          console.warn("[ops-console-runtime] unable to load coaches:", membershipError);
          return fallback;
        }

        const uniqueUserIds = Array.from(
          new Set(((memberships as GymMembershipStaffRow[]) ?? []).map((item) => item.user_id))
        );

        if (uniqueUserIds.length === 0) return fallback;

        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id,display_name,username")
          .in("id", uniqueUserIds);

        if (profileError) {
          console.warn("[ops-console-runtime] unable to load coach profiles:", profileError);
          return fallback;
        }

        const profileMap = new Map<string, ProfileRow>();
        for (const profile of (profiles as ProfileRow[]) ?? []) {
          profileMap.set(profile.id, profile);
        }

        const coaches = uniqueUserIds.map((userId) => {
          const profile = profileMap.get(userId);
          const displayName =
            profile?.display_name ??
            (profile?.username ? `@${profile.username}` : `${userId.slice(0, 8)}...`);

          return {
            userId,
            displayName
          };
        });

        coaches.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
          ...fallback,
          coaches
        };
      } catch (error) {
        console.warn("[ops-console-runtime] listClassSchedulingOptions failed:", error);
        return fallback;
      }
    },
    saveClassSchedulingOptions: async (gymId, input) => {
      try {
        const normalized = normalizeCatalog(input);
        catalogByGym.set(gymId, normalized);
        writeCatalogToStorage(gymId, normalized);
        const options = {
          locations: [...normalized.locations],
          templates: [...normalized.templates],
          coaches: [] as CoachOption[]
        };

        return { ok: true, options };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save class catalog.";
        console.warn("[ops-console-runtime] saveClassSchedulingOptions failed:", error);
        return {
          ok: false,
          error: { message }
        };
      }
    },
    createClass: (gymId, input) =>
      wrap(
        (f) => f.createClass(gymId, input),
        async () => {
          const timestamp = nowIso();
          const gymClass = {
            id: createPreviewId("class"),
            gymId,
            coachUserId: input.coachUserId ?? null,
            title: input.title,
            description: input.description ?? null,
            capacity: input.capacity,
            status: input.status ?? "scheduled",
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            bookingOpensAt: input.bookingOpensAt ?? null,
            bookingClosesAt: input.bookingClosesAt ?? null,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          previewClasses = [gymClass, ...previewClasses];
          previewSelectedClassId = gymClass.id;

          return {
            ok: true,
            action: "create_class",
            gymClass,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, gymClass.id))
          };
        },
        () => fallbackFailedMutation("Unable to create class.")
      ),
    updateClass: (gymId, classId, input) =>
      wrap(
        (f) => f.updateClass(gymId, classId, input),
        async () => {
          let gymClass: Phase5OpsMutationSuccess["gymClass"];
          previewClasses = previewClasses.map((item) => {
            if (item.id !== classId) return item;
            gymClass = {
              ...item,
              ...input,
              updatedAt: nowIso()
            };
            return gymClass;
          });

          return {
            ok: true,
            action: "update_class",
            gymClass,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, classId))
          };
        },
        () => fallbackFailedMutation("Unable to update class.")
      ),
    setClassStatus: (gymId, classId, status) =>
      wrap(
        (f) => f.setClassStatus(gymId, classId, status),
        async () => {
          let gymClass: Phase5OpsMutationSuccess["gymClass"];
          previewClasses = previewClasses.map((item) => {
            if (item.id !== classId) return item;
            gymClass = {
              ...item,
              status,
              updatedAt: nowIso()
            };
            return gymClass;
          });

          return {
            ok: true,
            action: "set_class_status",
            gymClass,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, classId))
          };
        },
        () => fallbackFailedMutation("Unable to set class status.")
      ),
    upsertClassBooking: (gymId, input) =>
      wrap(
        (f) => f.upsertClassBooking(gymId, input),
        async () => {
          const timestamp = nowIso();
          const existing = previewBookings.find(
            (item) => item.classId === input.classId && item.userId === input.userId
          );
          const booking = existing
            ? {
                ...existing,
                status: input.status ?? existing.status,
                checkedInAt: input.checkedInAt ?? existing.checkedInAt ?? null,
                sourceChannel: input.sourceChannel ?? existing.sourceChannel,
                updatedAt: timestamp
              }
            : {
                id: createPreviewId("booking"),
                classId: input.classId,
                userId: input.userId,
                status: input.status ?? "booked",
                bookedAt: timestamp,
                checkedInAt: input.checkedInAt ?? null,
                sourceChannel: input.sourceChannel ?? "admin_panel",
                updatedAt: timestamp
              };

          previewBookings = existing
            ? previewBookings.map((item) => (item.id === existing.id ? booking : item))
            : [booking, ...previewBookings];
          previewSelectedClassId = input.classId;

          return {
            ok: true,
            action: "upsert_booking",
            booking,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, input.classId))
          };
        },
        () => fallbackFailedMutation("Unable to upsert booking.")
      ),
    updateClassBookingStatus: (gymId, bookingId, status, classIdForRefresh) =>
      wrap(
        (f) => f.updateClassBookingStatus(gymId, bookingId, status, classIdForRefresh),
        async () => {
          let booking: Phase5OpsMutationSuccess["booking"];
          previewBookings = previewBookings.map((item) => {
            if (item.id !== bookingId) return item;
            booking = {
              ...item,
              status,
              updatedAt: nowIso()
            };
            return booking;
          });
          previewSelectedClassId = classIdForRefresh;

          return {
            ok: true,
            action: "update_booking_status",
            booking,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, classIdForRefresh))
          };
        },
        () => fallbackFailedMutation("Unable to update booking status.")
      ),
    updateWaitlistEntry: (gymId, waitlistEntryId, input, classIdForRefresh) =>
      wrap(
        (f) => f.updateWaitlistEntry(gymId, waitlistEntryId, input, classIdForRefresh),
        async () => {
          previewWaitlist = previewWaitlist.map((item) =>
            item.id === waitlistEntryId
              ? {
                  ...item,
                  ...input,
                  updatedAt: nowIso()
                }
              : item
          );
          previewSelectedClassId = classIdForRefresh;

          return {
            ok: true,
            action: "update_waitlist",
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, classIdForRefresh))
          };
        },
        () => fallbackFailedMutation("Unable to update waitlist entry.")
      ),
    promoteWaitlistMember: (gymId, classId) =>
      wrap(
        (f) => f.promoteWaitlistMember(gymId, classId),
        async () => {
          const candidate = previewWaitlist
            .filter((item) => item.classId === classId && item.status === "pending")
            .sort((a, b) => a.position - b.position)[0];
          let promotedBookingId: string | undefined;

          if (candidate) {
            const timestamp = nowIso();
            previewWaitlist = previewWaitlist.map((item) =>
              item.id === candidate.id
                ? {
                    ...item,
                    status: "promoted",
                    promotedAt: timestamp,
                    updatedAt: timestamp
                  }
                : item
            );

            const booking = {
              id: createPreviewId("booking"),
              classId,
              userId: candidate.userId,
              status: "booked",
              bookedAt: timestamp,
              checkedInAt: null,
              sourceChannel: "admin_panel",
              updatedAt: timestamp
            };
            previewBookings = [booking, ...previewBookings];
            promotedBookingId = booking.id;
          }

          previewSelectedClassId = classId;

          return {
            ok: true,
            action: "promote_waitlist",
            promotedBookingId,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, classId))
          };
        },
        () => fallbackFailedMutation("Unable to promote waitlist member.")
      ),
    recordCheckinAndAccessLog: (gymId, input, accessLogOverride) =>
      wrap(
        (f) => f.recordCheckinAndAccessLog(gymId, input, accessLogOverride),
        async () => {
          const timestamp = nowIso();
          const checkin = {
            id: createPreviewId("checkin"),
            gymId,
            userId: input.userId,
            membershipId: input.membershipId ?? null,
            classId: input.classId ?? null,
            eventType: input.eventType,
            result: input.result,
            sourceChannel: input.sourceChannel ?? "admin_panel",
            note: input.note ?? null,
            checkedInAt: input.checkedInAt ?? timestamp,
            createdBy: null,
            createdAt: timestamp
          };
          const accessLog = {
            id: createPreviewId("access"),
            gymId,
            userId: accessLogOverride?.userId ?? input.userId ?? null,
            checkinId: accessLogOverride?.checkinId ?? checkin.id,
            eventType: accessLogOverride?.eventType ?? input.eventType,
            result: accessLogOverride?.result ?? input.result,
            reason: accessLogOverride?.reason ?? null,
            metadata: accessLogOverride?.metadata ?? {},
            createdAt: timestamp,
            createdBy: null
          };

          previewRecentCheckins = [checkin, ...previewRecentCheckins].slice(0, 50);
          previewRecentAccessLogs = [accessLog, ...previewRecentAccessLogs].slice(0, 50);
          if (input.classId) previewSelectedClassId = input.classId;

          return {
            ok: true,
            action: "record_checkin_access",
            checkin,
            accessLog,
            snapshot: cloneSnapshot(buildPreviewSnapshot(gymId, input.classId))
          };
        },
        () => fallbackFailedMutation("Unable to record check-in.")
      ),
    recordWaiverAcceptance: (gymId, waiverId, input) =>
      wrap(
        (f) => f.recordWaiverAcceptance(gymId, waiverId, input),
        async () => ({
          ok: true,
          action: "record_waiver_acceptance",
          waiverAcceptanceId: createPreviewId("waiver_acceptance"),
          snapshot: cloneSnapshot(buildPreviewSnapshot(gymId))
        }),
        () => fallbackFailedMutation("Unable to record waiver acceptance.")
      ),
    recordContractAcceptance: (gymId, contractId, input) =>
      wrap(
        (f) => f.recordContractAcceptance(gymId, contractId, input),
        async () => ({
          ok: true,
          action: "record_contract_acceptance",
          contractAcceptanceId: createPreviewId("contract_acceptance"),
          snapshot: cloneSnapshot(buildPreviewSnapshot(gymId))
        }),
        () => fallbackFailedMutation("Unable to record contract acceptance.")
      )
  };
}
