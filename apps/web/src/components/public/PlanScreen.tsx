"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadPlanSnapshot, type PlanDay, type PlanSnapshot } from "@/lib/public/plan";

const MODES = ["gym", "home", "outdoor"] as const;
const MODALITIES = ["strength", "conditioning", "hybrid", "classes", "recovery"] as const;

type SessionMode = (typeof MODES)[number];

interface PlanSetupDraft {
  daysPerWeek: string;
  sessionMinutes: string;
  abilityLevel: string;
  goal: string;
  equipment: string;
  modalities: string[];
}

const defaultSetupDraft: PlanSetupDraft = {
  daysPerWeek: "4",
  sessionMinutes: "60",
  abilityLevel: "intermediate",
  goal: "HYROX-ready strength and conditioning",
  equipment: "BZone gym floor, ergs, sled, dumbbells",
  modalities: ["strength", "conditioning", "hybrid"]
};

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function moveDay(days: PlanDay[], currentIndex: number, targetIndex: number): PlanDay[] {
  if (targetIndex < 0 || targetIndex >= days.length || currentIndex === targetIndex) return days;
  const next = [...days];
  const [item] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function inferMuscles(day: PlanDay | null): string[] {
  const text = `${day?.focus ?? ""} ${(day?.blocks ?? []).map((block) => block.exercise).join(" ")}`.toLowerCase();
  const muscles = new Set<string>();

  if (/squat|lunge|sled|leg|wall ball|step/.test(text)) muscles.add("legs");
  if (/deadlift|hinge|row|pull|carry|sled/.test(text)) muscles.add("posterior chain");
  if (/bench|press|push|dip|thruster/.test(text)) muscles.add("push");
  if (/pull|row|lat|rope|chin/.test(text)) muscles.add("pull");
  if (/run|bike|row|ski|erg|conditioning|hyrox/.test(text)) muscles.add("engine");
  if (/core|plank|sit|hollow|toes/.test(text)) muscles.add("core");

  return Array.from(muscles).slice(0, 6);
}

function inferEquipment(day: PlanDay | null, mode: SessionMode): string[] {
  if (mode === "home") return ["bodyweight", "dumbbells", "band"];
  if (mode === "outdoor") return ["running route", "timer", "bodyweight"];

  const text = `${day?.focus ?? ""} ${(day?.blocks ?? []).map((block) => block.exercise).join(" ")}`.toLowerCase();
  const equipment = new Set<string>();

  if (/barbell|squat|deadlift|bench|clean|snatch/.test(text)) equipment.add("barbell");
  if (/dumbbell|devil|farmer/.test(text)) equipment.add("dumbbells");
  if (/sled/.test(text)) equipment.add("sled");
  if (/row|ski|bike|erg/.test(text)) equipment.add("erg");
  if (/wall ball|med ball/.test(text)) equipment.add("wall ball");
  if (/kettlebell|swing/.test(text)) equipment.add("kettlebell");

  return Array.from(equipment.size ? equipment : new Set(["gym floor", "timer", "coach notes"])).slice(0, 6);
}

export function PlanScreen() {
  const { state, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const [weekDays, setWeekDays] = useState<PlanDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [setupDraft, setSetupDraft] = useState<PlanSetupDraft>(defaultSetupDraft);
  const [setupPreviewed, setSetupPreviewed] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("gym");
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingDraftOrder, setSavingDraftOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function loadPlan() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadPlanSnapshot(supabase);
        if (!active) return;
        setSnapshot(nextSnapshot);
        setWeekDays(nextSnapshot.activePlan?.days ?? []);
        setSelectedDayId(nextSnapshot.currentDay?.id ?? nextSnapshot.activePlan?.days[0]?.id ?? null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load training plan.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPlan();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  const selectedDay = useMemo(() => {
    if (!selectedDayId) return weekDays[0] ?? null;
    return weekDays.find((day) => day.id === selectedDayId) ?? weekDays[0] ?? null;
  }, [selectedDayId, weekDays]);
  const selectedMuscles = useMemo(() => inferMuscles(selectedDay), [selectedDay]);
  const selectedEquipment = useMemo(() => inferEquipment(selectedDay, sessionMode), [selectedDay, sessionMode]);

  function handleMoveDay(index: number, direction: -1 | 1) {
    const next = moveDay(weekDays, index, index + direction);
    setWeekDays(next);
    setSavingDraftOrder(true);
    window.setTimeout(() => setSavingDraftOrder(false), 700);
  }

  function resetWeekOrder() {
    setWeekDays(snapshot?.activePlan?.days ?? []);
    setSelectedDayId(snapshot?.currentDay?.id ?? snapshot?.activePlan?.days[0]?.id ?? null);
  }

  function toggleModality(modality: string) {
    setSetupDraft((current) => ({
      ...current,
      modalities: current.modalities.includes(modality)
        ? current.modalities.filter((item) => item !== modality)
        : [...current.modalities, modality]
    }));
  }

  const planSetupCard = (
    <section className="plan-setup-panel">
      <div className="profile-form-header">
        <div>
          <p className="eyebrow">SETUP</p>
          <h2 className="section-title">Shape your week</h2>
        </div>
        <span className="ghost-chip">{setupDraft.modalities.length} selected</span>
      </div>
      <div className="plan-setup-grid">
        <label>
          <span className="field-label">Days / week</span>
          <input
            className="input"
            value={setupDraft.daysPerWeek}
            onChange={(event) => setSetupDraft((current) => ({ ...current, daysPerWeek: event.target.value }))}
            inputMode="numeric"
          />
        </label>
        <label>
          <span className="field-label">Minutes / session</span>
          <input
            className="input"
            value={setupDraft.sessionMinutes}
            onChange={(event) => setSetupDraft((current) => ({ ...current, sessionMinutes: event.target.value }))}
            inputMode="numeric"
          />
        </label>
        <label>
          <span className="field-label">Ability</span>
          <select
            className="input"
            value={setupDraft.abilityLevel}
            onChange={(event) => setSetupDraft((current) => ({ ...current, abilityLevel: event.target.value }))}
          >
            <option value="foundation">Foundation</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>
      <div className="plan-setup-grid plan-setup-wide">
        <label>
          <span className="field-label">Goal</span>
          <input
            className="input"
            value={setupDraft.goal}
            onChange={(event) => setSetupDraft((current) => ({ ...current, goal: event.target.value }))}
          />
        </label>
        <label>
          <span className="field-label">Equipment constraints</span>
          <input
            className="input"
            value={setupDraft.equipment}
            onChange={(event) => setSetupDraft((current) => ({ ...current, equipment: event.target.value }))}
          />
        </label>
      </div>
      <div className="stage-strip">
        {MODALITIES.map((modality) => (
          <button
            key={modality}
            type="button"
            className={`ghost-chip ${setupDraft.modalities.includes(modality) ? "is-selected" : ""}`}
            onClick={() => toggleModality(modality)}
          >
            {modality}
          </button>
        ))}
      </div>
      <div className="stack-actions">
        <button type="button" className="primary-cta" onClick={() => setSetupPreviewed(true)}>
          Preview outline
        </button>
        <Link href="/library" className="secondary-cta">
          Browse programs
        </Link>
      </div>
      {setupPreviewed ? (
        <div className="status-banner status-success">
          Draft outline: {setupDraft.daysPerWeek} days, {setupDraft.sessionMinutes} minutes,{" "}
          {setupDraft.abilityLevel}, focused on {setupDraft.goal}.
        </div>
      ) : null}
    </section>
  );

  return (
    <MemberShell
      title="Plan"
      subtitle="Today, this week, and what your coach expects next."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}

      {loading ? (
        <section className="feed-card">
          <p className="feed-body">Loading your training plan...</p>
        </section>
      ) : !snapshot?.activePlan ? (
        <>
          <section className="plan-empty-state">
            <div className="plan-empty-copy">
              <span className="status-pill">Plan not started</span>
              <h2 className="section-title">Start with your gym, your coach, or a KRUXT program.</h2>
              <p className="section-copy">
                The plan becomes your weekly home once a gym, coach, or program is attached. Until then, every logged
                session can still become proof.
              </p>
            </div>
            <div className="plan-empty-actions">
              <Link href="/gyms" className="primary-cta">
                Find a gym
              </Link>
              <Link href="/log" className="secondary-cta">
                Log training
              </Link>
            </div>
            <div className="plan-empty-steps">
              <span>Join or request BZone access</span>
              <span>Get a coach/program assigned</span>
              <span>Train, log proof, build rank</span>
            </div>
          </section>
          {planSetupCard}
        </>
      ) : (
        <>
          <section className="plan-today-panel">
            <div className="plan-today-main">
              <div className="plan-today-header">
                <span className="status-pill">Today</span>
                <span className="ghost-chip">{snapshot.activePlan.gymName ?? "Independent"}</span>
              </div>
              <h2 className="plan-today-title">{selectedDay?.label ?? snapshot.activePlan.title}</h2>
              <p className="section-copy">
                {selectedDay?.focus ?? snapshot.activePlan.goal ?? "Train the planned work, then turn it into proof."}
              </p>
              {snapshot.activePlan.coachNotes ? (
                <div className="plan-note">
                  <strong>Coach notes</strong>
                  <p>{snapshot.activePlan.coachNotes}</p>
                </div>
              ) : null}
              <div className="plan-action-bar">
                <Link href="/log" className="primary-cta">
                  Start session
                </Link>
                <Link href="/feed" className="secondary-cta">
                  Proof feed
                </Link>
              </div>
            </div>

            <div className="plan-summary-rail">
              <div className="plan-summary-item">
                <span className="metric-label">Adherence</span>
                <strong className="metric-value">{snapshot.weeklyProgress.adherencePercent}%</strong>
              </div>
              <div className="plan-summary-item">
                <span className="metric-label">This week</span>
                <strong className="metric-value-sm">
                  {snapshot.weeklyProgress.completedSessions}/{snapshot.weeklyProgress.plannedSessions} done
                </strong>
              </div>
              <div className="plan-summary-item">
                <span className="metric-label">Coach</span>
                <strong className="metric-value-sm">{snapshot.activePlan.coachName ?? "Not assigned"}</strong>
              </div>
              <div className="plan-summary-item">
                <span className="metric-label">Dates</span>
                <strong className="metric-value-sm">
                  {formatDate(snapshot.activePlan.startsAt)} - {formatDate(snapshot.activePlan.endsAt)}
                </strong>
              </div>
            </div>
          </section>

          <section className="split-card">
            <article className="glass-panel">
              <div className="profile-form-header">
                <div>
                  <p className="eyebrow">WEEK</p>
                  <h2 className="section-title">This week</h2>
                </div>
                <button type="button" className="secondary-cta" onClick={resetWeekOrder}>
                  Reset week
                </button>
              </div>
              <p className="supporting-copy">
                Move sessions before you train. The visible order updates immediately while the coach-published plan
                stays versioned.
              </p>
              {savingDraftOrder ? <div className="status-banner status-success">Draft order updated.</div> : null}
              <div className="plan-week-list">
                {weekDays.map((day, index) => (
                  <div key={day.id} className={`plan-day-row ${selectedDay?.id === day.id ? "is-selected" : ""}`}>
                    <button type="button" className="plan-day-select" onClick={() => setSelectedDayId(day.id)}>
                      <span className="rank-position">{index + 1}</span>
                      <span className="plan-day-copy">
                        <strong>{day.label}</strong>
                        <span>{day.focus ?? `${day.blocks.length} movements`}</span>
                      </span>
                    </button>
                    <span className="plan-day-actions">
                      <button type="button" className="ghost-chip" onClick={() => handleMoveDay(index, -1)}>
                        Up
                      </button>
                      <button type="button" className="ghost-chip" onClick={() => handleMoveDay(index, 1)}>
                        Down
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="glass-panel">
              <p className="eyebrow">DETAIL</p>
              <h2 className="section-title">{selectedDay?.label ?? "Session"}</h2>
              {selectedDay?.notes ? <p className="section-copy">{selectedDay.notes}</p> : null}
              <div className="session-controls">
                <div className="segmented-control" aria-label="Session mode">
                  {MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`segment-button ${sessionMode === mode ? "is-active" : ""}`}
                      onClick={() => setSessionMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <label className="warmup-toggle">
                  <input
                    type="checkbox"
                    checked={warmupEnabled}
                    onChange={(event) => setWarmupEnabled(event.target.checked)}
                  />
                  Warm-up
                </label>
              </div>
              <div className="session-prep-grid">
                <div>
                  <span className="metric-label">Equipment</span>
                  <div className="stage-strip">
                    {selectedEquipment.map((item) => (
                      <span key={item} className="ghost-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="metric-label">Muscle map</span>
                  <div className="muscle-map">
                    {(selectedMuscles.length ? selectedMuscles : ["full body"]).map((muscle) => (
                      <span key={muscle}>{muscle}</span>
                    ))}
                  </div>
                </div>
              </div>
              {warmupEnabled ? (
                <div className="plan-note">
                  <strong>Warm-up block</strong>
                  <p>
                    6-10 minutes easy ramp, two movement-specific prep sets, then start the first working block.
                  </p>
                </div>
              ) : null}
              <div className="plan-block-list">
                {(selectedDay?.blocks ?? []).map((block) => (
                  <div key={block.id} className="log-block-card">
                    <div className="log-block-header">
                      <div>
                        <h3 className="log-block-title">{block.exercise}</h3>
                        <p className="feed-body">{block.target}</p>
                      </div>
                    </div>
                    {block.notes ? <p className="supporting-copy">{block.notes}</p> : null}
                  </div>
                ))}
                {(selectedDay?.blocks.length ?? 0) === 0 ? (
                  <p className="feed-body">No movements are attached to this day yet.</p>
                ) : null}
              </div>
            </article>
          </section>

          <section className="split-card">
            <article className="glass-panel">
              <p className="eyebrow">CLASSES</p>
              <h2 className="section-title">Booked into the week</h2>
              <div className="rank-list">
                {snapshot.upcomingClasses.length === 0 ? (
                  <p className="feed-body">No booked classes are attached to this week yet.</p>
                ) : (
                  snapshot.upcomingClasses.map((klass) => (
                    <div key={klass.id} className="rank-row">
                      <div className="rank-row-body">
                        <strong>{klass.title}</strong>
                        <p className="feed-body">
                          {formatDateTime(klass.startsAt)} · {klass.gymName ?? "Gym"} · {klass.status}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="glass-panel">
              <p className="eyebrow">NEXT</p>
              <h2 className="section-title">Future weeks</h2>
              <p className="section-copy">
                Future-week planning stays attached to the plan itself, so programs, analytics, and coach tools unlock
                where members already make training decisions.
              </p>
              <div className="metric-card">
                <span className="metric-label">Status</span>
                <strong className="metric-value-sm">{snapshot.futureWeeksLocked ? "Locked after this week" : "Unlocked"}</strong>
              </div>
            </article>
          </section>
        </>
      )}
    </MemberShell>
  );
}
