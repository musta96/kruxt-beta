import React, { useCallback, useEffect, useReducer, useState } from "react";
import type { AccessEventType, AccessResult } from "@kruxt/types";
import type { OpsConsoleServices } from "./runtime-services";
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
            label="+ New Class"
            pending={pending === "create_class"}
            onClick={() => runAction("create_class", () =>
              services.createClass(gymId, {
                title: "New Class",
                capacity: 20,
                startsAt: new Date(Date.now() + 86400000).toISOString(),
                endsAt: new Date(Date.now() + 86400000 + 3600000).toISOString(),
              })
            )}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th><th>Status</th><th>Capacity</th><th>Starts</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-6">No classes found</td></tr>
            ) : classes.map((c) => (
              <tr key={c.id} className={c.id === selectedId ? "bg-muted/30" : ""}>
                <td className="font-medium">{c.title}</td>
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
