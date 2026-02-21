import type {
  LogWorkoutAtomicInput,
  LogWorkoutExerciseInput,
  LogWorkoutSetInput,
  RankTier,
  WorkoutBlockType,
  WorkoutType,
  WorkoutVisibility
} from "@kruxt/types";
import { translateLegalText } from "@kruxt/types";

import {
  createMobileSupabaseClient,
  KruxtAppError,
  type LogWorkoutAtomicResult,
  WorkoutService
} from "../services";
import { phase3WorkoutLoggingChecklistKeys } from "./phase3-workout-logging";

export type WorkoutLoggerUiStep = "metadata" | "exercise_blocks" | "sets" | "review";
export const workoutLoggerUiStepOrder = ["metadata", "exercise_blocks", "sets", "review"] as const;

export interface WorkoutLoggerSetDraft {
  clientId: string;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceM?: number;
  rpe?: number;
}

export interface WorkoutLoggerExerciseDraft {
  clientId: string;
  exerciseId: string;
  blockType: WorkoutBlockType;
  blockId?: string;
  notes?: string;
  targetReps?: string;
  targetWeightKg?: number;
  sets: WorkoutLoggerSetDraft[];
}

export interface WorkoutLoggerMetadataDraft {
  gymId?: string;
  title: string;
  workoutType: WorkoutType;
  notes?: string;
  startedAt?: string;
  endedAt?: string;
  rpe?: number;
  visibility: WorkoutVisibility;
}

export interface WorkoutLoggerDraft {
  metadata: WorkoutLoggerMetadataDraft;
  exercises: WorkoutLoggerExerciseDraft[];
}

export interface WorkoutLoggerDraftRecoveryPayload {
  version: 1;
  savedAt: string;
  draft: WorkoutLoggerDraft;
}

export interface WorkoutLoggerFieldError {
  field: string;
  message: string;
}

export interface WorkoutLoggerProfileProgressState {
  xpTotal: number;
  level: number;
  rankTier: RankTier;
  chainDays: number;
}

export interface WorkoutLoggerProgressDelta {
  previous: WorkoutLoggerProfileProgressState | null;
  current: WorkoutLoggerProfileProgressState;
  xpDelta: number | null;
  levelDelta: number | null;
  chainDaysDelta: number | null;
  rankChanged: boolean;
}

export interface WorkoutLoggerNextRoute {
  name: "feed_detail";
  params: {
    workoutId: string;
  };
}

export interface WorkoutLoggerSubmitVerification {
  totalsUpdated: boolean;
  proofEventCreated: boolean;
  progressUpdated: boolean;
}

export interface WorkoutLoggerUiError {
  code: string;
  step: WorkoutLoggerUiStep;
  message: string;
  recoverable: boolean;
  fieldErrors: WorkoutLoggerFieldError[];
}

export interface WorkoutLoggerSubmitSuccess {
  ok: true;
  result: LogWorkoutAtomicResult;
  verification: WorkoutLoggerSubmitVerification;
  progressDelta: WorkoutLoggerProgressDelta;
  nextRoute: WorkoutLoggerNextRoute;
}

export interface WorkoutLoggerSubmitFailure {
  ok: false;
  error: WorkoutLoggerUiError;
}

export interface WorkoutLoggerUiMicrocopy {
  primaryCta: string;
  loadingCta: string;
  chainRule: string;
}

export interface WorkoutLoggerUiLoadSnapshot {
  stepOrder: readonly WorkoutLoggerUiStep[];
  supportedBlockTypes: readonly WorkoutBlockType[];
  defaultDraft: WorkoutLoggerDraft;
  hasDraftRecovery: boolean;
  hasOfflineQueuePlaceholder: boolean;
  microcopy: WorkoutLoggerUiMicrocopy;
}

export interface WorkoutLoggerUiLoadSuccess {
  ok: true;
  snapshot: WorkoutLoggerUiLoadSnapshot;
}

