"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { ensureOperatorGymSession } from "@/services/operator-session-service";

type TenantStatus = "active" | "private" | "onboarding";

interface GymRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface MembershipRow {
  gym_id: string;
  membership_status: string;
}

interface BrandRow {
  gym_id: string;
  app_display_name: string | null;
  support_email: string | null;
}

interface PlanRow {
  gym_id: string;
  is_active: boolean;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  city: string;
  members: number;
  activePlans: number;
  status: TenantStatus;
  supportEmail: string | null;
  joinedAt: string;
  lastUpdated: string;
}

const adminAppUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? "http://localhost:3000";

const statusStyles: Record<TenantStatus, string> = {
  active: "bg-kruxt-success/20 text-kruxt-success",
  private: "bg-muted text-muted-foreground",
  onboarding: "bg-kruxt-platform/20 text-kruxt-platform",
};

const statusFilters: TenantStatus[] = ["active", "private", "onboarding"];

function formatLocation(gym: GymRow): string {
  const pieces = [gym.city, gym.country_code].filter(Boolean);
  return pieces.length > 0 ? pieces.join(", ") : "Not set";
}

function buildAdminUrl(gymId: string, path = "/"): string {
  const url = new URL(path, adminAppUrl);
  url.searchParams.set("gymId", gymId);
  url.searchParams.set("source", "platform");
  return url.toString();
}

function buildAdminUrlWithSession(gymId: string, path: string, sessionId: string): string {
  const url = new URL(buildAdminUrl(gymId, path));
  url.searchParams.set("supportSessionId", sessionId);
  return url.toString();
}

