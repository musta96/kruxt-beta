import React from "react";
import { useOnboarding } from "../OnboardingContext";
import { Screen, SectionTitle, Subtitle, PrimaryBtn } from "../ui";

export function WelcomeScreen() {
  const { goTo } = useOnboarding();

  return (
    <Screen className="justify-between">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-12">
        {/* Brand mark */}
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-5xl font-display font-black text-primary-foreground leading-none">K</span>
        </div>

        {/* Brand statement */}
        <div className="space-y-3 max-w-xs">
          <h1 className="text-5xl font-display font-black text-foreground tracking-tight">
            KRUXT
          </h1>
          <p className="text-primary font-semibold text-lg tracking-wide">
            Proof counts.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The guild where every rep is on record.
            Rank is earned. Chain is protected.
          </p>
        </div>

        {/* Sigil indicators */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="panel px-3 py-1.5 font-semibold">🏋️ Log</span>
          <span className="text-border">→</span>
          <span className="panel px-3 py-1.5 font-semibold">⚡ Rank</span>
          <span className="text-border">→</span>
          <span className="panel px-3 py-1.5 font-semibold">🛡️ Claim</span>
        </div>
      </div>

      {/* CTA footer */}
      <div className="flex flex-col gap-3 pb-4 animate-fade-up">
        <PrimaryBtn onClick={() => goTo("auth")}>
          Log to claim
        </PrimaryBtn>
        <p className="text-xs text-center text-muted-foreground">
          Already a member?{" "}
          <button
            type="button"
            onClick={() => goTo("auth")}
            className="text-primary underline underline-offset-2"
            aria-label="Sign in to existing account"
          >
            Sign in
          </button>
        </p>
      </div>
    </Screen>
  );
}
