"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { StaffShift, StaffShiftStatus } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

const SHIFT_STATUSES: StaffShiftStatus[] = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
];

function toDatetimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultStart(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toDatetimeLocal(date);
}

function defaultEnd(): string {
  const date = new Date();
  date.setHours(date.getHours() + 5, 0, 0, 0);
  return toDatetimeLocal(date);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTimeRange(shift: StaffShift): string {
  return `${new Date(shift.startsAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${new Date(shift.endsAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function shiftOverlapsRange(shift: StaffShift, rangeStart: Date, rangeEnd: Date): boolean {
  const shiftStart = new Date(shift.startsAt);
  const shiftEnd = new Date(shift.endsAt);
  return shiftStart < rangeEnd && shiftEnd > rangeStart;
}

function shiftDurationHours(shift: StaffShift): number {
  const startsAt = new Date(shift.startsAt).getTime();
  const endsAt = new Date(shift.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return 0;
  return (endsAt - startsAt) / 36e5;
}

export default function StaffPage() {
  const { gymId } = useGym();
  const { gym } = useServices();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [staffUserId, setStaffUserId] = useState("");
  const [title, setTitle] = useState("Floor shift");
  const [shiftRole, setShiftRole] = useState("coach");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [mutationError, setMutationError] = useState<string | undefined>();

  const shiftsState = useAsync(() => gym.listStaffShifts(gymId), [gymId]);
  const staffState = useAsync(() => gym.listStaffProfileOptions(gymId), [gymId]);

  const staffById = useMemo(() => {
    const map = new Map<string, string>();
    for (const staff of staffState.data ?? []) {
      map.set(staff.userId, staff.label);
    }
    return map;
  }, [staffState.data]);

  const createShift = async () => {
    if (!staffUserId) {
      setMutationError("Pick a staff member.");
      return;
    }
    setCreating(true);
    setMutationError(undefined);
    try {
      await gym.createStaffShift(gymId, {
        staffUserId,
        title,
        shiftRole,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        status: "scheduled",
        notes: notes.trim() || undefined,
      });
      setTitle("Floor shift");
      setShiftRole("coach");
      setStartsAt(defaultStart());
      setEndsAt(defaultEnd());
      setNotes("");
      shiftsState.refetch();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Unable to create shift.");
    } finally {
      setCreating(false);
    }
  };

  const updateShiftStatus = async (shiftId: string, status: StaffShiftStatus) => {
    setMutationError(undefined);
    try {
      await gym.updateStaffShift(gymId, shiftId, { status });
      shiftsState.refetch();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Unable to update shift.");
    }
  };

  if (shiftsState.status === "loading" || shiftsState.status === "idle") return <PageSkeleton />;

  if (shiftsState.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Staff" description="Plan staff shifts and coverage." />
        <ErrorBanner message={shiftsState.error} onRetry={shiftsState.refetch} />
      </div>
    );
  }

  const shifts = shiftsState.data ?? [];
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekShifts = shifts
    .filter((shift) => shiftOverlapsRange(shift, weekStart, weekEnd))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  const scheduledCount = weekShifts.filter((shift) => ["scheduled", "confirmed"].includes(shift.status)).length;
  const activeCount = weekShifts.filter((shift) => shift.status === "in_progress").length;
  const completedCount = weekShifts.filter((shift) => shift.status === "completed").length;
  const plannedHours = weekShifts.reduce((total, shift) => total + shiftDurationHours(shift), 0);

  const columns: Column<StaffShift>[] = [
    {
      key: "title",
      header: "Shift",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.shiftRole ?? "staff"}</p>
        </div>
      ),
    },
    {
      key: "staff",
      header: "Staff Member",
      render: (row) => (
        <span className="text-sm text-foreground">{staffById.get(row.staffUserId) ?? row.staffUserId.slice(0, 8)}</span>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (row) => (
        <div className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          <p>{formatDateTime(row.startsAt)}</p>
          <p>{formatDateTime(row.endsAt)}</p>
        </div>
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
      className: "w-48",
      render: (row) => (
        <select
          value={row.status}
          onChange={(event) => void updateShiftStatus(row.id, event.target.value as StaffShiftStatus)}
          className={INPUT}
        >
          {SHIFT_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Schedule coaches, officers, and desk coverage." />

      {mutationError && <ErrorBanner message={mutationError} onRetry={() => setMutationError(undefined)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming Coverage" value={scheduledCount} accent="default" />
        <StatCard label="In Progress" value={activeCount} accent="warning" />
        <StatCard label="Planned Hours" value={plannedHours.toFixed(plannedHours % 1 === 0 ? 0 : 1)} accent="success" />
      </div>

      <div className="rounded-card border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Create Shift</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <select value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} className={INPUT}>
            <option value="">Select staff member</option>
            {(staffState.data ?? []).map((staff) => (
              <option key={staff.userId} value={staff.userId}>{staff.label}</option>
            ))}
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={INPUT} placeholder="Shift title" />
          <input value={shiftRole} onChange={(event) => setShiftRole(event.target.value)} className={INPUT} placeholder="Role, e.g. coach" />
          <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={INPUT} />
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={INPUT} />
          <button
            onClick={createShift}
            disabled={creating}
            className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Shift"}
          </button>
        </div>
        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`${INPUT} mt-3`}
          placeholder="Coverage notes, handover details, or class responsibilities..."
        />
      </div>

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Weekly Coverage</h2>
            <p className="text-xs text-muted-foreground">
              {formatDayLabel(weekStart)} to {formatDayLabel(addDays(weekStart, 6))} / {completedCount} completed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="rounded-button border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Previous
            </button>
            <input
              type="date"
              value={toDateInput(weekStart)}
              onChange={(event) => setWeekStart(startOfWeek(new Date(`${event.target.value}T00:00:00`)))}
              className="rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-xs text-foreground focus:border-kruxt-accent focus:outline-none"
            />
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-button border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="rounded-button border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayStart = new Date(day);
            const dayEnd = addDays(dayStart, 1);
            const dayShifts = weekShifts.filter((shift) => shiftOverlapsRange(shift, dayStart, dayEnd));

            return (
              <div key={day.toISOString()} className="min-h-36 rounded-lg border border-border bg-kruxt-panel/35 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDayLabel(day)}
                </p>
                <div className="mt-3 space-y-2">
                  {dayShifts.slice(0, 3).map((shift) => (
                    <div key={shift.id} className="rounded-md bg-card px-2 py-2">
                      <p className="truncate text-xs font-semibold text-foreground">{shift.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatTimeRange(shift)}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {staffById.get(shift.staffUserId) ?? shift.staffUserId.slice(0, 8)}
                      </p>
                    </div>
                  ))}
                  {dayShifts.length > 3 && (
                    <p className="text-[11px] text-muted-foreground">+{dayShifts.length - 3} more shifts</p>
                  )}
                  {dayShifts.length === 0 && <p className="text-xs text-muted-foreground">No coverage</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {weekShifts.length === 0 ? (
        <EmptyState
          title="No staff shifts this week"
          description="Create a shift or move to another week to review coverage."
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
        />
      ) : (
        <DataTable columns={columns} data={weekShifts} keyExtractor={(row) => row.id} />
      )}
    </div>
  );
}
