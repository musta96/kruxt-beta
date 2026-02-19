import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { GymRole } from "@kruxt/types";

import { KruxtAdminError, throwIfAdminError } from "./errors";

type MembershipRow = {
  id: string;
  gym_id: string;
  user_id: string;
  role: GymRole;
  membership_status: "pending" | "trial" | "active" | "paused" | "cancelled";
};

export class StaffAccessService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCurrentUser(): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser();
    throwIfAdminError(error, "ADMIN_AUTH_READ_FAILED", "Unable to read current user.");

    if (!data.user) {
      throw new KruxtAdminError("ADMIN_AUTH_REQUIRED", "Admin authentication required.");
    }

    return data.user;
  }

  async requireGymStaff(gymId: string, userId?: string): Promise<MembershipRow> {
    const resolvedUserId = userId ?? (await this.getCurrentUser()).id;

    const { data, error } = await this.supabase
      .from("gym_memberships")
      .select("id,gym_id,user_id,role,membership_status")
      .eq("gym_id", gymId)
      .eq("user_id", resolvedUserId)
      .in("membership_status", ["trial", "active"])
      .in("role", ["leader", "officer", "coach"])
      .maybeSingle();

    throwIfAdminError(error, "ADMIN_STAFF_ACCESS_CHECK_FAILED", "Unable to validate staff access.");

    if (!data) {
      throw new KruxtAdminError("ADMIN_STAFF_ACCESS_DENIED", "Gym staff access is required.");
    }

    return data as MembershipRow;
  }
}
