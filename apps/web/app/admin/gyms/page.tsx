"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubscriptionStatus } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import {
  createGym,
  deleteGym,
  listGyms,
  updateGym,
  verifyCurrentUserPassword,
  type GymRecord
} from "@/lib/admin/data";

const SUBSCRIPTION_OPTIONS: SubscriptionStatus[] = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "unpaid"
];

type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  italy: "IT",
  italia: "IT",
  "united states": "US",
  usa: "US",
  germany: "DE",
  deutschland: "DE",
  france: "FR",
  spain: "ES",
  portugal: "PT",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB"
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function parseCityCountry(description: string): { city?: string; countryCode?: string } {
  const parts = description
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const city = parts.length >= 2 ? parts[1] : undefined;
  const last = parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";
  const countryCode =
    last.length === 2 ? last.toUpperCase() : COUNTRY_NAME_TO_CODE[last] ?? undefined;

  return { city, countryCode };
}

export default function AdminGymsPage() {
  const { access, supabase, signOut } = useAdminAccess();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gyms, setGyms] = useState<GymRecord[]>([]);

  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createCity, setCreateCity] = useState("");
  const [createCountryCode, setCreateCountryCode] = useState("IT");
  const [createTimezone, setCreateTimezone] = useState("Europe/Rome");
  const [createOwnerUserId, setCreateOwnerUserId] = useState("");
  const [createSubscriptionStatus, setCreateSubscriptionStatus] =
    useState<SubscriptionStatus>("trialing");

  const [selectedGymId, setSelectedGymId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("");
  const [editTimezone, setEditTimezone] = useState("Europe/Rome");
  const [editOwnerUserId, setEditOwnerUserId] = useState("");
  const [editSubscriptionStatus, setEditSubscriptionStatus] =
    useState<SubscriptionStatus>("trialing");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteSlugConfirm, setDeleteSlugConfirm] = useState("");

  const [gymLookup, setGymLookup] = useState("");
  const [gymLookupSuggestions, setGymLookupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressLookup, setAddressLookup] = useState("");
  const [addressLookupSuggestions, setAddressLookupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesHint, setPlacesHint] = useState<string | null>(null);

  const canLoad = access.isAuthenticated && access.platformRole === "founder";

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? null,
    [gyms, selectedGymId]
  );

  const load = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const next = await listGyms(supabase);
      setGyms(next);
      setSelectedGymId((current) => {
        if (next.some((gym) => gym.id === current)) return current;
        return next[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
    }
  }, [canLoad, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedGym) return;
    setEditName(selectedGym.name);
    setEditSlug(selectedGym.slug);
    setEditCity(selectedGym.city ?? "");
    setEditCountryCode(selectedGym.countryCode ?? "");
    setEditTimezone(selectedGym.timezone);
    setEditOwnerUserId(selectedGym.ownerUserId);
    setEditSubscriptionStatus(selectedGym.subscriptionStatus);
    setDeleteSlugConfirm("");
    setDeletePassword("");
  }, [selectedGym]);

  useEffect(() => {
    const query = gymLookup.trim();
    if (query.length < 2) {
      setGymLookupSuggestions([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}&mode=establishment`);
        const payload = (await response.json()) as { suggestions?: PlaceSuggestion[]; error?: string };
        if (response.ok) {
          setGymLookupSuggestions(payload.suggestions ?? []);
          setPlacesHint(null);
        } else {
          setGymLookupSuggestions([]);
          if (payload.error === "google_key_missing") {
            setPlacesHint("Set GOOGLE_PLACES_API_KEY to enable Google suggestions.");
          }
        }
      } catch {
        setGymLookupSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [gymLookup]);

  useEffect(() => {
    const query = addressLookup.trim();
    if (query.length < 2) {
      setAddressLookupSuggestions([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}&mode=address`);
        const payload = (await response.json()) as { suggestions?: PlaceSuggestion[]; error?: string };
        if (response.ok) {
          setAddressLookupSuggestions(payload.suggestions ?? []);
          setPlacesHint(null);
        } else {
          setAddressLookupSuggestions([]);
          if (payload.error === "google_key_missing") {
            setPlacesHint("Set GOOGLE_PLACES_API_KEY to enable Google suggestions.");
          }
        }
      } catch {
        setAddressLookupSuggestions([]);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [addressLookup]);

  function applyLookupSuggestion(description: string, target: "create" | "edit", fallbackName?: string) {
    const { city, countryCode } = parseCityCountry(description);
    if (target === "create") {
      if (fallbackName && !createName.trim()) {
        setCreateName(fallbackName);
        if (!createSlug.trim()) setCreateSlug(slugify(fallbackName));
      }
      if (city && !createCity.trim()) setCreateCity(city);
      if (countryCode && !createCountryCode.trim()) setCreateCountryCode(countryCode);
    } else {
      if (fallbackName && !editName.trim()) {
        setEditName(fallbackName);
        if (!editSlug.trim()) setEditSlug(slugify(fallbackName));
      }
      if (city && !editCity.trim()) setEditCity(city);
      if (countryCode && !editCountryCode.trim()) setEditCountryCode(countryCode);
    }
  }

  async function handleCreateGym() {
    if (!createName.trim()) {
      setError("Gym name is required.");
      return;
    }

    const finalSlug = slugify(createSlug || createName);
    if (!finalSlug) {
      setError("Gym slug is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createGym(supabase, {
        name: createName,
        slug: finalSlug,
        city: createCity,
        countryCode: createCountryCode,
        timezone: createTimezone,
        ownerUserId: createOwnerUserId,
        subscriptionStatus: createSubscriptionStatus
      });
      setSuccess(`Created ${createName.trim()}.`);
      setCreateName("");
      setCreateSlug("");
      setCreateCity("");
      setCreateOwnerUserId("");
      setCreateSubscriptionStatus("trialing");
      setGymLookup("");
      setAddressLookup("");
      setGymLookupSuggestions([]);
      setAddressLookupSuggestions([]);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create gym.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGymEdits() {
    if (!selectedGymId || !selectedGym) return;
    if (!editName.trim()) {
      setError("Gym name is required.");
      return;
    }

    const finalSlug = slugify(editSlug || editName);
    if (!finalSlug) {
      setError("Gym slug is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateGym(supabase, selectedGymId, {
        name: editName,
        slug: finalSlug,
        city: editCity,
        countryCode: editCountryCode,
        timezone: editTimezone,
        ownerUserId: editOwnerUserId,
        subscriptionStatus: editSubscriptionStatus
      });
      setSuccess(`Updated ${editName.trim()}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update gym.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGym() {
    if (!selectedGymId || !selectedGym) return;
    if (deleteSlugConfirm.trim() !== selectedGym.slug) {
      setError(`Type the gym slug exactly (${selectedGym.slug}) to confirm delete.`);
      return;
    }
    if (!deletePassword.trim()) {
      setError("Enter your password to confirm deletion.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await verifyCurrentUserPassword(supabase, deletePassword);
      await deleteGym(supabase, selectedGymId);
      setSuccess(`Deleted ${selectedGym.name}.`);
      setDeletePassword("");
      setDeleteSlugConfirm("");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete gym.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      access={access}
      scope="founder"
      onSignOut={signOut}
      title="Gyms"
      subtitle="Founder-only gym provisioning, updates, and deletion controls"
    >
      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Google quick lookup (optional)</h3>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor="gym-lookup">Search gym name (Google)</label>
            <input
              id="gym-lookup"
              className="input"
              value={gymLookup}
              onChange={(event) => setGymLookup(event.target.value)}
              placeholder="BZone Fitness"
            />
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {gymLookupSuggestions.map((item) => (
                <button
                  type="button"
                  key={item.placeId}
                  className="btn"
                  onClick={() => {
                    const fallbackName = item.mainText || item.description.split(",")[0] || "";
                    applyLookupSuggestion(item.description, "create", fallbackName);
                    applyLookupSuggestion(item.description, "edit", fallbackName);
                    setGymLookup(item.description);
                    setGymLookupSuggestions([]);
                  }}
                >
                  {item.description}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address-lookup">Search address (Google)</label>
            <input
              id="address-lookup"
              className="input"
              value={addressLookup}
              onChange={(event) => setAddressLookup(event.target.value)}
              placeholder="Via Brambilla 16, Pavia"
            />
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {addressLookupSuggestions.map((item) => (
                <button
                  type="button"
                  key={item.placeId}
                  className="btn"
                  onClick={() => {
                    applyLookupSuggestion(item.description, "create");
                    applyLookupSuggestion(item.description, "edit");
                    setAddressLookup(item.description);
                    setAddressLookupSuggestions([]);
                  }}
                >
                  {item.description}
                </button>
              ))}
            </div>
          </div>
        </div>
        {placesHint && <p style={{ color: "#ffd588", marginTop: 10 }}>{placesHint}</p>}
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Create gym</h3>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor="create-name">Gym name</label>
            <input
              id="create-name"
              className="input"
              value={createName}
              onChange={(event) => {
                const nextName = event.target.value;
                setCreateName(nextName);
                if (!createSlug) setCreateSlug(slugify(nextName));
              }}
              placeholder="BZone Fitness"
            />
          </div>
          <div>
            <label className="label" htmlFor="create-slug">Slug</label>
            <input
              id="create-slug"
              className="input"
              value={createSlug}
              onChange={(event) => setCreateSlug(slugify(event.target.value))}
              placeholder="bzone-fitness"
            />
          </div>
          <div>
            <label className="label" htmlFor="create-city">City</label>
            <input
              id="create-city"
              className="input"
              value={createCity}
              onChange={(event) => setCreateCity(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="create-country">Country code</label>
            <input
              id="create-country"
              className="input"
              value={createCountryCode}
              onChange={(event) => setCreateCountryCode(event.target.value.toUpperCase().slice(0, 2))}
            />
          </div>
          <div>
            <label className="label" htmlFor="create-timezone">Timezone</label>
            <input
              id="create-timezone"
              className="input"
              value={createTimezone}
              onChange={(event) => setCreateTimezone(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="create-owner">Owner user UUID (optional)</label>
            <input
              id="create-owner"
              className="input"
              value={createOwnerUserId}
              onChange={(event) => setCreateOwnerUserId(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="create-subscription">Subscription status</label>
            <select
              id="create-subscription"
              className="input"
              value={createSubscriptionStatus}
              onChange={(event) => setCreateSubscriptionStatus(event.target.value as SubscriptionStatus)}
            >
              {SUBSCRIPTION_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" disabled={saving} onClick={() => void handleCreateGym()}>
            {saving ? "Saving..." : "Create gym"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Edit selected gym</h3>
        {!selectedGym ? (
          <p className="subheading">Select a gym from the table below.</p>
        ) : (
          <>
            <div className="grid grid-2">
              <div>
                <label className="label" htmlFor="edit-name">Gym name</label>
                <input id="edit-name" className="input" value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="edit-slug">Slug</label>
                <input id="edit-slug" className="input" value={editSlug} onChange={(event) => setEditSlug(slugify(event.target.value))} />
              </div>
              <div>
                <label className="label" htmlFor="edit-city">City</label>
                <input id="edit-city" className="input" value={editCity} onChange={(event) => setEditCity(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="edit-country">Country code</label>
                <input
                  id="edit-country"
                  className="input"
                  value={editCountryCode}
                  onChange={(event) => setEditCountryCode(event.target.value.toUpperCase().slice(0, 2))}
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-timezone">Timezone</label>
                <input id="edit-timezone" className="input" value={editTimezone} onChange={(event) => setEditTimezone(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="edit-owner">Owner user UUID</label>
                <input id="edit-owner" className="input" value={editOwnerUserId} onChange={(event) => setEditOwnerUserId(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="edit-subscription">Subscription status</label>
                <select
                  id="edit-subscription"
                  className="input"
                  value={editSubscriptionStatus}
                  onChange={(event) => setEditSubscriptionStatus(event.target.value as SubscriptionStatus)}
                >
                  {SUBSCRIPTION_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={saving} onClick={() => void handleSaveGymEdits()}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h4 style={{ marginTop: 0, color: "#ff9baa" }}>Delete gym (protected)</h4>
              <p className="subheading">
                To prevent accidents, enter your password and type the slug <strong>{selectedGym.slug}</strong>.
              </p>
              <div className="grid grid-2">
                <div>
                  <label className="label" htmlFor="delete-slug-confirm">Confirm slug</label>
                  <input
                    id="delete-slug-confirm"
                    className="input"
                    value={deleteSlugConfirm}
                    onChange={(event) => setDeleteSlugConfirm(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="delete-password">Your password</label>
                  <input
                    id="delete-password"
                    type="password"
                    className="input"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-danger" disabled={saving} onClick={() => void handleDeleteGym()}>
                  {saving ? "Deleting..." : "Delete gym"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {error && <div className="panel" style={{ marginBottom: 12, color: "#ff9baa" }}>{error}</div>}
      {success && <div className="panel" style={{ marginBottom: 12, color: "#7ef5df" }}>{success}</div>}

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Provisioned gyms</h3>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
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
                <th style={{ padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => (
                <tr
                  key={gym.id}
                  style={{
                    borderBottom: "1px solid #10243d",
                    background: selectedGymId === gym.id ? "rgba(53,200,255,0.08)" : "transparent"
                  }}
                >
                  <td style={{ padding: "8px" }}>
                    <div style={{ fontWeight: 700 }}>{gym.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{gym.slug}</div>
                  </td>
                  <td style={{ padding: "8px", color: "var(--muted)" }}>
                    {gym.city ?? "—"}
                    {gym.countryCode ? `, ${gym.countryCode}` : ""}
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
                  <td style={{ padding: "8px" }}>
                    <button className="btn" onClick={() => setSelectedGymId(gym.id)}>
                      {selectedGymId === gym.id ? "Selected" : "Select"}
                    </button>
                  </td>
                </tr>
              ))}
              {gyms.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ padding: "12px", color: "var(--muted)", textAlign: "center" }}>
                    No gyms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