export interface WorkoutLoggerUiLoadFailure {
  ok: false;
  error: WorkoutLoggerUiError;
}

export type WorkoutLoggerUiLoadResult = WorkoutLoggerUiLoadSuccess | WorkoutLoggerUiLoadFailure;
export type WorkoutLoggerSubmitResult = WorkoutLoggerSubmitSuccess | WorkoutLoggerSubmitFailure;

export const phase3WorkoutLoggerUiChecklist = [
  ...phase3WorkoutLoggingChecklistKeys.map((key) => translateLegalText(key)),
  "Keep log interactions under 60 seconds",
  "Return proof + progress signals after submit"
] as const;

function createClientId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function createEmptySet(): WorkoutLoggerSetDraft {
  return {
    clientId: createClientId("set"),
    reps: 8,
    weightKg: 0,
    rpe: 7
  };
}

function createEmptyExercise(): WorkoutLoggerExerciseDraft {
  return {
    clientId: createClientId("exercise"),
    exerciseId: "",
    blockType: "straight_set",
    sets: [createEmptySet()]
  };
}

function toAtomicInput(draft: WorkoutLoggerDraft): LogWorkoutAtomicInput {
  const exercises: LogWorkoutExerciseInput[] = draft.exercises.map((exercise, exerciseIndex) => ({
    exerciseId: exercise.exerciseId,
    orderIndex: exerciseIndex + 1,
    blockId: exercise.blockId,
    blockType: exercise.blockType,
    notes: exercise.notes,
    targetReps: exercise.targetReps,
    targetWeightKg: exercise.targetWeightKg,
    sets: exercise.sets.map((set, setIndex) => {
      const mappedSet: LogWorkoutSetInput = {
        setIndex: setIndex + 1,
        reps: set.reps,
        weightKg: set.weightKg,
        durationSeconds: set.durationSeconds,
        distanceM: set.distanceM,
        rpe: set.rpe
      };

      return mappedSet;
    })
  }));

  return {
    workout: {
      gymId: draft.metadata.gymId,
      title: draft.metadata.title,
      workoutType: draft.metadata.workoutType,
      notes: draft.metadata.notes,
      startedAt: draft.metadata.startedAt,
      endedAt: draft.metadata.endedAt,
      rpe: draft.metadata.rpe,
      visibility: draft.metadata.visibility,
      source: "manual"
    },
    exercises
  };
}

function mapFieldToStep(field: string): WorkoutLoggerUiStep {
  if (field.startsWith("metadata.")) {
    return "metadata";
  }

  if (field.startsWith("exercises.")) {
    return field.includes(".sets.") ? "sets" : "exercise_blocks";
  }

  return "review";
}

function validateDraft(draft: WorkoutLoggerDraft): WorkoutLoggerFieldError[] {
  const errors: WorkoutLoggerFieldError[] = [];

  if (!draft.metadata.title.trim()) {
    errors.push({
      field: "metadata.title",
      message: "Workout title is required."
    });
  }

  if (draft.metadata.rpe !== undefined && (draft.metadata.rpe < 1 || draft.metadata.rpe > 10)) {
    errors.push({
      field: "metadata.rpe",
      message: "Workout RPE must be between 1 and 10."
    });
  }

  if (draft.exercises.length === 0) {
    errors.push({
      field: "exercises",
      message: "Add at least one exercise block."
    });
  }

  draft.exercises.forEach((exercise, exerciseIndex) => {
    if (!exercise.exerciseId.trim()) {
      errors.push({
        field: `exercises.${exerciseIndex}.exerciseId`,
        message: "Select an exercise."
      });
    }

    if (exercise.sets.length === 0) {
      errors.push({
        field: `exercises.${exerciseIndex}.sets`,
        message: "Add at least one set."
      });
    }

    exercise.sets.forEach((set, setIndex) => {
      const hasVolumeSignal =
        (set.reps ?? 0) > 0 ||
        (set.durationSeconds ?? 0) > 0 ||
        (set.distanceM ?? 0) > 0;

      if (!hasVolumeSignal) {
        errors.push({
          field: `exercises.${exerciseIndex}.sets.${setIndex}`,
          message: "Each set must include reps, duration, or distance."
        });
      }

      if (set.reps !== undefined && set.reps < 0) {
        errors.push({
          field: `exercises.${exerciseIndex}.sets.${setIndex}.reps`,
          message: "Reps cannot be negative."
        });
      }

      if (set.weightKg !== undefined && set.weightKg < 0) {
        errors.push({
          field: `exercises.${exerciseIndex}.sets.${setIndex}.weightKg`,
          message: "Weight cannot be negative."
        });
      }

      if (set.rpe !== undefined && (set.rpe < 1 || set.rpe > 10)) {
        errors.push({
          field: `exercises.${exerciseIndex}.sets.${setIndex}.rpe`,
          message: "Set RPE must be between 1 and 10."
        });
      }
    });
  });

  return errors;
}

