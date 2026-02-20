// Onboarding flow context — tracks current step and draft state across screens.
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import type {
  OnboardingDraft,
  OnboardingFieldError,
  OnboardingStep,
} from "./types";
import {
  DEFAULT_DRAFT,
  STEP_ORDER,
  validateStep,
} from "./types";

interface OnboardingContextValue {
  step: OnboardingStep;
  draft: OnboardingDraft;
  errors: OnboardingFieldError[];
  isSubmitting: boolean;
  submitError: string | null;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  goToStep: (step: OnboardingStep) => void;
  advance: () => void;
  back: () => void;
  setErrors: (errors: OnboardingFieldError[]) => void;
  setIsSubmitting: (v: boolean) => void;
  setSubmitError: (msg: string | null) => void;
  clearErrors: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [errors, setErrors] = useState<OnboardingFieldError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors([]);
    setSubmitError(null);
  }, []);

  const goToStep = useCallback((next: OnboardingStep) => {
    setErrors([]);
    setSubmitError(null);
    setStep(next);
  }, []);

  const advance = useCallback(() => {
    const fieldErrors = validateStep(step, draft);
    if (fieldErrors.length > 0) {
      setErrors(fieldErrors);
      return;
    }
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
      setErrors([]);
      setSubmitError(null);
    }
  }, [step, draft]);

  const back = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      setStep(STEP_ORDER[idx - 1]);
      setErrors([]);
      setSubmitError(null);
    }
  }, [step]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setSubmitError(null);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        step,
        draft,
        errors,
        isSubmitting,
        submitError,
        updateDraft,
        goToStep,
        advance,
        back,
        setErrors,
        setIsSubmitting,
        setSubmitError,
        clearErrors,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}

// Helper: get field-level error message
export function useFieldError(field: string) {
  const { errors } = useOnboarding();
  return errors.find((e) => e.field === field)?.message ?? null;
}
