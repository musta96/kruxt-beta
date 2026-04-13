"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { Waiver } from "@kruxt/types";

const columns: Column<Waiver>[] = [
  {
    key: "title",
    header: "Waiver",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.title}</p>
        <p className="text-xs text-muted-foreground">{row.languageCode}</p>
      </div>
    ),
  },
  {
    key: "policyVersion",
    header: "Version",
    render: (row) => (
      <StatusBadge label={row.policyVersion ?? "v1"} variant="default" />
    ),
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.isActive ? "active" : "inactive"} variant={row.isActive ? "success" : "default"} dot />
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.createdAt
          ? new Date(row.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "w-12",
    render: () => (
      <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      </button>
    ),
  },
];

export default function WaiversPage() {
  const { gymId } = useGym();
  const { ops } = useServices();

  const { status, data, error, refetch } = useAsync(
    () => ops.listWaivers(gymId),
    [gymId]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Waivers & Contracts" description="Manage waiver templates, signatures, and compliance." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const waivers = data ?? [];
  const activeCount = waivers.filter((w) => w.isActive).length;
  const draftCount = waivers.filter((w) => !w.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waivers & Contracts"
        description="Manage waiver templates, signatures, and compliance documentation."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            New Template
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Waivers" value={activeCount} accent="success" />
        <StatCard label="Drafts" value={draftCount} accent="warning" />
        <StatCard label="Total Templates" value={waivers.length} accent="default" />
      </div>

      {waivers.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No waiver templates yet. Create your first template.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={waivers}
          keyExtractor={(row) => row.id}
          searchable
          searchPlaceholder="Search waivers..."
        />
      )}
    </div>
  );
}
