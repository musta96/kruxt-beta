"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import { createAdminSupabaseClient, StaffAccessService } from "@/services";

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
  role: string;
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
  error: string | null;
  accessDenied: boolean;
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
 * Discovers the current user's accessible staff gym and exposes the
 * gym ID + display name to the dashboard. While the user has no gym yet,
 * `noGymFound` flips true and the dashboard layout shows an onboarding panel.
 */
export function GymProvider({ children }: { children: ReactNode }) {
  const { user, platformRole, loading: authLoading } = useAuth();
  const [gymId, setGymId] = useState("");
  const [gymName, setGymName] = useState("");
  const [loading, setLoading] = useState(true);
  const [noGymFound, setNoGymFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const identity = user ? user.id + ":" + (platformRole ?? "staff") : "";
  const [resolvedIdentity, setResolvedIdentity] = useState<string | null>(null);
  const request = useRef(0);
  const [supportSessionId, setSupportSessionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    setError(null);
    setAccessDenied(false);
    setGymId("");
    setGymName("");
    if (!user) {
      setGymId("");
      setGymName("");
      setNoGymFound(false);
      setSupportSessionId(null);
      setResolvedIdentity("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setNoGymFound(false);
    try {
      const supabase = createAdminSupabaseClient();
      const access = new StaffAccessService(supabase);
      async function selectGym(selected: GymLookupRow) {
        await access.requireGymStaff(selected.id, user!.id);
        if (version !== request.current) return;
        setGymId(selected.id);
        setGymName(selected.name);
        persistRequestedGymId(selected.id);
      }
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
            await selectGym(selected);
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
          await selectGym(explicitUatGym);
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
          if (version !== request.current) return;
          setNoGymFound(true);
          setGymId("");
          setGymName("");
          return;
        }

        await selectGym(fallback);
        return;
      }

      // 1) Find active/trial gym memberships for this user.
      const { data: membershipsData, error: membershipError } = await supabase
        .from("gym_memberships")
        .select("gym_id,role")
        .eq("user_id", user.id)
        .in("membership_status", ["active", "trial"]);

      if (membershipError) throw membershipError;

      const memberships = ((membershipsData ?? []) as MembershipLookupRow[]) ?? [];
      const staffMemberships = memberships.filter((item) => ["leader", "officer", "coach"].includes(item.role));
      const membership =
        (requestedGymId
          ? staffMemberships.find((item) => item.gym_id === requestedGymId)
          : undefined) ?? staffMemberships[0];

      if (!membership) {
        if (version !== request.current) return;
        setAccessDenied(memberships.length > 0);
        setNoGymFound(memberships.length === 0);
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

      if (!gym) throw new Error("Gym unavailable");
      await selectGym({ id: membership.gym_id, name: gym.name });
    } catch (e) {
      if (version !== request.current) return;
      console.error("[GymProvider] failed to load gym:", e);
      const denied = (e as { code?: string })?.code === "ADMIN_STAFF_ACCESS_DENIED";
      setAccessDenied(denied);
      setError(denied ? null : "We couldn't check your gym access. Please try again.");
      setNoGymFound(false);
      setGymId("");
      setGymName("");
    } finally {
      if (version === request.current) {
        setResolvedIdentity(identity);
        setLoading(false);
      }
    }
  }, [identity, platformRole, user]);

  useEffect(() => {
    if (!authLoading) {
      void refresh();
    }
    return () => { request.current += 1; };
  }, [authLoading, refresh]);

  function setGym(id: string, _name: string) {
    persistRequestedGymId(id);
    void refresh();
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
        loading: loading || authLoading || resolvedIdentity !== identity,
        noGymFound,
        error,
        accessDenied,
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
