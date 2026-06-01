"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import { createAdminSupabaseClient } from "@/services";

const SELECTED_GYM_STORAGE_KEY = "kruxt:selected-gym-id";
const SUPPORT_SESSION_STORAGE_KEY = "kruxt:platform-support-session-id";
const DEFAULT_UAT_GYM_ID = process.env.NEXT_PUBLIC_KRUXT_UAT_GYM_ID ?? "61036acd-2f86-4745-866e-cd2f5539371f";
const DEPRECATED_BZONE_GYM_IDS = new Set([
  "871a11f1-6893-495a-8ed8-70d736876096",
  "3306f501-3f50-4a30-8552-b47bf9cce199",
]);

type GymLookupRow = {
  id: string;
  name: string;
};

type MembershipLookupRow = {
  gym_id: string;
};

type SupportSessionLookupRow = {
  gym_id: string;
};

function readRequestedGymId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const urlGymId = params.get("gymId");
  if (urlGymId) {
    window.localStorage.setItem(SELECTED_GYM_STORAGE_KEY, urlGymId);
    return urlGymId;
  }
  return window.localStorage.getItem(SELECTED_GYM_STORAGE_KEY);
}

function readSupportSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const urlSessionId = params.get("supportSessionId");
  if (urlSessionId) {
    window.localStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, urlSessionId);
    return urlSessionId;
  }
  if (params.get("source") === "platform") {
    window.localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
    return null;
  }
  return window.localStorage.getItem(SUPPORT_SESSION_STORAGE_KEY);
}

function persistRequestedGymId(gymId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_GYM_STORAGE_KEY, gymId);
}

function clearStoredGymId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_GYM_STORAGE_KEY);
}

function clearStoredSupportSessionId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
}

function normalizeDefaultGymId(gymId: string | null): string | null {
  if (!gymId) return null;
  return DEPRECATED_BZONE_GYM_IDS.has(gymId) ? DEFAULT_UAT_GYM_ID : gymId;
}

interface GymContextValue {
  /** Currently selected gym ID — empty string until loaded */
  gymId: string;
  /** Gym display name (for top bar, etc.) */
  gymName: string;
  /** True while we're discovering the user's gym membership */
  loading: boolean;
  /** True if the auth'd user has no active gym membership */
  noGymFound: boolean;
  /** Active KRUXT platform support/access session, if this admin view was opened from platform */
  supportSessionId: string | null;
  /** Switch to a different gym tenant */
  setGym: (id: string, name: string) => void;
  /** Clear the active platform support/access session locally */
  clearSupportSession: () => void;
  /** Re-fetch the user's gym membership */
  refresh: () => void;
}

const GymContext = createContext<GymContextValue | null>(null);

/**
 * Discovers the current user's first active gym membership and exposes the
 * gym ID + display name to the dashboard. While the user has no gym yet,
 * `noGymFound` flips true and the dashboard layout shows an onboarding panel.
 */
export function GymProvider({ children }: { children: ReactNode }) {
  const { user, platformRole, loading: authLoading } = useAuth();
  const [gymId, setGymId] = useState("");
  const [gymName, setGymName] = useState("");
  const [loading, setLoading] = useState(true);
  const [noGymFound, setNoGymFound] = useState(false);
  const [supportSessionId, setSupportSessionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setGymId("");
      setGymName("");
      setNoGymFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNoGymFound(false);
    try {
      const supabase = createAdminSupabaseClient();
      const storedSupportSessionId = readSupportSessionId();
      let requestedGymId = readRequestedGymId();
      setSupportSessionId(storedSupportSessionId);

      if (!requestedGymId && storedSupportSessionId) {
        const { data: supportSession, error: supportSessionError } = await supabase
          .from("gym_support_access_sessions")
          .select("gym_id")
          .eq("id", storedSupportSessionId)
          .maybeSingle();

        if (supportSessionError) throw supportSessionError;

        const sessionGymId = (supportSession as SupportSessionLookupRow | null)?.gym_id ?? null;
        if (sessionGymId) {
          requestedGymId = sessionGymId;
          persistRequestedGymId(sessionGymId);
        }
      }

      if (platformRole) {
        requestedGymId = normalizeDefaultGymId(requestedGymId);

        if (requestedGymId) {
          const { data: selectedGym, error: selectedGymError } = await supabase
            .from("gyms")
            .select("id,name")
            .eq("id", requestedGymId)
            .maybeSingle();

          if (selectedGymError) throw selectedGymError;

          const selected = selectedGym as GymLookupRow | null;
          if (selected) {
            setGymId(selected.id);
            setGymName(selected.name);
            persistRequestedGymId(selected.id);
            return;
          }
          clearStoredGymId();
        }

        const { data: uatGym, error: uatGymError } = await supabase
          .from("gyms")
          .select("id,name")
          .eq("id", DEFAULT_UAT_GYM_ID)
          .maybeSingle();

        if (uatGymError) throw uatGymError;

        const explicitUatGym = uatGym as GymLookupRow | null;
        if (explicitUatGym) {
          setGymId(explicitUatGym.id);
          setGymName(explicitUatGym.name);
          persistRequestedGymId(explicitUatGym.id);
          return;
        }

        const { data: fallbackGym, error: fallbackGymError } = await supabase
          .from("gyms")
          .select("id,name")
          .order("is_public", { ascending: false })
          .order("name", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fallbackGymError) throw fallbackGymError;

        const fallback = fallbackGym as GymLookupRow | null;
        if (!fallback) {
          setNoGymFound(true);
          setGymId("");
          setGymName("");
          return;
        }

        setGymId(fallback.id);
        setGymName(fallback.name);
        persistRequestedGymId(fallback.id);
        return;
      }

      // 1) Find active/trial gym memberships for this user.
      const { data: membershipsData, error: membershipError } = await supabase
        .from("gym_memberships")
        .select("gym_id")
        .eq("user_id", user.id)
        .in("membership_status", ["active", "trial"]);

      if (membershipError) throw membershipError;

      const memberships = ((membershipsData ?? []) as MembershipLookupRow[]) ?? [];
      const membership =
        (requestedGymId
          ? memberships.find((item) => item.gym_id === requestedGymId)
          : undefined) ?? memberships[0];

      if (!membership) {
        setNoGymFound(true);
        setGymId("");
        setGymName("");
        return;
      }

      // 2) Fetch the gym's display name.
      const { data: gym, error: gymError } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("id", membership.gym_id)
        .maybeSingle();

      if (gymError) throw gymError;

      setGymId(membership.gym_id);
      setGymName(gym?.name ?? "Your gym");
      persistRequestedGymId(membership.gym_id);
    } catch (e) {
      console.error("[GymProvider] failed to load gym:", e);
      setNoGymFound(true);
      setGymId("");
      setGymName("");
    } finally {
      setLoading(false);
    }
  }, [platformRole, user]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [authLoading, refresh]);

  function setGym(id: string, name: string) {
    setGymId(id);
    setGymName(name);
    setNoGymFound(false);
    persistRequestedGymId(id);
  }

  function clearSupportSession() {
    setSupportSessionId(null);
    clearStoredSupportSessionId();
  }

  return (
    <GymContext.Provider
      value={{
        gymId,
        gymName,
        loading,
        noGymFound,
        supportSessionId,
        setGym,
        clearSupportSession,
        refresh,
      }}
    >
      {children}
    </GymContext.Provider>
  );
}

export function useGym(): GymContextValue {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error("useGym must be used within GymProvider");
  return ctx;
}
