import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGymInviteCodeInput,
  CreateMemberWorkoutPlanInput,
  CreateStaffShiftInput,
  ConsentRecord,
  GymInviteCode,
  GymJoinRequest,
  GymJoinRequestSource,
  GymJoinRequestStatus,
  GymMembership,
  GymOpsSummary,
  GymRole,
  IncidentStatus,
  MemberWorkoutPlan,
  MemberWorkoutPlanStatus,
  MembershipStatus,
  PolicyVersion,
  PrivacyRequestStatus,
  ReviewGymJoinRequestInput,
  StaffShift,
  StaffShiftStatus,
  UpdateGymInviteCodeInput,
  UpdateStaffShiftInput
} from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type OpenPrivacyRequestStatus = Extract<PrivacyRequestStatus, "submitted" | "triaged" | "in_progress">;

type MembershipRow = {
  id: string;
  gym_id: string;
  user_id: string;
  coach_user_id?: string | null;
  role: GymRole;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  started_at: string | null;
  ends_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
};

type MembershipPlanRow = {
  id: string;
  name: string;
};

type ConsentRow = {
  id: string;
  user_id: string;
  consent_type: ConsentRecord["consentType"];
  policy_version_id: string | null;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  source: string;
  locale: string | null;
};

type OpenPrivacyRequestRow = {
  id: string;
  user_id: string;
  request_type: "access" | "export" | "delete" | "rectify" | "restrict_processing";
  status: OpenPrivacyRequestStatus;
  submitted_at: string;
  due_at: string | null;
  sla_breached_at: string | null;
  is_overdue: boolean;
};

type GymOpsSummaryRow = {
  gym_id: string;
  pending_memberships: number;
  active_or_trial_members: number;
  upcoming_classes: number;
  pending_waitlist_entries: number;
  open_privacy_requests: number;
};

type PrivacyOpsMetricsRow = {
  gym_id: string;
  open_requests: number;
  overdue_requests: number;
  avg_completion_hours: number;
  fulfilled_requests_window: number;
  rejected_requests_window: number;
  measured_window_days: number;
};

type PolicyVersionRow = {
  id: string;
  policy_type: PolicyVersion["policyType"];
  version: string;
  label: string | null;
  document_url: string;
  effective_at: string;
  is_active: boolean;
  published_at: string;
  requires_reconsent: boolean;
  change_summary: string | null;
  supersedes_policy_version_id: string | null;
};

type WaitlistWithClassRow = {
  id: string;
  class_id: string;
  user_id: string;
  position: number;
  status: "pending" | "promoted" | "expired" | "cancelled";
  created_at: string;
  gym_classes:
    | {
        id: string;
        gym_id: string;
        title: string;
        starts_at: string;
      }
    | Array<{
        id: string;
        gym_id: string;
        title: string;
        starts_at: string;
      }>
    | null;
};

type GymClassRow = {
  id: string;
  gym_id: string;
  title: string;
  status: "scheduled" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string;
  capacity: number;
};

