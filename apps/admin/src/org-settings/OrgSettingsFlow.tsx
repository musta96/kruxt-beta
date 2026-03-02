import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FounderComplianceProfile,
  FounderConsoleServices,
  FounderGymRecord,
  UpdateFounderGymInput
} from "../founder-console/runtime-services";

export interface OrgSettingsFlowProps {
  gymId: string;
  services: FounderConsoleServices;
}

function buildProfileDraft(gym: FounderGymRecord): UpdateFounderGymInput {
  return {
    slug: gym.slug,
    name: gym.name,
    city: gym.city ?? "",
    countryCode: gym.countryCode ?? "",
    timezone: gym.timezone,
    isPublic: gym.isPublic,
    motto: gym.motto ?? "",
    description: gym.description ?? "",
    bannerUrl: gym.bannerUrl ?? "",
    sigilUrl: gym.sigilUrl ?? ""
  };
}

function buildComplianceDraft(gym: FounderGymRecord): FounderComplianceProfile {
  return {
    countryCode: gym.complianceProfile?.countryCode ?? gym.countryCode ?? "IT",
    legalEntityName: gym.complianceProfile?.legalEntityName ?? gym.name,
    defaultCurrency: gym.complianceProfile?.defaultCurrency ?? "EUR",
    locale: gym.complianceProfile?.locale ?? "it-IT",
    invoiceScheme: gym.complianceProfile?.invoiceScheme ?? "standard",
    vatNumber: gym.complianceProfile?.vatNumber ?? "",
    taxCode: gym.complianceProfile?.taxCode ?? "",
    taxRegime: gym.complianceProfile?.taxRegime ?? "",
    registrationNumber: gym.complianceProfile?.registrationNumber ?? "",
    pecEmail: gym.complianceProfile?.pecEmail ?? "",
    sdiDestinationCode: gym.complianceProfile?.sdiDestinationCode ?? ""
  };
}

