import type {
  GymMembership,
  GymRole,
  MembershipStatus,
  MemberSubscription
} from "@kruxt/types";

import {
  B2BOpsService,
  createAdminSupabaseClient,
  GymAdminService,
  KruxtAdminError,
  type AdminMemberProfile
} from "../services";
import {
  createPhase2StaffConsoleUiFlow,
  phase2StaffConsoleUiChecklist,
  type StaffConsoleMutationResult
} from "./phase2-staff-console-ui";

export type MembersConsoleUiStep =
  | "search_filter"
  | "role_assignment"
  | "status_actions"
  | "bulk_actions"
  | "profile_panel"
  | "snapshot_refresh";

export type MembersConsoleStatusAction = MembershipStatus | "past_due";
export type MembersConsoleSegment =
  | "all"
  | "pending"
  | "trial"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled";

export type MembersConsoleColumnKey =
  | "member"
  | "role"
  | "membership_status"
  | "subscription_status"
  | "plan"
  | "last_checkin"
  | "privacy"
  | "joined_at";

export type MembersConsoleColumnPreset = "default" | "operations" | "billing" | "compliance";

export interface MembersConsoleLoadOptions {
  search?: string;
  segment?: MembersConsoleSegment;
  roles?: GymRole[];
  columnPreset?: MembersConsoleColumnPreset;
  selectedUserId?: string;
}

export interface MembersConsoleMemberRow {
  membershipId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: GymRole;
  membershipStatus: MembershipStatus;
  subscriptionStatus: MemberSubscription["status"] | null;
  effectiveStatus: Exclude<MembersConsoleSegment, "all">;
  membershipPlanId?: string | null;
  joinedAt?: string | null;
  lastCheckinAt?: string | null;
  openPrivacyRequests: number;
  isPending: boolean;
  canAssignRole: boolean;
}

export interface MembersConsoleTimelineEvent {
  id: string;
  kind: "membership" | "checkin" | "subscription" | "privacy_request";
  occurredAt: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface MembersConsoleProfilePanel {
  userId: string;
  profile: AdminMemberProfile | null;
  membership: MembersConsoleMemberRow;
  timeline: MembersConsoleTimelineEvent[];
}

export interface MembersConsoleQueueSummary {
  pendingMembershipCount: number;
  pendingWaitlistCount: number;
  openPrivacyRequestCount: number;
  upcomingClassCount: number;
}

export interface MembersConsoleSnapshot {
  gymId: string;
  query: Required<Pick<MembersConsoleLoadOptions, "search" | "segment" | "roles" | "columnPreset">>;
  queueSummary: MembersConsoleQueueSummary;
  rows: MembersConsoleMemberRow[];
  filteredRows: MembersConsoleMemberRow[];
  segmentCounts: Record<MembersConsoleSegment, number>;
  columnPresets: Record<MembersConsoleColumnPreset, MembersConsoleColumnKey[]>;
  visibleColumns: MembersConsoleColumnKey[];
  selectedProfilePanel: MembersConsoleProfilePanel | null;
  statusActions: MembersConsoleStatusAction[];
  roleActions: GymRole[];
  tableUx: {
    stickyHeader: true;
    supportsBulkActions: true;
    requiresAuditNoteForRoleChange: true;
  };
}

export interface MembersConsoleUiError {
  code: string;
  step: MembersConsoleUiStep;
  message: string;
  recoverable: boolean;
}

export interface MembersConsoleLoadSuccess {
  ok: true;
  snapshot: MembersConsoleSnapshot;
}

export interface MembersConsoleLoadFailure {
  ok: false;
  error: MembersConsoleUiError;
}

export type MembersConsoleLoadResult = MembersConsoleLoadSuccess | MembersConsoleLoadFailure;

export interface MembersConsoleMutationSuccess {
  ok: true;
  action: "assign_role" | "set_status" | "bulk_assign_role" | "bulk_set_status";
  updatedMembershipIds: string[];
  failedMembershipIds: string[];
  snapshot: MembersConsoleSnapshot;
}

export interface MembersConsoleMutationFailure {
  ok: false;
  error: MembersConsoleUiError;
}

export type MembersConsoleMutationResult = MembersConsoleMutationSuccess | MembersConsoleMutationFailure;

const COLUMN_PRESETS: Record<MembersConsoleColumnPreset, MembersConsoleColumnKey[]> = {
  default: ["member", "role", "membership_status", "subscription_status", "plan", "last_checkin", "joined_at"],
  operations: ["member", "role", "membership_status", "last_checkin", "privacy", "joined_at"],
  billing: ["member", "membership_status", "subscription_status", "plan", "privacy", "joined_at"],
  compliance: ["member", "role", "membership_status", "privacy", "last_checkin", "joined_at"]
};

const MEMBERSHIP_STATUS_ACTIONS: MembersConsoleStatusAction[] = [
  "trial",
  "active",
  "past_due",
  "paused",
  "cancelled"
];

const ROLE_ACTIONS: GymRole[] = ["leader", "officer", "coach", "member"];

export const phase5MembersConsoleUiChecklist = [
  ...phase2StaffConsoleUiChecklist,
  "Load searchable/segmented member rows for desktop operations",
  "Support bulk status and role actions for staff operators",
  "Require audit notes for every role-change action",
  "Render profile side panel with timeline context"
] as const;

function normalizeSearch(search: string): string {
  return search.trim().toLowerCase();
}

function includesSearch(row: MembersConsoleMemberRow, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = `${row.displayName} ${row.username} ${row.userId}`.toLowerCase();
  return haystack.includes(search);
}

function resolveEffectiveStatus(
  membershipStatus: MembershipStatus,
  subscriptionStatus: MemberSubscription["status"] | null
): Exclude<MembersConsoleSegment, "all"> {
  if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
    return "past_due";
  }

