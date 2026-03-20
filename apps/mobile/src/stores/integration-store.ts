import { create } from "zustand";

import type {
  DeviceConnection,
  DeviceSyncJob,
  IntegrationProvider,
} from "@kruxt/types";

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface IntegrationState {
  /** Active device connections (Apple Health, Garmin, etc.). */
  connections: DeviceConnection[];
  /** Recent sync jobs for all connected providers. */
  syncJobs: DeviceSyncJob[];
  isLoading: boolean;
  error: string | null;
}

export interface IntegrationActions {
  /** Load all device connections for the current user. */
  loadConnections: () => Promise<void>;
  /** Connect a new integration provider. */
  connectProvider: (provider: IntegrationProvider) => Promise<void>;
  /** Disconnect an integration provider (revoke status). */
  disconnectProvider: (provider: IntegrationProvider) => Promise<void>;
  /** Request a manual sync for a given provider. */
  requestSync: (provider: IntegrationProvider) => Promise<void>;
  /** Load recent sync jobs. */
  loadSyncJobs: () => Promise<void>;
  /** Clear integration state. */
  reset: () => void;
}

export type IntegrationStore = IntegrationState & IntegrationActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: IntegrationState = {
  connections: [],
  syncJobs: [],
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useIntegrationStore = create<IntegrationStore>()((set, get) => ({
  ...initialState,

  loadConnections: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to integrationService.listConnections(userId)
      // const connections = await integrationService.listConnections(userId);
      // set({ connections, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load connections.",
      });
    }
  },

  connectProvider: async (provider) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to integrationService.upsertConnection(userId, { provider, status: "active" })
      // const connection = await integrationService.upsertConnection(userId, { provider, status: "active" });
      // set((s) => ({
      //   connections: [...s.connections.filter(c => c.provider !== provider), connection],
      //   isLoading: false,
      // }));
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to connect provider.",
      });
    }
  },

  disconnectProvider: async (provider) => {
    const connection = get().connections.find((c) => c.provider === provider);
    if (!connection) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to integrationService.updateConnectionStatus(userId, connection.id, "revoked")
      // await integrationService.updateConnectionStatus(userId, connection.id, "revoked");
      // set((s) => ({
      //   connections: s.connections.filter(c => c.provider !== provider),
      //   isLoading: false,
      // }));
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to disconnect provider.",
      });
    }
  },

  requestSync: async (provider) => {
    const connection = get().connections.find(
      (c) => c.provider === provider && c.status === "active"
    );
    if (!connection) return;

    set({ isLoading: true, error: null });
    try {
      // TODO: wire to integrationService.queueSyncJob(userId, { connectionId: connection.id })
      // const job = await integrationService.queueSyncJob(userId, { connectionId: connection.id });
      // set((s) => ({
      //   syncJobs: [job, ...s.syncJobs],
      //   isLoading: false,
      // }));
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to request sync.",
      });
    }
  },

  loadSyncJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: wire to integrationService.listSyncJobs(userId)
      // const syncJobs = await integrationService.listSyncJobs(userId);
      // set({ syncJobs, isLoading: false });
      set({ isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load sync jobs.",
      });
    }
  },

  reset: () => set(initialState),
}));
