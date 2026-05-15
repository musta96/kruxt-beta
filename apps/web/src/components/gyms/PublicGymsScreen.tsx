"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { broadcastPublicSessionRefresh, usePublicSession } from "@/components/public/usePublicSession";
import { ensureProfileForUser } from "@/lib/auth/access";
import {
  listPublicGyms,
  requestPublicGymAccess,
  type PublicGymDirectoryItem,
  type PublicGymPlan
} from "@/lib/public/gyms";

function formatMoney(plan: PublicGymPlan): string {
  const amount = plan.priceCents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
}

function locationLabel(gym: PublicGymDirectoryItem): string {
  return [gym.city, gym.countryCode].filter(Boolean).join(", ") || "Online";
}

function statusLabel(gym: PublicGymDirectoryItem): string {
  if (gym.membership?.status === "active" || gym.membership?.status === "trial") return "Access ready";
  if (gym.membership?.status === "pending" || gym.latestRequest?.status === "pending") return "Pending approval";
  if (gym.membership?.status === "paused") return "Paused";
  if (gym.latestRequest?.status === "rejected") return "Rejected";
  return "Open";
}

function canRequest(gym: PublicGymDirectoryItem): boolean {
  if (gym.membership?.status === "active" || gym.membership?.status === "trial") return false;
  if (gym.membership?.status === "pending" || gym.latestRequest?.status === "pending") return false;
  return true;
}

export function PublicGymsScreen() {
  const { state, supabase } = usePublicSession();
  const [gyms, setGyms] = useState<PublicGymDirectoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [requestingGymId, setRequestingGymId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadGyms = useCallback(async () => {
    if (!state.user) return;

    setLoading(true);
    setError(null);

    try {
      const nextGyms = await listPublicGyms(supabase);
      setGyms(nextGyms);
      setSelectedPlans((current) => {
        const next = { ...current };
        for (const gym of nextGyms) {
          if (typeof next[gym.id] === "undefined") {
            next[gym.id] = gym.plans[0]?.id ?? "";
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
    }
  }, [state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadGyms();
  }, [loadGyms, state.status, state.user]);

  const filteredGyms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return gyms;

    return gyms.filter((gym) =>
      [gym.name, gym.brand?.displayName, gym.motto, gym.description, gym.city, gym.countryCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [gyms, query]);

  async function handleRequest(gym: PublicGymDirectoryItem) {
    if (!state.user) return;

    setRequestingGymId(gym.id);
    setError(null);
    setSuccess(null);

    try {
      if (!state.profile) {
        await ensureProfileForUser(supabase, {
          userId: state.user.id,
          email: state.user.email ?? "member@kruxt.local",
          username: state.user.email?.split("@")[0],
          displayName: state.user.email?.split("@")[0]
        });
        broadcastPublicSessionRefresh();
      }

      await requestPublicGymAccess(supabase, {
        gymId: gym.id,
        membershipPlanId: selectedPlans[gym.id] || null,
        note: notes[gym.id] ?? null
      });

      setSuccess(`Request sent to ${gym.brand?.displayName || gym.name}. Staff can now approve you from their dashboard.`);
      await loadGyms();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request gym access.");
    } finally {
      setRequestingGymId(null);
    }
  }

  return (
    <MemberShell
      title="Gyms"
      subtitle="Find a public gym, choose the membership plan you want, and request access to its private KRUXT area."
    >
      <section className="glass-panel">
        <div className="profile-form-header">
          <div>
            <p className="eyebrow">DISCOVER</p>
            <h2 className="section-title">Public gyms</h2>
          </div>
          <button type="button" className="secondary-cta" onClick={() => void loadGyms()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by gym name, city, or description"
        />

        {error ? <div className="status-banner status-danger">{error}</div> : null}
        {success ? <div className="status-banner status-success">{success}</div> : null}
      </section>

      {loading ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-body">Loading public gyms...</p>
          </article>
        </section>
      ) : filteredGyms.length === 0 ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-title">No gyms found</p>
            <p className="feed-body">Try a different search, or ask the gym for an invite link or QR code.</p>
          </article>
        </section>
      ) : (
        <section className="rank-list">
          {filteredGyms.map((gym) => {
            const brand = gym.brand;
            const displayName = brand?.displayName || gym.name;
            const banner = brand?.bannerUrl || gym.bannerUrl;
            const logo = brand?.logoUrl || brand?.iconUrl || gym.sigilUrl;
            const requesting = requestingGymId === gym.id;
            const requestEnabled = canRequest(gym);

            return (
              <article key={gym.id} className="feed-card">
                {banner ? <img src={banner} alt="" className="gym-card-banner" /> : null}
                <div className="profile-form-header">
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      className="avatar-preview"
                      style={{
                        width: 56,
                        height: 56,
                        background: brand?.surfaceColor || undefined,
                        color: brand?.textColor || undefined,
                        borderColor: brand?.primaryColor || undefined
                      }}
                    >
                      {logo ? (
                        <img src={logo} alt="" className="avatar-preview-image" />
                      ) : (
                        <span className="avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="eyebrow">{locationLabel(gym)}</p>
                      <h2 className="section-title">{displayName}</h2>
                      <p className="section-copy">{gym.motto || brand?.launchMessage || gym.description || "Open for member requests."}</p>
                    </div>
                  </div>
                  <span className="ghost-chip">{statusLabel(gym)}</span>
                </div>

                <div className="split-card" style={{ marginTop: 16 }}>
                  <div>
                    <label className="label" htmlFor={`plan-${gym.id}`}>Membership plan</label>
                    <select
                      id={`plan-${gym.id}`}
                      className="input"
                      value={selectedPlans[gym.id] ?? ""}
                      onChange={(event) =>
                        setSelectedPlans((current) => ({ ...current, [gym.id]: event.target.value }))
                      }
                      disabled={!requestEnabled || gym.plans.length === 0}
                    >
                      {gym.plans.length === 0 ? (
                        <option value="">No public plan selected</option>
                      ) : (
                        gym.plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} / {formatMoney(plan)} / {plan.billingCycle}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor={`note-${gym.id}`}>Message to staff</label>
                    <input
                      id={`note-${gym.id}`}
                      className="input"
                      value={notes[gym.id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [gym.id]: event.target.value }))}
                      placeholder="Optional: goals, plan preference, or referral"
                      disabled={!requestEnabled}
                    />
                  </div>
                </div>

                <div className="stack-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="primary-cta"
                    onClick={() => void handleRequest(gym)}
                    disabled={!requestEnabled || requesting}
                  >
                    {requesting ? "Sending..." : requestEnabled ? "Request access" : statusLabel(gym)}
                  </button>
                  {gym.latestRequest?.status === "rejected" ? (
                    <span className="feed-body">Previous request was rejected. You can send a new one.</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </MemberShell>
  );
}
