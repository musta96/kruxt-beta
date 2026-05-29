"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import { seedBzoneDemoData } from "@/services";
import type { GymBrandAssetKind } from "@/services";
import type { GymBrandSettings, GymPublicPageBrandDraft, UpsertGymBrandSettingsInput } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

interface BrandDraft {
  appDisplayName: string;
  logoUrl: string;
  iconUrl: string;
  bannerUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  launchScreenMessage: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
}

type PlanOption = {
  id: string;
  name: string;
  billing_cycle: string;
  price_cents: number;
  currency: string;
};

const defaultBrandDraft: BrandDraft = {
  appDisplayName: "",
  logoUrl: "",
  iconUrl: "",
  bannerUrl: "",
  primaryColor: "#35D0FF",
  accentColor: "#8BE9C7",
  backgroundColor: "#0E1116",
  surfaceColor: "#171C24",
  textColor: "#F5F7FA",
  launchScreenMessage: "",
  supportEmail: "",
  termsUrl: "",
  privacyUrl: ""
};

function compact(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.trim() || "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function toDraft(settings: GymBrandSettings | GymPublicPageBrandDraft | null): BrandDraft {
  if (!settings) return defaultBrandDraft;
  return {
    appDisplayName: settings.appDisplayName ?? "",
    logoUrl: settings.logoUrl ?? "",
    iconUrl: settings.iconUrl ?? "",
    bannerUrl: settings.bannerUrl ?? "",
    primaryColor: settings.primaryColor ?? defaultBrandDraft.primaryColor,
    accentColor: settings.accentColor ?? defaultBrandDraft.accentColor,
    backgroundColor: settings.backgroundColor ?? defaultBrandDraft.backgroundColor,
    surfaceColor: settings.surfaceColor ?? defaultBrandDraft.surfaceColor,
    textColor: settings.textColor ?? defaultBrandDraft.textColor,
    launchScreenMessage: settings.launchScreenMessage ?? "",
    supportEmail: settings.supportEmail ?? "",
    termsUrl: settings.termsUrl ?? "",
    privacyUrl: settings.privacyUrl ?? ""
  };
}

function toBrandInput(draft: BrandDraft): UpsertGymBrandSettingsInput {
  return {
    appDisplayName: compact(draft.appDisplayName),
    logoUrl: compact(draft.logoUrl),
    iconUrl: compact(draft.iconUrl),
    bannerUrl: compact(draft.bannerUrl),
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    backgroundColor: draft.backgroundColor,
    surfaceColor: draft.surfaceColor,
    textColor: draft.textColor,
    launchScreenMessage: compact(draft.launchScreenMessage),
    supportEmail: compact(draft.supportEmail),
    termsUrl: compact(draft.termsUrl),
    privacyUrl: compact(draft.privacyUrl)
  };
}

function buildPreviewHref(gymId: string, supportSessionId: string | null): string {
  const params = new URLSearchParams({ gymId });
  if (supportSessionId) params.set("supportSessionId", supportSessionId);
  return `/preview?${params.toString()}`;
}

