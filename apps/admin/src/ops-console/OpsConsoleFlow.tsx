import React, { useCallback, useEffect, useReducer, useState } from "react";
import type { AccessEventType, AccessResult } from "@kruxt/types";
import type {
  ClassSchedulingOptions,
  ClassTemplateOption,
  CoachOption,
  OpsConsoleServices
} from "./runtime-services";
import type { Phase5B2BOpsSnapshot } from "../flows/phase5-b2b-ops";
import type { Phase5OpsUiError } from "../flows/phase5-ops-console-ui";

/* ── Tab definitions ────────────────────────────────────────────── */

const TABS = [
  { key: "classes", label: "Class Management" },
  { key: "waitlist", label: "Waitlist" },
  { key: "checkin", label: "Check-in & Access" },
  { key: "waiver", label: "Waiver & Contract" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ── State ──────────────────────────────────────────────────────── */

interface State {
  loading: boolean;
  snapshot: Phase5B2BOpsSnapshot | null;
  error: Phase5OpsUiError | null;
  actionPending: string | null;
  actionError: Phase5OpsUiError | null;
}

type Action =
  | { type: "load_start" }
  | { type: "load_ok"; snapshot: Phase5B2BOpsSnapshot }
  | { type: "load_fail"; error: Phase5OpsUiError }
  | { type: "action_start"; key: string }
  | { type: "action_ok"; snapshot: Phase5B2BOpsSnapshot }
  | { type: "action_fail"; error: Phase5OpsUiError }
  | { type: "dismiss_error" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load_start": return { ...s, loading: true, error: null };
    case "load_ok": return { ...s, loading: false, snapshot: a.snapshot, error: null };
    case "load_fail": return { ...s, loading: false, error: a.error };
    case "action_start": return { ...s, actionPending: a.key, actionError: null };
    case "action_ok": return { ...s, actionPending: null, snapshot: a.snapshot, actionError: null };
    case "action_fail": return { ...s, actionPending: null, actionError: a.error };
    case "dismiss_error": return { ...s, actionError: null, error: null };
    default: return s;
  }
}

const INIT: State = { loading: true, snapshot: null, error: null, actionPending: null, actionError: null };

function makeRuntimeUiError(
  message: string,
  step: Phase5OpsUiError["step"] = "class_management"
): Phase5OpsUiError {
  return {
    code: "ADMIN_OPS_RUNTIME_ERROR",
    step,
    message,
    recoverable: true
  };
}

interface CreateClassDraft {
  location: string;
  templateId: string;
  customTitle: string;
  coachUserId: string;
  startsAtLocal: string;
  durationMinutes: number;
  capacity: number;
  notes: string;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStartLocal(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(0);
  date.setHours(date.getHours() + 1);
  return toDatetimeLocalValue(date);
}

function parseClassMeta(description: string | null | undefined): { location?: string; course?: string; notes?: string } {
  if (!description) return {};
  const lines = description.split("\n").map((line) => line.trim());
  const output: { location?: string; course?: string; notes?: string } = {};

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("location:")) {
      output.location = line.slice("location:".length).trim();
    } else if (lower.startsWith("course:")) {
      output.course = line.slice("course:".length).trim();
    } else if (lower.startsWith("notes:")) {
      output.notes = line.slice("notes:".length).trim();
    }
  }

  return output;
}

function buildInitialCreateDraft(options: ClassSchedulingOptions): CreateClassDraft {
  const firstTemplate = options.templates[0];
  const location = firstTemplate?.location ?? options.locations[0] ?? "Main Floor";

  return {
    location,
    templateId: firstTemplate?.id ?? "",
    customTitle: firstTemplate?.name ?? "",
    coachUserId: "",
    startsAtLocal: defaultStartLocal(),
    durationMinutes: firstTemplate?.defaultDurationMinutes ?? 60,
    capacity: firstTemplate?.defaultCapacity ?? 20,
    notes: ""
  };
}

