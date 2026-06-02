"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { cn } from "@/lib/utils";

type TenantStatus = "active" | "private" | "onboarding";

type GymRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  gym_id: string;
  membership_status: string;
};

type BrandRow = {
  gym_id: string;
  app_display_name: string | null;
};

type GymPlanRow = {
  gym_id: string;
  is_active: boolean;
};

type PlatformSubscriptionRow = {
  gym_id: string;
  status: string;
  platform_plan_id: string | null;
};

type PlatformPlanRow = {
  id: string;
  amount_cents: number;
  currency: string;
  billing_period: string;
};

type AlertSeverity = "critical" | "warning" | "info";

type LiveAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  location: string;
  activeMembers: number;
  activePlans: number;
  monthlyRevenueCents: number | null;
  currency: string;
  status: TenantStatus;
  updatedAt: string;
};

type PlatformOverviewState = {
  activeGyms: number;
  totalGyms: number;
  totalMembers: number;
  platformMrrCents: number | null;
  currency: string;
  alerts: LiveAlert[];
  tenants: TenantSummary[];
  generatedAt: Date;
};

const ACTIVE_MEMBER_STATUSES = new Set(["active", "trial"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const severityStyles: Record<AlertSeverity, string> = {
  critical: "border-kruxt-danger/30 bg-kruxt-danger/5",
  warning: "border-kruxt-warning/30 bg-kruxt-warning/5",
  info: "border-kruxt-platform/20 bg-kruxt-platform/5",
};

const severityDot: Record<AlertSeverity, string> = {
  critical: "bg-kruxt-danger",
  warning: "bg-kruxt-warning",
  info: "bg-kruxt-platform",
};

const statusStyles: Record<TenantStatus, string> = {
  active: "bg-kruxt-success/20 text-kruxt-success",
  private: "bg-kruxt-accent/20 text-kruxt-accent",
  onboarding: "bg-kruxt-platform/20 text-kruxt-platform",
};

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoneyFromCents(cents: number | null, currency: string): string {
  if (cents === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function monthlyAmountCents(plan: PlatformPlanRow | undefined): number {
  if (!plan) return 0;
  if (plan.billing_period === "yearly") return Math.round(plan.amount_cents / 12);
  if (plan.billing_period === "quarterly") return Math.round(plan.amount_cents / 3);
  return plan.amount_cents;
}

function formatLocation(gym: GymRow): string {
  return [gym.city, gym.country_code].filter(Boolean).join(", ") || "—";
}

function deriveTenantStatus(gym: GymRow, activePlans: number): TenantStatus {
  if (gym.is_public) return "active";
  if (activePlans > 0) return "private";
  return "onboarding";
}

function buildKpis(state: PlatformOverviewState | null) {
  return [
    {
      label: "Active Gyms",
      value: state ? formatInteger(state.activeGyms) : "—",
      trend: state ? `${formatInteger(state.totalGyms)} total` : "Loading",
      trendLabel: "",
      color: "text-kruxt-accent",
    },
    {
      label: "Total Members",
      value: state ? formatInteger(state.totalMembers) : "—",
      trend: "Live",
      trendLabel: "active/trial memberships",
      color: "text-kruxt-success",
    },
    {
      label: "MRR",
      value: state ? formatMoneyFromCents(state.platformMrrCents, state.currency) : "—",
      trend: state?.platformMrrCents === null ? "Not connected" : "Live",
      trendLabel: state?.platformMrrCents === null ? "billing source" : "KRUXT subscriptions",
      color: "text-kruxt-platform",
    },
    {
      label: "Platform Health",
      value: "—",
      trend: "Not connected",
      trendLabel: "uptime monitor",
      color: "text-muted-foreground",
    },
  ];
}

export default function PlatformOverviewPage() {
  const { supabase, platformRole } = usePlatformAuth();
  const [overview, setOverview] = useState<PlatformOverviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!platformRole) return;

    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const [
          gymsResponse,
          membershipsResponse,
          brandsResponse,
          gymPlansResponse,
          subscriptionsResponse,
          supportGrantsResponse,
          supportTicketsResponse,
          releaseApprovalsResponse,
        ] = await Promise.all([
          supabase
            .from("gyms")
            .select("id,slug,name,city,country_code,is_public,created_at,updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("gym_memberships")
            .select("gym_id,membership_status")
            .in("membership_status", ["active", "trial"]),
          supabase.from("gym_brand_settings").select("gym_id,app_display_name"),
          supabase.from("gym_membership_plans").select("gym_id,is_active").eq("is_active", true),
          supabase
            .from("gym_platform_subscriptions")
            .select("gym_id,status,platform_plan_id")
            .in("status", ["active", "trialing"]),
          supabase
            .from("gym_support_access_grants")
            .select("id,status,created_at")
            .eq("status", "requested"),
          supabase
            .from("support_tickets")
            .select("id,status,subject,created_at")
            .in("status", ["open", "triaged", "in_progress", "waiting_approval"]),
          supabase.from("data_release_approvals").select("id,status,created_at").eq("status", "pending"),
        ]);

        if (gymsResponse.error) throw gymsResponse.error;
        if (membershipsResponse.error) throw membershipsResponse.error;
        if (brandsResponse.error) throw brandsResponse.error;
        if (gymPlansResponse.error) throw gymPlansResponse.error;
        if (subscriptionsResponse.error) throw subscriptionsResponse.error;
        if (supportGrantsResponse.error) throw supportGrantsResponse.error;
        if (supportTicketsResponse.error) throw supportTicketsResponse.error;
        if (releaseApprovalsResponse.error) throw releaseApprovalsResponse.error;

        const gyms = ((gymsResponse.data ?? []) as GymRow[]) ?? [];
        const memberships = ((membershipsResponse.data ?? []) as MembershipRow[]) ?? [];
        const brands = ((brandsResponse.data ?? []) as BrandRow[]) ?? [];
        const gymPlans = ((gymPlansResponse.data ?? []) as GymPlanRow[]) ?? [];
        const subscriptions = ((subscriptionsResponse.data ?? []) as PlatformSubscriptionRow[]) ?? [];

        const planIds = Array.from(
          new Set(
            subscriptions
              .map((subscription) => subscription.platform_plan_id)
              .filter((planId): planId is string => Boolean(planId))
          )
        );

        const platformPlansById = new Map<string, PlatformPlanRow>();
        if (planIds.length > 0) {
          const { data: platformPlans, error: platformPlansError } = await supabase
            .from("platform_plans")
            .select("id,amount_cents,currency,billing_period")
            .in("id", planIds);

          if (platformPlansError) throw platformPlansError;

          for (const plan of ((platformPlans ?? []) as PlatformPlanRow[]) ?? []) {
            platformPlansById.set(plan.id, plan);
          }
        }

        const brandByGym = new Map(brands.map((brand) => [brand.gym_id, brand]));
        const activeMembersByGym = new Map<string, number>();
        for (const membership of memberships) {
          if (!ACTIVE_MEMBER_STATUSES.has(membership.membership_status)) continue;
          activeMembersByGym.set(membership.gym_id, (activeMembersByGym.get(membership.gym_id) ?? 0) + 1);
        }

        const activePlanCountByGym = new Map<string, number>();
        for (const plan of gymPlans) {
          if (!plan.is_active) continue;
          activePlanCountByGym.set(plan.gym_id, (activePlanCountByGym.get(plan.gym_id) ?? 0) + 1);
        }

        const monthlyRevenueByGym = new Map<string, number>();
        let detectedCurrency = "EUR";
        for (const subscription of subscriptions) {
          if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) || !subscription.platform_plan_id) continue;
          const plan = platformPlansById.get(subscription.platform_plan_id);
          if (!plan) continue;
          detectedCurrency = plan.currency || detectedCurrency;
          monthlyRevenueByGym.set(
            subscription.gym_id,
            (monthlyRevenueByGym.get(subscription.gym_id) ?? 0) + monthlyAmountCents(plan)
          );
        }

        const tenantSummaries = gyms
          .map((gym) => {
            const activePlans = activePlanCountByGym.get(gym.id) ?? 0;
            const status = deriveTenantStatus(gym, activePlans);
            const monthlyRevenueCents = monthlyRevenueByGym.has(gym.id) ? monthlyRevenueByGym.get(gym.id) ?? 0 : null;

            return {
              id: gym.id,
              name: brandByGym.get(gym.id)?.app_display_name ?? gym.name,
              slug: gym.slug,
              location: formatLocation(gym),
              activeMembers: activeMembersByGym.get(gym.id) ?? 0,
              activePlans,
              monthlyRevenueCents,
              currency: detectedCurrency,
              status,
              updatedAt: gym.updated_at ?? gym.created_at,
            };
          })
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

        const supportGrantCount = ((supportGrantsResponse.data ?? []) as Array<{ id: string }>).length;
        const supportTicketCount = ((supportTicketsResponse.data ?? []) as Array<{ id: string }>).length;
        const releaseApprovalCount = ((releaseApprovalsResponse.data ?? []) as Array<{ id: string }>).length;

        const alerts: LiveAlert[] = [];
        if (supportGrantCount > 0) {
          alerts.push({
            id: "support-grants",
            severity: "critical",
            title: `${supportGrantCount} support access ${supportGrantCount === 1 ? "grant" : "grants"} pending approval`,
            detail: "Live from Support Access",
            href: "/support-access",
          });
        }

        if (supportTicketCount > 0) {
          alerts.push({
            id: "support-tickets",
            severity: "warning",
            title: `${supportTicketCount} open support ${supportTicketCount === 1 ? "ticket" : "tickets"}`,
            detail: "Live from Support",
            href: "/support-access",
          });
        }

        if (releaseApprovalCount > 0) {
          alerts.push({
            id: "data-release-approvals",
            severity: "warning",
            title: `${releaseApprovalCount} data release ${releaseApprovalCount === 1 ? "approval" : "approvals"} pending`,
            detail: "Live from Data Governance",
            href: "/data-governance",
          });
        }

        const platformMrrCents =
          monthlyRevenueByGym.size > 0
            ? Array.from(monthlyRevenueByGym.values()).reduce((sum, cents) => sum + cents, 0)
            : null;

        if (!active) return;
        setOverview({
          activeGyms: tenantSummaries.filter((tenant) => tenant.status !== "onboarding").length,
          totalGyms: tenantSummaries.length,
          totalMembers: memberships.length,
          platformMrrCents,
          currency: detectedCurrency,
          alerts,
          tenants: tenantSummaries.slice(0, 5),
          generatedAt: new Date(),
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load live platform overview.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, [platformRole, supabase]);

  const kpis = useMemo(() => buildKpis(overview), [overview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-kruxt-headline text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide metrics and governance signals. Live Supabase data only.
        </p>
        {overview ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Refreshed {overview.generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-4 text-sm text-kruxt-danger">
          Unable to load live platform overview: {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-card border border-border bg-kruxt-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {kpi.label}
            </p>
            <p className={cn("mt-2 font-kruxt-mono text-3xl font-bold", kpi.color)}>
              {loading ? "…" : kpi.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className={cn(kpi.trend === "Not connected" ? "text-muted-foreground" : "text-kruxt-success")}>
                {loading ? "Loading" : kpi.trend}
              </span>{" "}
              {!loading ? kpi.trendLabel : "live data"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-kruxt-headline text-lg font-bold">Governance Alerts</h2>
          <div className="space-y-2">
            {loading ? (
              <div className="rounded-card border border-border bg-kruxt-surface p-4 text-sm text-muted-foreground">
                Loading live alerts…
              </div>
            ) : overview && overview.alerts.length > 0 ? (
              overview.alerts.map((alert) => (
                <a
                  key={alert.id}
                  href={alert.href}
                  className={cn(
                    "flex items-start gap-3 rounded-card border p-4 transition-colors hover:border-kruxt-platform/40",
                    severityStyles[alert.severity]
                  )}
                >
                  <span className={cn("mt-1 h-2 w-2 flex-shrink-0 rounded-full", severityDot[alert.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                </a>
              ))
            ) : (
              <div className="rounded-card border border-border bg-kruxt-surface p-4 text-sm text-muted-foreground">
                No live governance alerts.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <h2 className="font-kruxt-headline text-lg font-bold">Recent Tenants</h2>
          <div className="overflow-hidden rounded-card border border-border bg-kruxt-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gym</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">MRR</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                      Loading tenants…
                    </td>
                  </tr>
                ) : overview && overview.tenants.length > 0 ? (
                  overview.tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-kruxt-panel/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{tenant.location}</td>
                      <td className="px-4 py-3 text-right font-kruxt-mono text-foreground">
                        {formatInteger(tenant.activeMembers)}
                      </td>
                      <td className="px-4 py-3 text-right font-kruxt-mono text-kruxt-success">
                        {formatMoneyFromCents(tenant.monthlyRevenueCents, tenant.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[tenant.status])}>
                          {tenant.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                      No tenants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Review Support Grants", count: overview?.alerts.find((alert) => alert.id === "support-grants") ? "Open" : "0", href: "/support-access" },
          { label: "Pending Data Releases", count: overview?.alerts.find((alert) => alert.id === "data-release-approvals") ? "Open" : "0", href: "/data-governance" },
          { label: "Revenue Settlements", count: overview?.platformMrrCents === null ? "Not connected" : "Live", href: "/revenue" },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="group flex items-center justify-between rounded-card border border-border bg-kruxt-surface p-4 transition-colors hover:border-kruxt-platform/40 hover:bg-kruxt-panel"
          >
            <div>
              <p className="text-sm font-medium text-foreground transition-colors group-hover:text-kruxt-platform">
                {action.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{loading ? "Loading" : action.count}</p>
            </div>
            <svg className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-kruxt-platform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
