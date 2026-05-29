"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createAdminSupabaseClient } from "@/services";
import { useGym } from "@/contexts/gym-context";
import { cn } from "@/lib/utils";

type CheckStatus = "pass" | "warn" | "fail";

interface GymRow {
  id: string;
  slug: string;
  name: string;
  motto: string | null;
  description: string | null;
  city: string | null;
  country_code: string | null;
  is_public: boolean;
}

interface BrandRow {
  app_display_name: string | null;
  logo_url: string | null;
  icon_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  launch_screen_message: string | null;
  support_email: string | null;
  metadata: Record<string, unknown>;
}

interface DraftRow {
  status: "draft" | "ready" | "published";
  brand_settings: Record<string, unknown>;
  visible_membership_plan_ids: string[] | null;
  schedule_visible: boolean;
  published_at: string | null;
  updated_at: string;
}

interface PlanRow {
  id: string;
  name: string;
  billing_cycle: string;
  price_cents: number;
  currency: string;
  cancel_policy: string | null;
}

interface ClassRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
}

interface PreviewState {
  gym: GymRow | null;
  brand: BrandRow | null;
  draft: DraftRow | null;
  plans: PlanRow[];
  classes: ClassRow[];
  scheduleVisible: boolean;
}

interface PreviewCheck {
  label: string;
  detail: string;
  status: CheckStatus;
}

