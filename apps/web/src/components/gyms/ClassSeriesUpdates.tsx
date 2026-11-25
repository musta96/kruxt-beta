"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClassSeriesUpdates, subscribeToClassSeries } from "@/lib/public/class-series-updates";

export function ClassSeriesUpdates({ client, viewerId, gymId }: { client: SupabaseClient; viewerId: string; gymId: string }) {
  const [snapshot,setSnapshot]=useState<Awaited<ReturnType<typeof loadClassSeriesUpdates>>|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const mounted=useRef(false);
  const inFlight=useRef(false);
  useEffect(()=>{
    let active=true; mounted.current=true; setSnapshot(null); setError(null);
    void loadClassSeriesUpdates(client,viewerId,gymId).then(data=>{if(active)setSnapshot(data);})
      .catch(()=>{if(active)setError("Class updates unavailable. Retry after checking your gym access.");});
    return()=>{active=false;mounted.current=false;};
  },[client,viewerId,gymId,revision]);
  async function change(seriesId:string,subscribed:boolean){
    if(inFlight.current)return;
    inFlight.current=true;setBusy(seriesId);setError(null);setNotice(null);
    try{
      await subscribeToClassSeries(client,viewerId,seriesId,subscribed);
      if(!mounted.current)return;
      setNotice(subscribed?"Subscribed to series updates. Class booking is separate.":"Unsubscribed from future series updates.");
      setRevision(value=>value+1);
    }catch{if(mounted.current){setSnapshot(null);setError("Subscription could not be confirmed. Reload updates before trying again.");}}
    finally{inFlight.current=false;if(mounted.current)setBusy(null);}
  }
  return <section className="section-stack" style={{ minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", overflowWrap: "anywhere" }} aria-labelledby="class-series-updates">
    <div className="profile-form-header"><h2 id="class-series-updates" className="section-title">Class updates</h2>
      <button type="button" className="ghost-chip" disabled={!!busy} onClick={()=>setRevision(value=>value+1)}>Reload updates</button></div>
    {error&&<p role="alert" className="status-banner status-danger">{error}</p>}
    {notice&&<p role="status" className="status-banner status-success">{notice}</p>}
    {busy&&<p role="status" className="feed-body">Updating subscription...</p>}
    {!snapshot&&!error&&<p role="status" className="feed-body">Loading class updates...</p>}
    {snapshot&&<>
      <ul className="divide-y divide-white/10">{snapshot.series.map(series=>{
        const subscribed=snapshot.subscriptions.includes(series.id);
        return <li key={series.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="min-w-0 break-words text-sm">{series.title}</span>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!!busy} checked={subscribed} onChange={event=>void change(series.id,event.target.checked)}/><span>Updates for {series.title}</span></label>
        </li>;
      })}</ul>
      {!snapshot.series.length&&<p className="feed-body">No class series available.</p>}
      <h3 className="text-base font-semibold">In-app announcements</h3>
      {!snapshot.announcements.length&&<p className="feed-body">No announcements for your account.</p>}
      <ul className="divide-y divide-white/10">{snapshot.announcements.map(item=><li key={item.id} className="min-w-0 space-y-1 py-4">
        <p className="text-sm font-semibold">{snapshot.series.find(series=>series.id===item.series_id)?.title??"Class update"}{item.audience==="occurrence_attendees"?" / One occurrence":" / Series"}</p>
        {item.occurrence_starts_at&&<p className="text-sm">{new Date(item.occurrence_starts_at).toLocaleString(undefined,{timeZone:item.time_zone})} ({item.time_zone})</p>}
        <time className="feed-meta" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
        <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
      </li>)}</ul>
      <p className="feed-meta">Latest 20 announcements. Update subscriptions do not reserve a place.</p>
    </>}
  </section>;
}
