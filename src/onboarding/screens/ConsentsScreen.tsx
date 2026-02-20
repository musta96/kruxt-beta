import React, { useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen, SectionTitle, Subtitle, PrimaryBtn,
  ConsentBlock, ErrorBanner, ProgressBar, BackBtn,
} from "../ui";

interface ConsentError {
  terms?: string;
  privacy?: string;
  healthData?: string;
}

function validate(terms: boolean, privacy: boolean, healthData: boolean): ConsentError {
  const errors: ConsentError = {};
  if (!terms) errors.terms = "You must accept the Terms of Service to continue.";
  if (!privacy) errors.privacy = "You must accept the Privacy Policy to continue.";
  if (!healthData) errors.healthData = "Health data consent is required to track workouts and rank.";
  return errors;
}

export function ConsentsScreen() {
  const { goTo, setConsents, state } = useOnboarding();
  const { terms, privacy, healthData } = state.consents;
  const [errors, setErrors] = useState<ConsentError>({});

  function handleToggle(key: "terms" | "privacy" | "healthData", value: boolean) {
    setConsents({ [key]: value });
    // Clear error on check
    if (value) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleContinue() {
    const fieldErrors = validate(terms, privacy, healthData);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    goTo("complete");
  }

  const allConsented = terms && privacy && healthData;

  return (
    <Screen>
      <div className="mb-6">
        <ProgressBar value={80} />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <div className="flex items-center gap-3">
          <BackBtn onClick={() => goTo("gym")} />
        </div>

        <div className="space-y-1">
          <SectionTitle>Policy consent</SectionTitle>
          <Subtitle>Rank requires consent to current policy.</Subtitle>
        </div>

        {/* Consent info banner */}
        <div className="panel bg-muted/30 p-4 flex gap-3">
          <span className="text-xl" aria-hidden="true">🛡️</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your workout data is used to calculate rank and power your guild feed.
            We never sell your personal data. You can request deletion at any time
            from Privacy Center.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <ConsentBlock
            id="consent-terms"
            label="Terms of Service"
            description="You agree to KRUXT's rules of conduct, anti-cheat policy, and community standards."
            checked={terms}
            onChange={(v) => handleToggle("terms", v)}
            required
          />
          {errors.terms && (
            <p className="field-error" role="alert">{errors.terms}</p>
          )}

          <ConsentBlock
            id="consent-privacy"
            label="Privacy Policy"
            description="You understand how KRUXT collects, uses, and protects your personal data under GDPR/CCPA."
            checked={privacy}
            onChange={(v) => handleToggle("privacy", v)}
            required
          />
          {errors.privacy && (
            <p className="field-error" role="alert">{errors.privacy}</p>
          )}

          <ConsentBlock
            id="consent-health"
            label="Health Data Processing"
            description="You consent to KRUXT processing workout metrics (sets, reps, volume) to compute rank and leaderboards."
            checked={healthData}
            onChange={(v) => handleToggle("healthData", v)}
            required
          />
          {errors.healthData && (
            <p className="field-error" role="alert">{errors.healthData}</p>
          )}
        </div>

        {/* Block explanation when not consented */}
        {!allConsented && (
          <div className="panel border-warning/40 bg-warning/5 p-3" role="note" aria-live="polite">
            <p className="text-xs text-warning font-semibold">
              All consents required to access Guild Hall and rank features.
            </p>
          </div>
        )}

        <div className="mt-auto pt-4">
          <PrimaryBtn onClick={handleContinue}>
            Accept & continue
          </PrimaryBtn>
          <p className="text-xs text-center text-muted-foreground mt-3">
            You can review and withdraw consent at any time in your Privacy Center.
          </p>
        </div>
      </div>
    </Screen>
  );
}
