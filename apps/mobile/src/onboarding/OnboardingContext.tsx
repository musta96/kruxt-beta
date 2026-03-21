import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import type {
  OnboardingUiState,
  OnboardingUiStep,
  AuthDraft,
  ProfileDraft,
  GymDraft,
  ConsentsDraft,
  OnboardingServices,
} from "./types";

// ─── Initial state ─────────────────────────────────────────────────────────
const INITIAL: OnboardingUiState = {
  step: "welcome",
  auth: { mode: "signup" },
  profile: { unitSystem: "metric" },
  gym: { mode: "skip" },
  consents: { acceptTerms: false, acceptPrivacy: false, acceptHealthData: false },
  isSubmitting: false,
  submitError: null,
};

// ─── Actions ───────────────────────────────────────────────────────────────
type Action =
  | { type: "GO_TO"; step: OnboardingUiStep }
  | { type: "SET_AUTH"; data: Partial<AuthDraft> }
  | { type: "SET_PROFILE"; data: Partial<ProfileDraft> }
  | { type: "SET_GYM"; data: Partial<GymDraft> }
  | { type: "SET_CONSENTS"; data: Partial<ConsentsDraft> }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_ERROR"; message: string | null };

function reducer(state: OnboardingUiState, action: Action): OnboardingUiState {
  switch (action.type) {
    case "GO_TO":
      return { ...state, step: action.step, submitError: null };
    case "SET_AUTH":
      return { ...state, auth: { ...state.auth, ...action.data } };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.data } };
    case "SET_GYM":
      return { ...state, gym: { ...state.gym, ...action.data } };
    case "SET_CONSENTS":
      return { ...state, consents: { ...state.consents, ...action.data } };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value };
    case "SET_ERROR":
      return { ...state, submitError: action.message, isSubmitting: false };
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────
interface OnboardingCtx {
  state: OnboardingUiState;
  services: OnboardingServices;
  complete: () => void;
  goTo: (step: OnboardingUiStep) => void;
  setAuth: (data: Partial<AuthDraft>) => void;
  setProfile: (data: Partial<ProfileDraft>) => void;
  setGym: (data: Partial<GymDraft>) => void;
  setConsents: (data: Partial<ConsentsDraft>) => void;
  setSubmitting: (value: boolean) => void;
  setError: (message: string | null) => void;
}

const OnboardingContext = createContext<OnboardingCtx | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
  services: OnboardingServices;
  onComplete: () => void;
}

export function OnboardingProvider({ children, services, onComplete }: OnboardingProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        services,
        complete: onComplete,
        goTo: (step) => dispatch({ type: "GO_TO", step }),
        setAuth: (data) => dispatch({ type: "SET_AUTH", data }),
        setProfile: (data) => dispatch({ type: "SET_PROFILE", data }),
        setGym: (data) => dispatch({ type: "SET_GYM", data }),
        setConsents: (data) => dispatch({ type: "SET_CONSENTS", data }),
        setSubmitting: (value) => dispatch({ type: "SET_SUBMITTING", value }),
        setError: (message) => dispatch({ type: "SET_ERROR", message }),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
