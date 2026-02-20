// Step 0 – Welcome
import React from "react";
import { useOnboarding } from "../OnboardingContext";
import { ScreenShell, PrimaryButton } from "../ui";

export function WelcomeScreen() {
  const { advance } = useOnboarding();

  return (
    <ScreenShell className="justify-between">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center space-y-6">
        {/* Sigil */}
        <div className="relative w-24 h-24">
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent/60 flex items-center justify-center shadow-gold animate-pulse-gold">
            <span className="text-4xl font-display font-black text-primary-foreground tracking-tight select-none">
              K
            </span>
          </div>
          <div className="absolute -inset-2 rounded-3xl border border-primary/20 animate-pulse" />
        </div>

        {/* Brand statement */}
        <div className="space-y-3 max-w-xs">
          <h1 className="text-4xl font-display font-black text-foreground leading-none tracking-tight">
            KRUXT
          </h1>
          <p className="text-lg font-display font-semibold text-primary">
            Proof counts.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Join your guild. Log every session. Rank is earned weekly — there are no shortcuts.
          </p>
        </div>

        {/* Chain of values */}
        <div className="w-full max-w-xs space-y-2 pt-2">
          {[
            { icon: "🏋️", label: "Log to claim" },
            { icon: "⛓️", label: "Protect the chain" },
            { icon: "🏆", label: "Rank is earned weekly" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/30 border border-border/20"
            >
              <span className="text-base">{icon}</span>
              <span className="text-sm font-medium text-foreground/80">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 pt-4 space-y-3">
        <PrimaryButton onClick={advance}>
          Log to claim →
        </PrimaryButton>
        <p className="text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <button
            type="button"
            onClick={advance}
            className="text-primary underline underline-offset-2"
          >
            Sign in
          </button>
        </p>
      </div>
    </ScreenShell>
  );
}
