import type { RankTier, WorkoutType, WorkoutVisibility } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const WORKOUT_PROOF_BUCKET = "workout-proof-media";
const MAX_PROOF_FILES = 4;
const MAX_PROOF_FILE_BYTES = 50 * 1024 * 1024;
const WORKOUT_BLOCK_TYPES = ["straight_set", "superset", "circuit", "emom", "amrap"] as const;

export type WorkoutBlockType = (typeof WORKOUT_BLOCK_TYPES)[number];

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
  slug: string;
  category: string;
  movementPattern: string | null;
  equipment: string | null;
}

export interface SubmitWorkoutInput {
  /** Persist with the draft and reuse only for retries of the same submission. */
  idempotencyKey?: string;
  title: string;
  notes?: string;
  workoutType: WorkoutType;
  visibility: WorkoutVisibility;
  gymId?: string | null;
  startedAt?: string;
  rpe?: number;
  exercises: Array<{
    exerciseId: string;
    blockType?: WorkoutBlockType;
    targetReps?: string;
    targetWeightKg?: number;
    notes?: string;
    set: {
      reps?: number;
      weightKg?: number;
      distanceM?: number;
      durationSeconds?: number;
      rpe?: number;
    };
  }>;
}

export interface SubmitWorkoutResult {
  workoutId: string;
  progressAvailable: boolean;
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

export class WorkoutSaveUncertainError extends Error {
  constructor() {
    super("The save response could not be confirmed. Check your activity before starting another workout; do not submit this session again.");
    this.name = "WorkoutSaveUncertainError";
  }
}

export interface UploadWorkoutProofResult {
  uploadedCount: number;
}

export interface WorkoutTemplateDayExercise {
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  category: string;
  equipment: string | null;
  stationLabel: string;
  notes: string;
  blockType: WorkoutBlockType;
  reps?: string;
  weightKg?: number;
  distanceM?: number;
  durationSeconds?: number;
}

export interface WorkoutTemplateDay {
  id: string;
  label: string;
  notes: string;
  exercises: WorkoutTemplateDayExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  workoutType: WorkoutType;
  source: string;
  days: WorkoutTemplateDay[];
}

type WorkoutTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  workout_type: WorkoutType;
  source: string;
  template_days: unknown;
};

type ExerciseRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  movement_pattern: string | null;
  equipment: string | null;
};

async function requireUser(client: SupabaseClient, expectedUserId?: string): Promise<{ id: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }
  if (expectedUserId && data.user.id !== expectedUserId) throw new Error("Your account changed. Reload before continuing.");

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

function isWorkoutBlockType(value: string | null | undefined): value is WorkoutBlockType {
  return WORKOUT_BLOCK_TYPES.includes((value ?? "") as WorkoutBlockType);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mapExerciseRow(item: ExerciseRow): ExerciseSearchResult {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    category: item.category,
    movementPattern: item.movement_pattern,
    equipment: item.equipment
  };
}

function scoreExerciseResult(query: string, item: ExerciseSearchResult): number {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = normalizeSearchText(item.name);
  const normalizedSlug = normalizeSearchText(item.slug);
  const normalizedCategory = normalizeSearchText(item.category);
  const normalizedPattern = normalizeSearchText(item.movementPattern ?? "");
  const normalizedEquipment = normalizeSearchText(item.equipment ?? "");

  if (normalizedName === normalizedQuery || normalizedSlug === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery) || normalizedSlug.startsWith(normalizedQuery)) return 80;
  if (normalizedName.includes(normalizedQuery) || normalizedSlug.includes(normalizedQuery)) return 60;
  if (normalizedCategory.includes(normalizedQuery) || normalizedPattern.includes(normalizedQuery)) return 40;
  if (normalizedEquipment.includes(normalizedQuery)) return 20;
  return 0;
}

