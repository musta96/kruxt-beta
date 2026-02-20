import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  LogUserAuthEventInput,
  UpsertTrustedDeviceInput,
  UpsertUserSecuritySettingsInput,
  UserAuthEvent,
  UserSecuritySettings,
  UserTrustedDevice
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type UserSecuritySettingsRow = {
  user_id: string;
  mfa_required: boolean;
  mfa_enabled: boolean;
  passkey_enabled: boolean;
  new_device_alerts: boolean;
  login_alert_channel: UserSecuritySettings["loginAlertChannel"];
  session_timeout_minutes: number;
  allow_multi_device_sessions: boolean;
  password_updated_at: string | null;
  last_security_reviewed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type UserTrustedDeviceRow = {
  id: string;
  user_id: string;
  device_id: string;
  platform: UserTrustedDevice["platform"];
  device_name: string | null;
  app_version: string | null;
  os_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_ip: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type UserAuthEventRow = {
  id: string;
  user_id: string;
  event_type: UserAuthEvent["eventType"];
  risk_level: UserAuthEvent["riskLevel"];
  device_id: string | null;
  platform: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function mapUserSecuritySettings(row: UserSecuritySettingsRow): UserSecuritySettings {
  return {
    userId: row.user_id,
    mfaRequired: row.mfa_required,
    mfaEnabled: row.mfa_enabled,
    passkeyEnabled: row.passkey_enabled,
    newDeviceAlerts: row.new_device_alerts,
    loginAlertChannel: row.login_alert_channel,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    allowMultiDeviceSessions: row.allow_multi_device_sessions,
    passwordUpdatedAt: row.password_updated_at,
    lastSecurityReviewedAt: row.last_security_reviewed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserTrustedDevice(row: UserTrustedDeviceRow): UserTrustedDevice {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    platform: row.platform,
    deviceName: row.device_name,
    appVersion: row.app_version,
    osVersion: row.os_version,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastIp: row.last_ip,
    isActive: row.is_active,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by_user_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUserAuthEvent(row: UserAuthEventRow): UserAuthEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    riskLevel: row.risk_level,
    deviceId: row.device_id,
    platform: row.platform,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    success: row.success,
    failureReason: row.failure_reason,
    occurredAt: row.occurred_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

export class SecurityService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async getCurrentUser(): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser();
    throwIfError(error, "SECURITY_AUTH_READ_FAILED", "Unable to read security user.");

    if (!data.user) {
      throw new KruxtAppError("SECURITY_AUTH_REQUIRED", "Sign in is required for security actions.");
    }

    return data.user;
  }

  async getSecuritySettings(): Promise<UserSecuritySettings> {
    const user = await this.getCurrentUser();

    const { data, error } = await this.supabase
      .from("user_security_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    throwIfError(error, "SECURITY_SETTINGS_READ_FAILED", "Unable to load security settings.");

    if (data) {
      return mapUserSecuritySettings(data as UserSecuritySettingsRow);
    }

    const { data: created, error: createError } = await this.supabase
      .from("user_security_settings")
      .upsert({ user_id: user.id }, { onConflict: "user_id" })
      .select("*")
      .single();

    throwIfError(createError, "SECURITY_SETTINGS_CREATE_FAILED", "Unable to initialize security settings.");
    return mapUserSecuritySettings(created as UserSecuritySettingsRow);
  }

  async upsertSecuritySettings(input: UpsertUserSecuritySettingsInput): Promise<UserSecuritySettings> {
    const user = await this.getCurrentUser();

    const payload: Record<string, unknown> = {
      user_id: user.id
    };

    if (input.mfaRequired !== undefined) payload.mfa_required = input.mfaRequired;
    if (input.mfaEnabled !== undefined) payload.mfa_enabled = input.mfaEnabled;
    if (input.passkeyEnabled !== undefined) payload.passkey_enabled = input.passkeyEnabled;
    if (input.newDeviceAlerts !== undefined) payload.new_device_alerts = input.newDeviceAlerts;
    if (input.loginAlertChannel !== undefined) payload.login_alert_channel = input.loginAlertChannel;
    if (input.sessionTimeoutMinutes !== undefined) payload.session_timeout_minutes = input.sessionTimeoutMinutes;
    if (input.allowMultiDeviceSessions !== undefined) payload.allow_multi_device_sessions = input.allowMultiDeviceSessions;
    if (input.passwordUpdatedAt !== undefined) payload.password_updated_at = input.passwordUpdatedAt;
    if (input.lastSecurityReviewedAt !== undefined) payload.last_security_reviewed_at = input.lastSecurityReviewedAt;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("user_security_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    throwIfError(error, "SECURITY_SETTINGS_UPSERT_FAILED", "Unable to save security settings.");
    return mapUserSecuritySettings(data as UserSecuritySettingsRow);
  }

  async listTrustedDevices(limit = 100): Promise<UserTrustedDevice[]> {
    const user = await this.getCurrentUser();

    const { data, error } = await this.supabase
      .from("user_trusted_devices")
      .select("*")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    throwIfError(error, "SECURITY_TRUSTED_DEVICES_READ_FAILED", "Unable to load trusted devices.");
    return ((data as UserTrustedDeviceRow[]) ?? []).map(mapUserTrustedDevice);
  }

  async upsertTrustedDevice(input: UpsertTrustedDeviceInput): Promise<UserTrustedDevice> {
    const user = await this.getCurrentUser();

    const payload: Record<string, unknown> = {
      user_id: user.id,
      device_id: input.deviceId,
      platform: input.platform ?? "unknown"
    };

    if (input.deviceName !== undefined) payload.device_name = input.deviceName;
    if (input.appVersion !== undefined) payload.app_version = input.appVersion;
    if (input.osVersion !== undefined) payload.os_version = input.osVersion;
    if (input.lastSeenAt !== undefined) payload.last_seen_at = input.lastSeenAt;
    if (input.lastIp !== undefined) payload.last_ip = input.lastIp;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.revokedAt !== undefined) payload.revoked_at = input.revokedAt;
    if (input.revokedByUserId !== undefined) payload.revoked_by_user_id = input.revokedByUserId;
    if (input.metadata !== undefined) payload.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("user_trusted_devices")
      .upsert(payload, { onConflict: "user_id,device_id" })
      .select("*")
      .single();

    throwIfError(error, "SECURITY_TRUSTED_DEVICE_UPSERT_FAILED", "Unable to save trusted device.");
    return mapUserTrustedDevice(data as UserTrustedDeviceRow);
  }

  async revokeTrustedDevice(deviceId: string): Promise<UserTrustedDevice> {
    const user = await this.getCurrentUser();

    const { data, error } = await this.supabase
      .from("user_trusted_devices")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: user.id
      })
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    throwIfError(error, "SECURITY_TRUSTED_DEVICE_REVOKE_FAILED", "Unable to revoke trusted device.");
    return mapUserTrustedDevice(data as UserTrustedDeviceRow);
  }

  async listAuthEvents(limit = 200): Promise<UserAuthEvent[]> {
    const user = await this.getCurrentUser();

    const { data, error } = await this.supabase
      .from("user_auth_events")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 1000));

    throwIfError(error, "SECURITY_AUTH_EVENTS_READ_FAILED", "Unable to load auth event history.");
    return ((data as UserAuthEventRow[]) ?? []).map(mapUserAuthEvent);
  }

  async logAuthEvent(input: LogUserAuthEventInput): Promise<UserAuthEvent> {
    const { data, error } = await this.supabase.rpc("log_user_auth_event", {
      p_event_type: input.eventType,
      p_risk_level: input.riskLevel ?? "low",
      p_device_id: input.deviceId ?? null,
      p_platform: input.platform ?? null,
      p_ip_address: input.ipAddress ?? null,
      p_user_agent: input.userAgent ?? null,
      p_success: input.success ?? true,
      p_failure_reason: input.failureReason ?? null,
      p_metadata: input.metadata ?? {}
    });

    throwIfError(error, "SECURITY_AUTH_EVENT_LOG_FAILED", "Unable to log auth event.");

    const row = data as UserAuthEventRow | null;
    if (!row) {
      throw new KruxtAppError("SECURITY_AUTH_EVENT_LOG_EMPTY", "Auth event logging returned no row.");
    }

    return mapUserAuthEvent(row);
  }
}
