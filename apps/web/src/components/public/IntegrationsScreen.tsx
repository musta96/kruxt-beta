"use client";

import { useEffect, useState } from "react";
import type { IntegrationProvider } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  connectIntegrationProvider,
  disconnectIntegrationProvider,
  loadIntegrationsSnapshot,
  queueIntegrationSync,
  type IntegrationsSnapshot,
  type ProviderState
} from "@/lib/public/integrations";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function providerStatus(provider: ProviderState): string {
  if (!provider.connection) return "Not connected";
  if (provider.connection.status === "active") return "Active";
  return provider.connection.status;
}

export function IntegrationsScreen() {
  const { state, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<IntegrationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadIntegrationsSnapshot(supabase);
        if (active) setSnapshot(nextSnapshot);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load integrations.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  async function handleConnect(provider: IntegrationProvider) {
    setPendingProvider(provider);
    setError(null);
    setSuccess(null);
    try {
      const nextSnapshot = await connectIntegrationProvider(supabase, provider);
      setSnapshot(nextSnapshot);
      setSuccess("Provider connected and initial sync queued.");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Unable to connect provider.");
    } finally {
      setPendingProvider(null);
    }
  }

  async function handleDisconnect(provider: IntegrationProvider) {
    setPendingProvider(provider);
    setError(null);
    setSuccess(null);
    try {
      const nextSnapshot = await disconnectIntegrationProvider(supabase, provider);
      setSnapshot(nextSnapshot);
      setSuccess("Provider disconnected.");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Unable to disconnect provider.");
    } finally {
      setPendingProvider(null);
    }
  }

  async function handleQueueSync(connectionId: string) {
    setPendingConnection(connectionId);
    setError(null);
    setSuccess(null);
    try {
      const nextSnapshot = await queueIntegrationSync(supabase, connectionId);
      setSnapshot(nextSnapshot);
      setSuccess("Sync job queued.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to queue sync.");
    } finally {
      setPendingConnection(null);
    }
  }

  return (
    <MemberShell
      title="Integrations"
      subtitle="Apple Health and Garmin runtime connectors for importing activity into proof, rank, and plan adherence."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      {loading ? (
        <section className="feed-card">
          <p className="feed-body">Loading integrations...</p>
        </section>
      ) : (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">PHASE 6 RUNTIME</p>
              <h2 className="section-title">Device data is now a first-class training input.</h2>
              <p className="section-copy">
                Active providers can queue pull jobs, map imported activities to workouts, and feed plan adherence
                without turning integrations into a separate product silo.
              </p>
            </div>
            <div className="hero-stats">
              <div className="metric-card">
                <span className="metric-label">Connected</span>
                <strong className="metric-value">{snapshot?.activationReport.connectedProviders.length ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Queued/running</span>
                <strong className="metric-value">{snapshot?.activationReport.queuedOrRunningSyncJobCount ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Mapping</span>
                <strong className="metric-value-sm">
                  {Math.round((snapshot?.activationReport.mappingCoverage ?? 1) * 100)}% covered
                </strong>
              </div>
            </div>
          </section>

          <section className="split-card">
            {(snapshot?.providerStates ?? []).map((provider) => (
              <article key={provider.provider} className="glass-panel">
                <div className="profile-form-header">
                  <div>
                    <p className="eyebrow">{provider.label}</p>
                    <h2 className="section-title">{providerStatus(provider)}</h2>
                  </div>
                  <span className={`ghost-chip ${provider.connection?.status === "active" ? "is-selected" : ""}`}>
                    {provider.importsTotal} imports
                  </span>
                </div>
                <p className="section-copy">{provider.copy}</p>
                <dl className="data-list">
                  <div>
                    <dt>Last sync</dt>
                    <dd>{formatDateTime(provider.connection?.lastSyncedAt ?? provider.cursor?.lastSyncedAt)}</dd>
                  </div>
                  <div>
                    <dt>Latest job</dt>
                    <dd>{provider.latestSyncJob?.status ?? "No jobs yet"}</dd>
                  </div>
                  <div>
                    <dt>Mapped / unmapped</dt>
                    <dd>
                      {provider.mappedImports} / {provider.unmappedImports}
                    </dd>
                  </div>
                  <div>
                    <dt>Last error</dt>
                    <dd>{provider.connection?.lastError ?? provider.cursor?.lastError ?? "None"}</dd>
                  </div>
                </dl>
                <div className="stack-actions">
                  {provider.connection?.status === "active" ? (
                    <>
                      <button
                        type="button"
                        className="primary-cta"
                        disabled={pendingConnection === provider.connection.id}
                        onClick={() => void handleQueueSync(provider.connection!.id)}
                      >
                        {pendingConnection === provider.connection.id ? "Queueing..." : "Queue sync"}
                      </button>
                      <button
                        type="button"
                        className="secondary-cta"
                        disabled={pendingProvider === provider.provider}
                        onClick={() => void handleDisconnect(provider.provider)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="primary-cta"
                      disabled={pendingProvider === provider.provider}
                      onClick={() => void handleConnect(provider.provider)}
                    >
                      {pendingProvider === provider.provider ? "Connecting..." : "Connect beta"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">IMPORTS</p>
                <h2 className="section-title">Recent activity imports</h2>
              </div>
              <span className="ghost-chip">
                {(snapshot?.hiddenUnsupportedImportCount ?? 0) > 0
                  ? `${snapshot?.hiddenUnsupportedImportCount} dark-launched hidden`
                  : "Apple Health + Garmin"}
              </span>
            </div>
            <div className="rank-list">
              {(snapshot?.imports ?? []).slice(0, 10).map((item) => (
                <div key={item.id} className="rank-row">
                  <div className="rank-row-body">
                    <strong>{item.activityType ?? "Activity"}</strong>
                    <p className="feed-body">
                      {item.provider} · imported {formatDateTime(item.importedAt)} ·{" "}
                      {item.mappedWorkoutId ? "mapped to workout" : "waiting for mapping"}
                    </p>
                  </div>
                  <span className="ghost-chip">{item.externalActivityId}</span>
                </div>
              ))}
              {(snapshot?.imports.length ?? 0) === 0 ? (
                <p className="feed-body">No imported activities yet. Connect a provider and queue a sync.</p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </MemberShell>
  );
}
