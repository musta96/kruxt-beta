"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface SupportGrant {
  id: string;
  gym: string;
  requestedBy: string;
  operator: string;
  reason: string;
  scope: string;
  status: "requested" | "approved" | "active" | "expired" | "revoked";
  requestedAt: string;
  expiresAt: string | null;
}

const mockGrants: SupportGrant[] = [
  { id: "sg_01", gym: "Iron Temple Fitness", requestedBy: "John (Gym Admin)", operator: "Marcus Johnson", reason: "Billing dispute investigation", scope: "billing, members (read-only)", status: "requested", requestedAt: "2026-03-21T08:45:00Z", expiresAt: null },
  { id: "sg_02", gym: "CrossFit Apex", requestedBy: "Lisa (Gym Admin)", operator: "Marcus Johnson", reason: "Class scheduling issue", scope: "classes, check-ins (read-only)", status: "requested", requestedAt: "2026-03-21T07:30:00Z", expiresAt: null },
  { id: "sg_03", gym: "Summit Training Co.", requestedBy: "Mike (Gym Admin)", operator: "Sarah Chen", reason: "Data migration assistance", scope: "full access", status: "requested", requestedAt: "2026-03-20T16:00:00Z", expiresAt: null },
  { id: "sg_04", gym: "Urban Fit Lab", requestedBy: "Amy (Gym Admin)", operator: "Marcus Johnson", reason: "Integration troubleshooting", scope: "integrations (read-write)", status: "active", requestedAt: "2026-03-19T10:00:00Z", expiresAt: "2026-03-22T10:00:00Z" },
  { id: "sg_05", gym: "Atlas Barbell Club", requestedBy: "Derek (Gym Admin)", operator: "Sarah Chen", reason: "Member import fix", scope: "members (read-write)", status: "approved", requestedAt: "2026-03-18T14:00:00Z", expiresAt: "2026-03-21T14:00:00Z" },
  { id: "sg_06", gym: "Flex Zone Studio", requestedBy: "Rachel (Gym Admin)", operator: "Marcus Johnson", reason: "Waiver template setup", scope: "waivers (read-write)", status: "expired", requestedAt: "2026-03-10T09:00:00Z", expiresAt: "2026-03-13T09:00:00Z" },
];

const statusStyles = {
  requested: "bg-kruxt-warning/20 text-kruxt-warning border-kruxt-warning/30",
  approved: "bg-kruxt-accent/20 text-kruxt-accent border-kruxt-accent/30",
  active: "bg-kruxt-success/20 text-kruxt-success border-kruxt-success/30",
  expired: "bg-muted text-muted-foreground border-border",
  revoked: "bg-kruxt-danger/20 text-kruxt-danger border-kruxt-danger/30",
};

export default function SupportAccessPage() {
  const [tab, setTab] = useState<"pending" | "active" | "history">("pending");

  const pending = mockGrants.filter((g) => g.status === "requested");
  const active = mockGrants.filter((g) => g.status === "approved" || g.status === "active");
  const history = mockGrants.filter((g) => g.status === "expired" || g.status === "revoked");

  const displayed = tab === "pending" ? pending : tab === "active" ? active : history;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Support Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delegated support access grants. Approve, monitor, and revoke operator access to gym data.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-warning">Pending Approval</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-warning">{pending.length}</p>
        </div>
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-kruxt-success">Active Sessions</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-kruxt-success">{active.length}</p>
        </div>
        <div className="rounded-card border border-border bg-kruxt-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total (30d)</p>
          <p className="mt-1 text-3xl font-bold font-kruxt-mono text-foreground">{mockGrants.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-kruxt-surface p-1 w-fit">
        {([
          { key: "pending", label: "Pending", count: pending.length },
          { key: "active", label: "Active", count: active.length },
          { key: "history", label: "History", count: history.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-kruxt-platform/20 text-kruxt-platform"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Grant cards */}
      <div className="space-y-3">
        {displayed.map((grant) => (
          <div
            key={grant.id}
            className="rounded-card border border-border bg-kruxt-surface p-5"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">{grant.gym}</h3>
                  <span className={cn("inline-flex rounded-badge border px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[grant.status])}>
                    {grant.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Requested by <span className="text-foreground">{grant.requestedBy}</span> for <span className="text-foreground">{grant.operator}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(grant.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</p>
                <p className="mt-0.5 text-sm text-foreground">{grant.reason}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope</p>
                <p className="mt-0.5 text-sm text-foreground">{grant.scope}</p>
              </div>
            </div>

            {grant.expiresAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Expires: {new Date(grant.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            {grant.status === "requested" && (
              <div className="mt-4 flex gap-2">
                <button className="rounded-button bg-kruxt-success/20 px-4 py-1.5 text-sm font-medium text-kruxt-success transition-colors hover:bg-kruxt-success/30">
                  Approve
                </button>
                <button className="rounded-button bg-kruxt-danger/20 px-4 py-1.5 text-sm font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/30">
                  Deny
                </button>
              </div>
            )}
            {(grant.status === "approved" || grant.status === "active") && (
              <div className="mt-4">
                <button className="rounded-button bg-kruxt-danger/20 px-4 py-1.5 text-sm font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/30">
                  Revoke Access
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