function parseTemplateDays(input: unknown): WorkoutTemplateDay[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const days: WorkoutTemplateDay[] = [];

  for (const [dayIndex, rawDay] of input.entries()) {
    if (!rawDay || typeof rawDay !== "object") {
      continue;
    }

    const dayRecord = rawDay as Record<string, unknown>;
    const rawExercises = Array.isArray(dayRecord.exercises) ? dayRecord.exercises : [];
    const exercises: WorkoutTemplateDayExercise[] = [];

    for (const rawExercise of rawExercises) {
      if (!rawExercise || typeof rawExercise !== "object") {
        continue;
      }

      const exerciseRecord = rawExercise as Record<string, unknown>;
      const exerciseId = typeof exerciseRecord.exerciseId === "string" ? exerciseRecord.exerciseId : "";
      const exerciseName = typeof exerciseRecord.exerciseName === "string" ? exerciseRecord.exerciseName : "";
      const exerciseSlug = typeof exerciseRecord.exerciseSlug === "string" ? exerciseRecord.exerciseSlug : "";
      const category = typeof exerciseRecord.category === "string" ? exerciseRecord.category : "custom";
      const equipment = typeof exerciseRecord.equipment === "string" ? exerciseRecord.equipment : null;
      const stationLabel =
        typeof exerciseRecord.stationLabel === "string" ? exerciseRecord.stationLabel : exerciseName;
      const notes = typeof exerciseRecord.notes === "string" ? exerciseRecord.notes : "";
      const rawBlockType = typeof exerciseRecord.blockType === "string" ? exerciseRecord.blockType : null;
      const blockType: WorkoutBlockType = isWorkoutBlockType(rawBlockType) ? rawBlockType : "straight_set";

      if (!exerciseId || !exerciseName || !exerciseSlug) {
        continue;
      }

      exercises.push({
        exerciseId,
        exerciseName,
        exerciseSlug,
        category,
        equipment,
        stationLabel,
        notes,
        blockType,
        reps: typeof exerciseRecord.reps === "string" ? exerciseRecord.reps : undefined,
        weightKg:
          typeof exerciseRecord.weightKg === "number" && Number.isFinite(exerciseRecord.weightKg)
            ? exerciseRecord.weightKg
            : undefined,
        distanceM:
          typeof exerciseRecord.distanceM === "number" && Number.isFinite(exerciseRecord.distanceM)
            ? exerciseRecord.distanceM
            : undefined,
        durationSeconds:
          typeof exerciseRecord.durationSeconds === "number" && Number.isFinite(exerciseRecord.durationSeconds)
            ? exerciseRecord.durationSeconds
            : undefined
      });
    }

    if (exercises.length === 0) {
      continue;
    }

    days.push({
      id: typeof dayRecord.id === "string" && dayRecord.id ? dayRecord.id : `day_${dayIndex + 1}`,
      label:
        typeof dayRecord.label === "string" && dayRecord.label.trim()
          ? dayRecord.label
          : `Day ${dayIndex + 1}`,
      notes: typeof dayRecord.notes === "string" ? dayRecord.notes : "",
      exercises
    });
  }

  return days;
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

  const likePattern = `%${q.replace(/\s+/g, " ").trim()}%`;
  const slugPattern = `%${q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}%`;

  const [nameResponse, slugResponse, categoryResponse, patternResponse, equipmentResponse] =
    await Promise.all([
      client
        .from("exercises")
        .select("id,name,slug,category,movement_pattern,equipment")
        .ilike("name", likePattern)
        .order("name", { ascending: true })
        .limit(12),
      client
        .from("exercises")
        .select("id,name,slug,category,movement_pattern,equipment")
        .ilike("slug", slugPattern || likePattern)
        .order("name", { ascending: true })
        .limit(8),
      client
        .from("exercises")
        .select("id,name,slug,category,movement_pattern,equipment")
        .ilike("category", likePattern)
        .order("name", { ascending: true })
        .limit(6),
      client
        .from("exercises")
        .select("id,name,slug,category,movement_pattern,equipment")
        .ilike("movement_pattern", likePattern)
        .order("name", { ascending: true })
        .limit(6),
      client
        .from("exercises")
        .select("id,name,slug,category,movement_pattern,equipment")
        .ilike("equipment", likePattern)
        .order("name", { ascending: true })
        .limit(6)
    ]);

  const errors = [
    nameResponse.error,
    slugResponse.error,
    categoryResponse.error,
    patternResponse.error,
    equipmentResponse.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message || "Unable to search exercises.");
  }

  const merged = new Map<string, ExerciseSearchResult>();

  for (const row of [
    ...(nameResponse.data ?? []),
    ...(slugResponse.data ?? []),
    ...(categoryResponse.data ?? []),
    ...(patternResponse.data ?? []),
    ...(equipmentResponse.data ?? [])
  ] as ExerciseRow[]) {
    merged.set(row.id, mapExerciseRow(row));
  }

  return Array.from(merged.values())
    .map((item) => ({
      item,
      score: scoreExerciseResult(q, item)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.name.localeCompare(right.item.name);
    })
    .slice(0, 16)
    .map((entry) => entry.item);
}

