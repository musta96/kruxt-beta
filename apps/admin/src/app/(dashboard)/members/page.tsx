"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
  lastCheckin: string | null;
}

const mockMembers: Member[] = [
  { id: "1", name: "Marcus Rivera", email: "marcus@email.com", role: "member", status: "active", joinedAt: "2025-09-15", lastCheckin: "2026-03-18 08:30" },
  { id: "2", name: "Sarah Chen", email: "sarah.chen@email.com", role: "member", status: "pending", joinedAt: "2026-03-17", lastCheckin: null },
  { id: "3", name: "Jake Thompson", email: "jake.t@email.com", role: "member", status: "active", joinedAt: "2025-11-02", lastCheckin: "2026-03-18 07:15" },
  { id: "4", name: "Elena Park", email: "elena.park@email.com", role: "member", status: "trial", joinedAt: "2026-03-10", lastCheckin: "2026-03-17 16:45" },
  { id: "5", name: "David Kim", email: "david.kim@email.com", role: "coach", status: "active", joinedAt: "2025-06-20", lastCheckin: "2026-03-18 06:00" },
  { id: "6", name: "Aisha Johnson", email: "aisha.j@email.com", role: "member", status: "active", joinedAt: "2025-08-14", lastCheckin: "2026-03-16 19:30" },
  { id: "7", name: "Tom Reeves", email: "tom.r@email.com", role: "member", status: "suspended", joinedAt: "2025-04-01", lastCheckin: "2026-02-28 10:00" },
  { id: "8", name: "Luna Martinez", email: "luna.m@email.com", role: "admin", status: "active", joinedAt: "2025-01-15", lastCheckin: "2026-03-18 09:00" },
  { id: "9", name: "Ryan Okafor", email: "ryan.o@email.com", role: "member", status: "cancelled", joinedAt: "2025-10-20", lastCheckin: "2026-01-15 14:30" },
  { id: "10", name: "Mia Zhang", email: "mia.z@email.com", role: "member", status: "active", joinedAt: "2026-01-05", lastCheckin: "2026-03-18 10:15" },
];

type StatusFilter = "all" | "active" | "pending" | "trial" | "suspended" | "cancelled";

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

const columns: Column<Member>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    render: (row) => (
      <span className="text-sm capitalize text-muted-foreground">{row.role}</span>
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
    key: "joinedAt",
    header: "Joined",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.joinedAt}
      </span>
    ),
  },
  {
    key: "lastCheckin",
    header: "Last Check-in",
    render: (row) =>
      row.lastCheckin ? (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.lastCheckin}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Never</span>
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

export default function MembersPage() {
  const [loading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  if (loading) {
    return <PageSkeleton />;
  }

  const filtered = mockMembers.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = mockMembers.filter((m) => m.status === "active").length;
  const pendingCount = mockMembers.filter((m) => m.status === "pending").length;
  const trialCount = mockMembers.filter((m) => m.status === "trial").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage gym memberships, roles, and access."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            Add Member
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Members" value={activeCount} accent="success" />
        <StatCard label="Pending Approval" value={pendingCount} accent="warning" />
        <StatCard label="On Trial" value={trialCount} accent="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
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

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No members found"
          description="Try adjusting your filters or add a new member."
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
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
