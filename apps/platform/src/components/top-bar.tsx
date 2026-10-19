"use client";

import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

export function TopBar({ sidebarCollapsed, onMenuToggle }: TopBarProps) {
  const { user, platformRole, signOut } = usePlatformAuth();
  const initials = (user?.email ?? "PO").slice(0, 2).toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-kruxt-surface/80 px-6 backdrop-blur-md transition-all duration-200",
        sidebarCollapsed ? "ml-16" : "ml-64"
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
            Platform Control Plane
          </h2>
          <p className="text-xs text-muted-foreground">KRUXT Super Admin</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground">{user?.email ?? "Platform operator"}</p>
          <p className="text-[10px] uppercase tracking-wider text-kruxt-platform">{platformRole}</p>
        </div>

        <button
          onClick={() => void signOut()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-kruxt-platform/20 text-xs font-bold text-kruxt-platform"
          aria-label="Sign out"
          title="Sign out"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
