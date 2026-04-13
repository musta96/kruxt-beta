"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";

const priorityDot: Record<string, string> = {
  critical: "bg-kruxt-danger",
  high: "bg-kruxt-warning",
  medium: "bg-kruxt-accent",
  low: "bg-kruxt-steel",
};

export default function SupportPage() {
  const { gymId } = useGym();
  const { customization } = useServices();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { status, data, error, refetch } = useAsync(
    () => customization.listSupportTickets(gymId, { limit: 50 }),
    [gymId]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Support" description="Manage support tickets and member issues." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const tickets = data ?? [];
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Manage support tickets and member issues."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            New Ticket
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open Tickets" value={openCount} accent="warning" />
        <StatCard label="In Progress" value={inProgressCount} accent="default" />
        <StatCard label="Resolved" value={resolvedCount} accent="success" />
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          title="No support tickets"
          description="All clear — no open tickets."
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-card border border-border bg-card transition-colors hover:border-kruxt-accent/20">
              <button
                onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${priorityDot[ticket.priority ?? "medium"]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ticket.subject ?? `Ticket ${ticket.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
                <StatusBadge label={ticket.status} variant={statusToVariant(ticket.status)} dot />
                <svg className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === ticket.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {expandedId === ticket.id && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  {ticket.description && <p className="text-sm text-muted-foreground">{ticket.description}</p>}
                  <div className="flex gap-2">
                    <button className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel">Reply</button>
                    <button className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel">Assign</button>
                    <button className="rounded-button border border-kruxt-success/30 px-3 py-1.5 text-xs font-medium text-kruxt-success transition-colors hover:bg-kruxt-success/10">Resolve</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
