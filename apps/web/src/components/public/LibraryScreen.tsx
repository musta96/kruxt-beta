"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  loadLibrarySnapshot,
  type LibraryExercise,
  type LibrarySnapshot
} from "@/lib/public/library";
import { loadWorkoutTemplates, type WorkoutTemplate } from "@/lib/public/workout-log";
import { buildTemplateWorkoutHref } from "@/lib/public/workout-handoff";

type LibraryTab = "programs" | "workouts" | "techniques" | "exercises";

const TABS: Array<{ value: LibraryTab; label: string }> = [
  { value: "programs", label: "Programs" },
  { value: "workouts", label: "Workouts" },
  { value: "techniques", label: "Techniques" },
  { value: "exercises", label: "Exercises" }
];

const CATEGORY_ENTRYPOINTS = ["Strength", "HIIT", "For The Gym", "HYROX"];

function matchesExercise(exercise: LibraryExercise, query: string, category: string, equipment: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const queryMatch =
    !normalizedQuery ||
    exercise.name.toLowerCase().includes(normalizedQuery) ||
    exercise.category.toLowerCase().includes(normalizedQuery) ||
    (exercise.movementPattern ?? "").toLowerCase().includes(normalizedQuery);

  return queryMatch && (!category || exercise.category === category) && (!equipment || exercise.equipment === equipment);
}

