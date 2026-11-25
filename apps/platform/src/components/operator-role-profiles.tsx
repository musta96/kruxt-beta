"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadOperatorRoleProfiles, mutateOperatorRoleProfile,
  type OperatorRoleProfile, type OperatorRoleProfileSnapshot, type OperatorRoleProfileMutation,
} from "../services/operator-role-profiles";

const control = "min-h-10 min-w-0 rounded-md border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const button = control + " hover:bg-muted";

/** Parent must remount on credential changes, as with the operator workspace. */
export function OperatorRoleProfiles({ client, viewerId }: { client: SupabaseClient; viewerId: string }) {
  return <ProfileWorkspace key={viewerId} client={client} viewerId={viewerId} />;
}
function ProfileWorkspace({ client, viewerId }: { client: SupabaseClient; viewerId: string }) {
  const [snapshot, setSnapshot] = useState<OperatorRoleProfileSnapshot | null>(null);
  const [selected, setSelected] = useState<OperatorRoleProfile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<OperatorRoleProfile["permissions"]>({});
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [assignment, setAssignment] = useState("");
  const [inspect, setInspect] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [review, setReview] = useState<OperatorRoleProfileMutation | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const canWrite = snapshot?.can_write === true;
  useEffect(() => {
    mounted.current = true;
    const current = ++generation.current;
    setSnapshot(null);
    loadOperatorRoleProfiles(client, viewerId).then((next) => {
      if (mounted.current && current === generation.current) setSnapshot(next);
    }).catch((e: unknown) => { if (mounted.current && current === generation.current) setError(e instanceof Error ? e.message : "Could not load profiles."); });
    return () => { mounted.current = false; generation.current++; };
  }, [client, viewerId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function choose(id: string) {
    if (dirty && !window.confirm("Discard unsaved role profile changes?")) return;
    const p = snapshot?.profiles.find((entry) => entry.id === id) ?? null;
    setSelected(p); setName(p?.name ?? ""); setDescription(p?.description ?? ""); setPermissions({ ...p?.permissions });
    setReason(""); setDirty(false); setReview(null); setNotice("");
  }
  async function commit() {
    if (!review || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    const current = generation.current;
    try {
      const next = await mutateOperatorRoleProfile(client, viewerId, review);
      if (!mounted.current || current !== generation.current) return;
      setSnapshot(next); setSelected(null); setName(""); setDescription(""); setPermissions({});
      setTarget(""); setAssignment(""); setReason(""); setDirty(false); setReview(null); setNotice("Role profile change confirmed.");
    } catch (e) {
      if (mounted.current && current === generation.current) {
        setError(e instanceof Error ? e.message : "Change could not be confirmed. Reload before retrying.");
        // Never resubmit a potentially committed write from a stale draft.
        setSnapshot(null); setReview(null);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }
  return <section aria-labelledby="role-profiles-title" className="min-w-0 space-y-5 border-t border-border py-6">
    <h2 id="role-profiles-title" className="text-lg font-semibold">Custom role profiles</h2>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><button className={button} onClick={() => window.location.reload()}>Reload profiles</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!snapshot && !error && <p role="status">Loading role profiles...</p>}
    {snapshot && <>
      {!canWrite && <p role="status">Read only. Changes require an active founder with verified MFA and permission-matrix access.</p>}
      <label className="grid gap-1 text-sm">Role profile
        <select className={control} value={selected?.id ?? ""} disabled={busy || !!review} onChange={(e) => choose(e.target.value)}>
          <option value="">New profile</option>{snapshot.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {!snapshot.profiles.length && <p className="text-sm text-muted-foreground">No custom role profiles.</p>}
      <label className="grid gap-1 text-sm">Inspect resolved access
        <select className={control} value={inspect} onChange={(event) => setInspect(event.target.value)}>
          <option value="">Choose operator</option>
          {snapshot.operators.map((operator) => <option key={operator.user_id} value={operator.user_id}>{operator.display_name} ({operator.role})</option>)}
        </select>
      </label>
      {inspect && <ul aria-label="Resolved operator permissions" className="divide-y divide-border">
        {snapshot.effective_permissions.filter((row) => row.user_id === inspect).map((row) => <li key={row.permission_key} className="min-w-0 py-2 text-sm">
          <code className="block break-all text-xs">{row.permission_key}</code>
          <span>{row.is_allowed ? "Allow" : "Deny"} ({row.source.replaceAll("_", " ")})</span>
          {row.profile_id && <span className="block text-xs text-muted-foreground">{snapshot.profiles.find((profile) => profile.id === row.profile_id)?.name ?? "Profile"}</span>}
        </li>)}
      </ul>}
      <fieldset disabled={!canWrite || busy || !!review} className="min-w-0 space-y-4">
        <label className="grid gap-1 text-sm">Profile name<input className={control} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></label>
        <label className="grid gap-1 text-sm">Description<textarea className={control} value={description} maxLength={500} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} /></label>
        <ul className="divide-y divide-border">{snapshot.catalog.map((c) => <li key={c.permission_key} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
          <div className="min-w-0"><span className="text-sm">{c.label}</span><p className="break-all text-xs text-muted-foreground">{c.permission_key}</p></div>
          <select aria-label={`Profile permission for ${c.label}`} className={control} value={permissions[c.permission_key] === undefined ? "inherit" : permissions[c.permission_key] ? "allow" : "deny"}
            onChange={(e) => { const next = { ...permissions }; if (e.target.value === "inherit") delete next[c.permission_key]; else next[c.permission_key] = e.target.value === "allow"; setPermissions(next); setDirty(true); }}>
            <option value="inherit">Inherit enum default</option><option value="allow">Allow</option><option value="deny">Deny</option>
          </select>
        </li>)}</ul>
        <label className="grid gap-1 text-sm">Audit reason<textarea className={control} maxLength={2000} value={reason} onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></label>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={!name.trim() || !reason.trim()} onClick={() => setReview({ action: selected ? "update" : "create", profile: selected, name, description, permissions: { ...permissions }, reason })}>Review profile</button>
          {selected && <button className={button} disabled={!reason.trim() || snapshot.assignments.some((a) => a.profile_id === selected.id)} onClick={() => setReview({ action: "delete", profile: selected, reason })}>Review deletion</button>}
        </div>
        <h3 className="pt-3 text-base font-semibold">Operator assignment</h3>
        <label className="grid gap-1 text-sm">Operator<select className={control} value={target} onChange={(e) => { setTarget(e.target.value); setAssignment(snapshot.assignments.find((a) => a.user_id === e.target.value)?.profile_id ?? ""); setDirty(true); }}>
          <option value="">Choose operator</option>{snapshot.operators.filter((o) => o.role !== "founder").map((o) => <option key={o.user_id} value={o.user_id}>{o.display_name} ({o.role}{o.is_active ? "" : ", inactive"})</option>)}
        </select></label>
        <label className="grid gap-1 text-sm">Assigned profile<select className={control} value={assignment} onChange={(e) => { setAssignment(e.target.value); setDirty(true); }}>
          <option value="">No profile</option>{snapshot.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
        <button className={button} disabled={!target || !reason.trim() || assignment === (snapshot.assignments.find((a) => a.user_id === target)?.profile_id ?? "")}
          onClick={() => setReview({ action: "assign", profile: snapshot.profiles.find((p) => p.id === assignment) ?? null, userId: target,
            expectedProfileId: snapshot.assignments.find((a) => a.user_id === target)?.profile_id ?? null, reason })}>Review assignment</button>
      </fieldset>
      {review && <div aria-label="Review role profile change" className="space-y-3 border-t border-border pt-4">
        <h3 className="font-semibold">Confirm {review.action}</h3>
        <p className="break-words text-sm">{review.action === "assign" ? `${snapshot.operators.find((o) => o.user_id === review.userId)?.display_name}: ${review.profile?.name ?? "No profile"}` : review.name ?? review.profile?.name}</p>
        {review.action === "update" && <p className="text-sm">Assigned operators affected: {snapshot.assignments.filter((a) => a.profile_id === review.profile?.id).length}</p>}
        {(review.action === "create" || review.action === "update") && <ul className="text-sm">{snapshot.catalog.map((c) => <li key={c.permission_key}>{c.label}: {review.permissions?.[c.permission_key] === undefined ? "Inherit enum default" : review.permissions[c.permission_key] ? "Allow" : "Deny"}</li>)}</ul>}
        <p className="break-words text-sm">Reason: {review.reason}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void commit()}>{busy ? "Saving..." : "Confirm change"}</button><button className={button} disabled={busy} onClick={() => setReview(null)}>Back</button></div>
      </div>}
    </>}
  </section>;
}
