"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface Ticket {
  id: string;
  subject: string;
  memberName: string;
  memberEmail: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  category: "billing" | "account" | "technical" | "general" | "feedback";
  createdAt: string;
  lastReplyAt: string;
  assignedTo: string | null;
}

const mockTickets: Ticket[] = [
  { id: "T-1042", subject: "Can't access workout history after update", memberName: "Marcus Rivera", memberEmail: "marcus@email.com", priority: "high", status: "open", category: "technical", createdAt: "2026-03-19 09:15", lastReplyAt: "2026-03-19 09:15", assignedTo: null },
  { id: "T-1041", subject: "Billing charged twice for March", memberName: "Aisha Johnson", memberEmail: "aisha.j@email.com", priority: "urgent", status: "in_progress", category: "billing", createdAt: "2026-03-18 16:30", lastReplyAt: "2026-03-19 08:00", assignedTo: "Luna Martinez" },
  { id: "T-1040", subject: "Request to change email address", memberName: "Elena Park", memberEmail: "elena.park@email.com", priority: "low", status: "waiting", category: "account", createdAt: "2026-03-18 14:00", lastReplyAt: "2026-03-18 15:30", assignedTo: "Luna Martinez" },
  { id: "T-1039", subject: "Feature request: rest timer between sets", memberName: "Jake Thompson", memberEmail: "jake.t@email.com", priority: "low", status: "open", category: "feedback", createdAt: "2026-03-18 10:00", lastReplyAt: "2026-03-18 10:00", assignedTo: null },
  { id: "T-1038", subject: "NFC check-in not working at front desk", memberName: "David Kim", memberEmail: "david.kim@email.com", priority: "medium", status: "resolved", category: "technical", createdAt: "2026-03-17 07:00", lastReplyAt: "2026-03-17 11:00", assignedTo: "Luna Martinez" },
  { id: "T-1037", subject: "How to cancel subscription?", memberName: "Tom Reeves", memberEmail: "tom.r@email.com", priority: "medium", status: "closed", category: "billing", createdAt: "2026-03-16 09:00", lastReplyAt: "2026-03-16 10:30", assignedTo: "Luna Martinez" },
];

const priorityColors: Record<Ticket["priority"], string> = {
  low: "text-muted-foreground",
  medium: "text-kruxt-accent",
  high: "text-kruxt-warning",
  urgent: "text-kruxt-danger",
};

const priorityDots: Record<Ticket["priority"], string> = {
  low: "bg-muted-foreground",
  medium: "bg-kruxt-accent",
  high: "bg-kruxt-warning",
  urgent: "bg-kruxt-danger animate-pulse",
};

type StatusFilter = "all" | "open" | "in_progress" | "waiting" | "resolved" | "closed";

export default function SupportPage() {
  const [loading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;

  const filtered = mockTickets.filter(
    (t) => filter === "all" || t.status === filter,
  );

  const openCount = mockTickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const waitingCount = mockTickets.filter((t) => t.status === "waiting").length;
  const avgResponseTime = "2.5h";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Member support tickets and issue tracking."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open Tickets"
          value={openCount}
          subtext="need response"
          accent="warning"
        />
        <StatCard
          label="Awaiting Reply"
          value={waitingCount}
          subtext="from member"
        />
        <StatCard
          label="Avg Response"
          value={avgResponseTime}
          subtext="first reply"
          accent="success"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "open", "in_progress", "waiting", "resolved", "closed"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-kruxt-accent/15 text-kruxt-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No tickets found"
          description="All clear! No support tickets match this filter."
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(selectedTicket === ticket.id ? null : ticket.id)}
              className="w-full text-left rounded-card border border-border bg-card p-4 transition-colors hover:bg-kruxt-panel/30"
            >
              <div className="flex items-start gap-3">
                {/* Priority dot */}
                <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${priorityDots[ticket.priority]}`} />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground font-kruxt-mono">
                      {ticket.id}
                    </span>
                    <StatusBadge
                      label={ticket.status.replace("_", " ")}
                      variant={statusToVariant(ticket.status)}
                    />
                    <span className={`text-xs font-semibold capitalize ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {ticket.subject}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ticket.memberName}</span>
                    <span className="tabular-nums font-kruxt-mono">{ticket.createdAt}</span>
                    {ticket.assignedTo && (
                      <span className="text-kruxt-accent">→ {ticket.assignedTo}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {selectedTicket === ticket.id && (
                <div className="mt-3 ml-5 rounded-lg border border-border bg-kruxt-panel/50 p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Category: </span>
                      <span className="font-medium text-foreground capitalize">{ticket.category}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last reply: </span>
                      <span className="font-medium tabular-nums text-foreground font-kruxt-mono">{ticket.lastReplyAt}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="text-foreground">{ticket.memberEmail}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-button bg-kruxt-accent px-3 py-1 text-xs font-semibold text-kruxt-bg">
                      Reply
                    </button>
                    <button className="rounded-button border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Assign
                    </button>
                    {ticket.status !== "closed" && (
                      <button className="rounded-button border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        Close
                      </button>
                    )}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
