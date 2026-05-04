"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Modal } from "@/components/modal";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { GymMembership, MembershipStatus, GymRole } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

type StatusFilter = "all" | MembershipStatus;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "trial", label: "Trial" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

interface AddMemberForm {
  userId: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
}

const defaultAddForm: AddMemberForm = {
  userId: "",
  role: "member",
  membershipStatus: "active",
};

export default function MembersPage() {
  const { gymId } = useGym();
  const { gym } = useServices();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(defaultAddForm);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();

  const { status, data, error, refetch } = useAsync(
    () => gym.listGymMemberships(gymId),
    [gymId]
  );

  const handleAddMember = async () => {
    if (!addForm.userId.trim()) {
      setAddError("User ID is required.");
      return;
    }
    setAddLoading(true);
    setAddError(undefined);
    try {
      await gym.addOrUpdateMembership(gymId, {
        userId: addForm.userId.trim(),
        role: addForm.role,
        membershipStatus: addForm.membershipStatus,
      });
      setShowAdd(false);
      setAddForm(defaultAddForm);
      refetch();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setAddLoading(false);
    }
  };

  const handleStatusChange = useCallback(
    async (membershipId: string, newStatus: MembershipStatus) => {
      setActionId(membershipId);
      setActionError(undefined);
      try {
        await gym.updateMembershipStatus(gymId, membershipId, newStatus);
        refetch();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setActionId(null);
      }
    },
    [gym, gymId, refetch]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Members" description="Manage gym memberships, roles, and access." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const members = data ?? [];

  const filtered = members.filter((m) => {
    if (statusFilter !== "all" && m.membershipStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.userId.toLowerCase().includes(q) && !m.role.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCount = members.filter((m) => m.membershipStatus === "active").length;
  const pendingCount = members.filter((m) => m.membershipStatus === "pending").length;
  const trialCount = members.filter((m) => m.membershipStatus === "trial").length;

  const columns: Column<GymMembership>[] = [
    {
      key: "name",
      header: "Member",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.userId.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{row.userId}</p>
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
      key: "membershipStatus",
      header: "Status",
      render: (row) => (
        <StatusBadge
          label={row.membershipStatus}
          variant={statusToVariant(row.membershipStatus)}
          dot
        />
      ),
    },
    {
      key: "startedAt",
      header: "Started",
      sortable: true,
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.startedAt
            ? new Date(row.startedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "endsAt",
      header: "Ends",
      render: (row) =>
        row.endsAt ? (
          <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
            {new Date(row.endsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: (row) => {
        const loading = actionId === row.id;
        if (row.membershipStatus === "pending") {
          return (
            <button
              onClick={() => handleStatusChange(row.id, "active")}
              disabled={loading}
              className="rounded-button bg-kruxt-success/15 px-2.5 py-1 text-xs font-medium text-kruxt-success transition-colors hover:bg-kruxt-success/25 disabled:opacity-50"
            >
              {loading ? "…" : "Approve"}
            </button>
          );
        }
        if (row.membershipStatus === "active" || row.membershipStatus === "trial") {
          return (
            <button
              onClick={() => handleStatusChange(row.id, "paused")}
              disabled={loading}
              className="rounded-button border border-kruxt-warning/40 px-2.5 py-1 text-xs font-medium text-kruxt-warning transition-colors hover:bg-kruxt-warning/10 disabled:opacity-50"
            >
              {loading ? "…" : "Pause"}
            </button>
          );
        }
        if (row.membershipStatus === "paused") {
          return (
            <button
              onClick={() => handleStatusChange(row.id, "active")}
              disabled={loading}
              className="rounded-button bg-kruxt-accent/15 px-2.5 py-1 text-xs font-medium text-kruxt-accent transition-colors hover:bg-kruxt-accent/25 disabled:opacity-50"
            >
              {loading ? "…" : "Reactivate"}
            </button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage gym memberships, roles, and access."
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90"
          >
            + Add Member
          </button>
        }
      />

      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(undefined)} />
      )}

      {/* Stats */}
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
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
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
          description={
            members.length === 0
              ? "Your gym doesn't have any members yet. Add your first member to get started."
              : "Try adjusting your filters or search terms."
          }
          icon={
            <svg
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
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

      {/* Add Member Modal */}
      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setAddForm(defaultAddForm);
          setAddError(undefined);
        }}
        title="Add Member"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowAdd(false);
                setAddForm(defaultAddForm);
                setAddError(undefined);
              }}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={addLoading}
              className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {addLoading ? "Adding…" : "Add Member"}
            </button>
          </>
        }
      >
        {addError && (
          <p className="rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">
            {addError}
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            User ID *
          </label>
          <input
            type="text"
            placeholder="Supabase user UUID…"
            value={addForm.userId}
            onChange={(e) => setAddForm((f) => ({ ...f, userId: e.target.value }))}
            className={INPUT}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Find the user&apos;s UUID in Supabase → Authentication → Users
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={addForm.role}
            onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as GymRole }))}
            className={INPUT}
          >
            <option value="member">Member</option>
            <option value="coach">Coach</option>
            <option value="officer">Officer</option>
            <option value="leader">Leader</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Initial Status
          </label>
          <select
            value={addForm.membershipStatus}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, membershipStatus: e.target.value as MembershipStatus }))
            }
            className={INPUT}
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="pending">Pending (requires approval)</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
