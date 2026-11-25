import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformOperatorRole } from "@kruxt/types";

export interface OperatorAccount {
  userId: string;
  email: string | null;
  displayName: string;
  username: string | null;
  role: PlatformOperatorRole;
  isActive: boolean;
  mfaRequired: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  overrideCount: number;
}

export interface PermissionCatalogRow {
  permission_key: string;
  category: string;
  label: string;
  description: string | null;
  is_sensitive: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface RolePermissionRow {
  role: PlatformOperatorRole;
  permission_key: string;
  is_allowed: boolean;
  metadata: Record<string, unknown>;
}

export interface OverrideRow {
  user_id: string;
  permission_key: string;
  is_allowed: boolean;
  reason: string | null;
}

export interface OperatorPermissionSnapshot {
  operators: OperatorAccount[];
  catalog: PermissionCatalogRow[];
  rolePermissions: RolePermissionRow[];
  overrides: OverrideRow[];
}

export interface PermissionChange {
  permissionKey: string;
  value: boolean | null;
  previousValue: boolean | null;
}

export interface OperatorPermissionSaveResult {
  confirmedKeys: string[];
  unconfirmedKeys: string[];
  outcome: "complete" | "partial" | "unconfirmed";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ["founder", "ops_admin", "support_admin", "compliance_admin", "analyst", "read_only"];

async function requireViewer(client: SupabaseClient, expectedViewerId: string): Promise<void> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== expectedViewerId) {
    throw new Error("Your operator session changed. Reload before continuing.");
  }
}

export async function loadOperatorPermissionSnapshot(
  client: SupabaseClient,
  expectedViewerId: string
): Promise<OperatorPermissionSnapshot> {
  await requireViewer(client, expectedViewerId);
  const [operators, catalog, roles, overrides] = await Promise.all([
    client.rpc("platform_list_operator_accounts"),
    client.from("platform_permission_catalog")
      .select("permission_key,category,label,description,is_sensitive,is_active,metadata")
      .eq("is_active", true).order("category").order("label"),
    client.from("platform_role_permissions").select("role,permission_key,is_allowed,metadata"),
    client.from("platform_operator_permission_overrides").select("user_id,permission_key,is_allowed,reason")
  ]);
  if (operators.error || catalog.error || roles.error || overrides.error) {
    throw new Error("Operator permissions could not be loaded. Retry without changing access.");
  }
  if (![operators.data, catalog.data, roles.data, overrides.data].every(Array.isArray)) {
    throw new Error("The permission response could not be verified. Reload before continuing.");
  }
  await requireViewer(client, expectedViewerId);
  const activeCatalog = (catalog.data as PermissionCatalogRow[]).filter((row) => row.is_active === true);
  const activeKeys = new Set(activeCatalog.map((row) => row.permission_key));
  return {
    operators: operators.data.map((row: Record<string, unknown>) => {
      if (!ROLES.includes(String(row.role))) throw new Error("An operator role is not supported by this version.");
      return {
        userId: String(row.user_id), email: row.email as string | null,
        displayName: String(row.display_name || row.username || "Operator"),
        username: row.username as string | null, role: row.role as PlatformOperatorRole,
        isActive: row.is_active === true, mfaRequired: row.mfa_required === true,
        lastLoginAt: row.last_login_at as string | null, createdAt: String(row.created_at),
        overrideCount: Number(row.override_count) || 0
      };
    }),
    catalog: activeCatalog,
    rolePermissions: (roles.data as RolePermissionRow[]).filter((row) => activeKeys.has(row.permission_key)),
    overrides: (overrides.data as OverrideRow[]).filter((row) => activeKeys.has(row.permission_key))
  };
}

async function requireEditableAccounts(client: SupabaseClient, viewerId: string, targetUserId: string): Promise<void> {
  await requireViewer(client, viewerId);
  const { data, error } = await client.from("platform_operator_accounts").select("user_id,role,is_active")
    .in("user_id", [viewerId, targetUserId]);
  if (error || !Array.isArray(data)) throw new Error("Operator access could not be checked. Reload before saving.");
  const actor = data.find((row) => row.user_id === viewerId);
  const target = data.find((row) => row.user_id === targetUserId);
  if (!actor?.is_active || actor.role !== "founder") throw new Error("An active founder must make these changes.");
  if (!target || target.role === "founder") throw new Error("Founder permissions cannot be edited here.");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") {
    throw new Error("Verify a second authentication factor before changing operator permissions.");
  }
}

