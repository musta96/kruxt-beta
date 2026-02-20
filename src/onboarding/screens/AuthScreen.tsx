// Step 1 – Auth (email/password + social placeholders + Apple)
import React, { useState } from "react";
import { useOnboarding, useFieldError } from "../OnboardingContext";
import {
  ScreenShell,
  StepBar,
  ScreenHeader,
  Field,
  TextInput,
  PrimaryButton,
  GhostButton,
  Divider,
  ErrorCallout,
  BackButton,
} from "../ui";

export function AuthScreen() {
  const { draft, updateDraft, advance, back, errors, submitError, isSubmitting } = useOnboarding();
  const [showPassword, setShowPassword] = useState(false);
  const emailError = useFieldError("auth.email");
  const passwordError = useFieldError("auth.password");

  const isSignup = draft.auth.mode === "signup";

  function setMode(mode: "signup" | "signin") {
    updateDraft({ auth: { ...draft.auth, mode } });
  }

  return (
    <ScreenShell>
      <StepBar current={0} total={4} />

      <div className="flex items-center gap-2 px-4 pt-2">
        <BackButton onClick={back} />
      </div>

      <ScreenHeader
        badge="Step 1 of 4"
        title={isSignup ? "Claim your profile" : "Welcome back"}
        subtitle={
          isSignup
            ? "Proof counts. Start with your account."
            : "Sign in to continue your chain."
        }
      />

      {submitError && <ErrorCallout message={submitError} />}

      <div className="px-6 pt-2 pb-6 space-y-5 flex-1">
        {/* Mode toggle */}
        <div className="flex rounded-xl bg-secondary/30 border border-border/30 p-1 gap-1">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all duration-200 ${
                draft.auth.mode === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>

        {/* Email */}
        <Field label="Email" required error={emailError}>
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={draft.auth.email}
            error={!!emailError}
            onChange={(e) =>
              updateDraft({ auth: { ...draft.auth, email: e.target.value } })
            }
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          required
          error={passwordError}
          hint={isSignup ? "Minimum 8 characters." : undefined}
        >
          <div className="relative">
            <TextInput
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Create a strong password" : "Your password"}
              value={draft.auth.password}
              error={!!passwordError}
              onChange={(e) =>
                updateDraft({ auth: { ...draft.auth, password: e.target.value } })
              }
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a10.04 10.04 0 015.16 1.418M15 12a3 3 0 11-4.236-2.73M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </Field>

        <PrimaryButton onClick={advance} loading={isSubmitting}>
          {isSignup ? "Create account" : "Sign in"} →
        </PrimaryButton>

        <Divider label="or continue with" />

        {/* Social auth placeholders */}
        <div className="space-y-2.5">
          {/* Apple */}
          <GhostButton
            onClick={() => {
              /* Apple Sign In placeholder — integrate native SDK */
            }}
            className="flex items-center justify-center gap-2 text-foreground border-border/50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Continue with Apple
          </GhostButton>

          {/* Google */}
          <GhostButton
            onClick={() => {
              /* Google OAuth placeholder */
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </span>
          </GhostButton>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-1">
          Guild access starts when profile is complete.
        </p>
      </div>
    </ScreenShell>
  );
}
