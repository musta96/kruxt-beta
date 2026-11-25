"use client";

import { useEffect, useRef, useState } from "react";
import { createAdminSupabaseClient } from "@/services/supabase-client";
import { announceClassSeries, ClassSeriesUnconfirmedError, loadPublishedClassSeries,
  type ClassAnnouncementInput, type PublishedClassSeries, type PublishedOccurrence } from "@/services/class-series-publishing";
import { clearPending, loadPending, savePending, reconcilePending, PENDING_NOTICE, PENDING_TTL,
  type PendingRequest } from "@/services/class-series-pending";

const input = "min-h-10 w-full min-w-0 rounded-md border border-border bg-kruxt-panel px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kruxt-accent";
const button = "min-h-10 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-kruxt-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kruxt-accent disabled:opacity-50";

export function ClassSeriesManager({ gymId, viewerId, revision }: { gymId: string; viewerId: string; revision: number }) {
  const [series, setSeries] = useState<PublishedClassSeries[]>([]);
  const [occurrences, setOccurrences] = useState<PublishedOccurrence[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [classId, setClassId] = useState("");
  const [audience, setAudience] = useState<ClassAnnouncementInput["audience"]>("series_subscribers");
  const [body, setBody] = useState("");
  const [cancelOccurrence, setCancelOccurrence] = useState(false);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  function context() {
    const version = epoch.current;
    return { client: createAdminSupabaseClient(), scope: { viewerId, gymId, kind: "announcement" as const }, current: () => epoch.current === version };
  }
  useEffect(() => {
    epoch.current++;
    const ctx = context(); setRecoveryReady(false); setBusy(false);
    void loadPending(ctx).then(entry => {
      if (!ctx.current()) return;
      setPending(entry);
      if (entry?.payload) {
        const saved = entry.payload as ClassAnnouncementInput;
        setSeriesId(saved.seriesId); setClassId(saved.classId ?? ""); setAudience(saved.audience); setBody(saved.body); setCancelOccurrence(saved.cancelOccurrence);
      } else if (entry) { setBody(""); setClassId(""); setCancelOccurrence(false); }
      setRecoveryReady(true);
    }).catch(() => { if (ctx.current()) setError("Pending announcement recovery is blocked. Verify your account and ask an operator to inspect this tab's recovery record."); });
    return () => { epoch.current++; };
  }, [viewerId, gymId, recoveryRevision]);
  useEffect(() => {
    if (!pending?.payload) return;
    const timer = setTimeout(() => { setPending(entry => entry ? { ...entry, payload: null } : null); setBody(""); setRecoveryRevision(v => v + 1); }, Math.max(1, pending.createdAt + PENDING_TTL - Date.now()));
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void loadPublishedClassSeries(createAdminSupabaseClient(), viewerId, gymId).then(data => {
      if (active) { setSeries(data.series); setOccurrences(data.occurrences); }
    }).catch(() => { if (active) setError("Published series could not be loaded. Retry after verifying this environment supports recurring classes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [gymId, viewerId, revision, refresh]);
  async function post(request: ClassAnnouncementInput) {
    if (inFlight.current || !recoveryReady) return;
    const ctx = context();
    inFlight.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const entry = pending ? await loadPending(ctx) : await savePending(ctx, request);
      if (!ctx.current()) return;
      setPending(entry);
      if (!entry?.payload) { setBody(""); throw new ClassSeriesUnconfirmedError("Announcement content expired. Verify the stored request identifier with an operator before creating another announcement."); }
      const result = await announceClassSeries(ctx.client, viewerId, gymId, entry.payload as ClassAnnouncementInput);
      await clearPending(ctx, entry);
      if (!ctx.current()) return;
      setPending(null); setBody(""); setCancelOccurrence(false); setClassId("");
      setNotice(`Posted to ${result.recipientCount} in-app inboxes${result.replayed ? " (previous request confirmed)" : ""}. No email or push was sent.`);
      setRefresh(value => value + 1);
    } catch (cause) {
      if (!ctx.current()) return;
      setError(cause instanceof Error ? cause.message : "Announcement could not be confirmed.");
    } finally { inFlight.current = false; if (ctx.current()) setBusy(false); }
  }
  async function resolvePending(discard: boolean) {
    if (!pending || inFlight.current) return;
    if (discard && !window.confirm(`Discard recovery for announcement ${pending.requestId}? This does NOT retract a posted announcement or undo cancellation. Verify its outcome with an operator first; posting again may duplicate it.`)) return;
    const ctx = context(); inFlight.current = true; setBusy(true);
    try {
      if (discard) await clearPending(ctx, pending);
      else if (!await reconcilePending(ctx, pending)) throw new Error(`No authoritative announcement found for request ${pending.requestId}. Keep recovery blocked and ask an operator to verify before explicitly discarding.`);
      if (!ctx.current()) return;
      setPending(null); setBody(""); setClassId(""); setCancelOccurrence(false); setError(null);
      setNotice(discard ? "Recovery explicitly discarded. No announcement or cancellation was undone." : "Previous announcement confirmed.");
      setRefresh(v => v + 1);
    } catch (cause) { if (ctx.current()) setError(cause instanceof Error ? cause.message : "Recovery could not be verified."); }
    finally { inFlight.current = false; if (ctx.current()) setBusy(false); }
  }
  const selected = series.find(row => row.id === seriesId);
  const rows = occurrences.filter(row => row.series_id === seriesId && row.status === "scheduled");
  const selectedOccurrence = rows.find(row => row.id === classId);
  const format = (date: string) => new Date(date).toLocaleString(undefined, { timeZone: selected?.time_zone, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return <section aria-labelledby="series-communications" className="min-w-0 space-y-4 border-t border-border pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="series-communications" className="text-lg font-semibold">Published series and announcements</h2>
      <button type="button" className={button} disabled={loading || busy} onClick={() => setRefresh(value => value + 1)}>Reload series</button>
    </div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading published series...</p>}
    {error && <p role="alert" className="break-words text-sm text-kruxt-danger">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!recoveryReady && <p role="status">Checking tab-local announcement recovery...</p>}
    {pending && <div className="space-y-2">
      <p className="break-words text-sm">Unconfirmed announcement request: {pending.requestId}. {pending.payload ? "Its unencrypted private text expires after 24 hours and is removed by periodic cleanup or when the app resumes." : "Content expired; only its identifier remains. Ask an operator to verify its outcome."}</p>
      {pending.payload && <button type="button" className={button} disabled={busy || !recoveryReady} onClick={() => void post(pending.payload as ClassAnnouncementInput)}>Retry unchanged announcement</button>}
      <button type="button" className={button} disabled={busy || !recoveryReady} onClick={() => void resolvePending(false)}>Verify previous announcement</button>
      <button type="button" className={button} disabled={busy || !recoveryReady} onClick={() => void resolvePending(true)}>Explicitly discard recovery</button>
    </div>}
    {!loading && !series.length && !error && <p className="text-sm text-muted-foreground">No published series.</p>}
    {series.length > 0 && <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (!recoveryReady || !selected || !body.trim() || busy || pending || (audience === "occurrence_attendees" && !selectedOccurrence)) return;
      if (!window.confirm(`${cancelOccurrence ? "Cancel this occurrence and post" : "Post"} an in-app announcement for ${selected.title} to ${audience === "series_subscribers" ? "active series subscribers" : "this occurrence's active booked and waitlisted members"}?\n\n${PENDING_NOTICE}`)) return;
      void post({ seriesId, audience, body, requestId: crypto.randomUUID(), classId: audience === "occurrence_attendees" ? classId : null, cancelOccurrence: audience === "occurrence_attendees" && cancelOccurrence });
    }}>
      <fieldset disabled={!recoveryReady || busy || !!pending || loading} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm">Published series
          <select className={input} value={seriesId} onChange={event => { setSeriesId(event.target.value); setClassId(""); setNotice(null); }}>
            <option value="">Choose series</option>{series.map(row => <option key={row.id} value={row.id}>{row.title} ({row.time_zone})</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-sm">Audience
          <select className={input} value={audience} onChange={event => { setAudience(event.target.value as ClassAnnouncementInput["audience"]); setCancelOccurrence(false); }}>
            <option value="series_subscribers">Series subscribers</option><option value="occurrence_attendees">One occurrence: booked and waitlisted members</option>
          </select>
        </label>
        {audience === "occurrence_attendees" && <>
          <label className="block space-y-1 text-sm">Occurrence
            <select className={input} value={classId} onChange={event => setClassId(event.target.value)}>
              <option value="">Choose occurrence</option>{rows.map(row => <option key={row.id} value={row.id}>{format(row.starts_at)} - {format(row.ends_at)}</option>)}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={cancelOccurrence} onChange={event => setCancelOccurrence(event.target.checked)} /><span>Cancel this occurrence and its bookings with this announcement</span></label>
        </>}
        <label className="block space-y-1 text-sm">Announcement<textarea className={input+" min-h-28"} maxLength={2000} required value={body} onChange={event => setBody(event.target.value)} /></label>
        <p className="text-xs text-muted-foreground">In-app inbox only. Active gym members in the selected audience receive the announcement. No email or push delivery.</p>
        <p className="text-xs text-muted-foreground">Before dispatch, the full request, including private text, is saved unencrypted in this tab. Content expires after 24 hours and is removed by periodic cleanup or when the app resumes. Unresolved identifiers remain until verified or explicitly discarded. Browsers may restore tab storage after closing; closing a tab does not guarantee erasure.</p>
        <button type="submit" className={button} disabled={!seriesId || !body.trim() || (audience === "occurrence_attendees" && !selectedOccurrence)}>{busy ? "Posting..." : "Review and post announcement"}</button>
      </fieldset>
    </form>}
    {series.length > 0 && <p className="text-xs text-muted-foreground">Latest 200 series and next 500 series occurrences.</p>}
  </section>;
}
