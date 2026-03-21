import React, { useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen,
  SectionTitle,
  Subtitle,
  PrimaryBtn,
  ConsentBlock,
  ProgressBar,
  BackBtn,
} from "../../design-system/primitives";
import type { FieldErrors } from "../types";

function validate(
  acceptTerms: boolean,
  acceptPrivacy: boolean,
  acceptHealthData: boolean
): FieldErrors {
  const errors: FieldErrors = {};
  if (!acceptTerms) errors.acceptTerms = "You must accept the Terms of Service to continue.";
  if (!acceptPrivacy) errors.acceptPrivacy = "You must accept the Privacy Policy to continue.";
  if (!acceptHealthData)
    errors.acceptHealthData =
      "Health data consent is required. Rank requires consent to current policy.";
  return errors;
}

export function ConsentsScreen() {
  const { goTo, setConsents, state } = useOnboarding();
  const { acceptTerms, acceptPrivacy, acceptHealthData } = state.consents;
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function toggle(key: keyof typeof state.consents, value: boolean) {
    setConsents({ [key]: value });
    if (value) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleContinue() {
    const errs = validate(acceptTerms, acceptPrivacy, acceptHealthData);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    goTo("complete");
  }

  const allGranted = acceptTerms && acceptPrivacy && acceptHealthData;

  return (
    <Screen>
      <div className="mb-6">
        <ProgressBar value={80} />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <BackBtn onClick={() => goTo("gym")} />

        <div className="space-y-1">
          <SectionTitle>Policy consent</SectionTitle>
          <Subtitle>Rank requires consent to current policy.</Subtitle>
        </div>

        <div className="panel bg-muted/30 p-4 flex gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">🛡️</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your workout data powers your rank and guild feed. We never sell personal data.
            You can request deletion any time from Privacy Center.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <ConsentBlock
            id="consent-terms"
            label="Terms of Service"
            description="You agree to KRUXT rules of conduct, anti-cheat policy, and community standards."
            checked={acceptTerms}
            onChange={(v) => toggle("acceptTerms", v)}
            required
            error={fieldErrors.acceptTerms}
          />
          <ConsentBlock
            id="consent-privacy"
            label="Privacy Policy"
            description="You understand how KRUXT collects, uses, and protects your data under GDPR / CCPA."
            checked={acceptPrivacy}
            onChange={(v) => toggle("acceptPrivacy", v)}
            required
            error={fieldErrors.acceptPrivacy}
          />
          <ConsentBlock
            id="consent-health"
            label="Health Data Processing"
            description="You consent to KRUXT processing workout metrics (sets, reps, volume) to compute rank."
            checked={acceptHealthData}
            onChange={(v) => toggle("acceptHealthData", v)}
            required
            error={fieldErrors.acceptHealthData}
          />
        </div>

        {!allGranted && (
          <div className="panel border-warning/40 bg-warning/5 p-3" role="note" aria-live="polite">
            <p className="text-xs text-warning font-semibold">
              All three consents are required to access Guild Hall and rank features.
            </p>
          </div>
        )}

        <div className="mt-auto pt-4">
          <PrimaryBtn onClick={handleContinue}>Accept &amp; continue</PrimaryBtn>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Review or withdraw consent any time in Privacy Center.
          </p>
        </div>
      </div>
    </Screen>
  );
}
