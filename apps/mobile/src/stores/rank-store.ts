import { create } from "zustand";

import type {
  Challenge,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardScope,
  LeaderboardTimeframe,
  RankTier,
} from "@kruxt/types";

import type { LeaderboardEntryWithActor } from "../services/competition-service";

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface RankState {
  /** Keyed by `${scope}:${timeframe}` for quick lookup. */
  leaderboards: Record<string, LeaderboardEntryWithActor[]>;
  /** The viewer's rank on the currently viewed leaderboard. */
  currentRank: number | null;
  /** The viewer's current workout chain streak. */
  currentChain: number;
  /** Available challenges the user can view/join. */
  challenges: Challenge[];
  isLoading: boolean;
  error: string | null;
}

export interface RankActions {
  /** Load entries for a given leaderboard scope + timeframe. */
  loadLeaderboard: (scope: LeaderboardScope, timeframe: LeaderboardTimeframe) => Promise<void>;
  /** Load challenges visible to the current user. */
  loadChallenges: () => Promise<void>;
  /** Join a challenge by id. */
  joinChallenge: (challengeId: string) => Promise<void>;
  /** Update cached chain/rank from external sources (e.g. after workout log). */
  setChainAndRank: (chain: number, rank: number | null) => void;
  /** Clear rank state. */
  reset: () => void;
}

export type RankStore = RankState & RankActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: RankState = {
  leaderboards: {},
  currentRank: null,
  currentChain: 0,
  challenges: [],
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function leaderboardKey(scope: LeaderboardScope, timeframe: LeaderboardTimeframe): string {
  return `${scope}:${timeframe}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRankStore = create<RankStore>()((set, get) => ({
  ...initialState,

  loadLeaderboard: async (scope, timeframe) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to competitionService
      // 1. List leaderboards matching scope + timeframe
      // const boards = await competitionService.listLeaderboards({ scope, timeframe, activeOnly: true, limit: 1 });
      // if (boards.length === 0) { set({ isLoading: false }); return; }
      // 2. Get entries for the first matching board
      // const entries = await competitionService.listLeaderboardEntries(boards[0].id);
      // const key = leaderboardKey(scope, timeframe);
      // set((s) => ({
      //   leaderboards: { ...s.leaderboards, [key]: entries },
      //   isLoading: false,
      // }));
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load leaderboard.",
      });
    }
  },

  loadChallenges: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to competitionService.listChallenges({ activeOnly: true })
      // const challenges = await competitionService.listChallenges({ activeOnly: true });
      // set({ challenges, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load challenges.",
      });
    }
  },

  joinChallenge: async (challengeId) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to competitionService.joinChallenge({ challengeId })
      // await competitionService.joinChallenge({ challengeId });
      // Refresh challenges after joining
      // await get().loadChallenges();
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to join challenge.",
      });
    }
  },

  setChainAndRank: (chain, rank) =>
    set({ currentChain: chain, currentRank: rank }),

  reset: () => set(initialState),
}));
