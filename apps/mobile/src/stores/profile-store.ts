import { create } from "zustand";

import type { Profile, RankTier } from "@kruxt/types";

// ---------------------------------------------------------------------------
// Local types for profile stats (aggregated client-side)
// ---------------------------------------------------------------------------

export interface ProfileStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  longestChain: number;
  followersCount: number;
  followingCount: number;
}

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface ProfileState {
  profile: Profile | null;
  stats: ProfileStats | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProfileActions {
  /** Load the current user's profile from the server. */
  loadProfile: () => Promise<void>;
  /** Update profile fields (optimistic, then persist via service). */
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  /** Set profile from external source (e.g. auth context). */
  setProfile: (profile: Profile) => void;
  /** Set stats from external source. */
  setStats: (stats: ProfileStats) => void;
  /** Clear profile state. */
  reset: () => void;
}

export type ProfileStore = ProfileState & ProfileActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: ProfileState = {
  profile: null,
  stats: null,
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProfileStore = create<ProfileStore>()((set, get) => ({
  ...initialState,

  loadProfile: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to profileService.getProfileById(userId)
      // const profile = await profileService.getProfileById(userId);
      // set({ profile, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load profile.",
      });
    }
  },

  updateProfile: async (data) => {
    const previous = get().profile;
    if (!previous) return;

    // Optimistic update
    set({ profile: { ...previous, ...data } });

    try {
      // TODO: wire to profileService.upsertProfile(userId, data)
      // const updated = await profileService.upsertProfile(previous.id, {
      //   username: data.username ?? previous.username,
      //   displayName: data.displayName ?? previous.displayName,
      //   avatarUrl: data.avatarUrl ?? previous.avatarUrl,
      //   bio: data.bio ?? previous.bio,
      //   locale: data.locale ?? previous.locale,
      //   preferredUnits: data.preferredUnits ?? previous.preferredUnits,
      // });
      // set({ profile: updated });
    } catch (err) {
      // Rollback
      set({
        profile: previous,
        error: err instanceof Error ? err.message : "Failed to update profile.",
      });
    }
  },

  setProfile: (profile) => set({ profile }),

  setStats: (stats) => set({ stats }),

  reset: () => set(initialState),
}));