export async function loadExercisesBySlugs(
  client: SupabaseClient,
  slugs: string[]
): Promise<Map<string, ExerciseSearchResult>> {
  const uniqueSlugs = Array.from(new Set(slugs.map((value) => value.trim()).filter(Boolean)));
  if (uniqueSlugs.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("exercises")
    .select("id,name,slug,category,movement_pattern,equipment")
    .in("slug", uniqueSlugs);

  if (error) {
    throw new Error(error.message || "Unable to load preset exercises.");
  }

  return new Map(
    ((((data ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      movement_pattern: string | null;
      equipment: string | null;
    }>) ?? []).map((item) => [
      item.slug,
      {
        id: item.id,
        name: item.name,
        slug: item.slug,
        category: item.category,
        movementPattern: item.movement_pattern,
        equipment: item.equipment
      }
    ]))
  );
}

export async function loadWorkoutTemplates(client: SupabaseClient): Promise<WorkoutTemplate[]> {
  const user = await requireUser(client);

  const { data, error } = await client
    .from("user_workout_templates")
    .select("id,name,description,workout_type,source,template_days")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load workout templates.");
  }

  return (((data ?? []) as WorkoutTemplateRow[]) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    workoutType: row.workout_type,
    source: row.source,
    days: parseTemplateDays(row.template_days)
  }));
}

export async function saveWorkoutTemplate(
  client: SupabaseClient,
  input: {
    templateId?: string;
    name: string;
    description?: string;
    workoutType: WorkoutType;
    days: WorkoutTemplateDay[];
  }
): Promise<WorkoutTemplate> {
  const user = await requireUser(client);
  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    workout_type: input.workoutType,
    source: "manual",
    template_days: input.days,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (!payload.name) {
    throw new Error("Template name is required.");
  }

  if (input.days.length === 0) {
    throw new Error("Add at least one day with one exercise before saving a template.");
  }

  const response = input.templateId
    ? await client
        .from("user_workout_templates")
        .update(payload)
        .eq("id", input.templateId)
        .eq("user_id", user.id)
        .select("id,name,description,workout_type,source,template_days")
        .single()
    : await client
        .from("user_workout_templates")
        .insert(payload)
        .select("id,name,description,workout_type,source,template_days")
        .single();

  if (response.error) {
    throw new Error(response.error.message || "Unable to save workout template.");
  }

  const row = response.data as WorkoutTemplateRow;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workoutType: row.workout_type,
    source: row.source,
    days: parseTemplateDays(row.template_days)
  };
}

export async function deleteWorkoutTemplate(client: SupabaseClient, templateId: string): Promise<void> {
  const user = await requireUser(client);

  const { error } = await client
    .from("user_workout_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Unable to delete workout template.");
  }
}

