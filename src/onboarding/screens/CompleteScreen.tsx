import React from "react";
import type { Json } from "@/integrations/supabase/types";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen, SectionTitle, Subtitle, PrimaryBtn,
  ErrorBanner, ProgressBar, Spinner,
} from "../ui";
import { supabase } from "@/integrations/supabase/client";

interface CompleteScreenProps {
  onComplete: () => void;
}

export function CompleteScreen({ onComplete }: CompleteScreenProps) {
  const { state, setSubmitting, setError } = useOnboarding();
  const { isSubmitting, submitError, profile, gym, consents, auth } = state;

  async function handleEnter() {
    if (isSubmitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Upsert profile — use schema-correct field names
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: auth.userId!,
        username: profile.username!,
        display_name: profile.displayName!,
        preferred_units: profile.unitSystem ?? "metric",
      });
      if (profileError) throw profileError;

      // 2. Gym membership — gym_memberships has user_id, gym_id, membership_status
      if (gym?.gymId && !gym.joinRequestSent) {
        const { error: memberError } = await supabase.from("gym_memberships").insert({
          user_id: auth.userId!,
          gym_id: gym.gymId,
          membership_status: "active",
          role: "member",
        });
        if (memberError && !memberError.message.includes("duplicate")) {
          console.warn("Membership insert warning:", memberError.message);
        }
      }

      // 3. Record consents — enum values: "terms" | "privacy" | "health_data_processing"
      const consentRecords = [
        { consent_type: "terms" as const, granted: consents.terms },
        { consent_type: "privacy" as const, granted: consents.privacy },
        { consent_type: "health_data_processing" as const, granted: consents.healthData },
      ].map((c) => ({
        ...c,
        user_id: auth.userId!,
        granted_at: new Date().toISOString(),
        source: "onboarding_v2",
        evidence: {} as Json,
      }));

      const { error: consentError } = await supabase.from("consents").insert(consentRecords);
      if (consentError) throw consentError;

      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Screen className="justify-between">
      <div className="mb-6">
        <ProgressBar value={100} />
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-8">
        {/* Completion sigil */}
        <div className="relative">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 flex items-center justify-center shadow-xl shadow-primary/30 animate-gold-pulse">
            <span className="text-5xl" role="img" aria-label="Shield">🛡️</span>
          </div>
        </div>

        <div className="space-y-3 max-w-xs">
          <SectionTitle>You're in the guild.</SectionTitle>
          <p className="text-primary font-semibold text-base">Proof counts.</p>
          <Subtitle>
            Your chain starts now. Log your first workout to claim your rank.
            Every session is evidence.
          </Subtitle>
        </div>

        {/* Summary panel */}
        <div className="w-full panel p-4 text-left flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Profile</span>
            <span className="text-sm font-bold text-foreground">{profile.displayName}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Handle</span>
            <span className="text-sm font-mono text-primary">@{profile.username}</span>
          </div>
          {gym?.gymName && (
            <>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Guild</span>
                <span className="text-sm font-bold text-foreground">
                  {gym.gymName}
                  {gym.joinRequestSent && (
                    <span className="text-xs text-warning ml-1.5">(pending)</span>
                  )}
                </span>
              </div>
            </>
          )}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Consents</span>
            <span className="text-xs text-success font-semibold">✓ All granted</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 pb-4">
        {submitError && (
          <ErrorBanner message={submitError} onRetry={handleEnter} />
        )}
        <PrimaryBtn onClick={handleEnter} loading={isSubmitting}>
          Enter Guild Hall
        </PrimaryBtn>
      </div>
    </Screen>
  );
}
