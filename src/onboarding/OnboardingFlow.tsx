// OnboardingFlow — top-level orchestrator, renders the active screen
import React from "react";
import { OnboardingProvider, useOnboarding } from "./OnboardingContext";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { GymScreen } from "./screens/GymScreen";
import { ConsentsScreen } from "./screens/ConsentsScreen";
import { CompleteScreen } from "./screens/CompleteScreen";
import type { OnboardingStep } from "./types";

interface OnboardingFlowInnerProps {
  onComplete: () => void;
}

function OnboardingFlowInner({ onComplete }: OnboardingFlowInnerProps) {
  const { step } = useOnboarding();

  const screens: Record<OnboardingStep, React.ReactNode> = {
    welcome: <WelcomeScreen />,
    auth: <AuthScreen />,
    profile: <ProfileScreen />,
    gym: <GymScreen />,
    consents: <ConsentsScreen />,
    complete: <CompleteScreen onComplete={onComplete} />,
  };

  return <>{screens[step]}</>;
}

export interface OnboardingFlowProps {
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  function handleComplete() {
    onComplete?.();
  }

  return (
    <OnboardingProvider>
      <OnboardingFlowInner onComplete={handleComplete} />
    </OnboardingProvider>
  );
}
