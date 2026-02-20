import React from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen,
  SectionTitle,
  Subtitle,
  PrimaryBtn,
  ErrorBanner,
  ProgressBar,
} from "../../design-system/primitives";

interface CompleteScreenProps {
  onComplete: () => void;
}

/**
 * CompleteScreen — calls injected services.submit() which maps to
 * Phase2OnboardingService.run(). No direct supabase usage.
 */
export function CompleteScreen({ onComplete }: CompleteScreenProps) {
  const { state, setSubmitting, setError, services } = useOnboarding();
  const { isSubmitting, submitError, profile, gym, consents, auth } = state;

  async function handleEnter() {
    if (isSubmitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await services.submit({ auth, profile, gym, consents });
      onComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <Screen className="justify-between">
      <div className="mb-6">
        <ProgressBar value={100} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-8">
        <div
          className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/40
                     flex items-center justify-center shadow-xl shadow-primary/30 animate-gold-pulse"
          aria-hidden="true"
        >
          <span className="text-5xl">🛡️</span>
        </div>

        <div className="space-y-3 max-w-xs">
          <SectionTitle>You're in the guild.</SectionTitle>
          <p className="text-primary font-semibold text-base">Proof counts.</p>
          <Subtitle>
            Your chain starts now. Log your first workout to claim your rank.
            Every session is evidence.
          </Subtitle>
        </div>

        <div className="w-full panel p-4 text-left flex flex-col gap-3">
          <SummaryRow label="Profile" value={profile.displayName ?? "—"} />
          <div className="h-px bg-border" />
          <SummaryRow label="Handle" value={`@${profile.username ?? "—"}`} mono />
          {gym.gymName && (
            <>
              <div className="h-px bg-border" />
              <SummaryRow
                label="Guild"
                value={gym.gymName}
                badge={gym.joinRequestSent ? "pending" : undefined}
              />
            </>
          )}
          <div className="h-px bg-border" />
          <SummaryRow label="Consents" value="✓ All granted" success />
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-4">
        {submitError && <ErrorBanner message={submitError} onRetry={handleEnter} />}
        <PrimaryBtn onClick={handleEnter} loading={isSubmitting} loadingLabel="Entering guild...">
          Enter Guild Hall
        </PrimaryBtn>
      </div>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  success,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  success?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span
        className={`text-sm font-bold ${
          mono ? "font-mono text-primary" : success ? "text-success" : "text-foreground"
        }`}
      >
        {value}
        {badge && <span className="text-xs text-warning ml-1.5 font-normal">({badge})</span>}
      </span>
    </div>
  );
}
