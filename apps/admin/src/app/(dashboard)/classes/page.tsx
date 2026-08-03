"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useClassDetail } from "./use-class-detail";
import type { StaffProfileOption } from "@/services";
import type { ClassBooking, ClassWaitlistEntry, GymClass } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";
const SECONDARY_BUTTON =
  "rounded-button border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground disabled:opacity-50";
const PRIMARY_BUTTON =
  "rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";
type ViewMode = "schedule" | "list";

interface CreateClassForm {
  title: string;
  description: string;
  capacity: string;
  startsAt: string;
  endsAt: string;
  coachUserId: string;
  bookingOpensAt: string;
  bookingClosesAt: string;
}

function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createDefaultForm(): CreateClassForm {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 2);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);

  const bookingOpen = new Date();
  bookingOpen.setMinutes(0, 0, 0);

  return {
    title: "",
    description: "",
    capacity: "20",
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
    coachUserId: "",
    bookingOpensAt: toLocalInputValue(bookingOpen),
    bookingClosesAt: toLocalInputValue(start)
  };
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatScheduleDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

function compareClassStart(a: GymClass, b: GymClass): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function isScheduled(row: GymClass): boolean {
  return row.status === "scheduled";
}

function hasBookingWindow(row: GymClass): boolean {
  return Boolean(row.bookingOpensAt && row.bookingClosesAt);
}

function getBookingWindowState(row: GymClass, now: Date): { label: string; variant: BadgeVariant } {
  if (row.status !== "scheduled") return { label: row.status, variant: statusToVariant(row.status) };

  const opensAt = row.bookingOpensAt ? new Date(row.bookingOpensAt) : null;
  const closesAt = row.bookingClosesAt ? new Date(row.bookingClosesAt) : new Date(row.startsAt);

  if (!opensAt || !row.bookingClosesAt) return { label: "Window missing", variant: "warning" };
  if (now < opensAt) return { label: "Opens soon", variant: "muted" };
  if (now > closesAt) return { label: "Booking closed", variant: "danger" };
  return { label: "Open booking", variant: "success" };
}

function bookingCount(bookings: ClassBooking[]): number {
  return bookings.filter((booking) => booking.status === "booked" || booking.status === "attended").length;
}

function pendingWaitlistCount(waitlist: ClassWaitlistEntry[]): number {
  return waitlist.filter((entry) => entry.status === "pending").length;
}

function classMatchesQuery(row: GymClass, coachName: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [row.title, row.description, row.status, coachName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function memberWebBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_KRUXT_WEB_URL ??
    process.env.NEXT_PUBLIC_KRUXT_PUBLIC_WEB_URL ??
    "https://kruxt-beta.vercel.app"
  ).replace(/\/$/, "");
}

