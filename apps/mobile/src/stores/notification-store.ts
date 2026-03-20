import { create } from "zustand";

import type { NotificationPreferences } from "@kruxt/types";

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface NotificationState {
  preferences: NotificationPreferences | null;
  pushToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface NotificationActions {
  /** Load notification preferences from the server. */
  loadPreferences: () => Promise<void>;
  /**
   * Toggle a single preference key. The key must correspond to a boolean
   * field on NotificationPreferences (e.g. "pushEnabled", "commentsEnabled").
   */
  updatePreference: (key: keyof NotificationPreferences, enabled: boolean) => Promise<void>;
  /** Register a push notification token with the server. */
  registerPushToken: (token: string) => Promise<void>;
  /** Set push token locally (e.g. from Expo Notifications). */
  setPushToken: (token: string) => void;
  /** Clear notification state. */
  reset: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: NotificationState = {
  preferences: null,
  pushToken: null,
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  ...initialState,

  loadPreferences: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to notificationService.getPreferences()
      // const preferences = await notificationService.getPreferences();
      // set({ preferences, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load notification preferences.",
      });
    }
  },

  updatePreference: async (key, enabled) => {
    const previous = get().preferences;
    if (!previous) return;

    // Optimistic update
    const updated = { ...previous, [key]: enabled };
    set({ preferences: updated });

    try {
      // TODO: wire to notificationService.upsertPreferences({ [key]: enabled })
      // const saved = await notificationService.upsertPreferences({ ...updated });
      // set({ preferences: saved });
    } catch (err) {
      // Rollback
      set({
        preferences: previous,
        error: err instanceof Error ? err.message : "Failed to update preference.",
      });
    }
  },

  registerPushToken: async (token) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to notificationService.registerPushToken({ deviceId, platform, pushToken: token })
      // await notificationService.registerPushToken({ deviceId, platform: "ios", pushToken: token });
      set({ pushToken: token, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to register push token.",
      });
    }
  },

  setPushToken: (token) => set({ pushToken: token }),

  reset: () => set(initialState),
}));