export function OrgSettingsFlow({ gymId, services }: OrgSettingsFlowProps) {
  const [gyms, setGyms] = useState<FounderGymRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<UpdateFounderGymInput | null>(null);
  const [complianceDraft, setComplianceDraft] = useState<FounderComplianceProfile | null>(null);

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === gymId) ?? null,
    [gymId, gyms]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextGyms = await services.listGyms();
      setGyms(nextGyms);
      const gym = nextGyms.find((item) => item.id === gymId) ?? null;
      setProfileDraft(gym ? buildProfileDraft(gym) : null);
      setComplianceDraft(gym ? buildComplianceDraft(gym) : null);
      if (!gym) {
        setError("Selected gym was not found.");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load organization settings.");
    } finally {
      setLoading(false);
    }
  }, [gymId, services]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<{ ok: boolean; gym?: FounderGymRecord; error?: { message: string } }>,
      successMessage: string
    ) => {
      setPendingKey(key);
      setError(null);
      setSuccess(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error?.message ?? "Unable to save changes.");
          return;
        }
        setSuccess(successMessage);
        await load();
      } finally {
        setPendingKey(null);
      }
    },
    [load]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-5">
          <div className="skeleton h-5 w-60" />
          <div className="skeleton h-4 w-96 mt-3" />
        </div>
      </div>
    );
  }

  if (!selectedGym || !profileDraft || !complianceDraft) {
    return (
      <div className="p-6">
        <div className="panel border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-semibold">
            {error ?? "Unable to load organization settings."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update the public gym profile, operational details, and compliance metadata for this organization.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm text-destructive font-semibold">{error}</p>
        </div>
      )}

      {success && (
        <div className="panel border-success/40 bg-success/10 p-3">
          <p className="text-sm text-success font-semibold">{success}</p>
        </div>
      )}

      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Public Gym Profile</h2>
          <button
            type="button"
            className="btn-primary w-auto"
            disabled={pendingKey === "save_profile"}
            onClick={() => {
              if (!profileDraft.name?.trim()) {
                setError("Gym name is required.");
                return;
              }
              if (!profileDraft.slug?.trim()) {
                setError("Gym slug is required.");
                return;
              }
              void run(
                "save_profile",
                () =>
                  services.updateGym(gymId, {
                    ...profileDraft,
                    name: profileDraft.name?.trim(),
                    slug: profileDraft.slug?.trim(),
                    countryCode: profileDraft.countryCode?.trim().toUpperCase() || undefined
                  }),
                "Gym profile updated."
              );
            }}
          >
            {pendingKey === "save_profile" ? "Saving..." : "Save Profile"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input-field"
            value={profileDraft.name ?? ""}
            placeholder="Gym name"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), name: event.target.value }))}
          />
          <input
            className="input-field"
            value={profileDraft.slug ?? ""}
            placeholder="Slug"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), slug: event.target.value }))}
          />
          <input
            className="input-field"
            value={profileDraft.motto ?? ""}
            placeholder="Motto"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), motto: event.target.value }))}
          />
          <input
            className="input-field"
            value={profileDraft.city ?? ""}
            placeholder="City"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), city: event.target.value }))}
          />
          <input
            className="input-field"
            value={profileDraft.countryCode ?? ""}
            placeholder="Country code"
            onChange={(event) =>
              setProfileDraft((prev) => ({
                ...(prev ?? {}),
                countryCode: event.target.value.toUpperCase().slice(0, 2)
              }))
            }
          />
          <input
            className="input-field"
            value={profileDraft.timezone ?? ""}
            placeholder="Timezone"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), timezone: event.target.value }))}
          />
        </div>

        <textarea
          className="input-field min-h-[112px]"
          value={profileDraft.description ?? ""}
          placeholder="Public description"
          onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), description: event.target.value }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="input-field"
            value={profileDraft.bannerUrl ?? ""}
            placeholder="Banner image URL"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), bannerUrl: event.target.value }))}
          />
          <input
            className="input-field"
            value={profileDraft.sigilUrl ?? ""}
            placeholder="Sigil / logo URL"
            onChange={(event) => setProfileDraft((prev) => ({ ...(prev ?? {}), sigilUrl: event.target.value }))}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={profileDraft.isPublic ?? true}
            onChange={(event) =>
              setProfileDraft((prev) => ({ ...(prev ?? {}), isPublic: event.target.checked }))
            }
          />
          Public gym listing
        </label>
      </div>

      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Compliance & Legal</h2>
          <button
            type="button"
            className="btn-primary w-auto"
            disabled={pendingKey === "save_compliance"}
            onClick={() => {
              if (!complianceDraft.legalEntityName.trim()) {
                setError("Legal entity name is required.");
                return;
              }
              void run(
                "save_compliance",
                () =>
                  services.upsertComplianceProfile(gymId, {
                    ...complianceDraft,
                    countryCode: complianceDraft.countryCode.trim().toUpperCase() || "IT",
                    legalEntityName: complianceDraft.legalEntityName.trim(),
                    defaultCurrency: complianceDraft.defaultCurrency.trim().toUpperCase() || "EUR",
                    locale: complianceDraft.locale.trim() || "it-IT",
                    invoiceScheme: complianceDraft.invoiceScheme.trim() || "standard"
                  }),
                "Compliance profile updated."
              );
            }}
          >
            {pendingKey === "save_compliance" ? "Saving..." : "Save Compliance"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input-field"
            value={complianceDraft.legalEntityName}
            placeholder="Legal entity name"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, legalEntityName: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.countryCode}
            placeholder="Country code"
            onChange={(event) =>
              setComplianceDraft((prev) =>
                prev ? { ...prev, countryCode: event.target.value.toUpperCase().slice(0, 2) } : prev
              )
            }
          />
          <input
            className="input-field"
            value={complianceDraft.defaultCurrency}
            placeholder="Currency"
            onChange={(event) =>
              setComplianceDraft((prev) =>
                prev ? { ...prev, defaultCurrency: event.target.value.toUpperCase().slice(0, 3) } : prev
              )
            }
          />
          <input
            className="input-field"
            value={complianceDraft.locale}
            placeholder="Locale"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, locale: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.invoiceScheme}
            placeholder="Invoice scheme"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, invoiceScheme: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.registrationNumber ?? ""}
            placeholder="Registration number"
            onChange={(event) =>
              setComplianceDraft((prev) =>
                prev ? { ...prev, registrationNumber: event.target.value } : prev
              )
            }
          />
          <input
            className="input-field"
            value={complianceDraft.vatNumber ?? ""}
            placeholder="VAT number"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, vatNumber: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.taxCode ?? ""}
            placeholder="Tax code"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, taxCode: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.taxRegime ?? ""}
            placeholder="Tax regime"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, taxRegime: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.pecEmail ?? ""}
            placeholder="PEC email"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, pecEmail: event.target.value } : prev)
            }
          />
          <input
            className="input-field"
            value={complianceDraft.sdiDestinationCode ?? ""}
            placeholder="SDI destination code"
            onChange={(event) =>
              setComplianceDraft((prev) => prev ? { ...prev, sdiDestinationCode: event.target.value } : prev)
            }
          />
        </div>
      </div>
    </div>
  );
}
