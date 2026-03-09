import type { RankTier, WorkoutType, WorkoutVisibility } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const WORKOUT_PROOF_BUCKET = "workout-proof-media";
const MAX_PROOF_FILES = 4;
const MAX_PROOF_FILE_BYTES = 50 * 1024 * 1024;

export interface WorkoutLogContext {
  chainDays: number;
  rankTier: RankTier;
  level: number;
  xpTotal: number;
  homeGymId: string | null;
  gyms: Array<{
    id: string;
    name: string;
  }>;
}

export interface ExerciseSearchResult {
  id: string;
  name: string;
}

export interface SubmitWorkoutInput {
  title: string;
  notes?: string;
  workoutType: WorkoutType;
  visibility: WorkoutVisibility;
  gymId?: string | null;
  startedAt?: string;
  rpe?: number;
  exercise: {
    exerciseId: string;
    targetReps?: string;
    targetWeightKg?: number;
    notes?: string;
    set: {
      reps?: number;
      weightKg?: number;
      rpe?: number;
    };
  };
}

export interface SubmitWorkoutResult {
  workoutId: string;
  xpDelta: {
    xpBefore: number;
    xpAfter: number;
    levelBefore: number;
    levelAfter: number;
    chainDaysBefore: number;
    chainDaysAfter: number;
    rankTierBefore: RankTier;
    rankTierAfter: RankTier;
  };
}

export interface UploadWorkoutProofResult {
  uploadedCount: number;
}

async function requireUser(client: SupabaseClient): Promise<{ id: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return { id: data.user.id };
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const sanitized = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return sanitized.replace(/^-|-$/g, "") || "proof";
}

function inferMediaKind(mimeType: string): "image" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function isMissingWorkoutProofMediaDependency(error: { message?: string | null } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("workout_proof_media") ||
    message.includes(WORKOUT_PROOF_BUCKET) ||
    message.includes("bucket not found")
  );
}

export async function loadWorkoutLogContext(client: SupabaseClient): Promise<WorkoutLogContext> {
  const user = await requireUser(client);

  const [{ data: profileData, error: profileError }, { data: membershipsData, error: membershipsError }] =
    await Promise.all([
      client
        .from("profiles")
        .select("chain_days,rank_tier,level,xp_total,home_gym_id")
        .eq("id", user.id)
        .maybeSingle(),
      client
        .from("gym_memberships")
        .select("gym_id,membership_status")
        .eq("user_id", user.id)
        .in("membership_status", ["trial", "active"])
    ]);

  if (profileError) {
    throw new Error(profileError.message || "Unable to load workout context.");
  }
  if (membershipsError) {
    throw new Error(membershipsError.message || "Unable to load gym access.");
  }

  const gymIds = Array.from(
    new Set(
      (((membershipsData ?? []) as Array<{ gym_id: string }> | null) ?? []).map((item) => item.gym_id)
    )
  );

  const gymsResponse =
    gymIds.length > 0
      ? await client.from("gyms").select("id,name").in("id", gymIds)
      : { data: [] as Array<{ id: string; name: string }> | null, error: null };

  if (gymsResponse.error) {
    throw new Error(gymsResponse.error.message || "Unable to load gyms.");
  }

  return {
    chainDays: (profileData?.chain_days as number | null | undefined) ?? 0,
    rankTier: (profileData?.rank_tier as RankTier | null | undefined) ?? "initiate",
    level: (profileData?.level as number | null | undefined) ?? 1,
    xpTotal: (profileData?.xp_total as number | null | undefined) ?? 0,
    homeGymId: (profileData?.home_gym_id as string | null | undefined) ?? null,
    gyms: (((gymsResponse.data ?? []) as Array<{ id: string; name: string }>) ?? []).sort((left, right) =>
      left.name.localeCompare(right.name)
    )
  };
}

export async function searchExercises(
  client: SupabaseClient,
  query: string
): Promise<ExerciseSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const { data, error } = await client
    .from("exercises")
    .select("id,name")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(12);

  if (error) {
    throw new Error(error.message || "Unable to search exercises.");
  }

  return (((data ?? []) as Array<{ id: string; name: string }>) ?? []).map((item) => ({
    id: item.id,
    name: item.name
  }));
}

