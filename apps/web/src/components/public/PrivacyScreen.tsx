"use client";

import { useEffect, useState } from "react";
import type { PrivacyRequest, PrivacyRequestType } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadPrivacySnapshot, submitPrivacyRequest, type PrivacySnapshot } from "@/lib/public/privacy";

const REQUEST_TYPES: Array<{ value: PrivacyRequestType; label: string; copy: string }> = [
  { value: "access", label: "Access", copy: "Receive a readable copy of your KRUXT data." },
  { value: "export", label: "Portability", copy: "Generate a machine-readable export." },
  { value: "rectify", label: "Rectification", copy: "Ask the team to correct inaccurate data." },
  { value: "restrict_processing", label: "Restriction", copy: "Limit processing while a request is reviewed." },
  { value: "delete", label: "Erasure", copy: "Request deletion where retention law allows it." }
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function requestLabel(request: PrivacyRequest): string {
  return REQUEST_TYPES.find((type) => type.value === request.requestType)?.label ?? request.requestType;
}

export function PrivacyScreen() {
  const { state, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<PrivacySnapshot | null>(null);
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadPrivacySnapshot(supabase);
        if (active) setSnapshot(nextSnapshot);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load privacy center.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const nextSnapshot = await submitPrivacyRequest(supabase, {
        requestType,
        reason
      });
      setSnapshot(nextSnapshot);
      setReason("");
      setSuccess("Privacy request submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit privacy request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MemberShell
      title="Privacy"
      subtitle="Consent gates, GDPR-style data requests, and export receipts from the Phase 8 runtime."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      {loading ? (
        <section className="feed-card">
          <p className="feed-body">Loading privacy center...</p>
        </section>
      ) : (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">CONSENT GATE</p>
              <h2 className="section-title">
                {snapshot?.hasRequiredConsents ? "Required consents are current." : "Consent review required."}
              </h2>
              <p className="section-copy">
                KRUXT checks terms, privacy, and health-data processing requirements before sensitive flows keep moving.
              </p>
              {(snapshot?.missingRequiredConsents.length ?? 0) > 0 ? (
                <ul className="checklist">
                  {snapshot?.missingRequiredConsents.map((gap) => (
                    <li key={`${gap.consentType}_${gap.reason}`}>
                      {gap.consentType} · {gap.reason}
                      {gap.requiredPolicyVersion ? ` · version ${gap.requiredPolicyVersion}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="hero-stats">
              <div className="metric-card">
                <span className="metric-label">Open</span>
                <strong className="metric-value">{snapshot?.openRequests.length ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Overdue</span>
                <strong className="metric-value">{snapshot?.overdueOpenCount ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Exports</span>
                <strong className="metric-value">{snapshot?.downloadableExports.length ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="split-card">
            <article className="glass-panel">
              <p className="eyebrow">NEW REQUEST</p>
              <h2 className="section-title">Submit a data request</h2>
              <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
                <label>
                  <span className="field-label">Request type</span>
                  <select
                    className="input"
                    value={requestType}
                    onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)}
                  >
                    {REQUEST_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="supporting-copy">{REQUEST_TYPES.find((type) => type.value === requestType)?.copy}</p>
                <label>
                  <span className="field-label">Reason or details</span>
                  <textarea
                    className="input profile-bio"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Optional context for the KRUXT or gym privacy team."
                  />
                </label>
                <button type="submit" className="primary-cta" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </form>
            </article>

            <article className="glass-panel">
              <p className="eyebrow">EXPORTS</p>
              <h2 className="section-title">Downloadable receipts</h2>
              <div className="rank-list">
                {(snapshot?.downloadableExports ?? []).map((request) => (
                  <div key={request.id} className="rank-row">
                    <div className="rank-row-body">
                      <strong>{requestLabel(request)}</strong>
                      <p className="feed-body">
                        Fulfilled {formatDate(request.resolvedAt)} · expires {formatDate(request.responseExpiresAt)}
                      </p>
                    </div>
                    {request.responseLocation ? (
                      <a href={request.responseLocation} className="secondary-cta">
                        Open
                      </a>
                    ) : null}
                  </div>
                ))}
                {(snapshot?.downloadableExports.length ?? 0) === 0 ? (
                  <p className="feed-body">No fulfilled exports are available yet.</p>
                ) : null}
              </div>
            </article>
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">TIMELINE</p>
                <h2 className="section-title">Recent privacy requests</h2>
              </div>
              <span className="ghost-chip">30-day SLA</span>
            </div>
            <div className="rank-list">
              {(snapshot?.recentRequests ?? []).map((request) => (
                <div key={request.id} className="rank-row">
                  <div className="rank-row-body">
                    <strong>{requestLabel(request)}</strong>
                    <p className="feed-body">
                      {request.status} · submitted {formatDate(request.submittedAt)} · due {formatDate(request.dueAt)}
                    </p>
                    {request.reason ? <p className="supporting-copy">{request.reason}</p> : null}
                  </div>
                  <span className={`ghost-chip ${request.slaBreachedAt ? "is-selected" : ""}`}>
                    {request.slaBreachedAt ? "Overdue" : request.status}
                  </span>
                </div>
              ))}
              {(snapshot?.recentRequests.length ?? 0) === 0 ? (
                <p className="feed-body">No privacy requests submitted yet.</p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </MemberShell>
  );
}
