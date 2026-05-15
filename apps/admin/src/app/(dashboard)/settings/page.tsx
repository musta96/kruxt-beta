"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import { seedBzoneDemoData } from "@/services";
import type { UpsertGymBrandSettingsInput } from "@kruxt/types";

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
  privacyUrl: "",
};

function compact(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDraft(settings: Awaited<ReturnType<ReturnType<typeof useServices>["customization"]["getGymBrandSettings"]>>): BrandDraft {
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
    privacyUrl: settings.privacyUrl ?? "",
  };
}

export default function SettingsPage() {
  const { gymId, gymName } = useGym();
  const { customization, supabase } = useServices();
  const [draft, setDraft] = useState<BrandDraft>(defaultBrandDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | undefined>();

  const brandState = useAsync(() => customization.getGymBrandSettings(gymId), [gymId]);

  useEffect(() => {
    if (brandState.status === "success") {
      setDraft(toDraft(brandState.data ?? null));
    }
  }, [brandState.data, brandState.status]);

  const updateDraft = (key: keyof BrandDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSuccess(undefined);
  };

  const saveBranding = async () => {
    setSaving(true);
    setSaveError(undefined);
    setSuccess(undefined);
    try {
      const input: UpsertGymBrandSettingsInput = {
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
        privacyUrl: compact(draft.privacyUrl),
      };
      await customization.upsertGymBrandSettings(gymId, input);
      setSuccess("Brand settings saved.");
      brandState.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save brand settings.");
    } finally {
      setSaving(false);
    }
  };

  const seedBzone = async () => {
    setSeeding(true);
    setSaveError(undefined);
    setSeedMessage(undefined);
    try {
      const result = await seedBzoneDemoData(supabase, gymId);
      setSeedMessage(
        `BZone demo ready: ${result.plansUpserted} plans, ${
          result.classesSkipped ? "existing class schedule kept" : `${result.classesCreated} classes`
        }, waiver ${result.waiverUpserted ? "upserted" : "unchanged"}, and billing instructions ${
          result.billingSettingsUpserted ? "upserted" : "unchanged"
        }.`
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to seed BZone demo data.");
    } finally {
      setSeeding(false);
    }
  };

  if (brandState.status === "loading" || brandState.status === "idle") return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure the member-facing gym experience, branding, and operational modules."
      />

      {brandState.status === "error" && <ErrorBanner message={brandState.error} onRetry={brandState.refetch} />}
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
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground font-kruxt-headline">
              Branding & Member Page
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Owners can set the palette, logo, icon, banner, support contact, and launch copy shown to members.
            </p>
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
              <input className={INPUT} value={draft.logoUrl} onChange={(event) => updateDraft("logoUrl", event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Icon URL</label>
              <input className={INPUT} value={draft.iconUrl} onChange={(event) => updateDraft("iconUrl", event.target.value)} placeholder="https://..." />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Banner URL</label>
              <input className={INPUT} value={draft.bannerUrl} onChange={(event) => updateDraft("bannerUrl", event.target.value)} placeholder="https://..." />
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
              ["textColor", "Text"],
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

          <div className="mt-5 flex justify-end">
            <button
              onClick={saveBranding}
              disabled={saving}
              className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Branding"}
            </button>
          </div>
        </div>

        <aside className="overflow-hidden rounded-card border border-border bg-card">
          <div
            className="h-32 bg-cover bg-center"
            style={{
              backgroundColor: draft.backgroundColor,
              backgroundImage: draft.bannerUrl ? `url(${draft.bannerUrl})` : undefined,
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
                <p className="text-xs opacity-70">Member page preview</p>
              </div>
            </div>
            <p className="mt-5 text-sm opacity-90">{draft.launchScreenMessage || "No log, no legend."}</p>
            <div className="mt-5 flex gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: draft.primaryColor, color: draft.backgroundColor }}>
                Primary
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: draft.accentColor, color: draft.backgroundColor }}>
                Accent
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ["Staff & Roles", "Use the Staff page to plan shifts; Members page assigns PTs and roles."],
          ["Membership Plans", "Billing and plan configuration stays behind the billing_live rollout gate."],
          ["Security", "MFA, trusted devices, and auth event views are next Phase 10 surfaces."],
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
