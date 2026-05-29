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

type PlatformOperatorRow = {
  role: string;
  is_active: boolean;
};

type PlatformPermissionRow = {
  is_allowed: boolean;
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
      const { data: operatorData, error: operatorError } = await this.supabase
        .from("platform_operator_accounts")
        .select("role,is_active")
        .eq("user_id", resolvedUserId)
        .eq("is_active", true)
        .maybeSingle();

      throwIfAdminError(operatorError, "ADMIN_STAFF_ACCESS_CHECK_FAILED", "Unable to validate staff access.");

      if (!operatorData) {
        throw new KruxtAdminError("ADMIN_STAFF_ACCESS_DENIED", "Gym staff access is required.");
      }

      const operator = operatorData as PlatformOperatorRow;
      if (operator.role !== "founder") {
        const [{ data: rolePermissionData, error: rolePermissionError }, { data: overrideData, error: overrideError }] =
          await Promise.all([
            this.supabase
              .from("platform_role_permissions")
              .select("is_allowed")
              .eq("role", operator.role)
              .eq("permission_key", "platform.gyms.manage")
              .maybeSingle(),
            this.supabase
              .from("platform_operator_permission_overrides")
              .select("is_allowed")
              .eq("user_id", resolvedUserId)
              .eq("permission_key", "platform.gyms.manage")
              .maybeSingle()
          ]);

        throwIfAdminError(rolePermissionError, "ADMIN_STAFF_ACCESS_CHECK_FAILED", "Unable to validate staff access.");
        throwIfAdminError(overrideError, "ADMIN_STAFF_ACCESS_CHECK_FAILED", "Unable to validate staff access.");

        const override = overrideData as PlatformPermissionRow | null;
        const rolePermission = rolePermissionData as PlatformPermissionRow | null;
        const canManageGyms = override?.is_allowed ?? rolePermission?.is_allowed ?? false;

        if (!canManageGyms) {
          throw new KruxtAdminError("ADMIN_STAFF_ACCESS_DENIED", "Gym staff access is required.");
        }
      }

      return {
        id: "platform-operator-override",
        gym_id: gymId,
        user_id: resolvedUserId,
        role: "leader",
        membership_status: "active"
      };
    }

    return data as MembershipRow;
  }
}