export async function submitWorkout(
  client: SupabaseClient,
  input: SubmitWorkoutInput
): Promise<SubmitWorkoutResult> {
  const user = await requireUser(client);

  const { data: beforeProfile, error: beforeError } = await client
    .from("profiles")
    .select("xp_total,level,chain_days,rank_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (beforeError) {
    throw new Error(beforeError.message || "Unable to load profile progress.");
  }

  const { data: hasRequiredConsents, error: consentError } = await client.rpc("user_has_required_consents", {
    p_user_id: user.id
  });

  if (consentError) {
    throw new Error(consentError.message || "Unable to validate legal consent requirements.");
  }

  if (!hasRequiredConsents) {
    throw new Error("Required legal consents are missing. Review your account consents before logging workouts.");
  }

  const { data: workoutIdData, error: logError } = await client.rpc("log_workout_atomic", {
    p_workout: {
      gym_id: input.gymId ?? null,
      title: input.title.trim() || "Workout Session",
      workout_type: input.workoutType,
      notes: input.notes?.trim() || null,
      started_at: input.startedAt ?? new Date().toISOString(),
      ended_at: null,
      rpe: typeof input.rpe === "number" ? input.rpe : null,
      visibility: input.visibility,
      source: "manual",
      external_activity_id: null
    },
    p_exercises: [
      {
        exercise_id: input.exercise.exerciseId,
        order_index: 1,
        block_id: null,
        block_type: "straight_set",
        target_reps: input.exercise.targetReps ?? null,
        target_weight_kg: input.exercise.targetWeightKg ?? null,
        notes: input.exercise.notes?.trim() || null,
        sets: [
          {
            set_index: 1,
            reps: input.exercise.set.reps ?? null,
            weight_kg: input.exercise.set.weightKg ?? null,
            duration_seconds: null,
            distance_m: null,
            rpe: input.exercise.set.rpe ?? null,
            is_pr: false
          }
        ]
      }
    ]
  });

  if (logError) {
    throw new Error(logError.message || "Unable to log workout.");
  }

  const workoutId = workoutIdData as string | null;
  if (!workoutId) {
    throw new Error("Workout logging completed without a workout id.");
  }

  const { data: afterProfile, error: afterError } = await client
    .from("profiles")
    .select("xp_total,level,chain_days,rank_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (afterError) {
    throw new Error(afterError.message || "Unable to load updated progress.");
  }

  const xpBefore = (beforeProfile?.xp_total as number | null | undefined) ?? 0;
  const xpAfter = (afterProfile?.xp_total as number | null | undefined) ?? xpBefore;
  const levelBefore = (beforeProfile?.level as number | null | undefined) ?? 1;
  const levelAfter = (afterProfile?.level as number | null | undefined) ?? levelBefore;
  const chainDaysBefore = (beforeProfile?.chain_days as number | null | undefined) ?? 0;
  const chainDaysAfter = (afterProfile?.chain_days as number | null | undefined) ?? chainDaysBefore;
  const rankTierBefore = (beforeProfile?.rank_tier as RankTier | null | undefined) ?? "initiate";
  const rankTierAfter = (afterProfile?.rank_tier as RankTier | null | undefined) ?? rankTierBefore;

  return {
    workoutId,
    xpDelta: {
      xpBefore,
      xpAfter,
      levelBefore,
      levelAfter,
      chainDaysBefore,
      chainDaysAfter,
      rankTierBefore,
      rankTierAfter
    }
  };
}

export async function uploadWorkoutProofMedia(
  client: SupabaseClient,
  input: {
    workoutId: string;
    files: File[];
  }
): Promise<UploadWorkoutProofResult> {
  const user = await requireUser(client);

  if (input.files.length === 0) {
    return { uploadedCount: 0 };
  }

  if (input.files.length > MAX_PROOF_FILES) {
    throw new Error(`Upload up to ${MAX_PROOF_FILES} proof files per workout.`);
  }

  let sortOrder = 1;
  const uploadedPaths: string[] = [];
  let uploadedCount = 0;

  try {
    for (const file of input.files) {
      const mediaKind = inferMediaKind(file.type);
      if (!mediaKind) {
        throw new Error("Only image and video proof files are supported.");
      }

      if (file.size > MAX_PROOF_FILE_BYTES) {
        throw new Error("Each proof file must be 50 MB or smaller.");
      }

      const fileName = sanitizeFileName(file.name);
      const objectPath = `${user.id}/${input.workoutId}/${Date.now()}-${sortOrder}-${fileName}`;

      const { error: uploadError } = await client.storage.from(WORKOUT_PROOF_BUCKET).upload(objectPath, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600"
      });

      if (uploadError) {
        if (isMissingWorkoutProofMediaDependency(uploadError)) {
          throw new Error(
            "Workout proof media storage is not ready yet. Apply the workout proof media migration in Supabase first."
          );
        }

        throw new Error(uploadError.message || "Unable to upload proof file.");
      }

      uploadedPaths.push(objectPath);

      const { error: insertError } = await client.from("workout_proof_media").insert({
        workout_id: input.workoutId,
        uploader_user_id: user.id,
        storage_bucket: WORKOUT_PROOF_BUCKET,
        storage_path: objectPath,
        media_kind: mediaKind,
        mime_type: file.type || "application/octet-stream",
        file_bytes: file.size,
        sort_order: sortOrder
      });

      if (insertError) {
        await client.storage.from(WORKOUT_PROOF_BUCKET).remove([objectPath]);

        if (isMissingWorkoutProofMediaDependency(insertError)) {
          throw new Error(
            "Workout proof media database contract is not ready yet. Apply the workout proof media migration in Supabase first."
          );
        }

        throw new Error(insertError.message || "Unable to register proof media.");
      }

      uploadedCount += 1;
      sortOrder += 1;
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage.from(WORKOUT_PROOF_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  return { uploadedCount };
}
