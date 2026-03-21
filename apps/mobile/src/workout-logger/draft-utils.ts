import type { SetDraft, ExerciseDraft, WorkoutDraft, MetadataDraft, FieldErrors } from "./types";

// ─── Client ID generator ───────────────────────────────────────────────────
function cid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Factory helpers ───────────────────────────────────────────────────────
export function createEmptySet(): SetDraft {
  return { clientId: cid("set"), reps: 8, weightKg: 0, rpe: 7 };
}

export function createEmptyExercise(): ExerciseDraft {
  return {
    clientId: cid("ex"),
    exerciseId: "",
    exerciseName: "",
    blockType: "straight_set",
    sets: [createEmptySet()],
  };
}

export function createEmptyDraft(): WorkoutDraft {
  return {
    metadata: {
      title: "Workout Session",
      workoutType: "strength",
      visibility: "public",
      startedAt: new Date().toISOString(),
    },
    exercises: [createEmptyExercise()],
  };
}

// ─── Immutable draft operations ────────────────────────────────────────────
export function addExercise(draft: WorkoutDraft): WorkoutDraft {
  return { ...draft, exercises: [...draft.exercises, createEmptyExercise()] };
}

export function removeExercise(draft: WorkoutDraft, idx: number): WorkoutDraft {
  return { ...draft, exercises: draft.exercises.filter((_, i) => i !== idx) };
}

export function addSet(draft: WorkoutDraft, exIdx: number): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, createEmptySet()] } : ex
    ),
  };
}

export function removeSet(draft: WorkoutDraft, exIdx: number, setIdx: number): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) } : ex
    ),
  };
}

export function duplicateSet(draft: WorkoutDraft, exIdx: number, setIdx: number): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const source = ex.sets[setIdx];
      if (!source) return ex;
      const dup: SetDraft = { ...source, clientId: cid("set") };
      const next = [...ex.sets];
      next.splice(setIdx + 1, 0, dup);
      return { ...ex, sets: next };
    }),
  };
}

export function reorderExercise(draft: WorkoutDraft, from: number, to: number): WorkoutDraft {
  const exercises = [...draft.exercises];
  const [moved] = exercises.splice(from, 1);
  exercises.splice(to, 0, moved);
  return { ...draft, exercises };
}

export function updateMetadata(draft: WorkoutDraft, patch: Partial<MetadataDraft>): WorkoutDraft {
  return { ...draft, metadata: { ...draft.metadata, ...patch } };
}

export function updateExercise(
  draft: WorkoutDraft,
  exIdx: number,
  patch: Partial<ExerciseDraft>
): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) => (i === exIdx ? { ...ex, ...patch } : ex)),
  };
}

export function updateSet(
  draft: WorkoutDraft,
  exIdx: number,
  setIdx: number,
  patch: Partial<SetDraft>
): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, ...patch } : s)) }
        : ex
    ),
  };
}

// ─── Quick increment ───────────────────────────────────────────────────────
export function incrementWeight(draft: WorkoutDraft, exIdx: number, setIdx: number, delta: number): WorkoutDraft {
  const current = draft.exercises[exIdx]?.sets[setIdx]?.weightKg ?? 0;
  return updateSet(draft, exIdx, setIdx, { weightKg: Math.max(0, current + delta) });
}

export function incrementReps(draft: WorkoutDraft, exIdx: number, setIdx: number, delta: number): WorkoutDraft {
  const current = draft.exercises[exIdx]?.sets[setIdx]?.reps ?? 0;
  return updateSet(draft, exIdx, setIdx, { reps: Math.max(0, current + delta) });
}

// ─── Validation ────────────────────────────────────────────────────────────
export function validateDraft(draft: WorkoutDraft): FieldErrors {
  const errors: FieldErrors = {};

  if (!draft.metadata.title.trim()) {
    errors["metadata.title"] = "Workout title is required.";
  }
  if (!draft.metadata.startedAt) {
    errors["metadata.startedAt"] = "Start time is required.";
  }
  if (draft.metadata.rpe !== undefined && (draft.metadata.rpe < 1 || draft.metadata.rpe > 10)) {
    errors["metadata.rpe"] = "RPE must be between 1 and 10.";
  }
  if (draft.exercises.length === 0) {
    errors["exercises"] = "Add at least one exercise.";
  }

  draft.exercises.forEach((ex, ei) => {
    if (!ex.exerciseId.trim()) {
      errors[`exercises.${ei}.exerciseId`] = "Select an exercise.";
    }
    if (ex.sets.length === 0) {
      errors[`exercises.${ei}.sets`] = "Add at least one set.";
    }
    ex.sets.forEach((set, si) => {
      const hasSignal = (set.reps ?? 0) > 0 || (set.durationSeconds ?? 0) > 0 || (set.distanceM ?? 0) > 0;
      if (!hasSignal) {
        errors[`exercises.${ei}.sets.${si}`] = "Each set needs reps, duration, or distance.";
      }
      if (set.weightKg !== undefined && set.weightKg < 0) {
        errors[`exercises.${ei}.sets.${si}.weightKg`] = "Weight cannot be negative.";
      }
      if (set.rpe !== undefined && (set.rpe < 1 || set.rpe > 10)) {
        errors[`exercises.${ei}.sets.${si}.rpe`] = "RPE must be between 1 and 10.";
      }
    });
  });

  return errors;
}

// ─── Draft persistence (localStorage) ──────────────────────────────────────
const DRAFT_KEY = "kruxt_workout_draft";

export function saveDraft(draft: WorkoutDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Silently fail in SSR or storage-full scenarios
  }
}

export function loadSavedDraft(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkoutDraft;
  } catch {
    return null;
  }
}

export function clearSavedDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // noop
  }
}