const statusStyles: Record<CheckStatus, string> = {
  pass: "border-kruxt-success/30 bg-kruxt-success/10 text-kruxt-success",
  warn: "border-kruxt-warning/30 bg-kruxt-warning/10 text-kruxt-warning",
  fail: "border-kruxt-danger/30 bg-kruxt-danger/10 text-kruxt-danger",
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.trim() || "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function hexToRgb(hex: string | null): [number, number, number] | null {
  if (!hex) return null;
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channels = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string | null, b: string | null): number | null {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  if (!left || !right) return null;
  const l1 = luminance(left);
  const l2 = luminance(right);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function draftString(settings: Record<string, unknown>, key: string, fallback: string | null): string | null {
  const value = settings[key];
  return typeof value === "string" || value === null ? value : fallback;
}

function mergeBrandDraft(brand: BrandRow | null, draft: DraftRow | null): BrandRow | null {
  if (!draft) return brand;
  const settings = draft.brand_settings ?? {};
  return {
    app_display_name: draftString(settings, "appDisplayName", brand?.app_display_name ?? null),
    logo_url: draftString(settings, "logoUrl", brand?.logo_url ?? null),
    icon_url: draftString(settings, "iconUrl", brand?.icon_url ?? null),
    banner_url: draftString(settings, "bannerUrl", brand?.banner_url ?? null),
    primary_color: draftString(settings, "primaryColor", brand?.primary_color ?? null),
    accent_color: draftString(settings, "accentColor", brand?.accent_color ?? null),
    background_color: draftString(settings, "backgroundColor", brand?.background_color ?? null),
    surface_color: draftString(settings, "surfaceColor", brand?.surface_color ?? null),
    text_color: draftString(settings, "textColor", brand?.text_color ?? null),
    launch_screen_message: draftString(settings, "launchScreenMessage", brand?.launch_screen_message ?? null),
    support_email: draftString(settings, "supportEmail", brand?.support_email ?? null),
    metadata: brand?.metadata ?? {}
  };
}

function buildChecks(state: PreviewState): PreviewCheck[] {
  const ratio = contrastRatio(state.brand?.text_color ?? null, state.brand?.background_color ?? null);

  return [
    {
      label: "Draft status",
      detail: state.draft
        ? state.draft.status === "draft"
          ? "Rendering saved draft."
          : `Rendering ${state.draft.status} draft.`
        : "No saved draft; rendering the published page.",
      status: state.draft ? "pass" : "warn",
    },
    {
      label: "Public visibility",
      detail: state.gym?.is_public ? "Visible in member discovery." : "Hidden from member discovery.",
      status: state.gym?.is_public ? "pass" : "warn",
    },
    {
      label: "Brand palette",
      detail:
        ratio === null
          ? "Color contrast could not be measured."
          : `Text/background contrast ${ratio.toFixed(1)}:1.`,
      status: ratio === null ? "warn" : ratio >= 4.5 ? "pass" : "fail",
    },
    {
      label: "Logo",
      detail: state.brand?.logo_url ? "Logo is configured." : "Logo is not configured yet.",
      status: state.brand?.logo_url ? "pass" : "warn",
    },
    {
      label: "Active plans",
      detail: `${state.plans.length} active membership plan${state.plans.length === 1 ? "" : "s"}.`,
      status: state.plans.length > 0 ? "pass" : "fail",
    },
    {
      label: "Upcoming classes",
      detail: state.scheduleVisible
        ? `${state.classes.length} upcoming class${state.classes.length === 1 ? "" : "es"} in preview.`
        : "Public schedule is hidden in this draft.",
      status: state.scheduleVisible ? (state.classes.length > 0 ? "pass" : "warn") : "pass",
    },
    {
      label: "Support contact",
      detail: state.brand?.support_email ? state.brand.support_email : "Support email is missing.",
      status: state.brand?.support_email ? "pass" : "warn",
    },
  ];
}

export default function PreviewPage() {
  const { gymId, gymName } = useGym();
  const [state, setState] = useState<PreviewState>({
    gym: null,
    brand: null,
    draft: null,
    plans: [],
    classes: [],
    scheduleVisible: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!gymId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createAdminSupabaseClient();
      const now = new Date().toISOString();

      const [gymResponse, brandResponse, draftResponse, plansResponse, classesResponse] = await Promise.all([
        supabase
          .from("gyms")
          .select("id,slug,name,motto,description,city,country_code,is_public")
          .eq("id", gymId)
          .maybeSingle(),
        supabase
          .from("gym_brand_settings")
          .select(
            "app_display_name,logo_url,icon_url,banner_url,primary_color,accent_color,background_color,surface_color,text_color,launch_screen_message,support_email,metadata"
          )
          .eq("gym_id", gymId)
          .maybeSingle(),
        supabase
          .from("gym_public_page_drafts")
          .select("status,brand_settings,visible_membership_plan_ids,schedule_visible,published_at,updated_at")
          .eq("gym_id", gymId)
          .maybeSingle(),
        supabase
          .from("gym_membership_plans")
          .select("id,name,billing_cycle,price_cents,currency,cancel_policy")
          .eq("gym_id", gymId)
          .eq("is_active", true)
          .order("price_cents", { ascending: true }),
        supabase
          .from("gym_classes")
          .select("id,title,starts_at,ends_at,capacity")
          .eq("gym_id", gymId)
          .neq("status", "cancelled")
          .gte("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(6),
      ]);

      if (gymResponse.error) throw gymResponse.error;
      if (brandResponse.error) throw brandResponse.error;
      if (draftResponse.error) throw draftResponse.error;
      if (plansResponse.error) throw plansResponse.error;
      if (classesResponse.error) throw classesResponse.error;

      const draft = (draftResponse.data as DraftRow | null) ?? null;
      const visiblePlanIds = new Set(draft?.visible_membership_plan_ids ?? []);
      const rawPlans = ((plansResponse.data ?? []) as PlanRow[]) ?? [];
      const nextState: PreviewState = {
        gym: (gymResponse.data as GymRow | null) ?? null,
        brand: mergeBrandDraft((brandResponse.data as BrandRow | null) ?? null, draft),
        draft,
        plans: draft ? rawPlans.filter((plan) => visiblePlanIds.has(plan.id)) : rawPlans,
        classes: draft?.schedule_visible === false ? [] : (((classesResponse.data ?? []) as ClassRow[]) ?? []),
        scheduleVisible: draft?.schedule_visible ?? true,
      };

      if (draft) {
        const nextChecks = buildChecks(nextState);
        const { error: previewUpdateError } = await supabase
          .from("gym_public_page_drafts")
          .update({
            checks: nextChecks,
            last_previewed_at: now,
            status: nextChecks.some((check) => check.status === "fail") ? "draft" : "ready"
          })
          .eq("gym_id", gymId);

        if (previewUpdateError) throw previewUpdateError;
      }

      setState(nextState);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load preview.");
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const checks = useMemo(() => buildChecks(state), [state]);
  const blockingChecks = checks.filter((check) => check.status === "fail").length;
  const warnChecks = checks.filter((check) => check.status === "warn").length;
  const brandName = state.brand?.app_display_name ?? state.gym?.name ?? gymName;
  const brandStyle: CSSProperties = {
    backgroundColor: state.brand?.background_color ?? "#0E1116",
    color: state.brand?.text_color ?? "#F5F7FA",
  };
  const accentStyle: CSSProperties = {
    backgroundColor: state.brand?.primary_color ?? "#35D0FF",
    color: state.brand?.background_color ?? "#0E1116",
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading preview...</div>;
  }

  if (error) {
    return (
      <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/10 p-4 text-sm text-kruxt-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-kruxt-accent">
            {state.draft ? "Draft Member Preview" : "Published Member Preview"}
          </p>
          <h1 className="mt-1 font-kruxt-headline text-2xl font-bold tracking-tight">{brandName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {blockingChecks === 0
              ? warnChecks > 0
                ? `${warnChecks} item${warnChecks === 1 ? "" : "s"} should be reviewed before publishing.`
                : "Ready for member-facing testing."
              : `${blockingChecks} blocking item${blockingChecks === 1 ? "" : "s"} found.`}
          </p>
        </div>
        <button
          onClick={() => void loadPreview()}
          className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90"
        >
          Run Draft Check
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="p-6" style={brandStyle}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-75">
                  {state.gym?.city ?? "Gym"} {state.gym?.country_code ? `/ ${state.gym.country_code}` : ""}
                </p>
                <h2 className="mt-3 font-kruxt-headline text-4xl font-bold tracking-tight">{brandName}</h2>
                <p className="mt-2 max-w-2xl text-sm opacity-80">
                  {state.gym?.motto ?? state.brand?.launch_screen_message ?? "Train, track, and belong."}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/10 text-lg font-bold">
                {state.brand?.logo_url || state.brand?.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.brand.logo_url ?? state.brand.icon_url ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  brandName.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={accentStyle}>
                Request access
              </span>
              {state.scheduleVisible ? (
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">
                  View schedule
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <section>
              <h3 className="text-sm font-semibold text-foreground">Memberships</h3>
              <div className="mt-3 space-y-3">
                {state.plans.slice(0, 4).map((plan) => (
                  <div key={plan.id} className="rounded-card border border-border bg-kruxt-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{plan.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{plan.cancel_policy ?? plan.billing_cycle}</p>
                      </div>
                      <p className="font-kruxt-mono text-sm font-semibold text-kruxt-accent">
                        {formatMoney(plan.price_cents, plan.currency)}
                      </p>
                    </div>
                  </div>
                ))}
                {state.plans.length === 0 && (
                  <p className="rounded-card border border-border bg-kruxt-panel p-4 text-sm text-muted-foreground">
                    No active membership plans.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-foreground">Upcoming Schedule</h3>
              <div className="mt-3 space-y-3">
                {state.classes.slice(0, 4).map((gymClass) => (
                  <div key={gymClass.id} className="rounded-card border border-border bg-kruxt-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{gymClass.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(gymClass.starts_at).toLocaleString("it-IT", {
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="rounded-badge bg-kruxt-accent/10 px-2 py-0.5 text-xs text-kruxt-accent">
                        {gymClass.capacity} spots
                      </span>
                    </div>
                  </div>
                ))}
                {state.classes.length === 0 && (
                  <p className="rounded-card border border-border bg-kruxt-panel p-4 text-sm text-muted-foreground">
                    No upcoming classes.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="font-kruxt-headline text-lg font-semibold">Publishing Checks</h2>
          <div className="mt-4 space-y-3">
            {checks.map((check) => (
              <div key={check.label} className={cn("rounded-card border p-3", statusStyles[check.status])}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{check.label}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{check.status}</span>
                </div>
                <p className="mt-1 text-xs opacity-80">{check.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