type StaffShiftRow = {
  id: string;
  gym_id: string;
  staff_user_id: string;
  created_by: string | null;
  title: string;
  shift_role: string | null;
  starts_at: string;
  ends_at: string;
  status: StaffShiftStatus;
  hourly_rate_cents: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type MemberWorkoutPlanRow = {
  id: string;
  gym_id: string;
  member_user_id: string;
  coach_user_id: string | null;
  title: string;
  goal: string | null;
  status: MemberWorkoutPlanStatus;
  starts_at: string | null;
  ends_at: string | null;
  plan_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type GymInviteCodeRow = {
  id: string;
  gym_id: string;
  code: string;
  label: string | null;
  role: GymRole;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GymJoinRequestRow = {
  id: string;
  gym_id: string;
  user_id: string;
  requested_membership_plan_id: string | null;
  source: GymJoinRequestSource;
  invite_code_id: string | null;
  status: GymJoinRequestStatus;
  note: string | null;
  staff_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SecurityIncidentRow = {
  id: string;
  gym_id: string | null;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: IncidentStatus;
  drill_mode: boolean;
  detected_at: string;
  requires_ftc_notice: boolean;
  requires_gdpr_notice: boolean;
  ftc_notice_due_at: string | null;
  gdpr_notice_due_at: string | null;
  next_deadline_at: string | null;
  next_deadline_label: "ftc" | "gdpr" | "mixed" | null;
  seconds_to_next_deadline: number | null;
  is_deadline_breached: boolean;
  affected_user_count: number;
  affected_gym_count: number;
  updated_at: string;
};

export interface OpenPrivacyRequest {
  id: string;
  userId: string;
  type: OpenPrivacyRequestRow["request_type"];
  status: OpenPrivacyRequestStatus;
  submittedAt: string;
  dueAt?: string | null;
  slaBreachedAt?: string | null;
  isOverdue: boolean;
}

export interface PendingWaitlistEntry {
  id: string;
  classId: string;
  classTitle: string;
  classStartsAt: string;
  userId: string;
  position: number;
  status: "pending" | "promoted" | "expired" | "cancelled";
  createdAt: string;
}

export interface GymClassScheduleItem {
  id: string;
  gymId: string;
  title: string;
  status: "scheduled" | "cancelled" | "completed";
  startsAt: string;
  endsAt: string;
  capacity: number;
}

export interface SecurityIncidentOperatorItem {
  id: string;
  gymId?: string | null;
  title: string;
  severity: SecurityIncidentRow["severity"];
  status: IncidentStatus;
  drillMode: boolean;
  detectedAt: string;
  requiresFtcNotice: boolean;
  requiresGdprNotice: boolean;
  ftcNoticeDueAt?: string | null;
  gdprNoticeDueAt?: string | null;
  nextDeadlineAt?: string | null;
  nextDeadlineLabel?: "ftc" | "gdpr" | "mixed" | null;
  secondsToNextDeadline?: number | null;
  isDeadlineBreached: boolean;
  affectedUserCount: number;
  affectedGymCount: number;
  updatedAt: string;
}

export interface PrivacyOpsMetrics {
  gymId: string;
  openRequests: number;
  overdueRequests: number;
  avgCompletionHours: number;
  fulfilledRequestsWindow: number;
  rejectedRequestsWindow: number;
  measuredWindowDays: number;
}

export interface StaffProfileOption {
  userId: string;
  displayName: string;
  username: string;
  label: string;
}

export interface MemberProfileSummary {
  userId: string;
  displayName: string;
  username: string;
  label: string;
}

export interface GymMemberDirectoryItem extends GymMembership {
  profile?: MemberProfileSummary;
  coachProfile?: MemberProfileSummary | null;
  membershipPlanName?: string | null;
  latestWorkoutPlan?: MemberWorkoutPlan | null;
}

export interface GymJoinRequestDirectoryItem extends GymJoinRequest {
  profile?: MemberProfileSummary;
  membershipPlanName?: string | null;
  inviteLabel?: string | null;
}

function mapMembership(row: MembershipRow): GymMembership {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    coachUserId: row.coach_user_id ?? null,
    role: row.role,
    membershipStatus: row.membership_status,
    membershipPlanId: row.membership_plan_id,
    startedAt: row.started_at,
    endsAt: row.ends_at
  };
}

function profileLabel(profile?: ProfileRow | null): MemberProfileSummary | undefined {
  if (!profile) {
    return undefined;
  }

  const displayName = profile.display_name?.trim() || "Unnamed member";
  const username = profile.username?.trim() || "";
  return {
    userId: profile.id,
    displayName,
    username,
    label: username ? `${displayName} (@${username})` : displayName
  };
}

function mapStaffShift(row: StaffShiftRow): StaffShift {
  return {
    id: row.id,
    gymId: row.gym_id,
    staffUserId: row.staff_user_id,
    createdBy: row.created_by,
    title: row.title,
    shiftRole: row.shift_role,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    hourlyRateCents: row.hourly_rate_cents,
    notes: row.notes,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMemberWorkoutPlan(row: MemberWorkoutPlanRow): MemberWorkoutPlan {
  return {
    id: row.id,
    gymId: row.gym_id,
    memberUserId: row.member_user_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    planJson: row.plan_json ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymInviteCode(row: GymInviteCodeRow): GymInviteCode {
  return {
    id: row.id,
    gymId: row.gym_id,
    code: row.code,
    label: row.label,
    role: row.role,
    membershipStatus: row.membership_status,
    membershipPlanId: row.membership_plan_id,
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdBy: row.created_by,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGymJoinRequest(row: GymJoinRequestRow): GymJoinRequest {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    requestedMembershipPlanId: row.requested_membership_plan_id,
    source: row.source,
    inviteCodeId: row.invite_code_id,
    status: row.status,
    note: row.note,
    staffNote: row.staff_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    consentType: row.consent_type,
    policyVersionId: row.policy_version_id,
    granted: row.granted,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    source: row.source,
    locale: row.locale
  };
}

function mapOpsSummary(row: GymOpsSummaryRow): GymOpsSummary {
  return {
    gymId: row.gym_id,
    pendingMemberships: row.pending_memberships,
    activeOrTrialMembers: row.active_or_trial_members,
    upcomingClasses: row.upcoming_classes,
    pendingWaitlistEntries: row.pending_waitlist_entries,
    openPrivacyRequests: row.open_privacy_requests
  };
}

function mapPolicyVersion(row: PolicyVersionRow): PolicyVersion {
  return {
    id: row.id,
    policyType: row.policy_type,
    version: row.version,
    label: row.label,
    documentUrl: row.document_url,
    effectiveAt: row.effective_at,
    isActive: row.is_active,
    publishedAt: row.published_at,
    requiresReconsent: row.requires_reconsent,
    changeSummary: row.change_summary,
    supersedesPolicyVersionId: row.supersedes_policy_version_id
  };
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  globalThis.crypto?.getRandomValues(bytes);

  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `KRUXT-${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

function normalizeInviteCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 64);
}

export class GymAdminService {
  private readonly access: StaffAccessService;

  constructor(private readonly supabase: SupabaseClient) {
    this.access = new StaffAccessService(supabase);
  }

  async listGymMemberships(gymId: string): Promise<GymMembership[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });

    throwIfAdminError(error, "ADMIN_MEMBERSHIP_LIST_FAILED", "Unable to list gym memberships.");

    return (data as MembershipRow[]).map(mapMembership);
  }

  async listGymMemberDirectory(gymId: string): Promise<GymMemberDirectoryItem[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });

    throwIfAdminError(error, "ADMIN_MEMBERSHIP_LIST_FAILED", "Unable to list gym memberships.");

    const rows = (data as MembershipRow[]) ?? [];
    if (rows.length === 0) {
      return [];
    }

    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.user_id, row.coach_user_id])
          .filter((value): value is string => Boolean(value))
      )
    );
    const planIds = Array.from(
      new Set(rows.map((row) => row.membership_plan_id).filter((value): value is string => Boolean(value)))
    );

    const profileMap = new Map<string, MemberProfileSummary>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await this.supabase
        .from("profiles")
        .select("id,display_name,username")
        .in("id", userIds);

      throwIfAdminError(profileError, "ADMIN_PROFILE_LIST_FAILED", "Unable to load member profiles.");

      for (const profile of (profiles as ProfileRow[]) ?? []) {
        const mapped = profileLabel(profile);
        if (mapped) {
          profileMap.set(mapped.userId, mapped);
        }
      }
    }

    const planMap = new Map<string, string>();
    if (planIds.length > 0) {
      const { data: plans, error: planError } = await this.supabase
        .from("gym_membership_plans")
        .select("id,name")
        .eq("gym_id", gymId)
        .in("id", planIds);

      throwIfAdminError(planError, "ADMIN_PLAN_LIST_FAILED", "Unable to load membership plan labels.");

      for (const plan of (plans as MembershipPlanRow[]) ?? []) {
        planMap.set(plan.id, plan.name);
      }
    }

    const latestPlanMap = new Map<string, MemberWorkoutPlan>();
    const { data: workoutPlans, error: workoutPlanError } = await this.supabase
      .from("gym_member_workout_plans")
      .select("*")
      .eq("gym_id", gymId)
      .in("member_user_id", rows.map((row) => row.user_id))
      .order("updated_at", { ascending: false });

    if (!workoutPlanError) {
      for (const plan of (workoutPlans as MemberWorkoutPlanRow[]) ?? []) {
        if (!latestPlanMap.has(plan.member_user_id)) {
          latestPlanMap.set(plan.member_user_id, mapMemberWorkoutPlan(plan));
        }
      }
    }

    return rows.map((row) => ({
      ...mapMembership(row),
      profile: profileMap.get(row.user_id),
      coachProfile: row.coach_user_id ? profileMap.get(row.coach_user_id) ?? null : null,
      membershipPlanName: row.membership_plan_id ? planMap.get(row.membership_plan_id) ?? null : null,
      latestWorkoutPlan: latestPlanMap.get(row.user_id) ?? null
    }));
  }

  async listPendingMemberships(gymId: string): Promise<GymMembership[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("*")
      .eq("gym_id", gymId)
      .eq("membership_status", "pending")
      .order("created_at", { ascending: true });

    throwIfAdminError(error, "ADMIN_PENDING_MEMBERSHIPS_FAILED", "Unable to list pending memberships.");

    return (data as MembershipRow[]).map(mapMembership);
  }

  async updateMembershipStatus(
    gymId: string,
    membershipId: string,
    membershipStatus: MembershipStatus
  ): Promise<GymMembership> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .update({ membership_status: membershipStatus })
      .eq("id", membershipId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_MEMBERSHIP_UPDATE_FAILED", "Unable to update membership status.");

    return mapMembership(data as MembershipRow);
  }

  async assignMembershipRole(gymId: string, membershipId: string, role: GymRole): Promise<GymMembership> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .update({ role })
      .eq("id", membershipId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_ROLE_ASSIGN_FAILED", "Unable to assign gym role.");

    return mapMembership(data as MembershipRow);
  }

  async assignMembershipCoach(
    gymId: string,
    membershipId: string,
    coachUserId: string | null
  ): Promise<GymMembership> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .update({ coach_user_id: coachUserId?.trim() || null })
      .eq("id", membershipId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_COACH_ASSIGN_FAILED", "Unable to assign personal trainer.");

    return mapMembership(data as MembershipRow);
  }

  async approveMembership(gymId: string, membershipId: string): Promise<GymMembership> {
    return this.updateMembershipStatus(gymId, membershipId, "active");
  }

  async addOrUpdateMembership(
    gymId: string,
    input: {
      userId: string;
      role: GymRole;
      membershipStatus: MembershipStatus;
      membershipPlanId?: string | null;
      startedAt?: string | null;
      endsAt?: string | null;
    }
  ): Promise<GymMembership> {
    await this.access.requireGymStaff(gymId);

    const userId = input.userId.trim();
    if (!userId) {
      throw new KruxtAdminError("ADMIN_MEMBERSHIP_USER_REQUIRED", "User id is required.");
    }

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .upsert(
        {
          gym_id: gymId,
          user_id: userId,
          role: input.role,
          membership_status: input.membershipStatus,
          membership_plan_id: input.membershipPlanId ?? null,
          started_at: input.startedAt ?? null,
          ends_at: input.endsAt ?? null
        },
        { onConflict: "gym_id,user_id" }
      )
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_MEMBERSHIP_UPSERT_FAILED", "Unable to add or update membership.");

    return mapMembership(data as MembershipRow);
  }

  async searchProfiles(gymId: string, search: string, limit = 20): Promise<StaffProfileOption[]> {
    await this.access.requireGymStaff(gymId);

    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const needle = search.trim().replace(/[^a-zA-Z0-9@._\-\s]/g, " ");

    let query = this.supabase
      .from("profiles")
      .select("id,display_name,username")
      .order("updated_at", { ascending: false })
      .limit(boundedLimit);

    if (needle.length > 0) {
      query = query.or(`display_name.ilike.%${needle}%,username.ilike.%${needle}%`);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_PROFILE_SEARCH_FAILED", "Unable to search member profiles.");

    return ((data as ProfileRow[]) ?? []).flatMap((profile) => {
      const mapped = profileLabel(profile);
      return mapped ? [mapped] : [];
    });
  }

  async listGymInviteCodes(gymId: string): Promise<GymInviteCode[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_invite_codes")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });

    throwIfAdminError(error, "ADMIN_INVITE_CODE_LIST_FAILED", "Unable to load invite codes.");

    return ((data as GymInviteCodeRow[]) ?? []).map(mapGymInviteCode);
  }

  async createGymInviteCode(gymId: string, input: CreateGymInviteCodeInput = {}): Promise<GymInviteCode> {
    const staff = await this.access.requireGymStaff(gymId);
    const code = normalizeInviteCode(input.code || generateInviteCode());

    if (code.length < 4) {
      throw new KruxtAdminError("ADMIN_INVITE_CODE_INVALID", "Invite code must be at least 4 characters.");
    }

    if (input.membershipPlanId) {
      const { data: plan, error: planError } = await this.supabase
        .from("gym_membership_plans")
        .select("id")
        .eq("id", input.membershipPlanId)
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .maybeSingle();

      throwIfAdminError(planError, "ADMIN_INVITE_PLAN_READ_FAILED", "Unable to validate invite membership plan.");
      if (!plan) {
        throw new KruxtAdminError("ADMIN_INVITE_PLAN_INVALID", "Invite membership plan must belong to this gym.");
      }
    }

    const { data, error } = await this.supabase
      .from("gym_invite_codes")
      .insert({
        gym_id: gymId,
        code,
        label: input.label?.trim() || null,
        role: input.role ?? "member",
        membership_status: input.membershipStatus ?? "active",
        membership_plan_id: input.membershipPlanId ?? null,
        max_redemptions: input.maxRedemptions ?? null,
        expires_at: input.expiresAt ?? null,
        is_active: true,
        created_by: staff.user_id,
        metadata: input.metadata ?? {}
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_INVITE_CODE_CREATE_FAILED", "Unable to create invite code.");

    return mapGymInviteCode(data as GymInviteCodeRow);
  }

  async updateGymInviteCode(
    gymId: string,
    inviteCodeId: string,
    input: UpdateGymInviteCodeInput
  ): Promise<GymInviteCode> {
    await this.access.requireGymStaff(gymId);

    const payload: Record<string, unknown> = {};
    if (input.code !== undefined) payload.code = normalizeInviteCode(input.code);
    if (input.label !== undefined) payload.label = input.label?.trim() || null;
    if (input.role !== undefined) payload.role = input.role;
    if (input.membershipStatus !== undefined) payload.membership_status = input.membershipStatus;
    if (input.membershipPlanId !== undefined) payload.membership_plan_id = input.membershipPlanId;
    if (input.maxRedemptions !== undefined) payload.max_redemptions = input.maxRedemptions;
    if (input.expiresAt !== undefined) payload.expires_at = input.expiresAt;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("gym_invite_codes")
      .update(payload)
      .eq("id", inviteCodeId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_INVITE_CODE_UPDATE_FAILED", "Unable to update invite code.");

    return mapGymInviteCode(data as GymInviteCodeRow);
  }

  async listGymJoinRequests(
    gymId: string,
    status: GymJoinRequestStatus | "all" = "pending"
  ): Promise<GymJoinRequestDirectoryItem[]> {
    await this.access.requireGymStaff(gymId);

    let query = this.supabase
      .from("gym_join_requests")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    throwIfAdminError(error, "ADMIN_JOIN_REQUEST_LIST_FAILED", "Unable to load gym join requests.");

    const rows = ((data as GymJoinRequestRow[]) ?? []).map(mapGymJoinRequest);
    if (rows.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(rows.map((row) => row.userId)));
    const planIds = Array.from(
      new Set(rows.map((row) => row.requestedMembershipPlanId).filter((value): value is string => Boolean(value)))
    );
    const inviteIds = Array.from(
      new Set(rows.map((row) => row.inviteCodeId).filter((value): value is string => Boolean(value)))
    );

    const profileMap = new Map<string, MemberProfileSummary>();
    const { data: profiles, error: profileError } = await this.supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", userIds);

    throwIfAdminError(profileError, "ADMIN_JOIN_REQUEST_PROFILE_LIST_FAILED", "Unable to load join request profiles.");

    for (const profile of (profiles as ProfileRow[]) ?? []) {
      const mapped = profileLabel(profile);
      if (mapped) {
        profileMap.set(mapped.userId, mapped);
      }
    }

    const planMap = new Map<string, string>();
    if (planIds.length > 0) {
      const { data: plans, error: planError } = await this.supabase
        .from("gym_membership_plans")
        .select("id,name")
        .eq("gym_id", gymId)
        .in("id", planIds);

      throwIfAdminError(planError, "ADMIN_JOIN_REQUEST_PLAN_LIST_FAILED", "Unable to load join request plans.");

      for (const plan of (plans as MembershipPlanRow[]) ?? []) {
        planMap.set(plan.id, plan.name);
      }
    }

    const inviteMap = new Map<string, string>();
    if (inviteIds.length > 0) {
      const { data: invites, error: inviteError } = await this.supabase
        .from("gym_invite_codes")
        .select("id,label,code")
        .eq("gym_id", gymId)
        .in("id", inviteIds);

      throwIfAdminError(inviteError, "ADMIN_JOIN_REQUEST_INVITE_LIST_FAILED", "Unable to load join request invites.");

      for (const invite of (invites as Array<{ id: string; label: string | null; code: string }>) ?? []) {
        inviteMap.set(invite.id, invite.label || invite.code);
      }
    }

    return rows.map((row) => ({
      ...row,
      profile: profileMap.get(row.userId),
      membershipPlanName: row.requestedMembershipPlanId ? planMap.get(row.requestedMembershipPlanId) ?? null : null,
      inviteLabel: row.inviteCodeId ? inviteMap.get(row.inviteCodeId) ?? null : null
    }));
  }

  async reviewGymJoinRequest(gymId: string, input: ReviewGymJoinRequestInput): Promise<string> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase.rpc("review_gym_join_request", {
      p_request_id: input.requestId,
      p_next_status: input.nextStatus,
      p_staff_note: input.staffNote ?? null
    });

    throwIfAdminError(error, "ADMIN_JOIN_REQUEST_REVIEW_FAILED", "Unable to review join request.");

    return String(data);
  }

  async listStaffProfileOptions(gymId: string): Promise<StaffProfileOption[]> {
    await this.access.requireGymStaff(gymId);

    const { data: memberships, error: membershipError } = await this.supabase
      .from("gym_memberships")
      .select("user_id")
      .eq("gym_id", gymId)
      .in("membership_status", ["trial", "active"])
      .in("role", ["leader", "officer", "coach"]);

    throwIfAdminError(membershipError, "ADMIN_STAFF_LIST_FAILED", "Unable to load staff members.");

    const userIds = Array.from(new Set(((memberships as Array<{ user_id: string }>) ?? []).map((row) => row.user_id)));
    if (userIds.length === 0) {
      return [];
    }

    const { data: profiles, error: profileError } = await this.supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", userIds);

    throwIfAdminError(profileError, "ADMIN_STAFF_PROFILE_LIST_FAILED", "Unable to load staff profiles.");

    return ((profiles as ProfileRow[]) ?? [])
      .flatMap((profile) => {
        const mapped = profileLabel(profile);
        return mapped ? [mapped] : [];
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  async listMemberWorkoutPlans(gymId: string, memberUserId: string): Promise<MemberWorkoutPlan[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("gym_member_workout_plans")
      .select("*")
      .eq("gym_id", gymId)
      .eq("member_user_id", memberUserId)
      .order("updated_at", { ascending: false })
      .limit(20);

    throwIfAdminError(error, "ADMIN_WORKOUT_PLAN_LIST_FAILED", "Unable to load workout plans.");

    return ((data as MemberWorkoutPlanRow[]) ?? []).map(mapMemberWorkoutPlan);
  }

  async createMemberWorkoutPlan(
    gymId: string,
    input: CreateMemberWorkoutPlanInput
  ): Promise<MemberWorkoutPlan> {
    const staff = await this.access.requireGymStaff(gymId);

    const title = input.title.trim();
    if (!title) {
      throw new KruxtAdminError("ADMIN_WORKOUT_PLAN_TITLE_REQUIRED", "Workout plan title is required.");
    }

    const { data, error } = await this.supabase
      .from("gym_member_workout_plans")
      .insert({
        gym_id: gymId,
        member_user_id: input.memberUserId,
        coach_user_id: input.coachUserId ?? null,
        title,
        goal: input.goal?.trim() || null,
        status: input.status ?? "active",
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        plan_json: input.planJson ?? {},
        created_by: staff.user_id
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_WORKOUT_PLAN_CREATE_FAILED", "Unable to create workout plan.");

    return mapMemberWorkoutPlan(data as MemberWorkoutPlanRow);
  }

  async listStaffShifts(gymId: string, limit = 100): Promise<StaffShift[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("staff_shifts")
      .select("*")
      .eq("gym_id", gymId)
      .order("starts_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 250));

    throwIfAdminError(error, "ADMIN_STAFF_SHIFT_LIST_FAILED", "Unable to load staff schedule.");

    return ((data as StaffShiftRow[]) ?? []).map(mapStaffShift);
  }

  async createStaffShift(gymId: string, input: CreateStaffShiftInput): Promise<StaffShift> {
    const staff = await this.access.requireGymStaff(gymId);

    if (!input.staffUserId.trim()) {
      throw new KruxtAdminError("ADMIN_STAFF_SHIFT_USER_REQUIRED", "Staff member is required.");
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!Number.isFinite(startsAt.valueOf()) || !Number.isFinite(endsAt.valueOf()) || endsAt <= startsAt) {
      throw new KruxtAdminError("ADMIN_STAFF_SHIFT_TIME_INVALID", "Shift end must be after shift start.");
    }

    const { data, error } = await this.supabase
      .from("staff_shifts")
      .insert({
        gym_id: gymId,
        staff_user_id: input.staffUserId,
        created_by: staff.user_id,
        title: input.title?.trim() || "Shift",
        shift_role: input.shiftRole?.trim() || null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: input.status ?? "scheduled",
        hourly_rate_cents: input.hourlyRateCents ?? null,
        notes: input.notes?.trim() || null,
        metadata: input.metadata ?? {}
      })
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_STAFF_SHIFT_CREATE_FAILED", "Unable to create staff shift.");

    return mapStaffShift(data as StaffShiftRow);
  }

  async updateStaffShift(gymId: string, shiftId: string, input: UpdateStaffShiftInput): Promise<StaffShift> {
    await this.access.requireGymStaff(gymId);

    const payload: Record<string, unknown> = {};
    if (input.staffUserId !== undefined) payload.staff_user_id = input.staffUserId;
    if (input.title !== undefined) payload.title = input.title.trim() || "Shift";
    if (input.shiftRole !== undefined) payload.shift_role = input.shiftRole?.trim() || null;
    if (input.startsAt !== undefined) payload.starts_at = input.startsAt;
    if (input.endsAt !== undefined) payload.ends_at = input.endsAt;
    if (input.status !== undefined) payload.status = input.status;
    if (input.hourlyRateCents !== undefined) payload.hourly_rate_cents = input.hourlyRateCents;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("staff_shifts")
      .update(payload)
      .eq("id", shiftId)
      .eq("gym_id", gymId)
      .select("*")
      .single();

    throwIfAdminError(error, "ADMIN_STAFF_SHIFT_UPDATE_FAILED", "Unable to update staff shift.");

    return mapStaffShift(data as StaffShiftRow);
  }

  async getGymOpsSummary(gymId: string): Promise<GymOpsSummary> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("admin_get_gym_ops_summary", { p_gym_id: gymId })
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_GYM_OPS_SUMMARY_FAILED", "Unable to load gym operations summary.");

    if (!data) {
      return {
        gymId,
        pendingMemberships: 0,
        activeOrTrialMembers: 0,
        upcomingClasses: 0,
        pendingWaitlistEntries: 0,
        openPrivacyRequests: 0
      };
    }

    return mapOpsSummary(data as GymOpsSummaryRow);
  }

  async listUpcomingClasses(gymId: string, limit = 20): Promise<GymClassScheduleItem[]> {
    await this.access.requireGymStaff(gymId);

    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("gym_classes")
      .select("id,gym_id,title,status,starts_at,ends_at,capacity")
      .eq("gym_id", gymId)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_CLASSES_LIST_FAILED", "Unable to list upcoming classes.");

    return ((data as GymClassRow[]) ?? []).map((row) => ({
      id: row.id,
      gymId: row.gym_id,
      title: row.title,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      capacity: row.capacity
    }));
  }

  async listPendingWaitlistEntries(gymId: string, limit = 50): Promise<PendingWaitlistEntry[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("class_waitlist")
      .select("id,class_id,user_id,position,status,created_at,gym_classes!inner(id,gym_id,title,starts_at)")
      .eq("status", "pending")
      .eq("gym_classes.gym_id", gymId)
      .order("position", { ascending: true })
      .limit(limit);

    throwIfAdminError(error, "ADMIN_WAITLIST_LIST_FAILED", "Unable to list pending waitlist entries.");

    return ((data as WaitlistWithClassRow[]) ?? [])
      .map((row) => {
        const gymClass = Array.isArray(row.gym_classes) ? row.gym_classes[0] : row.gym_classes;
        if (!gymClass) {
          return null;
        }

        return {
          id: row.id,
          classId: row.class_id,
          classTitle: gymClass.title,
          classStartsAt: gymClass.starts_at,
          userId: row.user_id,
          position: row.position,
          status: row.status,
          createdAt: row.created_at
        } satisfies PendingWaitlistEntry;
      })
      .filter((row): row is PendingWaitlistEntry => row !== null);
  }

  async listUserConsentRecords(gymId: string, userId: string): Promise<ConsentRecord[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("admin_list_user_consents", { p_gym_id: gymId, p_user_id: userId });

    throwIfAdminError(error, "ADMIN_CONSENT_READ_FAILED", "Unable to load member consent records.");

    return ((data as ConsentRow[]) ?? []).map(mapConsent);
  }

  async listOpenPrivacyRequests(gymId: string): Promise<OpenPrivacyRequest[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .rpc("admin_list_open_privacy_requests", { p_gym_id: gymId });

    throwIfAdminError(error, "ADMIN_PRIVACY_REQUESTS_FAILED", "Unable to load open privacy requests.");

    return ((data as OpenPrivacyRequestRow[]) ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      type: row.request_type,
      status: row.status,
      submittedAt: row.submitted_at as string,
      dueAt: row.due_at as string | null,
      slaBreachedAt: row.sla_breached_at as string | null,
      isOverdue: Boolean(row.is_overdue)
    }));
  }

  async getPrivacyOpsMetrics(gymId: string, windowDays = 30): Promise<PrivacyOpsMetrics> {
    await this.access.requireGymStaff(gymId);
    const boundedWindowDays = Math.max(1, Math.min(windowDays, 365));

    const { data, error } = await this.supabase
      .rpc("admin_get_privacy_ops_metrics", { p_gym_id: gymId, p_window_days: boundedWindowDays })
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_PRIVACY_OPS_METRICS_FAILED", "Unable to load privacy ops metrics.");

    if (!data) {
      return {
        gymId,
        openRequests: 0,
        overdueRequests: 0,
        avgCompletionHours: 0,
        fulfilledRequestsWindow: 0,
        rejectedRequestsWindow: 0,
        measuredWindowDays: boundedWindowDays
      };
    }

    const row = data as PrivacyOpsMetricsRow;
    return {
      gymId: row.gym_id,
      openRequests: Number(row.open_requests ?? 0),
      overdueRequests: Number(row.overdue_requests ?? 0),
      avgCompletionHours: Number(row.avg_completion_hours ?? 0),
      fulfilledRequestsWindow: Number(row.fulfilled_requests_window ?? 0),
      rejectedRequestsWindow: Number(row.rejected_requests_window ?? 0),
      measuredWindowDays: Number(row.measured_window_days ?? boundedWindowDays)
    };
  }

  async listActivePolicyVersions(gymId: string): Promise<PolicyVersion[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("policy_version_tracking")
      .select(
        "id,policy_type,version,label,document_url,effective_at,is_active,published_at,requires_reconsent,change_summary,supersedes_policy_version_id"
      )
      .eq("is_active", true)
      .order("policy_type", { ascending: true })
      .order("effective_at", { ascending: false });

    throwIfAdminError(error, "ADMIN_POLICY_VERSIONS_LIST_FAILED", "Unable to load active policy versions.");

    return ((data as PolicyVersionRow[]) ?? []).map(mapPolicyVersion);
  }

  async listSecurityIncidents(
    gymId: string,
    options: { limit?: number; status?: IncidentStatus } = {}
  ): Promise<SecurityIncidentOperatorItem[]> {
    await this.access.requireGymStaff(gymId);

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const { data, error } = await this.supabase.rpc("admin_list_security_incidents", {
      p_gym_id: gymId,
      p_limit: limit,
      p_status_filter: options.status ?? null
    });

    throwIfAdminError(error, "ADMIN_SECURITY_INCIDENTS_LIST_FAILED", "Unable to load security incidents.");

    return ((data as SecurityIncidentRow[]) ?? []).map((row) => ({
      id: row.id,
      gymId: row.gym_id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      drillMode: row.drill_mode,
      detectedAt: row.detected_at,
      requiresFtcNotice: row.requires_ftc_notice,
      requiresGdprNotice: row.requires_gdpr_notice,
      ftcNoticeDueAt: row.ftc_notice_due_at,
      gdprNoticeDueAt: row.gdpr_notice_due_at,
      nextDeadlineAt: row.next_deadline_at,
      nextDeadlineLabel: row.next_deadline_label,
      secondsToNextDeadline: row.seconds_to_next_deadline,
      isDeadlineBreached: Boolean(row.is_deadline_breached),
      affectedUserCount: row.affected_user_count,
      affectedGymCount: row.affected_gym_count,
      updatedAt: row.updated_at
    }));
  }

  async transitionPrivacyRequest(
    gymId: string,
    requestId: string,
    nextStatus: Extract<PrivacyRequestStatus, "triaged" | "in_progress" | "fulfilled" | "rejected">,
    notes?: string
  ): Promise<string> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase.rpc("transition_privacy_request_status", {
      p_request_id: requestId,
      p_next_status: nextStatus,
      p_notes: notes?.trim() || null
    });

    throwIfAdminError(
      error,
      "ADMIN_PRIVACY_REQUEST_TRANSITION_FAILED",
      "Unable to transition privacy request status."
    );

    if (!data || typeof data !== "string") {
      throw new KruxtAdminError(
        "ADMIN_PRIVACY_REQUEST_TRANSITION_NO_ID",
        "Privacy request status transition completed without a request id."
      );
    }

    return data;
  }
}
