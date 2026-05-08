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

interface GymContextValue {
  /** Currently selected gym ID — empty string until loaded */
  gymId: string;
  /** Gym display name (for top bar, etc.) */
  gymName: string;
  /** True while we're discovering the user's gym membership */
  loading: boolean;
  /** True if the auth'd user has no active gym membership */
  noGymFound: boolean;
  /** Switch to a different gym tenant */
  setGym: (id: string, name: string) => void;
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
  const { user, loading: authLoading } = useAuth();
  const [gymId, setGymId] = useState("");
  const [gymName, setGymName] = useState("");
  const [loading, setLoading] = useState(true);
  const [noGymFound, setNoGymFound] = useState(false);

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

      // 1) Find the first active/trial gym membership for this user.
      const { data: membership, error: membershipError } = await supabase
        .from("gym_memberships")
        .select("gym_id")
        .eq("user_id", user.id)
        .in("membership_status", ["active", "trial"])
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

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
    } catch (e) {
      console.error("[GymProvider] failed to load gym:", e);
      setNoGymFound(true);
      setGymId("");
      setGymName("");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [authLoading, refresh]);

  function setGym(id: string, name: string) {
    setGymId(id);
    setGymName(name);
    setNoGymFound(false);
  }

  return (
    <GymContext.Provider
      value={{ gymId, gymName, loading, noGymFound, setGym, refresh }}
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