export default function TenantsPage() {
  const { supabase, user, platformRole } = usePlatformAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filter, setFilter] = useState<TenantStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!platformRole) return;
    let active = true;

    async function loadTenants() {
      setLoading(true);
      setError(null);
      try {
        const { data: gymsData, error: gymsError } = await supabase
          .from("gyms")
          .select("id,slug,name,city,country_code,is_public,created_at,updated_at")
          .order("name", { ascending: true });

        if (gymsError) throw gymsError;

        const gyms = ((gymsData ?? []) as GymRow[]) ?? [];
        const gymIds = gyms.map((gym) => gym.id);

        const [membershipsResponse, brandResponse, plansResponse] =
          gymIds.length > 0
            ? await Promise.all([
                supabase
                  .from("gym_memberships")
                  .select("gym_id,membership_status")
                  .in("gym_id", gymIds)
                  .in("membership_status", ["trial", "active"]),
                supabase
                  .from("gym_brand_settings")
                  .select("gym_id,app_display_name,support_email")
                  .in("gym_id", gymIds),
                supabase
                  .from("gym_membership_plans")
                  .select("gym_id,is_active")
                  .in("gym_id", gymIds)
                  .eq("is_active", true),
              ])
            : [
                { data: [], error: null },
                { data: [], error: null },
                { data: [], error: null },
              ];

        if (membershipsResponse.error) throw membershipsResponse.error;
        if (brandResponse.error) throw brandResponse.error;
        if (plansResponse.error) throw plansResponse.error;

        const memberCounts = new Map<string, number>();
        for (const row of ((membershipsResponse.data ?? []) as MembershipRow[]) ?? []) {
          memberCounts.set(row.gym_id, (memberCounts.get(row.gym_id) ?? 0) + 1);
        }

        const brandMap = new Map<string, BrandRow>();
        for (const row of ((brandResponse.data ?? []) as BrandRow[]) ?? []) {
          brandMap.set(row.gym_id, row);
        }

        const planCounts = new Map<string, number>();
        for (const row of ((plansResponse.data ?? []) as PlanRow[]) ?? []) {
          if (row.is_active) {
            planCounts.set(row.gym_id, (planCounts.get(row.gym_id) ?? 0) + 1);
          }
        }

        const mapped = gyms.map((gym) => {
          const brand = brandMap.get(gym.id);
          const activePlans = planCounts.get(gym.id) ?? 0;
          const status: TenantStatus = gym.is_public
            ? "active"
            : activePlans > 0
              ? "private"
              : "onboarding";

          return {
            id: gym.id,
            slug: gym.slug,
            name: brand?.app_display_name ?? gym.name,
            city: formatLocation(gym),
            members: memberCounts.get(gym.id) ?? 0,
            activePlans,
            status,
            supportEmail: brand?.support_email ?? null,
            joinedAt: gym.created_at,
            lastUpdated: gym.updated_at,
          };
        });

        if (!active) return;
        setTenants(mapped);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load gym tenants.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTenants();

    return () => {
      active = false;
    };
  }, [platformRole, supabase]);

  const filtered = useMemo(
    () =>
      tenants.filter((tenant) => {
        if (filter !== "all" && tenant.status !== filter) return false;
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          tenant.name.toLowerCase().includes(term) ||
          tenant.city.toLowerCase().includes(term) ||
          tenant.slug.toLowerCase().includes(term)
        );
      }),
    [filter, search, tenants]
  );

  const counts: Record<TenantStatus | "all", number> = {
    all: tenants.length,
    active: tenants.filter((tenant) => tenant.status === "active").length,
    private: tenants.filter((tenant) => tenant.status === "private").length,
    onboarding: tenants.filter((tenant) => tenant.status === "onboarding").length,
  };

  async function openGymWorkspace(tenant: Tenant, mode: "manage" | "preview" | "invite") {
    if (!user) return;

    const targetPath = mode === "preview" ? "/preview" : mode === "invite" ? "/members?invite=1" : "/";
    setPendingAction(`${tenant.id}:${mode}`);
    setError(null);

    try {
      const session = await ensureOperatorGymSession({
        supabase,
        user,
        gymId: tenant.id,
        mode: mode === "invite" ? "manage" : mode,
        targetPath,
      });
      window.location.href = buildAdminUrlWithSession(tenant.id, targetPath, session.sessionId);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open gym workspace.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-kruxt-headline text-2xl font-bold tracking-tight">Gym Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live client gyms connected to KRUXT.
          </p>
        </div>
        <button className="rounded-button bg-kruxt-platform px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]">
          + Onboard Gym
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-kruxt-surface px-3 py-1.5">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gyms..."
            className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-kruxt-surface p-1">
          {(["all", ...statusFilters] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === status
                  ? "bg-kruxt-platform/20 text-kruxt-platform"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {status} ({counts[status]})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-kruxt-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plans</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                  Loading live gyms...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td className="px-4 py-10 text-center text-kruxt-danger" colSpan={7}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                  No gyms match this view.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filtered.map((tenant) => (
                <tr key={tenant.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-kruxt-panel/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{tenant.name}</p>
                      <p className="font-kruxt-mono text-xs text-muted-foreground">{tenant.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{tenant.city}</td>
                  <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">{tenant.members.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">{tenant.activePlans}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[tenant.status])}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(tenant.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void openGymWorkspace(tenant, "manage")}
                        disabled={pendingAction !== null}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
                      >
                        {pendingAction === `${tenant.id}:manage` ? "Opening..." : "Open Admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openGymWorkspace(tenant, "invite")}
                        disabled={pendingAction !== null}
                        className="rounded-md border border-kruxt-platform/40 px-3 py-1.5 text-xs font-medium text-kruxt-platform transition-colors hover:bg-kruxt-platform/10"
                      >
                        {pendingAction === `${tenant.id}:invite` ? "Opening..." : "Invite Profile"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openGymWorkspace(tenant, "preview")}
                        disabled={pendingAction !== null}
                        className="rounded-md bg-kruxt-platform/20 px-3 py-1.5 text-xs font-medium text-kruxt-platform transition-colors hover:bg-kruxt-platform/30"
                      >
                        {pendingAction === `${tenant.id}:preview` ? "Opening..." : "Preview"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
