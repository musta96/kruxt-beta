"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupportTicketPriority } from "@kruxt/types";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  createSupportTicketMessage,
  loadSupportSnapshot,
  submitSupportTicket,
  type SupportSnapshot
} from "@/lib/public/support";

const PRIORITIES: SupportTicketPriority[] = ["low", "normal", "high", "urgent"];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SupportScreen() {
  const { state, displayLabel, supabase } = usePublicSession();
  const [snapshot, setSnapshot] = useState<SupportSnapshot | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [gymId, setGymId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadSupportSnapshot(supabase, { includeClosed });
        if (!active) return;
        setSnapshot(nextSnapshot);
        setGymId((current) => current || nextSnapshot.gymOptions[0]?.gymId || "");
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load support center.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [includeClosed, state.status, state.user, supabase]);

  const openTicketCount = useMemo(
    () =>
      (snapshot?.tickets ?? []).filter((ticket) =>
        ["open", "triaged", "waiting_user", "in_progress", "waiting_approval"].includes(ticket.status)
      ).length,
    [snapshot?.tickets]
  );

  async function handleSelectTicket(ticketId: string) {
    setError(null);
    try {
      const nextSnapshot = await loadSupportSnapshot(supabase, {
        includeClosed,
        selectedTicketId: ticketId
      });
      setSnapshot(nextSnapshot);
      setReplyBody("");
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Unable to open ticket.");
    }
  }

  async function handleSubmitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const nextSnapshot = await submitSupportTicket(supabase, {
        subject,
        description,
        category,
        priority,
        gymId: gymId || null
      });
      setSnapshot(nextSnapshot);
      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("normal");
      setSuccess("Support ticket submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot?.selectedTicketId) return;

    setReplying(true);
    setError(null);
    setSuccess(null);
    try {
      const nextSnapshot = await createSupportTicketMessage(supabase, snapshot.selectedTicketId, {
        actorType: "user",
        actorLabel: displayLabel,
        body: replyBody,
        isInternal: false
      });
      setSnapshot(nextSnapshot);
      setReplyBody("");
      setSuccess("Reply sent.");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Unable to send reply.");
    } finally {
      setReplying(false);
    }
  }

  return (
    <MemberShell
      title="Support"
      subtitle="Member support tickets, in-thread replies, and automation state from the Phase 10 support center."
    >
      {error ? <div className="status-banner status-danger">{error}</div> : null}
      {success ? <div className="status-banner status-success">{success}</div> : null}

      {loading ? (
        <section className="feed-card">
          <p className="feed-body">Loading support center...</p>
        </section>
      ) : (
        <>
          <section className="hero-card">
            <div>
              <p className="eyebrow">PHASE 10 SUPPORT</p>
              <h2 className="section-title">Support is product infrastructure.</h2>
              <p className="section-copy">
                Tickets are tied to your account and optional gym context, with conversations and automation approvals
                visible in one place.
              </p>
              <div className="stack-actions">
                <button type="button" className="secondary-cta" onClick={() => setIncludeClosed((current) => !current)}>
                  {includeClosed ? "Hide closed" : "Include closed"}
                </button>
              </div>
            </div>
            <div className="hero-stats">
              <div className="metric-card">
                <span className="metric-label">Open tickets</span>
                <strong className="metric-value">{openTicketCount}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Total loaded</span>
                <strong className="metric-value">{snapshot?.tickets.length ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Selected</span>
                <strong className="metric-value-sm">
                  {snapshot?.selectedTicket ? `#${snapshot.selectedTicket.ticketNumber}` : "None"}
                </strong>
              </div>
            </div>
          </section>

          <section className="split-card">
            <article className="glass-panel">
              <p className="eyebrow">NEW TICKET</p>
              <h2 className="section-title">Ask for help</h2>
              <form className="form-grid" onSubmit={(event) => void handleSubmitTicket(event)}>
                <label>
                  <span className="field-label">Subject</span>
                  <input
                    className="input"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                    minLength={3}
                    placeholder="What is happening?"
                  />
                </label>
                <label>
                  <span className="field-label">Details</span>
                  <textarea
                    className="input profile-bio"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    minLength={10}
                    placeholder="Tell us what you expected and what you saw."
                  />
                </label>
                <div className="grid grid-2">
                  <label>
                    <span className="field-label">Category</span>
                    <input className="input" value={category} onChange={(event) => setCategory(event.target.value)} />
                  </label>
                  <label>
                    <span className="field-label">Priority</span>
                    <select
                      className="input"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
                    >
                      {PRIORITIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span className="field-label">Gym context</span>
                  <select className="input" value={gymId} onChange={(event) => setGymId(event.target.value)}>
                    <option value="">No specific gym</option>
                    {(snapshot?.gymOptions ?? []).map((gym) => (
                      <option key={gym.gymId} value={gym.gymId}>
                        {gym.gymName ?? gym.gymId}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="primary-cta" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit ticket"}
                </button>
              </form>
            </article>

            <article className="glass-panel">
              <p className="eyebrow">QUEUE</p>
              <h2 className="section-title">Your tickets</h2>
              <div className="rank-list">
                {(snapshot?.tickets ?? []).map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`support-ticket-row ${snapshot?.selectedTicketId === ticket.id ? "is-selected" : ""}`}
                    onClick={() => void handleSelectTicket(ticket.id)}
                  >
                    <span className="rank-position">#{ticket.ticketNumber}</span>
                    <span className="rank-row-body">
                      <strong>{ticket.subject}</strong>
                      <span className="feed-body">
                        {ticket.status} · {ticket.priority} · {formatDateTime(ticket.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {(snapshot?.tickets.length ?? 0) === 0 ? (
                  <p className="feed-body">No support tickets yet.</p>
                ) : null}
              </div>
            </article>
          </section>

          <section className="glass-panel">
            <div className="profile-form-header">
              <div>
                <p className="eyebrow">CONVERSATION</p>
                <h2 className="section-title">
                  {snapshot?.selectedTicket ? snapshot.selectedTicket.subject : "No ticket selected"}
                </h2>
              </div>
              {snapshot?.selectedTicket ? (
                <span className="ghost-chip">
                  {snapshot.selectedTicket.status} · {snapshot.selectedTicket.priority}
                </span>
              ) : null}
            </div>

            {snapshot?.selectedTicket ? (
              <>
                <p className="section-copy">{snapshot.selectedTicket.description}</p>
                <div className="comments-list">
                  {snapshot.selectedTicketMessages.map((message) => (
                    <div key={message.id} className="comment-card">
                      <div className="comment-header">
                        <strong>{message.actorLabel ?? message.actorType}</strong>
                        <span className="feed-body">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="comment-body">{message.body}</p>
                    </div>
                  ))}
                  {snapshot.selectedTicketMessages.length === 0 ? (
                    <p className="feed-body">No replies yet. The initial description is shown above.</p>
                  ) : null}
                </div>

                {snapshot.selectedTicketAutomationRuns.length > 0 ? (
                  <div className="plan-note">
                    <strong>Automation state</strong>
                    <p>
                      {snapshot.selectedTicketAutomationRuns[0].agentName} ·{" "}
                      {snapshot.selectedTicketAutomationRuns[0].runStatus} · approval{" "}
                      {snapshot.selectedTicketAutomationRuns[0].approvalStatus}
                    </p>
                  </div>
                ) : null}

                <form className="comment-composer" onSubmit={(event) => void handleReply(event)}>
                  <textarea
                    className="input comment-input"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Reply to the support thread."
                    required
                  />
                  <button type="submit" className="primary-cta" disabled={replying}>
                    {replying ? "Sending..." : "Send reply"}
                  </button>
                </form>
              </>
            ) : (
              <p className="feed-body">Select a ticket to view the thread.</p>
            )}
          </section>
        </>
      )}
    </MemberShell>
  );
}