export default function ClassesPage() {
  const { gymId, gymName } = useGym();
  const { ops, gym } = useServices();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateClassForm>(() => createDefaultForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("schedule");
  const [query, setQuery] = useState("");
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [promotingClassId, setPromotingClassId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<{ classId: string; message: string } | null>(null);

  const { status, data, error, refetch } = useAsync(
    () => ops.listGymClasses(gymId),
    [gymId]
  );

  const staffState = useAsync(
    () => gym.listStaffProfileOptions(gymId),
    [gymId]
  );

  const loadClassDetail = useCallback(
    async (targetGymId: string, targetClassId: string) => {
      const [bookings, waitlist] = await Promise.all([
        ops.listClassBookings(targetGymId, targetClassId),
        ops.listClassWaitlist(targetGymId, targetClassId)
      ]);
      return { bookings, waitlist };
    },
    [ops]
  );

  const detailState = useClassDetail(gymId, selectedClassId, loadClassDetail);

  const classes = useMemo(() => [...(data ?? [])].sort(compareClassStart), [data]);
  const staffOptions = useMemo<StaffProfileOption[]>(() => staffState.data ?? [], [staffState.data]);
  const staffById = useMemo(() => {
    const map = new Map<string, string>();
    for (const staff of staffOptions) {
      map.set(staff.userId, staff.label);
    }
    return map;
  }, [staffOptions]);

  const now = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, []);

  const weekEnd = useMemo(() => {
    const end = new Date(weekDays[6] ?? new Date());
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekDays]);

  const upcomingClasses = useMemo(
    () => classes.filter((row) => isScheduled(row) && new Date(row.endsAt) >= now),
    [classes, now]
  );

  const thisWeekClasses = useMemo(
    () => upcomingClasses.filter((row) => new Date(row.startsAt) <= weekEnd),
    [upcomingClasses, weekEnd]
  );

  const filteredClasses = useMemo(
    () =>
      classes.filter((row) =>
        classMatchesQuery(
          row,
          row.coachUserId ? staffById.get(row.coachUserId) ?? row.coachUserId : "",
          query
        )
      ),
    [classes, query, staffById]
  );

  const classesByDay = useMemo(() => {
    const map = new Map<string, GymClass[]>();
    for (const day of weekDays) map.set(formatDateKey(day), []);
    for (const row of filteredClasses) {
      const key = formatDateKey(new Date(row.startsAt));
      if (map.has(key)) {
        map.get(key)?.push(row);
      }
    }
    for (const rows of map.values()) rows.sort(compareClassStart);
    return map;
  }, [filteredClasses, weekDays]);

  const selectedClass = useMemo(
    () => classes.find((row) => row.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (status !== "success") return;
    if (classes.length === 0) {
      setSelectedClassId(null);
      return;
    }
    if (!selectedClassId || !classes.some((row) => row.id === selectedClassId)) {
      setSelectedClassId(upcomingClasses[0]?.id ?? classes[0]?.id ?? null);
    }
  }, [classes, selectedClassId, status, upcomingClasses]);

  const bookingPageUrl = `${memberWebBaseUrl()}/gyms/${encodeURIComponent(gymId)}/classes`;
  const activeCount = upcomingClasses.length;
  const weekCapacity = thisWeekClasses.reduce((sum, row) => sum + (row.capacity ?? 0), 0);
  const openBookingCount = upcomingClasses.filter((row) => getBookingWindowState(row, now).label === "Open booking").length;
  const setupGaps = upcomingClasses.filter((row) => !hasBookingWindow(row)).length;
  const loadedDetail = detailState.data;
  const detailBookings = loadedDetail?.bookings ?? [];
  const detailWaitlist = loadedDetail?.waitlist ?? [];
  const detailBookedCount = bookingCount(detailBookings);
  const detailPendingWaitlistCount = pendingWaitlistCount(detailWaitlist);
  const detailReady = detailState.status === "success" && Boolean(loadedDetail);

  const resetCreateForm = useCallback(() => {
    setForm(createDefaultForm());
    setCreateError(undefined);
  }, []);

  const handleCreate = async () => {
    const startsAt = parseLocalDateTime(form.startsAt);
    const endsAt = parseLocalDateTime(form.endsAt);
    const bookingOpensAt = parseLocalDateTime(form.bookingOpensAt);
    const bookingClosesAt = parseLocalDateTime(form.bookingClosesAt);

    if (!form.title.trim() || !startsAt || !endsAt || !form.capacity || !form.coachUserId) {
      setCreateError("Title, coach, start time, end time, and capacity are required.");
      return;
    }
    if (endsAt <= startsAt) {
      setCreateError("End time must be after start time.");
      return;
    }
    if ((form.bookingOpensAt && !bookingOpensAt) || (form.bookingClosesAt && !bookingClosesAt)) {
      setCreateError("Booking window dates must be valid.");
      return;
    }
    if (bookingOpensAt && bookingClosesAt && bookingClosesAt < bookingOpensAt) {
      setCreateError("Booking close time must be after booking open time.");
      return;
    }
    if (bookingClosesAt && bookingClosesAt > startsAt) {
      setCreateError("Booking should close no later than the class start time.");
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
      const created = await ops.createGymClass(gymId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        capacity: cap,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        coachUserId: form.coachUserId.trim() || undefined,
        bookingOpensAt: bookingOpensAt?.toISOString(),
        bookingClosesAt: bookingClosesAt?.toISOString()
      });
      setShowCreate(false);
      resetCreateForm();
      setSelectedClassId(created.id);
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
        await ops.setGymClassStatus(gymId, classId, "cancelled");
        refetch();
      } catch (e) {
        setCancelError(e instanceof Error ? e.message : "Failed to cancel class");
      } finally {
        setCancellingId(null);
      }
    },
    [ops, gymId, refetch]
  );

  const handlePromoteWaitlist = useCallback(async () => {
    if (
      !selectedClass ||
      !loadedDetail ||
      loadedDetail.gymId !== gymId ||
      loadedDetail.classId !== selectedClass.id ||
      pendingWaitlistCount(loadedDetail.waitlist) === 0 ||
      bookingCount(loadedDetail.bookings) >= selectedClass.capacity
    ) {
      return;
    }

    const targetClassId = loadedDetail.classId;
    setPromotingClassId(targetClassId);
    setPromoteError(null);
    try {
      await ops.promoteWaitlistMember(loadedDetail.gymId, targetClassId);
      detailState.refetch();
    } catch (e) {
      setPromoteError({
        classId: targetClassId,
        message: e instanceof Error ? e.message : "Failed to promote waitlist member"
      });
    } finally {
      setPromotingClassId((current) => (current === targetClassId ? null : current));
    }
  }, [detailState, gymId, loadedDetail, ops, selectedClass]);

  const handleCopyBookingLink = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(bookingPageUrl);
    setBookingLinkCopied(true);
    window.setTimeout(() => setBookingLinkCopied(false), 1800);
  }, [bookingPageUrl]);

  const columns: Column<GymClass>[] = [
    {
      key: "title",
      header: "Class",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.description || "No description yet"}</p>
        </div>
      )
    },
    {
      key: "coachUserId",
      header: "Coach",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.coachUserId ? staffById.get(row.coachUserId) ?? row.coachUserId.slice(0, 8) : "Unassigned"}
        </span>
      )
    },
    {
      key: "startsAt",
      header: "Schedule",
      render: (row) => (
        <div className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          <p>{formatScheduleDate(row.startsAt)}</p>
          <p className="text-xs">{formatDuration(row.startsAt, row.endsAt)}</p>
        </div>
      )
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {row.capacity} spots
        </span>
      )
    },
    {
      key: "booking",
      header: "Booking",
      render: (row) => {
        const state = getBookingWindowState(row, now);
        return <StatusBadge label={state.label} variant={state.variant} dot />;
      }
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
      )
    },
    {
      key: "actions",
      header: "",
      className: "w-36",
      render: (row) => {
        const isCancelling = cancellingId === row.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedClassId(row.id)}
              className="rounded-button border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
            >
              Details
            </button>
            {row.status === "scheduled" ? (
              <button
                type="button"
                onClick={() => handleCancel(row.id)}
                disabled={isCancelling}
                className="rounded-button border border-kruxt-danger/40 px-2.5 py-1 text-xs font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            ) : null}
          </div>
        );
      }
    }
  ];

  if (
    status === "loading" ||
    status === "idle" ||
    staffState.status === "loading" ||
    staffState.status === "idle"
  ) return <PageSkeleton />;

  if (status === "error" || staffState.status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Classes"
          description="Manage class schedules, instructors, capacity, booking windows, and waitlists."
        />
        <ErrorBanner
          message={error ?? staffState.error ?? "Unable to load classes."}
          onRetry={() => {
            refetch();
            staffState.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Run your live schedule, keep capacity clear, and publish classes members can book."
        actions={
          <>
            <button type="button" onClick={() => void handleCopyBookingLink()} className={SECONDARY_BUTTON}>
              {bookingLinkCopied ? "Copied" : "Copy member class link"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setShowCreate(true);
              }}
              className={PRIMARY_BUTTON}
            >
              + Create class
            </button>
          </>
        }
      />

      {cancelError ? (
        <ErrorBanner message={cancelError} onRetry={() => setCancelError(undefined)} />
      ) : null}

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-kruxt-accent">Member class booking</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {gymName || "Selected gym"} schedule
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Members sign in here to inspect this gym&apos;s schedule, book open classes, or join a waitlist with an active or trial membership.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-xs text-muted-foreground">
            <span className="font-kruxt-mono">{bookingPageUrl}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming classes" value={activeCount} subtext="scheduled from now" />
        <StatCard label="7-day capacity" value={weekCapacity} subtext="bookable spots this week" accent="success" />
        <StatCard label="Open booking" value={openBookingCount} subtext="classes accepting signups" accent="default" />
        <StatCard
          label="Setup gaps"
          value={setupGaps}
          subtext="missing booking windows"
          accent={setupGaps > 0 ? "warning" : "success"}
        />
      </div>

      <section className="rounded-card border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search class, coach, or status"
              className={`${INPUT} sm:w-80`}
            />
            <span className="text-xs text-muted-foreground">
              {filteredClasses.length} of {classes.length} classes
            </span>
          </div>
          <div className="inline-flex w-fit rounded-button border border-border bg-kruxt-panel p-1">
            <button
              type="button"
              onClick={() => setViewMode("schedule")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "schedule" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Schedule
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </section>

      {classes.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No classes yet. Create your first class with a coach, capacity, and booking window.
          </p>
        </div>
      ) : viewMode === "schedule" ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayClasses = classesByDay.get(formatDateKey(day)) ?? [];
            return (
              <section key={formatDateKey(day)} className="rounded-card border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {formatDayLabel(day)}
                    </p>
                    <p className="text-xs text-muted-foreground">{dayClasses.length} classes</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {dayClasses.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                      No classes scheduled.
                    </div>
                  ) : (
                    dayClasses.map((row) => {
                      const state = getBookingWindowState(row, now);
                      const selected = selectedClassId === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedClassId(row.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? "border-kruxt-accent bg-kruxt-accent/10"
                              : "border-border bg-kruxt-panel/60 hover:border-kruxt-accent/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-kruxt-mono text-xs text-muted-foreground">
                                {formatTime(row.startsAt)} - {formatTime(row.endsAt)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{row.title}</p>
                            </div>
                            <span className="font-kruxt-mono text-xs text-muted-foreground">{row.capacity}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <StatusBadge label={state.label} variant={state.variant} />
                            <StatusBadge label={formatDuration(row.startsAt, row.endsAt)} variant="muted" />
                          </div>
                          <p className="mt-2 truncate text-xs text-muted-foreground">
                            {row.coachUserId ? staffById.get(row.coachUserId) ?? row.coachUserId.slice(0, 8) : "Unassigned coach"}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredClasses}
          keyExtractor={(row) => row.id}
          emptyMessage="No classes match this search."
        />
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class operations</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Booking workflow</h2>
            </div>
            <StatusBadge label="Staff controlled" variant="info" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-kruxt-panel p-4">
              <p className="font-kruxt-mono text-xs text-kruxt-accent">01</p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Create the class</h3>
              <p className="mt-1 text-xs text-muted-foreground">Set coach, capacity, duration, booking open, and close times in one pass.</p>
            </div>
            <div className="rounded-lg border border-border bg-kruxt-panel p-4">
              <p className="font-kruxt-mono text-xs text-kruxt-accent">02</p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Share the page</h3>
              <p className="mt-1 text-xs text-muted-foreground">Send members to the authenticated class schedule for booking and waitlist actions.</p>
            </div>
            <div className="rounded-lg border border-border bg-kruxt-panel p-4">
              <p className="font-kruxt-mono text-xs text-kruxt-accent">03</p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">Manage demand</h3>
              <p className="mt-1 text-xs text-muted-foreground">Use bookings and waitlist counts to fill seats without overbooking the room.</p>
            </div>
          </div>
        </div>

        <aside className="rounded-card border border-border bg-card p-5">
          {selectedClass ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected class</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{selectedClass.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatScheduleDate(selectedClass.startsAt)} · {formatDuration(selectedClass.startsAt, selectedClass.endsAt)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-kruxt-panel p-3">
                  <p className="text-xs text-muted-foreground">Booked</p>
                  <p className="mt-1 font-kruxt-mono text-2xl font-semibold text-foreground">
                    {detailReady ? `${detailBookedCount}/${selectedClass.capacity}` : "..."}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-kruxt-panel p-3">
                  <p className="text-xs text-muted-foreground">Waitlist</p>
                  <p className="mt-1 font-kruxt-mono text-2xl font-semibold text-foreground">
                    {detailReady ? detailPendingWaitlistCount : "..."}
                  </p>
                </div>
              </div>

              {detailState.status === "error" ? (
                <ErrorBanner message={detailState.error ?? "Unable to load class details."} onRetry={detailState.refetch} />
              ) : null}
              {promoteError?.classId === selectedClass.id ? (
                <ErrorBanner message={promoteError.message} onRetry={() => setPromoteError(null)} />
              ) : null}

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Coach</span>
                  <span className="text-right text-foreground">
                    {selectedClass.coachUserId
                      ? staffById.get(selectedClass.coachUserId) ?? selectedClass.coachUserId.slice(0, 8)
                      : "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Booking opens</span>
                  <span className="text-right font-kruxt-mono text-xs text-foreground">
                    {selectedClass.bookingOpensAt ? formatScheduleDate(selectedClass.bookingOpensAt) : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Booking closes</span>
                  <span className="text-right font-kruxt-mono text-xs text-foreground">
                    {selectedClass.bookingClosesAt ? formatScheduleDate(selectedClass.bookingClosesAt) : "At class start"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handlePromoteWaitlist()}
                disabled={
                  !detailReady ||
                  promotingClassId !== null ||
                  detailPendingWaitlistCount === 0 ||
                  detailBookedCount >= selectedClass.capacity
                }
                className={PRIMARY_BUTTON}
              >
                {promotingClassId === selectedClass.id ? "Promoting..." : "Promote next waitlist"}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Select a class to see bookings, waitlist demand, and booking-window readiness.
            </div>
          )}
        </aside>
      </section>

      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetCreateForm();
        }}
        title="Create class"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
              className={SECONDARY_BUTTON}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={createLoading || staffOptions.length === 0}
              className={PRIMARY_BUTTON}
            >
              {createLoading ? "Creating..." : "Create class"}
            </button>
          </>
        }
      >
        {createError ? (
          <p className="rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">
            {createError}
          </p>
        ) : null}
        {staffOptions.length === 0 ? (
          <p className="rounded-lg bg-kruxt-warning/10 px-3 py-2 text-xs text-kruxt-warning">
            Add at least one staff coach before publishing classes.
          </p>
        ) : null}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Class name *
          </label>
          <input
            type="text"
            placeholder="Morning strength"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className={INPUT}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Who it is for, intensity, equipment, or waiver notes"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Start *
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
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
              onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Booking opens
            </label>
            <input
              type="datetime-local"
              value={form.bookingOpensAt}
              onChange={(event) => setForm((current) => ({ ...current, bookingOpensAt: event.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Booking closes
            </label>
            <input
              type="datetime-local"
              value={form.bookingClosesAt}
              onChange={(event) => setForm((current) => ({ ...current, bookingClosesAt: event.target.value }))}
              className={INPUT}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Capacity *
            </label>
            <input
              type="number"
              min={1}
              placeholder="20"
              value={form.capacity}
              onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Coach *
            </label>
            <select
              value={form.coachUserId}
              onChange={(event) => setForm((current) => ({ ...current, coachUserId: event.target.value }))}
              className={INPUT}
            >
              <option value="">Select coach</option>
              {staffOptions.map((staff) => (
                <option key={staff.userId} value={staff.userId}>
                  {staff.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
