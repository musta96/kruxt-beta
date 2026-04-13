"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { OpenPrivacyRequest } from "@/services/gym-admin-service";

const typeLabels: Record<string, string> = {
  access: "Access Request",
  export: "Data Export",
  delete: "Data Deletion",
  rectify: "Rectification",
  restrict_processing: "Restrict Processing",
};

const requestColumns: Column<OpenPrivacyRequest>[] = [
  {
    key: "id",
    header: "ID",
    render: (row) => (
      <span className="text-sm font-medium tabular-nums font-kruxt-mono text-foreground">
        {row.id.slice(0, 8)}
      </span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span className="text-sm text-foreground">{typeLabels[row.type] ?? row.type}</span>
    ),
  },
  {
    key: "userId",
    header: "Requester",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.userId.slice(0, 12)}</span>
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
    key: "submittedAt",
    header: "Submitted",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums font-kruxt-mono text-muted-foreground">
        {new Date(row.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </span>
    ),
  },
  {
    key: "dueAt",
    header: "Due By",
    sortable: true,
    render: (row) => {
      if (!row.dueAt) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className={`text-sm tabular-nums font-kruxt-mono ${row.isOverdue ? "text-kruxt-danger font-semibold" : "text-muted-foreground"}`}>
          {new Date(row.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {row.isOverdue && " (overdue)"}
        </span>
      );
    },
  },
];

export default function CompliancePage() {
  const { gymId } = useGym();
  const { gym } = useServices();
  const [tab, setTab] = useState<"requests" | "metrics">("requests");

  const requests = useAsync(() => gym.listOpenPrivacyRequests(gymId), [gymId]);
  const metrics = useAsync(() => gym.getPrivacyOpsMetrics(gymId), [gymId]);

  const isLoading = requests.status === "loading" || requests.status === "idle";

  if (isLoading) return <PageSkeleton />;

  if (requests.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Compliance" description="Privacy requests, audit logs, and regulatory compliance." />
        <ErrorBanner message={requests.error} onRetry={requests.refetch} />
      </div>
    );
  }

  const requestList = requests.data ?? [];
  const m = metrics.data;
  const pendingCount = requestList.filter((r) => r.status === "submitted" || r.status === "in_progress").length;
  const triagedCount = requestList.filter((r) => r.status === "triaged").length;
  const overdueCount = requestList.filter((r) => r.isOverdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Privacy requests, audit logs, and regulatory compliance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Open Requests"
          value={m?.openRequests ?? pendingCount + triagedCount}
          subtext="require action"
          accent="warning"
        />
        <StatCard
          label="Overdue"
          value={m?.overdueRequests ?? overdueCount}
          accent={overdueCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Fulfilled (30d)"
          value={m?.fulfilledRequestsWindow ?? 0}
          accent="success"
        />
        <StatCard
          label="Avg Completion"
          value={m?.avgCompletionHours ? `${Math.round(m.avgCompletionHours)}h` : "—"}
          subtext={m?.measuredWindowDays ? `last ${m.measuredWindowDays} days` : ""}
          accent="default"
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
          onClick={() => setTab("metrics")}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            tab === "metrics"
              ? "bg-kruxt-accent/15 text-kruxt-accent"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Metrics
        </button>
      </div>

      {tab === "requests" ? (
        requestList.length === 0 ? (
          <EmptyState
            title="No open privacy requests"
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
            data={requestList}
            keyExtractor={(row) => row.id}
          />
        )
      ) : (
        <div className="rounded-card border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline mb-4">
            Privacy Operations Metrics
          </h2>
          {m ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Open Requests</p>
                <p className="text-2xl font-bold tabular-nums text-foreground font-kruxt-mono">{m.openRequests}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className={`text-2xl font-bold tabular-nums font-kruxt-mono ${m.overdueRequests > 0 ? "text-kruxt-danger" : "text-kruxt-success"}`}>{m.overdueRequests}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Completion</p>
                <p className="text-2xl font-bold tabular-nums text-foreground font-kruxt-mono">{Math.round(m.avgCompletionHours)}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fulfilled ({m.measuredWindowDays}d window)</p>
                <p className="text-2xl font-bold tabular-nums text-kruxt-success font-kruxt-mono">{m.fulfilledRequestsWindow}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rejected ({m.measuredWindowDays}d window)</p>
                <p className="text-2xl font-bold tabular-nums text-foreground font-kruxt-mono">{m.rejectedRequestsWindow}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          )}
        </div>
      )}
    </div>
  );
}
