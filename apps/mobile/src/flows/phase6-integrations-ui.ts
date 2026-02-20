import type {
  DeviceConnection,
  DeviceSyncCursor,
  DeviceSyncJob,
  ExternalActivityImport,
  IntegrationProvider,
  QueueDeviceSyncJobInput
} from "@kruxt/types";

import { createMobileSupabaseClient, IntegrationService, KruxtAppError } from "../services";
import {
  createPhase6IntegrationsFlow,
  phase6IntegrationsChecklist,
  type Phase6IntegrationsSnapshot
} from "./phase6-integrations";

const activeIntegrationProviders = ["apple_health", "garmin"] as const;

export type ActiveIntegrationProvider = (typeof activeIntegrationProviders)[number];

export type Phase6IntegrationsUiStep =
  | "provider_selection"
  | "connection_management"
  | "sync_queue"
  | "import_mapping";

export interface Phase6ImportDuplicateGroup {
  provider: ActiveIntegrationProvider;
  externalActivityId: string;
  count: number;
}

export interface Phase6ProviderState {
  provider: ActiveIntegrationProvider;
  connection: DeviceConnection | null;
  latestSyncJob: DeviceSyncJob | null;
  cursor: DeviceSyncCursor | null;
  importsTotal: number;
  mappedImports: number;
  unmappedImports: number;
  duplicateExternalActivityIds: string[];
  latestImportAt: string | null;
}

export interface Phase6IntegrationsUiSnapshot {
  providers: ActiveIntegrationProvider[];
  connections: DeviceConnection[];
  syncJobs: DeviceSyncJob[];
  syncCursors: DeviceSyncCursor[];
  imports: ExternalActivityImport[];
  providerStates: Phase6ProviderState[];
  duplicateImportGroups: Phase6ImportDuplicateGroup[];
  hiddenUnsupportedConnectionCount: number;
  hiddenUnsupportedImportCount: number;
  mappedImportCount: number;
  unmappedImportCount: number;
}

export interface Phase6IntegrationsUiError {
  code: string;
  step: Phase6IntegrationsUiStep;
  message: string;
  recoverable: boolean;
}

export interface Phase6IntegrationsLoadSuccess {
  ok: true;
  snapshot: Phase6IntegrationsUiSnapshot;
}

export interface Phase6IntegrationsLoadFailure {
  ok: false;
  error: Phase6IntegrationsUiError;
}

export type Phase6IntegrationsLoadResult = Phase6IntegrationsLoadSuccess | Phase6IntegrationsLoadFailure;

export interface Phase6IntegrationsMutationSuccess {
  ok: true;
  action: "connect_provider" | "disconnect_provider" | "queue_sync";
  provider: ActiveIntegrationProvider;
  snapshot: Phase6IntegrationsUiSnapshot;
  connection?: DeviceConnection;
  syncJob?: DeviceSyncJob;
}

export interface Phase6IntegrationsMutationFailure {
  ok: false;
  error: Phase6IntegrationsUiError;
}

export type Phase6IntegrationsMutationResult =
  | Phase6IntegrationsMutationSuccess
  | Phase6IntegrationsMutationFailure;

export interface Phase6ActivationReport {
  requiredProviders: ActiveIntegrationProvider[];
  connectedProviders: ActiveIntegrationProvider[];
  missingProviders: ActiveIntegrationProvider[];
  queuedOrRunningSyncJobCount: number;
  duplicateImportGroups: Phase6ImportDuplicateGroup[];
  mappedImportCount: number;
  unmappedImportCount: number;
  mappingCoverage: number;
  ready: boolean;
}

export interface Phase6ActivationValidationSuccess {
  ok: true;
  snapshot: Phase6IntegrationsUiSnapshot;
  report: Phase6ActivationReport;
}

export interface Phase6ActivationValidationFailure {
  ok: false;
  error: Phase6IntegrationsUiError;
}

export type Phase6ActivationValidationResult =
  | Phase6ActivationValidationSuccess
  | Phase6ActivationValidationFailure;

export interface ConnectProviderInput {
  providerUserId?: string | null;
  scopes?: string[];
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: string | null;
  metadata?: Record<string, unknown>;
  queueInitialSync?: boolean;
  initialSyncCursor?: Record<string, unknown>;
}

export const phase6IntegrationsUiChecklist = [
  ...phase6IntegrationsChecklist,
  "Connect/disconnect Apple Health and Garmin providers",
  "Queue sync jobs and refresh connector state",
  "Validate duplicate-safe activity imports and workout mapping coverage"
] as const;

function isActiveProvider(provider: IntegrationProvider): provider is ActiveIntegrationProvider {
  return (activeIntegrationProviders as readonly IntegrationProvider[]).includes(provider);
}

