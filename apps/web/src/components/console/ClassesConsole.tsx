"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ClassStatus } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import {
  createGymClasses,
  listGymClassCatalog,
  listGymClasses,
  listGymCoaches,
  listGyms,
  saveGymClassCatalog,
  setGymClassStatus,
  updateGymClass,
  type ClassTemplateCatalogRecord,
  type CoachOption,
  type CreateGymClassInput,
  type GymClassCatalog,
  type GymClassRecord,
  type GymLocationCatalogRecord,
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

function createDraftId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyLocationDraft(): GymLocationCatalogRecord {
  return {
    id: createDraftId("location"),
    name: "",
    address: null,
    active: true
  };
}

function emptyTemplateDraft(): ClassTemplateCatalogRecord {
  return {
    id: createDraftId("template"),
    name: "",
    description: null,
    locationIds: [],
    eligibleCoachUserIds: [],
    defaultCapacity: 20,
    defaultDurationMinutes: 60,
    active: true
  };
}

const draftCardStyle: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(10, 22, 42, 0.65)"
};

export function ClassesConsole({ scope }: { scope: "founder" | "org" }) {
  const { access, supabase, signOut, canManageGyms, allowedGymIds } = useAdminAccess();

  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [classes, setClasses] = useState<GymClassRecord[]>([]);

  const [catalog, setCatalog] = useState<GymClassCatalog>({ locations: [], templates: [] });
  const [locationDrafts, setLocationDrafts] = useState<GymLocationCatalogRecord[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<ClassTemplateCatalogRecord[]>([]);

  const [loadingGyms, setLoadingGyms] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [coachUserId, setCoachUserId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
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

  const activeLocations = useMemo(
    () => locationDrafts.filter((location) => location.active),
    [locationDrafts]
  );

  const activeTemplates = useMemo(
    () => templateDrafts.filter((template) => template.active),
    [templateDrafts]
  );

  const selectedTemplate = useMemo(
    () => activeTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [activeTemplates, selectedTemplateId]
  );

  const templateLocationOptions = useMemo(() => {
    if (!selectedTemplate) return activeLocations;
    if (selectedTemplate.locationIds.length === 0) return activeLocations;
    return activeLocations.filter((location) => selectedTemplate.locationIds.includes(location.id));
  }, [activeLocations, selectedTemplate]);

  const coachOptionsForTemplate = useMemo(() => {
    if (!selectedTemplate) return coaches;
    if (selectedTemplate.eligibleCoachUserIds.length === 0) return coaches;
    return coaches.filter((coach) => selectedTemplate.eligibleCoachUserIds.includes(coach.userId));
  }, [coaches, selectedTemplate]);

  const selectedLocation = useMemo(
    () => activeLocations.find((location) => location.id === selectedLocationId) ?? null,
    [activeLocations, selectedLocationId]
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

  const loadGymData = useCallback(async () => {
    if (!selectedGymId) {
      setClasses([]);
      setCoaches([]);
      setCatalog({ locations: [], templates: [] });
      setLocationDrafts([]);
      setTemplateDrafts([]);
      return;
    }

    setLoadingData(true);
    setError(null);
    try {
      const [classRows, coachRows, catalogRows] = await Promise.all([
        listGymClasses(supabase, selectedGymId),
        listGymCoaches(supabase, selectedGymId),
        listGymClassCatalog(supabase, selectedGymId)
      ]);
      setClasses(classRows);
      setCoaches(coachRows);
      setCatalog(catalogRows);
      setLocationDrafts(catalogRows.locations);
      setTemplateDrafts(catalogRows.templates);
      setSelectedClassId((current) => (classRows.some((item) => item.id === current) ? current : ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load class data.");
      setClasses([]);
      setCoaches([]);
      setCatalog({ locations: [], templates: [] });
      setLocationDrafts([]);
      setTemplateDrafts([]);
    } finally {
      setLoadingData(false);
    }
  }, [selectedGymId, supabase]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    void loadGymData();
  }, [loadGymData]);

  const applyTemplateDefaults = useCallback(
    (templateId: string) => {
      const template = activeTemplates.find((item) => item.id === templateId);
      if (!template) {
        setSelectedTemplateId("");
        return;
      }

      const locationOptions =
        template.locationIds.length > 0
          ? activeLocations.filter((location) => template.locationIds.includes(location.id))
          : activeLocations;
      const filteredCoaches =
        template.eligibleCoachUserIds.length > 0
          ? coaches.filter((coach) => template.eligibleCoachUserIds.includes(coach.userId))
          : coaches;

      setSelectedTemplateId(template.id);
      setTitle(template.name);
      setCapacity(template.defaultCapacity);
      setDurationMinutes(template.defaultDurationMinutes);
      setSelectedLocationId(locationOptions[0]?.id ?? "");
      setCoachUserId((current) => {
        if (current && filteredCoaches.some((coach) => coach.userId === current)) return current;
        return filteredCoaches[0]?.userId ?? "";
      });
    },
    [activeLocations, activeTemplates, coaches]
  );

  useEffect(() => {
    if (activeTemplates.length === 0) {
      setSelectedTemplateId("");
      return;
    }
    if (!activeTemplates.some((template) => template.id === selectedTemplateId)) {
      applyTemplateDefaults(activeTemplates[0].id);
    }
  }, [activeTemplates, applyTemplateDefaults, selectedTemplateId]);

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

  useEffect(() => {
    if (templateLocationOptions.length === 0) {
      setSelectedLocationId("");
      return;
    }
    if (!templateLocationOptions.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(templateLocationOptions[0].id);
    }
  }, [selectedLocationId, templateLocationOptions]);

  useEffect(() => {
    if (!coachUserId) return;
    if (coachOptionsForTemplate.some((coach) => coach.userId === coachUserId)) return;
    setCoachUserId("");
  }, [coachOptionsForTemplate, coachUserId]);

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

  const classesSorted = useMemo(
    () => [...classes].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [classes]
  );

  function updateLocationDraft(
    locationId: string,
    patch: Partial<GymLocationCatalogRecord>
  ) {
    setLocationDrafts((current) =>
      current.map((location) =>
        location.id === locationId
          ? {
              ...location,
              ...patch
            }
          : location
      )
    );
    setSuccess(null);
  }

  function removeLocationDraft(locationId: string) {
    setLocationDrafts((current) => current.filter((location) => location.id !== locationId));
    setTemplateDrafts((current) =>
      current.map((template) => ({
        ...template,
        locationIds: template.locationIds.filter((value) => value !== locationId)
      }))
    );
    if (selectedLocationId === locationId) {
      setSelectedLocationId("");
    }
    setSuccess(null);
  }

  function updateTemplateDraft(
    templateId: string,
    patch: Partial<ClassTemplateCatalogRecord>
  ) {
    setTemplateDrafts((current) =>
      current.map((template) =>
        template.id === templateId
          ? {
              ...template,
              ...patch
            }
          : template
      )
    );
    setSuccess(null);
  }

  function toggleTemplateLocation(templateId: string, locationId: string) {
    setTemplateDrafts((current) =>
      current.map((template) => {
        if (template.id !== templateId) return template;
        const next = template.locationIds.includes(locationId)
          ? template.locationIds.filter((value) => value !== locationId)
          : [...template.locationIds, locationId];
        return {
          ...template,
          locationIds: next
        };
      })
    );
    setSuccess(null);
  }

  function toggleTemplateCoach(templateId: string, coachId: string) {
    setTemplateDrafts((current) =>
      current.map((template) => {
        if (template.id !== templateId) return template;
        const next = template.eligibleCoachUserIds.includes(coachId)
          ? template.eligibleCoachUserIds.filter((value) => value !== coachId)
          : [...template.eligibleCoachUserIds, coachId];
        return {
          ...template,
          eligibleCoachUserIds: next
        };
      })
    );
    setSuccess(null);
  }

  async function handleSaveCatalog() {
    if (!selectedGymId) {
      setError("Select a gym first.");
      return;
    }

    if (locationDrafts.some((location) => !location.name.trim())) {
      setError("Every location needs a name before saving.");
      return;
    }
    if (templateDrafts.some((template) => !template.name.trim())) {
      setError("Every course template needs a name before saving.");
      return;
    }

    setSavingCatalog(true);
    setError(null);
    setSuccess(null);
    try {
      const savedCatalog = await saveGymClassCatalog(supabase, selectedGymId, {
        locations: locationDrafts,
        templates: templateDrafts
      });
      setCatalog(savedCatalog);
      setLocationDrafts(savedCatalog.locations);
      setTemplateDrafts(savedCatalog.templates);
      setSuccess("Class catalog saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save class catalog.");
    } finally {
      setSavingCatalog(false);
    }
  }

  async function handleCreateClasses() {
    if (!selectedGymId) {
      setError("Select a gym first.");
      return;
    }
    if (!selectedTemplate) {
      setError("Select a course template first.");
      return;
    }
    if (!selectedLocation) {
      setError("Select a valid location for this course.");
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
      setError("No class occurrences generated. Check date and recurrence settings.");
      return;
    }

    setSavingSchedule(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CreateGymClassInput[] = occurrences.map((occurrence) => ({
        gymId: selectedGymId,
        title: title.trim(),
        location: selectedLocation.name,
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
      await loadGymData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to schedule class.");
    } finally {
      setSavingSchedule(false);
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
      await loadGymData();
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
      await loadGymData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update class status.");
    } finally {
      setPendingKey(null);
    }
  }

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? null,
    [gyms, selectedGymId]
  );

  const catalogIsConfigured = activeTemplates.length > 0 && activeLocations.length > 0;

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
            <button className="btn" onClick={() => void loadGymData()} disabled={loadingData || !selectedGymId}>
              {loadingData ? "Loading..." : "Refresh class data"}
            </button>
          </div>
        </div>
        {selectedGym && (
          <p className="subheading" style={{ marginTop: 10 }}>
            Managing classes for {selectedGym.name}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Class catalog</h3>
            <p className="subheading" style={{ marginTop: 6 }}>
              Locations and course templates drive capacity, duration, coach eligibility, and scheduling.
            </p>
          </div>
          <button className="btn btn-primary" disabled={savingCatalog || !selectedGymId} onClick={() => void handleSaveCatalog()}>
            {savingCatalog ? "Saving..." : "Save catalog"}
          </button>
        </div>

        <div className="grid grid-2">
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>Locations</h4>
              <button className="btn" type="button" onClick={() => setLocationDrafts((current) => [...current, emptyLocationDraft()])}>
                Add location
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {locationDrafts.map((location) => (
                <div key={location.id} style={draftCardStyle}>
                  <div className="grid grid-2">
                    <div>
                      <label className="label" htmlFor={`location-name-${location.id}`}>Location name</label>
                      <input
                        id={`location-name-${location.id}`}
                        className="input"
                        value={location.name}
                        onChange={(event) => updateLocationDraft(location.id, { name: event.target.value })}
                        placeholder="Wellness Zone"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`location-address-${location.id}`}>Address</label>
                      <input
                        id={`location-address-${location.id}`}
                        className="input"
                        value={location.address ?? ""}
                        onChange={(event) =>
                          updateLocationDraft(location.id, { address: event.target.value || null })
                        }
                        placeholder="Via ... , Pavia"
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}
                  >
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={location.active}
                        onChange={(event) => updateLocationDraft(location.id, { active: event.target.checked })}
                      />
                      Active in scheduler
                    </label>
                    <button className="btn btn-danger" type="button" onClick={() => removeLocationDraft(location.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {locationDrafts.length === 0 && (
                <div style={draftCardStyle}>
                  <p className="subheading" style={{ margin: 0 }}>
                    No locations configured yet. Add at least one location before scheduling classes.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>Course templates</h4>
              <button className="btn" type="button" onClick={() => setTemplateDrafts((current) => [...current, emptyTemplateDraft()])}>
                Add course
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {templateDrafts.map((template) => (
                <div key={template.id} style={draftCardStyle}>
                  <div className="grid grid-2">
                    <div>
                      <label className="label" htmlFor={`template-name-${template.id}`}>Course name</label>
                      <input
                        id={`template-name-${template.id}`}
                        className="input"
                        value={template.name}
                        onChange={(event) => updateTemplateDraft(template.id, { name: event.target.value })}
                        placeholder="Pilates Reformer"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`template-description-${template.id}`}>Description</label>
                      <input
                        id={`template-description-${template.id}`}
                        className="input"
                        value={template.description ?? ""}
                        onChange={(event) =>
                          updateTemplateDraft(template.id, { description: event.target.value || null })
                        }
                        placeholder="Small-group reformer class"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`template-capacity-${template.id}`}>Default capacity</label>
                      <input
                        id={`template-capacity-${template.id}`}
                        className="input"
                        type="number"
                        min={1}
                        max={200}
                        value={template.defaultCapacity}
                        onChange={(event) =>
                          updateTemplateDraft(template.id, {
                            defaultCapacity: Math.max(1, Math.min(200, Number(event.target.value) || 1))
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`template-duration-${template.id}`}>Default duration (minutes)</label>
                      <input
                        id={`template-duration-${template.id}`}
                        className="input"
                        type="number"
                        min={15}
                        max={300}
                        step={5}
                        value={template.defaultDurationMinutes}
                        onChange={(event) =>
                          updateTemplateDraft(template.id, {
                            defaultDurationMinutes: Math.max(
                              15,
                              Math.min(300, Number(event.target.value) || 15)
                            )
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label className="label">Allowed locations</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {locationDrafts.length === 0 && (
                        <span className="subheading">Add locations first.</span>
                      )}
                      {locationDrafts.map((location) => {
                        const active = template.locationIds.includes(location.id);
                        return (
                          <button
                            key={`${template.id}_${location.id}`}
                            type="button"
                            className={`btn ${active ? "btn-primary" : ""}`}
                            onClick={() => toggleTemplateLocation(template.id, location.id)}
                          >
                            {location.name || "Unnamed location"}
                          </button>
                        );
                      })}
                    </div>
                    <p className="subheading" style={{ marginTop: 8 }}>
                      If you leave all locations unselected, this course can be scheduled at any active location.
                    </p>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label className="label">Eligible coaches</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {coaches.length === 0 && <span className="subheading">No coach-eligible staff found yet.</span>}
                      {coaches.map((coach) => {
                        const active = template.eligibleCoachUserIds.includes(coach.userId);
                        return (
                          <button
                            key={`${template.id}_${coach.userId}`}
                            type="button"
                            className={`btn ${active ? "btn-primary" : ""}`}
                            onClick={() => toggleTemplateCoach(template.id, coach.userId)}
                          >
                            {coach.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="subheading" style={{ marginTop: 8 }}>
                      If you leave all coaches unselected, any active leader, officer, or coach can be assigned.
                    </p>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}
                  >
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={template.active}
                        onChange={(event) => updateTemplateDraft(template.id, { active: event.target.checked })}
                      />
                      Active in scheduler
                    </label>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() =>
                        setTemplateDrafts((current) => current.filter((item) => item.id !== template.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {templateDrafts.length === 0 && (
                <div style={draftCardStyle}>
                  <p className="subheading" style={{ margin: 0 }}>
                    No course templates configured yet. Add at least one before scheduling classes.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Schedule class</h3>
        <p className="subheading" style={{ marginBottom: 12 }}>
          Choose a configured course, then schedule one or many occurrences using its location and coach rules.
        </p>

        {!catalogIsConfigured && (
          <div style={{ ...draftCardStyle, marginBottom: 12, color: "#ffcf8a" }}>
            Configure at least one active location and one active course template before scheduling classes.
          </div>
        )}

        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`class-template-${scope}`}>Course template</label>
            <select
              id={`class-template-${scope}`}
              className="input"
              value={selectedTemplateId}
              onChange={(event) => applyTemplateDefaults(event.target.value)}
              disabled={activeTemplates.length === 0}
            >
              {activeTemplates.length === 0 && <option value="">No course templates</option>}
              {activeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`class-location-${scope}`}>Location</label>
            <select
              id={`class-location-${scope}`}
              className="input"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              disabled={templateLocationOptions.length === 0}
            >
              {templateLocationOptions.length === 0 && <option value="">No valid locations</option>}
              {templateLocationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            {selectedLocation?.address && (
              <p className="subheading" style={{ marginTop: 8 }}>
                {selectedLocation.address}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor={`class-title-${scope}`}>Class title</label>
            <input
              id={`class-title-${scope}`}
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pilates Reformer"
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
              {coachOptionsForTemplate.map((coach) => (
                <option key={coach.userId} value={coach.userId}>
                  {coach.label} ({coach.role})
                </option>
              ))}
            </select>
            {selectedTemplate && selectedTemplate.eligibleCoachUserIds.length > 0 && (
              <p className="subheading" style={{ marginTop: 8 }}>
                Coach list is filtered by this course template.
              </p>
            )}
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
              placeholder="Optional setup notes, equipment requirements, or instructions"
              rows={3}
            />
          </div>
        </div>

        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          Preview: {upcomingPreview.length} occurrence{upcomingPreview.length === 1 ? "" : "s"}
          {upcomingPreview[0] && <> · first: {new Date(upcomingPreview[0].startsAt).toLocaleString()}</>}
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            disabled={savingSchedule || !selectedGymId || !selectedTemplate || !selectedLocation}
            onClick={() => void handleCreateClasses()}
          >
            {savingSchedule ? "Scheduling..." : "Schedule class"}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Scheduled classes</h3>
            <p className="subheading" style={{ marginTop: 6 }}>
              Current catalog snapshot: {catalog.locations.length} locations · {catalog.templates.length} course templates
            </p>
          </div>
        </div>

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
              {classesSorted.length === 0 && !loadingData && (
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
