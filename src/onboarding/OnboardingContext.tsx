import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import type {
  OnboardingState,
  OnboardingStep,
  AuthData,
  ProfileData,
  GymData,
  ConsentsData,
} from "./types";

// ─── Initial state ─────────────────────────────────────────────────────────
const INITIAL: OnboardingState = {
  step: "welcome",
  auth: {},
  profile: { unitSystem: "metric" },
  gym: null,
  consents: { terms: false, privacy: false, healthData: false },
  isSubmitting: false,
  submitError: null,
};

// ─── Actions ───────────────────────────────────────────────────────────────
type Action =
  | { type: "GO_TO"; step: OnboardingStep }
  | { type: "SET_AUTH"; data: Partial<AuthData> }
  | { type: "SET_PROFILE"; data: Partial<ProfileData> }
  | { type: "SET_GYM"; data: Partial<GymData> | null }
  | { type: "SET_CONSENTS"; data: Partial<ConsentsData> }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_ERROR"; message: string | null };

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case "GO_TO":
      return { ...state, step: action.step, submitError: null };
    case "SET_AUTH":
      return { ...state, auth: { ...state.auth, ...action.data } };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.data } };
    case "SET_GYM":
      return { ...state, gym: action.data };
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
  state: OnboardingState;
  goTo: (step: OnboardingStep) => void;
  setAuth: (data: Partial<AuthData>) => void;
  setProfile: (data: Partial<ProfileData>) => void;
  setGym: (data: Partial<GymData> | null) => void;
  setConsents: (data: Partial<ConsentsData>) => void;
  setSubmitting: (value: boolean) => void;
  setError: (message: string | null) => void;
}

const OnboardingContext = createContext<OnboardingCtx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  return (
    <OnboardingContext.Provider
      value={{
        state,
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