function assertActiveProvider(provider: IntegrationProvider): ActiveIntegrationProvider {
  if (!isActiveProvider(provider)) {
    throw new KruxtAppError(
      "INTEGRATION_PROVIDER_UNSUPPORTED",
      "Only Apple Health and Garmin connectors are active in this beta."
    );
  }

  return provider;
}

function mapErrorStep(code: string): Phase6IntegrationsUiStep {
  if (code === "INTEGRATION_PROVIDER_UNSUPPORTED") {
    return "provider_selection";
  }

  if (code.includes("SYNC_JOB") || code.includes("CURSOR")) {
    return "sync_queue";
  }

  if (code.includes("IMPORT") || code.includes("DUPLICATE")) {
    return "import_mapping";
  }

  if (code.includes("CONNECTION")) {
    return "connection_management";
  }

  return "provider_selection";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "INTEGRATION_PROVIDER_UNSUPPORTED") {
    return "Only Apple Health and Garmin are available in this beta.";
  }

  if (code === "INTEGRATION_CONNECTION_NOT_FOUND") {
    return "Provider connection not found. Connect the provider first.";
  }

  if (code === "INTEGRATION_CONNECTION_INACTIVE") {
    return "Reconnect the provider before requesting a sync.";
  }

  if (code === "INTEGRATION_SYNC_JOB_QUEUE_FAILED") {
    return "Sync request failed. Retry after refreshing provider status.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase6IntegrationsUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("INTEGRATIONS_UI_ACTION_FAILED", "Unable to complete integration action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: appError.code !== "INTEGRATION_PROVIDER_UNSUPPORTED"
  };
}

