"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { ensureOperatorGymSession } from "@/services/operator-session-service";

type TenantStatus = "active" | "private" | "onboarding";
type CapabilityCategory = "billing" | "operations" | "growth" | "compliance" | "limits";
type CapabilityValueSource = "override" | "plan" | "global";

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

interface EntitlementTemplate {
  template_key: string;
  name: string;
  description: string;
}

interface TenantCapability {
  capability_key: string;
  category: CapabilityCategory;
  sort_order: number;
  label: string;
  description: string;
  value_type: "boolean" | "limit";
  effective_bool: boolean | null;
  effective_limit: number | null;
  source: CapabilityValueSource;
  global_bool_default: boolean | null;
  global_limit_default: number | null;
  template_key: string | null;
  template_name: string | null;
  template_bool_value: boolean | null;
  template_limit_value: number | null;
  override_bool_value: boolean | null;
  override_limit_value: number | null;
  override_reason: string | null;
  override_updated_at: string | null;
  is_billing_sensitive: boolean;
  metadata: Record<string, unknown>;
  impact_count: number;
}

interface ImpactConfirmation {
  capability: TenantCapability;
  nextBool: boolean;
}

const adminAppUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? "http://localhost:3000";

const statusStyles: Record<TenantStatus, string> = {
  active: "bg-kruxt-success/20 text-kruxt-success",
  private: "bg-muted text-muted-foreground",
  onboarding: "bg-kruxt-platform/20 text-kruxt-platform",
};

const statusFilters: TenantStatus[] = ["active", "private", "onboarding"];

const capabilityCategories: Array<{ key: CapabilityCategory; label: string }> = [
  { key: "billing", label: "Billing & money" },
  { key: "operations", label: "Operations" },
  { key: "growth", label: "Member growth" },
  { key: "compliance", label: "Compliance & data" },
  { key: "limits", label: "Limits" },
];

function formatLocation(gym: GymRow): string {
  const pieces = [gym.city, gym.country_code].filter(Boolean);
  return pieces.length > 0 ? pieces.join(", ") : "Not set";
}

function formatCapabilityValue(capability: TenantCapability): string {
  if (capability.value_type === "limit") {
    return (capability.effective_limit ?? 0).toLocaleString();
  }

  return capability.effective_bool ? "On" : "Off";
}

function formatNullableCapabilityValue(
  capability: TenantCapability,
  boolValue: boolean | null,
  limitValue: number | null
): string {
  if (capability.value_type === "limit") {
    return limitValue === null ? "Not set" : limitValue.toLocaleString();
  }

  return boolValue === null ? "Not set" : boolValue ? "On" : "Off";
}

function formatSource(source: CapabilityValueSource): string {
  if (source === "override") return "Tenant override";
  if (source === "plan") return "Plan template";
  return "Global default";
}

function sourceStyles(source: CapabilityValueSource): string {
  if (source === "override") return "border-kruxt-platform/40 bg-kruxt-platform/15 text-kruxt-platform";
  if (source === "plan") return "border-kruxt-success/30 bg-kruxt-success/10 text-kruxt-success";
  return "border-border bg-kruxt-panel text-muted-foreground";
}

