import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsentRecord,
  GymMembership,
  GymOpsSummary,
  GymRole,
  IncidentStatus,
  MembershipStatus,
  PolicyVersion,
  PrivacyRequestStatus
} from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

type OpenPrivacyRequestStatus = Extract<PrivacyRequestStatus, "submitted" | "triaged" | "in_progress">;

type MembershipRow = {
  id: string;
  gym_id: string;
  user_id: string;
  role: GymRole;
  membership_status: MembershipStatus;
  membership_plan_id: string | null;
  started_at: string | null;
  ends_at: string | null;
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

function mapMembership(row: MembershipRow): GymMembership {
  return {
    id: row.id,
    gymId: row.gym_id,
    userId: row.user_id,
    role: row.role,
    membershipStatus: row.membership_status,
    membershipPlanId: row.membership_plan_id,
    startedAt: row.started_at,
    endsAt: row.ends_at
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

  async approveMembership(gymId: string, membershipId: string): Promise<GymMembership> {
    return this.updateMembershipStatus(gymId, membershipId, "active");
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
