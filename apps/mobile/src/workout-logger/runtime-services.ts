import type {
  WorkoutLoggerServices,
  WorkoutDraft,
  WorkoutLoggerSubmitResult,
  ChainContext,
  ExerciseOption
} from "./types";
import { createMobileSupabaseClient } from "../services/supabase-client";
import { createPhase3WorkoutLoggerUiFlow } from "../flows/phase3-workout-logger-ui";
import type { WorkoutLoggerDraft } from "../flows/phase3-workout-logger-ui";

export function createWorkoutLoggerRuntimeServices(): WorkoutLoggerServices {
  try {
    const supabase = createMobileSupabaseClient();
    const flow = createPhase3WorkoutLoggerUiFlow();

    return {
      loadContext: async (): Promise<ChainContext> => {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return { chainDays: 0, rankTier: "bronze", level: 1, xpTotal: 0 };

        const { data } = await supabase
          .from("profiles")
          .select("chain_days,rank_tier,level,xp_total")
          .eq("id", userId)
          .maybeSingle();

        return {
          chainDays: data?.chain_days ?? 0,
          rankTier: data?.rank_tier ?? "initiate",
          level: data?.level ?? 1,
          xpTotal: data?.xp_total ?? 0,
        };
      },
      searchExercises: async (query: string): Promise<ExerciseOption[]> => {
        const q = query.trim();
        if (q.length < 2) return [];

        const { data, error } = await supabase
          .from("exercises")
          .select("id,name")
          .ilike("name", `%${q}%`)
          .order("name", { ascending: true })
          .limit(12);

        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; name: string }>).map((row) => ({
          id: row.id,
          name: row.name
        }));
      },

      submit: async (draft: WorkoutDraft): Promise<WorkoutLoggerSubmitResult> => {
        // Load pre-submit context for delta calculation
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        let xpBefore = 0, levelBefore = 1, chainBefore = 0, rankBefore = "bronze";

        if (userId) {
          const { data: pre } = await supabase
            .from("profiles")
            .select("xp_total,level,chain_days,rank_tier")
            .eq("id", userId)
            .maybeSingle();
          if (pre) {
            xpBefore = pre.xp_total ?? 0;
            levelBefore = pre.level ?? 1;
            chainBefore = pre.chain_days ?? 0;
            rankBefore = pre.rank_tier ?? "bronze";
          }
        }

        // Map to Phase3 draft shape
        const p3Draft: WorkoutLoggerDraft = {
          metadata: {
            title: draft.metadata.title,
            workoutType: draft.metadata.workoutType,
            visibility: draft.metadata.visibility,
            notes: draft.metadata.notes,
            startedAt: draft.metadata.startedAt,
            endedAt: draft.metadata.endedAt,
            rpe: draft.metadata.rpe,
            gymId: draft.metadata.gymId,
          },
          exercises: draft.exercises.map((ex) => ({
            clientId: ex.clientId,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            blockType: ex.blockType,
            notes: ex.notes,
            targetReps: ex.targetReps,
            targetWeightKg: ex.targetWeightKg,
            sets: ex.sets.map((s) => ({
              clientId: s.clientId,
              reps: s.reps,
              weightKg: s.weightKg,
              durationSeconds: s.durationSeconds,
              distanceM: s.distanceM,
              rpe: s.rpe,
            })),
          })),
        };

        const result = await flow.submit(p3Draft);

        if (result.ok === false) {
          throw new Error(result.error.message);
        }

        return {
          workoutId: result.result.workoutId,
          xpDelta: {
            xpBefore,
            xpAfter: result.result.progress.xpTotal,
            levelBefore,
            levelAfter: result.result.progress.level,
            chainDaysBefore: chainBefore,
            chainDaysAfter: result.result.progress.chainDays,
            rankTierBefore: rankBefore,
            rankTierAfter: result.result.progress.rankTier,
          },
        };
      },
    };
  } catch (error) {
    console.warn("[workout-logger-runtime] Falling back to preview services:", error);
    return {
      loadContext: async () => ({ chainDays: 7, rankTier: "vanguard", level: 12, xpTotal: 3400 }),
      searchExercises: async (query: string): Promise<ExerciseOption[]> => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        const catalog: ExerciseOption[] = [
          { id: "preview-ex-1", name: "Back Squat" },
          { id: "preview-ex-2", name: "Bench Press" },
          { id: "preview-ex-3", name: "Deadlift" },
          { id: "preview-ex-4", name: "Pull-up" }
        ];
        return catalog.filter((ex) => ex.name.toLowerCase().includes(q));
      },
      submit: async () => {
        await new Promise((r) => setTimeout(r, 800));
        return {
          workoutId: "preview-workout-1",
          xpDelta: {
            xpBefore: 3400, xpAfter: 3520,
            levelBefore: 12, levelAfter: 12,
            chainDaysBefore: 7, chainDaysAfter: 8,
            rankTierBefore: "silver", rankTierAfter: "silver",
          },
        };
      },
    };
  }
}
