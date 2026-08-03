"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  acceptRequiredConsentPolicies,
  loadRequiredConsentPolicies,
  type RequiredConsentPolicy
} from "@/lib/auth/required-consents";

import styles from "./RequiredConsentReview.module.css";

type RequiredConsentReviewProps = {
  client: SupabaseClient;
  userId: string;
  onComplete: () => void | Promise<void>;
  onSignOut: () => void;
  variant?: "marketing" | "member";
};

function formatEffectiveDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function RequiredConsentReview({
  client,
  userId,
  onComplete,
  onSignOut,
  variant = "marketing"
}: RequiredConsentReviewProps) {
  const [policies, setPolicies] = useState<RequiredConsentPolicy[] | null>(null);
  const [acceptedPolicyIds, setAcceptedPolicyIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    setError(null);
    setPolicies(null);
    setAcceptedPolicyIds(new Set());

    try {
      const requiredPolicies = await loadRequiredConsentPolicies(client, userId);
      if (requiredPolicies.length === 0) {
        await onComplete();
        return;
      }
      setPolicies(requiredPolicies);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load required policies.");
      setPolicies([]);
    }
  }, [client, onComplete, userId]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const allAccepted = useMemo(
    () => Boolean(policies?.length) && policies!.every((policy) => acceptedPolicyIds.has(policy.id)),
    [acceptedPolicyIds, policies]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policies || !allAccepted) return;

    setSubmitting(true);
    setError(null);

    try {
      await acceptRequiredConsentPolicies(client, userId, policies);
      await onComplete();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to record required consents.";
      await loadPolicies();
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const content = (
    <div className={styles.review}>
      <div className={styles.heading}>
        <p className="eyebrow">Required review</p>
        <h2>Review the current policies</h2>
        <p>You must review and accept each published version before entering the member app.</p>
      </div>

      <p className={styles.notice}>
        The public beta legal summaries are informational. Only the exact published documents linked below are
        recorded with your acceptance.
      </p>

      {policies === null && !error ? <p className={styles.notice}>Loading current policy versions...</p> : null}

      {policies && policies.length > 0 ? (
        <form className={styles.review} onSubmit={handleSubmit}>
          <div className={styles.policies}>
            {policies.map((policy) => (
              <section className={styles.policy} key={policy.id}>
                <div className={styles.policyHeader}>
                  <h3>{policy.label}</h3>
                  <span className={styles.version}>{policy.version}</span>
                </div>
                <p>Effective {formatEffectiveDate(policy.effectiveAt)}</p>
                {policy.changeSummary ? <p>{policy.changeSummary}</p> : null}
                <a className={styles.documentLink} href={policy.documentUrl} target="_blank" rel="noreferrer">
                  Open and review this published document
                </a>
                <label className={styles.acceptance}>
                  <input
                    type="checkbox"
                    checked={acceptedPolicyIds.has(policy.id)}
                    onChange={(event) => {
                      setAcceptedPolicyIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(policy.id);
                        else next.delete(policy.id);
                        return next;
                      });
                    }}
                  />
                  <span>
                    I have reviewed and accept {policy.label}, version {policy.version}.
                  </span>
                </label>
              </section>
            ))}
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={!allAccepted || submitting}>
              {submitting ? "Recording acceptance..." : "Accept and enter KRUXT"}
            </button>
            <button className={styles.secondary} type="button" onClick={onSignOut} disabled={submitting}>
              Sign out
            </button>
          </div>
        </form>
      ) : null}

      {error && (!policies || policies.length === 0) ? (
        <>
          <p className={styles.error} role="alert">
            {error}
          </p>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={() => void loadPolicies()}>
              Retry policy check
            </button>
            <button className={styles.secondary} type="button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  if (variant === "member") {
    return (
      <main className="app-shell">
        <div className="mobile-frame">
          <section className={`glass-panel ${styles.memberPanel}`}>{content}</section>
        </div>
      </main>
    );
  }

  return content;
}
