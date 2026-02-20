// Step 4 – Required policy consents
import React from "react";
import { useOnboarding, useFieldError } from "../OnboardingContext";
import {
  ScreenShell,
  StepBar,
  ScreenHeader,
  ConsentRow,
  PrimaryButton,
  BackButton,
  ErrorCallout,
} from "../ui";

export function ConsentsScreen() {
  const { draft, updateDraft, advance, back, submitError, isSubmitting } = useOnboarding();
  const c = draft.consents;

  function set(patch: Partial<typeof c>) {
    updateDraft({ consents: { ...c, ...patch } });
  }

  const termsError = useFieldError("consents.acceptTerms");
  const privacyError = useFieldError("consents.acceptPrivacy");
  const healthError = useFieldError("consents.acceptHealthData");

  const allRequired = c.acceptTerms && c.acceptPrivacy && c.acceptHealthData;

  return (
    <ScreenShell>
      <StepBar current={3} total={4} />

      <div className="flex items-center gap-2 px-4 pt-2">
        <BackButton onClick={back} />
      </div>

      <ScreenHeader
        badge="Step 4 of 4"
        title="Accept the rules"
        subtitle="Terms, privacy, and health-data consent are required."
      />

      {submitError && <ErrorCallout message={submitError} />}

      <div className="px-6 pt-2 pb-10 space-y-4 flex-1">
        {/* Rank gate notice */}
        <div className="p-3.5 rounded-xl bg-primary/8 border border-primary/20">
          <p className="text-xs font-semibold text-primary">Rank requires consent to current policy.</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            All three required consents must be accepted before you can earn XP or rank within your guild.
          </p>
        </div>

        {/* Required consents */}
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Required</p>

          <ConsentRow
            label="Terms of Service"
            description="Governs your use of the KRUXT platform, ranking systems, and guild features."
            checked={c.acceptTerms}
            required
            error={termsError}
            onChange={(v) => set({ acceptTerms: v })}
          />

          <ConsentRow
            label="Privacy Policy"
            description="How we collect, store, and protect your personal data."
            checked={c.acceptPrivacy}
            required
            error={privacyError}
            onChange={(v) => set({ acceptPrivacy: v })}
          />

          <ConsentRow
            label="Health Data Processing"
            description="Permission to process workout and biometric data for ranking and guild statistics."
            checked={c.acceptHealthData}
            required
            error={healthError}
            onChange={(v) => set({ acceptHealthData: v })}
          />
        </div>

        {/* Optional consents */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Optional</p>

          <ConsentRow
            label="Marketing Emails"
            description="KRUXT news, feature launches, and guild event notifications."
            checked={c.marketingEmailOptIn}
            onChange={(v) => set({ marketingEmailOptIn: v })}
          />

          <ConsentRow
            label="Push Notifications"
            description="Chain reminders, rank changes, and guild alerts."
            checked={c.pushNotificationsOptIn}
            onChange={(v) => set({ pushNotificationsOptIn: v })}
          />
        </div>

        {/* Links */}
        <div className="flex gap-4 px-1 pt-1">
          <a
            href="#"
            className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            Read Terms
          </a>
          <a
            href="#"
            className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            Read Privacy Policy
          </a>
        </div>

        <div className="pt-2">
          {!allRequired && (
            <p className="text-xs text-destructive text-center mb-3">
              Rank requires consent to current policy.
            </p>
          )}
          <PrimaryButton onClick={advance} loading={isSubmitting}>
            Accept and continue →
          </PrimaryButton>
        </div>
      </div>
    </ScreenShell>
  );
}
