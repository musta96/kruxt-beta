import React from "react";
import { OnboardingProvider, useOnboarding } from "./OnboardingContext";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { GymScreen } from "./screens/GymScreen";
import { ConsentsScreen } from "./screens/ConsentsScreen";
import { CompleteScreen } from "./screens/CompleteScreen";
import type { OnboardingUiStep } from "./types";

// ─── Inner orchestrator ────────────────────────────────────────────────────
function OnboardingFlowInner({ onComplete }: { onComplete: () => void }) {
  const { state } = useOnboarding();

  const screens: Record<OnboardingUiStep, React.ReactNode> = {
    welcome: <WelcomeScreen />,
    auth: <AuthScreen />,
    profile: <ProfileScreen />,
    gym: <GymScreen />,
    consents: <ConsentsScreen />,
    complete: <CompleteScreen onComplete={onComplete} />,
  };

  return (
    <div
      className="min-h-screen bg-background max-w-md mx-auto relative overflow-hidden"
      role="main"
      aria-label={`Onboarding — step: ${state.step}`}
    >
      {/* Ion-blue ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--ion-blue)) 0%, transparent 70%)",
        }}
      />

      {/* Active screen – keyed to trigger fade-up on step change */}
      <div key={state.step} className="animate-fade-up relative z-10">
        {screens[state.step]}
      </div>
    </div>
  );
}

// ─── Public API ────────────────────────────────────────────────────────────
export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  return (
    <OnboardingProvider>
      <OnboardingFlowInner onComplete={onComplete} />
    </OnboardingProvider>
  );
}
