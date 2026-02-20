import React, { useState, useRef } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen,
  SectionTitle,
  Subtitle,
  PrimaryBtn,
  ErrorBanner,
  ProgressBar,
  BackBtn,
  Spinner,
  SkeletonCard,
} from "../../design-system/primitives";
import { supabase } from "@/integrations/supabase/client";

interface GymSearchResult {
  id: string;
  name: string;
  city: string | null;
  is_public: boolean; // true = open gym, false = private/approval-required
}

export function GymScreen() {
  const { goTo, setGym, state } = useOnboarding();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GymSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GymSearchResult | null>(null);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(v: string) {
    setQuery(v);
    setSelected(null);
    setJoinRequestSent(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  async function search(q: string) {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, city, is_public")
        .ilike("name", `%${q.trim()}%`)
        .limit(8);
      if (error) throw error;
      setResults((data ?? []) as GymSearchResult[]);
    } catch {
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function selectGym(gym: GymSearchResult) {
    setSelected(gym);
    setResults([]);
    setQuery(gym.name);
    setJoinRequestSent(false);
  }

  function handleJoinRequest() {
    if (!selected) return;
    // gym service joinGym is called in CompleteScreen to keep submit atomic
    setJoinRequestSent(true);
    setGym({
      mode: "join",
      gymId: selected.id,
      gymName: selected.name,
      isPublic: selected.is_public,
      joinRequestSent: true,
    });
  }

  function handleContinue() {
    if (selected) {
      const isPrivate = !selected.is_public;
      setGym({
        mode: "join",
        gymId: selected.id,
        gymName: selected.name,
        isPublic: selected.is_public,
        joinRequestSent: isPrivate ? joinRequestSent : false,
      });
    } else {
      setGym({ mode: "skip" });
    }
    goTo("consents");
  }

  const isPrivateSelected = selected ? !selected.is_public : false;
  const canContinue = !selected || !isPrivateSelected || joinRequestSent;

  return (
    <Screen>
      <div className="mb-6">
        <ProgressBar value={60} />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <BackBtn onClick={() => goTo("profile")} />

        <div className="space-y-1">
          <SectionTitle>Select home gym</SectionTitle>
          <Subtitle>Your guild is tied to your gym. You can change this later.</Subtitle>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search gyms by name…"
            className="input-field pr-10"
            aria-label="Search gyms by name"
            aria-autocomplete="list"
            aria-controls="gym-results"
            autoComplete="off"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Spinner size={16} />
            </span>
          )}
        </div>

        {searchError && (
          <ErrorBanner message={searchError} onRetry={() => search(query)} />
        )}

        {/* Loading skeletons */}
        {searching && results.length === 0 && (
          <div className="flex flex-col gap-2" aria-live="polite" aria-label="Searching…">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Results list */}
        {!searching && results.length > 0 && (
          <ul
            id="gym-results"
            role="listbox"
            aria-label="Gym search results"
            className="flex flex-col gap-2"
          >
            {results.map((gym) => (
              <li key={gym.id} role="option" aria-selected={selected?.id === gym.id}>
                <button
                  type="button"
                  onClick={() => selectGym(gym)}
                  className="w-full text-left panel p-4 flex items-center justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{gym.name}</p>
                    {gym.city && (
                      <p className="text-xs text-muted-foreground">{gym.city}</p>
                    )}
                  </div>
                  {!gym.is_public && (
                    <span className="text-xs font-semibold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-md">
                      Private
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Selected confirmation */}
        {selected && (
          <div
            className="panel border-primary/40 bg-primary/5 p-4 flex flex-col gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{selected.name}</p>
                {selected.city && (
                  <p className="text-xs text-muted-foreground">{selected.city}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                }}
                className="text-xs text-muted-foreground underline"
                aria-label="Clear gym selection"
              >
                Change
              </button>
            </div>

            {isPrivateSelected && !joinRequestSent && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-warning">
                  This is a private gym. Send a join request to the gym leader.
                </p>
                <button
                  type="button"
                  onClick={handleJoinRequest}
                  className="btn-ghost text-sm py-2"
                >
                  Send join request
                </button>
              </div>
            )}

            {isPrivateSelected && joinRequestSent && (
              <p className="text-xs text-success font-semibold" role="status">
                ✓ Join request sent. The gym leader will review it.
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!searching && query.length >= 2 && results.length === 0 && !selected && (
          <div className="panel p-5 text-center flex flex-col gap-2" role="status">
            <p className="text-sm font-semibold text-foreground">No gyms found</p>
            <p className="text-xs text-muted-foreground">
              Try a different name, or skip to join later.
            </p>
          </div>
        )}

        {/* CTA footer */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <PrimaryBtn onClick={handleContinue} disabled={!canContinue}>
            {selected ? "Confirm gym" : "Skip for now"}
          </PrimaryBtn>
          {!canContinue && (
            <p className="text-xs text-center text-muted-foreground">
              Send a join request before continuing with this private gym.
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}
