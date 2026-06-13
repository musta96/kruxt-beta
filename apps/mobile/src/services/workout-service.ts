import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LegalLocalizationOptions,
  LogWorkoutAtomicInput,
  RankTier,
  WorkoutType,
  WorkoutVisibility
} from "@kruxt/types";
import { translateLegalText } from "@kruxt/types";
import * as VideoThumbnails from "expo-video-thumbnails";

import { KruxtAppError, throwIfError } from "./errors";

type WorkoutRow = {
  id: string;
  user_id: string;
  gym_id: string | null;
  title: string;
  workout_type: WorkoutType;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  rpe: number | null;
  visibility: WorkoutVisibility;
  total_sets: number;
  total_volume_kg: number;
  is_pr: boolean;
  source: string;
  created_at: string;
  proof_media_url: string | null;
  proof_media_type: "image" | "video" | null;
  proof_media_thumbnail_url: string | null;
};

type FeedEventRow = {
  id: string;
  workout_id: string | null;
  event_type: string;
  caption: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileProgressRow = {
  id: string;
  xp_total: number;
  level: number;
  rank_tier: RankTier;
  chain_days: number;
  last_workout_at: string | null;
};

type RequiredConsentGapRow = {
  consent_type: "terms" | "privacy" | "health_data_processing";
  required_policy_version_id: string | null;
  required_policy_version: string | null;
  reason:
    | "missing_active_policy"
    | "missing_consent_record"
    | "latest_record_revoked"
    | "missing_policy_binding"
    | "reconsent_required";
};

export interface LoggedWorkoutSnapshot {
  id: string;
  userId: string;
  gymId?: string | null;
  title: string;
  workoutType: WorkoutType;
  notes?: string | null;
  startedAt: string;
  endedAt?: string | null;
  rpe?: number | null;
  visibility: WorkoutVisibility;
  totalSets: number;
  totalVolumeKg: number;
  isPr: boolean;
  source: string;
  createdAt: string;
  proofMediaUrl?: string | null;
  proofMediaType?: "image" | "video" | null;
  proofMediaThumbnailUrl?: string | null;
}

export interface WorkoutProofEvent {
  id: string;
  workoutId?: string | null;
  eventType: string;
  caption?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkoutProgressSnapshot {
  userId: string;
  xpTotal: number;
  level: number;
  rankTier: RankTier;
  chainDays: number;
  lastWorkoutAt?: string | null;
}

export interface LogWorkoutAtomicResult {
  workoutId: string;
  workout: LoggedWorkoutSnapshot;
  proofEvents: WorkoutProofEvent[];
  progress: WorkoutProgressSnapshot;
}

function mapWorkout(row: WorkoutRow): LoggedWorkoutSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    gymId: row.gym_id,
    title: row.title,
    workoutType: row.workout_type,
    notes: row.notes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    rpe: row.rpe,
    visibility: row.visibility,
    totalSets: row.total_sets,
    totalVolumeKg: row.total_volume_kg,
    isPr: row.is_pr,
    source: row.source,
    createdAt: row.created_at,
    proofMediaUrl: row.proof_media_url,
    proofMediaType: row.proof_media_type,
    proofMediaThumbnailUrl: row.proof_media_thumbnail_url
  };
}

