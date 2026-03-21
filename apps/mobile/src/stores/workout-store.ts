import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { WorkoutBlockType, WorkoutType, WorkoutVisibility } from "@kruxt/types";

// ---------------------------------------------------------------------------
// Local types for in-progress workout building (client-only until submission)
// ---------------------------------------------------------------------------

export interface ExerciseSet {
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  isPr: boolean;
}

export interface WorkoutBlock {
  exerciseId: string;
  blockId: string | null;
  blockType: WorkoutBlockType;
  orderIndex: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  notes: string;
  sets: ExerciseSet[];
}

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

export interface WorkoutState {
  /** Whether the user has an active workout session in progress. */
  isActive: boolean;
  workoutType: WorkoutType | null;
  visibility: WorkoutVisibility;
  title: string;
  notes: string;
  blocks: WorkoutBlock[];
  startedAt: string | null;
}

export interface WorkoutActions {
  /** Begin a new workout session, resetting any previous state. */
  startWorkout: (type: WorkoutType) => void;
  setVisibility: (v: WorkoutVisibility) => void;
  setTitle: (t: string) => void;
  setNotes: (n: string) => void;

  /** Append a new exercise block to the workout. */
  addBlock: (block: WorkoutBlock) => void;
  /** Partially update an existing block by index. */
  updateBlock: (index: number, patch: Partial<WorkoutBlock>) => void;
  removeBlock: (index: number) => void;

  /** Add a set to a specific exercise block. */
  addSetToBlock: (blockIndex: number, set: ExerciseSet) => void;
  /** Partially update a set within a block. */
  updateSet: (blockIndex: number, setIndex: number, patch: Partial<ExerciseSet>) => void;
  removeSet: (blockIndex: number, setIndex: number) => void;

  /** Discard the current workout without saving. */
  discardWorkout: () => void;
  /** Full reset (same as discardWorkout). */
  reset: () => void;
}

export type WorkoutStore = WorkoutState & WorkoutActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: WorkoutState = {
  isActive: false,
  workoutType: null,
  visibility: "public",
  title: "",
  notes: "",
  blocks: [],
  startedAt: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkoutStore = create<WorkoutStore>()(
  immer((set) => ({
    ...initialState,

    startWorkout: (type) =>
      set((state) => {
        Object.assign(state, initialState);
        state.isActive = true;
        state.workoutType = type;
        state.startedAt = new Date().toISOString();
      }),

    setVisibility: (v) =>
      set((state) => {
        state.visibility = v;
      }),

    setTitle: (t) =>
      set((state) => {
        state.title = t;
      }),

    setNotes: (n) =>
      set((state) => {
        state.notes = n;
      }),

    addBlock: (block) =>
      set((state) => {
        state.blocks.push(block);
      }),

    updateBlock: (index, patch) =>
      set((state) => {
        const block = state.blocks[index];
        if (block) {
          Object.assign(block, patch);
        }
      }),

    removeBlock: (index) =>
      set((state) => {
        state.blocks.splice(index, 1);
      }),

    addSetToBlock: (blockIndex, exerciseSet) =>
      set((state) => {
        const block = state.blocks[blockIndex];
        if (block) {
          block.sets.push(exerciseSet);
        }
      }),

    updateSet: (blockIndex, setIndex, patch) =>
      set((state) => {
        const exerciseSet = state.blocks[blockIndex]?.sets[setIndex];
        if (exerciseSet) {
          Object.assign(exerciseSet, patch);
        }
      }),

    removeSet: (blockIndex, setIndex) =>
      set((state) => {
        const block = state.blocks[blockIndex];
        if (block) {
          block.sets.splice(setIndex, 1);
        }
      }),

    discardWorkout: () => set(() => ({ ...initialState })),

    reset: () => set(() => ({ ...initialState })),
  }))
);
