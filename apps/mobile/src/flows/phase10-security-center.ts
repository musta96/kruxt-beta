import type {
  LogUserAuthEventInput,
  UpsertTrustedDeviceInput,
  UpsertUserSecuritySettingsInput,
  UserAuthEvent,
  UserSecuritySettings,
  UserTrustedDevice
} from "@kruxt/types";

import { createMobileSupabaseClient, KruxtAppError, SecurityService } from "../services";

export type Phase10SecurityCenterStep = "settings" | "trusted_devices" | "auth_timeline";

export interface Phase10SecurityCenterError {
  code: string;
  step: Phase10SecurityCenterStep;
  message: string;
  recoverable: boolean;
}

export interface Phase10SecurityCenterSnapshot {
  settings: UserSecuritySettings;
  trustedDevices: UserTrustedDevice[];
  activeTrustedDevices: UserTrustedDevice[];
  authEvents: UserAuthEvent[];
  highRiskAuthEvents: UserAuthEvent[];
}

export interface Phase10SecurityCenterLoadSuccess {
  ok: true;
  snapshot: Phase10SecurityCenterSnapshot;
}

export interface Phase10SecurityCenterLoadFailure {
  ok: false;
  error: Phase10SecurityCenterError;
}

export type Phase10SecurityCenterLoadResult = Phase10SecurityCenterLoadSuccess | Phase10SecurityCenterLoadFailure;

export interface Phase10SecurityCenterMutationSuccess {
  ok: true;
  action: "upsert_settings" | "upsert_trusted_device" | "revoke_trusted_device" | "log_auth_event";
  snapshot: Phase10SecurityCenterSnapshot;
  settings?: UserSecuritySettings;
  trustedDevice?: UserTrustedDevice;
  authEvent?: UserAuthEvent;
}

export interface Phase10SecurityCenterMutationFailure {
  ok: false;
  error: Phase10SecurityCenterError;
}

export type Phase10SecurityCenterMutationResult =
  | Phase10SecurityCenterMutationSuccess
  | Phase10SecurityCenterMutationFailure;

export interface Phase10SecurityCenterLoadOptions {
  trustedDeviceLimit?: number;
  authEventLimit?: number;
}

export const phase10SecurityCenterChecklist = [
  "Load account security settings with fail-safe defaults",
  "Load trusted device registry with revoke action",
  "Load auth event timeline and highlight high-risk events",
  "Apply security mutations with immediate refresh-safe snapshot"
] as const;

function mapErrorStep(code: string): Phase10SecurityCenterStep {
  if (code.includes("SETTINGS")) {
    return "settings";
  }

  if (code.includes("TRUSTED_DEVICE")) {
    return "trusted_devices";
  }

  if (code.includes("AUTH_EVENT") || code.includes("AUTH")) {
    return "auth_timeline";
  }

  return "settings";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "SECURITY_AUTH_REQUIRED") {
    return "Sign in is required before managing security settings.";
  }

  if (code === "SECURITY_AUTH_EVENT_LOG_EMPTY") {
    return "Auth event logging completed without returning event data. Refresh and retry.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase10SecurityCenterError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("SECURITY_CENTER_ACTION_FAILED", "Unable to complete security action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: appError.code !== "SECURITY_AUTH_REQUIRED"
  };
}

export function createPhase10SecurityCenterFlow() {
  const supabase = createMobileSupabaseClient();
  const security = new SecurityService(supabase);

  const loadSnapshot = async (
    options: Phase10SecurityCenterLoadOptions = {}
  ): Promise<Phase10SecurityCenterSnapshot> => {
    const [settings, trustedDevices, authEvents] = await Promise.all([
      security.getSecuritySettings(),
      security.listTrustedDevices(options.trustedDeviceLimit ?? 100),
      security.listAuthEvents(options.authEventLimit ?? 200)
    ]);

    const activeTrustedDevices = trustedDevices.filter((device) => device.isActive && !device.revokedAt);
    const highRiskAuthEvents = authEvents.filter((event) => event.riskLevel === "high");

    return {
      settings,
      trustedDevices,
      activeTrustedDevices,
      authEvents,
      highRiskAuthEvents
    };
  };

  const runMutation = async (
    action: Phase10SecurityCenterMutationSuccess["action"],
    mutate: () => Promise<Partial<Phase10SecurityCenterMutationSuccess>>,
    options: Phase10SecurityCenterLoadOptions = {}
  ): Promise<Phase10SecurityCenterMutationResult> => {
    try {
      const payload = await mutate();
      const snapshot = await loadSnapshot(options);

      return {
        ok: true,
        action,
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
    checklist: [...phase10SecurityCenterChecklist],
    load: async (options: Phase10SecurityCenterLoadOptions = {}): Promise<Phase10SecurityCenterLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    upsertSettings: async (
      input: UpsertUserSecuritySettingsInput,
      options: Phase10SecurityCenterLoadOptions = {}
    ): Promise<Phase10SecurityCenterMutationResult> =>
      runMutation(
        "upsert_settings",
        async () => {
          const settings = await security.upsertSecuritySettings(input);
          return { settings };
        },
        options
      ),
    upsertTrustedDevice: async (
      input: UpsertTrustedDeviceInput,
      options: Phase10SecurityCenterLoadOptions = {}
    ): Promise<Phase10SecurityCenterMutationResult> =>
      runMutation(
        "upsert_trusted_device",
        async () => {
          const trustedDevice = await security.upsertTrustedDevice(input);
          return { trustedDevice };
        },
        options
      ),
    revokeTrustedDevice: async (
      deviceId: string,
      options: Phase10SecurityCenterLoadOptions = {}
    ): Promise<Phase10SecurityCenterMutationResult> =>
      runMutation(
        "revoke_trusted_device",
        async () => {
          const trustedDevice = await security.revokeTrustedDevice(deviceId);
          return { trustedDevice };
        },
        options
      ),
    logAuthEvent: async (
      input: LogUserAuthEventInput,
      options: Phase10SecurityCenterLoadOptions = {}
    ): Promise<Phase10SecurityCenterMutationResult> =>
      runMutation(
        "log_auth_event",
        async () => {
          const authEvent = await security.logAuthEvent(input);
          return { authEvent };
        },
        options
      )
  };
}
