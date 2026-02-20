// ─── Onboarding step IDs ───────────────────────────────────────────────────
export type OnboardingUiStep =
  | "welcome"
  | "auth"
  | "profile"
  | "gym"
  | "consents"
  | "complete";

// ─── Unit preference ───────────────────────────────────────────────────────
export type UnitSystem = "metric" | "imperial";

// ─── Auth mode ─────────────────────────────────────────────────────────────
export type AuthMode = "signup" | "signin";

// ─── Local draft shapes ────────────────────────────────────────────────────
export interface AuthDraft {
  mode: AuthMode;
  email: string;
  password: string;
  userId?: string;
}

export interface ProfileDraft {
  username: string;
  displayName: string;
  avatarUrl?: string;
  unitSystem: UnitSystem;
}

export type GymDraftMode = "skip" | "join" | "create";

export interface GymDraft {
  mode: GymDraftMode;
  gymId?: string;
  gymName?: string;
  isPublic?: boolean;
  joinRequestSent?: boolean;
  createName?: string;
  createSlug?: string;
}

export interface ConsentsDraft {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptHealthData: boolean;
}

// ─── Full onboarding UI state ──────────────────────────────────────────────
export interface OnboardingUiState {
  step: OnboardingUiStep;
  auth: Partial<AuthDraft>;
  profile: Partial<ProfileDraft>;
  gym: GymDraft;
  consents: ConsentsDraft;
  isSubmitting: boolean;
  submitError: string | null;
}

// ─── Field errors ──────────────────────────────────────────────────────────
export type FieldErrors = Record<string, string>;

// ─── Service contracts (injected, no direct supabase) ──────────────────────
export interface GymSearchResult {
  id: string;
  name: string;
  city: string | null;
  isPublic: boolean;
}

export interface OnboardingSubmitInput {
  auth: Partial<AuthDraft>;
  profile: Partial<ProfileDraft>;
  gym: GymDraft;
  consents: ConsentsDraft;
}

export interface OnboardingServices {
  /** Search gyms by name — delegates to GymService */
  searchGyms: (query: string) => Promise<GymSearchResult[]>;
  /** Atomic submit — delegates to Phase2OnboardingService.run() */
  submit: (input: OnboardingSubmitInput) => Promise<void>;
}
