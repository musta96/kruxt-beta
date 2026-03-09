"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { WorkoutType, WorkoutVisibility } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  loadWorkoutLogContext,
  searchExercises,
  submitWorkout,
  type ExerciseSearchResult,
  type WorkoutLogContext
} from "@/lib/public/workout-log";

const WORKOUT_TYPES: WorkoutType[] = ["strength", "functional", "hyrox", "crossfit", "conditioning", "custom"];
const VISIBILITIES: WorkoutVisibility[] = ["public", "followers", "gym", "private"];

export function LogScreen() {
  const { state, supabase } = usePublicSession();
  const [context, setContext] = useState<WorkoutLogContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [title, setTitle] = useState("Evening HYROX");
  const [notes, setNotes] = useState("");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("hyrox");
  const [visibility, setVisibility] = useState<WorkoutVisibility>("public");
  const [gymId, setGymId] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseSearchResult | null>(null);
  const [reps, setReps] = useState("12");
  const [weightKg, setWeightKg] = useState("40");
  const [rpe, setRpe] = useState("7");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const nextContext = await loadWorkoutLogContext(supabase);
        if (!active) return;
        setContext(nextContext);
        setGymId(nextContext.homeGymId ?? nextContext.gyms[0]?.id ?? "");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load workout context.");
      } finally {
        if (!active) return;
        setLoadingContext(false);
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  useEffect(() => {
    if (exerciseQuery.trim().length < 2) {
      setExerciseResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchExercises(supabase, exerciseQuery);
        if (!active) return;
        setExerciseResults(results);
      } catch (searchError) {
        if (!active) return;
        setError(searchError instanceof Error ? searchError.message : "Unable to search exercises.");
      } finally {
        if (!active) return;
        setSearching(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [exerciseQuery, supabase]);

  const selectedGymName = useMemo(
    () => context?.gyms.find((gym) => gym.id === gymId)?.name ?? null,
    [context?.gyms, gymId]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedExercise) {
      setError("Select one exercise before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const repsValue = Number(reps);
      const weightValue = Number(weightKg);
      const rpeValue = Number(rpe);

      const result = await submitWorkout(supabase, {
        title,
        notes,
        workoutType,
        visibility,
        gymId: gymId || context?.homeGymId || null,
        startedAt: new Date().toISOString(),
        rpe: Number.isFinite(rpeValue) ? rpeValue : undefined,
        exercise: {
          exerciseId: selectedExercise.id,
          targetReps: reps,
          targetWeightKg: Number.isFinite(weightValue) ? weightValue : undefined,
          notes,
          set: {
            reps: Number.isFinite(repsValue) ? repsValue : undefined,
            weightKg: Number.isFinite(weightValue) ? weightValue : undefined,
            rpe: Number.isFinite(rpeValue) ? rpeValue : undefined
          }
        }
      });

      setSuccess(
        `Workout logged. XP ${result.xpDelta.xpBefore} -> ${result.xpDelta.xpAfter}. Chain ${result.xpDelta.chainDaysBefore} -> ${result.xpDelta.chainDaysAfter}.`
      );
      setExerciseQuery("");
      setExerciseResults([]);
      setSelectedExercise(null);
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log workout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MemberShell
      title="Workout Log"
      subtitle="Search an exercise, submit one real workout block, and push proof into the live KRUXT data model."
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">LOG FLOW</p>
          <h2 className="section-title">Record effort before it disappears.</h2>
          <p className="section-copy">
            This web logger now uses the live exercise catalog and submits through the same atomic workout path as the
            native baseline.
          </p>
          <div className="stack-actions">
            <Link href="/feed" className="secondary-cta">
              Open proof feed
            </Link>
          </div>
        </div>

        <div className="hero-stats">
          <div className="metric-card">
            <span className="metric-label">Chain</span>
            <strong className="metric-value">{context?.chainDays ?? 0} days</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Level</span>
            <strong className="metric-value">{context?.level ?? 1}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Rank</span>
            <strong className="metric-value metric-value-sm">{context?.rankTier ?? "initiate"}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">XP</span>
            <strong className="metric-value">{context?.xpTotal ?? 0}</strong>
          </div>
        </div>
      </section>

      {loadingContext ? <div className="status-banner">Loading workout context…</div> : null}
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      <form className="section-stack" onSubmit={handleSubmit}>
        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">SESSION</p>
              <h2 className="section-title">Metadata</h2>
            </div>
            {selectedGymName ? <span className="ghost-chip">{selectedGymName}</span> : null}
          </div>

          <div className="split-card">
            <div>
              <label className="label" htmlFor="log-title">Title</label>
              <input
                id="log-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Evening HYROX"
              />
            </div>
            <div>
              <label className="label" htmlFor="log-gym">Gym</label>
              <select
                id="log-gym"
                className="input"
                value={gymId}
                onChange={(event) => setGymId(event.target.value)}
              >
                <option value="">No gym selected</option>
                {(context?.gyms ?? []).map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="log-notes">Notes</label>
            <textarea
              id="log-notes"
              className="input profile-bio"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Session notes, intent, or context."
            />
          </div>
        </section>

        <section className="split-card">
          <div className="glass-panel tight-panel">
            <p className="field-label">Workout type</p>
            <div className="chip-row">
              {WORKOUT_TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ghost-chip ${workoutType === option ? "is-selected" : ""}`}
                  onClick={() => setWorkoutType(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel tight-panel">
            <p className="field-label">Visibility</p>
            <div className="chip-row">
              {VISIBILITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ghost-chip ${visibility === option ? "is-selected" : ""}`}
                  onClick={() => setVisibility(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-panel form-grid">
          <div className="profile-form-header">
            <div>
              <p className="eyebrow">EXERCISE</p>
              <h2 className="section-title">Search and select</h2>
            </div>
            {selectedExercise ? <span className="identity-chip">{selectedExercise.name}</span> : null}
          </div>

          <div>
            <label className="label" htmlFor="log-exercise-search">Exercise</label>
            <input
              id="log-exercise-search"
              className="input"
              value={exerciseQuery}
              onChange={(event) => {
                setExerciseQuery(event.target.value);
                setSelectedExercise(null);
                setError(null);
              }}
              placeholder="Search exercise catalog"
            />
            {searching ? <p className="feed-body">Searching exercises…</p> : null}
            {exerciseResults.length > 0 && !selectedExercise ? (
              <div className="result-list">
                {exerciseResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="result-row"
                    onClick={() => {
                      setSelectedExercise(result);
                      setExerciseQuery(result.name);
                      setExerciseResults([]);
                    }}
                  >
                    {result.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="split-card">
            <div>
              <label className="label" htmlFor="log-reps">Reps</label>
              <input
                id="log-reps"
                className="input"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                inputMode="numeric"
                placeholder="12"
              />
            </div>
            <div>
              <label className="label" htmlFor="log-weight">Weight (kg)</label>
              <input
                id="log-weight"
                className="input"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                inputMode="decimal"
                placeholder="40"
              />
            </div>
            <div>
              <label className="label" htmlFor="log-rpe">RPE</label>
              <input
                id="log-rpe"
                className="input"
                value={rpe}
                onChange={(event) => setRpe(event.target.value)}
                inputMode="decimal"
                placeholder="7"
              />
            </div>
          </div>
        </section>

        <section className="glass-panel">
          <p className="field-label">Submission checklist</p>
          <ul className="checklist">
            <li>One exercise and one set are enough to create a real workout</li>
            <li>The workout is submitted through `log_workout_atomic`</li>
            <li>XP, level, chain, and feed events update on the same path</li>
          </ul>
          <div className="stack-actions">
            <button type="submit" className="primary-cta" disabled={submitting || loadingContext}>
              {submitting ? "Logging..." : "Log workout"}
            </button>
            <Link href="/feed" className="secondary-cta">
              Back to feed
            </Link>
          </div>
        </section>
      </form>
    </MemberShell>
  );
}
