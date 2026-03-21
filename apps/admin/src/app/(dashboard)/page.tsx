"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { PageSkeleton } from "@/components/loading-skeleton";

interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: "checkin" | "member" | "class" | "billing" | "support";
}

const mockActivity: ActivityItem[] = [
  { id: "1", message: "Marcus Rivera checked in via NFC", time: "2 min ago", type: "checkin" },
  { id: "2", message: "New membership request from sarah.chen@email.com", time: "8 min ago", type: "member" },
  { id: "3", message: "HIIT Blast class is now full (24/24)", time: "15 min ago", type: "class" },
  { id: "4", message: "Payment received: $79.00 from Jake Thompson", time: "22 min ago", type: "billing" },
  { id: "5", message: "Support ticket #1042 auto-triaged as priority: high", time: "35 min ago", type: "support" },
  { id: "6", message: "Elena Park completed waiver signature", time: "41 min ago", type: "member" },
  { id: "7", message: "Morning Yoga class completed - 18 attendees", time: "1 hr ago", type: "class" },
  { id: "8", message: "Dunning alert: 3 failed payment retries", time: "1.5 hr ago", type: "billing" },
];

const typeIcons: Record<ActivityItem["type"], string> = {
  checkin: "check",
  member: "user",
  class: "calendar",
  billing: "dollar",
  support: "message",
};

const typeColors: Record<ActivityItem["type"], string> = {
  checkin: "bg-kruxt-success/15 text-kruxt-success",
  member: "bg-kruxt-accent/15 text-kruxt-accent",
  class: "bg-purple-500/15 text-purple-400",
  billing: "bg-kruxt-warning/15 text-kruxt-warning",
  support: "bg-orange-500/15 text-orange-400",
};

interface QuickAction {
  label: string;
  description: string;
  href: string;
}

const quickActions: QuickAction[] = [
  { label: "Add Member", description: "Register a new gym member", href: "/members" },
  { label: "Create Class", description: "Schedule a new class", href: "/classes" },
  { label: "View Check-ins", description: "Today's check-in log", href: "/checkins" },
  { label: "Support Queue", description: "Open support tickets", href: "/support" },
];

export default function DashboardPage() {
  const [loading] = useState(false);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your gym at a glance. Data refreshed in real-time."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={342}
          trend={{ value: "+12%", positive: true }}
          subtext="vs last month"
        />
        <StatCard
          label="Active Today"
          value={47}
          trend={{ value: "+5", positive: true }}
          subtext="checked in"
          accent="success"
        />
        <StatCard
          label="Classes This Week"
          value={28}
          subtext="6 remaining today"
        />
        <StatCard
          label="Pending Actions"
          value={9}
          subtext="3 memberships, 4 waivers, 2 tickets"
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-card border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-border">
            {mockActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-kruxt-panel/30"
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${typeColors[item.type]}`}
                >
                  <span className="text-xs font-bold">
                    {item.type[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{item.message}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
                Quick Actions
              </h2>
            </div>
            <div className="p-3">
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-kruxt-panel"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-kruxt-accent/10">
                    <svg className="h-4 w-4 text-kruxt-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-card border border-kruxt-warning/30 bg-kruxt-warning/5 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-kruxt-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-sm font-medium text-kruxt-warning">
                Attention Required
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-muted-foreground">
                3 membership requests pending approval
              </li>
              <li className="text-xs text-muted-foreground">
                1 privacy request approaching SLA deadline
              </li>
              <li className="text-xs text-muted-foreground">
                2 integration sync failures in last 24h
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