  if (membershipStatus === "pending") {
    return "pending";
  }
  if (membershipStatus === "trial") {
    return "trial";
  }
  if (membershipStatus === "active") {
    return "active";
  }
  if (membershipStatus === "paused") {
    return "paused";
  }
  return "cancelled";
}

function buildSegmentCounts(rows: MembersConsoleMemberRow[]): Record<MembersConsoleSegment, number> {
  const counts: Record<MembersConsoleSegment, number> = {
    all: rows.length,
    pending: 0,
    trial: 0,
    active: 0,
    past_due: 0,
    paused: 0,
    cancelled: 0
  };

  for (const row of rows) {
    counts[row.effectiveStatus] += 1;
  }

  return counts;
}

function applyFilters(rows: MembersConsoleMemberRow[], options: MembersConsoleLoadOptions): MembersConsoleMemberRow[] {
  const search = normalizeSearch(options.search ?? "");
  const selectedRoles = options.roles ?? [];
  const segment = options.segment ?? "all";

  return rows
    .filter((row) => includesSearch(row, search))
    .filter((row) => (segment === "all" ? true : row.effectiveStatus === segment))
    .filter((row) => (selectedRoles.length > 0 ? selectedRoles.includes(row.role) : true));
}

function mapErrorStep(code: string): MembersConsoleUiStep {
  if (code.includes("AUDIT_NOTE")) {
    return "role_assignment";
  }
  if (code.includes("BULK")) {
    return "bulk_actions";
  }
  if (code.includes("STATUS") || code.includes("SUBSCRIPTION")) {
    return "status_actions";
  }
  if (code.includes("PROFILE") || code.includes("TIMELINE")) {
    return "profile_panel";
  }
  if (code.includes("MEMBERSHIP") || code.includes("ROLE_ASSIGN")) {
    return "search_filter";
  }
  return "snapshot_refresh";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "MEMBERS_CONSOLE_AUDIT_NOTE_REQUIRED") {
    return "Role changes require an audit note.";
  }
  if (code === "MEMBERS_CONSOLE_MEMBERSHIP_NOT_FOUND") {
    return "Membership record not found. Refresh and retry.";
  }
  if (code === "ADMIN_STAFF_ACCESS_DENIED") {
    return "Staff access is required to use members console actions.";
  }
  return fallback;
}

function mapUiError(error: unknown): MembersConsoleUiError {
  const appError =
    error instanceof KruxtAdminError
      ? error
      : new KruxtAdminError("ADMIN_MEMBERS_CONSOLE_ACTION_FAILED", "Unable to complete members action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: !["ADMIN_AUTH_REQUIRED", "ADMIN_STAFF_ACCESS_DENIED"].includes(appError.code)
  };
}

function assertRoleAuditNote(note: string): void {
  if (note.trim().length < 5) {
    throw new KruxtAdminError("MEMBERS_CONSOLE_AUDIT_NOTE_REQUIRED", "Role change audit note is required.");
  }
}

function throwIfPhase2MutationFailed(result: StaffConsoleMutationResult): void {
  if (!result.ok) {
    throw new KruxtAdminError(result.error.code, result.error.message);
  }
}

