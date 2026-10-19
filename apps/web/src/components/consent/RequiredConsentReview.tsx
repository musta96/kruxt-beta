"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  acceptRequiredConsentPolicies,
  loadRequiredConsentPolicies,
  verifyRequiredConsentPolicyDocument,
  type RequiredConsentPolicy
} from "@/lib/auth/required-consents";

import styles from "./RequiredConsentReview.module.css";

type RequiredConsentReviewProps = {
  client: SupabaseClient;
  userId: string;
  onComplete: () => void | Promise<void>;
  onSignOut: () => void;
  variant?: "marketing" | "standalone";
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
  const [verifiedDocumentUrls, setVerifiedDocumentUrls] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Loading current policy versions.");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const verifiedDocumentUrlsRef = useRef<string[]>([]);
  const loadGeneration = useRef(0);
  const invalidatePolicyLoad = useCallback(() => { loadGeneration.current++; }, []);

  const replaceVerifiedDocumentUrls = useCallback((nextUrls: Record<string, string>) => {
    for (const url of verifiedDocumentUrlsRef.current) URL.revokeObjectURL(url);
    verifiedDocumentUrlsRef.current = Object.values(nextUrls);
    setVerifiedDocumentUrls(nextUrls);
  }, []);

  const loadPolicies = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setError(null);
    setPolicies(null);
    setAcceptedPolicyIds(new Set());
    replaceVerifiedDocumentUrls({});
    setAnnouncement("Loading current policy versions.");

    try {
      const requiredPolicies = await loadRequiredConsentPolicies(client, userId);
      if (generation !== loadGeneration.current) return;
      if (requiredPolicies.length === 0) {
        setAnnouncement("Required policy review is complete.");
        await onComplete();
        return;
      }

      setAnnouncement("Verifying published policy documents.");
      const verifiedDocuments = await Promise.all(
        requiredPolicies.map((policy) => verifyRequiredConsentPolicyDocument(policy))
      );
      if (generation !== loadGeneration.current) return;
      replaceVerifiedDocumentUrls(
        Object.fromEntries(
          verifiedDocuments.map((document) => [document.policyId, URL.createObjectURL(document.blob)])
        )
      );
      setPolicies(requiredPolicies);
      setAnnouncement(
        `${requiredPolicies.length} required ${requiredPolicies.length === 1 ? "policy is" : "policies are"} verified and ready for review.`
      );
    } catch (loadError) {
      if (generation !== loadGeneration.current) return;
      const message = loadError instanceof Error ? loadError.message : "Unable to load required policies.";
      setError(message);
      setPolicies([]);
      setAnnouncement(`Policy review unavailable. ${message}`);
    }
  }, [client, onComplete, replaceVerifiedDocumentUrls, userId]);

  useEffect(() => {
    void loadPolicies();
    return invalidatePolicyLoad;
  }, [invalidatePolicyLoad, loadPolicies]);

  useEffect(() => {
    return () => {
      for (const url of verifiedDocumentUrlsRef.current) URL.revokeObjectURL(url);
      verifiedDocumentUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (variant !== "standalone" || (policies === null && !error)) return;
    headingRef.current?.focus();
  }, [error, policies, variant]);

  const allAccepted = useMemo(
    () =>
      Boolean(policies?.length) &&
      policies!.every(
        (policy) => acceptedPolicyIds.has(policy.id) && Boolean(verifiedDocumentUrls[policy.id])
      ),
    [acceptedPolicyIds, policies, verifiedDocumentUrls]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policies || !allAccepted) return;

    setSubmitting(true);
    setError(null);
    setAnnouncement("Recording your policy acceptance.");

    try {
      await acceptRequiredConsentPolicies(client, userId, policies);
      setAnnouncement("Required policy acceptance recorded.");
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
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className={styles.heading}>
        <p className="eyebrow">Required review</p>
        {variant === "standalone" ? (
          <h1 ref={headingRef} tabIndex={-1}>Review the current policies</h1>
        ) : (
          <h2 ref={headingRef}>Review the current policies</h2>
        )}
        <p>You must review and accept each published version before entering KRUXT.</p>
      </div>

      <p className={styles.notice}>
        The public beta legal summaries are informational. Each review copy below is downloaded without credentials
        and verified against its published SHA-256 checksum before acceptance is enabled.
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
                <a
                  className={styles.documentLink}
                  href={verifiedDocumentUrls[policy.id]}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open the verified review copy
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

  if (variant === "standalone") {
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
