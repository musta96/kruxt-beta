import { Fragment, useMemo, useState, type FormEvent } from "react";
import type { GymRole } from "@kruxt/types";
import type {
  CreateGymCustomRoleInput,
  GymCustomRole,
  GymRolePermissionMatrix,
  SetGymCustomRolePermissionInput
} from "@/services/gym-admin-service";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type RoleColumnId = "owner" | "officer" | "coach" | "member";
type AccessKind = "full" | "scoped" | "self" | "none" | "na";

interface RoleColumn {
  id: RoleColumnId;
  label: string;
  dbRole: GymRole;
  description: string;
}

interface PermissionCell {
  kind: AccessKind;
  note?: string;
}

interface MatrixRow {
  capability: string;
  entitlement?: string;
  permissionKeys?: string[];
  cells: Record<RoleColumnId, PermissionCell>;
}

interface MatrixSection {
  title: string;
  rows: MatrixRow[];
}

interface StaffPermissionMatrixProps {
  matrix?: GymRolePermissionMatrix;
  status?: AsyncStatus;
  error?: string;
  onRetry?: () => void;
  onCreateCustomRole?: (input: CreateGymCustomRoleInput) => Promise<unknown>;
  onSetCustomPermission?: (input: SetGymCustomRolePermissionInput) => Promise<unknown>;
  onMatrixChanged?: () => void;
}

const ROLE_COLUMNS: RoleColumn[] = [
  { id: "owner", label: "OWNER", dbRole: "leader", description: "Leader in the database" },
  { id: "officer", label: "OFFICER", dbRole: "officer", description: "Manager/front-desk lead" },
  { id: "coach", label: "PT/COACH", dbRole: "coach", description: "Assigned-athlete scope" },
  { id: "member", label: "MEMBER", dbRole: "member", description: "Consumer self-service" }
];

const ACCESS_COPY: Record<AccessKind, string> = {
  full: "Full",
  scoped: "Scoped",
  self: "Self",
  none: "None",
  na: "n/a"
};

const ACCESS_CLASS: Record<AccessKind, string> = {
  full: "border-kruxt-success/30 bg-kruxt-success/10 text-kruxt-success",
  scoped: "border-kruxt-warning/30 bg-kruxt-warning/10 text-kruxt-warning",
  self: "border-kruxt-accent/30 bg-kruxt-accent/10 text-kruxt-accent",
  none: "border-border bg-kruxt-panel/60 text-muted-foreground",
  na: "border-border bg-transparent text-muted-foreground"
};