function mapRuntimeError(error: unknown, locale?: string | null): WorkoutLoggerUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("WORKOUT_LOGGER_SUBMIT_FAILED", "Unable to submit workout log.", error);

  let step: WorkoutLoggerUiStep = "review";
  if (["WORKOUT_EXERCISES_REQUIRED"].includes(appError.code)) {
    step = "exercise_blocks";
  } else if (["CONSENT_GAPS_READ_FAILED", "CONSENT_GATE_CHECK_FAILED", "RECONSENT_REQUIRED"].includes(appError.code)) {
    step = "review";
  }

  let message = appError.message;
  if (appError.code === "RECONSENT_REQUIRED") {
    message = translateLegalText("legal.error.reconsent_required_workout", { locale });
  }

  return {
    code: appError.code,
    step,
    message,
    recoverable: appError.code !== "AUTH_REQUIRED",
    fieldErrors: []
  };
}

type SetQuickAdjustField = "reps" | "weightKg" | "rpe" | "durationSeconds" | "distanceM";
const SUPPORTED_BLOCK_TYPES: readonly WorkoutBlockType[] = [
  "straight_set",
  "superset",
  "circuit",
  "emom",
  "amrap"
] as const;

const WORKOUT_LOGGER_MICROCOPY: WorkoutLoggerUiMicrocopy = {
  primaryCta: "Post Proof",
  loadingCta: "Claiming...",
  chainRule: "Protect the chain."
};

function clampNumeric(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(Math.max(value, min), max);
}

function reorderArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) {
    return [...items];
  }
  const clone = [...items];
  const [moved] = clone.splice(fromIndex, 1);
  clone.splice(toIndex, 0, moved);
  return clone;
}

function deepCloneDraft(draft: WorkoutLoggerDraft): WorkoutLoggerDraft {
  return {
    metadata: { ...draft.metadata },
    exercises: draft.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set }))
    }))
  };
}

function createDefaultDraft(overrides: Partial<WorkoutLoggerDraft> = {}): WorkoutLoggerDraft {
  return {
    metadata: {
      title: "Workout Session",
      workoutType: "strength",
      visibility: "public",
      startedAt: new Date().toISOString(),
      ...overrides.metadata
    },
    exercises: overrides.exercises ? [...overrides.exercises] : [createEmptyExercise()]
  };
}

async function readProfileProgressState(supabase: ReturnType<typeof createMobileSupabaseClient>): Promise<WorkoutLoggerProfileProgressState | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("xp_total,level,rank_tier,chain_days")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return null;
  }

  const profile = profileData as {
    xp_total: number;
    level: number;
    rank_tier: RankTier;
    chain_days: number;
  };

  return {
    xpTotal: profile.xp_total,
    level: profile.level,
    rankTier: profile.rank_tier,
    chainDays: profile.chain_days
  };
}

