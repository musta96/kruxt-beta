import { createMobileSupabaseClient, WorkoutService } from "../services";
import type { LogWorkoutAtomicInput } from "@kruxt/types";
import type { LogWorkoutAtomicResult } from "../services";

export const phase3WorkoutLoggingChecklist = [
  "Validate workout payload",
  "Validate required legal consents",
  "Call log_workout_atomic RPC",
  "Confirm proof feed event",
  "Confirm XP/rank/chain progress update"
] as const;

export function createPhase3WorkoutLoggingFlow() {
  const supabase = createMobileSupabaseClient();
  const workouts = new WorkoutService(supabase);

  return {
    checklist: phase3WorkoutLoggingChecklist,
    run: async (input: LogWorkoutAtomicInput): Promise<LogWorkoutAtomicResult> =>
      workouts.logWorkoutAtomic(input)
  };
}
