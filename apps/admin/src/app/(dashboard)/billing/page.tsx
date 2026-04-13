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
import type { Invoice } from "@kruxt/types";

const columns: Column<Invoice>[] = [
  {
    key: "id",
    header: "Invoice",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground font-kruxt-mono">
          {row.providerInvoiceId ?? row.id.slice(0, 8)}
        </p>
        <p className="text-xs text-muted-foreground">{row.userId ?? "—"}</p>
      </div>
    ),
  },
  {
    key: "totalCents",
    header: "Amount",
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium tabular-nums text-foreground font-kruxt-mono">
        ${((row.totalCents ?? 0) / 100).toFixed(2)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
    ),
  },
  {
    key: "dueAt",
    header: "Due Date",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.dueAt
          ? new Date(row.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—"}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.createdAt
          ? new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—"}
      </span>
    ),
  },
];

export default function BillingPage() {
  const { gymId } = useGym();
  const { ops } = useServices();

  const invoices = useAsync(() => ops.listInvoices(gymId), [gymId]);
  const subscriptions = useAsync(() => ops.listMemberSubscriptions(gymId), [gymId]);

  if (invoices.status === "loading" || invoices.status === "idle") return <PageSkeleton />;

  if (invoices.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Invoices, subscriptions, and payment management." />
        <ErrorBanner message={invoices.error ?? "Unknown error"} onRetry={invoices.refetch} />
      </div>
    );
  }

  const invoiceList = invoices.data ?? [];
  const subList = subscriptions.data ?? [];

  const totalRevenue = invoiceList
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.totalCents ?? 0), 0);
  const overdueCount = invoiceList.filter((i) => i.status === "open" && i.dueAt && new Date(i.dueAt) < new Date()).length;
  const activeSubCount = subList.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Invoices, subscriptions, and payment management." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Revenue (Paid)" value={`$${(totalRevenue / 100).toLocaleString()}`} accent="success" />
        <StatCard label="Active Subscriptions" value={activeSubCount} />
        <StatCard label="Overdue Invoices" value={overdueCount} accent={overdueCount > 0 ? "danger" : "default"} />
        <StatCard label="Total Invoices" value={invoiceList.length} />
      </div>

      {invoiceList.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={invoiceList} keyExtractor={(row) => row.id} searchable searchPlaceholder="Search invoices..." />
      )}
    </div>
  );
}
