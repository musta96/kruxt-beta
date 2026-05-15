"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { createAdminSupabaseClient } from "@/services";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function GymOnboardingForm() {
  const { user, signOut } = useAuth();
  const { refresh } = useGym();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gymName, setGymName] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("IT");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const computedSlug = useMemo(
    () => (slugDirty ? slugInput : slugify(gymName)),
    [slugDirty, slugInput, gymName]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("You must be signed in.");
      return;
    }
    if (!username.trim() || !displayName.trim() || !gymName.trim() || !computedSlug) {
      setError("Username, display name, gym name and slug are all required.");
      return;
    }
    if (username.trim().length < 3 || username.trim().length > 24) {
      setError("Username must be between 3 and 24 characters.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const supabase = createAdminSupabaseClient();

      // 1. Ensure profile exists (upsert by id)
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          username: username.trim(),
          display_name: displayName.trim(),
        },
        { onConflict: "id" }
      );
      if (profileError) throw profileError;

      // 2. Create the gym
      const { data: gym, error: gymError } = await supabase
        .from("gyms")
        .insert({
          name: gymName.trim(),
          slug: computedSlug,
          owner_user_id: user.id,
          city: city.trim() || null,
          country_code: countryCode.trim().toUpperCase().slice(0, 2) || null,
          timezone: timezone || "UTC",
          description: description.trim() || null,
        })
        .select("id")
        .single();
      if (gymError) throw gymError;

      // 3. Link the user as leader/active
      const { error: memberError } = await supabase
        .from("gym_memberships")
        .upsert(
          {
            gym_id: gym.id,
            user_id: user.id,
            role: "leader",
            membership_status: "active",
            started_at: new Date().toISOString(),
          },
          { onConflict: "gym_id,user_id" }
        );
      if (memberError) throw memberError;

      // 4. Reload gym context; the layout swaps to the dashboard automatically.
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create gym";
      if (msg.includes("duplicate key value") && msg.includes("slug")) {
        setError("A gym with that URL slug already exists. Pick a different slug.");
      } else if (msg.includes("duplicate key value") && msg.includes("username")) {
        setError("That username is already taken. Pick another.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kruxt-bg p-6">
      <div className="w-full max-w-lg rounded-card border border-border bg-card p-8">
        <h1 className="text-xl font-bold text-foreground font-kruxt-headline">
          Create your gym
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your gym profile to start managing members, classes, billing, and more.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-kruxt-danger/30 bg-kruxt-danger/10 px-4 py-3 text-sm text-kruxt-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Username *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="edoardo"
                minLength={3}
                maxLength={24}
                className={INPUT}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Display name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Edoardo Mustarelli"
                className={INPUT}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Gym name *
            </label>
            <input
              type="text"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="BZone Fitness"
              className={INPUT}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              URL slug *
            </label>
            <input
              type="text"
              value={computedSlug}
              onChange={(e) => {
                setSlugInput(e.target.value);
                setSlugDirty(true);
              }}
              placeholder="bzone-fitness"
              className={INPUT}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Lowercase letters, numbers, and dashes. Used in URLs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Pavia"
                className={INPUT}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Country code
              </label>
              <input
                type="text"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="IT"
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={INPUT}
            >
              <option value="Europe/Rome">Europe/Rome (Italy)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/Madrid">Europe/Madrid</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Borgo Ticino, Pavia. Functional training, pilates, sala pesi..."
              className={INPUT}
            />
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Sign out
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create gym"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
