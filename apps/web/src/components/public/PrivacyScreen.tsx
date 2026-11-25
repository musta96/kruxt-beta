"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Send, Download } from "lucide-react";
import type { PrivacyRequest, PrivacyRequestType } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import { loadPrivacySnapshot, submitPrivacyRequest, privacyErrorMessage, type PrivacySnapshot } from "@/lib/public/privacy";
import { canManagePrivacy } from "@/lib/auth/privacy-access";

const REQUEST_TYPES: Array<{ value: PrivacyRequestType; label: string; copy: string }> = [
  { value: "access", label: "Access to my data", copy: "Request a readable copy of your personal data." },
  { value: "export", label: "Data portability", copy: "Request your data in a machine-readable format." },
  { value: "rectify", label: "Rectification", copy: "Ask the team to correct inaccurate data." },
  { value: "restrict_processing", label: "Restriction", copy: "Limit processing while a request is reviewed." },
  { value: "delete", label: "Erasure", copy: "Request deletion where retention law allows it." }
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function requestLabel(request: PrivacyRequest): string {
  return REQUEST_TYPES.find((type) => type.value === request.requestType)?.label ?? request.requestType;
}

export function PrivacyScreen() {
  const session = usePublicSession();
  return <PrivacyCenter key={session.state.user?.id ?? "signed-out"} session={session} />;
}

function PrivacyCenter({ session }: { session: ReturnType<typeof usePublicSession> }) {
  const { state, supabase } = session;
  const [snapshot, setSnapshot] = useState<PrivacySnapshot | null>(null);
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "submit">("load");
  const [receipts, setReceipts] = useState<Array<{ id: string; type: PrivacyRequestType }>>([]);
  const receipt = receipts.at(-1);
  const eligible = canManagePrivacy(state);
  const userId = state.user?.id;
  const identity = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const submission = useRef(false);
  identity.current = eligible && userId ? userId : null;
  const invalidateLoad = useCallback(() => { loadGeneration.current++; identity.current = null; }, []);

  const load = useCallback(async () => {
    if (!eligible || !userId) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadPrivacySnapshot(supabase);
      if (generation === loadGeneration.current && identity.current === userId) setSnapshot(nextSnapshot);
    } catch (loadError) {
      if (generation === loadGeneration.current && identity.current === userId) {
        setSnapshot(null);
        setErrorKind("load");
        setError(privacyErrorMessage(loadError, "load"));
      }
    } finally {
      if (generation === loadGeneration.current && identity.current === userId) setLoading(false);
    }
  }, [eligible, userId, supabase]);

  useEffect(() => {
    identity.current = eligible && userId ? userId : null;
    setSnapshot(null);
    setReceipts([]);
    setReason("");
    setError(null);
    setSubmitting(false);
    submission.current = false;
    void load();
    return invalidateLoad;
  }, [load, eligible, userId, invalidateLoad]);

  const alreadyOpen = Boolean(snapshot?.openRequests.some(request => request.requestType === requestType) || receipts.some(item => item.type === requestType));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || !userId || identity.current !== userId || submission.current || alreadyOpen) return;
    submission.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const id = await submitPrivacyRequest(supabase, {
        requestType,
        reason
      });
      if (identity.current !== userId) return;
      setReceipts(current => [...current, { id, type: requestType }]);
      setReason("");
      await load();
    } catch (submitError) {
      if (identity.current === userId) {
        setErrorKind("submit");
        setError(privacyErrorMessage(submitError, "submit"));
      }
    } finally {
      if (identity.current === userId) {
        submission.current = false;
        setSubmitting(false);
      }
    }
  }

  return (
    <MemberShell
      title="Privacy"
      subtitle="Your data requests and available downloads."
    >
      {error ? <div className="status-banner status-danger" role="alert">{receipt && errorKind === "load" ? "Your request was received. Request history could not be refreshed; do not submit it again." : error}</div> : null}
      {receipt ? <div className="status-banner status-success" role="status">Your {REQUEST_TYPES.find(type => type.value === receipt.type)?.label.toLowerCase()} request was received. It will be reviewed before any action is taken.</div> : null}

      {eligible ? (
        <>
          <section className="member-privacy-summary">
            <p className="section-copy">{snapshot?.consentStatusUnavailable ? "Policy status is temporarily unavailable. You can still submit a data request." : snapshot?.hasRequiredConsents ? "Your current policy reviews are recorded." : "You do not need to accept policies to submit a data request."}</p>
            <button type="button" className="secondary-cta" disabled={loading || submitting} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /> {loading ? "Refreshing requests..." : "Refresh requests"}</button>
          </section>

          <div className="member-privacy-layout">
            <section className="member-privacy-section">
              <h2 className="section-title">Submit a data request</h2>
              <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
                <div>
                  <label className="field-label" htmlFor="privacy-request-type">Request type</label>
                  <select
                    id="privacy-request-type"
                    className="input"
                    value={requestType}
                    disabled={submitting}
                    onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)}
                  >
                    {REQUEST_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="supporting-copy" id="privacy-request-context">{REQUEST_TYPES.find((type) => type.value === requestType)?.copy} {alreadyOpen ? "A request of this type has already been received." : ""}</p>
                <div>
                  <label className="field-label" htmlFor="privacy-request-reason">Reason or details</label>
                  <textarea
                    id="privacy-request-reason"
                    className="input profile-bio"
                    value={reason}
                    maxLength={2000}
                    disabled={submitting}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Optional details. Avoid passwords and unnecessary health information."
                  />
                </div>
                <button type="submit" className="primary-cta" aria-describedby="privacy-request-context" disabled={submitting || alreadyOpen}>
                  <Send size={16} aria-hidden="true" /> {submitting ? "Submitting..." : alreadyOpen ? "Request received" : "Submit request"}
                </button>
              </form>
            </section>

            <section className="member-privacy-section">
              <h2 className="section-title">Available downloads</h2>
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
                      <a href={request.responseLocation} className="secondary-cta" rel="noreferrer" referrerPolicy="no-referrer">
                        <Download size={16} aria-hidden="true" /> Download
                      </a>
                    ) : null}
                  </div>
                ))}
                {(snapshot?.downloadableExports.length ?? 0) === 0 ? (
                  <p className="feed-body">{loading ? "Loading downloads..." : error ? "Downloads could not be loaded. Refresh to retry." : "No downloads are available yet. Fulfilled access and portability requests will appear here until their links expire."}</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="member-privacy-section">
            <div className="profile-form-header">
              <div>
                <h2 className="section-title">Recent privacy requests</h2>
              </div>
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
                <p className="feed-body">{loading ? "Loading request history..." : error ? "Request history is unavailable. Refresh to retry." : "No privacy requests submitted yet."}</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </MemberShell>
  );
}
