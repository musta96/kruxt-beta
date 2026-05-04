"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Modal } from "@/components/modal";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { GymClass } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

interface CreateClassForm {
  title: string;
  description: string;
  capacity: string;
  startsAt: string;
  endsAt: string;
  coachUserId: string;
}

const defaultForm: CreateClassForm = {
  title: "",
  description: "",
  capacity: "20",
  startsAt: "",
  endsAt: "",
  coachUserId: "",
};

export default function ClassesPage() {
  const { gymId } = useGym();
  const { ops } = useServices();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateClassForm>(defaultForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | undefined>();

  const { status, data, error, refetch } = useAsync(
    () => ops.listGymClasses(gymId),
    [gymId]
  );

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startsAt || !form.endsAt || !form.capacity) {
      setCreateError("Title, start time, end time, and capacity are required.");
      return;
    }
    const cap = parseInt(form.capacity, 10);
    if (isNaN(cap) || cap < 1) {
      setCreateError("Capacity must be a positive number.");
      return;
    }
    setCreateLoading(true);
    setCreateError(undefined);
    try {
      await ops.createGymClass(gymId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        capacity: cap,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        coachUserId: form.coachUserId.trim() || undefined,
      });
      setShowCreate(false);
      setForm(defaultForm);
      refetch();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create class");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCancel = useCallback(
    async (classId: string) => {
      setCancellingId(classId);
      setCancelError(undefined);
      try {
        await ops.updateGymClass(gymId, classId, { status: "cancelled" });
        refetch();
      } catch (e) {
        setCancelError(e instanceof Error ? e.message : "Failed to cancel class");
      } finally {
        setCancellingId(null);
      }
    },
    [ops, gymId, refetch]
  );

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Classes"
          description="Manage class schedules, instructors, and capacity."
        />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const classes = data ?? [];
  const activeCount = classes.filter((c) => c.status === "scheduled").length;
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity ?? 0), 0);

  const columns: Column<GymClass>[] = [
    {
      key: "title",
      header: "Class",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.description ?? ""}</p>
        </div>
      ),
    },
    {
      key: "coachUserId",
      header: "Coach",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.coachUserId ? row.coachUserId.slice(0, 8) : "—"}
        </span>
      ),
    },
    {
      key: "startsAt",
      header: "Schedule",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.startsAt
            ? new Date(row.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.capacity ?? "—"}
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
      key: "actions",
      header: "",
      className: "w-28",
      render: (row) => {
        if (row.status !== "scheduled") return null;
        const isCancelling = cancellingId === row.id;
        return (
          <button
            onClick={() => handleCancel(row.id)}
            disabled={isCancelling}
            className="rounded-button border border-kruxt-danger/40 px-2.5 py-1 text-xs font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10 disabled:opacity-50"
          >
            {isCancelling ? "Cancelling…" : "Cancel"}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Manage class schedules, instructors, and capacity."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90"
          >
            + Create Class
          </button>
        }
      />

      {cancelError && (
        <ErrorBanner message={cancelError} onRetry={() => setCancelError(undefined)} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Scheduled Classes" value={activeCount} />
        <StatCard
          label="Total Capacity"
          value={totalCapacity}
          subtext="spots across all scheduled classes"
          accent="success"
        />
        <StatCard label="Total Classes" value={classes.length} accent="default" />
      </div>

      {classes.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No classes yet. Create your first class to get started.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={classes}
          keyExtractor={(row) => row.id}
          searchable
          searchPlaceholder="Search classes..."
        />
      )}

      {/* Create Class Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setForm(defaultForm);
          setCreateError(undefined);
        }}
        title="Create Class"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowCreate(false);
                setForm(defaultForm);
                setCreateError(undefined);
              }}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading}
              className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createLoading ? "Creating…" : "Create Class"}
            </button>
          </>
        }
      >
        {createError && (
          <p className="rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">
            {createError}
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Title *
          </label>
          <input
            type="text"
            placeholder="e.g. Morning HIIT"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={INPUT}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            rows={2}
            placeholder="Optional class description…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Start *
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              End *
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Capacity *
            </label>
            <input
              type="number"
              min={1}
              placeholder="20"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Coach User ID
            </label>
            <input
              type="text"
              placeholder="Optional UUID…"
              value={form.coachUserId}
              onChange={(e) => setForm((f) => ({ ...f, coachUserId: e.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