/** Existing RPCs commit independently. Confirm each outcome; never imply batch rollback. */
export async function saveOperatorPermissionChanges(
  client: SupabaseClient,
  input: { viewerId: string; targetUserId: string; reason: string; changes: PermissionChange[] }
): Promise<OperatorPermissionSaveResult> {
  if (!UUID.test(input.viewerId) || !UUID.test(input.targetUserId)) throw new Error("Choose a valid operator.");
  const reason = input.reason.trim();
  if (!reason || reason.length > 2000) throw new Error("Add an audit reason of up to 2,000 characters.");
  const changes = input.changes.map((change) => ({ ...change }));
  const keys = changes.map((change) => change.permissionKey);
  if (!changes.length || changes.length > 100 || new Set(keys).size !== keys.length || changes.some((change) =>
    !/^platform\.[a-z0-9_.]+$/.test(change.permissionKey) ||
    ![true, false, null].includes(change.value) || ![true, false, null].includes(change.previousValue))) {
    throw new Error("Review the selected permission changes before saving.");
  }
  await requireEditableAccounts(client, input.viewerId, input.targetUserId);
  const [catalog, current] = await Promise.all([
    client.from("platform_permission_catalog").select("permission_key,is_active").in("permission_key", keys).eq("is_active", true),
    client.from("platform_operator_permission_overrides").select("permission_key,is_allowed")
      .eq("user_id", input.targetUserId).in("permission_key", keys)
  ]);
  if (catalog.error || current.error || !Array.isArray(catalog.data) || !Array.isArray(current.data)) {
    throw new Error("Current permissions could not be checked. Reload before saving.");
  }
  const active = new Set(catalog.data.filter((row) => row.is_active === true).map((row) => row.permission_key));
  if (keys.some((key) => !active.has(key))) throw new Error("A selected permission is no longer active. Reload before saving.");
  if (changes.some((change) => {
    const row = current.data.find((entry) => entry.permission_key === change.permissionKey);
    return (row?.is_allowed ?? null) !== change.previousValue;
  })) throw new Error("Permissions changed since you opened this operator. Reload and review them again.");

  const confirmedKeys: string[] = [];
  for (const [index, change] of changes.entries()) {
    try {
      await requireEditableAccounts(client, input.viewerId, input.targetUserId);
      const response = change.value === null
        ? await client.rpc("platform_clear_operator_permission_override", { p_user_id: input.targetUserId, p_permission_key: change.permissionKey, p_reason: reason })
        : await client.rpc("platform_set_operator_permission_override", { p_user_id: input.targetUserId, p_permission_key: change.permissionKey, p_is_allowed: change.value, p_reason: reason });
      if (response.error || response.data?.userId !== input.targetUserId || response.data?.permissionKey !== change.permissionKey ||
          (change.value === null ? response.data?.cleared !== true : response.data?.isAllowed !== change.value)) throw new Error("Change not confirmed.");
      const readback = await client.from("platform_operator_permission_overrides").select("permission_key,is_allowed")
        .eq("user_id", input.targetUserId).eq("permission_key", change.permissionKey).maybeSingle();
      await requireViewer(client, input.viewerId);
      if (readback.error || (change.value === null ? readback.data !== null :
        readback.data?.permission_key !== change.permissionKey || readback.data?.is_allowed !== change.value)) throw new Error("Readback unavailable.");
      confirmedKeys.push(change.permissionKey);
    } catch {
      return { confirmedKeys, unconfirmedKeys: changes.slice(index).map((entry) => entry.permissionKey), outcome: confirmedKeys.length ? "partial" : "unconfirmed" };
    }
  }
  return { confirmedKeys, unconfirmedKeys: [], outcome: "complete" };
}