export default function SettingsPage() {
  const { gymId, gymName, supportSessionId } = useGym();
  const { customization, supabase } = useServices();
  const [draft, setDraft] = useState<BrandDraft>(defaultBrandDraft);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [scheduleVisible, setScheduleVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<GymBrandAssetKind | null>(null);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | undefined>();

  const brandState = useAsync(() => customization.getGymBrandSettings(gymId), [gymId]);
  const draftState = useAsync(() => customization.getGymPublicPageDraft(gymId), [gymId]);
  const plansState = useAsync(async () => {
    const { data, error } = await supabase
      .from("gym_membership_plans")
      .select("id,name,billing_cycle,price_cents,currency")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });

    if (error) throw new Error(error.message || "Unable to load public membership plans.");
    return ((data ?? []) as PlanOption[]) ?? [];
  }, [gymId]);

  useEffect(() => {
    if (brandState.status !== "success" || draftState.status !== "success" || plansState.status !== "success") {
      return;
    }

    const pageDraft = draftState.data ?? null;
    const activePlanIds = new Set((plansState.data ?? []).map((plan) => plan.id));
    setDraft(toDraft(pageDraft?.brandSettings ?? brandState.data ?? null));
    setSelectedPlanIds(
      pageDraft
        ? pageDraft.visibleMembershipPlanIds.filter((planId) => activePlanIds.has(planId))
        : (plansState.data ?? []).map((plan) => plan.id)
    );
    setScheduleVisible(pageDraft?.scheduleVisible ?? true);
  }, [brandState.data, brandState.status, draftState.data, draftState.status, plansState.data, plansState.status]);

  const plans = plansState.data ?? [];
  const allPlansSelected = plans.length > 0 && selectedPlanIds.length === plans.length;
  const previewHref = useMemo(() => buildPreviewHref(gymId, supportSessionId), [gymId, supportSessionId]);
  const draftStatusLabel = draftState.data
    ? draftState.data.status === "published"
      ? "Published draft"
      : "Draft saved"
    : "No saved draft";

  const updateDraft = (key: keyof BrandDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSuccess(undefined);
  };

  const handleAssetUpload = async (kind: GymBrandAssetKind, key: "logoUrl" | "iconUrl" | "bannerUrl", file?: File) => {
    if (!file) return;
    setUploadingAsset(kind);
    setSaveError(undefined);
    setSuccess(undefined);
    try {
      const asset = await customization.uploadGymBrandAsset(gymId, kind, file);
      setDraft((current) => ({ ...current, [key]: asset.publicUrl }));
      setSuccess(`${kind[0].toUpperCase()}${kind.slice(1)} uploaded. Save the draft when you are ready.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to upload brand asset.");
    } finally {
      setUploadingAsset(null);
    }
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((current) =>
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId]
    );
    setSuccess(undefined);
  };

  const toggleAllPlans = () => {
    setSelectedPlanIds(allPlansSelected ? [] : plans.map((plan) => plan.id));
    setSuccess(undefined);
  };

  const saveDraft = async (nextStatus: "draft" | "ready" = "draft") => {
    setSaving(true);
    setSaveError(undefined);
    setSuccess(undefined);
    try {
      await customization.upsertGymPublicPageDraft(gymId, {
        brandSettings: toBrandInput(draft),
        visibleMembershipPlanIds: selectedPlanIds,
        scheduleVisible,
        status: nextStatus
      });
      setSuccess(nextStatus === "ready" ? "Draft saved and marked ready for preview." : "Draft saved.");
      draftState.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save public page draft.");
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    setPublishing(true);
    setSaveError(undefined);
    setSuccess(undefined);
    try {
      await customization.upsertGymPublicPageDraft(gymId, {
        brandSettings: toBrandInput(draft),
        visibleMembershipPlanIds: selectedPlanIds,
        scheduleVisible,
        status: "ready"
      });
      await customization.publishGymPublicPageDraft(gymId);
      setSuccess("Published. Members will now see this public page configuration.");
      brandState.refetch();
      draftState.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to publish public page draft.");
    } finally {
      setPublishing(false);
    }
  };

  const seedBzone = async () => {
    setSeeding(true);
    setSaveError(undefined);
    setSeedMessage(undefined);
    try {
      const result = await seedBzoneDemoData(supabase, gymId);
      setSeedMessage(
        `BZone demo ready: gym identity ${result.gymUpdated ? "updated" : "unchanged"}, brand ${
          result.brandSettingsUpserted ? "upserted" : "unchanged"
        }, ${result.plansUpserted} plans, ${
          result.classesSkipped ? "existing class schedule kept" : `${result.classesCreated} classes`
        }, waiver ${result.waiverUpserted ? "upserted" : "unchanged"}, and billing instructions ${
          result.billingSettingsUpserted ? "upserted" : "unchanged"
        }.`
      );
      brandState.refetch();
      draftState.refetch();
      plansState.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to seed BZone demo data.");
    } finally {
      setSeeding(false);
    }
  };

  if (
    brandState.status === "loading" ||
    brandState.status === "idle" ||
    draftState.status === "loading" ||
    draftState.status === "idle" ||
    plansState.status === "loading" ||
    plansState.status === "idle"
  ) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure, preview, and publish the member-facing gym experience."
      />

      {brandState.status === "error" && <ErrorBanner message={brandState.error} onRetry={brandState.refetch} />}
      {draftState.status === "error" && <ErrorBanner message={draftState.error} onRetry={draftState.refetch} />}
      {plansState.status === "error" && <ErrorBanner message={plansState.error} onRetry={plansState.refetch} />}
      {saveError && <ErrorBanner message={saveError} onRetry={() => setSaveError(undefined)} />}
      {success && (
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/10 px-4 py-3 text-sm text-kruxt-success">
          {success}
        </div>
      )}
      {seedMessage && (
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/10 px-4 py-3 text-sm text-kruxt-success">
          {seedMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
                  Public Page Draft
                </h2>
                <span className="rounded-badge border border-border bg-kruxt-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {draftStatusLabel}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Edit the palette, logo, page copy, public plans, and schedule visibility before publishing.
              </p>
            </div>
            <Link
              href={previewHref}
              className="rounded-button border border-border px-4 py-2 text-center text-sm font-semibold text-foreground transition-colors hover:border-kruxt-accent"
            >
              Preview Draft
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Display name</label>
              <input className={INPUT} value={draft.appDisplayName} onChange={(event) => updateDraft("appDisplayName", event.target.value)} placeholder={gymName} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Support email</label>
              <input className={INPUT} value={draft.supportEmail} onChange={(event) => updateDraft("supportEmail", event.target.value)} placeholder="support@gym.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Logo URL</label>
              <div className="flex gap-2">
                <input className={INPUT} value={draft.logoUrl} onChange={(event) => updateDraft("logoUrl", event.target.value)} placeholder="https://..." />
                <label className="flex cursor-pointer items-center rounded-button border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-kruxt-accent">
                  {uploadingAsset === "logo" ? "..." : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleAssetUpload("logo", "logoUrl", event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon URL</label>
              <div className="flex gap-2">
                <input className={INPUT} value={draft.iconUrl} onChange={(event) => updateDraft("iconUrl", event.target.value)} placeholder="https://..." />
                <label className="flex cursor-pointer items-center rounded-button border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-kruxt-accent">
                  {uploadingAsset === "icon" ? "..." : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleAssetUpload("icon", "iconUrl", event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Banner URL</label>
              <div className="flex gap-2">
                <input className={INPUT} value={draft.bannerUrl} onChange={(event) => updateDraft("bannerUrl", event.target.value)} placeholder="https://..." />
                <label className="flex cursor-pointer items-center rounded-button border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-kruxt-accent">
                  {uploadingAsset === "banner" ? "..." : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleAssetUpload("banner", "bannerUrl", event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Launch screen message</label>
              <textarea className={INPUT} rows={2} value={draft.launchScreenMessage} onChange={(event) => updateDraft("launchScreenMessage", event.target.value)} placeholder="Welcome back. No log, no legend." />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ["primaryColor", "Primary"],
              ["accentColor", "Accent"],
              ["backgroundColor", "Background"],
              ["surfaceColor", "Surface"],
              ["textColor", "Text"]
            ] as const).map(([key, label]) => (
              <label key={key} className="rounded-lg border border-border bg-kruxt-panel/40 p-3">
                <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(event) => updateDraft(key, event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-md border border-border bg-transparent"
                />
                <input
                  value={draft[key]}
                  onChange={(event) => updateDraft(key, event.target.value)}
                  className="mt-2 w-full bg-transparent text-xs text-foreground outline-none font-kruxt-mono"
                />
              </label>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Terms URL</label>
              <input className={INPUT} value={draft.termsUrl} onChange={(event) => updateDraft("termsUrl", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Privacy URL</label>
              <input className={INPUT} value={draft.privacyUrl} onChange={(event) => updateDraft("privacyUrl", event.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="mt-6 rounded-card border border-border bg-kruxt-panel/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Public Plans & Schedule</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose which active plans are visible to new members and whether the public schedule appears.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleAllPlans}
                className="rounded-button border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-kruxt-accent"
              >
                {allPlansSelected ? "Hide All Plans" : "Show All Plans"}
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {plans.length === 0 ? (
                <p className="rounded-card border border-border bg-card p-3 text-sm text-muted-foreground">
                  No active membership plans are available to publish.
                </p>
              ) : (
                plans.map((plan) => {
                  const selected = selectedPlanIds.includes(plan.id);
                  return (
                    <label
                      key={plan.id}
                      className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-foreground">{plan.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatMoney(plan.price_cents, plan.currency)} / {plan.billing_cycle}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePlan(plan.id)}
                        className="h-4 w-4 rounded border-border accent-kruxt-accent"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">Show public class schedule</span>
                <span className="block text-xs text-muted-foreground">
                  Keep this off while staff schedules are still being reviewed.
                </span>
              </span>
              <input
                type="checkbox"
                checked={scheduleVisible}
                onChange={(event) => {
                  setScheduleVisible(event.target.checked);
                  setSuccess(undefined);
                }}
                className="h-4 w-4 rounded border-border accent-kruxt-accent"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => void saveDraft("draft")}
              disabled={saving || publishing}
              className="rounded-button border border-border px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-kruxt-accent disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={publishDraft}
              disabled={saving || publishing}
              className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>

        <aside className="overflow-hidden rounded-card border border-border bg-card">
          <div
            className="h-32 bg-cover bg-center"
            style={{
              backgroundColor: draft.backgroundColor,
              backgroundImage: draft.bannerUrl ? `url(${draft.bannerUrl})` : undefined
            }}
          />
          <div className="p-5" style={{ backgroundColor: draft.surfaceColor, color: draft.textColor }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border"
                style={{ borderColor: draft.primaryColor, backgroundColor: draft.backgroundColor }}
              >
                {draft.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold font-kruxt-headline" style={{ color: draft.primaryColor }}>
                    {(draft.appDisplayName || gymName || "K").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-lg font-bold font-kruxt-headline">{draft.appDisplayName || gymName}</p>
                <p className="text-xs opacity-70">Draft member page</p>
              </div>
            </div>
            <p className="mt-5 text-sm opacity-90">{draft.launchScreenMessage || "No log, no legend."}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: draft.primaryColor, color: draft.backgroundColor }}>
                {selectedPlanIds.length} public plans
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: draft.accentColor, color: draft.backgroundColor }}>
                {scheduleVisible ? "Schedule on" : "Schedule off"}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ["Staff & Roles", "Use the Staff page to plan shifts; Members page assigns PTs and roles."],
          ["Membership Plans", "Create active plans, then decide here which ones are public."],
          ["Security", "MFA, trusted devices, and auth event views are next Phase 10 surfaces."]
        ].map(([title, description]) => (
          <div key={title} className="rounded-card border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Demo Data</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Seed the current gym with BZone-style plans, a four-week class schedule, and the Italian waiver baseline.
            </p>
          </div>
          <button
            onClick={seedBzone}
            disabled={seeding}
            className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed BZone Demo"}
          </button>
        </div>
      </section>
    </div>
  );
}