function valueChipStyles(enabled: boolean): string {
  return enabled
    ? "border-kruxt-success/30 bg-kruxt-success/10 text-kruxt-success"
    : "border-kruxt-danger/30 bg-kruxt-danger/10 text-kruxt-danger";
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
  const [featureTenant, setFeatureTenant] = useState<Tenant | null>(null);
  const [templates, setTemplates] = useState<EntitlementTemplate[]>([]);
  const [capabilities, setCapabilities] = useState<TenantCapability[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState<string | null>(null);
  const [featuresNotice, setFeaturesNotice] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingCapability, setSavingCapability] = useState<string | null>(null);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [impactConfirmation, setImpactConfirmation] = useState<ImpactConfirmation | null>(null);

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

  useEffect(() => {
    if (!featureTenant) return;
    let active = true;

    async function loadTenantFeatures() {
      if (!featureTenant) return;

      setFeaturesLoading(true);
      setFeaturesError(null);
      setFeaturesNotice(null);

      try {
        const [templatesResponse, capabilitiesResponse] = await Promise.all([
          supabase
            .from("platform_entitlement_templates")
            .select("template_key,name,description")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase.rpc("platform_get_gym_capabilities", { p_gym_id: featureTenant.id }),
        ]);

        if (templatesResponse.error) throw templatesResponse.error;
        if (capabilitiesResponse.error) throw capabilitiesResponse.error;

        const nextCapabilities = ((capabilitiesResponse.data ?? []) as TenantCapability[]) ?? [];
        const nextLimitDrafts: Record<string, string> = {};
        for (const capability of nextCapabilities) {
          if (capability.value_type === "limit") {
            nextLimitDrafts[capability.capability_key] = String(capability.effective_limit ?? 0);
          }
        }

        if (!active) return;
        setTemplates(((templatesResponse.data ?? []) as EntitlementTemplate[]) ?? []);
        setCapabilities(nextCapabilities);
        setLimitDrafts(nextLimitDrafts);
      } catch (loadError) {
        if (!active) return;
        setFeaturesError(loadError instanceof Error ? loadError.message : "Unable to load tenant features.");
      } finally {
        if (active) setFeaturesLoading(false);
      }
    }

    void loadTenantFeatures();

    return () => {
      active = false;
    };
  }, [featureTenant, supabase]);

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

  const currentTemplateKey = capabilities.find((capability) => capability.template_key)?.template_key ?? "";
  const currentTemplateName = capabilities.find((capability) => capability.template_name)?.template_name ?? "No template";

  async function refreshTenantFeatures(nextNotice?: string) {
    if (!featureTenant) return;

    setFeaturesLoading(true);
    setFeaturesError(null);

    try {
      const { data, error: capabilitiesError } = await supabase.rpc("platform_get_gym_capabilities", {
        p_gym_id: featureTenant.id,
      });

      if (capabilitiesError) throw capabilitiesError;

      const nextCapabilities = ((data ?? []) as TenantCapability[]) ?? [];
      const nextLimitDrafts: Record<string, string> = {};
      for (const capability of nextCapabilities) {
        if (capability.value_type === "limit") {
          nextLimitDrafts[capability.capability_key] = String(capability.effective_limit ?? 0);
        }
      }

      setCapabilities(nextCapabilities);
      setLimitDrafts(nextLimitDrafts);
      setFeaturesNotice(nextNotice ?? null);
    } catch (refreshError) {
      setFeaturesError(refreshError instanceof Error ? refreshError.message : "Unable to refresh tenant features.");
    } finally {
      setFeaturesLoading(false);
    }
  }

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

  function openFeaturesPanel(tenant: Tenant) {
    setFeatureTenant(tenant);
    setCapabilities([]);
    setTemplates([]);
    setLimitDrafts({});
    setFeaturesError(null);
    setFeaturesNotice(null);
    setImpactConfirmation(null);
  }

  async function assignTemplate(templateKey: string) {
    if (!featureTenant || !templateKey) return;

    setSavingTemplate(true);
    setFeaturesError(null);
    setFeaturesNotice(null);

    try {
      const { error: assignError } = await supabase.rpc("platform_assign_gym_entitlement_template", {
        p_gym_id: featureTenant.id,
        p_template_key: templateKey,
        p_reason: "Updated from Tenant Features",
      });

      if (assignError) throw assignError;
      await refreshTenantFeatures("Plan template updated.");
    } catch (assignError) {
      setFeaturesError(assignError instanceof Error ? assignError.message : "Unable to update plan template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function setBooleanOverride(capability: TenantCapability, nextBool: boolean, acknowledgedImpact = false) {
    if (!featureTenant) return;

    if (!nextBool && capability.impact_count > 0 && !acknowledgedImpact) {
      setImpactConfirmation({ capability, nextBool });
      return;
    }

    setSavingCapability(capability.capability_key);
    setFeaturesError(null);
    setFeaturesNotice(null);

    try {
      const { error: overrideError } = await supabase.rpc("platform_set_gym_capability_override", {
        p_gym_id: featureTenant.id,
        p_capability_key: capability.capability_key,
        p_bool_value: nextBool,
        p_limit_value: null,
        p_reason: `Set ${capability.label} ${nextBool ? "on" : "off"} from Tenant Features`,
        p_acknowledged_impact: acknowledgedImpact,
      });

      if (overrideError) throw overrideError;
      setImpactConfirmation(null);
      await refreshTenantFeatures(`${capability.label} override saved.`);
    } catch (overrideError) {
      setFeaturesError(overrideError instanceof Error ? overrideError.message : "Unable to save capability override.");
    } finally {
      setSavingCapability(null);
    }
  }

  async function setLimitOverride(capability: TenantCapability) {
    if (!featureTenant) return;

    const parsedValue = Number.parseInt(limitDrafts[capability.capability_key] ?? "", 10);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      setFeaturesError("Limit overrides must be zero or a positive whole number.");
      return;
    }

    setSavingCapability(capability.capability_key);
    setFeaturesError(null);
    setFeaturesNotice(null);

    try {
      const { error: overrideError } = await supabase.rpc("platform_set_gym_capability_override", {
        p_gym_id: featureTenant.id,
        p_capability_key: capability.capability_key,
        p_bool_value: null,
        p_limit_value: parsedValue,
        p_reason: `Set ${capability.label} limit from Tenant Features`,
        p_acknowledged_impact: false,
      });

      if (overrideError) throw overrideError;
      await refreshTenantFeatures(`${capability.label} limit saved.`);
    } catch (overrideError) {
      setFeaturesError(overrideError instanceof Error ? overrideError.message : "Unable to save limit override.");
    } finally {
      setSavingCapability(null);
    }
  }

  async function clearOverride(capability: TenantCapability) {
    if (!featureTenant) return;

    setSavingCapability(capability.capability_key);
    setFeaturesError(null);
    setFeaturesNotice(null);

    try {
      const { error: clearError } = await supabase.rpc("platform_clear_gym_capability_override", {
        p_gym_id: featureTenant.id,
        p_capability_key: capability.capability_key,
        p_reason: `Cleared ${capability.label} override from Tenant Features`,
      });

      if (clearError) throw clearError;
      await refreshTenantFeatures(`${capability.label} now follows the plan/global value.`);
    } catch (clearError) {
      setFeaturesError(clearError instanceof Error ? clearError.message : "Unable to clear capability override.");
    } finally {
      setSavingCapability(null);
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
                        onClick={() => openFeaturesPanel(tenant)}
                        disabled={pendingAction !== null}
                        className="rounded-md border border-kruxt-platform/40 px-3 py-1.5 text-xs font-medium text-kruxt-platform transition-colors hover:bg-kruxt-platform/10"
                      >
                        Features
                      </button>
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

      {featureTenant && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            type="button"
            aria-label="Close tenant features"
            className="absolute inset-0 cursor-default"
            onClick={() => setFeatureTenant(null)}
          />
          <section className="relative flex h-full w-full max-w-5xl flex-col border-l border-border bg-background shadow-2xl">
            <div className="border-b border-border bg-kruxt-surface px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-kruxt-mono text-xs uppercase tracking-wider text-kruxt-platform">
                    Tenant features
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">{featureTenant.name}</h2>
                  <p className="mt-1 font-kruxt-mono text-xs text-muted-foreground">{featureTenant.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureTenant(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="rounded-card border border-border bg-kruxt-surface p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Plan / entitlement template</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Effective source: tenant override, then {currentTemplateName}, then global default.
                    </p>
                  </div>
                  <select
                    value={currentTemplateKey}
                    onChange={(event) => void assignTemplate(event.target.value)}
                    disabled={savingTemplate || featuresLoading}
                    className="min-w-52 rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:border-kruxt-platform focus:outline-none"
                  >
                    <option value="">No template</option>
                    {templates.map((template) => (
                      <option key={template.template_key} value={template.template_key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {featuresError && (
                <div className="mt-4 rounded-card border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
                  {featuresError}
                </div>
              )}

              {featuresNotice && (
                <div className="mt-4 rounded-card border border-kruxt-success/30 bg-kruxt-success/10 px-4 py-3 text-sm text-kruxt-success">
                  {featuresNotice}
                </div>
              )}

              {featuresLoading && capabilities.length === 0 ? (
                <div className="mt-4 rounded-card border border-border bg-kruxt-surface p-10 text-center text-sm text-muted-foreground">
                  Loading tenant capabilities...
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {capabilityCategories.map((category) => {
                    const rows = capabilities.filter((capability) => capability.category === category.key);
                    if (rows.length === 0) return null;

                    return (
                      <div key={category.key} className="space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          {category.label}
                        </h3>
                        <div className="space-y-3">
                          {rows.map((capability) => {
                            const isSaving = savingCapability === capability.capability_key;
                            const enabled = capability.effective_bool ?? false;
                            const hasOverride = capability.source === "override";

                            return (
                              <div key={capability.capability_key} className="rounded-card border border-border bg-kruxt-surface p-4">
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)] lg:items-start">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <code className="rounded-md bg-kruxt-panel px-2 py-1 font-kruxt-mono text-[11px] text-kruxt-platform">
                                        {capability.capability_key}
                                      </code>
                                      {capability.is_billing_sensitive && (
                                        <span className="rounded-badge border border-kruxt-warning/30 bg-kruxt-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-kruxt-warning">
                                          Money
                                        </span>
                                      )}
                                      {capability.impact_count > 0 && (
                                        <span className="rounded-badge border border-kruxt-warning/30 bg-kruxt-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase text-kruxt-warning">
                                          {capability.impact_count.toLocaleString()} in use
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-3 text-sm font-semibold text-foreground">{capability.label}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{capability.description}</p>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("rounded-badge border px-2 py-0.5 text-[10px] font-bold uppercase", sourceStyles(capability.source))}>
                                        {formatSource(capability.source)}
                                      </span>
                                      <span
                                        className={cn(
                                          "rounded-badge border px-2 py-0.5 text-[10px] font-bold uppercase",
                                          capability.value_type === "boolean"
                                            ? valueChipStyles(enabled)
                                            : "border-kruxt-platform/30 bg-kruxt-platform/10 text-kruxt-platform"
                                        )}
                                      >
                                        {formatCapabilityValue(capability)}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                                      <span className="rounded-md bg-kruxt-panel px-2 py-1">
                                        Global: {formatNullableCapabilityValue(capability, capability.global_bool_default, capability.global_limit_default)}
                                      </span>
                                      <span className="rounded-md bg-kruxt-panel px-2 py-1">
                                        Plan: {formatNullableCapabilityValue(capability, capability.template_bool_value, capability.template_limit_value)}
                                      </span>
                                      <span className="rounded-md bg-kruxt-panel px-2 py-1">
                                        Override: {formatNullableCapabilityValue(capability, capability.override_bool_value, capability.override_limit_value)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                                    {capability.value_type === "boolean" ? (
                                      <button
                                        type="button"
                                        onClick={() => void setBooleanOverride(capability, !enabled)}
                                        disabled={isSaving || featuresLoading}
                                        className={cn(
                                          "flex h-8 w-14 items-center rounded-full px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                          enabled ? "bg-kruxt-success" : "bg-kruxt-panel"
                                        )}
                                        aria-label={`Toggle ${capability.label}`}
                                      >
                                        <span
                                          className={cn(
                                            "h-6 w-6 rounded-full bg-white shadow transition-transform",
                                            enabled ? "translate-x-6" : "translate-x-0"
                                          )}
                                        />
                                      </button>
                                    ) : (
                                      <>
                                        <input
                                          type="number"
                                          min={0}
                                          value={limitDrafts[capability.capability_key] ?? ""}
                                          onChange={(event) =>
                                            setLimitDrafts((current) => ({
                                              ...current,
                                              [capability.capability_key]: event.target.value,
                                            }))
                                          }
                                          disabled={isSaving || featuresLoading}
                                          className="w-28 rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:border-kruxt-platform focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void setLimitOverride(capability)}
                                          disabled={isSaving || featuresLoading}
                                          className="rounded-md bg-kruxt-platform/20 px-3 py-2 text-xs font-semibold text-kruxt-platform transition-colors hover:bg-kruxt-platform/30 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          Apply
                                        </button>
                                      </>
                                    )}
                                    {hasOverride && (
                                      <button
                                        type="button"
                                        onClick={() => void clearOverride(capability)}
                                        disabled={isSaving || featuresLoading}
                                        className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Clear override
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {impactConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-card border border-kruxt-warning/30 bg-kruxt-surface p-5 shadow-2xl">
            <p className="text-sm font-bold text-foreground">Disable in-use capability?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {impactConfirmation.capability.label} is currently tied to{" "}
              {impactConfirmation.capability.impact_count.toLocaleString()} live record
              {impactConfirmation.capability.impact_count === 1 ? "" : "s"} for {featureTenant?.name}.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImpactConfirmation(null)}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void setBooleanOverride(impactConfirmation.capability, impactConfirmation.nextBool, true)}
                disabled={savingCapability !== null}
                className="rounded-md bg-kruxt-warning px-3 py-2 text-xs font-bold text-black transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Disable anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