function mapEvent(row: FeedEventRow): WorkoutProofEvent {
  return {
    id: row.id,
    workoutId: row.workout_id,
    eventType: row.event_type,
    caption: row.caption,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function toWorkoutPayload(input: LogWorkoutAtomicInput["workout"]): Record<string, unknown> {
  return {
    gym_id: input.gymId ?? null,
    title: input.title ?? "Workout Session",
    workout_type: input.workoutType ?? "strength",
    notes: input.notes ?? null,
    started_at: input.startedAt ?? null,
    ended_at: input.endedAt ?? null,
    rpe: input.rpe ?? null,
    visibility: input.visibility ?? "public",
    source: input.source ?? "manual",
    external_activity_id: input.externalActivityId ?? null
  };
}

function toExercisePayload(
  input: LogWorkoutAtomicInput["exercises"]
): Array<Record<string, unknown>> {
  return input.map((exercise, index) => ({
    exercise_id: exercise.exerciseId,
    order_index: exercise.orderIndex ?? index + 1,
    block_id: exercise.blockId ?? null,
    block_type: exercise.blockType ?? "straight_set",
    target_reps: exercise.targetReps ?? null,
    target_weight_kg: exercise.targetWeightKg ?? null,
    notes: exercise.notes ?? null,
    sets: (exercise.sets ?? []).map((set, setIndex) => ({
      set_index: set.setIndex ?? setIndex + 1,
      reps: set.reps ?? null,
      weight_kg: set.weightKg ?? null,
      duration_seconds: set.durationSeconds ?? null,
      distance_m: set.distanceM ?? null,
      rpe: set.rpe ?? null,
      is_pr: set.isPr ?? false
    }))
  }));
}

export class WorkoutService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly localization: Pick<LegalLocalizationOptions, "locale"> = {}
  ) {}

  private async requireCurrentUserId(): Promise<string> {
    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    throwIfError(authError, "AUTH_GET_USER_FAILED", "Unable to resolve current user.");

    const currentUser = authData.user;
    if (!currentUser) {
      throw new KruxtAppError("AUTH_REQUIRED", "Authentication required.");
    }

    return currentUser.id;
  }

  private async ensureConsentGate(userId: string): Promise<void> {
    const { data: hasRequiredConsents, error: gateError } = await this.supabase.rpc("user_has_required_consents", {
      p_user_id: userId
    });

    throwIfError(gateError, "CONSENT_GATE_CHECK_FAILED", "Unable to validate legal consent requirements.");

    if (Boolean(hasRequiredConsents)) {
      return;
    }

    const { data: missingData, error: missingError } = await this.supabase.rpc("list_missing_required_consents", {
      p_user_id: userId
    });

    throwIfError(missingError, "CONSENT_GAPS_READ_FAILED", "Unable to load required consent gaps.");

    throw new KruxtAppError(
      "RECONSENT_REQUIRED",
      translateLegalText("legal.error.reconsent_required_workout", this.localization),
      { missing: (missingData as RequiredConsentGapRow[]) ?? [] }
    );
  }

  async logWorkoutAtomic(input: LogWorkoutAtomicInput): Promise<LogWorkoutAtomicResult> {
    if ((input.exercises ?? []).length === 0) {
      throw new KruxtAppError(
        "WORKOUT_EXERCISES_REQUIRED",
        "Workout logging requires at least one exercise block."
      );
    }

    const currentUserId = await this.requireCurrentUserId();
    await this.ensureConsentGate(currentUserId);

    const { data: workoutIdData, error: logError } = await this.supabase.rpc("log_workout_atomic", {
      p_workout: toWorkoutPayload(input.workout),
      p_exercises: toExercisePayload(input.exercises)
    });

    throwIfError(logError, "WORKOUT_LOG_RPC_FAILED", "Unable to log workout.");

    const workoutId = workoutIdData as string | null;
    if (!workoutId) {
      throw new KruxtAppError("WORKOUT_LOG_RPC_NO_ID", "Workout logging completed without a workout id.");
    }

    const [workoutResponse, feedResponse, profileResponse] = await Promise.all([
      this.supabase
        .from("workouts")
        .select(
          "id,user_id,gym_id,title,workout_type,notes,started_at,ended_at,rpe,visibility,total_sets,total_volume_kg,is_pr,source,created_at,proof_media_url,proof_media_type,proof_media_thumbnail_url"
        )
        .eq("id", workoutId)
        .maybeSingle(),
      this.supabase
        .from("feed_events")
        .select("id,workout_id,event_type,caption,metadata,created_at")
        .eq("workout_id", workoutId)
        .order("created_at", { ascending: true }),
      this.supabase
        .from("profiles")
        .select("id,xp_total,level,rank_tier,chain_days,last_workout_at")
        .eq("id", currentUserId)
        .maybeSingle()
    ]);

    throwIfError(workoutResponse.error, "WORKOUT_READ_FAILED", "Unable to load logged workout.");
    throwIfError(feedResponse.error, "WORKOUT_FEED_READ_FAILED", "Unable to load proof feed events.");
    throwIfError(profileResponse.error, "WORKOUT_PROGRESS_READ_FAILED", "Unable to load updated progress.");

    if (!workoutResponse.data) {
      throw new KruxtAppError("WORKOUT_NOT_FOUND_AFTER_LOG", "Workout was not found after logging.");
    }

    if (!profileResponse.data) {
      throw new KruxtAppError("PROFILE_NOT_FOUND_AFTER_LOG", "Profile was not found after workout logging.");
    }

    const profile = profileResponse.data as ProfileProgressRow;
    return {
      workoutId,
      workout: mapWorkout(workoutResponse.data as WorkoutRow),
      proofEvents: ((feedResponse.data as FeedEventRow[]) ?? []).map(mapEvent),
      progress: {
        userId: profile.id,
        xpTotal: profile.xp_total,
        level: profile.level,
        rankTier: profile.rank_tier,
        chainDays: profile.chain_days,
        lastWorkoutAt: profile.last_workout_at
      }
    };
  }

  /**
   * Uploads a proof photo/video to the `workout-proof` storage bucket and
   * attaches its public URL to the workout row. Called after a workout is
   * logged so the Proof Feed can render it full-bleed.
   *
   * Object path: `<userId>/<workoutId>.<ext>` (matches storage RLS policy).
   */
  async attachProofMedia(
    workoutId: string,
    media: { uri: string; mimeType?: string | null }
  ): Promise<{ url: string; type: "image" | "video" }> {
    const userId = await this.requireCurrentUserId();

    const mimeType = media.mimeType ?? "image/jpeg";
    const mediaType: "image" | "video" = mimeType.startsWith("video") ? "video" : "image";
    const extension = extensionFromMimeType(mimeType);
    const path = `${userId}/${workoutId}.${extension}`;

    // Read the local file URI into bytes (works in Expo / React Native).
    let bytes: Uint8Array;
    try {
      const response = await fetch(media.uri);
      const buffer = await response.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } catch (readError) {
      throw new KruxtAppError(
        "WORKOUT_PROOF_READ_FAILED",
        "Unable to read the selected proof media file.",
        readError
      );
    }

    const storage = this.supabase.storage.from(PROOF_BUCKET);
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
      cacheControl: "3600"
    });

    if (uploadError) {
      throw new KruxtAppError(
        "WORKOUT_PROOF_UPLOAD_FAILED",
        `Proof upload failed. Confirm bucket "${PROOF_BUCKET}" exists and allows authenticated uploads.`,
        uploadError
      );
    }

    const {
      data: { publicUrl }
    } = storage.getPublicUrl(path);

    if (!publicUrl) {
      throw new KruxtAppError(
        "WORKOUT_PROOF_URL_FAILED",
        "Proof upload succeeded but URL generation failed."
      );
    }

    // For videos, generate a poster frame so the feed never flashes black
    // before playback. Best-effort — a thumbnail failure must not fail the
    // proof upload, so the feed falls back to no poster.
    const update: {
      proof_media_url: string;
      proof_media_type: "image" | "video";
      proof_media_thumbnail_url?: string | null;
    } = { proof_media_url: publicUrl, proof_media_type: mediaType };

    if (mediaType === "video") {
      update.proof_media_thumbnail_url = await this.uploadVideoThumbnail(
        userId,
        workoutId,
        media.uri
      );
    }

    const { error: updateError } = await this.supabase
      .from("workouts")
      .update(update)
      .eq("id", workoutId)
      .eq("user_id", userId);

    throwIfError(updateError, "WORKOUT_PROOF_ATTACH_FAILED", "Unable to attach proof media to the workout.");

    return { url: publicUrl, type: mediaType };
  }

  /**
   * Generate a poster frame from the local video and upload it alongside the
   * proof. Returns the public URL, or null if anything fails — callers must
   * treat a missing thumbnail as non-fatal.
   */
  private async uploadVideoThumbnail(
    userId: string,
    workoutId: string,
    videoUri: string
  ): Promise<string | null> {
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0,
        quality: 0.7
      });

      const response = await fetch(thumbUri);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const path = `${userId}/${workoutId}_thumb.jpg`;
      const storage = this.supabase.storage.from(PROOF_BUCKET);
      const { error: uploadError } = await storage.upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "3600"
      });

      if (uploadError) {
        return null;
      }

      const {
        data: { publicUrl }
      } = storage.getPublicUrl(path);

      return publicUrl ?? null;
    } catch {
      return null;
    }
  }
}

const PROOF_BUCKET = "workout-proof";

function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };
  return map[mimeType.toLowerCase()] ?? "bin";
}
