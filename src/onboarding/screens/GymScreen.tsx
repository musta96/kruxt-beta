// Step 3 – Select home gym (search + create + join request)
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding, useFieldError } from "../OnboardingContext";
import {
  ScreenShell,
  StepBar,
  ScreenHeader,
  Field,
  TextInput,
  PrimaryButton,
  GhostButton,
  BackButton,
  ErrorCallout,
} from "../ui";
import type { OnboardingGymDraft } from "../types";

interface GymResult {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  is_public: boolean;
  motto: string | null;
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export function GymScreen() {
  const { draft, updateDraft, advance, back, submitError, isSubmitting, errors } = useOnboarding();
  const gymDraft = draft.gym;

  const gymIdError = useFieldError("gym.join.gymId");
  const gymNameError = useFieldError("gym.create.name");

  const [mode, setMode] = useState<"browse" | "create" | "skip">(
    gymDraft.mode === "create" ? "create" : gymDraft.mode === "join" ? "browse" : "browse"
  );
  const [search, setSearch] = useState("");
  const [gyms, setGyms] = useState<GymResult[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(false);
  const [selectedGym, setSelectedGym] = useState<GymResult | null>(
    gymDraft.mode === "join" ? { id: gymDraft.gymId, name: gymDraft.gymName, slug: "", city: null, is_public: !gymDraft.isPrivate, motto: null } : null
  );

  // Create gym local state
  const [createName, setCreateName] = useState(gymDraft.mode === "create" ? gymDraft.name : "");
  const [createSlug, setCreateSlug] = useState(gymDraft.mode === "create" ? gymDraft.slug : "");
  const [createCity, setCreateCity] = useState(gymDraft.mode === "create" ? (gymDraft.city ?? "") : "");
  const [createPublic, setCreatePublic] = useState(gymDraft.mode === "create" ? gymDraft.isPublic : true);

  const fetchGyms = useCallback(async (q: string) => {
    setLoadingGyms(true);
    try {
      let query = supabase
        .from("gyms")
        .select("id,name,slug,city,is_public,motto")
        .order("name", { ascending: true })
        .limit(20);

      if (q.trim()) {
        query = query.ilike("name", `%${q.trim()}%`);
      }

      const { data } = await query;
      setGyms((data as GymResult[]) ?? []);
    } catch {
      setGyms([]);
    } finally {
      setLoadingGyms(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "browse") {
      fetchGyms(search);
    }
  }, [mode, search, fetchGyms]);

  function applySkip() {
    updateDraft({ gym: { mode: "skip" } });
    advance();
  }

  function applyJoin() {
    if (!selectedGym) return;
    const g: OnboardingGymDraft = {
      mode: "join",
      gymId: selectedGym.id,
      gymName: selectedGym.name,
      isPrivate: !selectedGym.is_public,
      setAsHomeGym: true,
    } as OnboardingGymDraft;
    updateDraft({ gym: g });
    // advance is triggered after updateDraft settles via the button
  }

  function applyCreate() {
    const g: OnboardingGymDraft = {
      mode: "create",
      name: createName,
      slug: createSlug || slugify(createName),
      isPublic: createPublic,
      city: createCity || undefined,
    } as OnboardingGymDraft;
    updateDraft({ gym: g });
  }

  return (
    <ScreenShell>
      <StepBar current={2} total={4} />

      <div className="flex items-center gap-2 px-4 pt-2">
        <BackButton onClick={back} />
      </div>

      <ScreenHeader
        badge="Step 3 of 4"
        title="Join a guild"
        subtitle="Create a gym or request access to an existing one."
      />

      {submitError && <ErrorCallout message={submitError} />}

      <div className="px-6 pt-2 pb-10 space-y-5 flex-1">
        {/* Mode tabs */}
        <div className="flex rounded-xl bg-secondary/30 border border-border/30 p-1 gap-1">
          {(["browse", "create"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold capitalize transition-all duration-200 ${
                mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "browse" ? "Find a gym" : "Create my gym"}
            </button>
          ))}
        </div>

        {mode === "browse" && (
          <>
            {/* Search */}
            <Field label="Search gyms">
              <TextInput
                type="search"
                placeholder="Search by gym name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>

            {/* Results list */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {loadingGyms ? (
                <div className="text-center py-6 text-sm text-muted-foreground animate-pulse">
                  Loading gyms…
                </div>
              ) : gyms.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  {search ? "No gyms match your search." : "No gyms listed yet."}
                </div>
              ) : (
                gyms.map((gym) => (
                  <button
                    key={gym.id}
                    type="button"
                    onClick={() => setSelectedGym(gym)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                      selectedGym?.id === gym.id
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{gym.name}</p>
                        {gym.city && <p className="text-xs text-muted-foreground">{gym.city}</p>}
                        {gym.motto && <p className="text-xs text-muted-foreground/70 italic truncate mt-0.5">"{gym.motto}"</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          gym.is_public
                            ? "bg-accent/20 text-accent"
                            : "bg-warning/20 text-warning"
                        }`}>
                          {gym.is_public ? "Open" : "Private"}
                        </span>
                        {selectedGym?.id === gym.id && (
                          <svg className="w-4 h-4 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    {!gym.is_public && selectedGym?.id === gym.id && (
                      <p className="text-xs text-warning/80 mt-1.5">
                        This gym is private — your membership will be pending approval.
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>

            {gymIdError && (
              <p className="text-xs text-destructive">{gymIdError}</p>
            )}

            <PrimaryButton
              onClick={() => {
                applyJoin();
                advance();
              }}
              loading={isSubmitting}
              disabled={!selectedGym}
            >
              {selectedGym
                ? selectedGym.is_public
                  ? `Join ${selectedGym.name} →`
                  : `Request access to ${selectedGym.name} →`
                : "Select a gym to continue"}
            </PrimaryButton>
          </>
        )}

        {mode === "create" && (
          <>
            <Field label="Gym Name" required error={gymNameError}>
              <TextInput
                type="text"
                placeholder="Iron Forge CrossFit"
                value={createName}
                error={!!gymNameError}
                onChange={(e) => {
                  const val = e.target.value;
                  setCreateName(val);
                  if (!createSlug) setCreateSlug(slugify(val));
                }}
              />
            </Field>

            <Field label="Slug" hint="URL-friendly identifier — auto-generated from name.">
              <TextInput
                type="text"
                placeholder="iron-forge-crossfit"
                value={createSlug}
                onChange={(e) =>
                  setCreateSlug(slugify(e.target.value))
                }
              />
            </Field>

            <Field label="City" hint="Optional.">
              <TextInput
                type="text"
                placeholder="Milan, Rome, London…"
                value={createCity}
                onChange={(e) => setCreateCity(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/30 bg-secondary/20">
              <div>
                <p className="text-sm font-semibold text-foreground">Public gym</p>
                <p className="text-xs text-muted-foreground">Anyone can request to join</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={createPublic}
                onClick={() => setCreatePublic((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${createPublic ? "bg-primary" : "bg-border/60"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${createPublic ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <PrimaryButton
              onClick={() => {
                applyCreate();
                advance();
              }}
              loading={isSubmitting}
              disabled={!createName.trim()}
            >
              Create gym →
            </PrimaryButton>
          </>
        )}

        <GhostButton onClick={applySkip}>
          Skip for now — set home gym later
        </GhostButton>
      </div>
    </ScreenShell>
  );
}
