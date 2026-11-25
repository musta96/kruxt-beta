"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { expandClassBreak, parseClassSeriesDraft, previewClassSeries, type ClassSeriesDraft } from "@/services/class-series";
import { useAuth } from "@/contexts/auth-context";
import { useGym } from "@/contexts/gym-context";
import { createAdminSupabaseClient } from "@/services/supabase-client";
import { publishClassSeries, ClassSeriesUnconfirmedError } from "@/services/class-series-publishing";
import { ClassSeriesManager } from "./series-manager";
import { clearPending, loadPending, savePending, reconcilePending, PENDING_NOTICE, PENDING_TTL,
  type PendingRequest, type PublicationPayload } from "@/services/class-series-pending";

const INPUT = "w-full min-w-0 rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-kruxt-accent";
const BUTTON = "rounded-button border border-border px-3 py-2 text-sm font-medium hover:bg-kruxt-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kruxt-accent disabled:opacity-50";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type WeeklyGroup = { id: string; startTime: string; endTime: string; days: number[]; slotIds: Record<number,string> };
function groupsFromDraft(draft: ClassSeriesDraft): WeeklyGroup[] {
  const groups: WeeklyGroup[] = [];
  for (const slot of draft.slots) {
    let group = groups.find(row => row.startTime === slot.startTime && row.endTime === slot.endTime);
    if (!group) { group = { id: slot.id || `group-${groups.length}`, startTime: slot.startTime, endTime: slot.endTime, days: [], slotIds: {} }; groups.push(group); }
    group.days.push(slot.weekday); group.slotIds[slot.weekday] = slot.id;
  }
  return groups;
}

function initialDraft(): ClassSeriesDraft {
  const date = new Date().toISOString().slice(0, 10);
  return { version: 1, id: "", title: "", timeZone: "Europe/Rome", startDate: date, endDate: new Date(Date.now()+28*86400000).toISOString().slice(0,10), slots: [2,4].map(weekday=>({ id:`initial-${weekday}`,weekday,startTime:"18:00",endTime:"19:00" })), excludedDates: [] };
}

export default function ClassSeriesPage() {
  const { user } = useAuth();
  const { gymId } = useGym();
  if (!user || !gymId) return <p role="status">Checking gym access...</p>;
  return <SeriesWorkspace key={`${user.id}:${gymId}`} viewerId={user.id} gymId={gymId} />;
}

