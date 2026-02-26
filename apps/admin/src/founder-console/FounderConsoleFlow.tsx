import React, { useCallback, useEffect, useState } from "react";
import type { SubscriptionStatus } from "@kruxt/types";

import type {
  CreateFounderGymInput,
  FounderConsoleServices,
  FounderGymRecord,
  FounderOwnerOption
} from "./runtime-services";

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "unpaid"
];

export interface FounderConsoleFlowProps {
  services: FounderConsoleServices;
  selectedGymId: string;
  onSelectGym: (gymId: string) => void;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function buildCreateDraft(): CreateFounderGymInput {
  return {
    slug: "",
    name: "",
    city: "",
    countryCode: "IT",
    timezone: "Europe/Rome",
    isPublic: true,
    ownerUserId: "",
    subscriptionStatus: "trialing",
    subscriptionProvider: "manual",
    billingContactEmail: ""
  };
}

export function FounderConsoleFlow({ services, selectedGymId, onSelectGym }: FounderConsoleFlowProps) {
  const [gyms, setGyms] = useState<FounderGymRecord[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<FounderOwnerOption[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<CreateFounderGymInput>(() => buildCreateDraft());
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, SubscriptionStatus>>({});

  const loadGyms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await services.listGyms();
      setGyms(data);
      if (data.length > 0 && !data.some((gym) => gym.id === selectedGymId)) {
        onSelectGym(data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
    }
  }, [onSelectGym, selectedGymId, services]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    setOwnerDrafts((previous) => {
      const next = { ...previous };
      for (const gym of gyms) {
        if (!next[gym.id]) next[gym.id] = gym.ownerUserId;
      }
      return next;
    });

    setSubscriptionDrafts((previous) => {
      const next = { ...previous };
      for (const gym of gyms) {
        if (!next[gym.id]) next[gym.id] = gym.subscriptionStatus;
      }
      return next;
    });
  }, [gyms]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const options = await services.listOwnerOptions(ownerSearch);
        if (!active) return;
        setOwnerOptions(options);
      } catch {
        if (!active) return;
        setOwnerOptions([]);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [ownerSearch, services]);

  const gymStats = React.useMemo(() => {
    return {
      total: gyms.length,
      trialing: gyms.filter((gym) => gym.subscriptionStatus === "trialing").length,
      active: gyms.filter((gym) => gym.subscriptionStatus === "active").length,
      pastDue: gyms.filter((gym) => gym.subscriptionStatus === "past_due").length
    };
  }, [gyms]);

  const runMutation = useCallback(
    async (key: string, mutate: () => Promise<{ ok: boolean; error?: { message: string }; gym?: FounderGymRecord }>) => {
      setPendingKey(key);
      setError(null);
      setSuccess(null);
      try {
        const result = await mutate();
        if (!result.ok) {
          setError(result.error?.message ?? "Action failed.");
          return;
        }
        await loadGyms();
        if (result.gym) {
          setSuccess(`Updated ${result.gym.name}.`);
        } else {
          setSuccess("Action completed.");
        }
      } finally {
        setPendingKey(null);
      }
    },
    [loadGyms]
  );

  const handleCreateGym = async () => {
    const slug = slugify(createDraft.slug || createDraft.name || "");
    if (!slug) {
      setError("Gym slug is required.");
      return;
    }
    if (!createDraft.name?.trim()) {
      setError("Gym name is required.");
      return;
    }

    await runMutation("create_gym", async () => {
      const result = await services.createGym({
        ...createDraft,
        slug,
        name: createDraft.name?.trim() ?? "",
        city: createDraft.city?.trim() || undefined,
        countryCode: createDraft.countryCode?.trim() || undefined,
        timezone: createDraft.timezone?.trim() || "Europe/Rome",
        ownerUserId: createDraft.ownerUserId?.trim() || undefined,
        subscriptionProvider: createDraft.subscriptionProvider?.trim() || "manual",
        billingContactEmail: createDraft.billingContactEmail?.trim() || undefined
      });

      if (result.ok && result.gym) {
        onSelectGym(result.gym.id);
        setCreateDraft(buildCreateDraft());
      }

      return result;
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Founder Gym Provisioning</h1>
        <p className="text-sm text-muted-foreground">
          Create gyms, assign or transfer owners, and set platform subscription state.
        </p>
        <p className="text-xs text-muted-foreground">
          Note: owner must exist in <span className="text-foreground font-semibold">auth.users</span> and have a
          matching <span className="text-foreground font-semibold">public.profiles</span> row.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-destructive text-sm font-semibold">{error}</p>
        </div>
      )}
      {success && (
        <div className="panel border-success/40 bg-success/10 p-3">
          <p className="text-success text-sm font-semibold">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Gyms" value={gymStats.total} />
        <StatCard label="Trialing" value={gymStats.trialing} />
        <StatCard label="Active" value={gymStats.active} />
        <StatCard label="Past Due" value={gymStats.pastDue} />
      </div>

      <div className="panel p-5 space-y-4">
        <h2 className="text-sm font-display font-bold text-foreground">Create Gym</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="input-field"
            placeholder="Gym name"
            value={createDraft.name ?? ""}
            onChange={(event) => {
              const name = event.target.value;
              setCreateDraft((prev) => ({
                ...prev,
                name,
                slug: prev.slug ? prev.slug : slugify(name)
              }));
            }}
          />
          <input
            className="input-field"
            placeholder="Slug"
            value={createDraft.slug ?? ""}
            onChange={(event) =>
              setCreateDraft((prev) => ({ ...prev, slug: slugify(event.target.value) }))
            }
          />
          <input
            className="input-field"
            placeholder="City"
            value={createDraft.city ?? ""}
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, city: event.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Country code"
            value={createDraft.countryCode ?? ""}
            onChange={(event) =>
              setCreateDraft((prev) => ({
                ...prev,
                countryCode: event.target.value.toUpperCase().slice(0, 2)
              }))
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="input-field"
            placeholder="Timezone (Europe/Rome)"
            value={createDraft.timezone ?? ""}
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, timezone: event.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Owner UUID (optional)"
            value={createDraft.ownerUserId ?? ""}
            onChange={(event) => setCreateDraft((prev) => ({ ...prev, ownerUserId: event.target.value }))}
          />
          <select
            className="input-field"
            value={createDraft.subscriptionStatus ?? "trialing"}
            onChange={(event) =>
              setCreateDraft((prev) => ({
                ...prev,
                subscriptionStatus: event.target.value as SubscriptionStatus
              }))
            }
          >
            {SUBSCRIPTION_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary w-auto"
            disabled={pendingKey === "create_gym"}
            onClick={() => {
              void handleCreateGym();
            }}
          >
            {pendingKey === "create_gym" ? "Creating..." : "Create Gym"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="input-field"
            placeholder="Billing contact email (optional)"
            value={createDraft.billingContactEmail ?? ""}
            onChange={(event) =>
              setCreateDraft((prev) => ({ ...prev, billingContactEmail: event.target.value }))
            }
          />
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={createDraft.isPublic ?? true}
              onChange={(event) =>
                setCreateDraft((prev) => ({ ...prev, isPublic: event.target.checked }))
              }
            />
            Public gym listing
          </label>
        </div>
      </div>

      <div className="panel p-4 space-y-2">
        <h3 className="text-sm font-display font-bold text-foreground">Owner Lookup (Profiles)</h3>
        <input
          className="input-field"
          placeholder="Search owners by display name or username"
          value={ownerSearch}
          onChange={(event) => setOwnerSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {ownerOptions.slice(0, 8).map((owner) => (
            <span key={owner.userId} className="badge-steel">
              {owner.label} · {owner.userId.slice(0, 8)}...
            </span>
          ))}
          {ownerOptions.length === 0 && (
            <span className="text-xs text-muted-foreground">No profile candidates returned.</span>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Provisioned Gyms</h2>
          <button type="button" className="btn-compact" onClick={() => { void loadGyms(); }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Location</th>
                <th>Owner</th>
                <th>Subscription</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gyms.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                    No gyms yet.
                  </td>
                </tr>
              )}
              {gyms.map((gym) => {
                const ownerDraft = ownerDrafts[gym.id] ?? gym.ownerUserId;
                const subscriptionDraft = subscriptionDrafts[gym.id] ?? gym.subscriptionStatus;
                const selected = gym.id === selectedGymId;

                return (
                  <tr key={gym.id} className={selected ? "bg-muted/30" : ""}>
                    <td>
                      <div className="font-semibold text-foreground">{gym.name}</div>
                      <div className="text-xs text-muted-foreground">{gym.slug} · {gym.id.slice(0, 8)}...</div>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {gym.city ?? "—"}
                      {gym.countryCode ? `, ${gym.countryCode}` : ""}
                      <div>{gym.timezone}</div>
                    </td>
                    <td>
                      <div className="text-xs text-muted-foreground mb-1">{gym.ownerLabel}</div>
                      <input
                        className="input-field"
                        value={ownerDraft}
                        onChange={(event) =>
                          setOwnerDrafts((prev) => ({ ...prev, [gym.id]: event.target.value }))
                        }
                        placeholder="Owner UUID"
                      />
                    </td>
                    <td>
                      <div className="text-xs text-muted-foreground mb-1">Provider: {gym.subscriptionProvider}</div>
                      <select
                        className="input-field"
                        value={subscriptionDraft}
                        onChange={(event) =>
                          setSubscriptionDrafts((prev) => ({
                            ...prev,
                            [gym.id]: event.target.value as SubscriptionStatus
                          }))
                        }
                      >
                        {SUBSCRIPTION_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="btn-compact"
                          onClick={() => onSelectGym(gym.id)}
                        >
                          {selected ? "Selected" : "Use in Admin"}
                        </button>
                        <button
                          type="button"
                          className="btn-compact"
                          disabled={pendingKey === `owner_${gym.id}`}
                          onClick={() => {
                            void runMutation(`owner_${gym.id}`, () =>
                              services.assignGymOwner(gym.id, ownerDraft)
                            );
                          }}
                        >
                          {pendingKey === `owner_${gym.id}` ? "Saving..." : "Set Owner"}
                        </button>
                        <button
                          type="button"
                          className="btn-compact"
                          disabled={pendingKey === `sub_${gym.id}`}
                          onClick={() => {
                            void runMutation(`sub_${gym.id}`, () =>
                              services.upsertGymSubscription(gym.id, {
                                status: subscriptionDraft,
                                provider: gym.subscriptionProvider
                              })
                            );
                          }}
                        >
                          {pendingKey === `sub_${gym.id}` ? "Saving..." : "Save Subscription"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
