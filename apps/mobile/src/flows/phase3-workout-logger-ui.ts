import type {
  LogWorkoutAtomicInput,
  LogWorkoutExerciseInput,
  LogWorkoutSetInput,
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

export interface WorkoutLoggerFieldError {
  field: string;
  message: string;
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
}

export interface WorkoutLoggerSubmitFailure {
  ok: false;
  error: WorkoutLoggerUiError;
}

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
    sets: [createEmptySet()]
  };
}

function toAtomicInput(draft: WorkoutLoggerDraft): LogWorkoutAtomicInput {
  const exercises: LogWorkoutExerciseInput[] = draft.exercises.map((exercise, exerciseIndex) => ({
    exerciseId: exercise.exerciseId,
    orderIndex: exerciseIndex + 1,
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

export function createPhase3WorkoutLoggerUiFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const workouts = new WorkoutService(supabase, { locale: options.locale });
  const checklist = phase3WorkoutLoggingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase3WorkoutLoggingChecklistKeys,
    createDraft: (overrides: Partial<WorkoutLoggerDraft> = {}): WorkoutLoggerDraft => ({
      metadata: {
        title: "Workout Session",
        workoutType: "strength",
        visibility: "public",
        ...overrides.metadata
      },
      exercises: overrides.exercises ? [...overrides.exercises] : [createEmptyExercise()]
    }),
    addExercise: (draft: WorkoutLoggerDraft): WorkoutLoggerDraft => ({
      ...draft,
      exercises: [...draft.exercises, createEmptyExercise()]
    }),
    removeExercise: (draft: WorkoutLoggerDraft, exerciseIndex: number): WorkoutLoggerDraft => ({
      ...draft,
      exercises: draft.exercises.filter((_, index) => index !== exerciseIndex)
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
    validate: (draft: WorkoutLoggerDraft): WorkoutLoggerFieldError[] => validateDraft(draft),
    submit: async (draft: WorkoutLoggerDraft): Promise<WorkoutLoggerSubmitResult> => {
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

        return {
          ok: true,
          result,
          verification
        };
      } catch (error) {
        return {
          ok: false,
          error: mapRuntimeError(error, options.locale)
        };
      }
    }
  };
}
