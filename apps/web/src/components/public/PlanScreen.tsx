"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, Dumbbell, Library, RotateCcw } from "lucide-react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadPlanSnapshot, type PlanSnapshot } from "@/lib/public/plan";
import { buildPlanWorkoutHref } from "@/lib/public/workout-handoff";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatClassTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PlanScreen() {
  const { state, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const userId = state.user?.id;

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setSelectedDayId(null);
    setLoading(true);
    setError(null);
    if (state.status !== "ready" || !userId) return;

    void loadPlanSnapshot(supabase).then((next) => {
      if (!active) return;
      setSnapshot(next);
      setSelectedDayId(next.currentDay?.id ?? next.activePlan?.days[0]?.id ?? null);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your plan.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [state.status, userId, supabase, revision]);

  const selectedDay = snapshot?.activePlan?.days.find((day) => day.id === selectedDayId) ?? null;
  const workoutHref = snapshot?.activePlan && selectedDay
    ? buildPlanWorkoutHref(snapshot.activePlan, selectedDay.id)
    : null;

  return (
    <MemberShell title="Plan" subtitle="Your next session, your schedule, your progress.">
      {loading ? (
        <section className="training-loading" role="status" aria-label="Loading your training plan">
          <div className="member-skeleton skeleton-title" /><div className="member-skeleton skeleton-line" />
          <div className="member-skeleton skeleton-session" />
          <span className="sr-only">Loading your training plan</span>
        </section>
      ) : error ? (
        <section className="training-empty">
          <h2 className="section-title">Your plan could not load</h2>
          <p role="alert" className="status-banner status-danger">{error}</p>
          <button className="secondary-cta" type="button" onClick={() => setRevision((value) => value + 1)}><RotateCcw size={18} aria-hidden="true" />Try again</button>
        </section>
      ) : snapshot ? (
        <>
          <section className="training-overview" aria-label="Training overview">
            <div>
              <h2>{snapshot.activePlan?.title ?? "Make time for your next session"}</h2>
              <p>{snapshot.activePlan?.goal ?? "Choose a session from your library or log your own workout."}</p>
              {snapshot.activePlan && <p className="training-coach">{snapshot.activePlan.gymName ?? "Independent training"}{snapshot.activePlan.coachName ? ` / Coach ${snapshot.activePlan.coachName}` : ""}</p>}
            </div>
            <div className="training-week-total">
              <span className="training-completed"><Check size={16} aria-hidden="true" />This week</span>
              <strong>{snapshot.weeklyProgress.completedSessions} <span>sessions logged</span></strong>
              {snapshot.activePlan && <span>{snapshot.activePlan.days.length} sessions in your plan</span>}
            </div>
          </section>

          {snapshot.activePlan ? (
            <div className="training-layout">
              <section className="training-schedule" aria-labelledby="training-schedule-title">
                <div className="training-section-heading"><h2 id="training-schedule-title">Your sessions</h2><span>{snapshot.activePlan.days.length}</span></div>
                <div className="training-session-picker"><label htmlFor="training-session-picker">Your session</label><select id="training-session-picker" className="input" value={selectedDayId ?? ""} onChange={(event) => setSelectedDayId(event.target.value)}>{!snapshot.activePlan.days.length && <option value="">No sessions yet</option>}{snapshot.activePlan.days.map((day, index) => <option key={day.id} value={day.id}>{index + 1}. {day.label}</option>)}</select></div>
                <div className="training-session-list" role="group" aria-label="Choose a session">
                  {snapshot.activePlan.days.map((day, index) => (
                    <button key={day.id} type="button" className={`training-day ${selectedDay?.id === day.id ? "is-selected" : ""}`} aria-pressed={selectedDay?.id === day.id} aria-controls="training-session-detail" onClick={() => setSelectedDayId(day.id)}>
                      <span className="training-day-number">{index + 1}</span>
                      <span className="training-day-copy"><strong>{day.label}</strong><span>{day.focus ?? `${day.blocks.length} movements`}</span></span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                  {!snapshot.activePlan.days.length && <p className="section-copy">Your coach has not added sessions to this plan yet.</p>}
                </div>
                <Link href="/library" className="training-text-link"><Library size={17} aria-hidden="true" />Session library<ArrowRight size={16} aria-hidden="true" /></Link>
              </section>

              <section id="training-session-detail" className="training-session-detail" aria-labelledby="training-session-title">
                <div className="training-session-heading">
                  <div><h2 id="training-session-title">{selectedDay?.label ?? "Session details"}</h2><p>{selectedDay?.focus ?? "Choose a session to see your workout."}</p></div>
                  <Dumbbell size={24} aria-hidden="true" />
                </div>
                {selectedDay?.notes && <p className="training-day-notes">{selectedDay.notes}</p>}
                <ol className="training-movements">
                  {(selectedDay?.blocks ?? []).map((block, index) => (
                    <li key={block.id}>
                      <span className="training-movement-number">{index + 1}</span>
                      <div><h3>{block.exercise}</h3><p>{block.target}</p>{block.notes && <p className="training-movement-notes">{block.notes}</p>}</div>
                    </li>
                  ))}
                </ol>
                {selectedDay && !selectedDay.blocks.length && <p className="section-copy">No movements have been added to this session yet.</p>}
                {snapshot.activePlan.coachNotes && <details className="training-coach-notes"><summary>Coach notes</summary><p>{snapshot.activePlan.coachNotes}</p></details>}
                <div className="training-start">
                  {workoutHref ? <Link href={workoutHref} className="primary-cta" prefetch={false}>Start workout<ArrowRight size={18} aria-hidden="true" /></Link> : <><button type="button" className="primary-cta" disabled>Start workout<ArrowRight size={18} aria-hidden="true" /></button><p role="status">Choose a session with movements, or ask your coach to update this plan.</p></>}
                </div>
              </section>
            </div>
          ) : (
            <section className="training-empty">
              <Dumbbell size={28} aria-hidden="true" />
              <h2>No assigned plan yet</h2>
              <p>Pick a saved session or train your own way. Your gym or coach can assign a plan when it is ready.</p>
              <div className="stack-actions"><Link href="/library" className="primary-cta"><Library size={18} aria-hidden="true" />Browse sessions</Link><Link href="/log" className="secondary-cta"><Dumbbell size={18} aria-hidden="true" />Log a workout</Link></div>
            </section>
          )}

          <div className="training-context">
            <section aria-labelledby="training-classes-title">
              <div className="training-section-heading"><h2 id="training-classes-title">Upcoming classes</h2><Link href="/gyms">Find a class<ArrowRight size={16} aria-hidden="true" /></Link></div>
              {snapshot.upcomingClasses.length ? <ul className="training-activity-list">{snapshot.upcomingClasses.map((klass) => <li key={klass.id}><CalendarDays size={20} aria-hidden="true" /><div><strong>{klass.title}</strong><span>{formatClassTime(klass.startsAt)} / {klass.gymName ?? "Gym"}</span><span>{klass.status === "waitlisted" ? "Waitlisted" : klass.status === "attended" ? "Attended" : "Booked"}</span></div><Link href={`/gyms/${klass.gymId}/classes`} aria-label={`View ${klass.title} at ${klass.gymName ?? "gym"}`} title="View class"><ChevronRight size={20} aria-hidden="true" /></Link></li>)}</ul> : <p className="training-empty-copy">No upcoming bookings. Find a class at your gym.</p>}
            </section>
            <section aria-labelledby="training-recent-title">
              <div className="training-section-heading"><h2 id="training-recent-title">Recent training</h2><Link href="/profile">Your profile<ArrowRight size={16} aria-hidden="true" /></Link></div>
              {snapshot.recentWorkouts.length ? <ul className="training-activity-list">{snapshot.recentWorkouts.slice(0, 4).map((workout) => <li key={workout.id}><Check size={20} aria-hidden="true" /><div><strong>{workout.title}</strong><span>{formatDate(workout.startedAt)} / {workout.totalSets} sets</span></div></li>)}</ul> : <p className="training-empty-copy">Your completed sessions will appear here.</p>}
            </section>
          </div>
        </>
      ) : null}
    </MemberShell>
  );
}
