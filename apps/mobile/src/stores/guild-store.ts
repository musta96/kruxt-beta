import { create } from "zustand";

import type {
  GuildHallSnapshot,
  GuildRosterMember,
  Gym,
  GymMembership,
  GymRole,
  MembershipStatus,
  RankTier,
} from "@kruxt/types";

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface GuildState {
  /** The primary gym info for the current user. */
  gym: Gym | null;
  /** Roster members for the current gym. */
  roster: GuildRosterMember[];
  /** Current user's membership in their primary gym. */
  membership: GymMembership | null;
  /** Guild Hall aggregate snapshot (rank, XP, classes, etc.). */
  hallSnapshot: GuildHallSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

export interface GuildActions {
  /** Load the Guild Hall snapshot and primary gym info. */
  loadGuild: () => Promise<void>;
  /** Refresh the roster for the current gym. */
  refreshRoster: () => Promise<void>;
  /** Clear guild state. */
  reset: () => void;
}

export type GuildStore = GuildState & GuildActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: GuildState = {
  gym: null,
  roster: [],
  membership: null,
  hallSnapshot: null,
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGuildStore = create<GuildStore>()((set, get) => ({
  ...initialState,

  loadGuild: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to gymService.getGuildHallSnapshot(userId)
      // const snapshot = await gymService.getGuildHallSnapshot(userId);
      // set({ hallSnapshot: snapshot, isLoading: false });
      //
      // If snapshot has a gymId, load gym details:
      // const gym = (await gymService.listVisibleGyms()).find(g => g.id === snapshot.gymId);
      // set({ gym });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load guild.",
      });
    }
  },

  refreshRoster: async () => {
    const { gym } = get();
    if (!gym) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to gymService.listGuildRoster(gym.id)
      // const roster = await gymService.listGuildRoster(gym.id);
      // set({ roster, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load roster.",
      });
    }
  },

  reset: () => set(initialState),
}));
