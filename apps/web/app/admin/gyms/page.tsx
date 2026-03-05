"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionStatus } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import { createGym, listGyms, type GymRecord } from "@/lib/admin/data";

const SUBSCRIPTION_OPTIONS: SubscriptionStatus[] = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "unpaid"
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export default function AdminGymsPage() {
  const { access, supabase, signOut, canManageGyms } = useAdminAccess();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gyms, setGyms] = useState<GymRecord[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("IT");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("trialing");

  const canLoad = access.isAuthenticated && canManageGyms;

  const load = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const next = await listGyms(supabase);
      setGyms(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
    }
  }, [canLoad, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateGym() {
    if (!name.trim()) {
      setError("Gym name is required.");
      return;
    }

    const finalSlug = slugify(slug || name);
    if (!finalSlug) {
      setError("Gym slug is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createGym(supabase, {
        name,
        slug: finalSlug,
        city,
        countryCode,
        timezone,
        ownerUserId,
        subscriptionStatus
      });
      setSuccess(`Created ${name.trim()}.`);
      setName("");
      setSlug("");
      setCity("");
      setOwnerUserId("");
      setSubscriptionStatus("trialing");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create gym.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      access={access}
      onSignOut={signOut}
      title="Gyms"
      subtitle="Founder-only gym provisioning and ownership controls"
    >
      {!canManageGyms ? (
        <div className="panel" style={{ maxWidth: 760 }}>
          <h2 style={{ marginTop: 0 }}>Founder access required</h2>
          <p className="subheading">Only platform founders can access gym provisioning.</p>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Create gym</h3>
            <div className="grid grid-2">
              <div>
                <label className="label" htmlFor="gym-name">Gym name</label>
                <input
                  id="gym-name"
                  className="input"
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setName(nextName);
                    if (!slug) setSlug(slugify(nextName));
                  }}
                  placeholder="BZone Pavia"
                />
              </div>
              <div>
                <label className="label" htmlFor="gym-slug">Slug</label>
                <input
                  id="gym-slug"
                  className="input"
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                  placeholder="bzone-pavia"
                />
              </div>
              <div>
                <label className="label" htmlFor="gym-city">City</label>
                <input id="gym-city" className="input" value={city} onChange={(event) => setCity(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="gym-country">Country code</label>
                <input
                  id="gym-country"
                  className="input"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))}
                />
              </div>
              <div>
                <label className="label" htmlFor="gym-timezone">Timezone</label>
                <input
                  id="gym-timezone"
                  className="input"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="gym-owner">Owner user UUID (optional)</label>
                <input
                  id="gym-owner"
                  className="input"
                  value={ownerUserId}
                  onChange={(event) => setOwnerUserId(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="gym-subscription">Subscription status</label>
                <select
                  id="gym-subscription"
                  className="input"
                  value={subscriptionStatus}
                  onChange={(event) => setSubscriptionStatus(event.target.value as SubscriptionStatus)}
                >
                  {SUBSCRIPTION_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={saving} onClick={() => void handleCreateGym()}>
                {saving ? "Creating..." : "Create gym"}
              </button>
            </div>
          </div>

          {error && <div className="panel" style={{ marginBottom: 12, color: "#ff9baa" }}>{error}</div>}
          {success && <div className="panel" style={{ marginBottom: 12, color: "#7ef5df" }}>{success}</div>}

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Provisioned gyms</h3>
              <button className="btn" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px" }}>Gym</th>
                    <th style={{ padding: "8px" }}>Location</th>
                    <th style={{ padding: "8px" }}>Owner</th>
                    <th style={{ padding: "8px" }}>Subscription</th>
                    <th style={{ padding: "8px" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {gyms.map((gym) => (
                    <tr key={gym.id} style={{ borderBottom: "1px solid #10243d" }}>
                      <td style={{ padding: "8px" }}>
                        <div style={{ fontWeight: 700 }}>{gym.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>{gym.slug}</div>
                      </td>
                      <td style={{ padding: "8px", color: "var(--muted)" }}>
                        {gym.city ?? "—"}{gym.countryCode ? `, ${gym.countryCode}` : ""}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <div>{gym.ownerLabel}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>{gym.ownerUserId.slice(0, 8)}...</div>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span className="badge badge-founder">{gym.subscriptionStatus}</span>
                      </td>
                      <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(gym.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {gyms.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} style={{ padding: "12px", color: "var(--muted)", textAlign: "center" }}>
                        No gyms found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
