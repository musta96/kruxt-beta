import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsentRecord,
  GymMembership,
  GymOpsSummary,
  GymRole,
  MembershipStatus
} from "@kruxt/types";

import { throwIfAdminError } from "./errors";
import { StaffAccessService } from "./staff-access-service";

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
  request_type: string;
  status: string;
  submitted_at: string;
  due_at: string | null;
};

type GymOpsSummaryRow = {
  gym_id: string;
  pending_memberships: number;
  active_or_trial_members: number;
  upcoming_classes: number;
  pending_waitlist_entries: number;
  open_privacy_requests: number;
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

export interface OpenPrivacyRequest {
  id: string;
  userId: string;
  type: string;
  status: string;
  submittedAt: string;
  dueAt?: string | null;
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
      type: row.request_type as string,
      status: row.status as string,
      submittedAt: row.submitted_at as string,
      dueAt: row.due_at as string | null
    }));
  }
}
