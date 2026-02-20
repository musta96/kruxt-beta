import { createMobileSupabaseClient, WorkoutService } from "../services";
import type { LogWorkoutAtomicInput } from "@kruxt/types";
import type { LogWorkoutAtomicResult } from "../services";
import { type LegalTranslationKey, translateLegalText } from "@kruxt/types";

const PHASE3_WORKOUT_LOGGING_CHECKLIST_KEYS = [
  "legal.flow.phase3.validate_workout_payload",
  "legal.flow.phase3.validate_required_consents",
  "legal.flow.phase3.call_log_workout_atomic",
  "legal.flow.phase3.confirm_proof_feed_event",
  "legal.flow.phase3.confirm_progress_update"
] as const satisfies readonly LegalTranslationKey[];

export const phase3WorkoutLoggingChecklistKeys = [...PHASE3_WORKOUT_LOGGING_CHECKLIST_KEYS] as const;

export const phase3WorkoutLoggingChecklist = phase3WorkoutLoggingChecklistKeys.map((key) =>
  translateLegalText(key)
);

export function createPhase3WorkoutLoggingFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const workouts = new WorkoutService(supabase, { locale: options.locale });
  const checklist = phase3WorkoutLoggingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase3WorkoutLoggingChecklistKeys,
    run: async (input: LogWorkoutAtomicInput): Promise<LogWorkoutAtomicResult> =>
      workouts.logWorkoutAtomic(input)
  };
}
