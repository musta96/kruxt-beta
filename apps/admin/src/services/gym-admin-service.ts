import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentRecord, GymMembership, GymRole, MembershipStatus } from "@kruxt/types";

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

  async listUserConsentRecords(gymId: string, userId: string): Promise<ConsentRecord[]> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("consents")
      .select("*")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false });

    throwIfAdminError(error, "ADMIN_CONSENT_READ_FAILED", "Unable to load user consent records.");

    return (data as ConsentRow[]).map(mapConsent);
  }

  async listOpenPrivacyRequests(gymId: string): Promise<Array<{ id: string; userId: string; type: string; status: string }>> {
    await this.access.requireGymStaff(gymId);

    const { data, error } = await this.supabase
      .from("privacy_requests")
      .select("id,user_id,request_type,status")
      .in("status", ["submitted", "in_review"])
      .order("submitted_at", { ascending: true });

    throwIfAdminError(error, "ADMIN_PRIVACY_REQUESTS_FAILED", "Unable to load open privacy requests.");

    return (data ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      type: row.request_type as string,
      status: row.status as string
    }));
  }
}