const MATRIX_SECTIONS: MatrixSection[] = [
  {
    title: "Members",
    rows: [
      {
        capability: "View member directory",
        permissionKeys: ["admin.members.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "PII masked until verification" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Create member profile + magic-link invite",
        permissionKeys: ["admin.members.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own prospective athletes; no role grants" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Edit member access / role / status",
        permissionKeys: ["admin.members.manage", "admin.roles.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Assign PT to a member",
        permissionKeys: ["admin.members.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Approve pending gym-access requests",
        permissionKeys: ["admin.members.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Pause / cancel a membership",
        permissionKeys: ["admin.members.manage", "billing.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "self", note: "Request only" }
        }
      },
      {
        capability: "Unmask member PII",
        permissionKeys: ["admin.members.manage"],
        cells: {
          owner: { kind: "full", note: "Logged" },
          officer: { kind: "scoped", note: "Logged + ticket/verification required" },
          coach: { kind: "scoped", note: "Own athletes only; logged" },
          member: { kind: "self", note: "Own data only" }
        }
      },
      {
        capability: "Bulk import/export members",
        permissionKeys: ["crm.members.export"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Consent-gated and logged" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      }
    ]
  },
  {
    title: "Staff & Roles",
    rows: [
      {
        capability: "View staff",
        permissionKeys: ["staff.shifts.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Names and schedule only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Create/invite staff",
        permissionKeys: ["admin.roles.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "PT only; never Officers" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Edit staff roles / permissions",
        permissionKeys: ["admin.roles.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Revoke / disable staff",
        permissionKeys: ["admin.roles.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "PT only" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      }
    ]
  },
  {
    title: "Classes & Scheduling",
    rows: [
      {
        capability: "View classes",
        permissionKeys: ["ops.classes.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "full" },
          member: { kind: "self", note: "Book/view" }
        }
      },
      {
        capability: "Create / edit / cancel classes",
        permissionKeys: ["ops.classes.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own classes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Assign coach to a class",
        permissionKeys: ["ops.classes.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Manage capacity / waitlist",
        permissionKeys: ["ops.classes.manage", "ops.waitlist.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own classes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Book / cancel a class spot",
        permissionKeys: ["ops.classes.manage", "ops.waitlist.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "full" },
          member: { kind: "self", note: "Self only" }
        }
      }
    ]
  },
  {
    title: "Check-ins",
    rows: [
      {
        capability: "View check-in feed",
        permissionKeys: ["ops.checkins.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Manual check-in / door control",
        permissionKeys: ["ops.checkins.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own classes only" },
          member: { kind: "self", note: "Self check-in" }
        }
      }
    ]
  },
  {
    title: "Waivers",
    rows: [
      {
        capability: "View / manage waiver templates",
        permissionKeys: ["ops.waivers.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Send / require waiver",
        permissionKeys: ["ops.waivers.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Sign waiver",
        permissionKeys: ["ops.waivers.manage"],
        cells: {
          owner: { kind: "na" },
          officer: { kind: "na" },
          coach: { kind: "na" },
          member: { kind: "self" }
        }
      }
    ]
  },
  {
    title: "Billing & Payments",
    rows: [
      {
        capability: "View billing / revenue",
        entitlement: "member_payments",
        permissionKeys: ["billing.view"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full", note: "Full money view" },
          coach: { kind: "none" },
          member: { kind: "self", note: "Own invoices only" }
        }
      },
      {
        capability: "Record manual payment / issue invoice",
        entitlement: "manual_payment_recording",
        permissionKeys: ["billing.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Retry failed payment",
        entitlement: "member_payments",
        permissionKeys: ["billing.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Refund / credit",
        entitlement: "refunds_credits",
        permissionKeys: ["billing.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Typed-confirm guard" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Edit plans / pricing",
        entitlement: "member_payments",
        permissionKeys: ["billing.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Visibility toggles only; no price changes" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "View own membership invoices / pay",
        entitlement: "member_payments",
        permissionKeys: ["billing.view"],
        cells: {
          owner: { kind: "na" },
          officer: { kind: "na" },
          coach: { kind: "na" },
          member: { kind: "self" }
        }
      }
    ]
  },
  {
    title: "PT / Coaching Workspace",
    rows: [
      {
        capability: "Access coaching workspace",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "View only; no plan edits" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Build / publish training plan",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Per-exercise swap / adapt plan",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "scoped", note: "Own athletes only; versioned" },
          member: { kind: "none" }
        }
      },
      {
        capability: "In-app message a member",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage", "support.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Ops announcements only" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "self", note: "Reply to own PT" }
        }
      },
      {
        capability: "View progress / stats / wearable data",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage", "integrations.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Aggregate only" },
          coach: { kind: "scoped", note: "Own athletes only" },
          member: { kind: "self" }
        }
      },
      {
        capability: "Log own workout / progress",
        entitlement: "private_coaching_workspace",
        permissionKeys: ["programs.manage"],
        cells: {
          owner: { kind: "na" },
          officer: { kind: "na" },
          coach: { kind: "na" },
          member: { kind: "self" }
        }
      }
    ]
  },
  {
    title: "Integrations",
    rows: [
      {
        capability: "Manage wearable / device integrations",
        entitlement: "wearable_integrations",
        permissionKeys: ["integrations.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Enable/disable only" },
          coach: { kind: "none" },
          member: { kind: "self", note: "Connect own device" }
        }
      }
    ]
  },
  {
    title: "Compliance / Data",
    rows: [
      {
        capability: "View compliance / privacy requests",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Handle DSAR (view)",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "PII masked until verified" },
          coach: { kind: "none" },
          member: { kind: "self", note: "Own request" }
        }
      },
      {
        capability: "DSAR fulfill (export)",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Export only; no erase" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "DSAR fulfill (erase)",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Request own data export / erasure",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "na" },
          officer: { kind: "na" },
          coach: { kind: "na" },
          member: { kind: "self" }
        }
      },
      {
        capability: "View gym Activity / Audit log",
        permissionKeys: ["compliance.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "View only; no export" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      }
    ]
  },
  {
    title: "Support",
    rows: [
      {
        capability: "View / respond to support tickets",
        permissionKeys: ["support.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "full" },
          coach: { kind: "scoped", note: "Own athletes' tickets" },
          member: { kind: "self", note: "Own tickets" }
        }
      }
    ]
  },
  {
    title: "Gym Settings",
    rows: [
      {
        capability: "Edit white-label / public page / publish",
        entitlement: "public_page_publish",
        permissionKeys: ["gym.brand.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Edit draft; OWNER publishes" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Edit gym identity / Terms / Privacy URLs",
        permissionKeys: ["gym.brand.manage", "gym.features.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Manage plan visibility",
        permissionKeys: ["gym.features.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "scoped", note: "Visibility toggles only" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Security (MFA/devices) for the gym",
        permissionKeys: ["gym.features.manage"],
        cells: {
          owner: { kind: "full" },
          officer: { kind: "none" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      },
      {
        capability: "Danger Zone (seed/reset/destructive)",
        permissionKeys: ["gym.features.manage"],
        cells: {
          owner: { kind: "full", note: "Typed-confirm guard" },
          officer: { kind: "none" },
          coach: { kind: "none" },
          member: { kind: "none" }
        }
      }
    ]
  }
];

function dbPermissionIndex(matrix?: GymRolePermissionMatrix): Map<string, boolean> {
  const index = new Map<string, boolean>();
  for (const permission of matrix?.rolePermissions ?? []) {
    index.set(`${permission.role}:${permission.permissionKey}`, permission.isAllowed);
  }
  return index;
}

function customPermissionIndex(matrix?: GymRolePermissionMatrix): Map<string, boolean> {
  const index = new Map<string, boolean>();
  for (const permission of matrix?.customRolePermissions ?? []) {
    index.set(`${permission.customRoleId}:${permission.permissionKey}`, permission.isAllowed);
  }
  return index;
}

function catalogIndex(matrix?: GymRolePermissionMatrix): Map<string, string> {
  const index = new Map<string, string>();
  for (const item of matrix?.catalog ?? []) {
    index.set(item.permissionKey, item.description ? `${item.label}: ${item.description}` : item.label);
  }
  return index;
}

function capabilityIndex(matrix?: GymRolePermissionMatrix): Map<string, GymRolePermissionMatrix["capabilities"][number]> {
  const index = new Map<string, GymRolePermissionMatrix["capabilities"][number]>();
  for (const capability of matrix?.capabilities ?? []) {
    index.set(capability.capabilityKey, capability);
  }
  return index;
}

function capabilityState(
  capabilityKey: string | undefined,
  index: Map<string, GymRolePermissionMatrix["capabilities"][number]>
): string | null {
  if (!capabilityKey) return null;

  const capability = index.get(capabilityKey);
  if (!capability) return "Entitlement unmapped";
  if (capability.valueType === "limit") {
    const limit = capability.effectiveLimit ?? 0;
    const value = limit >= 1_000_000_000 ? "Unlimited" : limit.toLocaleString();
    return `Entitlement: ${value} (${capability.source})`;
  }

  return `Entitlement: ${capability.effectiveBool ? "on" : "off"} (${capability.source})`;
}

function dbCoverage(keys: string[] | undefined, role: GymRole, index: Map<string, boolean>): string | null {
  if (!keys?.length) return null;

  const values = keys.map((key) => index.get(`${role}:${key}`)).filter((value): value is boolean => value !== undefined);
  if (values.length === 0) return "DB unmapped";
  if (values.every(Boolean)) return "DB on";
  if (values.every((value) => !value)) return "DB off";
  return "DB mixed";
}

function customCoverage(
  keys: string[] | undefined,
  customRoleId: string,
  index: Map<string, boolean>
): { label: string; nextValue?: boolean; tone: "on" | "off" | "mixed" | "empty" } {
  if (!keys?.length) return { label: "No DB key", tone: "empty" };

  const values = keys.map((key) => index.get(`${customRoleId}:${key}`) ?? false);
  if (values.every(Boolean)) return { label: "On", nextValue: false, tone: "on" };
  if (values.every((value) => !value)) return { label: "Off", nextValue: true, tone: "off" };
  return { label: "Mixed", nextValue: true, tone: "mixed" };
}

function customCoverageClass(tone: "on" | "off" | "mixed" | "empty"): string {
  if (tone === "on") return "border-kruxt-success/40 bg-kruxt-success/10 text-kruxt-success";
  if (tone === "mixed") return "border-kruxt-warning/40 bg-kruxt-warning/10 text-kruxt-warning";
  if (tone === "empty") return "border-border bg-transparent text-muted-foreground";
  return "border-border bg-kruxt-panel/60 text-muted-foreground";
}

function baseRoleLabel(role: GymRole): string {
  const match = ROLE_COLUMNS.find((column) => column.dbRole === role);
  return match?.label ?? role;
}

function accessTitle(cell: PermissionCell): string {
  const label = ACCESS_COPY[cell.kind];
  return cell.note ? `${label}: ${cell.note}` : label;
}

export function StaffPermissionMatrix({
  matrix,
  status = "success",
  error,
  onRetry,
  onCreateCustomRole,
  onSetCustomPermission,
  onMatrixChanged
}: StaffPermissionMatrixProps) {
  const permissionIndex = useMemo(() => dbPermissionIndex(matrix), [matrix]);
  const customIndex = useMemo(() => customPermissionIndex(matrix), [matrix]);
  const catalog = useMemo(() => catalogIndex(matrix), [matrix]);
  const capabilities = useMemo(() => capabilityIndex(matrix), [matrix]);
  const customRoles = matrix?.customRoles ?? [];
  const customRolesCapability = capabilities.get("custom_staff_roles");
  const customRolesEnabled = customRolesCapability?.effectiveBool === true;
  const isLoading = status === "loading" || status === "idle";
  const isError = status === "error";
  const [customRoleLabel, setCustomRoleLabel] = useState("");
  const [customRoleKey, setCustomRoleKey] = useState("");
  const [customBaseRole, setCustomBaseRole] = useState<GymRole>("coach");
  const [customReason, setCustomReason] = useState("");
  const [customMutationError, setCustomMutationError] = useState<string | null>(null);
  const [savingCustomRole, setSavingCustomRole] = useState(false);
  const [mutatingCell, setMutatingCell] = useState<string | null>(null);

  const customRoleSummary = customRolesEnabled
    ? `${customRoles.length} custom role${customRoles.length === 1 ? "" : "s"} editable`
    : `Entitlement ${customRolesCapability ? "off" : "unmapped"}; custom cells are locked`;

  async function handleCreateCustomRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onCreateCustomRole) return;

    const label = customRoleLabel.trim();
    if (label.length < 2) {
      setCustomMutationError("Custom role label must be at least 2 characters.");
      return;
    }

    setSavingCustomRole(true);
    setCustomMutationError(null);
    try {
      await onCreateCustomRole({
        label,
        roleKey: customRoleKey.trim() || null,
        baseRole: customBaseRole,
        reason: customReason.trim() || "Created from Staff role matrix"
      });
      setCustomRoleLabel("");
      setCustomRoleKey("");
      setCustomBaseRole("coach");
      setCustomReason("");
      onMatrixChanged?.();
    } catch (mutationError) {
      setCustomMutationError(mutationError instanceof Error ? mutationError.message : "Unable to create custom role.");
    } finally {
      setSavingCustomRole(false);
    }
  }

  async function toggleCustomPermissions(customRole: GymCustomRole, keys: string[] | undefined) {
    if (!onSetCustomPermission || !keys?.length || !customRolesEnabled) return;

    const coverage = customCoverage(keys, customRole.id, customIndex);
    if (coverage.nextValue === undefined) return;

    const mutationKey = `${customRole.id}:${keys.join(",")}`;
    setMutatingCell(mutationKey);
    setCustomMutationError(null);
    try {
      for (const key of keys) {
        await onSetCustomPermission({
          customRoleId: customRole.id,
          permissionKey: key,
          isAllowed: coverage.nextValue,
          reason: customReason.trim() || `Matrix toggle for ${customRole.label}`
        });
      }
      onMatrixChanged?.();
    } catch (mutationError) {
      setCustomMutationError(
        mutationError instanceof Error ? mutationError.message : "Unable to update custom role permission."
      );
    } finally {
      setMutatingCell(null);
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground font-kruxt-headline">
            Staff governance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground font-kruxt-headline">
            Role / Permission Matrix
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Permission = role allows it + gym entitlement enables it + scope check passes. Built-in roles stay read-only
            policy chips; custom role columns are editable and every mutation is audit-logged by RPC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-badge border border-kruxt-success/30 bg-kruxt-success/10 px-2.5 py-1 text-xs font-semibold text-kruxt-success">
            MFA for Owner/Officer money cells
          </span>
          <span className="rounded-badge border border-kruxt-warning/30 bg-kruxt-warning/10 px-2.5 py-1 text-xs font-semibold text-kruxt-warning">
            PII masked until verified
          </span>
          <span className="rounded-badge border border-kruxt-accent/30 bg-kruxt-accent/10 px-2.5 py-1 text-xs font-semibold text-kruxt-accent">
            PT scoped to own athletes
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-kruxt-panel/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resolution order</p>
          <p className="mt-1 text-sm text-foreground">Tenant entitlement {"->"} role policy {"->"} scope predicate</p>
        </div>
        <div className="rounded-lg border border-border bg-kruxt-panel/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">DB source</p>
          <p className="mt-1 text-sm text-foreground">
            {isLoading
              ? "Loading role defaults..."
              : `${matrix?.rolePermissions.length ?? 0} role defaults / ${matrix?.capabilities.length ?? 0} entitlements`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-kruxt-panel/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Custom roles</p>
          <p className="mt-1 text-sm text-foreground">{customRoleSummary}</p>
        </div>
      </div>

      <form
        onSubmit={handleCreateCustomRole}
        className="mt-4 rounded-lg border border-border bg-kruxt-panel/35 p-3"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="custom-role-label">
              New custom role
            </label>
            <input
              id="custom-role-label"
              value={customRoleLabel}
              onChange={(event) => setCustomRoleLabel(event.target.value)}
              disabled={!customRolesEnabled || !onCreateCustomRole || savingCustomRole}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none disabled:opacity-50"
              placeholder="Senior coach, Front desk weekend..."
            />
          </div>
          <div className="min-w-[150px]">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="custom-base-role">
              Clone from
            </label>
            <select
              id="custom-base-role"
              value={customBaseRole}
              onChange={(event) => setCustomBaseRole(event.target.value as GymRole)}
              disabled={!customRolesEnabled || !onCreateCustomRole || savingCustomRole}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-kruxt-accent focus:outline-none disabled:opacity-50"
            >
              {ROLE_COLUMNS.map((role) => (
                <option key={role.dbRole} value={role.dbRole}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[170px]">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="custom-role-key">
              Optional key
            </label>
            <input
              id="custom-role-key"
              value={customRoleKey}
              onChange={(event) => setCustomRoleKey(event.target.value)}
              disabled={!customRolesEnabled || !onCreateCustomRole || savingCustomRole}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none disabled:opacity-50"
              placeholder="senior-coach"
            />
          </div>
          <div className="min-w-[220px] flex-[1.2]">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="custom-role-reason">
              Audit reason
            </label>
            <input
              id="custom-role-reason"
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
              disabled={!customRolesEnabled || savingCustomRole}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none disabled:opacity-50"
              placeholder="Why this role or permission changed"
            />
          </div>
          <button
            type="submit"
            disabled={!customRolesEnabled || !onCreateCustomRole || savingCustomRole}
            className="rounded-button bg-kruxt-accent px-4 py-2.5 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savingCustomRole ? "Creating..." : "Create Role"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Custom roles clone a built-in role, then you can toggle the custom cells below. Built-in cells remain policy reference only.
        </p>
      </form>

      {customMutationError && (
        <div className="mt-4 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 p-3 text-sm text-kruxt-danger">
          {customMutationError}
        </div>
      )}

      {isError && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 p-3 text-sm text-kruxt-danger sm:flex-row sm:items-center sm:justify-between">
          <span>{error ?? "Unable to load DB-backed role defaults. Policy matrix remains visible."}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-button border border-kruxt-danger/30 px-3 py-1.5 text-xs font-semibold text-kruxt-danger"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && (matrix?.rolePermissions.length ?? 0) === 0 && (
        <div className="mt-4 rounded-lg border border-kruxt-warning/30 bg-kruxt-warning/10 p-3 text-sm text-kruxt-warning">
          No role-permission rows were visible for this gym. The finalized policy matrix is shown, but DB coverage chips
          will stay unmapped until seeded defaults are readable for this tenant.
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[1120px] w-full border-collapse">
          <thead className="bg-kruxt-panel/60">
            <tr>
              <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Capability
              </th>
              {ROLE_COLUMNS.map((role) => (
                <th key={role.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <span className="block text-foreground">{role.label}</span>
                  <span className="mt-1 block normal-case tracking-normal text-muted-foreground">{role.description}</span>
                </th>
              ))}
              {customRoles.map((role) => (
                <th
                  key={role.id}
                  className="min-w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  <span className="block text-kruxt-accent">{role.label}</span>
                  <span className="mt-1 block normal-case tracking-normal text-muted-foreground">
                    Custom / base {baseRoleLabel(role.baseRole)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_SECTIONS.map((section) => (
              <Fragment key={section.title}>
                <tr>
                  <td
                    colSpan={ROLE_COLUMNS.length + customRoles.length + 1}
                    className="border-t border-border bg-kruxt-panel/35 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-kruxt-accent"
                  >
                    {section.title}
                  </td>
                </tr>
                {section.rows.map((row) => (
                  <tr key={`${section.title}-${row.capability}`} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{row.capability}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.entitlement && (
                          <span
                            title={capabilityState(row.entitlement, capabilities) ?? row.entitlement}
                            className="rounded-badge border border-kruxt-accent/25 bg-kruxt-accent/10 px-2 py-0.5 text-[11px] text-kruxt-accent"
                          >
                            {capabilityState(row.entitlement, capabilities) ?? `ent:${row.entitlement}`}
                          </span>
                        )}
                        {(row.permissionKeys ?? []).map((key) => (
                          <span
                            key={key}
                            title={catalog.get(key) ?? key}
                            className="rounded-badge border border-border bg-kruxt-panel px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </td>
                    {ROLE_COLUMNS.map((role) => {
                      const cell = row.cells[role.id];
                      const db = dbCoverage(row.permissionKeys, role.dbRole, permissionIndex);

                      return (
                        <td key={role.id} className="px-4 py-3">
                          <span
                            title={accessTitle(cell)}
                            className={`inline-flex rounded-badge border px-2.5 py-1 text-xs font-semibold ${ACCESS_CLASS[cell.kind]}`}
                          >
                            {ACCESS_COPY[cell.kind]}
                          </span>
                          {cell.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{cell.note}</p>}
                          {db && (
                            <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                              {db}
                            </p>
                          )}
                        </td>
                      );
                    })}
                    {customRoles.map((customRole) => {
                      const coverage = customCoverage(row.permissionKeys, customRole.id, customIndex);
                      const cellMutationKey = `${customRole.id}:${(row.permissionKeys ?? []).join(",")}`;
                      const isMutating = mutatingCell === cellMutationKey;
                      const isDisabled =
                        !customRolesEnabled ||
                        !onSetCustomPermission ||
                        coverage.nextValue === undefined ||
                        Boolean(mutatingCell);

                      return (
                        <td key={customRole.id} className="px-4 py-3">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => void toggleCustomPermissions(customRole, row.permissionKeys)}
                            title={
                              row.permissionKeys?.length
                                ? `${customRole.label}: ${(row.permissionKeys ?? []).join(", ")}`
                                : "This policy row has no mapped DB permission key."
                            }
                            className={`inline-flex rounded-badge border px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-55 ${customCoverageClass(
                              coverage.tone
                            )}`}
                          >
                            {isMutating ? "Saving..." : coverage.label}
                          </button>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {customRolesEnabled
                              ? coverage.nextValue === undefined
                                ? "No mapped key"
                                : `Toggle to ${coverage.nextValue ? "allow" : "deny"}`
                              : "Entitlement locked"}
                          </p>
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
  );
}