function buildTimeline(
  membershipRow: MembersConsoleMemberRow,
  membership: GymMembership,
  profile: AdminMemberProfile | null,
  subscription: MemberSubscription | null,
  checkins: Array<{ checkedInAt: string; result: string; sourceChannel: string }>,
  privacyRequestCount: number
): MembersConsoleTimelineEvent[] {
  const events: MembersConsoleTimelineEvent[] = [];

  events.push({
    id: `membership:${membership.id}`,
    kind: "membership",
    occurredAt: membership.startedAt ?? profile?.createdAt ?? new Date(0).toISOString(),
    title: "Membership state",
    detail: `Role ${membership.role}, status ${membership.membershipStatus}.`,
    tone: membership.membershipStatus === "active" || membership.membershipStatus === "trial" ? "positive" : "warning"
  });

  if (subscription) {
    events.push({
      id: `subscription:${subscription.id}`,
      kind: "subscription",
      occurredAt: subscription.updatedAt,
      title: "Billing state",
      detail: `Subscription status ${subscription.status}.`,
      tone:
        subscription.status === "active" || subscription.status === "trialing"
          ? "positive"
          : subscription.status === "past_due" || subscription.status === "unpaid"
            ? "critical"
            : "warning"
    });
  }

  for (const checkin of checkins.slice(0, 10)) {
    events.push({
      id: `checkin:${membership.id}:${checkin.checkedInAt}`,
      kind: "checkin",
      occurredAt: checkin.checkedInAt,
      title: "Gym access event",
      detail: `Result ${checkin.result} via ${checkin.sourceChannel}.`,
      tone: checkin.result === "allowed" ? "positive" : "warning"
    });
  }

  if (privacyRequestCount > 0) {
    events.push({
      id: `privacy:${membership.id}`,
      kind: "privacy_request",
      occurredAt: new Date().toISOString(),
      title: "Open privacy requests",
      detail: `${privacyRequestCount} request(s) currently open.`,
      tone: "warning"
    });
  }

  return events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

function buildNormalizedOptions(options: MembersConsoleLoadOptions): Required<Pick<MembersConsoleLoadOptions, "search" | "segment" | "roles" | "columnPreset">> {
  return {
    search: options.search ?? "",
    segment: options.segment ?? "all",
    roles: options.roles ?? [],
    columnPreset: options.columnPreset ?? "default"
  };
}

export function createPhase5MembersConsoleUiFlow() {
  const supabase = createAdminSupabaseClient();
  const admin = new GymAdminService(supabase);
  const b2b = new B2BOpsService(supabase);
  const phase2 = createPhase2StaffConsoleUiFlow();

  const loadSnapshot = async (
    gymId: string,
    options: MembersConsoleLoadOptions = {}
  ): Promise<MembersConsoleSnapshot> => {
    const queueResult = await phase2.load(gymId);
    if (!queueResult.ok) {
      throw new KruxtAdminError(queueResult.error.code, queueResult.error.message);
    }

    const memberships = queueResult.snapshot.memberships;
    const userIds = Array.from(new Set(memberships.map((membership) => membership.userId)));

    const [profiles, subscriptions, recentCheckins] = await Promise.all([
      admin.listGymMemberProfiles(gymId, userIds),
      b2b.listMemberSubscriptions(gymId, 500),
      b2b.listRecentCheckins(gymId, 800)
    ]);

    const profileByUserId = new Map<string, AdminMemberProfile>();
    for (const profile of profiles) {
      profileByUserId.set(profile.id, profile);
    }

    const subscriptionByUserId = new Map<string, MemberSubscription>();
    for (const subscription of subscriptions) {
      if (!subscriptionByUserId.has(subscription.userId)) {
        subscriptionByUserId.set(subscription.userId, subscription);
      }
    }

    const lastCheckinByUserId = new Map<string, { checkedInAt: string; result: string; sourceChannel: string }>();
    for (const checkin of recentCheckins) {
      if (!lastCheckinByUserId.has(checkin.userId)) {
        lastCheckinByUserId.set(checkin.userId, {
          checkedInAt: checkin.checkedInAt,
          result: checkin.result,
          sourceChannel: checkin.sourceChannel
        });
      }
    }

    const openPrivacyCountByUserId = new Map<string, number>();
    for (const request of queueResult.snapshot.openPrivacyRequests) {
      openPrivacyCountByUserId.set(request.userId, (openPrivacyCountByUserId.get(request.userId) ?? 0) + 1);
    }

    const rows: MembersConsoleMemberRow[] = memberships.map((membership) => {
      const profile = profileByUserId.get(membership.userId);
      const subscription = subscriptionByUserId.get(membership.userId) ?? null;
      const lastCheckin = lastCheckinByUserId.get(membership.userId);
      const effectiveStatus = resolveEffectiveStatus(membership.membershipStatus, subscription?.status ?? null);

      return {
        membershipId: membership.id,
        userId: membership.userId,
        username: profile?.username ?? membership.userId.slice(0, 8),
        displayName: profile?.displayName ?? profile?.username ?? membership.userId.slice(0, 8),
        avatarUrl: profile?.avatarUrl,
        role: membership.role,
        membershipStatus: membership.membershipStatus,
        subscriptionStatus: subscription?.status ?? null,
        effectiveStatus,
        membershipPlanId: membership.membershipPlanId,
        joinedAt: membership.startedAt,
        lastCheckinAt: lastCheckin?.checkedInAt,
        openPrivacyRequests: openPrivacyCountByUserId.get(membership.userId) ?? 0,
        isPending: membership.membershipStatus === "pending",
        canAssignRole: membership.membershipStatus === "active" || membership.membershipStatus === "trial"
      };
    });

    const normalizedOptions = buildNormalizedOptions(options);
    const filteredRows = applyFilters(rows, options);
    const segmentCounts = buildSegmentCounts(rows);
    const selectedUserId = options.selectedUserId ?? filteredRows[0]?.userId ?? rows[0]?.userId;

    let selectedProfilePanel: MembersConsoleProfilePanel | null = null;
    if (selectedUserId) {
      const selectedRow = rows.find((row) => row.userId === selectedUserId);
      const selectedMembership = memberships.find((membership) => membership.userId === selectedUserId);

      if (selectedRow && selectedMembership) {
        const selectedProfile = profileByUserId.get(selectedUserId) ?? null;
        const selectedSubscription = subscriptionByUserId.get(selectedUserId) ?? null;
        const selectedCheckins = recentCheckins
          .filter((checkin) => checkin.userId === selectedUserId)
          .map((checkin) => ({
            checkedInAt: checkin.checkedInAt,
            result: checkin.result,
            sourceChannel: checkin.sourceChannel
          }));

        selectedProfilePanel = {
          userId: selectedUserId,
          profile: selectedProfile,
          membership: selectedRow,
          timeline: buildTimeline(
            selectedRow,
            selectedMembership,
            selectedProfile,
            selectedSubscription,
            selectedCheckins,
            selectedRow.openPrivacyRequests
          )
        };
      }
    }

    return {
      gymId,
      query: normalizedOptions,
      queueSummary: {
        pendingMembershipCount: queueResult.snapshot.pendingMemberships.length,
        pendingWaitlistCount: queueResult.snapshot.pendingWaitlist.length,
        openPrivacyRequestCount: queueResult.snapshot.openPrivacyRequests.length,
        upcomingClassCount: queueResult.snapshot.upcomingClasses.length
      },
      rows,
      filteredRows,
      segmentCounts,
      columnPresets: COLUMN_PRESETS,
      visibleColumns: COLUMN_PRESETS[normalizedOptions.columnPreset],
      selectedProfilePanel,
      statusActions: MEMBERSHIP_STATUS_ACTIONS,
      roleActions: ROLE_ACTIONS,
      tableUx: {
        stickyHeader: true,
        supportsBulkActions: true,
        requiresAuditNoteForRoleChange: true
      }
    };
  };

  const markPastDue = async (gymId: string, membershipId: string): Promise<void> => {
    const memberships = await admin.listGymMemberships(gymId);
    const target = memberships.find((membership) => membership.id === membershipId);
    if (!target) {
      throw new KruxtAdminError("MEMBERS_CONSOLE_MEMBERSHIP_NOT_FOUND", "Membership not found.");
    }

    const subscriptions = await b2b.listMemberSubscriptions(gymId, 500);
    const existing =
      subscriptions.find((subscription) => subscription.userId === target.userId && subscription.membershipPlanId === target.membershipPlanId) ??
      subscriptions.find((subscription) => subscription.userId === target.userId);

    await b2b.upsertMemberSubscription(
      gymId,
      {
        userId: target.userId,
        membershipPlanId: target.membershipPlanId ?? existing?.membershipPlanId ?? undefined,
        status: "past_due",
        provider: existing?.provider ?? "stripe",
        providerCustomerId: existing?.providerCustomerId ?? undefined,
        providerSubscriptionId: existing?.providerSubscriptionId ?? undefined,
        currentPeriodStart: existing?.currentPeriodStart ?? undefined,
        currentPeriodEnd: existing?.currentPeriodEnd ?? undefined,
        trialEndsAt: existing?.trialEndsAt ?? undefined,
        cancelAt: existing?.cancelAt ?? undefined,
        canceledAt: existing?.canceledAt ?? undefined,
        paymentMethodLast4: existing?.paymentMethodLast4 ?? undefined,
        paymentMethodBrand: existing?.paymentMethodBrand ?? undefined,
        metadata: {
          ...(existing?.metadata ?? {}),
          marked_past_due_by_ui: true
        }
      },
      existing?.id
    );
  };

  const runSingleMutation = async (
    gymId: string,
    action: MembersConsoleMutationSuccess["action"],
    membershipId: string,
    mutate: () => Promise<void>,
    options: MembersConsoleLoadOptions = {}
  ): Promise<MembersConsoleMutationResult> => {
    try {
      await mutate();
      const snapshot = await loadSnapshot(gymId, options);
      return {
        ok: true,
        action,
        updatedMembershipIds: [membershipId],
        failedMembershipIds: [],
        snapshot
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  const runBulkMutation = async (
    gymId: string,
    action: MembersConsoleMutationSuccess["action"],
    membershipIds: string[],
    mutate: (membershipId: string) => Promise<void>,
    options: MembersConsoleLoadOptions = {}
  ): Promise<MembersConsoleMutationResult> => {
    const uniqueMembershipIds = Array.from(new Set(membershipIds));
    const failedMembershipIds: string[] = [];
    const updatedMembershipIds: string[] = [];

    for (const membershipId of uniqueMembershipIds) {
      try {
        await mutate(membershipId);
        updatedMembershipIds.push(membershipId);
      } catch {
        failedMembershipIds.push(membershipId);
      }
    }

    if (updatedMembershipIds.length === 0 && failedMembershipIds.length > 0) {
      return {
        ok: false,
        error: mapUiError(new KruxtAdminError("MEMBERS_CONSOLE_BULK_ACTION_FAILED", "No selected rows were updated."))
      };
    }

    try {
      const snapshot = await loadSnapshot(gymId, options);
      return {
        ok: true,
        action,
        updatedMembershipIds,
        failedMembershipIds,
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
    checklist: [...phase5MembersConsoleUiChecklist],
    statusActions: [...MEMBERSHIP_STATUS_ACTIONS],
    roleActions: [...ROLE_ACTIONS],
    columnPresets: { ...COLUMN_PRESETS },
    load: async (gymId: string, options: MembersConsoleLoadOptions = {}): Promise<MembersConsoleLoadResult> => {
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
    assignRole: async (
      gymId: string,
      membershipId: string,
      role: GymRole,
      auditNote: string,
      options: MembersConsoleLoadOptions = {}
    ): Promise<MembersConsoleMutationResult> =>
      runSingleMutation(
        gymId,
        "assign_role",
        membershipId,
        async () => {
          assertRoleAuditNote(auditNote);
          const mutation = await phase2.assignMembershipRole(gymId, membershipId, role);
          throwIfPhase2MutationFailed(mutation);
        },
        options
      ),
    setStatus: async (
      gymId: string,
      membershipId: string,
      status: MembersConsoleStatusAction,
      options: MembersConsoleLoadOptions = {}
    ): Promise<MembersConsoleMutationResult> =>
      runSingleMutation(
        gymId,
        "set_status",
        membershipId,
        async () => {
          if (status === "past_due") {
            await markPastDue(gymId, membershipId);
            return;
          }

          const mutation = await phase2.setMembershipStatus(gymId, membershipId, status);
          throwIfPhase2MutationFailed(mutation);
        },
        options
      ),
    bulkAssignRole: async (
      gymId: string,
      membershipIds: string[],
      role: GymRole,
      auditNote: string,
      options: MembersConsoleLoadOptions = {}
    ): Promise<MembersConsoleMutationResult> =>
      runBulkMutation(
        gymId,
        "bulk_assign_role",
        membershipIds,
        async (membershipId) => {
          assertRoleAuditNote(auditNote);
          await admin.assignMembershipRole(gymId, membershipId, role);
        },
        options
      ),
    bulkSetStatus: async (
      gymId: string,
      membershipIds: string[],
      status: MembersConsoleStatusAction,
      options: MembersConsoleLoadOptions = {}
    ): Promise<MembersConsoleMutationResult> =>
      runBulkMutation(
        gymId,
        "bulk_set_status",
        membershipIds,
        async (membershipId) => {
          if (status === "past_due") {
            await markPastDue(gymId, membershipId);
            return;
          }

          await admin.updateMembershipStatus(gymId, membershipId, status);
        },
        options
      )
  };
}
