import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_PERMISSION_KEYS = [
  "platform.tenants.view", "platform.flags.view", "platform.audit.view", "platform.system_health.view",
] as const;
export type ProfilePermissionKey = typeof PROFILE_PERMISSION_KEYS[number];
export type ProfilePermissionSource = "inactive_operator" | "inactive_catalog" | "user_override" | "profile" | "enum_default" | "default_deny";
export interface EffectiveProfilePermission {
  is_allowed: boolean;
  source: ProfilePermissionSource;
  profile_id: string | null;
}
export interface OperatorRoleProfile {
  id: string;
  name: string;
  description: string;
  permissions: Partial<Record<ProfilePermissionKey, boolean>>;
  version: number;
}
export interface OperatorRoleProfileSnapshot {
  profiles: OperatorRoleProfile[];
  assignments: { user_id: string; profile_id: string }[];
  operators: { user_id: string; display_name: string; role: string; is_active: boolean }[];
  catalog: { permission_key: ProfilePermissionKey; label: string }[];
  can_write: boolean;
  effective_permissions: (EffectiveProfilePermission & { user_id: string; permission_key: string })[];
}
/** Draft preview only. Persisted access comes from effective_permissions RPC rows. */
export function resolveOperatorProfilePermission(input: {
  isActive: boolean; catalogActive: boolean; role: string; roleDefault?: boolean;
  userOverride?: boolean | null; profile?: OperatorRoleProfile | null; permissionKey: string;
}): EffectiveProfilePermission {
  const result = (is_allowed: boolean, source: ProfilePermissionSource, profile_id: string | null = null) => ({ is_allowed, source, profile_id });
  if (!input.catalogActive) return result(false, "inactive_catalog");
  if (!input.isActive) return result(false, "inactive_operator");
  if (typeof input.userOverride === "boolean") return result(input.userOverride, "user_override");
  const key = input.permissionKey.toLowerCase() as ProfilePermissionKey;
  const allowed = input.profile?.permissions[key];
  if (input.role !== "founder" && PROFILE_PERMISSION_KEYS.includes(key) && typeof allowed === "boolean") return result(allowed, "profile", input.profile!.id);
  if (typeof input.roleDefault === "boolean") return result(input.roleDefault, "enum_default");
  return result(false, "default_deny");
}
export interface OperatorRoleProfileMutation {
  action: "create" | "update" | "delete" | "assign";
  profile?: OperatorRoleProfile | null;
  name?: string;
  description?: string;
  permissions?: Partial<Record<ProfilePermissionKey, boolean>>;
  userId?: string;
  expectedProfileId?: string | null;
  reason: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ["founder", "ops_admin", "support_admin", "compliance_admin", "analyst", "read_only"];
const validPermissions = (value: unknown): value is OperatorRoleProfile["permissions"] =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([key, allowed]) =>
    PROFILE_PERMISSION_KEYS.includes(key as ProfilePermissionKey) && typeof allowed === "boolean");
async function requireViewer(client: SupabaseClient, viewerId: string) {
  const { data, error } = await client.auth.getUser();
  if (!uuid.test(viewerId) || error || data.user?.id !== viewerId) throw new Error("Your operator session changed. Reload before continuing.");
}
export async function loadOperatorRoleProfiles(client: SupabaseClient, viewerId: string): Promise<OperatorRoleProfileSnapshot> {
  await requireViewer(client, viewerId);
  const { data, error } = await client.rpc("platform_operator_role_profiles_snapshot");
  await requireViewer(client, viewerId);
  if (error) throw new Error("Role profiles could not be loaded. Retry.");
  if (!data || ![data.profiles, data.assignments, data.operators, data.catalog, data.effective_permissions].every(Array.isArray) ||
    typeof data.can_write !== "boolean" ||
    data.profiles.some((p: OperatorRoleProfile) => !p || !uuid.test(p.id) || typeof p.name !== "string" ||
      typeof p.description !== "string" || !Number.isSafeInteger(p.version) || p.version < 1 || !validPermissions(p.permissions)) ||
    data.assignments.some((a: { user_id: string; profile_id: string }) => !a || !uuid.test(a.user_id) || !uuid.test(a.profile_id)) ||
    data.operators.some((o: OperatorRoleProfileSnapshot["operators"][number]) => !o || !uuid.test(o.user_id) ||
      !roles.includes(o.role) || typeof o.is_active !== "boolean" || typeof o.display_name !== "string") ||
    data.catalog.some((c: OperatorRoleProfileSnapshot["catalog"][number]) => !c || !PROFILE_PERMISSION_KEYS.includes(c.permission_key) || typeof c.label !== "string") ||
    data.effective_permissions.some((r: OperatorRoleProfileSnapshot["effective_permissions"][number]) => !r || !uuid.test(r.user_id) ||
      typeof r.permission_key !== "string" || typeof r.is_allowed !== "boolean" ||
      !["inactive_operator", "user_override", "profile", "enum_default", "default_deny"].includes(r.source) ||
      (r.profile_id !== null && !uuid.test(r.profile_id)))) {
    throw new Error("The role profile response could not be verified. Reload.");
  }
  return data;
}

