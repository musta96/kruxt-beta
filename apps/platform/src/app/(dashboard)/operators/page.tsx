"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { PlatformOperatorRole } from "@kruxt/types";
import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";

type MatrixRole = "founder" | "ops_admin" | "support_admin" | "read_only";
type AccessLevel = "full" | "scoped" | "none";
type OperatorStatus = "active" | "suspended";

interface OperatorAccount {
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

interface PermissionCatalogRow {
  permission_key: string;
  is_sensitive: boolean;
  metadata: Record<string, unknown>;
}

interface RolePermissionRow {
  role: MatrixRole;
  permission_key: string;
  is_allowed: boolean;
  metadata: Record<string, unknown>;
}

interface OverrideRow {
  user_id: string;
  permission_key: string;
  is_allowed: boolean;
  reason: string | null;
}

interface Capability {
  key: string;
  group: string;
  label: string;
  conditions?: Partial<Record<MatrixRole, string>>;
}

interface MatrixCell {
  level: AccessLevel;
  condition?: string;
}

interface DraftOverride {
  permissionKey: string;
  value: boolean | null;
}

const ROLE_COLUMNS: Array<{ role: MatrixRole; label: string; shortLabel: string }> = [
  { role: "founder", label: "Founder", shortLabel: "FOUNDER" },
  { role: "ops_admin", label: "Admin", shortLabel: "ADMIN" },
  { role: "support_admin", label: "Support", shortLabel: "SUPPORT" },
  { role: "read_only", label: "Read-only", shortLabel: "READ-ONLY" }
];

const CAPABILITIES: Capability[] = [
  { key: "platform.tenants.view", group: "Tenants", label: "View tenants", conditions: { support_admin: "PII masked" } },
  { key: "platform.tenants.onboard", group: "Tenants", label: "Onboard gym" },
  { key: "platform.tenants.edit_identity_plan", group: "Tenants", label: "Edit tenant identity / plan" },
  { key: "platform.tenants.suspend", group: "Tenants", label: "Suspend tenant" },
  { key: "platform.tenants.offboard", group: "Tenants", label: "Offboard tenant (export+delete)", conditions: { ops_admin: "Solo, two-step typed-confirm guard" } },
  { key: "platform.tenants.impersonate", group: "Tenants", label: "Impersonate / Open Admin", conditions: { support_admin: "Time-boxed 60m, logged" } },
  { key: "platform.tenants.create_staff_invite", group: "Tenants", label: "Create gym-owner/staff profile + invite", conditions: { support_admin: "Create+invite only; no password or operator access" } },

  { key: "platform.operators.view", group: "Operators", label: "View operators" },
  { key: "platform.operators.invite_edit", group: "Operators", label: "Invite / edit operators" },
  { key: "platform.operators.roles_matrix_edit", group: "Operators", label: "Edit roles & permission matrix" },
  { key: "platform.operators.revoke", group: "Operators", label: "Revoke operator" },

  { key: "platform.support.grants.approve", group: "Governance / Compliance", label: "Approve support-access grants", conditions: { support_admin: "Self-request only; cannot self-approve" } },
  { key: "platform.data_releases.approve", group: "Governance / Compliance", label: "Approve data releases" },
  { key: "platform.audit.view", group: "Governance / Compliance", label: "View Audit Log", conditions: { support_admin: "View" } },
  { key: "platform.audit.verify_export", group: "Governance / Compliance", label: "Verify integrity / export Audit Log", conditions: { support_admin: "View-only; no export" } },
  { key: "platform.dsar.view", group: "Governance / Compliance", label: "Handle DSAR (view)", conditions: { support_admin: "PII masked until verified" } },
  { key: "platform.dsar.fulfill", group: "Governance / Compliance", label: "DSAR fulfill", conditions: { ops_admin: "Export + erase", support_admin: "Export only; no erase" } },
  { key: "platform.retention.manage", group: "Governance / Compliance", label: "Edit retention / anonymization" },
  { key: "platform.pii.unmask", group: "Governance / Compliance", label: "Unmask member PII", conditions: { ops_admin: "Logged", support_admin: "Logged + ticket/verification required" } },

  { key: "platform.flags.view", group: "Feature flags & entitlements", label: "View flags" },
  { key: "platform.flags.tenant_override", group: "Feature flags & entitlements", label: "Toggle per-tenant override/entitlement" },
  { key: "platform.flags.global_toggle", group: "Feature flags & entitlements", label: "Toggle global flag", conditions: { ops_admin: "Typed-confirm + blast-radius warning" } },
  { key: "platform.flags.rollout", group: "Feature flags & entitlements", label: "Staged rollout %" },
  { key: "platform.entitlements.templates.manage", group: "Feature flags & entitlements", label: "Manage plan/entitlement templates" },

  { key: "platform.revenue.view", group: "Revenue / Billing", label: "View partner/platform revenue", conditions: { support_admin: "No dollar amounts; tier/plan only" } },
  { key: "platform.revenue.settle", group: "Revenue / Billing", label: "Recognize / settle partner revenue" },
  { key: "platform.tenant_billing.retry", group: "Revenue / Billing", label: "Tenant billing: RETRY payment", conditions: { support_admin: "Retry only" } },
  { key: "platform.tenant_billing.refund_credit", group: "Revenue / Billing", label: "Tenant billing: REFUND / credit" },

  { key: "platform.marketplace.apps.review", group: "Marketplace / Add-ons", label: "Review / approve apps" },
  { key: "platform.marketplace.pricing.manage", group: "Marketplace / Add-ons", label: "Create add-on / set pricing" },

  { key: "platform.webhooks.api_keys.manage", group: "System", label: "Webhooks / API keys", conditions: { ops_admin: "View + rotate; no create/delete" } },
  { key: "platform.system_health.view", group: "System", label: "System health / incidents", conditions: { read_only: "View" } },

  { key: "platform.settings.identity_security.edit", group: "Platform Settings", label: "Edit platform identity / security" },
  { key: "platform.settings.legal_registry.edit", group: "Platform Settings", label: "Edit Legal & Compliance registry" },
  { key: "platform.settings.danger_zone", group: "Platform Settings", label: "Danger Zone (maintenance / purge)" }
];

const roleStyles: Record<MatrixRole, string> = {
  founder: "border-kruxt-platform/40 bg-kruxt-platform/15 text-kruxt-platform",
  ops_admin: "border-kruxt-accent/40 bg-kruxt-accent/15 text-kruxt-accent",
  support_admin: "border-kruxt-warning/40 bg-kruxt-warning/15 text-kruxt-warning",
  read_only: "border-border bg-muted text-muted-foreground"
};

const statusStyles: Record<OperatorStatus, string> = {
  active: "bg-kruxt-success",
  suspended: "bg-kruxt-danger"
};

function operatorStatus(operator: OperatorAccount): OperatorStatus {
  return operator.isActive ? "active" : "suspended";
}

function roleLabel(role: PlatformOperatorRole): string {
  if (role === "founder") return "Founder";
  if (role === "ops_admin") return "Admin";
  if (role === "support_admin") return "Support";
  if (role === "read_only") return "Read-only";
  if (role === "compliance_admin") return "Compliance";
  return "Analyst";
}

function matrixRoleFor(role: PlatformOperatorRole): MatrixRole {
  if (role === "founder") return "founder";
  if (role === "support_admin") return "support_admin";
  if (role === "read_only" || role === "analyst") return "read_only";
  return "ops_admin";
}

function initials(name: string, email: string | null): string {
  const source = name.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function groupCapabilities(capabilities: Capability[]): Array<[string, Capability[]]> {
  const groups = new Map<string, Capability[]>();
  for (const capability of capabilities) {
    groups.set(capability.group, [...(groups.get(capability.group) ?? []), capability]);
  }
  return Array.from(groups.entries());
}

function isScoped(metadata: Record<string, unknown>, condition?: string): boolean {
  return Boolean(condition || metadata.scope || metadata.piiPolicy);
}

function buildMatrix(
  rolePermissions: RolePermissionRow[],
  catalog: Map<string, PermissionCatalogRow>
): Map<string, Map<MatrixRole, MatrixCell>> {
  const matrix = new Map<string, Map<MatrixRole, MatrixCell>>();
  for (const capability of CAPABILITIES) {
    const roleMap = new Map<MatrixRole, MatrixCell>();
    for (const { role } of ROLE_COLUMNS) {
      const catalogRow = catalog.get(capability.key);
      const permission = rolePermissions.find((row) => row.role === role && row.permission_key === capability.key);
      const metadata = permission?.metadata ?? catalogRow?.metadata ?? {};
      const condition = capability.conditions?.[role] ?? String(metadata.scope ?? "");
      const allowed = Boolean(permission?.is_allowed);
      roleMap.set(role, {
        level: allowed ? (isScoped(metadata, condition) ? "scoped" : "full") : "none",
        condition: condition || undefined
      });
    }
    matrix.set(capability.key, roleMap);
  }
  return matrix;
}

function accessSymbol(level: AccessLevel): string {
  if (level === "full") return "●";
  if (level === "scoped") return "◐";
  return "○";
}

function accessLabel(level: AccessLevel): string {
  if (level === "full") return "Full";
  if (level === "scoped") return "Scoped";
  return "None";
}

function accessClass(level: AccessLevel): string {
  if (level === "full") return "border-kruxt-success/40 bg-kruxt-success/10 text-kruxt-success";
  if (level === "scoped") return "border-kruxt-warning/40 bg-kruxt-warning/10 text-kruxt-warning";
  return "border-border bg-kruxt-panel text-muted-foreground";
}

function overrideKey(userId: string, permissionKey: string): string {
  return `${userId}:${permissionKey}`;
}

export default function OperatorsPage() {
  const { supabase, platformRole } = usePlatformAuth();
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [catalog, setCatalog] = useState<Map<string, PermissionCatalogRow>>(new Map());
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, DraftOverride>>({});
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEditMatrix = platformRole === "founder";
  const groupedCapabilities = useMemo(() => groupCapabilities(CAPABILITIES), []);
  const catalogMap = catalog;
  const matrix = useMemo(() => buildMatrix(rolePermissions, catalogMap), [catalogMap, rolePermissions]);
  const selectedOperator = operators.find((operator) => operator.userId === selectedOperatorId) ?? null;

  const overrideMap = useMemo(() => {
    const map = new Map<string, OverrideRow>();
    for (const override of overrides) {
      map.set(overrideKey(override.user_id, override.permission_key), override);
    }
    return map;
  }, [overrides]);

  const effectiveDraftCount = Object.keys(draftOverrides).length;
  const sensitivePermissionCount = Array.from(catalog.values()).filter((row) => row.is_sensitive).length;
  const activeCount = operators.filter((operator) => operator.isActive).length;
  const mfaGaps = operators.filter((operator) => operator.isActive && !operator.mfaRequired && matrixRoleFor(operator.role) !== "read_only").length;

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [
        operatorResponse,
        catalogResponse,
        rolePermissionResponse,
        overrideResponse
      ] = await Promise.all([
        supabase.rpc("platform_list_operator_accounts"),
        supabase
          .from("platform_permission_catalog")
          .select("permission_key,is_sensitive,metadata")
          .in("permission_key", CAPABILITIES.map((capability) => capability.key)),
        supabase
          .from("platform_role_permissions")
          .select("role,permission_key,is_allowed,metadata")
          .in("role", ROLE_COLUMNS.map((column) => column.role))
          .in("permission_key", CAPABILITIES.map((capability) => capability.key)),
        supabase
          .from("platform_operator_permission_overrides")
          .select("user_id,permission_key,is_allowed,reason")
          .in("permission_key", CAPABILITIES.map((capability) => capability.key))
      ]);

      if (operatorResponse.error) throw operatorResponse.error;
      if (catalogResponse.error) throw catalogResponse.error;
      if (rolePermissionResponse.error) throw rolePermissionResponse.error;
      if (overrideResponse.error) throw overrideResponse.error;

      setOperators(
        ((operatorResponse.data ?? []) as Array<{
          user_id: string;
          email: string | null;
          display_name: string | null;
          username: string | null;
          role: PlatformOperatorRole;
          is_active: boolean;
          mfa_required: boolean;
          last_login_at: string | null;
          created_at: string;
          override_count: number;
        }>).map((row) => ({
          userId: row.user_id,
          email: row.email,
          displayName: row.display_name ?? row.email ?? row.user_id.slice(0, 8),
          username: row.username,
          role: row.role,
          isActive: row.is_active,
          mfaRequired: row.mfa_required,
          lastLoginAt: row.last_login_at,
          createdAt: row.created_at,
          overrideCount: row.override_count ?? 0
        }))
      );

      setCatalog(
        new Map(
          ((catalogResponse.data ?? []) as PermissionCatalogRow[]).map((row) => [row.permission_key, row])
        )
      );
      setRolePermissions((rolePermissionResponse.data ?? []) as RolePermissionRow[]);
      setOverrides((overrideResponse.data ?? []) as OverrideRow[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load operators.");
    } finally {
      setLoading(false);
    }
  }

  function openDrawer(operator: OperatorAccount) {
    setSelectedOperatorId(operator.userId);
    setDraftOverrides({});
    setChangeReason("");
    setSuccess(null);
    setError(null);
  }

  function closeDrawer() {
    setSelectedOperatorId(null);
    setDraftOverrides({});
    setChangeReason("");
  }

  function readOverrideValue(operator: OperatorAccount, permissionKey: string): boolean | null {
    const draft = draftOverrides[overrideKey(operator.userId, permissionKey)];
    if (draft) return draft.value;
    const persisted = overrideMap.get(overrideKey(operator.userId, permissionKey));
    return persisted ? persisted.is_allowed : null;
  }

  function setDraftOverride(operator: OperatorAccount, permissionKey: string, value: boolean | null) {
    const key = overrideKey(operator.userId, permissionKey);
    const persisted = overrideMap.get(key);
    const persistedValue = persisted ? persisted.is_allowed : null;

    setDraftOverrides((current) => {
      const next = { ...current };
      if (persistedValue === value) {
        delete next[key];
      } else {
        next[key] = { permissionKey, value };
      }
      return next;
    });
    setSuccess(null);
  }

  async function saveOverrides() {
    if (!selectedOperator) return;
    const changes = Object.values(draftOverrides);
    if (changes.length === 0) return;
    if (!changeReason.trim()) {
      setError("Add a reason before saving permission changes.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const change of changes) {
        if (change.value === null) {
          const { error: clearError } = await supabase.rpc("platform_clear_operator_permission_override", {
            p_user_id: selectedOperator.userId,
            p_permission_key: change.permissionKey,
            p_reason: changeReason.trim()
          });
          if (clearError) throw clearError;
        } else {
          const { error: setErrorResponse } = await supabase.rpc("platform_set_operator_permission_override", {
            p_user_id: selectedOperator.userId,
            p_permission_key: change.permissionKey,
            p_is_allowed: change.value,
            p_reason: changeReason.trim()
          });
          if (setErrorResponse) throw setErrorResponse;
        }
      }

      setSuccess(`${changes.length} permission ${changes.length === 1 ? "change" : "changes"} saved and audited.`);
      setDraftOverrides({});
      setChangeReason("");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save permission changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-card border border-border bg-kruxt-surface p-8 text-sm text-muted-foreground">
          Loading operator permissions...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {error && (
        <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/10 px-4 py-3 text-sm text-kruxt-success">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Total Operators" value={operators.length} />
        <Stat label="Active" value={activeCount} tone="success" />
        <Stat label="Permission Overrides" value={overrides.length} tone="platform" />
        <Stat label="MFA Gaps" value={mfaGaps} tone={mfaGaps > 0 ? "danger" : "success"} />
      </div>

      <section className="rounded-card border border-border bg-kruxt-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-kruxt-headline text-sm font-semibold text-foreground">Role Matrix v2</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Legend: ● full · ◐ scoped · ○ none. Built-in roles are read-only; custom cells are per-operator overrides.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="rounded-badge border border-border bg-kruxt-panel px-2 py-1 text-muted-foreground">
              {sensitivePermissionCount} MFA-sensitive cells
            </span>
            <span className="rounded-badge border border-kruxt-warning/30 bg-kruxt-warning/10 px-2 py-1 text-kruxt-warning">
              PII masked until verified
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-[36%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capability</th>
                {ROLE_COLUMNS.map((column) => (
                  <th key={column.role} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {column.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedCapabilities.map(([group, capabilities]) => (
                <Fragment key={group}>
                  <tr key={group} className="border-b border-border/50 bg-kruxt-panel/60">
                    <td colSpan={ROLE_COLUMNS.length + 1} className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-kruxt-platform">
                      {group}
                    </td>
                  </tr>
                  {capabilities.map((capability) => (
                    <tr key={capability.key} className="border-b border-border/40 last:border-0 hover:bg-kruxt-panel/40">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{capability.label}</div>
                        <div className="font-kruxt-mono text-[10px] text-muted-foreground">{capability.key}</div>
                      </td>
                      {ROLE_COLUMNS.map((column) => {
                        const cell = matrix.get(capability.key)?.get(column.role) ?? { level: "none" as const };
                        return (
                          <td key={`${capability.key}:${column.role}`} className="px-3 py-2.5 text-center">
                            <span
                              title={cell.condition ?? accessLabel(cell.level)}
                              className={cn("inline-flex min-w-10 justify-center rounded-md border px-2 py-1 font-kruxt-mono text-sm", accessClass(cell.level))}
                            >
                              {accessSymbol(cell.level)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-border bg-kruxt-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-kruxt-headline text-sm font-semibold text-foreground">Operators</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operator</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">MFA</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overrides</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => {
                const role = matrixRoleFor(operator.role);
                const status = operatorStatus(operator);
                return (
                  <tr key={operator.userId} className="border-b border-border/50 last:border-0 transition-colors hover:bg-kruxt-panel/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kruxt-panel text-xs font-bold text-foreground">
                          {initials(operator.displayName, operator.email)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{operator.displayName}</p>
                          <p className="text-xs text-muted-foreground">{operator.email ?? operator.username ?? operator.userId.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-badge border px-2 py-0.5 text-[10px] font-bold uppercase", roleStyles[role])}>
                        {roleLabel(operator.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", statusStyles[status])} />
                        <span className="capitalize text-foreground">{status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase",
                        operator.mfaRequired ? "bg-kruxt-success/15 text-kruxt-success" : "bg-kruxt-danger/15 text-kruxt-danger"
                      )}>
                        {operator.mfaRequired ? "Required" : "Gap"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(operator.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">
                      {operator.overrideCount || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDrawer(operator)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOperator && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-kruxt-bg shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-border bg-kruxt-bg/95 px-6 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-kruxt-platform">Operator Permission Matrix</p>
                  <h2 className="mt-1 font-kruxt-headline text-xl font-bold text-foreground">{selectedOperator.displayName}</h2>
                  <p className="text-sm text-muted-foreground">{selectedOperator.email ?? selectedOperator.userId}</p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DrawerMetric label="Base role" value={roleLabel(selectedOperator.role)} />
                <DrawerMetric label="Custom overrides" value={String(selectedOperator.overrideCount)} />
                <DrawerMetric label="MFA rule" value={selectedOperator.mfaRequired ? "Required" : "Gap"} danger={!selectedOperator.mfaRequired} />
              </div>

              {selectedOperator.role === "founder" && (
                <div className="rounded-card border border-kruxt-platform/30 bg-kruxt-platform/10 px-4 py-3 text-sm text-kruxt-platform">
                  Founder permissions are intentionally non-editable and always full.
                </div>
              )}

              {!canEditMatrix && (
                <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/10 px-4 py-3 text-sm text-kruxt-warning">
                  Your role can view this matrix but cannot save permission changes.
                </div>
              )}

              <div className="rounded-card border border-border bg-kruxt-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-kruxt-headline text-sm font-semibold text-foreground">Custom Overrides</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Built-in role chips are read-only. Toggle Custom to override this operator. Save writes one Audit Log entry per changed cell.
                    </p>
                  </div>
                  <span className="rounded-badge bg-kruxt-platform/15 px-2 py-1 text-[10px] font-bold uppercase text-kruxt-platform">
                    {effectiveDraftCount} pending
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="w-[38%] px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capability</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom</th>
                        <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCapabilities.map(([group, capabilities]) => (
                        <Fragment key={`${group}:drawer-fragment`}>
                          <tr key={`${group}:drawer`} className="border-b border-border/50 bg-kruxt-panel/60">
                            <td colSpan={4} className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-kruxt-platform">
                              {group}
                            </td>
                          </tr>
                          {capabilities.map((capability) => {
                            const baseRole = matrixRoleFor(selectedOperator.role);
                            const base = matrix.get(capability.key)?.get(baseRole) ?? { level: "none" as const };
                            const customValue = readOverrideValue(selectedOperator, capability.key);
                            const persistedOverride = overrideMap.get(overrideKey(selectedOperator.userId, capability.key));
                            const disabled = selectedOperator.role === "founder" || !canEditMatrix || saving;
                            return (
                              <tr key={`${selectedOperator.userId}:${capability.key}`} className="border-b border-border/40 last:border-0">
                                <td className="px-3 py-2.5">
                                  <div className="font-medium text-foreground">{capability.label}</div>
                                  <div className="font-kruxt-mono text-[10px] text-muted-foreground">{capability.key}</div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    title={base.condition ?? accessLabel(base.level)}
                                    className={cn("inline-flex min-w-10 justify-center rounded-md border px-2 py-1 font-kruxt-mono text-sm", accessClass(base.level))}
                                  >
                                    {accessSymbol(base.level)}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => setDraftOverride(selectedOperator, capability.key, true)}
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40",
                                        customValue === true ? "border-kruxt-success/40 bg-kruxt-success/15 text-kruxt-success" : "border-border text-muted-foreground hover:bg-kruxt-panel"
                                      )}
                                    >
                                      Allow
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => setDraftOverride(selectedOperator, capability.key, false)}
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40",
                                        customValue === false ? "border-kruxt-danger/40 bg-kruxt-danger/15 text-kruxt-danger" : "border-border text-muted-foreground hover:bg-kruxt-panel"
                                      )}
                                    >
                                      Deny
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disabled || !persistedOverride}
                                      onClick={() => setDraftOverride(selectedOperator, capability.key, null)}
                                      className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-kruxt-panel disabled:opacity-30"
                                    >
                                      Base
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                  {base.condition ?? (catalog.get(capability.key)?.is_sensitive ? "MFA required for write/danger/money access" : "—")}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-card border border-border bg-kruxt-surface p-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Audit reason</label>
                <textarea
                  value={changeReason}
                  onChange={(event) => setChangeReason(event.target.value)}
                  rows={3}
                  placeholder="Required before saving. Example: temporary support escalation for verified ticket KRX-123."
                  className="w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-platform focus:outline-none focus:ring-1 focus:ring-kruxt-platform/40"
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftOverrides({})}
                    disabled={saving || effectiveDraftCount === 0}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel disabled:opacity-40"
                  >
                    Clear pending
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveOverrides()}
                    disabled={saving || effectiveDraftCount === 0 || selectedOperator.role === "founder" || !canEditMatrix}
                    className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {saving ? "Saving..." : `Save ${effectiveDraftCount || ""} changes`}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="font-kruxt-headline text-2xl font-bold tracking-tight">Operators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KRUXT internal operator accounts, built-in roles, and audited custom permission overrides.
        </p>
      </div>
      <button
        type="button"
        disabled
        title="Operator invites require the account invitation workflow."
        className="rounded-button border border-border px-4 py-2 text-sm font-semibold text-muted-foreground opacity-60"
      >
        Invite Operator
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "platform" | "danger";
}) {
  return (
    <div className="rounded-card border border-border bg-kruxt-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 font-kruxt-mono text-2xl font-bold",
        tone === "success" && "text-kruxt-success",
        tone === "platform" && "text-kruxt-platform",
        tone === "danger" && "text-kruxt-danger",
        tone === "default" && "text-foreground"
      )}>
        {value}
      </p>
    </div>
  );
}

function DrawerMetric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-kruxt-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-kruxt-mono text-lg font-bold", danger ? "text-kruxt-danger" : "text-foreground")}>{value}</p>
    </div>
  );
}
