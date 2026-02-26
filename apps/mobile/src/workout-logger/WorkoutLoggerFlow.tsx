import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  WorkoutLoggerServices,
  WorkoutDraft,
  ChainContext,
  XpDelta,
  FieldErrors,
  ExerciseOption
} from "./types";
import {
  createEmptyDraft,
  addExercise,
  removeExercise,
  addSet,
  removeSet,
  duplicateSet,
  incrementWeight,
  incrementReps,
  updateMetadata,
  updateExercise,
  updateSet,
  validateDraft,
  saveDraft,
  loadSavedDraft,
  clearSavedDraft,
} from "./draft-utils";

// ─── Inline design-system atoms (avoids cross-module import issues) ────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Visibility options ────────────────────────────────────────────────────
const VISIBILITY_OPTIONS = [
  { value: "public" as const, label: "Public", icon: "🌍" },
  { value: "followers" as const, label: "Followers", icon: "👥" },
  { value: "gym" as const, label: "Gym", icon: "🏋️" },
  { value: "private" as const, label: "Private", icon: "🔒" },
];

const WORKOUT_TYPE_OPTIONS = [
  { value: "strength" as const, label: "Strength" },
  { value: "functional" as const, label: "Functional" },
  { value: "hyrox" as const, label: "Hyrox" },
  { value: "conditioning" as const, label: "Conditioning" },
  { value: "custom" as const, label: "Custom" },
];

const BLOCK_TYPE_OPTIONS = [
  { value: "straight_set" as const, label: "Straight" },
  { value: "superset" as const, label: "Superset" },
  { value: "circuit" as const, label: "Circuit" },
  { value: "emom" as const, label: "EMOM" },
  { value: "amrap" as const, label: "AMRAP" },
];

// ─── Micro-animations ─────────────────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2 },
};

// ─── Main component ───────────────────────────────────────────────────────
interface Props {
  services: WorkoutLoggerServices;
  onComplete: (workoutId: string) => void;
  onCancel?: () => void;
}