export async function mutateOperatorRoleProfile(
  client: SupabaseClient, viewerId: string, input: OperatorRoleProfileMutation,
): Promise<OperatorRoleProfileSnapshot> {
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000 || !["create", "update", "delete", "assign"].includes(input.action)) throw new Error("Add an audit reason of up to 2,000 characters.");
  if (input.profile && (!uuid.test(input.profile.id) || !Number.isSafeInteger(input.profile.version) || input.profile.version < 1)) throw new Error("Reload the selected profile.");
  if (["update", "delete"].includes(input.action) && !input.profile) throw new Error("Choose a profile.");
  if (["create", "update"].includes(input.action) && (!input.name?.trim() || input.name.trim().length > 80 ||
    (input.description?.length ?? 0) > 500 || !validPermissions(input.permissions))) throw new Error("Review the profile name and permissions.");
  if (input.action === "create" && input.profile) throw new Error("A new profile cannot reuse an existing ID.");
  if (input.action === "assign" && (!uuid.test(input.userId ?? "") ||
    (input.expectedProfileId != null && !uuid.test(input.expectedProfileId)))) throw new Error("Choose a valid operator assignment.");
  await requireViewer(client, viewerId);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") throw new Error("Verify a second authentication factor before changing role profiles.");
  // The database checks founder identity and canonical authority in the same
  // transaction as the mutation; these client checks are only early feedback.
  const { data, error } = await client.rpc("platform_mutate_operator_role_profile", {
    p_action: input.action, p_profile_id: input.profile?.id ?? null,
    p_expected_version: input.profile?.version ?? null, p_name: input.name?.trim() ?? null,
    p_description: input.description ?? "", p_permissions: input.permissions ?? {},
    p_user_id: input.userId ?? null, p_expected_profile_id: input.expectedProfileId ?? null, p_reason: reason,
  });
  if (error) throw new Error("Role profile change was rejected or could not be confirmed. Reload before retrying.");
  if (data?.committed !== true || data.action !== input.action ||
    (input.profile && data.profile_id !== input.profile.id) ||
    (input.action === "assign" && data.user_id !== input.userId)) {
    throw new Error("Change could not be confirmed. Reload before retrying.");
  }
  try {
    const snapshot = await loadOperatorRoleProfiles(client, viewerId);
    const persisted = snapshot.profiles.find((p) => p.id === data.profile_id);
    const assignment = snapshot.assignments.find((a) => a.user_id === input.userId);
    if (input.action === "delete" ? !!persisted : input.action === "assign"
      ? (assignment?.profile_id ?? null) !== (input.profile?.id ?? null)
      : !persisted || persisted.version !== data.profile?.version || persisted.name !== input.name?.trim() ||
        persisted.description !== (input.description ?? "") ||
        PROFILE_PERMISSION_KEYS.some((key) => persisted.permissions[key] !== input.permissions?.[key])) throw new Error("Readback mismatch");
    return snapshot;
  } catch {
    throw new Error("The change may have committed, but readback failed. Reload before retrying.");
  }
}