function SeriesWorkspace({ viewerId, gymId }: { viewerId: string; gymId: string }) {
  const [draft, setDraft] = useState(initialDraft);
  const [groups, setGroups] = useState(() => groupsFromDraft(initialDraft()));
  const [holiday, setHoliday] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewClassSeries> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importRevision = useRef(0);
  const [capacity, setCapacity] = useState(12);
  const [description, setDescription] = useState("");
  const [publication, setPublication] = useState<"idle" | "publishing" | "unconfirmed" | "published">("idle");
  const [publishedRevision, setPublishedRevision] = useState(0);
  const posting = useRef(false);
  const active = useRef(true);
  const epoch = useRef(0);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const locked = !recoveryReady || !!pending || publication !== "idle";
  function context() {
    const version = epoch.current;
    return { client: createAdminSupabaseClient(), scope: { viewerId, gymId, kind: "publication" as const }, current: () => active.current && epoch.current === version };
  }
  useEffect(() => {
    active.current = true; epoch.current++;
    const ctx = context();
    setRecoveryReady(false);
    void loadPending(ctx).then(entry => {
      if (!ctx.current()) return;
      setPending(entry);
      if (entry) {
        setPublication("unconfirmed");
        if (entry.payload) {
          const saved = entry.payload as PublicationPayload;
          const restored = previewClassSeries(saved.draft);
          setDraft(saved.draft); setGroups(groupsFromDraft(saved.draft)); setPreview(restored);
          setCapacity(saved.capacity); setDescription(saved.description);
        } else { setPreview(null); setDraft(initialDraft()); setGroups(groupsFromDraft(initialDraft())); setDescription(""); }
      }
      setRecoveryReady(true);
    }).catch(() => { if (ctx.current()) setError("Pending publication recovery is blocked. Verify your account and ask an operator to check this tab's recovery record before creating another series."); });
    return () => { active.current = false; epoch.current++; importRevision.current++; };
  }, [viewerId, gymId, recoveryRevision]);
  useEffect(() => {
    if (!pending?.payload) return;
    const timer = setTimeout(() => { setPending(entry => entry ? { ...entry, payload: null } : null); setPreview(null); setDescription(""); setDraft(initialDraft()); setGroups(groupsFromDraft(initialDraft())); setRecoveryRevision(v => v + 1); }, Math.max(1, pending.createdAt + PENDING_TTL - Date.now()));
    return () => clearTimeout(timer);
  }, [pending]);

  async function resolvePending(discard: boolean) {
    if (!pending || posting.current) return;
    if (discard && !window.confirm(`Discard recovery for publication ${pending.requestId}? This does NOT undo a publication. Verify its outcome with an operator first; publishing again may duplicate classes.`)) return;
    const ctx = context(); posting.current = true;
    try {
      if (discard) await clearPending(ctx, pending);
      else if (!await reconcilePending(ctx, pending)) throw new Error(`No authoritative publication receipt found for ${pending.requestId}. Keep this blocked and ask an operator to verify the outcome before explicitly discarding.`);
      if (!ctx.current()) return;
      setPending(null); setPublication(discard || !preview ? "idle" : "published");
      if (discard) { const fresh = initialDraft(); setDraft(fresh); setGroups(groupsFromDraft(fresh)); setPreview(null); setCapacity(12); setDescription(""); }
      setNotice(discard ? "Recovery explicitly discarded. No published classes were removed." : "Previous publication confirmed."); setError(null);
      if (!discard) setPublishedRevision(v => v + 1);
    } catch (cause) { if (ctx.current()) setError(cause instanceof Error ? cause.message : "Recovery could not be verified."); }
    finally { posting.current = false; }
  }

  async function publish() {
    if (!recoveryReady || !preview || posting.current || publication === "published" || counts?.invalid_time || !counts?.planned) return;
    if (!pending && !window.confirm(`Publish ${counts.planned} ${preview.draft.title} classes in ${preview.draft.timeZone}, capacity ${capacity} each?\n\n${PENDING_NOTICE}`)) return;
    const ctx = context();
    posting.current = true; setPublication("publishing"); setError(null); setNotice(null);
    try {
      const entry = pending ? await loadPending(ctx) : await savePending(ctx, { draft: preview.draft, capacity, description });
      if (!ctx.current()) return;
      setPending(entry);
      if (!entry?.payload) { setPreview(null); setDescription(""); setDraft(initialDraft()); setGroups(groupsFromDraft(initialDraft())); throw new ClassSeriesUnconfirmedError("Publication content expired. Verify the stored identifier with an operator; do not publish another copy."); }
      const saved = entry.payload as PublicationPayload;
      const restored = previewClassSeries(saved.draft);
      const result = await publishClassSeries(ctx.client, { viewerId, gymId, ...saved, occurrences: restored.occurrences });
      await clearPending(ctx, entry);
      if (!ctx.current()) return;
      setPending(null);
      setPublication("published"); setPublishedRevision(value => value + 1);
      setNotice(`${result.count} classes published${result.replayed ? " (previous publication confirmed)" : ""}.`);
    } catch (cause) {
      if (!ctx.current()) return;
      // Even a rejected replay cannot prove the earlier dispatch did not commit.
      setPublication("unconfirmed");
      setError(cause instanceof Error ? cause.message : "Publication could not be confirmed.");
    } finally { posting.current = false; }
  }

  function change(next: ClassSeriesDraft) {
    if (locked) return;
    importRevision.current++;
    setImporting(false);
    setDraft(next);
    setPreview(null);
    setError(null);
    setNotice(null);
    setPage(0);
  }

  function changeGroups(next: WeeklyGroup[]) {
    if (locked) return;
    setGroups(next);
    change({ ...draft, slots: next.flatMap(group => group.days.map(weekday => ({ id: group.slotIds[weekday] || `${group.id}-${weekday}`,
      weekday, startTime: group.startTime, endTime: group.endTime }))) });
  }

  function buildPreview() {
    if (locked) return;
    try {
      const identified = {
        ...draft, id: draft.id || crypto.randomUUID(),
        slots: draft.slots.map((slot) => ({ ...slot, id: slot.id || crypto.randomUUID() }))
      };
      const result = previewClassSeries(identified);
      setDraft(result.draft);
      setGroups(groupsFromDraft(result.draft));
      setPreview(result);
      setPage(0);
      setError(null);
      setNotice(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to preview series."); }
  }

  function downloadDraft() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(preview.draft, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "class-series-draft.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Draft downloaded. No classes published or messages queued.");
  }

  async function importDraft(file: File) {
    if (locked) return;
    const revision = ++importRevision.current;
    setImporting(true);
    setError(null);
    try {
      if (file.size > 65536) throw new Error("Draft file must be at most 64 KB.");
      const imported = parseClassSeriesDraft(await file.text());
      const result = previewClassSeries(imported);
      if (revision !== importRevision.current) return;
      setDraft(imported);
      setGroups(groupsFromDraft(imported));
      setPreview(result);
      setPage(0);
      setHoliday("");
      setHolidayEnd("");
      setNotice("Draft loaded. Not published.");
    } catch (cause) {
      if (revision === importRevision.current) setError(cause instanceof Error ? cause.message : "Unable to load draft.");
    } finally {
      if (revision === importRevision.current) setImporting(false);
    }
  }

  const counts = preview?.occurrences.reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }), { planned: 0, excluded: 0, invalid_time: 0 });
  const pageCount = Math.ceil((preview?.occurrences.length ?? 0) / 25);

  return (
    <div className="space-y-6">
      <Link href="/classes" className="inline-block text-sm text-muted-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-kruxt-accent">Back to classes</Link>
      <PageHeader title="Class series" description={publication === "published" ? "Published" : publication === "unconfirmed" ? "Publication unconfirmed" : "Schedule draft"} actions={<button type="button" disabled={importing || locked} onClick={() => fileInput.current?.click()} className={BUTTON}>{importing ? "Loading draft..." : "Load draft"}</button>} />
      <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Load series JSON draft" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void importDraft(file);
        event.target.value = "";
      }} />
      {error && <p role="alert" className="break-words text-sm text-kruxt-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {!recoveryReady && <p role="status">Checking tab-local publication recovery...</p>}
      {pending && <div className="space-y-2 border-b border-border pb-4">
        <p className="break-words text-sm">Unconfirmed publication: {pending.requestId}. {pending.payload ? "Its unencrypted content expires after 24 hours and is removed by periodic cleanup or when the app resumes." : "Request content expired; only its identifier remains. Ask an operator to verify the outcome."}</p>
        <button type="button" className={BUTTON} disabled={publication === "publishing"} onClick={() => void resolvePending(false)}>Verify previous publication</button>
        <button type="button" className={BUTTON} disabled={publication === "publishing"} onClick={() => void resolvePending(true)}>Explicitly discard recovery</button>
      </div>}

      <form onSubmit={(event) => { event.preventDefault(); buildPreview(); }} className="space-y-6">
        <fieldset disabled={locked || importing} className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Class name<input required maxLength={120} className={INPUT} value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} /></label>
          <label className="space-y-1 text-sm">Time zone<input required list="series-time-zones" className={INPUT} value={draft.timeZone} onChange={(event) => change({ ...draft, timeZone: event.target.value })} /></label>
          <datalist id="series-time-zones">{["Europe/Rome", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist>
          <label className="space-y-1 text-sm">First date<input required type="date" min="2000-01-01" max="2099-12-31" className={INPUT} value={draft.startDate} onChange={(event) => change({ ...draft, startDate: event.target.value })} /></label>
          <label className="space-y-1 text-sm">Last date (inclusive)<input required type="date" min={draft.startDate} max="2099-12-31" className={INPUT} value={draft.endDate} onChange={(event) => change({ ...draft, endDate: event.target.value })} /></label>
        </div>

        <fieldset className="min-w-0 border-t border-border pt-4">
          <legend className="pr-3 text-sm font-semibold">Weekly time bands</legend>
          <div className="space-y-4">
            {groups.map((group, index) => (
              <div key={group.id} className="min-w-0 space-y-3 border-b border-border pb-4">
                <fieldset className="min-w-0"><legend className="mb-2 text-xs text-muted-foreground">Days for time band {index+1}</legend>
                  <div className="grid grid-cols-4 gap-x-3 gap-y-2 sm:grid-cols-7">
                    {DAYS.map((day, i)=><label key={day} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" aria-label={`${day} for time band ${index+1}`} checked={group.days.includes(i+1)} onChange={event=>changeGroups(groups.map(row=>row.id!==group.id?row:{...row,days:event.target.checked?[...row.days,i+1].sort((a,b)=>a-b):row.days.filter(value=>value!==i+1)}))}/><span title={day}>{day.slice(0,3)}</span></label>)}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="space-y-1 text-xs text-muted-foreground">Starts<input type="time" required aria-label={`Starts for time band ${index+1}`} className={INPUT} value={group.startTime} onChange={event=>changeGroups(groups.map(row=>row.id===group.id?{...row,startTime:event.target.value}:row))}/></label>
                  <label className="space-y-1 text-xs text-muted-foreground">Ends<input type="time" required aria-label={`Ends for time band ${index+1}`} className={INPUT} value={group.endTime} onChange={event=>changeGroups(groups.map(row=>row.id===group.id?{...row,endTime:event.target.value}:row))}/></label>
                  <button type="button" className={BUTTON} disabled={groups.length===1} aria-label={`Remove time band ${index+1}`} onClick={()=>changeGroups(groups.filter(row=>row.id!==group.id))}>Remove</button>
                </div>
              </div>
            ))}
            <button type="button" className={BUTTON} disabled={groups.length>=4 || draft.slots.length>=28} onClick={()=>changeGroups([...groups,{id:crypto.randomUUID(),days:[],startTime:"20:00",endTime:"21:00",slotIds:{}}])}>Add time band</button>
          </div>
        </fieldset>

        <fieldset className="min-w-0 border-t border-border pt-4">
          <legend className="pr-3 text-sm font-semibold">Holiday exclusions</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">Break starts<input type="date" min={draft.startDate} max={draft.endDate} className={INPUT} value={holiday} onChange={(event) => setHoliday(event.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Break ends<input type="date" min={holiday||draft.startDate} max={draft.endDate} className={INPUT} value={holidayEnd} onChange={event=>setHolidayEnd(event.target.value)} /></label>
            <button type="button" className={BUTTON} disabled={!holiday || draft.excludedDates.length >= 366} onClick={() => {
              try {
                const dates=expandClassBreak(holiday,holidayEnd||holiday);
                if(dates.some(date=>date<draft.startDate||date>draft.endDate))throw new Error("Break must be inside the series date range.");
                change({...draft,excludedDates:[...new Set([...draft.excludedDates,...dates])].sort()});
                setHoliday("");setHolidayEnd("");
              }catch(cause){setError(cause instanceof Error?cause.message:"Choose valid break dates.");}
            }}>Exclude break</button>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {draft.excludedDates.map((date) => <li key={date} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{date}</span><button type="button" className={BUTTON} aria-label={`Restore ${date}`} onClick={() => change({ ...draft, excludedDates: draft.excludedDates.filter((d) => d !== date) })}>Restore</button></li>)}
          </ul>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={importing} className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kruxt-accent disabled:opacity-50">Preview occurrences</button>
          <button type="button" disabled={!preview || importing} className={BUTTON} onClick={downloadDraft}>Download draft</button>
        </div>
        </fieldset>
      </form>

      {preview && counts && <section className="min-w-0 space-y-3 border-t border-border pt-5" aria-label="Occurrence preview">
        <h2 className="text-base font-semibold">Occurrence preview</h2>
        <p role="status" className="text-sm text-muted-foreground">{counts.planned} planned · {counts.excluded} excluded · {counts.invalid_time} invalid times · {preview.draft.timeZone}</p>
        {counts.invalid_time > 0 && <p role="alert" className="text-sm text-kruxt-danger">Resolve invalid times or exclude the affected dates.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border"><th scope="col" className="py-2 pr-4">Date</th><th scope="col" className="px-3 py-2">Local time</th><th scope="col" className="px-3 py-2">UTC start</th><th scope="col" className="px-3 py-2">Status</th></tr></thead>
            <tbody>{preview.occurrences.slice(page * 25, (page + 1) * 25).map((row) => <tr key={row.key} className="border-b border-border align-top">
              <th scope="row" className="whitespace-nowrap py-3 pr-4 font-normal">{row.date}</th>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{row.startTime} - {row.endTime}</td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{row.startsAt?.replace("T", " ").replace(":00.000Z", "Z") ?? "-"}</td>
              <td className="min-w-40 px-3 py-3"><span className={row.status === "invalid_time" ? "text-kruxt-danger" : "text-muted-foreground"}>{row.status === "invalid_time" ? "Invalid time" : row.status === "excluded" ? "Excluded" : "Planned"}</span>{row.issue && <p className="mt-1 max-w-sm text-xs text-kruxt-danger">{row.issue}</p>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</p>
          <div className="flex gap-2"><button type="button" className={BUTTON} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className={BUTTON} disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      </section>}
      {preview && <section aria-labelledby="series-publication" className="min-w-0 space-y-4 border-t border-border pt-5">
        <h2 id="series-publication" className="text-base font-semibold">Publish series</h2>
        <fieldset disabled={locked} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">Capacity per occurrence<input className={INPUT} type="number" min={1} max={10000} step={1} value={capacity} onChange={event => setCapacity(Number(event.target.value))} /></label>
          <label className="block space-y-1 text-sm">Class description<textarea className={INPUT} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        </fieldset>
        <p className="text-xs text-muted-foreground">Before dispatch, the full request is saved unencrypted in this tab. Content expires after 24 hours and is removed by periodic cleanup or when the app resumes. An unresolved identifier remains until verified or explicitly discarded. Browsers may restore tab storage after closing; closing a tab does not guarantee erasure.</p>
        <button type="button" className={BUTTON} disabled={!recoveryReady || publication === "publishing" || publication === "published" || importing || !counts?.planned || !!counts?.invalid_time || !Number.isInteger(capacity) || capacity<1 || capacity>10000} onClick={() => void publish()}>
          {publication === "publishing" ? "Publishing..." : publication === "unconfirmed" ? "Retry unchanged publication" : "Review and publish classes"}
        </button>
        {publication === "published" && <button type="button" className={BUTTON} onClick={() => { setDraft({ ...draft, id: "", title: "" }); setPreview(null); setPublication("idle"); setNotice(null); }}>Create another series</button>}
      </section>}
      <ClassSeriesManager key={`${viewerId}:${gymId}`} gymId={gymId} viewerId={viewerId} revision={publishedRevision} />
    </div>
  );
}
