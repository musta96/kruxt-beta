"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadFeedConnections,
  mutateFeedConnection,
  type FeedConnectionAction,
  type FeedConnectionsSnapshot
} from "@/lib/public/feed-connections";

interface FeedConnectionsProps {
  client: SupabaseClient;
  onChange: () => void;
}

interface ViewState {
  client: SupabaseClient;
  snapshot: FeedConnectionsSnapshot | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
}

const rowStyle = { display: "flex", flexWrap: "wrap" as const };
const labelStyle = { flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" as const };
const listStyle = { paddingLeft: 0, listStyle: "none" };

export function FeedConnections({ client, onChange }: FeedConnectionsProps) {
  const [view, setView] = useState<ViewState>({ client, snapshot: null, loading: true, error: null, busy: false });
  const controller = useRef<{
    client: SupabaseClient;
    load: () => Promise<void>;
    mutate: (action: FeedConnectionAction, id: string) => Promise<void>;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let active = true;
    let generation = 0;
    let identity: string | null | undefined;
    let snapshot: FeedConnectionsSnapshot | null = null;
    let mutation: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clear(loading: boolean) {
      generation++;
      snapshot = null;
      mutation = null;
      setView({ client, snapshot: null, loading, error: null, busy: false });
    }

    async function load() {
      if (!active || mutation !== null) return;
      const token = ++generation;
      snapshot = null;
      setView({ client, snapshot: null, loading: true, error: null, busy: false });
      try {
        const result = await loadFeedConnections(client);
        if (!active || token !== generation || (identity !== undefined && identity !== result.viewerId)) return;
        identity = result.viewerId;
        snapshot = result;
        setView({ client, snapshot: result, loading: false, error: null, busy: false });
      } catch {
        if (!active || token !== generation) return;
        setView({ client, snapshot: null, loading: false, error: "Connections could not be loaded. Retry.", busy: false });
      }
    }

    async function mutate(action: FeedConnectionAction, id: string) {
      if (!active || mutation !== null || !snapshot) return;
      const viewerId = snapshot.viewerId;
      const token = ++generation;
      mutation = token;
      setView((current) => ({ ...current, busy: true, error: null }));
      try {
        await mutateFeedConnection(client, viewerId, action, id);
        if (!active || token !== generation) return;
        mutation = null;
        // Notify only after the database returns the scoped changed row.
        onChangeRef.current();
        await load();
      } catch {
        if (!active || token !== generation) return;
        mutation = null;
        snapshot = null;
        setView({ client, snapshot: null, loading: false, error: "Connection change was not confirmed. Reload connections before retrying.", busy: false });
      }
    }

    controller.current = { client, load, mutate };
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextIdentity = session?.user.id ?? null;
      if (identity === nextIdentity) return;
      identity = nextIdentity;
      clearTimeout(timer);
      clear(nextIdentity !== null);
      // Keep database/auth requests outside Supabase's auth callback lock.
      if (nextIdentity !== null) timer = setTimeout(() => void load(), 0);
    });
    void load();
    return () => {
      active = false;
      generation++;
      clearTimeout(timer);
      data.subscription.unsubscribe();
      if (controller.current?.client === client) controller.current = null;
    };
  }, [client]);

  const current = view.client === client ? view : null;
  const snapshot = current?.snapshot;
  const disabled = !current || current.loading || current.busy;
  const act = (action: FeedConnectionAction, id: string) => {
    if (controller.current?.client === client) void controller.current.mutate(action, id);
  };

  return (
    <details className="glass-panel">
      <summary className="section-title">Connections</summary>
      {current?.loading || !current ? <p role="status">Loading connections...</p> : null}
      {current?.error ? (
        <div className="status-banner status-danger" role="alert">
          <p>{current.error}</p>
          <button type="button" className="secondary-cta" disabled={disabled} onClick={() => {
            if (controller.current?.client === client) void controller.current.load();
          }}>Retry</button>
        </div>
      ) : null}
      {current?.busy ? <p role="status">Updating connection...</p> : null}
      {snapshot ? (
        <>
          <h3 className="log-block-title">Incoming requests</h3>
          {snapshot.incoming.length === 0 ? <p className="supporting-copy">No pending requests.</p> : (
            <ul className="rank-list" style={listStyle}>
              {snapshot.incoming.map((item) => (
                <li key={item.id} className="rank-row" style={rowStyle}>
                  <span className="rank-row-body" style={labelStyle}>{item.label}</span>
                  <button type="button" className="secondary-cta" disabled={disabled} onClick={() => act("accept", item.id)} aria-label={`Accept request from ${item.label}`}>Accept</button>
                  <button type="button" className="secondary-cta" disabled={disabled} onClick={() => act("decline", item.id)} aria-label={`Decline request from ${item.label}`}>Decline</button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="log-block-title">Following and sent requests</h3>
          {snapshot.outgoing.length === 0 ? <p className="supporting-copy">No following or sent requests.</p> : (
            <ul className="rank-list" style={listStyle}>
              {snapshot.outgoing.map((item) => (
                <li key={item.id} className="rank-row" style={rowStyle}>
                  <span className="rank-row-body" style={labelStyle}>{item.label} <span className="supporting-copy">{item.status === "pending" ? "Pending" : "Following"}</span></span>
                  <button type="button" className="secondary-cta" disabled={disabled} onClick={() => act("remove", item.id)} aria-label={`${item.status === "pending" ? "Cancel request to" : "Unfollow"} ${item.label}`}>
                    {item.status === "pending" ? "Cancel" : "Unfollow"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="log-block-title">Blocked members</h3>
          {snapshot.blocked.length === 0 ? <p className="supporting-copy">No blocked members.</p> : (
            <ul className="rank-list" style={listStyle}>
              {snapshot.blocked.map((item) => (
                <li key={item.userId} className="rank-row" style={rowStyle}>
                  <span className="rank-row-body" style={labelStyle}>{item.label}</span>
                  <button type="button" className="secondary-cta" disabled={disabled} onClick={() => act("unblock", item.userId)} aria-label={`Unblock ${item.label}`}>Unblock</button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </details>
  );
}
