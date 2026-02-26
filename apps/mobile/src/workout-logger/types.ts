import type { WorkoutType, WorkoutVisibility } from "@kruxt/types";

// ─── Block types ───────────────────────────────────────────────────────────
export type BlockType = "straight_set" | "superset" | "circuit" | "emom" | "amrap";

// ─── Set draft ─────────────────────────────────────────────────────────────
export interface SetDraft {
  clientId: string;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceM?: number;
  rpe?: number;
  isPr?: boolean;
}

// ─── Exercise draft ────────────────────────────────────────────────────────
export interface ExerciseDraft {
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  blockType: BlockType;
  notes?: string;
  targetReps?: string;
  targetWeightKg?: number;
  sets: SetDraft[];
}

// ─── Metadata draft ────────────────────────────────────────────────────────
export interface MetadataDraft {
  title: string;
  workoutType: WorkoutType;
  visibility: WorkoutVisibility;
  notes?: string;
  startedAt: string;
  endedAt?: string;
  rpe?: number;
  gymId?: string;
}

// ─── Full draft ────────────────────────────────────────────────────────────
export interface WorkoutDraft {
  metadata: MetadataDraft;
  exercises: ExerciseDraft[];
}

// ─── Chain/rank context for header ─────────────────────────────────────────
export interface ChainContext {
  chainDays: number;
  rankTier: string;
  level: number;
  xpTotal: number;
}

// ─── XP/rank delta after submit ────────────────────────────────────────────
export interface XpDelta {
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  chainDaysBefore: number;
  chainDaysAfter: number;
  rankTierBefore: string;
  rankTierAfter: string;
}

// ─── Submit result ─────────────────────────────────────────────────────────
export interface WorkoutLoggerSubmitResult {
  workoutId: string;
  xpDelta: XpDelta;
}

// ─── Service contract (injected) ───────────────────────────────────────────
export interface WorkoutLoggerServices {
  /** Load chain/rank context for header */
  loadContext: () => Promise<ChainContext>;
  /** Submit draft through createPhase3WorkoutLoggerUiFlow */
  submit: (draft: WorkoutDraft) => Promise<WorkoutLoggerSubmitResult>;
}

// ─── Field errors ──────────────────────────────────────────────────────────
export type FieldErrors = Record<string, string>;
