import React, { useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen,
  SectionTitle,
  Subtitle,
  PrimaryBtn,
  ErrorBanner,
  ProgressBar,
} from "../../design-system/primitives";
import { supabase } from "@/integrations/supabase/client";

interface CompleteScreenProps {
  onComplete: () => void;
}

export function CompleteScreen({ onComplete }: CompleteScreenProps) {
  const { state, setSubmitting, setError } = useOnboarding();
  const { isSubmitting, submitError, profile, gym, consents, auth } = state;

  // ─── createPhase2OnboardingUiFlow.submit ──────────────────────────────────
  // Executes the onboarding atomic write sequence: profile upsert →
  // gym membership → baseline consents (record_user_consent RPC).
  async function handleEnter() {
    if (isSubmitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Upsert profile (schema: preferred_units, display_name, username)
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: auth.userId!,
        username: profile.username!,
        display_name: profile.displayName!,
        preferred_units: profile.unitSystem ?? "metric",
      });
      if (profileErr) throw profileErr;

      // 2. Gym membership — only for open gyms; private gyms already sent join request
      if (gym.mode === "join" && gym.gymId && !gym.joinRequestSent) {
        await supabase.from("gym_memberships").upsert(
          {
            user_id: auth.userId!,
            gym_id: gym.gymId,
            membership_status: "active",
            role: "member",
          },
          { onConflict: "gym_id,user_id" }
        );
      }

      // 3. Baseline consents via record_user_consent RPC
      // consent_type enum: "terms" | "privacy" | "health_data_processing"
      const consentPairs: Array<{ type: "terms" | "privacy" | "health_data_processing"; granted: boolean }> = [
        { type: "terms", granted: consents.acceptTerms },
        { type: "privacy", granted: consents.acceptPrivacy },
        { type: "health_data_processing", granted: consents.acceptHealthData },
      ];
      for (const cp of consentPairs) {
        const { error: cErr } = await supabase.rpc("record_user_consent", {
          p_consent_type: cp.type,
          p_granted: cp.granted,
          p_source: "onboarding_v2",
          p_locale: undefined,
          p_user_id: auth.userId!,
          p_ip_address: undefined,
          p_user_agent: undefined,
          p_evidence: {},
        });
        if (cErr) throw cErr;
      }

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
