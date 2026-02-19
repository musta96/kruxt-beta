import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, UpsertProfileInput } from "@kruxt/types";

import { KruxtAppError, throwIfError } from "./errors";
import { displayNameFromEmail, usernameFromEmail } from "./utils";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  home_gym_id: string | null;
  is_public: boolean;
  xp_total: number;
  level: number;
  rank_tier: Profile["rankTier"];
  chain_days: number;
  last_workout_at: string | null;
  locale: string | null;
  preferred_units: "metric" | "imperial";
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    homeGymId: row.home_gym_id,
    isPublic: row.is_public,
    xpTotal: row.xp_total,
    level: row.level,
    rankTier: row.rank_tier,
    chainDays: row.chain_days,
    lastWorkoutAt: row.last_workout_at,
    locale: row.locale,
    preferredUnits: row.preferred_units
  };
}

export class ProfileService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getProfileById(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    throwIfError(error, "PROFILE_READ_FAILED", "Unable to read profile.");

    return data ? mapProfile(data as ProfileRow) : null;
  }

  async upsertProfile(userId: string, input: UpsertProfileInput): Promise<Profile> {
    const payload = {
      id: userId,
      username: input.username,
      display_name: input.displayName,
      avatar_url: input.avatarUrl ?? null,
      bio: input.bio ?? null,
      locale: input.locale ?? null,
      preferred_units: input.preferredUnits ?? "metric"
    };

    const { data, error } = await this.supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    throwIfError(error, "PROFILE_UPSERT_FAILED", "Unable to save profile.");

    return mapProfile(data as ProfileRow);
  }

  async setHomeGym(userId: string, gymId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .update({ home_gym_id: gymId })
      .eq("id", userId)
      .select("*")
      .single();

    throwIfError(error, "PROFILE_HOME_GYM_UPDATE_FAILED", "Unable to set home gym.");

    return mapProfile(data as ProfileRow);
  }

  async ensureProfile(
    userId: string,
    userEmail: string,
    preferred: Partial<UpsertProfileInput> = {}
  ): Promise<Profile> {
    const existing = await this.getProfileById(userId);
    if (existing) {
      return existing;
    }

    const seedUsername = (preferred.username ?? usernameFromEmail(userEmail)).slice(0, 24);
    const seedDisplayName = preferred.displayName ?? displayNameFromEmail(userEmail);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = attempt === 0 ? "" : `${Math.floor(Math.random() * 9000) + 1000}`;
      const username = `${seedUsername}${suffix}`.slice(0, 24);

      try {
        return await this.upsertProfile(userId, {
          username,
          displayName: seedDisplayName,
          avatarUrl: preferred.avatarUrl,
          bio: preferred.bio,
          locale: preferred.locale,
          preferredUnits: preferred.preferredUnits
        });
      } catch (error) {
        const appError = error as KruxtAppError;
        const detail = String(appError.details ?? "").toLowerCase();
        if (!detail.includes("profiles_username_key")) {
          throw error;
        }
      }
    }

    throw new KruxtAppError(
      "PROFILE_USERNAME_COLLISION",
      "Unable to allocate a unique username after multiple attempts."
    );
  }
}
