import React, { useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen, SectionTitle, Subtitle, PrimaryBtn,
  InputField, ErrorBanner, ProgressBar,
} from "../ui";
import { supabase } from "@/integrations/supabase/client";

type Mode = "signup" | "signin";

function validate(email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  return errors;
}

export function AuthScreen() {
  const { goTo, setAuth, state } = useOnboarding();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState((state.auth.email as string) ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const fieldErrors = validate(email, password);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setServerError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuth({ email, userId: data.user?.id });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuth({ email, userId: data.user?.id });
      }
      goTo("profile");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="mb-6">
        <ProgressBar value={20} />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <div className="space-y-1">
          <SectionTitle>{mode === "signup" ? "Create account" : "Welcome back"}</SectionTitle>
          <Subtitle>Proof counts. Start your chain.</Subtitle>
        </div>

        {/* Mode toggle */}
        <div className="flex panel p-1 gap-1" role="tablist" aria-label="Auth mode">
          {(["signup", "signin"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setErrors({}); setServerError(null); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signup" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>

        {serverError && <ErrorBanner message={serverError} onRetry={() => setServerError(null)} />}

        <div className="flex flex-col gap-4">
          <InputField
            id="auth-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            error={errors.email}
            autoComplete="email"
          />
          <InputField
            id="auth-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Min. 8 characters"
            error={errors.password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        <PrimaryBtn onClick={handleSubmit} loading={loading}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </PrimaryBtn>

        {/* Social auth divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          {/* Sign in with Apple — placeholder */}
          <button
            type="button"
            disabled
            className="btn-ghost flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            aria-label="Sign in with Apple — coming soon"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Sign in with Apple
            <span className="text-xs text-muted-foreground ml-1">(coming soon)</span>
          </button>

          {/* Google — placeholder */}
          <button
            type="button"
            disabled
            className="btn-ghost flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            aria-label="Sign in with Google — coming soon"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
            <span className="text-xs text-muted-foreground ml-1">(coming soon)</span>
          </button>
        </div>
      </div>
    </Screen>
  );
}
