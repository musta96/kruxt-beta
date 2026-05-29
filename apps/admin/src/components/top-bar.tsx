"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import type { GymJoinRequestDirectoryItem } from "@/services";
import { createAdminSupabaseClient } from "@/services";

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

function avatarInitials(email: string | null | undefined): string {
  if (!email) return "?";
  const namePart = email.split("@")[0];
  const segments = namePart.split(/[._-]/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return namePart.slice(0, 2).toUpperCase();
}

export function TopBar({ sidebarCollapsed, onMenuToggle }: TopBarProps) {
  const { user, platformRole, signOut } = useAuth();
  const { gymId, gymName, supportSessionId, clearSupportSession } = useGym();
  const { gym } = useServices();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<GymJoinRequestDirectoryItem[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close floating menus when clicking outside.
  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen, notificationsOpen]);

  useEffect(() => {
    if (!gymId) {
      setPendingRequests([]);
      return;
    }

    let active = true;

    async function loadPendingRequests() {
      try {
        const requests = await gym.listGymJoinRequests(gymId, "pending");
        if (!active) return;
        setPendingRequests(requests);
        setNotificationError(null);
      } catch (error) {
        if (!active) return;
        setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
      }
    }

    void loadPendingRequests();
    const interval = window.setInterval(() => void loadPendingRequests(), 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [gym, gymId]);

  const initials = avatarInitials(user?.email);
  const shortGymId = gymId ? gymId.slice(0, 8) : "—";
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_APP_URL ?? "http://localhost:3100";
  const manageHref = gymId ? `/?gymId=${encodeURIComponent(gymId)}` : "/";
  const previewHref = gymId ? `/preview?gymId=${encodeURIComponent(gymId)}` : "/preview";
  const isPreview = pathname.startsWith("/preview");

  async function endPlatformSession() {
    if (!supportSessionId) {
      window.location.href = platformUrl;
      return;
    }

    setEndingSession(true);
    try {
      const supabase = createAdminSupabaseClient();
      await supabase
        .from("gym_support_access_sessions")
        .update({
          session_status: "ended",
          ended_at: new Date().toISOString(),
          terminated_reason: "KRUXT operator returned to platform.",
        })
        .eq("id", supportSessionId);
    } catch (error) {
      console.warn("[TopBar] failed to end support session:", error);
    } finally {
      clearSupportSession();
      window.location.href = platformUrl;
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-kruxt-surface/80 px-6 backdrop-blur-md transition-all duration-200",
        sidebarCollapsed ? "ml-16" : "ml-60"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div>
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline tracking-wide">
            {gymName || "Loading…"}
          </h2>
          <p className="text-xs text-muted-foreground font-kruxt-mono">
            Gym ID: {shortGymId}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {platformRole && (
          <button
            type="button"
            onClick={() => void endPlatformSession()}
            disabled={endingSession}
            className="hidden rounded-md border border-kruxt-platform/40 px-3 py-1.5 text-xs font-semibold text-kruxt-platform transition-colors hover:bg-kruxt-platform/10 md:inline-flex"
          >
            {endingSession ? "Ending..." : "Back to Platform"}
          </button>
        )}

        {platformRole && supportSessionId && (
          <span className="hidden rounded-md bg-kruxt-platform/10 px-2 py-1 font-kruxt-mono text-[10px] text-kruxt-platform lg:inline-flex">
            Session {supportSessionId.slice(0, 8)}
          </span>
        )}

        <div className="hidden gap-1 rounded-lg border border-border bg-kruxt-panel p-1 sm:flex">
          <Link
            href={manageHref}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              !isPreview ? "bg-kruxt-accent/15 text-kruxt-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Manage
          </Link>
          <Link
            href={previewHref}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              isPreview ? "bg-kruxt-accent/15 text-kruxt-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Preview
          </Link>
        </div>

        {/* Search */}
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-kruxt-panel px-3 py-1.5 md:flex">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="w-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">/</kbd>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {pendingRequests.length > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-kruxt-danger px-1 text-[10px] font-bold leading-4 text-white">
                {pendingRequests.length > 9 ? "9+" : pendingRequests.length}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-10 w-80 rounded-card border border-border bg-kruxt-surface p-2 shadow-2xl">
              <div className="border-b border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">Notifications</p>
                <p className="text-sm font-medium text-foreground">
                  {pendingRequests.length} pending gym access {pendingRequests.length === 1 ? "request" : "requests"}
                </p>
              </div>
              {notificationError ? (
                <p className="px-3 py-2 text-sm text-kruxt-danger">{notificationError}</p>
              ) : pendingRequests.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No pending access requests.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto py-1">
                  {pendingRequests.slice(0, 5).map((request) => (
                    <Link
                      key={request.id}
                      href="/members"
                      onClick={() => setNotificationsOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-kruxt-panel"
                    >
                      <span className="block font-medium text-foreground">
                        {request.profile?.label ?? request.userId.slice(0, 8)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {request.source === "invite_code" ? "Invite code" : "Public request"}
                        {request.membershipPlanName ? ` / ${request.membershipPlanName}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                href="/members"
                onClick={() => setNotificationsOpen(false)}
                className="mt-1 block rounded-md px-3 py-2 text-sm font-medium text-kruxt-accent transition-colors hover:bg-kruxt-panel"
              >
                Open approvals
              </Link>
            </div>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((m) => !m)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-kruxt-accent/20 text-xs font-bold text-kruxt-accent transition-colors hover:bg-kruxt-accent/30"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 w-64 rounded-card border border-border bg-kruxt-surface p-2 shadow-2xl">
              <div className="border-b border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.email ?? "Unknown"}
                </p>
              </div>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                }}
                className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-kruxt-panel"
              >
                Sign out
              </button>
              {platformRole && (
                <button
                  type="button"
                  onClick={() => void endPlatformSession()}
                  className="mt-1 block rounded-md px-3 py-2 text-sm text-kruxt-platform transition-colors hover:bg-kruxt-panel"
                >
                  Back to Platform
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
