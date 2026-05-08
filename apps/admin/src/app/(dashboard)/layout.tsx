"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { cn } from "@/lib/utils";

function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kruxt-bg">
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

function NoGymOnboarding({ onRefresh }: { onRefresh: () => void }) {
  const { signOut, user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-kruxt-bg p-6">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-8">
        <h1 className="text-xl font-bold text-foreground font-kruxt-headline">
          No gym linked yet
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account ({user?.email}) isn&apos;t linked to a gym yet. To get
          started, create a gym row in Supabase and add yourself to{" "}
          <code className="rounded bg-kruxt-panel px-1 py-0.5 text-xs">
            gym_memberships
          </code>{" "}
          with role <code className="rounded bg-kruxt-panel px-1 py-0.5 text-xs">leader</code>{" "}
          and status{" "}
          <code className="rounded bg-kruxt-panel px-1 py-0.5 text-xs">active</code>.
        </p>
        <ol className="mt-4 list-inside list-decimal space-y-1 text-xs text-muted-foreground">
          <li>Open Supabase → Table Editor → <code>gyms</code></li>
          <li>Insert a new row (note the generated <code>id</code>)</li>
          <li>Open <code>gym_memberships</code> and insert a row with <code>gym_id</code> = your new gym, <code>user_id</code> = {user?.id ?? "your auth user id"}, <code>role</code> = <code>leader</code>, <code>membership_status</code> = <code>active</code></li>
          <li>Click Refresh below</li>
        </ol>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onRefresh}
            className="flex-1 rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90"
          >
            Refresh
          </button>
          <button
            onClick={() => signOut()}
            className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { loading: gymLoading, noGymFound, refresh } = useGym();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

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

  // 4) Auth'd but no gym linked
  if (noGymFound) {
    return <NoGymOnboarding onRefresh={refresh} />;
  }

  // 5) All set — render the dashboard
  return (
    <div className="min-h-screen bg-kruxt-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={cn(
          "min-h-[calc(100vh-4rem)] p-6 transition-all duration-200",
          sidebarCollapsed ? "ml-16" : "ml-60"
        )}
      >
        {children}
      </main>
    </div>
  );
}
