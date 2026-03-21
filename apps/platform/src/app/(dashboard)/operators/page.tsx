"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Operator {
  id: string;
  name: string;
  email: string;
  role: "founder" | "admin" | "support" | "readonly";
  status: "active" | "invited" | "suspended";
  lastLogin: string;
  permissionOverrides: number;
}

const mockOperators: Operator[] = [
  { id: "op_01", name: "Edoardo Mustarelli", email: "edo@kruxt.io", role: "founder", status: "active", lastLogin: "2026-03-21T08:30:00Z", permissionOverrides: 0 },
  { id: "op_02", name: "Sarah Chen", email: "sarah@kruxt.io", role: "admin", status: "active", lastLogin: "2026-03-21T07:15:00Z", permissionOverrides: 2 },
  { id: "op_03", name: "Marcus Johnson", email: "marcus@kruxt.io", role: "support", status: "active", lastLogin: "2026-03-20T22:45:00Z", permissionOverrides: 1 },
  { id: "op_04", name: "Ava Rodriguez", email: "ava@kruxt.io", role: "admin", status: "invited", lastLogin: "—", permissionOverrides: 0 },
  { id: "op_05", name: "James Park", email: "james@kruxt.io", role: "readonly", status: "suspended", lastLogin: "2026-02-15T14:00:00Z", permissionOverrides: 0 },
];

const roleStyles = {
  founder: "bg-kruxt-platform/20 text-kruxt-platform",
  admin: "bg-kruxt-accent/20 text-kruxt-accent",
  support: "bg-kruxt-warning/20 text-kruxt-warning",
  readonly: "bg-muted text-muted-foreground",
};

const statusDot = {
  active: "bg-kruxt-success",
  invited: "bg-kruxt-warning",
  suspended: "bg-kruxt-danger",
};

export default function OperatorsPage() {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-kruxt-headline">Operators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform operator accounts and permission overrides.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          + Invite Operator
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Operators", value: mockOperators.length, color: "text-foreground" },
          { label: "Active", value: mockOperators.filter((o) => o.status === "active").length, color: "text-kruxt-success" },
          { label: "Pending Invites", value: mockOperators.filter((o) => o.status === "invited").length, color: "text-kruxt-warning" },
          { label: "Permission Overrides", value: mockOperators.reduce((sum, o) => sum + o.permissionOverrides, 0), color: "text-kruxt-platform" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-card border border-border bg-kruxt-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            <p className={cn("mt-1 text-2xl font-bold font-kruxt-mono", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-kruxt-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operator</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Login</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Overrides</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {mockOperators.map((op) => (
              <tr key={op.id} className="border-b border-border/50 last:border-0 hover:bg-kruxt-panel/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kruxt-panel text-xs font-bold text-foreground">
                      {op.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{op.name}</p>
                      <p className="text-xs text-muted-foreground">{op.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", roleStyles[op.role])}>
                    {op.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", statusDot[op.status])} />
                    <span className="text-sm capitalize text-foreground">{op.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {op.lastLogin === "—" ? "—" : new Date(op.lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">
                  {op.permissionOverrides > 0 ? op.permissionOverrides : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-kruxt-panel hover:text-foreground transition-colors">
                      Edit
                    </button>
                    {op.role !== "founder" && (
                      <button className="rounded-md px-2 py-1 text-xs text-kruxt-danger/70 hover:bg-kruxt-danger/10 hover:text-kruxt-danger transition-colors">
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
