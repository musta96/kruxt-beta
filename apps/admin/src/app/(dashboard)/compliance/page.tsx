"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface PrivacyRequest {
  id: string;
  type: "data_export" | "data_deletion" | "consent_update" | "access_request";
  requesterName: string;
  requesterEmail: string;
  status: "pending" | "in_progress" | "completed" | "rejected";
  requestedAt: string;
  dueBy: string;
  completedAt: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  category: "auth" | "data" | "admin" | "billing";
}

const mockRequests: PrivacyRequest[] = [
  { id: "PR-001", type: "data_export", requesterName: "Ryan Okafor", requesterEmail: "ryan.o@email.com", status: "pending", requestedAt: "2026-03-17", dueBy: "2026-04-16", completedAt: null },
  { id: "PR-002", type: "data_deletion", requesterName: "Tom Reeves", requesterEmail: "tom.r@email.com", status: "in_progress", requestedAt: "2026-03-10", dueBy: "2026-04-09", completedAt: null },
  { id: "PR-003", type: "consent_update", requesterName: "Elena Park", requesterEmail: "elena.park@email.com", status: "completed", requestedAt: "2026-03-05", dueBy: "2026-04-04", completedAt: "2026-03-06" },
  { id: "PR-004", type: "access_request", requesterName: "David Kim", requesterEmail: "david.kim@email.com", status: "completed", requestedAt: "2026-02-28", dueBy: "2026-03-30", completedAt: "2026-03-01" },
];

const mockAuditLog: AuditLogEntry[] = [
  { id: "A1", action: "member.suspend", actor: "Luna Martinez", target: "Tom Reeves", timestamp: "2026-03-18 14:30", category: "admin" },
  { id: "A2", action: "data.export_initiated", actor: "System", target: "Ryan Okafor", timestamp: "2026-03-17 09:00", category: "data" },
  { id: "A3", action: "auth.password_reset", actor: "Sarah Chen", target: "Sarah Chen", timestamp: "2026-03-17 08:15", category: "auth" },
  { id: "A4", action: "billing.refund_issued", actor: "Luna Martinez", target: "Ryan Okafor ($49.00)", timestamp: "2026-03-16 16:00", category: "billing" },
  { id: "A5", action: "admin.role_changed", actor: "Luna Martinez", target: "David Kim → coach", timestamp: "2026-03-16 10:00", category: "admin" },
  { id: "A6", action: "data.consent_updated", actor: "Elena Park", target: "Marketing → opt-out", timestamp: "2026-03-05 11:30", category: "data" },
];

const typeLabels: Record<PrivacyRequest["type"], string> = {
  data_export: "Data Export",
  data_deletion: "Data Deletion",
  consent_update: "Consent Update",
  access_request: "Access Request",
};

const categoryColors: Record<AuditLogEntry["category"], string> = {
  auth: "bg-purple-500/15 text-purple-400",
  data: "bg-kruxt-accent/15 text-kruxt-accent",
  admin: "bg-kruxt-warning/15 text-kruxt-warning",
  billing: "bg-kruxt-success/15 text-kruxt-success",
};

const requestColumns: Column<PrivacyRequest>[] = [
  {
    key: "id",
    header: "ID",
    render: (row) => (
      <span className="text-sm font-medium tabular-nums font-kruxt-mono text-foreground">
        {row.id}
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span className="text-sm text-foreground">{typeLabels[row.type]}</span>
    ),
  },
  {
    key: "requesterName",
    header: "Requester",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.requesterName}</p>
        <p className="text-xs text-muted-foreground">{row.requesterEmail}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge
        label={row.status.replace("_", " ")}
        variant={statusToVariant(row.status)}
        dot
      />
    ),
  },
  {
    key: "dueBy",
    header: "Due By",
    sortable: true,
    render: (row) => {
      const isOverdue = new Date(row.dueBy) < new Date() && row.status !== "completed";
      return (
        <span className={`text-sm tabular-nums font-kruxt-mono ${isOverdue ? "text-kruxt-danger font-semibold" : "text-muted-foreground"}`}>
          {row.dueBy}
        </span>
      );
    },
  },
];

export default function CompliancePage() {
  const [loading] = useState(false);
  const [tab, setTab] = useState<"requests" | "audit">("requests");

  if (loading) return <PageSkeleton />;

  const pendingCount = mockRequests.filter((r) => r.status === "pending" || r.status === "in_progress").length;
  const completedCount = mockRequests.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Privacy requests, audit logs, and regulatory compliance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Requests"
          value={pendingCount}
          subtext="require action"
          accent="warning"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          subtext="all time"
          accent="success"
        />
        <StatCard
          label="SLA Compliance"
          value="100%"
          subtext="within 30 day window"
          accent="success"
        />
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setTab("requests")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === "requests"
              ? "bg-kruxt-accent/15 text-kruxt-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Privacy Requests
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === "audit"
              ? "bg-kruxt-accent/15 text-kruxt-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Audit Log
        </button>
      </div>

      {tab === "requests" ? (
        mockRequests.length === 0 ? (
          <EmptyState
            title="No privacy requests"
            description="All clear. No pending GDPR/privacy requests."
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            }
          />
        ) : (
          <DataTable
            columns={requestColumns}
            data={mockRequests}
            keyExtractor={(row) => row.id}
          />
        )
      ) : (
        <div className="rounded-card border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Audit Trail
            </h2>
          </div>
          <div className="divide-y divide-border">
            {mockAuditLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-kruxt-panel/30"
              >
                <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${categoryColors[entry.category]}`}>
                  <span className="text-[10px] font-bold uppercase">
                    {entry.category[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{entry.actor}</span>
                    {" · "}
                    <span className="font-kruxt-mono text-xs">{entry.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.target}</p>
                </div>
                <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground font-kruxt-mono">
                  {entry.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
