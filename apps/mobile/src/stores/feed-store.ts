import { create } from "zustand";

import type { ReactionType, RankTier, WorkoutType, WorkoutVisibility } from "@kruxt/types";

// ---------------------------------------------------------------------------
// Local types matching FeedService output (camelCase)
// ---------------------------------------------------------------------------

export interface FeedActorSnapshot {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  rankTier?: RankTier;
  level?: number;
}

export interface FeedWorkoutSnapshot {
  id: string;
  userId: string;
  gymId?: string | null;
  title: string;
  workoutType: WorkoutType;
  startedAt: string;
  visibility: WorkoutVisibility;
  totalSets: number;
  totalVolumeKg: number;
  isPr: boolean;
}

export interface FeedEngagementSnapshot {
  reactionCount: number;
  commentCount: number;
  viewerReaction?: ReactionType | null;
}

export interface FeedItem {
  eventId: string;
  eventType: string;
  caption?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: FeedActorSnapshot;
  workout: FeedWorkoutSnapshot;
  engagement: FeedEngagementSnapshot;
  score: number;
}

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface FeedState {
  items: FeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
}

export interface FeedActions {
  /** Load the next page of feed items. */
  loadFeed: () => Promise<void>;
  /** Pull-to-refresh: clear items and reload from scratch. */
  refreshFeed: () => Promise<void>;
  /** Optimistically toggle a reaction on a feed item. */
  reactToItem: (itemId: string, reaction: ReactionType) => Promise<void>;
  /** Add a comment to a feed item. */
  commentOnItem: (itemId: string, text: string) => Promise<void>;
  /** Clear feed state. */
  reset: () => void;
}

export type FeedStore = FeedState & FeedActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: FeedState = {
  items: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  hasMore: true,
};

// ---------------------------------------------------------------------------
// Store
//
// Async actions call services injected at the app level. The store itself
// only manages client state transitions (loading, error, optimistic updates).
// Service calls are placeholders -- wire them once the DI context is ready.
// ---------------------------------------------------------------------------

export const useFeedStore = create<FeedStore>()((set, get) => ({
  ...initialState,

  loadFeed: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: call feedService.listHomeFeed({ limit: 25 })
      // const newItems = await feedService.listHomeFeed({ limit: 25 });
      // set((s) => ({
      //   items: [...s.items, ...newItems],
      //   hasMore: newItems.length === 25,
      //   isLoading: false,
      // }));
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load feed.",
      });
    }
  },

  refreshFeed: async () => {
    set({ isRefreshing: true, error: null });
    try {
      // TODO: call feedService.listHomeFeed({ limit: 25 })
      // const items = await feedService.listHomeFeed({ limit: 25 });
      // set({ items, hasMore: items.length === 25, isRefreshing: false });
      set({ items: [], hasMore: true, isRefreshing: false });
    } catch (err) {
      set({
        isRefreshing: false,
        error: err instanceof Error ? err.message : "Failed to refresh feed.",
      });
    }
  },

  reactToItem: async (itemId, reaction) => {
    // Optimistic update
    const previous = get().items;
    set({
      items: previous.map((item) =>
        item.eventId === itemId
          ? {
              ...item,
              engagement: {
                ...item.engagement,
                viewerReaction: reaction,
                reactionCount:
                  item.engagement.viewerReaction == null
                    ? item.engagement.reactionCount + 1
                    : item.engagement.reactionCount,
              },
            }
          : item
      ),
    });

    try {
      // TODO: call socialService.addReaction({ workoutId: item.workout.id, reactionType: reaction })
    } catch {
      // Rollback on failure
      set({ items: previous });
    }
  },

  commentOnItem: async (itemId, text) => {
    const previous = get().items;

    // Optimistic: bump comment count
    set({
      items: previous.map((item) =>
        item.eventId === itemId
          ? {
              ...item,
              engagement: {
                ...item.engagement,
                commentCount: item.engagement.commentCount + 1,
              },
            }
          : item
      ),
    });

    try {
      // TODO: call socialService.addComment({ workoutId: item.workout.id, commentText: text })
    } catch {
      set({ items: previous });
    }
  },

  reset: () => set(initialState),
}));
