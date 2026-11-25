"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { GymOnboardingForm } from "@/components/gym-onboarding-form";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { cn } from "@/lib/utils";
import { MobileNavigation } from "@/components/navigation-shell";

function FullPageLoader({ label }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-kruxt-bg">
      <div className="flex items-center gap-3 text-muted-foreground">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            className="opacity-25"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm">{label ?? "Loading…"}</span>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: gymLoading, noGymFound, error, accessDenied, refresh } = useGym();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [authLoading, router, user]);

  // 1) Auth still resolving
  if (authLoading) {
    return <FullPageLoader label="Checking session…" />;
  }

  // 2) Not authed → redirect (placeholder while replace runs)
  if (!user) {
    return <FullPageLoader label="Redirecting to sign in…" />;
  }

  // 3) Auth'd but gym membership still loading
  if (gymLoading) {
    return <FullPageLoader label="Loading your gym…" />;
  }

  if (error || accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-kruxt-bg p-6">
        <section className="w-full max-w-md space-y-4" aria-labelledby="gym-access-title">
          <h1 id="gym-access-title" className="font-kruxt-headline text-xl font-semibold text-foreground">
            {accessDenied ? "Staff access required" : "Gym access unavailable"}
          </h1>
          <p role={error ? "alert" : undefined} className="text-sm text-muted-foreground">
            {error ?? "Your membership does not include this gym's staff workspace. Ask a gym leader to grant staff access, or sign in with a staff account."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void refresh()} className="min-h-11 rounded-md bg-kruxt-accent px-4 text-sm font-semibold text-kruxt-bg">Retry access check</button>
            <button onClick={() => void signOut()} className="min-h-11 rounded-md border border-border px-4 text-sm text-foreground">Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  // 4) Auth'd but no gym linked
  if (noGymFound) {
    return <GymOnboardingForm />;
  }

  // 5) All set — render the dashboard
  return (
    <div className="min-h-screen bg-kruxt-bg">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kruxt-accent focus:p-3 focus:text-kruxt-bg">Skip to content</a>
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar mobile collapsed={false} onToggle={() => setMobileOpen(false)} />
      </MobileNavigation>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onMenuToggle={() => setMobileOpen(true)}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-w-0 min-h-[calc(100vh-4rem)] p-4 sm:p-6 transition-all duration-200",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
        )}
      >
        {children}
      </main>
    </div>
  );
}