export async function submitWorkout(
  client: SupabaseClient,
  input: SubmitWorkoutInput,
  expectedUserId?: string
): Promise<SubmitWorkoutResult> {
  const user = await requireUser(client, expectedUserId);
  const exercises = input.exercises.filter((item) => item.exerciseId);

  if (input.idempotencyKey && (!input.startedAt || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.idempotencyKey))) {
    throw new Error("Idempotent submissions require a UUID key and a stable startedAt timestamp.");
  }

  if (exercises.length === 0) {
    throw new Error("Add at least one exercise block before submitting.");
  }

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

  await requireUser(client, user.id);

  const { data: workoutIdData, error: logError } = await client.rpc("log_workout_atomic", {
    p_workout: {
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
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
    p_exercises: exercises.map((exercise, index) => ({
      exercise_id: exercise.exerciseId,
      order_index: index + 1,
      block_id: null,
      block_type: WORKOUT_BLOCK_TYPES.includes(exercise.blockType ?? "straight_set")
        ? (exercise.blockType ?? "straight_set")
        : "straight_set",
      target_reps: exercise.targetReps ?? null,
      target_weight_kg: exercise.targetWeightKg ?? null,
      notes: exercise.notes?.trim() || null,
      sets: [
        {
          set_index: 1,
          reps: exercise.set.reps ?? null,
          weight_kg: exercise.set.weightKg ?? null,
          duration_seconds: exercise.set.durationSeconds ?? null,
          distance_m: exercise.set.distanceM ?? null,
          rpe: exercise.set.rpe ?? null,
          is_pr: false
        }
      ]
    }))
  }).then((response) => response, () => { throw new WorkoutSaveUncertainError(); });

  if (logError) {
    if (!logError.code) throw new WorkoutSaveUncertainError();
    throw new Error(logError.message || "Unable to log workout.");
  }

  const workoutId = workoutIdData as string | null;
  if (!workoutId) {
    throw new WorkoutSaveUncertainError();
  }

  // The write is committed. A readback failure must never invite another write.
  let afterProfile: typeof beforeProfile = null;
  let progressAvailable = false;
  try {
    const response = await client.from("profiles")
      .select("xp_total,level,chain_days,rank_tier").eq("id", user.id).maybeSingle();
    afterProfile = response.data;
    progressAvailable = !response.error && Boolean(response.data);
  } catch {
    // Keep the saved workout receipt even when the connection drops afterwards.
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
    progressAvailable,
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
    expectedUserId?: string;
  }
): Promise<UploadWorkoutProofResult> {
  const user = await requireUser(client, input.expectedUserId);

  if (input.files.length === 0) {
    return { uploadedCount: 0 };
  }

  if (input.files.length > MAX_PROOF_FILES) {
    throw new Error(`Upload up to ${MAX_PROOF_FILES} proof files per workout.`);
  }

  const { data: existing, error: existingError } = await client.from("workout_proof_media")
    .select("storage_path,sort_order").eq("workout_id", input.workoutId).eq("uploader_user_id", user.id);
  if (existingError) throw new Error("Your workout is saved, but its attachments could not be checked. Retry attachments only.");
  const registered = new Map(((existing ?? []) as Array<{ storage_path: string; sort_order: number }>)
    .map((row) => [row.sort_order, row.storage_path]));
  let uploadedCount = 0;

    for (const [index, file] of input.files.entries()) {
      const sortOrder = index + 1;
      const mediaKind = inferMediaKind(file.type);
      if (!mediaKind) {
        throw new Error("Only image and video proof files are supported.");
      }

      if (file.size > MAX_PROOF_FILE_BYTES) {
        throw new Error("Each proof file must be 50 MB or smaller.");
      }

      const fileName = sanitizeFileName(file.name);
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const contentKey = `${sortOrder}-${hash}-${fileName}`;
      if (registered.has(sortOrder)) {
        if (!registered.get(sortOrder)!.endsWith(`/${contentKey}`)) throw new Error("An attachment already occupies this position. Your workout and existing media are unchanged.");
        uploadedCount += 1;
        continue;
      }

      // Unregistered objects are not selectable under Storage RLS. A fresh attempt
      // path can resume after metadata failure without requiring an overwrite.
      const objectPath = `${user.id}/${input.workoutId}/${crypto.randomUUID()}/${contentKey}`;
      await requireUser(client, user.id);

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

      await requireUser(client, user.id);
      const registration = {
        workout_id: input.workoutId,
        uploader_user_id: user.id,
        storage_bucket: WORKOUT_PROOF_BUCKET,
        storage_path: objectPath,
        media_kind: mediaKind,
        mime_type: file.type || "application/octet-stream",
        file_bytes: file.size,
        sort_order: sortOrder
      };
      let insertError: { code?: string; message?: string } | null;
      try {
        const response = await client.from("workout_proof_media").insert(registration);
        insertError = response.error;
      } catch {
        insertError = {};
      }

      if (insertError) {
        // A lost response can hide a committed registration. An empty/failed read
        // is not proof of rollback, so only confirmed database rejections permit cleanup.
        let confirmed = false;
        await requireUser(client, user.id);
        try {
          const { data, error } = await client.from("workout_proof_media")
            .select("workout_id,uploader_user_id,storage_bucket,storage_path,sort_order")
            .eq("workout_id", input.workoutId).eq("uploader_user_id", user.id)
            .eq("storage_path", objectPath).maybeSingle();
          confirmed = !error && data?.workout_id === input.workoutId
            && data?.uploader_user_id === user.id && data?.storage_bucket === WORKOUT_PROOF_BUCKET
            && data?.storage_path === objectPath && data?.sort_order === sortOrder;
        } catch {
          // Preserve the object until its registration can be checked safely.
        }
        if (confirmed) {
          uploadedCount += 1;
          continue;
        }

        const rejected = ["23502", "23503", "23505", "23514", "22P02", "42501"].includes(insertError.code ?? "");
        if (!rejected) {
          throw new Error("Your workout is saved, but attachment registration could not be confirmed. Retry attachments only.");
        }
        await requireUser(client, user.id);
        try { await client.storage.from(WORKOUT_PROOF_BUCKET).remove([objectPath]); } catch { /* A confirmed rejected registration may leave an unregistered orphan. */ }
        if (isMissingWorkoutProofMediaDependency(insertError)) {
          throw new Error(
            "Workout proof media database contract is not ready yet. Apply the workout proof media migration in Supabase first."
          );
        }

        throw new Error(insertError.message || "Unable to register proof media.");
      }

      uploadedCount += 1;
    }

  return { uploadedCount };
}

export async function updateWorkoutAudience(
  client: SupabaseClient,
  workoutId: string,
  visibility: WorkoutVisibility,
  expectedUserId?: string
): Promise<void> {
  const user = await requireUser(client, expectedUserId);
  if (!["private", "followers", "gym", "public"].includes(visibility)) throw new Error("Choose a valid audience.");
  const { data, error } = await client.from("workouts").update({ visibility })
    .eq("id", workoutId).eq("user_id", user.id).select("id,visibility").single();
  if (error || !data || data.visibility !== visibility) throw new Error("The audience change was not confirmed. Check your activity before sharing again.");
}
