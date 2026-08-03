import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";

export interface AdminAccessState {
  status: "loading" | "ready" | "error" | "activation_required" | "disabled" | "consent_required";
  isAuthenticated: boolean;
  user: User | null;
  activationStatus: "pending_activation" | "active" | "disabled" | null;
  platformRole: PlatformOperatorRole | null;
  staffGymIds: string[];
  hasRequiredConsents: boolean;
  error: string | null;
}

function accessError(user: User | null, message: string): AdminAccessState {
  return {
    status: "error",
    isAuthenticated: Boolean(user),
    user,
    activationStatus: null,
    platformRole: null,
    staffGymIds: [],
    hasRequiredConsents: false,
    error: message
  };
}

export async function resolveAdminAccess(client: SupabaseClient): Promise<AdminAccessState> {
  const { data: authData, error: authError } = await client.auth.getUser();

  if (authError) {
    return accessError(authData.user ?? null, authError.message || "Unable to validate the authenticated session.");
  }

  if (!authData.user) {
    return {
      status: "ready",
      isAuthenticated: false,
      user: null,
      activationStatus: null,
      platformRole: null,
      staffGymIds: [],
      hasRequiredConsents: false,
      error: null
    };
  }

  const user = authData.user;

  try {
    const [platformResult, membershipsResult, profileResult, consentResult] = await Promise.all([
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
        .in("role", ["leader", "officer", "coach"]),
      client
        .from("profiles")
        .select("activation_status")
        .eq("id", user.id)
        .maybeSingle(),
      client.rpc("user_has_required_consents", { p_user_id: user.id })
    ]);

    const queryError =
      platformResult.error ?? membershipsResult.error ?? profileResult.error ?? consentResult.error;
    if (queryError) {
      return accessError(user, queryError.message || "Unable to validate account access.");
    }

    if (!profileResult.data) {
      return accessError(user, "Your member profile is unavailable. Sign out and sign in again to retry setup.");
    }

    const activationStatus = profileResult.data.activation_status;
    if (
      activationStatus !== "pending_activation" &&
      activationStatus !== "active" &&
      activationStatus !== "disabled"
    ) {
      return accessError(user, "Your account activation state could not be validated.");
    }

    const hasRequiredConsents = consentResult.data === true;
    const status: AdminAccessState["status"] =
      activationStatus === "pending_activation"
        ? "activation_required"
        : activationStatus === "disabled"
          ? "disabled"
          : hasRequiredConsents
            ? "ready"
            : "consent_required";

    return {
      status,
      isAuthenticated: true,
      user,
      activationStatus,
      platformRole: (platformResult.data?.role as PlatformOperatorRole | null | undefined) ?? null,
      staffGymIds: (membershipsResult.data ?? []).map((row) => row.gym_id),
      hasRequiredConsents,
      error: null
    };
  } catch (error) {
    return accessError(
      user,
      error instanceof Error ? error.message : "Unable to validate account access."
    );
  }
}

export async function ensureProfileForUser(
  client: SupabaseClient,
  input: { userId: string; email: string; username?: string; displayName?: string }
): Promise<void> {
  const fallbackUsername = input.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  const username = input.username?.trim() || fallbackUsername;
  const displayName = input.displayName?.trim() || username;

  const { data, error } = await client.rpc("ensure_self_profile", {
    p_preferred_username: username,
    p_display_name: displayName
  });

  if (error) {
    throw new Error(error.message || "Unable to prepare your profile.");
  }

  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile || profile.id !== input.userId) {
    throw new Error("The authenticated profile could not be verified.");
  }
}

export async function ensureProfileExistsForUser(
  client: SupabaseClient,
  input: { userId: string; email: string; username?: string; displayName?: string }
): Promise<void> {
  await ensureProfileForUser(client, input);
}
