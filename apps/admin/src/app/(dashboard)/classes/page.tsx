"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";

interface GymClass {
  id: string;
  title: string;
  instructor: string;
  schedule: string;
  day: string;
  capacity: number;
  booked: number;
  status: "scheduled" | "cancelled" | "completed";
}

const mockClasses: GymClass[] = [
  { id: "1", title: "HIIT Blast", instructor: "David Kim", schedule: "06:00 - 06:45", day: "Mon, Wed, Fri", capacity: 24, booked: 24, status: "scheduled" },
  { id: "2", title: "Morning Yoga", instructor: "Luna Martinez", schedule: "07:00 - 08:00", day: "Tue, Thu", capacity: 20, booked: 18, status: "completed" },
  { id: "3", title: "Strength Foundations", instructor: "David Kim", schedule: "08:30 - 09:30", day: "Mon, Wed, Fri", capacity: 16, booked: 12, status: "scheduled" },
  { id: "4", title: "Boxing Bootcamp", instructor: "Marcus Rivera", schedule: "12:00 - 12:45", day: "Tue, Thu", capacity: 12, booked: 10, status: "scheduled" },
  { id: "5", title: "Spin Class", instructor: "Aisha Johnson", schedule: "17:00 - 17:45", day: "Mon, Wed", capacity: 30, booked: 28, status: "scheduled" },
  { id: "6", title: "CrossFit Open", instructor: "Jake Thompson", schedule: "18:00 - 19:00", day: "Mon-Fri", capacity: 20, booked: 15, status: "scheduled" },
  { id: "7", title: "Recovery & Stretch", instructor: "Luna Martinez", schedule: "19:30 - 20:15", day: "Wed, Fri", capacity: 25, booked: 8, status: "scheduled" },
  { id: "8", title: "Saturday Throwdown", instructor: "David Kim", schedule: "09:00 - 10:30", day: "Sat", capacity: 30, booked: 0, status: "cancelled" },
];

const columns: Column<GymClass>[] = [
  {
    key: "title",
    header: "Class",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.title}</p>
        <p className="text-xs text-muted-foreground">{row.day}</p>
      </div>
    ),
  },
  {
    key: "instructor",
    header: "Instructor",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.instructor}</span>
    ),
  },
  {
    key: "schedule",
    header: "Time",
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.schedule}
      </span>
    ),
  },
  {
    key: "capacity",
    header: "Capacity",
    render: (row) => {
      const pct = row.capacity > 0 ? (row.booked / row.capacity) * 100 : 0;
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-kruxt-panel">
            <div
              className={`h-full rounded-full ${
                pct >= 100 ? "bg-kruxt-danger" : pct >= 80 ? "bg-kruxt-warning" : "bg-kruxt-accent"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground font-kruxt-mono">
            {row.booked}/{row.capacity}
          </span>
        </div>
      );
    },
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

export default function ClassesPage() {
  const [loading] = useState(false);

  if (loading) {
    return <PageSkeleton />;
  }

  const scheduledCount = mockClasses.filter((c) => c.status === "scheduled").length;
  const totalCapacity = mockClasses.reduce((sum, c) => sum + c.capacity, 0);
  const totalBooked = mockClasses.reduce((sum, c) => sum + c.booked, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Manage class schedules, instructors, and capacity."
        actions={
          <button className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90">
            Create Class
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Scheduled This Week" value={scheduledCount} />
        <StatCard
          label="Total Bookings"
          value={totalBooked}
          subtext={`of ${totalCapacity} capacity`}
          accent="success"
        />
        <StatCard
          label="Avg Fill Rate"
          value={totalCapacity > 0 ? `${Math.round((totalBooked / totalCapacity) * 100)}%` : "0%"}
          accent="default"
        />
      </div>

      {/* Weekly schedule header */}
      <div className="rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground font-kruxt-headline">
            Week of March 18 - 24, 2026
          </h3>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground">
              Previous
            </button>
            <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground">
              Today
            </button>
            <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground">
              Next
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
            <div
              key={day}
              className={`rounded-lg px-2 py-2 text-center text-xs ${
                i === 0
                  ? "bg-kruxt-accent/10 text-kruxt-accent font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <p className="font-medium">{day}</p>
              <p className="mt-0.5 text-lg tabular-nums font-kruxt-mono">{18 + i}</p>
            </div>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={mockClasses}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="Search classes..."
      />
    </div>
  );
}