export function LibraryScreen() {
  const { state, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedDays, setSelectedDays] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<LibraryTab>("workouts");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextSnapshot, nextTemplates] = await Promise.all([
          loadLibrarySnapshot(supabase),
          loadWorkoutTemplates(supabase)
        ]);
        if (active) {
          setSnapshot(nextSnapshot);
          setTemplates(nextTemplates);
          setSelectedDays({});
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load library.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  const filteredExercises = useMemo(
    () =>
      (snapshot?.exercises ?? [])
        .filter((exercise) => matchesExercise(exercise, query, category, equipment))
        .sort((left, right) => right.completedCount - left.completedCount || left.name.localeCompare(right.name))
        .slice(0, 80),
    [category, equipment, query, snapshot?.exercises]
  );

  const filteredPrograms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (snapshot?.editorialPrograms ?? []).filter((program) => {
      const matchesText =
        !normalizedQuery ||
        program.title.toLowerCase().includes(normalizedQuery) ||
        program.category.toLowerCase().includes(normalizedQuery) ||
        program.outcome.toLowerCase().includes(normalizedQuery);
      const matchesEquipment = !equipment || program.equipment.includes(equipment);
      return matchesText && (!category || program.category.toLowerCase() === category.toLowerCase()) && matchesEquipment;
    });
  }, [category, equipment, query, snapshot?.editorialPrograms]);

  return (
    <MemberShell
      title="Library"
      subtitle="Programs, workouts, techniques, and exercise taxonomy packaged for plan-first training."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}

      {loading ? (
        <section className="feed-card">
          <p className="feed-body">Loading training library...</p>
        </section>
      ) : (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">CONTENT LIBRARY</p>
              <h2 className="section-title">Find your next session</h2>
              <div className="category-entry-grid">
                {CATEGORY_ENTRYPOINTS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className="category-entry"
                    onClick={() => {
                      setTab(entry === "For The Gym" || entry === "HYROX" ? "programs" : "exercises");
                      setCategory(entry === "For The Gym" ? "" : entry.toLowerCase());
                      setQuery(entry === "For The Gym" ? "gym" : "");
                    }}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-stats">
              <div className="metric-card">
                <span className="metric-label">Exercises</span>
                <strong className="metric-value">{snapshot?.exercises.length ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Saved workouts</span>
                <strong className="metric-value">{snapshot?.workoutTemplates.length ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Recent proof</span>
                <strong className="metric-value-sm">{snapshot?.recentWorkoutCount ?? 0} sessions</strong>
              </div>
            </div>
          </section>

          <section className="glass-panel">
            <div className="library-toolbar">
              <div className="segmented-control" role="group" aria-label="Library sections">
                {TABS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={tab === item.value}
                    className={`segment-button ${tab === item.value ? "is-active" : ""}`}
                    onClick={() => setTab(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="library-filters">
                <input
                  className="input"
                  aria-label="Search library"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search library"
                />
                <select className="input" aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {(snapshot?.facets.categories ?? []).map((facet) => (
                    <option key={facet} value={facet}>
                      {facet}
                    </option>
                  ))}
                </select>
                <select className="input" aria-label="Equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                  <option value="">All equipment</option>
                  {(snapshot?.facets.equipment ?? []).map((facet) => (
                    <option key={facet} value={facet}>
                      {facet}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {tab === "programs" ? (
            <section className="content-card-grid">
              {filteredPrograms.map((program) => (
                <article key={program.id} className="content-card">
                  <div className="content-card-header">
                    <div>
                      <p className="eyebrow">{program.category}</p>
                      <h2 className="feed-title">{program.title}</h2>
                    </div>
                    <span className="billing-status">Preview</span>
                  </div>
                  <p className="section-copy">{program.outcome}</p>
                  <dl className="feed-stat-row">
                    <div>
                      <dt>Level</dt>
                      <dd>{program.difficulty}</dd>
                    </div>
                    <div>
                      <dt>Block</dt>
                      <dd>
                        {program.durationWeeks}w · {program.sessionsPerWeek}/wk
                      </dd>
                    </div>
                  </dl>
                  <div className="stage-strip">
                    {program.stages.map((stage) => (
                      <span key={stage} className="ghost-chip">
                        {stage}
                      </span>
                    ))}
                  </div>
                  <div className="stack-actions">
                    <Link href="/plan" className="primary-cta">
                      View my plan
                    </Link>
                  </div>
                  <p className="supporting-copy">Program outline only. No workout sessions are attached.</p>
                </article>
              ))}
            </section>
          ) : null}

          {tab === "workouts" ? (
            <section className="content-card-grid">
              {(snapshot?.workoutTemplates ?? []).map((template) => {
                const persistedTemplate = templates.find((item) => item.id === template.id);
                const dayId = selectedDays[template.id] ?? persistedTemplate?.days[0]?.id ?? "";
                const href = persistedTemplate ? buildTemplateWorkoutHref(persistedTemplate, dayId) : null;
                return (
                  <article key={template.id} className="content-card">
                    <div className="content-card-header">
                      <div>
                        <p className="eyebrow">{template.workoutType}</p>
                        <h2 className="feed-title">{template.name}</h2>
                      </div>
                      <span className="billing-status status-success">{template.status}</span>
                    </div>
                    <p className="section-copy">{template.description ?? "Saved from the logger and ready to repeat."}</p>
                    <dl className="feed-stat-row">
                      <div>
                        <dt>Days</dt>
                        <dd>{template.dayCount}</dd>
                      </div>
                      <div>
                        <dt>Exercises</dt>
                        <dd>{template.exerciseCount}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{template.source}</dd>
                      </div>
                    </dl>
                    <label>
                      <span className="field-label">Workout day</span>
                      <select
                        className="input"
                        value={dayId}
                        disabled={!persistedTemplate?.days.length}
                        onChange={(event) => setSelectedDays((current) => ({ ...current, [template.id]: event.target.value }))}
                      >
                        {!persistedTemplate?.days.length ? <option value="">No available days</option> : null}
                        {(persistedTemplate?.days ?? []).map((day) => (
                          <option key={day.id} value={day.id}>{day.label}</option>
                        ))}
                      </select>
                    </label>
                    {href ? (
                      <Link href={href} className="primary-cta" prefetch={false}>
                        Log from template
                      </Link>
                    ) : (
                      <>
                        <button type="button" className="primary-cta" disabled>Log from template</button>
                        <p className="supporting-copy" role="status">This template day cannot be opened. Choose another day or edit the template in Log.</p>
                      </>
                    )}
                  </article>
                );
              })}
              {(snapshot?.workoutTemplates.length ?? 0) === 0 ? (
                <article className="content-card">
                  <p className="eyebrow">EMPTY</p>
                  <h2 className="feed-title">No saved workouts yet</h2>
                  <p className="section-copy">Save repeatable workouts from the Log screen and they will appear here.</p>
                  <Link href="/log" className="primary-cta">
                    Create workout
                  </Link>
                </article>
              ) : null}
            </section>
          ) : null}

          {tab === "techniques" ? (
            <section className="content-card-grid">
              {(snapshot?.techniqueGroups ?? []).map((group) => (
                <article key={group.id} className="content-card">
                  <div className="content-card-header">
                    <div>
                      <p className="eyebrow">{group.category}</p>
                      <h2 className="feed-title">{group.title}</h2>
                    </div>
                    <span className="ghost-chip">{group.exerciseCount} moves</span>
                  </div>
                  <div className="technique-ladder">
                    {group.progression.map((step, index) => (
                      <div key={step} className="rank-row">
                        <span className="rank-position">{index + 1}</span>
                        <span className="rank-row-body">{step}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="checklist">
                    {group.cues.map((cue) => (
                      <li key={cue}>{cue}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          ) : null}

          {tab === "exercises" ? (
            <section className="exercise-directory">
              {filteredExercises.map((exercise) => (
                <article key={exercise.id} className="exercise-row-card">
                  <div>
                    <p className="eyebrow">{exercise.category}</p>
                    <h3 className="log-block-title">{exercise.name}</h3>
                    <p className="feed-body">
                      {exercise.movementPattern ?? "movement"} · {exercise.equipment ?? "any equipment"}
                    </p>
                  </div>
                  <div className="exercise-proof">
                    <strong>{exercise.completedCount}</strong>
                    <span>completed</span>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </>
      )}
    </MemberShell>
  );
}