export function WorkoutLoggerFlow({ services, onComplete, onCancel }: Props) {
  const [draft, setDraft] = useState<WorkoutDraft>(() => loadSavedDraft() ?? createEmptyDraft());
  const [context, setContext] = useState<ChainContext | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [xpResult, setXpResult] = useState<XpDelta | null>(null);
  const [completedWorkoutId, setCompletedWorkoutId] = useState<string | null>(null);
  const [exerciseOptions, setExerciseOptions] = useState<Record<string, ExerciseOption[]>>({});
  const [exerciseSearchLoading, setExerciseSearchLoading] = useState<Record<string, boolean>>({});
  const submitGuard = useRef(false);
  const exerciseSearchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load chain/rank context
  useEffect(() => {
    services.loadContext().then(setContext).catch(() => {});
  }, [services]);

  // Auto-save draft on change
  useEffect(() => {
    if (!completedWorkoutId) saveDraft(draft);
  }, [draft, completedWorkoutId]);

  useEffect(() => {
    return () => {
      Object.values(exerciseSearchTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleExerciseInputChange = useCallback(
    (exerciseClientId: string, exerciseIndex: number, value: string) => {
      setDraft((prev) =>
        updateExercise(prev, exerciseIndex, {
          exerciseName: value,
          exerciseId: ""
        })
      );

      const q = value.trim();
      if (exerciseSearchTimers.current[exerciseClientId]) {
        clearTimeout(exerciseSearchTimers.current[exerciseClientId]);
      }

      if (q.length < 2) {
        setExerciseOptions((prev) => ({ ...prev, [exerciseClientId]: [] }));
        setExerciseSearchLoading((prev) => ({ ...prev, [exerciseClientId]: false }));
        return;
      }

      setExerciseSearchLoading((prev) => ({ ...prev, [exerciseClientId]: true }));
      exerciseSearchTimers.current[exerciseClientId] = setTimeout(async () => {
        try {
          const results = await services.searchExercises(q);
          setExerciseOptions((prev) => ({ ...prev, [exerciseClientId]: results }));
        } catch {
          setExerciseOptions((prev) => ({ ...prev, [exerciseClientId]: [] }));
        } finally {
          setExerciseSearchLoading((prev) => ({ ...prev, [exerciseClientId]: false }));
        }
      }, 220);
    },
    [services]
  );

  const handleSelectExercise = useCallback(
    (exerciseClientId: string, exerciseIndex: number, option: ExerciseOption) => {
      setDraft((prev) =>
        updateExercise(prev, exerciseIndex, {
          exerciseId: option.id,
          exerciseName: option.name
        })
      );
      setExerciseOptions((prev) => ({ ...prev, [exerciseClientId]: [] }));
      setExerciseSearchLoading((prev) => ({ ...prev, [exerciseClientId]: false }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (submitGuard.current) return;
    const fieldErrors = validateDraft(draft);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    submitGuard.current = true;
    try {
      const result = await services.submit(draft);
      clearSavedDraft();
      setXpResult(result.xpDelta);
      setCompletedWorkoutId(result.workoutId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Unable to submit workout.");
    } finally {
      setSubmitting(false);
      submitGuard.current = false;
    }
  }, [draft, services]);

  // ─── Success screen ─────────────────────────────────────────────────────
  if (completedWorkoutId && xpResult) {
    return (
      <div className="screen items-center justify-center gap-6 text-center">
        <motion.div {...fadeSlide}>
          <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-display font-black text-foreground">Proof Posted</h1>
          <p className="text-sm text-muted-foreground mt-1">Your workout is live on the feed.</p>
        </motion.div>

        {/* XP/Rank delta panel */}
        <motion.div {...fadeSlide} transition={{ delay: 0.15, duration: 0.2 }} className="w-full max-w-sm">
          <div className="panel p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="stat-label">XP</span>
              <span className="font-mono text-lg tabular-nums text-foreground">
                {xpResult.xpBefore} → <span className="text-primary font-bold">{xpResult.xpAfter}</span>
                <span className="text-xs text-success ml-1">+{xpResult.xpAfter - xpResult.xpBefore}</span>
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="stat-label">Chain</span>
              <span className="font-mono text-lg tabular-nums text-foreground">
                {xpResult.chainDaysBefore}d → <span className="text-primary font-bold">{xpResult.chainDaysAfter}d</span>
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="stat-label">Level</span>
              <span className="font-mono text-lg tabular-nums text-foreground">
                {xpResult.levelBefore}
                {xpResult.levelAfter > xpResult.levelBefore && (
                  <span className="text-warning ml-2">→ {xpResult.levelAfter} 🎉</span>
                )}
              </span>
            </div>
            {xpResult.rankTierAfter !== xpResult.rankTierBefore && (
              <>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="stat-label">Rank</span>
                  <span className="font-mono text-lg tabular-nums text-primary font-bold uppercase">
                    {xpResult.rankTierAfter}
                  </span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <button
          className="btn-primary max-w-sm"
          onClick={() => onComplete(completedWorkoutId)}
        >
          View in Feed →
        </button>
      </div>
    );
  }

  // ─── Logger screen ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with chain/rank context */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onCancel && (
              <button onClick={onCancel} className="text-muted-foreground text-sm font-display" aria-label="Cancel">
                ✕
              </button>
            )}
            <h1 className="text-lg font-display font-bold text-foreground">Log Workout</h1>
          </div>
          {context && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                🔥 {context.chainDays}d
              </span>
              <span className="badge-ion text-[10px] uppercase">{context.rankTier}</span>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-5 py-4 pb-32 space-y-5">
        {/* Metadata section */}
        <section className="space-y-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="wl-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Title
            </label>
            <input
              id="wl-title"
              className={`input-field ${errors["metadata.title"] ? "border-destructive" : ""}`}
              value={draft.metadata.title}
              onChange={(e) => setDraft(updateMetadata(draft, { title: e.target.value }))}
              placeholder="Workout Session"
            />
            {errors["metadata.title"] && <span className="field-error">{errors["metadata.title"]}</span>}
          </div>

          {/* Workout type tabs */}
          <div className="flex panel p-1 gap-1" role="tablist" aria-label="Workout type">
            {WORKOUT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="tab"
                aria-selected={draft.metadata.workoutType === opt.value}
                onClick={() => setDraft(updateMetadata(draft, { workoutType: opt.value }))}
                className={`flex-1 py-2 px-2 rounded-md text-xs font-semibold font-display transition-colors ${
                  draft.metadata.workoutType === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Visibility selector */}
          <div className="flex gap-2">
            {VISIBILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDraft(updateMetadata(draft, { visibility: opt.value }))}
                className={`flex-1 panel p-2 flex flex-col items-center gap-1 rounded-lg transition-colors ${
                  draft.metadata.visibility === opt.value ? "border-primary/50 bg-primary/5" : ""
                }`}
              >
                <span className="text-sm">{opt.icon}</span>
                <span className="text-[10px] font-display font-semibold text-muted-foreground">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Optional notes */}
          <div className="flex flex-col gap-1">
            <label htmlFor="wl-notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Notes <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <textarea
              id="wl-notes"
              className="input-field min-h-[60px] resize-none"
              value={draft.metadata.notes ?? ""}
              onChange={(e) => setDraft(updateMetadata(draft, { notes: e.target.value || undefined }))}
              placeholder="How did it feel?"
              rows={2}
            />
          </div>

          {/* RPE summary */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              Session RPE
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className={`input-field w-20 text-center font-mono ${errors["metadata.rpe"] ? "border-destructive" : ""}`}
              value={draft.metadata.rpe ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                setDraft(updateMetadata(draft, { rpe: v }));
              }}
              placeholder="—"
            />
            <span className="text-xs text-muted-foreground">/ 10</span>
          </div>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-display uppercase tracking-wider">Exercises</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Exercise blocks */}
        {errors["exercises"] && (
          <div className="panel border-destructive/40 bg-destructive/10 p-3" role="alert">
            <p className="text-destructive text-xs font-semibold">{errors["exercises"]}</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {draft.exercises.map((ex, exIdx) => (
            <motion.section
              key={ex.clientId}
              layout
              {...fadeSlide}
              className="panel p-4 space-y-3"
            >
              {/* Exercise header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    className={`input-field text-sm font-semibold ${
                      errors[`exercises.${exIdx}.exerciseId`] ? "border-destructive" : ""
                    }`}
                    value={ex.exerciseName}
                    onChange={(e) => handleExerciseInputChange(ex.clientId, exIdx, e.target.value)}
                    placeholder="Search exercise catalog"
                    autoComplete="off"
                  />
                  {errors[`exercises.${exIdx}.exerciseId`] && (
                    <span className="field-error">{errors[`exercises.${exIdx}.exerciseId`]}</span>
                  )}
                  {((exerciseOptions[ex.clientId] ?? []).length > 0 || exerciseSearchLoading[ex.clientId]) && (
                    <div className="mt-1 panel p-1.5 space-y-1 max-h-40 overflow-y-auto">
                      {exerciseSearchLoading[ex.clientId] && (
                        <div className="text-xs text-muted-foreground px-2 py-1">Searching exercises...</div>
                      )}
                      {(exerciseOptions[ex.clientId] ?? []).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleSelectExercise(ex.clientId, exIdx, option)}
                          className="w-full text-left px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-secondary transition-colors"
                        >
                          {option.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDraft(removeExercise(draft, exIdx))}
                  className="text-muted-foreground hover:text-destructive text-sm p-1 transition-colors"
                  aria-label="Remove exercise"
                >
                  ✕
                </button>
              </div>

              {/* Block type selector */}
              <div className="flex gap-1 overflow-x-auto">
                {BLOCK_TYPE_OPTIONS.map((bt) => (
                  <button
                    key={bt.value}
                    onClick={() => setDraft(updateExercise(draft, exIdx, { blockType: bt.value }))}
                    className={`px-3 py-1 rounded-full text-[10px] font-display font-semibold whitespace-nowrap transition-colors ${
                      ex.blockType === bt.value
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>

              {/* Sets table */}
              {errors[`exercises.${exIdx}.sets`] && (
                <span className="field-error">{errors[`exercises.${exIdx}.sets`]}</span>
              )}

              <div className="space-y-2">
                {/* Set header */}
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-1 text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  <span>#</span>
                  <span>Reps</span>
                  <span>Weight</span>
                  <span>RPE</span>
                  <span />
                </div>

                <AnimatePresence mode="popLayout">
                  {ex.sets.map((set, setIdx) => (
                    <motion.div
                      key={set.clientId}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-[2rem_1fr_1fr_1fr_2.5rem] gap-1 items-center"
                    >
                      <span className="text-xs font-mono text-muted-foreground text-center">{setIdx + 1}</span>

                      {/* Reps with increment */}
                      <div className="flex items-center gap-0.5">
                        <button
                          className="w-6 h-8 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary active:scale-95 transition-all"
                          onClick={() => setDraft(incrementReps(draft, exIdx, setIdx, -1))}
                          aria-label="Decrease reps"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className={`input-field text-center text-sm font-mono py-1.5 px-1 ${
                            errors[`exercises.${exIdx}.sets.${setIdx}`] ? "border-destructive" : ""
                          }`}
                          value={set.reps ?? ""}
                          onChange={(e) =>
                            setDraft(updateSet(draft, exIdx, setIdx, { reps: e.target.value ? Number(e.target.value) : undefined }))
                          }
                          min={0}
                        />
                        <button
                          className="w-6 h-8 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary active:scale-95 transition-all"
                          onClick={() => setDraft(incrementReps(draft, exIdx, setIdx, 1))}
                          aria-label="Increase reps"
                        >
                          +
                        </button>
                      </div>

                      {/* Weight with increment */}
                      <div className="flex items-center gap-0.5">
                        <button
                          className="w-6 h-8 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary active:scale-95 transition-all"
                          onClick={() => setDraft(incrementWeight(draft, exIdx, setIdx, -2.5))}
                          aria-label="Decrease weight"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="input-field text-center text-sm font-mono py-1.5 px-1"
                          value={set.weightKg ?? ""}
                          onChange={(e) =>
                            setDraft(updateSet(draft, exIdx, setIdx, { weightKg: e.target.value ? Number(e.target.value) : undefined }))
                          }
                          min={0}
                          step={2.5}
                        />
                        <button
                          className="w-6 h-8 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary active:scale-95 transition-all"
                          onClick={() => setDraft(incrementWeight(draft, exIdx, setIdx, 2.5))}
                          aria-label="Increase weight"
                        >
                          +
                        </button>
                      </div>

                      {/* RPE */}
                      <input
                        type="number"
                        className="input-field text-center text-sm font-mono py-1.5 px-1"
                        value={set.rpe ?? ""}
                        onChange={(e) =>
                          setDraft(updateSet(draft, exIdx, setIdx, { rpe: e.target.value ? Number(e.target.value) : undefined }))
                        }
                        min={1}
                        max={10}
                        placeholder="—"
                      />

                      {/* Set actions */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => setDraft(duplicateSet(draft, exIdx, setIdx))}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Duplicate set"
                          title="Duplicate set"
                        >
                          ⧉
                        </button>
                        <button
                          onClick={() => setDraft(removeSet(draft, exIdx, setIdx))}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove set"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Add set */}
                <button
                  onClick={() => setDraft(addSet(draft, exIdx))}
                  className="btn-compact w-full text-center"
                >
                  + Add Set
                </button>
              </div>

              {/* Exercise notes */}
              <input
                className="input-field text-xs"
                value={ex.notes ?? ""}
                onChange={(e) => setDraft(updateExercise(draft, exIdx, { notes: e.target.value || undefined }))}
                placeholder="Exercise notes (optional)"
              />

              {/* Per-set errors */}
              {ex.sets.map((_, si) =>
                errors[`exercises.${exIdx}.sets.${si}`] ? (
                  <span key={si} className="field-error">
                    Set {si + 1}: {errors[`exercises.${exIdx}.sets.${si}`]}
                  </span>
                ) : null
              )}
            </motion.section>
          ))}
        </AnimatePresence>

        {/* Add exercise */}
        <button onClick={() => setDraft(addExercise(draft))} className="btn-ghost">
          + Add Exercise Block
        </button>
      </main>

      {/* Sticky CTA footer */}
      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border px-5 py-4 z-50"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
        {submitError && (
          <div className="panel border-destructive/40 bg-destructive/10 p-3 mb-3" role="alert">
            <p className="text-destructive text-xs font-semibold">{submitError}</p>
          </div>
        )}
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size={16} />
              Claiming...
            </span>
          ) : (
            "Post Proof"
          )}
        </button>
      </footer>
    </div>
  );
}
