"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClassStatus } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import {
  createGymClasses,
  listGymClasses,
  listGymCoaches,
  listGyms,
  setGymClassStatus,
  updateGymClass,
  type CoachOption,
  type CreateGymClassInput,
  type GymClassRecord,
  type GymRecord
} from "@/lib/admin/data";

const CLASS_STATUS_OPTIONS: ClassStatus[] = ["scheduled", "cancelled", "completed"];
const WEEKDAY_OPTIONS = [
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
  { key: 0, label: "Sun" }
];

function toLocalInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function localFromIso(iso: string): string {
  return toLocalInputValue(new Date(iso));
}

function buildOccurrences(params: {
  startsAtLocal: string;
  durationMinutes: number;
  recurrenceType: "single" | "weekly";
  weekdays: number[];
  repeatUntilDate: string;
  maxOccurrences: number;
}): Array<{ startsAt: string; endsAt: string }> {
  const baseDate = new Date(params.startsAtLocal);
  if (Number.isNaN(baseDate.getTime())) return [];

  const durationMs = Math.max(15, Math.floor(params.durationMinutes)) * 60 * 1000;
  if (params.recurrenceType === "single") {
    return [
      {
        startsAt: baseDate.toISOString(),
        endsAt: new Date(baseDate.getTime() + durationMs).toISOString()
      }
    ];
  }

  const max = Math.max(1, Math.min(200, Math.floor(params.maxOccurrences)));
  const weekdaysSet = new Set(params.weekdays.length > 0 ? params.weekdays : [baseDate.getDay()]);
  const until = params.repeatUntilDate
    ? new Date(`${params.repeatUntilDate}T23:59:59`)
    : new Date(baseDate.getTime() + 180 * 24 * 60 * 60 * 1000);

  const occurrences: Array<{ startsAt: string; endsAt: string }> = [];
  const cursor = new Date(baseDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= until && occurrences.length < max) {
    if (weekdaysSet.has(cursor.getDay())) {
      const startsAt = new Date(cursor);
      startsAt.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
      if (startsAt >= baseDate) {
        occurrences.push({
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + durationMs).toISOString()
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

export function ClassesConsole({ scope }: { scope: "founder" | "org" }) {
  const { access, supabase, signOut, canManageGyms, allowedGymIds } = useAdminAccess();

  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [classes, setClasses] = useState<GymClassRecord[]>([]);

  const [loadingGyms, setLoadingGyms] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [coachUserId, setCoachUserId] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(toLocalInputValue(new Date()));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [recurrenceType, setRecurrenceType] = useState<"single" | "weekly">("single");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [repeatUntilDate, setRepeatUntilDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState(12);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCapacity, setEditCapacity] = useState(20);
  const [editCoachUserId, setEditCoachUserId] = useState("");
  const [editStartsAtLocal, setEditStartsAtLocal] = useState("");
  const [editDurationMinutes, setEditDurationMinutes] = useState(60);
  const [editStatus, setEditStatus] = useState<ClassStatus>("scheduled");

  const canUseAllGyms = scope === "founder" && canManageGyms;
  const canLoad = access.status === "ready" && access.isAuthenticated;

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const loadGyms = useCallback(async () => {
    if (!canLoad) return;
    setLoadingGyms(true);
    setError(null);
    try {
      const visibleGyms = await listGyms(supabase, canUseAllGyms ? null : allowedGymIds);
      setGyms(visibleGyms);
      setSelectedGymId((current) => {
        if (visibleGyms.some((gym) => gym.id === current)) return current;
        return visibleGyms[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
      setGyms([]);
      setSelectedGymId("");
    } finally {
      setLoadingGyms(false);
    }
  }, [allowedGymIds, canLoad, canUseAllGyms, supabase]);

  const loadClassesAndCoaches = useCallback(async () => {
    if (!selectedGymId) {
      setClasses([]);
      setCoaches([]);
      return;
    }
    setLoadingClasses(true);
    setError(null);
    try {
      const [classRows, coachRows] = await Promise.all([
        listGymClasses(supabase, selectedGymId),
        listGymCoaches(supabase, selectedGymId)
      ]);
      setClasses(classRows);
      setCoaches(coachRows);
      setSelectedClassId((current) => (classRows.some((item) => item.id === current) ? current : ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load class data.");
      setClasses([]);
      setCoaches([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedGymId, supabase]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    void loadClassesAndCoaches();
  }, [loadClassesAndCoaches]);

  useEffect(() => {
    if (!selectedClass) return;
    setEditTitle(selectedClass.title);
    setEditLocation(selectedClass.location ?? "");
    setEditNotes(selectedClass.notes ?? "");
    setEditCapacity(selectedClass.capacity);
    setEditCoachUserId(selectedClass.coachUserId ?? "");
    setEditStartsAtLocal(localFromIso(selectedClass.startsAt));
    setEditDurationMinutes(
      Math.max(
        15,
        Math.round(
          (new Date(selectedClass.endsAt).getTime() - new Date(selectedClass.startsAt).getTime()) /
            (60 * 1000)
        )
      )
    );
    setEditStatus(selectedClass.status);
  }, [selectedClass]);

  const upcomingPreview = useMemo(
    () =>
      buildOccurrences({
        startsAtLocal,
        durationMinutes,
        recurrenceType,
        weekdays,
        repeatUntilDate,
        maxOccurrences
      }),
    [durationMinutes, maxOccurrences, recurrenceType, repeatUntilDate, startsAtLocal, weekdays]
  );

  async function handleCreateClasses() {
    if (!selectedGymId) {
      setError("Select a gym first.");
      return;
    }
    if (!title.trim()) {
      setError("Class title is required.");
      return;
    }

    const occurrences = buildOccurrences({
      startsAtLocal,
      durationMinutes,
      recurrenceType,
      weekdays,
      repeatUntilDate,
      maxOccurrences
    });
    if (occurrences.length === 0) {
      setError("No class occurrences generated. Check date/recurrence settings.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CreateGymClassInput[] = occurrences.map((occurrence) => ({
        gymId: selectedGymId,
        title,
        location,
        notes,
        coachUserId,
        capacity,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt
      }));
      await createGymClasses(supabase, payload);
      setSuccess(
        payload.length === 1 ? "Class scheduled." : `Scheduled ${payload.length} recurring classes.`
      );
      await loadClassesAndCoaches();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create class schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSelectedClass() {
    if (!selectedClassId) return;
    if (!editTitle.trim()) {
      setError("Class title is required.");
      return;
    }

    const startsAt = new Date(editStartsAtLocal);
    if (Number.isNaN(startsAt.getTime())) {
      setError("Invalid start date/time.");
      return;
    }
    const endsAt = new Date(startsAt.getTime() + Math.max(15, editDurationMinutes) * 60 * 1000);

    setPendingKey("update_class");
    setError(null);
    setSuccess(null);
    try {
      await updateGymClass(supabase, selectedClassId, {
        title: editTitle,
        location: editLocation,
        notes: editNotes,
        coachUserId: editCoachUserId,
        capacity: editCapacity,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      });
      await setGymClassStatus(supabase, selectedClassId, editStatus);
      setSuccess("Class updated.");
      await loadClassesAndCoaches();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update class.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleStatusOnly(classId: string, status: ClassStatus) {
    setPendingKey(`status_${classId}`);
    setError(null);
    setSuccess(null);
    try {
      await setGymClassStatus(supabase, classId, status);
      setSuccess(`Class marked ${status}.`);
      await loadClassesAndCoaches();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update class status.");
    } finally {
      setPendingKey(null);
    }
  }

  const classesSorted = useMemo(
    () => [...classes].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [classes]
  );

  return (
    <AdminShell
      access={access}
      scope={scope}
      onSignOut={signOut}
      title="Classes"
      subtitle={
        scope === "founder"
          ? "Founder class operations across gyms"
          : "Organization class scheduling and operations"
      }
    >
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`classes-gym-${scope}`}>Gym</label>
            <select
              id={`classes-gym-${scope}`}
              className="input"
              value={selectedGymId}
              onChange={(event) => setSelectedGymId(event.target.value)}
              disabled={loadingGyms || gyms.length === 0}
            >
              {gyms.length === 0 && <option value="">No gyms available</option>}
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => void loadGyms()} disabled={loadingGyms}>
              {loadingGyms ? "Loading..." : "Refresh gyms"}
            </button>
            <button className="btn" onClick={() => void loadClassesAndCoaches()} disabled={loadingClasses || !selectedGymId}>
              {loadingClasses ? "Loading..." : "Refresh classes"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Schedule class</h3>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`class-title-${scope}`}>Course / Class title</label>
            <input
              id={`class-title-${scope}`}
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pilates Reformer"
            />
          </div>
          <div>
            <label className="label" htmlFor={`class-location-${scope}`}>Location</label>
            <input
              id={`class-location-${scope}`}
              className="input"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Wellness Zone"
            />
          </div>
          <div>
            <label className="label" htmlFor={`class-coach-${scope}`}>Coach</label>
            <select
              id={`class-coach-${scope}`}
              className="input"
              value={coachUserId}
              onChange={(event) => setCoachUserId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {coaches.map((coach) => (
                <option key={coach.userId} value={coach.userId}>
                  {coach.label} ({coach.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`class-capacity-${scope}`}>Capacity</label>
            <input
              id={`class-capacity-${scope}`}
              className="input"
              type="number"
              min={1}
              max={200}
              value={capacity}
              onChange={(event) => setCapacity(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}
            />
          </div>
          <div>
            <label className="label" htmlFor={`class-start-${scope}`}>Starts at</label>
            <input
              id={`class-start-${scope}`}
              className="input"
              type="datetime-local"
              value={startsAtLocal}
              onChange={(event) => setStartsAtLocal(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`class-duration-${scope}`}>Duration (minutes)</label>
            <input
              id={`class-duration-${scope}`}
              className="input"
              type="number"
              min={15}
              max={300}
              step={5}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Math.max(15, Math.min(300, Number(event.target.value) || 15)))}
            />
          </div>
          <div>
            <label className="label" htmlFor={`class-recurrence-${scope}`}>Recurrence</label>
            <select
              id={`class-recurrence-${scope}`}
              className="input"
              value={recurrenceType}
              onChange={(event) => setRecurrenceType(event.target.value as "single" | "weekly")}
            >
              <option value="single">Single class</option>
              <option value="weekly">Weekly recurring</option>
            </select>
          </div>
          {recurrenceType === "weekly" && (
            <>
              <div>
                <label className="label" htmlFor={`class-repeat-until-${scope}`}>Repeat until</label>
                <input
                  id={`class-repeat-until-${scope}`}
                  className="input"
                  type="date"
                  value={repeatUntilDate}
                  onChange={(event) => setRepeatUntilDate(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor={`class-max-occurrences-${scope}`}>Max occurrences</label>
                <input
                  id={`class-max-occurrences-${scope}`}
                  className="input"
                  type="number"
                  min={1}
                  max={200}
                  value={maxOccurrences}
                  onChange={(event) =>
                    setMaxOccurrences(Math.max(1, Math.min(200, Number(event.target.value) || 1)))
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Weekdays</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = weekdays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={`btn ${active ? "btn-primary" : ""}`}
                        onClick={() =>
                          setWeekdays((current) =>
                            current.includes(day.key)
                              ? current.filter((value) => value !== day.key)
                              : [...current, day.key]
                          )
                        }
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label" htmlFor={`class-notes-${scope}`}>Notes</label>
            <textarea
              id={`class-notes-${scope}`}
              className="input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional coaching notes or setup details"
              rows={3}
            />
          </div>
        </div>

        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          Preview: {upcomingPreview.length} occurrence{upcomingPreview.length === 1 ? "" : "s"}
          {upcomingPreview[0] && (
            <> · first: {new Date(upcomingPreview[0].startsAt).toLocaleString()}</>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            disabled={saving || !selectedGymId}
            onClick={() => void handleCreateClasses()}
          >
            {saving ? "Scheduling..." : "Schedule class"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Edit selected class</h3>
        {!selectedClass ? (
          <p className="subheading">Select a class row below to edit details.</p>
        ) : (
          <>
            <div className="grid grid-2">
              <div>
                <label className="label" htmlFor={`edit-class-title-${scope}`}>Title</label>
                <input
                  id={`edit-class-title-${scope}`}
                  className="input"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-location-${scope}`}>Location</label>
                <input
                  id={`edit-class-location-${scope}`}
                  className="input"
                  value={editLocation}
                  onChange={(event) => setEditLocation(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-coach-${scope}`}>Coach</label>
                <select
                  id={`edit-class-coach-${scope}`}
                  className="input"
                  value={editCoachUserId}
                  onChange={(event) => setEditCoachUserId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {coaches.map((coach) => (
                    <option key={coach.userId} value={coach.userId}>
                      {coach.label} ({coach.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-capacity-${scope}`}>Capacity</label>
                <input
                  id={`edit-class-capacity-${scope}`}
                  className="input"
                  type="number"
                  min={1}
                  max={200}
                  value={editCapacity}
                  onChange={(event) =>
                    setEditCapacity(Math.max(1, Math.min(200, Number(event.target.value) || 1)))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-start-${scope}`}>Starts at</label>
                <input
                  id={`edit-class-start-${scope}`}
                  className="input"
                  type="datetime-local"
                  value={editStartsAtLocal}
                  onChange={(event) => setEditStartsAtLocal(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-duration-${scope}`}>Duration (minutes)</label>
                <input
                  id={`edit-class-duration-${scope}`}
                  className="input"
                  type="number"
                  min={15}
                  max={300}
                  step={5}
                  value={editDurationMinutes}
                  onChange={(event) =>
                    setEditDurationMinutes(
                      Math.max(15, Math.min(300, Number(event.target.value) || 15))
                    )
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`edit-class-status-${scope}`}>Status</label>
                <select
                  id={`edit-class-status-${scope}`}
                  className="input"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as ClassStatus)}
                >
                  {CLASS_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label" htmlFor={`edit-class-notes-${scope}`}>Notes</label>
                <textarea
                  id={`edit-class-notes-${scope}`}
                  className="input"
                  rows={3}
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                disabled={pendingKey === "update_class"}
                onClick={() => void handleUpdateSelectedClass()}
              >
                {pendingKey === "update_class" ? "Saving..." : "Save class changes"}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <div className="panel" style={{ marginBottom: 12, color: "#ff9baa" }}>{error}</div>}
      {success && <div className="panel" style={{ marginBottom: 12, color: "#7ef5df" }}>{success}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Scheduled classes</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px" }}>Title</th>
                <th style={{ padding: "8px" }}>Location</th>
                <th style={{ padding: "8px" }}>Coach</th>
                <th style={{ padding: "8px" }}>Starts</th>
                <th style={{ padding: "8px" }}>Capacity</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classesSorted.map((gymClass) => (
                <tr
                  key={gymClass.id}
                  style={{
                    borderBottom: "1px solid #10243d",
                    background: selectedClassId === gymClass.id ? "rgba(53,200,255,0.08)" : "transparent"
                  }}
                >
                  <td style={{ padding: "8px" }}>
                    <div style={{ fontWeight: 700 }}>{gymClass.title}</div>
                    {gymClass.notes && (
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{gymClass.notes}</div>
                    )}
                  </td>
                  <td style={{ padding: "8px" }}>{gymClass.location ?? "—"}</td>
                  <td style={{ padding: "8px" }}>{gymClass.coachLabel}</td>
                  <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                    {new Date(gymClass.startsAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px" }}>{gymClass.capacity}</td>
                  <td style={{ padding: "8px" }}>
                    <span className="badge badge-founder">{gymClass.status}</span>
                  </td>
                  <td style={{ padding: "8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => setSelectedClassId(gymClass.id)}>
                      {selectedClassId === gymClass.id ? "Selected" : "Edit"}
                    </button>
                    <button
                      className="btn"
                      disabled={pendingKey === `status_${gymClass.id}`}
                      onClick={() => void handleStatusOnly(gymClass.id, "cancelled")}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn"
                      disabled={pendingKey === `status_${gymClass.id}`}
                      onClick={() => void handleStatusOnly(gymClass.id, "completed")}
                    >
                      Complete
                    </button>
                    <button
                      className="btn"
                      disabled={pendingKey === `status_${gymClass.id}`}
                      onClick={() => void handleStatusOnly(gymClass.id, "scheduled")}
                    >
                      Reopen
                    </button>
                  </td>
                </tr>
              ))}
              {classesSorted.length === 0 && !loadingClasses && (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "var(--muted)", textAlign: "center" }}>
                    No classes found for this gym.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