function mapDuplicateGroups(
  provider: ActiveIntegrationProvider,
  imports: ExternalActivityImport[]
): Phase6ImportDuplicateGroup[] {
  const counts = new Map<string, number>();

  for (const imported of imports) {
    const key = imported.externalActivityId.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates: Phase6ImportDuplicateGroup[] = [];
  for (const [externalActivityId, count] of counts.entries()) {
    if (count > 1) {
      duplicates.push({
        provider,
        externalActivityId,
        count
      });
    }
  }

  duplicates.sort((left, right) => left.externalActivityId.localeCompare(right.externalActivityId));
  return duplicates;
}

function buildUiSnapshot(snapshot: Phase6IntegrationsSnapshot): Phase6IntegrationsUiSnapshot {
  const connections = snapshot.connections.filter((connection) => isActiveProvider(connection.provider));
  const syncJobs = snapshot.syncJobs.filter((job) => isActiveProvider(job.provider));
  const syncCursors = snapshot.syncCursors.filter((cursor) => isActiveProvider(cursor.provider));
  const imports = snapshot.imports.filter((imported) => isActiveProvider(imported.provider));

  const providerStates: Phase6ProviderState[] = [];
  const duplicateImportGroups: Phase6ImportDuplicateGroup[] = [];

  for (const provider of activeIntegrationProviders) {
    const connection = connections.find((row) => row.provider === provider) ?? null;
    const providerSyncJobs = syncJobs.filter((row) => row.provider === provider);
    const providerImports = imports.filter((row) => row.provider === provider);
    const providerDuplicates = mapDuplicateGroups(provider, providerImports);
    const mappedImports = providerImports.filter((row) => Boolean(row.mappedWorkoutId)).length;
    const latestImportAt = providerImports[0]?.importedAt ?? null;

    duplicateImportGroups.push(...providerDuplicates);
    providerStates.push({
      provider,
      connection,
      latestSyncJob: providerSyncJobs[0] ?? null,
      cursor: connection
        ? syncCursors.find((row) => row.connectionId === connection.id && row.provider === provider) ?? null
        : null,
      importsTotal: providerImports.length,
      mappedImports,
      unmappedImports: providerImports.length - mappedImports,
      duplicateExternalActivityIds: providerDuplicates.map((row) => row.externalActivityId),
      latestImportAt
    });
  }

  return {
    providers: [...activeIntegrationProviders],
    connections,
    syncJobs,
    syncCursors,
    imports,
    providerStates,
    duplicateImportGroups,
    hiddenUnsupportedConnectionCount: snapshot.connections.length - connections.length,
    hiddenUnsupportedImportCount: snapshot.imports.length - imports.length,
    mappedImportCount: providerStates.reduce((total, row) => total + row.mappedImports, 0),
    unmappedImportCount: providerStates.reduce((total, row) => total + row.unmappedImports, 0)
  };
}

function buildActivationReport(snapshot: Phase6IntegrationsUiSnapshot): Phase6ActivationReport {
  const connectedProviders = snapshot.providerStates
    .filter((row) => row.connection?.status === "active")
    .map((row) => row.provider);
  const missingProviders = activeIntegrationProviders.filter((provider) => !connectedProviders.includes(provider));
  const queuedOrRunningSyncJobCount = snapshot.syncJobs.filter((job) =>
    ["queued", "running", "retry_scheduled"].includes(job.status)
  ).length;
  const totalImports = snapshot.mappedImportCount + snapshot.unmappedImportCount;

  return {
    requiredProviders: [...activeIntegrationProviders],
    connectedProviders,
    missingProviders,
    queuedOrRunningSyncJobCount,
    duplicateImportGroups: snapshot.duplicateImportGroups,
    mappedImportCount: snapshot.mappedImportCount,
    unmappedImportCount: snapshot.unmappedImportCount,
    mappingCoverage: totalImports > 0 ? snapshot.mappedImportCount / totalImports : 1,
    ready:
      missingProviders.length === 0 &&
      snapshot.duplicateImportGroups.length === 0 &&
      queuedOrRunningSyncJobCount === 0
  };
}

export function createPhase6IntegrationsUiFlow() {
  const supabase = createMobileSupabaseClient();
  const integrations = new IntegrationService(supabase);
  const baseFlow = createPhase6IntegrationsFlow();

  const loadSnapshot = async (
    userId: string,
    provider?: IntegrationProvider
  ): Promise<Phase6IntegrationsUiSnapshot> => {
    if (provider) {
      assertActiveProvider(provider);
    }

    const snapshot = await baseFlow.load(userId, provider);
    return buildUiSnapshot(snapshot);
  };

  const runMutation = async (
    userId: string,
    provider: ActiveIntegrationProvider,
    action: Phase6IntegrationsMutationSuccess["action"],
    mutate: () => Promise<Partial<Phase6IntegrationsMutationSuccess>>
  ): Promise<Phase6IntegrationsMutationResult> => {
    try {
      const payload = await mutate();
      const snapshot = await loadSnapshot(userId, provider);

      return {
        ok: true,
        action,
        provider,
        snapshot,
        ...payload
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase6IntegrationsUiChecklist],
    activeProviders: [...activeIntegrationProviders],
    load: async (userId: string, provider?: IntegrationProvider): Promise<Phase6IntegrationsLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(userId, provider)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    connectProvider: async (
      userId: string,
      provider: IntegrationProvider,
      input: ConnectProviderInput = {}
    ): Promise<Phase6IntegrationsMutationResult> => {
      try {
        const activeProvider = assertActiveProvider(provider);

        return await runMutation(userId, activeProvider, "connect_provider", async () => {
          const connection = await integrations.upsertConnection(userId, {
            provider: activeProvider,
            status: "active",
            providerUserId: input.providerUserId,
            scopes: input.scopes,
            accessTokenEncrypted: input.accessTokenEncrypted,
            refreshTokenEncrypted: input.refreshTokenEncrypted,
            tokenExpiresAt: input.tokenExpiresAt,
            metadata: input.metadata
          });

          let syncJob: DeviceSyncJob | undefined;
          if (input.queueInitialSync !== false) {
            syncJob = await integrations.queueSyncJob(userId, {
              connectionId: connection.id,
              jobType: "pull_activities",
              cursor: input.initialSyncCursor ?? {}
            });
          }

          return {
            provider: activeProvider,
            connection,
            syncJob
          };
        });
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    disconnectProvider: async (
      userId: string,
      provider: IntegrationProvider
    ): Promise<Phase6IntegrationsMutationResult> => {
      try {
        const activeProvider = assertActiveProvider(provider);

        return await runMutation(userId, activeProvider, "disconnect_provider", async () => {
          const connections = await integrations.listConnections(userId, activeProvider, 5);
          const target = connections.find((row) => row.status === "active") ?? connections[0];

          if (!target) {
            throw new KruxtAppError("INTEGRATION_CONNECTION_NOT_FOUND", "Provider connection not found.");
          }

          const connection = await integrations.updateConnectionStatus(userId, target.id, "revoked");

          return {
            provider: activeProvider,
            connection
          };
        });
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    queueSync: async (
      userId: string,
      input: QueueDeviceSyncJobInput
    ): Promise<Phase6IntegrationsMutationResult> => {
      try {
        const connections = await integrations.listConnections(userId, undefined, 50);
        const connection = connections.find((row) => row.id === input.connectionId);
        if (!connection) {
          throw new KruxtAppError("INTEGRATION_CONNECTION_NOT_FOUND", "Provider connection not found.");
        }

        const activeProvider = assertActiveProvider(connection.provider);

        return runMutation(userId, activeProvider, "queue_sync", async () => {
          const syncJob = await integrations.queueSyncJob(userId, input);

          return {
            provider: activeProvider,
            connection,
            syncJob
          };
        });
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    validateActivation: async (userId: string): Promise<Phase6ActivationValidationResult> => {
      try {
        const snapshot = await loadSnapshot(userId);
        return {
          ok: true,
          snapshot,
          report: buildActivationReport(snapshot)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    }
  };
}
