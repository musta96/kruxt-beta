import type { WorkoutType } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ExerciseRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  movement_pattern: string | null;
  equipment: string | null;
};

type WorkoutRow = {
  id: string;
  title: string;
  workout_type: WorkoutType;
  started_at: string;
  is_pr: boolean | null;
};

type WorkoutExerciseRow = {
  workout_id: string;
  exercise_id: string;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  workout_type: WorkoutType;
  source: string;
  template_days: unknown;
  created_at: string;
};

export interface LibraryExercise {
  id: string;
  name: string;
  slug: string;
  category: string;
  movementPattern: string | null;
  equipment: string | null;
  completedCount: number;
  lastCompletedAt: string | null;
}

export interface LibraryWorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  workoutType: WorkoutType;
  source: string;
  dayCount: number;
  exerciseCount: number;
  status: "saved" | "scheduled" | "completed";
  createdAt: string;
}

export interface EditorialProgram {
  id: string;
  title: string;
  category: "Strength" | "HIIT" | "For The Gym" | "HYROX" | "Recovery";
  coach: string;
  difficulty: "Foundation" | "Intermediate" | "Advanced";
  durationWeeks: number;
  sessionsPerWeek: number;
  equipment: string[];
  outcome: string;
  stages: string[];
  status: "saved" | "scheduled" | "completed" | "locked";
}

export interface TechniqueGroup {
  id: string;
  title: string;
  movementPattern: string;
  category: string;
  exerciseCount: number;
  equipment: string[];
  progression: string[];
  cues: string[];
}

export interface LibrarySnapshot {
  exercises: LibraryExercise[];
  workoutTemplates: LibraryWorkoutTemplate[];
  editorialPrograms: EditorialProgram[];
  techniqueGroups: TechniqueGroup[];
  facets: {
    categories: string[];
    equipment: string[];
    movementPatterns: string[];
  };
  recentWorkoutCount: number;
}

const EDITORIAL_PROGRAMS: EditorialProgram[] = [
  {
    id: "hyrox-base-8",
    title: "HYROX Base Builder",
    category: "HYROX",
    coach: "KRUXT Hybrid Team",
    difficulty: "Intermediate",
    durationWeeks: 8,
    sessionsPerWeek: 4,
    equipment: ["erg", "sled", "kettlebell", "wall ball"],
    outcome: "Build repeatable running + station capacity without burying recovery.",
    stages: ["Aerobic base", "Compromised running", "Race stations", "Taper week"],
    status: "scheduled"
  },
  {
    id: "gym-strength-6",
    title: "For The Gym: Strength Reset",
    category: "For The Gym",
    coach: "BZone Coaching",
    difficulty: "Foundation",
    durationWeeks: 6,
    sessionsPerWeek: 3,
    equipment: ["barbell", "dumbbells", "machine"],
    outcome: "Rebuild squat, hinge, push, and pull patterns with clear progression.",
    stages: ["Movement quality", "Volume build", "Load exposure"],
    status: "saved"
  },
  {
    id: "hiit-engine-4",
    title: "HIIT Engine",
    category: "HIIT",
    coach: "KRUXT Conditioning",
    difficulty: "Intermediate",
    durationWeeks: 4,
    sessionsPerWeek: 3,
    equipment: ["bike", "erg", "bodyweight"],
    outcome: "Short sessions that raise repeat sprint ability and recovery speed.",
    stages: ["Intervals", "Density", "Mixed modal tests"],
    status: "saved"
  },
  {
    id: "strength-pr-10",
    title: "Strength PR Track",
    category: "Strength",
    coach: "KRUXT Strength",
    difficulty: "Advanced",
    durationWeeks: 10,
    sessionsPerWeek: 4,
    equipment: ["barbell", "rack", "bench"],
    outcome: "Peak one main lift while preserving enough accessories for balance.",
    stages: ["Accumulation", "Intensification", "Peak", "Test"],
    status: "locked"
  },
  {
    id: "recovery-floor-3",
    title: "Recovery Floor",
    category: "Recovery",
    coach: "KRUXT Recovery",
    difficulty: "Foundation",
    durationWeeks: 3,
    sessionsPerWeek: 2,
    equipment: ["bodyweight", "band"],
    outcome: "Keep momentum while reducing fatigue after heavy blocks.",
    stages: ["Mobility", "Tissue tolerance", "Return to load"],
    status: "saved"
  }
];

async function requireUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }

  return data.user.id;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function countTemplateExercises(templateDays: unknown): { dayCount: number; exerciseCount: number } {
  const days = asArray(templateDays);
  let exerciseCount = 0;

  for (const day of days) {
    const dayRecord = asRecord(day);
    exerciseCount += asArray(dayRecord.exercises).length;
    exerciseCount += asArray(dayRecord.blocks).length;
  }

  return {
    dayCount: days.length,
    exerciseCount
  };
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort();
}

