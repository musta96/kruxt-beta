"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface GymContextValue {
  /** Currently selected gym ID */
  gymId: string;
  /** Gym display name (for top bar, etc.) */
  gymName: string;
  /** Switch to a different gym tenant */
  setGym: (id: string, name: string) => void;
}

const GymContext = createContext<GymContextValue | null>(null);

/**
 * Provides the current gym context to admin dashboard pages.
 * For now, defaults to a hardcoded gym. Once multi-gym support
 * is wired, this will read from the user's gym_memberships.
 */
export function GymProvider({ children }: { children: ReactNode }) {
  const [gymId, setGymId] = useState("gym_01");
  const [gymName, setGymName] = useState("Iron Temple Fitness");

  function setGym(id: string, name: string) {
    setGymId(id);
    setGymName(name);
  }

  return (
    <GymContext.Provider value={{ gymId, gymName, setGym }}>
      {children}
    </GymContext.Provider>
  );
}

export function useGym(): GymContextValue {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error("useGym must be used within GymProvider");
  return ctx;
}
