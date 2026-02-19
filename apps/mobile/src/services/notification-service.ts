import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NotificationPreferences,
  PushNotificationToken,
  RegisterPushTokenInput,
  UpsertNotificationPreferencesInput
} from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";

type NotificationPreferencesRow = {
  id: string;
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  marketing_enabled: boolean;
  workout_reactions_enabled: boolean;
  comments_enabled: boolean;
  challenge_updates_enabled: boolean;
  class_reminders_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

type PushNotificationTokenRow = {
  id: string;
  user_id: string;
  device_id: string;
  platform: "ios" | "android" | "web";
  push_token: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

function mapPreferences(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    pushEnabled: row.push_enabled,
    emailEnabled: row.email_enabled,
    inAppEnabled: row.in_app_enabled,
    marketingEnabled: row.marketing_enabled,
    workoutReactionsEnabled: row.workout_reactions_enabled,
    commentsEnabled: row.comments_enabled,
    challengeUpdatesEnabled: row.challenge_updates_enabled,
    classRemindersEnabled: row.class_reminders_enabled,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPushToken(row: PushNotificationTokenRow): PushNotificationToken {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    platform: row.platform,
    pushToken: row.push_token,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class NotificationService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async resolveUserId(userId?: string): Promise<string> {
    if (userId) {
      return userId;
    }

    const { data, error } = await this.supabase.auth.getUser();
    throwIfError(error, "AUTH_GET_USER_FAILED", "Unable to resolve current user.");

    if (!data.user) {
      throw new KruxtAppError("AUTH_REQUIRED", "Authentication required.");
    }

    return data.user.id;
  }

  async getPreferences(userId?: string): Promise<NotificationPreferences> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    throwIfError(error, "NOTIFICATION_PREFS_READ_FAILED", "Unable to load notification preferences.");

    if (data) {
      return mapPreferences(data as NotificationPreferencesRow);
    }

    const { data: createdData, error: createError } = await this.supabase
      .from("notification_preferences")
      .insert({
        user_id: resolvedUserId
      })
      .select("*")
      .single();

    throwIfError(createError, "NOTIFICATION_PREFS_CREATE_FAILED", "Unable to initialize notification preferences.");

    return mapPreferences(createdData as NotificationPreferencesRow);
  }

  async upsertPreferences(input: UpsertNotificationPreferencesInput, userId?: string): Promise<NotificationPreferences> {
    const resolvedUserId = await this.resolveUserId(userId);

    const payload = {
      user_id: resolvedUserId,
      push_enabled: input.pushEnabled,
      email_enabled: input.emailEnabled,
      in_app_enabled: input.inAppEnabled,
      marketing_enabled: input.marketingEnabled,
      workout_reactions_enabled: input.workoutReactionsEnabled,
      comments_enabled: input.commentsEnabled,
      challenge_updates_enabled: input.challengeUpdatesEnabled,
      class_reminders_enabled: input.classRemindersEnabled,
      quiet_hours_start: input.quietHoursStart,
      quiet_hours_end: input.quietHoursEnd,
      timezone: input.timezone
    };

    const { data, error } = await this.supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    throwIfError(error, "NOTIFICATION_PREFS_UPSERT_FAILED", "Unable to save notification preferences.");

    return mapPreferences(data as NotificationPreferencesRow);
  }

  async registerPushToken(input: RegisterPushTokenInput, userId?: string): Promise<PushNotificationToken> {
    const resolvedUserId = await this.resolveUserId(userId);
    const nowIso = new Date().toISOString();

    if (input.deviceId.trim().length === 0) {
      throw new KruxtAppError("PUSH_DEVICE_ID_REQUIRED", "Device id is required for push token registration.");
    }

    if (input.pushToken.trim().length === 0) {
      throw new KruxtAppError("PUSH_TOKEN_REQUIRED", "Push token is required.");
    }

    const { data: existingByTokenData, error: existingByTokenError } = await this.supabase
      .from("push_notification_tokens")
      .select("*")
      .eq("user_id", resolvedUserId)
      .eq("push_token", input.pushToken)
      .maybeSingle();

    throwIfError(existingByTokenError, "PUSH_TOKEN_LOOKUP_FAILED", "Unable to check existing push token state.");

    if (existingByTokenData) {
      const { data, error } = await this.supabase
        .from("push_notification_tokens")
        .update({
          device_id: input.deviceId,
          platform: input.platform,
          is_active: true,
          last_seen_at: nowIso
        })
        .eq("id", (existingByTokenData as PushNotificationTokenRow).id)
        .select("*")
        .single();

      throwIfError(error, "PUSH_TOKEN_UPDATE_FAILED", "Unable to refresh existing push token.");

      return mapPushToken(data as PushNotificationTokenRow);
    }

    const { data, error } = await this.supabase
      .from("push_notification_tokens")
      .upsert(
        {
          user_id: resolvedUserId,
          device_id: input.deviceId,
          platform: input.platform,
          push_token: input.pushToken,
          is_active: true,
          last_seen_at: nowIso
        },
        { onConflict: "user_id,device_id" }
      )
      .select("*")
      .single();

    throwIfError(error, "PUSH_TOKEN_REGISTER_FAILED", "Unable to register push token.");

    return mapPushToken(data as PushNotificationTokenRow);
  }

  async deactivatePushTokenByDevice(deviceId: string, userId?: string): Promise<void> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("push_notification_tokens")
      .update({ is_active: false })
      .eq("user_id", resolvedUserId)
      .eq("device_id", deviceId);

    throwIfError(error, "PUSH_TOKEN_DEACTIVATE_FAILED", "Unable to deactivate push token by device.");
  }

  async deactivatePushToken(pushToken: string, userId?: string): Promise<void> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { error } = await this.supabase
      .from("push_notification_tokens")
      .update({ is_active: false })
      .eq("user_id", resolvedUserId)
      .eq("push_token", pushToken);

    throwIfError(error, "PUSH_TOKEN_DEACTIVATE_FAILED", "Unable to deactivate push token.");
  }

  async listActivePushTokens(userId?: string, limit = 10): Promise<PushNotificationToken[]> {
    const resolvedUserId = await this.resolveUserId(userId);

    const { data, error } = await this.supabase
      .from("push_notification_tokens")
      .select("*")
      .eq("user_id", resolvedUserId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    throwIfError(error, "PUSH_TOKENS_LIST_FAILED", "Unable to list active push tokens.");

    return ((data as PushNotificationTokenRow[]) ?? []).map(mapPushToken);
  }
}