function buildTechniqueGroups(exercises: LibraryExercise[]): TechniqueGroup[] {
  const byPattern = new Map<string, LibraryExercise[]>();

  for (const exercise of exercises) {
    const pattern = exercise.movementPattern ?? exercise.category;
    byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), exercise]);
  }

  return Array.from(byPattern.entries())
    .map(([movementPattern, items]) => {
      const category = items[0]?.category ?? "training";
      const equipment = uniqueSorted(items.map((item) => item.equipment));

      return {
        id: movementPattern,
        title: movementPattern.replace(/-/g, " "),
        movementPattern,
        category,
        exerciseCount: items.length,
        equipment: equipment.slice(0, 5),
        progression: [
          `Start with ${items[0]?.name ?? "the lowest-skill variation"}`,
          items[1]?.name ? `Progress to ${items[1].name}` : "Add range or tempo before loading",
          items[2]?.name ? `Stress-test with ${items[2].name}` : "Load only after reps stay clean"
        ],
        cues: [
          "Own the setup before chasing speed.",
          "Keep reps consistent enough to be proof-backed.",
          "Swap the movement if pain changes the pattern."
        ]
      };
    })
    .sort((left, right) => right.exerciseCount - left.exerciseCount)
    .slice(0, 18);
}

export async function loadLibrarySnapshot(client: SupabaseClient): Promise<LibrarySnapshot> {
  const userId = await requireUser(client);
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();

  const [exercisesResponse, workoutsResponse, templatesResponse] = await Promise.all([
    client
      .from("exercises")
      .select("id,name,slug,category,movement_pattern,equipment")
      .eq("is_public", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .limit(220),
    client
      .from("workouts")
      .select("id,title,workout_type,started_at,is_pr")
      .eq("user_id", userId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(160),
    client
      .from("user_workout_templates")
      .select("id,name,description,workout_type,source,template_days,created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(60)
  ]);

  if (exercisesResponse.error) {
    throw new Error(exercisesResponse.error.message || "Unable to load exercise library.");
  }
  if (workoutsResponse.error) {
    throw new Error(workoutsResponse.error.message || "Unable to load workout history.");
  }
  if (templatesResponse.error) {
    throw new Error(templatesResponse.error.message || "Unable to load saved workouts.");
  }

  const exerciseRows = ((exercisesResponse.data ?? []) as ExerciseRow[]) ?? [];
  const workouts = ((workoutsResponse.data ?? []) as WorkoutRow[]) ?? [];
  const workoutIds = workouts.map((workout) => workout.id);

  const workoutExercisesResponse =
    workoutIds.length > 0
      ? await client
          .from("workout_exercises")
          .select("workout_id,exercise_id")
          .in("workout_id", workoutIds)
          .limit(600)
      : { data: [] as WorkoutExerciseRow[] | null, error: null };

  if (workoutExercisesResponse.error) {
    throw new Error(workoutExercisesResponse.error.message || "Unable to load completed exercises.");
  }

  const workoutDateMap = new Map(workouts.map((workout) => [workout.id, workout.started_at]));
  const completedMap = new Map<string, { count: number; lastCompletedAt: string | null }>();

  for (const row of ((workoutExercisesResponse.data ?? []) as WorkoutExerciseRow[]) ?? []) {
    const current = completedMap.get(row.exercise_id) ?? { count: 0, lastCompletedAt: null };
    const completedAt = workoutDateMap.get(row.workout_id) ?? null;
    completedMap.set(row.exercise_id, {
      count: current.count + 1,
      lastCompletedAt:
        completedAt && (!current.lastCompletedAt || completedAt > current.lastCompletedAt)
          ? completedAt
          : current.lastCompletedAt
    });
  }

  const exercises = exerciseRows.map((row) => {
    const completed = completedMap.get(row.id);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      movementPattern: row.movement_pattern,
      equipment: row.equipment,
      completedCount: completed?.count ?? 0,
      lastCompletedAt: completed?.lastCompletedAt ?? null
    };
  });

  const templates = (((templatesResponse.data ?? []) as TemplateRow[]) ?? []).map((template) => {
    const counts = countTemplateExercises(template.template_days);
    const status: LibraryWorkoutTemplate["status"] = workouts.some(
      (workout) => workout.title.toLowerCase() === template.name.toLowerCase()
    )
      ? "completed"
      : "saved";

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      workoutType: template.workout_type,
      source: template.source,
      dayCount: counts.dayCount,
      exerciseCount: counts.exerciseCount,
      status,
      createdAt: template.created_at
    };
  });

  return {
    exercises,
    workoutTemplates: templates,
    editorialPrograms: EDITORIAL_PROGRAMS,
    techniqueGroups: buildTechniqueGroups(exercises),
    facets: {
      categories: uniqueSorted(exercises.map((exercise) => exercise.category)),
      equipment: uniqueSorted(exercises.map((exercise) => exercise.equipment)),
      movementPatterns: uniqueSorted(exercises.map((exercise) => exercise.movementPattern))
    },
    recentWorkoutCount: workouts.length
  };
}