function pickTemplate(
  options: ClassSchedulingOptions,
  location: string,
  templateId?: string
): ClassTemplateOption | undefined {
  const sameLocation = options.templates.filter((item) => item.location === location);
  if (templateId) {
    const exact = sameLocation.find((item) => item.id === templateId);
    if (exact) return exact;
  }
  return sameLocation[0] ?? options.templates[0];
}

/* ── Props ──────────────────────────────────────────────────────── */

export interface OpsConsoleFlowProps {
  services: OpsConsoleServices;
  gymId: string;
  defaultTab?: TabKey;
}

/* ── Component ──────────────────────────────────────────────────── */

export function OpsConsoleFlow({ services, gymId, defaultTab = "classes" }: OpsConsoleFlowProps) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const [tab, setTab] = React.useState<TabKey>(defaultTab);

  const load = useCallback(async () => {
    dispatch({ type: "load_start" });
    try {
      const result = await services.load(gymId);
      if (result.ok === false) {
        dispatch({ type: "load_fail", error: result.error });
      } else {
        dispatch({ type: "load_ok", snapshot: result.snapshot });
      }
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : "Unable to load operations data.";
      dispatch({
        type: "load_fail",
        error: makeRuntimeUiError(fallbackMessage)
      });
    }
  }, [gymId, services]);

  useEffect(() => { load(); }, [load]);

  const runAction = useCallback(async (key: string, fn: () => Promise<any>) => {
    dispatch({ type: "action_start", key });
    try {
      const result = await fn();
      if (result.ok) {
        dispatch({ type: "action_ok", snapshot: result.snapshot });
      } else {
        dispatch({ type: "action_fail", error: result.error });
      }
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : "Unable to complete this action.";
      dispatch({
        type: "action_fail",
        error: makeRuntimeUiError(fallbackMessage)
      });
    }
  }, []);

  const snap = state.snapshot;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Error banner */}
      {(state.error || state.actionError) && (
        <div className="mx-4 mt-4 panel border-destructive/40 bg-destructive/10 p-3 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-destructive text-sm font-semibold">
              {(state.actionError ?? state.error)!.message}
            </p>
            <p className="text-destructive/70 text-xs mt-0.5">
              Code: {(state.actionError ?? state.error)!.code} · Step: {(state.actionError ?? state.error)!.step}
              {(state.actionError ?? state.error)!.recoverable && " · Recoverable"}
            </p>
          </div>
          <button onClick={() => dispatch({ type: "dismiss_error" })} className="text-destructive text-xs underline flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="px-4 pt-4">
        <div className="tab-strip">
          {TABS.map((t) => (
            <button
              key={t.key}
              className="tab-item"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {state.loading ? (
          <SkeletonPanel />
        ) : !snap ? (
          <div className="panel p-6 text-center">
            <p className="text-muted-foreground text-sm">No data loaded.</p>
            <button onClick={load} className="btn-compact mt-3">Retry</button>
          </div>
        ) : (
          <>
            {tab === "classes" && <ClassManagementTab snapshot={snap} services={services} gymId={gymId} pending={state.actionPending} runAction={runAction} />}
            {tab === "waitlist" && <WaitlistTab snapshot={snap} services={services} gymId={gymId} pending={state.actionPending} runAction={runAction} />}
            {tab === "checkin" && <CheckinAccessTab snapshot={snap} services={services} gymId={gymId} pending={state.actionPending} runAction={runAction} />}
            {tab === "waiver" && <WaiverContractTab snapshot={snap} services={services} gymId={gymId} pending={state.actionPending} runAction={runAction} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Shared Props ────────────────────────────────────────────────── */

interface TabProps {
  snapshot: Phase5B2BOpsSnapshot;
  services: OpsConsoleServices;
  gymId: string;
  pending: string | null;
  runAction: (key: string, fn: () => Promise<any>) => void;
}

/* ── Class Management ────────────────────────────────────────────── */

function ClassManagementTab({ snapshot, services, gymId, pending, runAction }: TabProps) {
  const classes = snapshot.classes;
  const bookings = snapshot.selectedClassBookings;
  const selectedId = snapshot.selectedClassId;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [options, setOptions] = useState<ClassSchedulingOptions>({
    locations: ["Main Floor"],
    templates: [],
    coaches: []
  });
  const [draft, setDraft] = useState<CreateClassDraft>(() => buildInitialCreateDraft({
    locations: ["Main Floor"],
    templates: [],
    coaches: []
  }));

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        const data = await services.listClassSchedulingOptions(gymId);
        if (!active) return;
        setOptions(data);
        if (!showCreateForm) {
          setDraft(buildInitialCreateDraft(data));
        }
      } catch (error) {
        if (!active) return;
        console.warn("[ops-console] unable to load scheduling options:", error);
      }
    };

    void loadOptions();
    return () => {
      active = false;
    };
  }, [gymId, services, showCreateForm]);

  const coachNameById = new Map<string, string>(
    options.coaches.map((coach: CoachOption) => [coach.userId, coach.displayName])
  );

  const templatesForLocation = options.templates.filter((item) => item.location === draft.location);
  const selectedTemplate =
    templatesForLocation.find((item) => item.id === draft.templateId) ??
    pickTemplate(options, draft.location, draft.templateId);

  const openCreateForm = () => {
    setDraft(buildInitialCreateDraft(options));
    setFormError(null);
    setShowCreateForm(true);
  };

  const applyTemplateDefaults = (template: ClassTemplateOption | undefined) => {
    if (!template) return;
    setDraft((prev) => ({
      ...prev,
      templateId: template.id,
      customTitle: template.name,
      capacity: template.defaultCapacity,
      durationMinutes: template.defaultDurationMinutes
    }));
  };

  const handleCreateClass = async () => {
    setFormError(null);
    if (!selectedTemplate) {
      setFormError("Select a class template.");
      return;
    }
    if (!draft.customTitle.trim()) {
      setFormError("Class title is required.");
      return;
    }
    if (!draft.startsAtLocal.trim()) {
      setFormError("Start date and time are required.");
      return;
    }
    if (draft.durationMinutes < 15) {
      setFormError("Duration must be at least 15 minutes.");
      return;
    }
    if (draft.capacity < 1) {
      setFormError("Capacity must be at least 1.");
      return;
    }

    const startsAtDate = new Date(draft.startsAtLocal);
    if (Number.isNaN(startsAtDate.getTime())) {
      setFormError("Start date/time is invalid.");
      return;
    }

    const endsAtDate = new Date(startsAtDate.getTime() + draft.durationMinutes * 60_000);
    const descriptionLines = [
      `location: ${draft.location}`,
      `course: ${selectedTemplate.name}`,
      draft.notes.trim() ? `notes: ${draft.notes.trim()}` : null
    ].filter(Boolean) as string[];

    await runAction("create_class", () =>
      services.createClass(gymId, {
        title: draft.customTitle.trim(),
        coachUserId: draft.coachUserId || undefined,
        capacity: draft.capacity,
        status: "scheduled",
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
        description: descriptionLines.join("\n")
      })
    );
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Classes" value={classes.length} />
        <StatCard label="Scheduled" value={classes.filter(c => c.status === "scheduled").length} />
        <StatCard label="Bookings" value={bookings.length} />
        <StatCard label="Plans" value={snapshot.membershipPlans.length} />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">Classes</h3>
          <ActionButton
            label="+ Schedule Class"
            pending={pending === "create_class"}
            onClick={openCreateForm}
          />
        </div>

        {showCreateForm && (
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</label>
                <select
                  className="input-field"
                  value={draft.location}
                  onChange={(event) => {
                    const location = event.target.value;
                    const template = pickTemplate(options, location);
                    setDraft((prev) => ({
                      ...prev,
                      location,
                      templateId: template?.id ?? "",
                      customTitle: template?.name ?? prev.customTitle,
                      capacity: template?.defaultCapacity ?? prev.capacity,
                      durationMinutes: template?.defaultDurationMinutes ?? prev.durationMinutes
                    }));
                  }}
                >
                  {options.locations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course</label>
                <select
                  className="input-field"
                  value={selectedTemplate?.id ?? ""}
                  onChange={(event) => {
                    const template = options.templates.find((item) => item.id === event.target.value);
                    applyTemplateDefaults(template);
                  }}
                >
                  {templatesForLocation.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach</label>
                <select
                  className="input-field"
                  value={draft.coachUserId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, coachUserId: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {options.coaches.map((coach) => (
                    <option key={coach.userId} value={coach.userId}>
                      {coach.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Class title</label>
                <input
                  className="input-field"
                  value={draft.customTitle}
                  onChange={(event) => setDraft((prev) => ({ ...prev, customTitle: event.target.value }))}
                  placeholder="Pilates Reformer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Starts</label>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={draft.startsAtLocal}
                  onChange={(event) => setDraft((prev) => ({ ...prev, startsAtLocal: event.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration (min)</label>
                <input
                  className="input-field"
                  type="number"
                  min={15}
                  step={5}
                  value={draft.durationMinutes}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, durationMinutes: Number(event.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capacity</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={draft.capacity}
                  onChange={(event) => setDraft((prev) => ({ ...prev, capacity: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="md:col-span-3 flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
                <input
                  className="input-field"
                  value={draft.notes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Room setup, equipment, visibility notes..."
                />
              </div>
            </div>

            {formError && (
              <div className="text-destructive text-xs font-medium">{formError}</div>
            )}

            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost w-auto"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
              <ActionButton
                label="Confirm & Schedule"
                pending={pending === "create_class"}
                onClick={() => {
                  void handleCreateClass();
                }}
              />
            </div>
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th><th>Location</th><th>Coach</th><th>Status</th><th>Capacity</th><th>Starts</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No classes found</td></tr>
            ) : classes.map((c) => (
              <tr key={c.id} className={c.id === selectedId ? "bg-muted/30" : ""}>
                <td className="font-medium">{c.title}</td>
                <td className="text-xs text-muted-foreground">
                  {parseClassMeta(c.description).location ?? "—"}
                </td>
                <td className="text-xs text-muted-foreground">
                  {c.coachUserId ? coachNameById.get(c.coachUserId) ?? `${c.coachUserId.slice(0, 8)}...` : "Unassigned"}
                </td>
                <td><StatusBadge status={c.status} /></td>
                <td className="font-mono tabular-nums">{c.capacity}</td>
                <td className="text-xs text-muted-foreground">{new Date(c.startsAt).toLocaleString()}</td>
                <td>
                  <div className="flex gap-1.5">
                    {c.status === "scheduled" && (
                      <ActionButton label="Cancel" small pending={pending === `cancel_${c.id}`} onClick={() =>
                        runAction(`cancel_${c.id}`, () => services.setClassStatus(gymId, c.id, "cancelled"))
                      } />
                    )}
                    {c.status === "scheduled" && (
                      <ActionButton label="Complete" small pending={pending === `complete_${c.id}`} onClick={() =>
                        runAction(`complete_${c.id}`, () => services.setClassStatus(gymId, c.id, "completed"))
                      } />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-display font-bold text-foreground">
              Bookings — {classes.find(c => c.id === selectedId)?.title ?? selectedId}
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Status</th><th>Booked</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No bookings</td></tr>
              ) : bookings.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.userId.slice(0, 8)}…</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="text-xs text-muted-foreground">{new Date(b.bookedAt).toLocaleString()}</td>
                  <td>
                    {b.status === "booked" && (
                      <ActionButton label="Cancel" small pending={pending === `cancel_bk_${b.id}`} onClick={() =>
                        runAction(`cancel_bk_${b.id}`, () => services.updateClassBookingStatus(gymId, b.id, "cancelled", selectedId))
                      } />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Waitlist ────────────────────────────────────────────────────── */

function WaitlistTab({ snapshot, services, gymId, pending, runAction }: TabProps) {
  const waitlist = snapshot.selectedClassWaitlist;
  const selectedId = snapshot.selectedClassId;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Waitlist Entries" value={waitlist.length} />
        <StatCard label="Pending" value={waitlist.filter(w => w.status === "pending").length} />
        <StatCard label="Promoted" value={waitlist.filter(w => w.status === "promoted").length} />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">
            Waitlist {selectedId ? `— Class ${selectedId.slice(0, 8)}…` : ""}
          </h3>
          {selectedId && (
            <ActionButton
              label="Promote Next"
              pending={pending === "promote"}
              onClick={() => runAction("promote", () => services.promoteWaitlistMember(gymId, selectedId))}
            />
          )}
        </div>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>User</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {waitlist.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">Waitlist empty</td></tr>
            ) : waitlist.map((w) => (
              <tr key={w.id}>
                <td className="font-mono tabular-nums">{w.position}</td>
                <td className="font-mono text-xs">{w.userId.slice(0, 8)}…</td>
                <td><StatusBadge status={w.status} /></td>
                <td className="text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleString()}</td>
                <td>
                  {selectedId && w.status === "pending" && (
                    <ActionButton
                      label="Cancel"
                      small
                      pending={pending === `waitlist_cancel_${w.id}`}
                      onClick={() =>
                        runAction(
                          `waitlist_cancel_${w.id}`,
                          () => services.updateWaitlistEntry(gymId, w.id, { status: "cancelled" }, selectedId)
                        )
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Check-in & Access ───────────────────────────────────────────── */

function CheckinAccessTab({ snapshot, services, gymId, pending, runAction }: TabProps) {
  const checkins = snapshot.recentCheckins;
  const accessLogs = snapshot.recentAccessLogs;
  const [userId, setUserId] = useState("");
  const [eventType, setEventType] = useState<AccessEventType>("frontdesk_checkin");
  const [result, setResult] = useState<AccessResult>("allowed");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Recent Check-ins" value={checkins.length} />
        <StatCard label="Access Logs" value={accessLogs.length} />
        <StatCard label="Allowed" value={accessLogs.filter(a => a.result === "allowed").length} />
        <StatCard label="Denied" value={accessLogs.filter(a => a.result === "denied").length} />
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-sm font-display font-bold text-foreground">Record Check-in</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="input-field"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="user UUID"
          />
          <select
            className="input-field"
            value={eventType}
            onChange={(event) => setEventType(event.target.value as AccessEventType)}
          >
            <option value="frontdesk_checkin">frontdesk_checkin</option>
            <option value="door_checkin">door_checkin</option>
            <option value="door_denied">door_denied</option>
            <option value="manual_override">manual_override</option>
          </select>
          <select
            className="input-field"
            value={result}
            onChange={(event) => setResult(event.target.value as AccessResult)}
          >
            <option value="allowed">allowed</option>
            <option value="denied">denied</option>
            <option value="override_allowed">override_allowed</option>
          </select>
          <ActionButton
            label="Record"
            pending={pending === "record_checkin_access"}
            onClick={() =>
              userId.trim() &&
              runAction("record_checkin_access", () =>
                services.recordCheckinAndAccessLog(gymId, {
                  userId: userId.trim(),
                  eventType,
                  result,
                  sourceChannel: "admin_panel"
                })
              )
            }
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">Recent Check-ins</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>User</th><th>Type</th><th>Result</th><th>Time</th></tr>
          </thead>
          <tbody>
            {checkins.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No check-ins</td></tr>
            ) : checkins.slice(0, 50).map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.userId.slice(0, 8)}…</td>
                <td>{c.eventType}</td>
                <td><StatusBadge status={c.result} /></td>
                <td className="text-xs text-muted-foreground">{new Date(c.checkedInAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">Access Logs</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>User</th><th>Event</th><th>Result</th><th>Time</th></tr>
          </thead>
          <tbody>
            {accessLogs.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No access logs</td></tr>
            ) : accessLogs.slice(0, 50).map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.userId?.slice(0, 8) ?? "—"}…</td>
                <td>{a.eventType}</td>
                <td><StatusBadge status={a.result} /></td>
                <td className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Waiver & Contract ───────────────────────────────────────────── */

function WaiverContractTab({ snapshot, services, gymId, pending, runAction }: TabProps) {
  const waivers = snapshot.waivers;
  const contracts = snapshot.contracts;
  const [userId, setUserId] = useState("");
  const activeWaiver = waivers.find((item) => item.isActive);
  const activeContract = contracts.find((item) => item.isActive);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Waivers" value={waivers.length} />
        <StatCard label="Active Waivers" value={waivers.filter(w => w.isActive).length} />
        <StatCard label="Contracts" value={contracts.length} />
        <StatCard label="Active Contracts" value={contracts.filter(c => c.isActive).length} />
      </div>

      <div className="panel p-4 space-y-3">
        <h3 className="text-sm font-display font-bold text-foreground">Record Acceptance Evidence</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="input-field"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="user UUID"
          />
          <ActionButton
            label="Accept Waiver"
            pending={pending === "record_waiver_acceptance"}
            onClick={() =>
              activeWaiver &&
              userId.trim() &&
              runAction("record_waiver_acceptance", () =>
                services.recordWaiverAcceptance(gymId, activeWaiver.id, {
                  userId: userId.trim(),
                  signatureData: { source: "admin_console" }
                })
              )
            }
          />
          <ActionButton
            label="Accept Contract"
            pending={pending === "record_contract_acceptance"}
            onClick={() =>
              activeContract &&
              userId.trim() &&
              runAction("record_contract_acceptance", () =>
                services.recordContractAcceptance(gymId, activeContract.id, {
                  userId: userId.trim(),
                  signatureData: { source: "admin_console" }
                })
              )
            }
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">Waivers</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Version</th><th>Active</th><th>Effective</th></tr>
          </thead>
          <tbody>
            {waivers.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No waivers</td></tr>
            ) : waivers.map((w) => (
              <tr key={w.id}>
                <td className="font-medium">{w.title}</td>
                <td className="font-mono text-xs">{w.policyVersion}</td>
                <td><StatusBadge status={w.isActive ? "active" : "inactive"} /></td>
                <td className="text-xs text-muted-foreground">{new Date(w.effectiveAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-display font-bold text-foreground">Contracts</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Active</th><th>Effective</th></tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground text-sm py-6">No contracts</td></tr>
            ) : contracts.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.title}</td>
                <td>{c.contractType}</td>
                <td><StatusBadge status={c.isActive ? "active" : "inactive"} /></td>
                <td className="text-xs text-muted-foreground">{new Date(c.effectiveAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Shared tiny components ──────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    ["active", "booked", "scheduled", "allowed", "promoted", "attended", "override_allowed"].includes(status) ? "badge-success"
    : ["cancelled", "denied", "inactive", "expired", "failed", "no_show"].includes(status) ? "badge-danger"
    : ["pending", "waitlisted", "paused", "past_due"].includes(status) ? "badge-warning"
    : "badge-steel";
  return <span className={variant}>{status}</span>;
}

function ActionButton({ label, pending, onClick, small }: { label: string; pending: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button className="btn-compact" disabled={pending} onClick={onClick}>
      {pending ? "…" : label}
    </button>
  );
}

function SkeletonPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="panel p-4 flex flex-col gap-2">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-5 w-1/3" />
          </div>
        ))}
      </div>
      <div className="panel p-4 flex flex-col gap-3">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-3/4" />
      </div>
    </div>
  );
}
