// ─── Onboarding step IDs ───────────────────────────────────────────────────
export type OnboardingStep =
  | "welcome"
  | "auth"
  | "profile"
  | "gym"
  | "consents"
  | "complete";

// ─── Unit preference ───────────────────────────────────────────────────────
export type UnitSystem = "metric" | "imperial";

// ─── Auth ──────────────────────────────────────────────────────────────────
export interface AuthData {
  email: string;
  password: string;
  /** Supabase user id once auth is resolved */
  userId?: string;
}

// ─── Profile ───────────────────────────────────────────────────────────────
export interface ProfileData {
  username: string;
  displayName: string;
  avatarUrl?: string;
  unitSystem: UnitSystem;
}

// ─── Gym ───────────────────────────────────────────────────────────────────
export interface GymData {
  gymId: string;
  gymName: string;
  isPrivate: boolean;
  joinRequestSent: boolean;
}

// ─── Consents ──────────────────────────────────────────────────────────────
export interface ConsentsData {
  terms: boolean;
  privacy: boolean;
  healthData: boolean;
}

// ─── Full onboarding state ─────────────────────────────────────────────────
export interface OnboardingState {
  step: OnboardingStep;
  auth: Partial<AuthData>;
  profile: Partial<ProfileData>;
  gym: Partial<GymData> | null;
  consents: ConsentsData;
  isSubmitting: boolean;
  submitError: string | null;
}

// ─── Validation ────────────────────────────────────────────────────────────
export interface FieldErrors {
  [field: string]: string;
}