function computeProgressDelta(
  previous: WorkoutLoggerProfileProgressState | null,
  current: WorkoutLoggerProfileProgressState
): WorkoutLoggerProgressDelta {
  return {
    previous,
    current,
    xpDelta: previous ? current.xpTotal - previous.xpTotal : null,
    levelDelta: previous ? current.level - previous.level : null,
    chainDaysDelta: previous ? current.chainDays - previous.chainDays : null,
    rankChanged: previous ? previous.rankTier !== current.rankTier : false
  };
}

export function createPhase3WorkoutLoggerUiFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const workouts = new WorkoutService(supabase, { locale: options.locale });
  let isSubmitInFlight = false;
  const checklist = phase3WorkoutLoggingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase3WorkoutLoggingChecklistKeys,
    stepOrder: workoutLoggerUiStepOrder,
    supportedBlockTypes: SUPPORTED_BLOCK_TYPES,
    microcopy: { ...WORKOUT_LOGGER_MICROCOPY },
    load: async (): Promise<WorkoutLoggerUiLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: {
            stepOrder: workoutLoggerUiStepOrder,
            supportedBlockTypes: SUPPORTED_BLOCK_TYPES,
            defaultDraft: createDefaultDraft(),
            hasDraftRecovery: true,
            hasOfflineQueuePlaceholder: true,
            microcopy: { ...WORKOUT_LOGGER_MICROCOPY }
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: mapRuntimeError(
            new KruxtAppError("WORKOUT_LOGGER_LOAD_FAILED", "Unable to load workout logger context.", error),
            options.locale
          )
        };
      }
    },
    createDraft: (overrides: Partial<WorkoutLoggerDraft> = {}): WorkoutLoggerDraft =>
      createDefaultDraft(overrides),
    addExercise: (draft: WorkoutLoggerDraft): WorkoutLoggerDraft => ({
      ...draft,
      exercises: [...draft.exercises, createEmptyExercise()]
    }),
    moveExercise: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      direction: "up" | "down"
    ): WorkoutLoggerDraft => {
      const toIndex = direction === "up" ? exerciseIndex - 1 : exerciseIndex + 1;
      if (toIndex < 0 || toIndex >= draft.exercises.length) {
        return draft;
      }

      return {
        ...draft,
        exercises: reorderArray(draft.exercises, exerciseIndex, toIndex)
      };
    },
    removeExercise: (draft: WorkoutLoggerDraft, exerciseIndex: number): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.filter((_, index) => index !== exerciseIndex)
    }),
    setExerciseBlockType: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      blockType: WorkoutBlockType
    ): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) =>
        index === exerciseIndex ? { ...exercise, blockType } : exercise
      )
    }),
    addSet: (draft: WorkoutLoggerDraft, exerciseIndex: number): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }

        return {
          ...exercise,
          sets: [...exercise.sets, createEmptySet()]
        };
      })
    }),
    duplicateSet: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      setIndex: number
    ): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }

        const sourceSet = exercise.sets[setIndex];
        if (!sourceSet) {
          return exercise;
        }

        const clonedSet: WorkoutLoggerSetDraft = {
          ...sourceSet,
          clientId: createClientId("set")
        };
        const sets = [...exercise.sets];
        sets.splice(setIndex + 1, 0, clonedSet);
        return {
          ...exercise,
          sets
        };
      })
    }),
    moveSet: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      setIndex: number,
      direction: "up" | "down"
    ): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }

        const toIndex = direction === "up" ? setIndex - 1 : setIndex + 1;
        if (toIndex < 0 || toIndex >= exercise.sets.length) {
          return exercise;
        }

        return {
          ...exercise,
          sets: reorderArray(exercise.sets, setIndex, toIndex)
        };
      })
    }),
    quickAdjustSet: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      setIndex: number,
      field: SetQuickAdjustField,
      delta: number
    ): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((set, currentIndex) => {
            if (currentIndex !== setIndex) {
              return set;
            }

            const currentValue = set[field] ?? 0;
            const nextValue = currentValue + delta;
            const min = field === "rpe" ? 1 : 0;
            const max = field === "rpe" ? 10 : Number.MAX_SAFE_INTEGER;
            return {
              ...set,
              [field]: clampNumeric(nextValue, min, max)
            };
          })
        };
      })
    }),
    removeSet: (
      draft: WorkoutLoggerDraft,
      exerciseIndex: number,
      setIndex: number
    ): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.filter((_, index2) => index2 !== setIndex)
        };
      })
    }),
    toRecoveryPayload: (draft: WorkoutLoggerDraft): WorkoutLoggerDraftRecoveryPayload => ({
      version: 1,
      savedAt: new Date().toISOString(),
      draft: deepCloneDraft(draft)
    }),
    fromRecoveryPayload: (payload: WorkoutLoggerDraftRecoveryPayload | null | undefined): WorkoutLoggerDraft => {
      if (!payload || payload.version !== 1) {
        return createDefaultDraft();
      }

      const cloned = deepCloneDraft(payload.draft);
      return createDefaultDraft({
        metadata: cloned.metadata,
        exercises: cloned.exercises
      });
    },
    queueOfflinePlaceholder: (
      draft: WorkoutLoggerDraft,
      reason = "offline"
    ): { queueId: string; status: "queued_offline"; reason: string; draft: WorkoutLoggerDraftRecoveryPayload } => ({
      queueId: createClientId("offline_workout"),
      status: "queued_offline",
      reason,
      draft: {
        version: 1,
        savedAt: new Date().toISOString(),
        draft: deepCloneDraft(draft)
      }
    }),
    validate: (draft: WorkoutLoggerDraft): WorkoutLoggerFieldError[] => validateDraft(draft),
    submit: async (draft: WorkoutLoggerDraft): Promise<WorkoutLoggerSubmitResult> => {
      if (isSubmitInFlight) {
        return {
          ok: false,
          error: {
            code: "WORKOUT_LOGGER_SUBMIT_IN_PROGRESS",
            step: "review",
            message: "Workout submission is already in progress.",
            recoverable: true,
            fieldErrors: []
          }
        };
      }

      const fieldErrors = validateDraft(draft);
      if (fieldErrors.length > 0) {
        return {
          ok: false,
          error: {
            code: "WORKOUT_LOGGER_VALIDATION_FAILED",
            step: mapFieldToStep(fieldErrors[0]?.field ?? "review"),
            message: "Review highlighted workout fields and retry.",
            recoverable: true,
            fieldErrors
          }
        };
      }

      try {
        isSubmitInFlight = true;
        const previousProgress = await readProfileProgressState(supabase);
        const result = await workouts.logWorkoutAtomic(toAtomicInput(draft));
        const verification: WorkoutLoggerSubmitVerification = {
          totalsUpdated: result.workout.totalSets > 0,
          proofEventCreated: result.proofEvents.some((event) => event.eventType === "workout_logged"),
          progressUpdated: Boolean(result.progress.lastWorkoutAt) && result.progress.chainDays > 0
        };

        if (!verification.totalsUpdated || !verification.proofEventCreated || !verification.progressUpdated) {
          return {
            ok: false,
            error: {
              code: "WORKOUT_LOGGER_SIGNALS_INCOMPLETE",
              step: "review",
              message:
                "Workout saved but one or more progression signals are missing. Refresh and verify before continuing.",
              recoverable: true,
              fieldErrors: []
            }
          };
        }

        const currentProgress: WorkoutLoggerProfileProgressState = {
          xpTotal: result.progress.xpTotal,
          level: result.progress.level,
          rankTier: result.progress.rankTier,
          chainDays: result.progress.chainDays
        };

        return {
          ok: true,
          result,
          verification,
          progressDelta: computeProgressDelta(previousProgress, currentProgress),
          nextRoute: {
            name: "feed_detail",
            params: {
              workoutId: result.workoutId
            }
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: mapRuntimeError(error, options.locale)
        };
      } finally {
        isSubmitInFlight = false;
      }
    }
  };
}
