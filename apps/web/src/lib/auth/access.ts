import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";

export interface AdminAccessState {
  status: "loading" | "ready";
  isAuthenticated: boolean;
  user: User | null;
  platformRole: PlatformOperatorRole | null;
  staffGymIds: string[];
}

export async function resolveAdminAccess(client: SupabaseClient): Promise<AdminAccessState> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError || !authData.user) {
    return {
      status: "ready",
      isAuthenticated: false,
      user: null,
      platformRole: null,
      staffGymIds: []
    };
  }

  const user = authData.user;

  try {
    const [{ data: platformData }, { data: membershipsData }] = await Promise.all([
      client
        .from("platform_operator_accounts")
        .select("role,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      client
        .from("gym_memberships")
        .select("gym_id")
        .eq("user_id", user.id)
        .in("membership_status", ["trial", "active"])
        .in("role", ["leader", "officer", "coach"])
    ]);

    return {
      status: "ready",
      isAuthenticated: true,
      user,
      platformRole: (platformData?.role as PlatformOperatorRole | null | undefined) ?? null,
      staffGymIds: (membershipsData ?? []).map((row) => row.gym_id)
    };
  } catch {
    return {
      status: "ready",
      isAuthenticated: true,
      user,
      platformRole: null,
      staffGymIds: []
    };
  }
}

export async function ensureProfileForUser(
  client: SupabaseClient,
  input: { userId: string; email: string; username?: string; displayName?: string }
): Promise<void> {
  const fallbackUsername = input.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  const username = (input.username?.trim() || fallbackUsername).slice(0, 32);

  const payload = {
    id: input.userId,
    username,
    display_name: input.displayName?.trim() || username
  };

  const { error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

  if (error) {
    throw new Error(error.message || "Unable to upsert profile.");
  }
}
