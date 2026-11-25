"use client";

import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
  mobileOpen: boolean;
}

export function TopBar({ sidebarCollapsed, onMenuToggle, mobileOpen }: TopBarProps) {
  const { user, platformRole, signOut } = usePlatformAuth();
  const initials = (user?.email ?? "PO").slice(0, 2).toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-border bg-kruxt-surface px-3 sm:px-6 transition-all duration-200 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-kruxt-accent",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground lg:hidden"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground font-kruxt-headline">
            Platform Control Plane
          </h2>
          <p className="text-xs text-muted-foreground">KRUXT Super Admin</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block">
          <p className="max-w-40 truncate text-xs font-medium text-foreground">{user?.email ?? "Platform operator"}</p>
          <p className="text-[10px] uppercase tracking-wider text-kruxt-platform">{platformRole}</p>
        </div>

        <button
          onClick={() => void signOut()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-kruxt-platform/20 text-xs font-bold text-kruxt-platform"
          aria-label="Sign out"
          title="Sign out"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
