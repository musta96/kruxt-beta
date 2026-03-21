"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface Invoice {
  id: string;
  memberName: string;
  memberEmail: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "failed" | "refunded";
  planName: string;
  billingDate: string;
  paidAt: string | null;
}

const mockInvoices: Invoice[] = [
  { id: "INV-001", memberName: "Marcus Rivera", memberEmail: "marcus@email.com", amount: 79, status: "paid", planName: "Pro Monthly", billingDate: "2026-03-01", paidAt: "2026-03-01" },
  { id: "INV-002", memberName: "Sarah Chen", memberEmail: "sarah.chen@email.com", amount: 49, status: "pending", planName: "Basic Monthly", billingDate: "2026-03-15", paidAt: null },
  { id: "INV-003", memberName: "Jake Thompson", memberEmail: "jake.t@email.com", amount: 79, status: "paid", planName: "Pro Monthly", billingDate: "2026-03-01", paidAt: "2026-03-01" },
  { id: "INV-004", memberName: "Elena Park", memberEmail: "elena.park@email.com", amount: 0, status: "pending", planName: "Trial", billingDate: "2026-03-20", paidAt: null },
  { id: "INV-005", memberName: "Aisha Johnson", memberEmail: "aisha.j@email.com", amount: 79, status: "overdue", planName: "Pro Monthly", billingDate: "2026-02-01", paidAt: null },
  { id: "INV-006", memberName: "Tom Reeves", memberEmail: "tom.r@email.com", amount: 49, status: "failed", planName: "Basic Monthly", billingDate: "2026-03-01", paidAt: null },
  { id: "INV-007", memberName: "Luna Martinez", memberEmail: "luna.m@email.com", amount: 149, status: "paid", planName: "Team Annual", billingDate: "2026-01-15", paidAt: "2026-01-15" },
  { id: "INV-008", memberName: "Ryan Okafor", memberEmail: "ryan.o@email.com", amount: 49, status: "refunded", planName: "Basic Monthly", billingDate: "2026-02-01", paidAt: "2026-02-01" },
];

type StatusFilter = "all" | "paid" | "pending" | "overdue" | "failed" | "refunded";

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const columns: Column<Invoice>[] = [
  {
    key: "id",
    header: "Invoice",
    render: (row) => (
      <span className="text-sm font-medium tabular-nums text-foreground font-kruxt-mono">
        {row.id}
      </span>
    ),
  },
  {
    key: "memberName",
    header: "Member",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.memberName}</p>
        <p className="text-xs text-muted-foreground">{row.memberEmail}</p>
      </div>
    ),
  },
  {
    key: "planName",
    header: "Plan",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.planName}</span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    render: (row) => (
      <span className="text-sm font-semibold tabular-nums text-foreground font-kruxt-mono">
        ${row.amount.toFixed(2)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge
        label={row.status}
        variant={statusToVariant(row.status)}
        dot
      />
    ),
  },
  {
    key: "billingDate",
    header: "Billing Date",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.billingDate}
      </span>
    ),
  },
];

export default function BillingPage() {
  const [loading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  if (loading) return <PageSkeleton />;

  const filtered = mockInvoices.filter(
    (inv) => statusFilter === "all" || inv.status === statusFilter,
  );

  const totalRevenue = mockInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = mockInvoices.filter((i) => i.status === "overdue").length;
  const failedCount = mockInvoices.filter((i) => i.status === "failed").length;
  const mrr = totalRevenue; // simplified

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Revenue tracking, invoices, and payment management."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          trend={{ value: "+8%", positive: true }}
          subtext="vs last month"
          accent="success"
        />
        <StatCard
          label="MRR"
          value={`$${mrr.toLocaleString()}`}
          subtext="recurring"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          subtext="need attention"
          accent="warning"
        />
        <StatCard
          label="Failed Payments"
          value={failedCount}
          subtext="retry pending"
          accent="danger"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-kruxt-accent/15 text-kruxt-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Try adjusting your filters."
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
        />
      )}
    </div>
  );
}
