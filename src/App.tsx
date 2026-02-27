import React, { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { OnboardingFlow } from "@mobile/onboarding";
import { createOnboardingRuntimeServices } from "@mobile/onboarding/runtime-services";
import { WorkoutLoggerFlow } from "@mobile/workout-logger";
import { createWorkoutLoggerRuntimeServices } from "@mobile/workout-logger/runtime-services";
import { ProofFeedFlow } from "@mobile/proof-feed";
import { createProofFeedRuntimeServices } from "@mobile/proof-feed/runtime-services";
import { OpsConsoleFlow } from "@admin/ops-console";
import { createOpsConsoleRuntimeServices } from "@admin/ops-console/runtime-services";
import { AdminSettingsFlow } from "@admin/admin-settings";
import { StaffConsoleFlow } from "@admin/staff-console";
import { createStaffConsoleRuntimeServices } from "@admin/staff-console/runtime-services";
import {
  FounderConsoleFlow,
  createFounderConsoleRuntimeServices,
  type FounderConsoleServices
} from "@admin/founder-console";
import { createAdminSupabaseClient } from "@admin/services";

// ─── Placeholder screen ──────────────────────────────────────────
function PlaceholderScreen({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground">Screen placeholder. Build this next.</p>
    </div>
  );
}

// ─── Mobile Shell ────────────────────────────────────────────────
const mobileTabs = [
  { to: "/feed", label: "Proof Feed", icon: "🔥" },
  { to: "/log", label: "Log", icon: "🏋️" },
  { to: "/guild", label: "Guild Hall", icon: "🛡️" },
  { to: "/rank", label: "Rank", icon: "🏆" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

function MobileShell() {
  const location = useLocation();
  const hideTabBar = location.pathname.startsWith("/log");
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className={`flex-1 overflow-y-auto ${hideTabBar ? "" : "pb-20"}`}><Outlet /></main>
      {!hideTabBar && (
        <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
            {mobileTabs.map((tab) => {
              const isActive = location.pathname.startsWith(tab.to);
              return (
                <NavLink key={tab.to} to={tab.to} className="flex flex-col items-center gap-0.5 px-2 py-1.5">
                  <span className="text-lg">{tab.icon}</span>
                  <span className={`text-[10px] font-display font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {tab.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

// ─── Admin Shell ─────────────────────────────────────────────────
const adminNavCore = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/members", label: "Members" },
  { to: "/admin/classes", label: "Classes" },
  { to: "/admin/checkins", label: "Check-ins" },
  { to: "/admin/waivers", label: "Waivers" },
  { to: "/admin/billing", label: "Billing" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/compliance", label: "Compliance" },
  { to: "/admin/support", label: "Support" },
  { to: "/admin/settings", label: "Settings" },
];

type PlatformOperatorRole =
  | "founder"
  | "ops_admin"
  | "support_admin"
  | "compliance_admin"
  | "analyst"
  | "read_only";

interface AdminAccessState {
  status: "loading" | "ready";
  isAuthenticated: boolean;
  previewBypass: boolean;
  platformRole: PlatformOperatorRole | null;
  staffGymIds: string[];
}

function AccessDeniedCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="p-6">
      <div className="panel border-destructive/40 bg-destructive/10 p-4 max-w-xl">
        <h1 className="text-lg font-display font-bold text-destructive">{title}</h1>
        <p className="text-sm text-destructive mt-1">{message}</p>
      </div>
    </div>
  );
}

function RequireAdminAccess({
  access,
  mode,
  gymId,
  children
}: {
  access: AdminAccessState;
  mode: "auth" | "founder" | "gym_staff";
  gymId?: string;
  children: React.ReactElement;
}) {
  if (access.status === "loading") {
    return (
      <div className="p-6">
        <div className="panel p-4">
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!access.isAuthenticated) {
    return (
      <AccessDeniedCard
        title="Sign-in required"
        message="You must sign in before opening the admin console."
      />
    );
  }

  const isFounder = access.previewBypass || access.platformRole === "founder";
  if (mode === "founder" && !isFounder) {
    return (
      <AccessDeniedCard
        title="Founder access required"
        message="This page is restricted to KRUXT founder-level operators."
      />
    );
  }

  if (mode === "gym_staff") {
    const canAccessGym = isFounder || (gymId ? access.staffGymIds.includes(gymId) : false);
    if (!canAccessGym) {
      return (
        <AccessDeniedCard
          title="Gym staff access required"
          message="You can only access admin pages for gyms where you are leader/officer/coach."
        />
      );
    }
  }

  return children;
}

function AdminShell({
  selectedGymId,
  onSelectGym,
  founderServices,
  canManageGyms,
  allowedGymIds
}: {
  selectedGymId: string;
  onSelectGym: (gymId: string) => void;
  founderServices: FounderConsoleServices;
  canManageGyms: boolean;
  allowedGymIds: string[] | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [gymOptions, setGymOptions] = useState<Array<{ id: string; name: string }>>([]);
  const location = useLocation();
  const navItems = React.useMemo(
    () => [
      ...(canManageGyms ? [{ to: "/admin/gyms", label: "Gyms" }] : []),
      ...adminNavCore
    ],
    [canManageGyms]
  );

  React.useEffect(() => {
    let active = true;
    const loadGyms = async () => {
      try {
        const gyms = await founderServices.listGyms();
        if (!active) return;
        const visibleGyms =
          canManageGyms || !allowedGymIds
            ? gyms
            : gyms.filter((gym) => allowedGymIds.includes(gym.id));
        setGymOptions(visibleGyms.map((gym) => ({ id: gym.id, name: gym.name })));
        if (visibleGyms.length > 0 && !visibleGyms.some((gym) => gym.id === selectedGymId)) {
          onSelectGym(visibleGyms[0].id);
        }
      } catch {
        if (!active) return;
        setGymOptions([]);
      }
    };
    void loadGyms();
    return () => {
      active = false;
    };
  }, [allowedGymIds, canManageGyms, founderServices, onSelectGym, selectedGymId]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`flex flex-col border-r border-border bg-card transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex items-center gap-3 h-16 px-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-display font-black text-primary-foreground">K</span>
          </div>
          {!collapsed && <span className="font-display font-bold text-foreground text-lg tracking-tight">KRUXT</span>}
        </div>
        {!collapsed && (
          <div className="px-3 py-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Active Gym
            </label>
            <select
              className="input-field"
              value={selectedGymId}
              onChange={(event) => onSelectGym(event.target.value)}
            >
              {gymOptions.length === 0 && (
                <option value={selectedGymId}>{selectedGymId.slice(0, 8)}...</option>
              )}
              {gymOptions.map((gym) => (
                <option key={gym.id} value={gym.id}>{gym.name}</option>
              ))}
            </select>
            {canManageGyms && (
              <NavLink to="/admin/gyms" className="text-xs text-primary underline underline-offset-2">
                Manage gyms
              </NavLink>
            )}
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}>
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? "→" : "←"}
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1680px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// ─── Design Showcase ─────────────────────────────────────────────
function DesignShowcase() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow-ion">
              <span className="text-xl font-display font-black text-primary-foreground">K</span>
            </div>
            <div>
              <h1 className="text-3xl font-display font-black text-foreground tracking-tight">KRUXT</h1>
              <p className="text-sm text-primary font-display font-semibold">No log, no legend.</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm max-w-md">
            Design system showcase — guild-premium aesthetic with equipment-panel surfaces and ion-blue accents.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-12">
        {/* Color Palette */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Color Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Background", cls: "bg-background border border-border" },
              { name: "Card", cls: "bg-card border border-border" },
              { name: "Ion Blue", cls: "bg-primary" },
              { name: "Steel", cls: "bg-steel" },
              { name: "Success", cls: "bg-success" },
              { name: "Warning", cls: "bg-warning" },
              { name: "Danger", cls: "bg-destructive" },
              { name: "Muted", cls: "bg-muted" },
            ].map((c) => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div className={`h-12 rounded-lg ${c.cls}`} />
                <span className="text-xs text-muted-foreground font-display">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Typography</h2>
          <div className="panel p-6 space-y-4">
            <h1 className="text-4xl font-display font-black">Headline — Space Grotesk</h1>
            <p className="text-base font-body text-secondary-foreground">Body text — Inter. Clean, readable, professional.</p>
            <p className="font-mono text-xl tabular-nums text-foreground">1,247 reps · 03:42:18 · Rank #3</p>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Badges & Sigils</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge-ion">Ion Blue</span>
            <span className="badge-steel">Steel</span>
            <span className="badge-success">Active</span>
            <span className="badge-warning">Pending</span>
            <span className="badge-danger">Suspended</span>
          </div>
        </section>

        {/* Status */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Status Dots</h2>
          <div className="flex flex-wrap gap-4">
            {(["success", "warning", "danger", "info"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${s === "success" ? "bg-success" : s === "warning" ? "bg-warning" : s === "danger" ? "bg-destructive" : "bg-primary"}`} />
                <span className="text-xs text-muted-foreground capitalize">{s}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Stat Cards */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Stat Cards</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Weekly Rank", value: "#3" },
              { label: "Total Reps", value: "1,247" },
              { label: "Chain Streak", value: "14d" },
            ].map((s) => (
              <div key={s.label} className="panel p-4 flex flex-col gap-1">
                <span className="stat-label">{s.label}</span>
                <span className="stat-value">{s.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Buttons</h2>
          <div className="space-y-3 max-w-sm">
            <button className="btn-primary">Log Workout</button>
            <button className="btn-ghost">View History</button>
            <button className="btn-primary" disabled>Disabled State</button>
            <button className="btn-compact">Compact</button>
          </div>
        </section>

        {/* Tabs */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Tab Strip</h2>
          <div className="tab-strip max-w-sm">
            <button className="tab-item" aria-selected="true">Mobile</button>
            <button className="tab-item" aria-selected="false">Admin</button>
          </div>
        </section>

        {/* Form Controls */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Form Controls</h2>
          <div className="space-y-3 max-w-sm">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input className="input-field" placeholder="Enter your guild name" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <input className="input-field border-destructive focus:ring-destructive" placeholder="kruxt@guild.io" />
              <span className="field-error">Required field</span>
            </div>
          </div>
        </section>

        {/* Progress */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Progress Bar</h2>
          <div className="max-w-sm space-y-2">
            <div className="progress-track"><div className="progress-fill" style={{ width: "60%" }} /></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: "100%" }} /></div>
          </div>
        </section>

        {/* List Rows */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">List Rows</h2>
          <div className="panel overflow-hidden">
            {[
              { name: "Alex Rivera", detail: "Rank #3 · 14-day chain", badge: "Active", variant: "badge-success" },
              { name: "Jordan Kael", detail: "Rank #7 · 8-day chain", badge: "Active", variant: "badge-success" },
              { name: "Sam Torres", detail: "Rank #12 · Chain broken", badge: "Inactive", variant: "badge-danger" },
            ].map((row) => (
              <div key={row.name} className="list-row">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-display font-bold text-secondary-foreground">
                  {row.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.detail}</div>
                </div>
                <span className={row.variant}>{row.badge}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Data Table */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Data Table</h2>
          <div className="panel overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Member</th><th className="text-right">Score</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { rank: 3, name: "Alex Rivera", score: "1,240", status: "active" },
                  { rank: 7, name: "Jordan Kael", score: "980", status: "active" },
                  { rank: 12, name: "Sam Torres", score: "745", status: "inactive" },
                ].map((r) => (
                  <tr key={r.rank}>
                    <td className="font-mono tabular-nums">{r.rank}</td>
                    <td>{r.name}</td>
                    <td className="text-right font-mono tabular-nums">{r.score}</td>
                    <td><span className={r.status === "active" ? "badge-success" : "badge-danger"}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Skeleton */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Loading States</h2>
          <div className="space-y-3 max-w-sm">
            <div className="panel p-4 flex flex-col gap-3">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
        </section>

        {/* Error */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Error Banner</h2>
          <div className="max-w-sm">
            <div className="panel border-destructive/40 bg-destructive/10 p-4">
              <p className="text-destructive text-sm font-semibold">Failed to sync workout data.</p>
              <button className="text-xs text-destructive underline mt-1">Try again</button>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-display uppercase tracking-wider">End of Showcase</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Navigation to shells */}
        <section className="space-y-3 max-w-sm mx-auto">
          <h2 className="text-xl font-display font-bold mb-4 text-foreground text-center">App Shells</h2>
          <NavLink to="/feed" className="btn-primary block text-center">Mobile Shell →</NavLink>
          <NavLink to="/admin" className="btn-ghost block text-center">Admin Shell →</NavLink>
        </section>

        {/* Brand footer */}
        <section className="text-center space-y-2 pb-8">
          <p className="text-sm text-muted-foreground font-display">Proof counts. · Rank is earned weekly. · Log to claim.</p>
          <p className="text-primary font-display font-bold">No log, no legend.</p>
        </section>
      </div>
    </div>
  );
}

function OnboardingEntry() {
  const navigate = useNavigate();
  const services = React.useMemo(() => createOnboardingRuntimeServices(), []);
  return (
    <OnboardingFlow
      onComplete={() => navigate("/feed")}
      services={services}
    />
  );
}

// ─── App Router ──────────────────────────────────────────────────
function WorkoutLoggerEntry() {
  const navigate = useNavigate();
  const services = React.useMemo(() => createWorkoutLoggerRuntimeServices(), []);
  return (
    <WorkoutLoggerFlow
      services={services}
      onComplete={(workoutId) => navigate(`/feed?workout=${workoutId}`)}
      onCancel={() => navigate("/feed")}
    />
  );
}

function ProofFeedEntry() {
  const services = React.useMemo(() => {
    try {
      return createProofFeedRuntimeServices();
    } catch (error) {
      console.warn("[proof-feed-entry] Falling back to preview services:", error);
      return {
        load: async () => ({
          ok: true as const,
          snapshot: {
            feed: [],
            hiddenBlockedActorCount: 0,
            blockedUsers: [],
            myReports: []
          }
        }),
        loadThread: async () => [],
        react: async () => ({ ok: true }),
        comment: async () => ({ ok: true }),
        block: async () => ({ ok: true }),
        report: async () => ({ ok: true })
      };
    }
  }, []);
  return <ProofFeedFlow services={services} />;
}

const DEFAULT_ADMIN_GYM_ID =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DEFAULT_GYM_ID ||
  "3306f501-3f50-4a30-8552-b47bf9cce199";
const ADMIN_GYM_STORAGE_KEY = "kruxt_admin_selected_gym_id";

function readInitialAdminGymId(): string {
  if (typeof window === "undefined") return DEFAULT_ADMIN_GYM_ID;
  try {
    const stored = window.localStorage.getItem(ADMIN_GYM_STORAGE_KEY);
    return stored?.trim() ? stored : DEFAULT_ADMIN_GYM_ID;
  } catch {
    return DEFAULT_ADMIN_GYM_ID;
  }
}

function OpsConsoleEntry({
  gymId,
  defaultTab = "classes"
}: {
  gymId: string;
  defaultTab?: "classes" | "waitlist" | "checkin" | "waiver";
}) {
  const services = React.useMemo(() => createOpsConsoleRuntimeServices(), []);
  return <OpsConsoleFlow services={services} gymId={gymId} defaultTab={defaultTab} />;
}

function AdminSettingsEntry({ gymId }: { gymId: string }) {
  const services = React.useMemo(() => createOpsConsoleRuntimeServices(), []);
  return <AdminSettingsFlow services={services} gymId={gymId} />;
}

function StaffConsoleEntry({ gymId }: { gymId: string }) {
  const services = React.useMemo(() => createStaffConsoleRuntimeServices(), []);
  return <StaffConsoleFlow services={services} gymId={gymId} />;
}

function FounderConsoleEntry({
  gymId,
  onGymChange,
  services
}: {
  gymId: string;
  onGymChange: (gymId: string) => void;
  services: FounderConsoleServices;
}) {
  return (
    <FounderConsoleFlow
      services={services}
      selectedGymId={gymId}
      onSelectGym={onGymChange}
    />
  );
}

export default function App() {
  const founderServices = React.useMemo(() => createFounderConsoleRuntimeServices(), []);
  const [adminGymId, setAdminGymId] = useState<string>(() => readInitialAdminGymId());
  const [adminAccess, setAdminAccess] = useState<AdminAccessState>({
    status: "loading",
    isAuthenticated: false,
    previewBypass: false,
    platformRole: null,
    staffGymIds: []
  });

  const handleGymChange = React.useCallback((gymId: string) => {
    setAdminGymId(gymId);
  }, []);

  React.useEffect(() => {
    let active = true;

    const loadAccess = async () => {
      try {
        const supabase = createAdminSupabaseClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          if (!active) return;
          setAdminAccess({
            status: "ready",
            isAuthenticated: false,
            previewBypass: false,
            platformRole: null,
            staffGymIds: []
          });
          return;
        }

        const userId = authData.user.id;
        const [{ data: platformData }, { data: membershipsData }] = await Promise.all([
          supabase
            .from("platform_operator_accounts")
            .select("role,is_active")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("gym_memberships")
            .select("gym_id")
            .eq("user_id", userId)
            .in("membership_status", ["trial", "active"])
            .in("role", ["leader", "officer", "coach"])
        ]);

        if (!active) return;
        setAdminAccess({
          status: "ready",
          isAuthenticated: true,
          previewBypass: false,
          platformRole: (platformData?.role as PlatformOperatorRole | undefined) ?? null,
          staffGymIds: (membershipsData ?? []).map((row) => row.gym_id)
        });
      } catch (error) {
        console.warn("[admin-access] Falling back to preview bypass:", error);
        if (!active) return;
        setAdminAccess({
          status: "ready",
          isAuthenticated: true,
          previewBypass: true,
          platformRole: "founder",
          staffGymIds: []
        });
      }
    };

    void loadAccess();
    return () => {
      active = false;
    };
  }, []);

  const canManageGyms = adminAccess.previewBypass || adminAccess.platformRole === "founder";
  const allowedGymIds = canManageGyms ? null : adminAccess.staffGymIds;

  React.useEffect(() => {
    if (canManageGyms) return;
    if (adminAccess.staffGymIds.length === 0) return;
    if (adminAccess.staffGymIds.includes(adminGymId)) return;
    setAdminGymId(adminAccess.staffGymIds[0]);
  }, [adminAccess.staffGymIds, adminGymId, canManageGyms]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ADMIN_GYM_STORAGE_KEY, adminGymId);
    } catch {
      // noop
    }
  }, [adminGymId]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnboardingEntry />} />
        <Route path="/showcase" element={<DesignShowcase />} />
        <Route element={<MobileShell />}>
          <Route path="/feed" element={<ProofFeedEntry />} />
          <Route path="/log" element={<WorkoutLoggerEntry />} />
          <Route path="/guild" element={<PlaceholderScreen title="Guild Hall" />} />
          <Route path="/rank" element={<PlaceholderScreen title="Rank Ladder" />} />
          <Route path="/profile" element={<PlaceholderScreen title="Profile" />} />
        </Route>
        <Route
          element={
            <RequireAdminAccess access={adminAccess} mode="auth">
              <AdminShell
                selectedGymId={adminGymId}
                onSelectGym={handleGymChange}
                founderServices={founderServices}
                canManageGyms={canManageGyms}
                allowedGymIds={allowedGymIds}
              />
            </RequireAdminAccess>
          }
        >
          <Route path="/admin" element={<PlaceholderScreen title="Overview" />} />
          <Route
            path="/admin/gyms"
            element={
              <RequireAdminAccess access={adminAccess} mode="founder">
                <FounderConsoleEntry
                  gymId={adminGymId}
                  onGymChange={handleGymChange}
                  services={founderServices}
                />
              </RequireAdminAccess>
            }
          />
          <Route
            path="/admin/members"
            element={
              <RequireAdminAccess access={adminAccess} mode="gym_staff" gymId={adminGymId}>
                <StaffConsoleEntry gymId={adminGymId} />
              </RequireAdminAccess>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <RequireAdminAccess access={adminAccess} mode="gym_staff" gymId={adminGymId}>
                <OpsConsoleEntry gymId={adminGymId} defaultTab="classes" />
              </RequireAdminAccess>
            }
          />
          <Route
            path="/admin/checkins"
            element={
              <RequireAdminAccess access={adminAccess} mode="gym_staff" gymId={adminGymId}>
                <OpsConsoleEntry gymId={adminGymId} defaultTab="checkin" />
              </RequireAdminAccess>
            }
          />
          <Route
            path="/admin/waivers"
            element={
              <RequireAdminAccess access={adminAccess} mode="gym_staff" gymId={adminGymId}>
                <OpsConsoleEntry gymId={adminGymId} defaultTab="waiver" />
              </RequireAdminAccess>
            }
          />
          <Route path="/admin/billing" element={<PlaceholderScreen title="Billing" />} />
          <Route path="/admin/integrations" element={<PlaceholderScreen title="Integrations" />} />
          <Route path="/admin/compliance" element={<PlaceholderScreen title="Compliance" />} />
          <Route path="/admin/support" element={<PlaceholderScreen title="Support" />} />
          <Route
            path="/admin/settings"
            element={
              <RequireAdminAccess access={adminAccess} mode="gym_staff" gymId={adminGymId}>
                <AdminSettingsEntry gymId={adminGymId} />
              </RequireAdminAccess>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
