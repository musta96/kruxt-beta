"use client";

import { cn } from "@/lib/utils";

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

export function TopBar({ sidebarCollapsed, onMenuToggle }: TopBarProps) {
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
            Iron Temple Fitness
          </h2>
          <p className="text-xs text-muted-foreground">Gym ID: gym_01</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
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
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-kruxt-danger" />
        </button>

        {/* User avatar */}
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-kruxt-accent/20 text-xs font-bold text-kruxt-accent">
          AD
        </button>
      </div>
    </header>
  );
}
