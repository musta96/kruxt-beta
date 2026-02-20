// Onboarding flow types — mirrors apps/mobile/src/flows/phase2-onboarding-ui.ts
// but adapted for web React (no mobile-specific imports).

export type OnboardingStep = "welcome" | "auth" | "profile" | "gym" | "consents" | "complete";

export interface OnboardingAuthDraft {
  mode: "signup" | "signin";
  email: string;
  password: string;
}

export interface OnboardingProfileDraft {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  locale?: string;
  preferredUnits: "metric" | "imperial";
}

export type OnboardingGymDraft =
  | { mode: "skip" }
  | { mode: "create"; name: string; slug: string; isPublic: boolean; city?: string }
  | { mode: "join"; gymId: string; gymName: string; isPrivate: boolean };

export interface OnboardingConsentsDraft {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptHealthData: boolean;
  marketingEmailOptIn: boolean;
  pushNotificationsOptIn: boolean;
}

export interface OnboardingDraft {
  auth: OnboardingAuthDraft;
  profile: OnboardingProfileDraft;
  gym: OnboardingGymDraft;
  consents: OnboardingConsentsDraft;
}

export interface OnboardingFieldError {
  field: string;
  message: string;
}

export const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "auth",
  "profile",
  "gym",
  "consents",
  "complete",
];

export const STEP_INDEX: Record<OnboardingStep, number> = {
  welcome: 0,
  auth: 1,
  profile: 2,
  gym: 3,
  consents: 4,
  complete: 5,
};

export const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  auth: "Account",
  profile: "Profile",
  gym: "Guild",
  consents: "Consent",
  complete: "Ready",
};

export const DEFAULT_DRAFT: OnboardingDraft = {
  auth: { mode: "signup", email: "", password: "" },
  profile: {
    username: "",
    displayName: "",
    preferredUnits: "metric",
  },
  gym: { mode: "skip" },
  consents: {
    acceptTerms: false,
    acceptPrivacy: false,
    acceptHealthData: false,
    marketingEmailOptIn: false,
    pushNotificationsOptIn: true,
  },
};

// Validation — mirrors validateDraft from phase2-onboarding-ui.ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(
  step: OnboardingStep,
  draft: OnboardingDraft
): OnboardingFieldError[] {
  const errors: OnboardingFieldError[] = [];

  if (step === "auth") {
    if (!EMAIL_PATTERN.test(draft.auth.email.trim())) {
      errors.push({ field: "auth.email", message: "Enter a valid email address." });
    }
    const minLen = draft.auth.mode === "signup" ? 8 : 1;
    if (draft.auth.password.length < minLen) {
      errors.push({
        field: "auth.password",
        message:
          draft.auth.mode === "signup"
            ? "Password must be at least 8 characters."
            : "Password is required.",
      });
    }
  }

  if (step === "profile") {
    if (!draft.profile.displayName.trim()) {
      errors.push({ field: "profile.displayName", message: "Display name is required." });
    }
    if (!draft.profile.username.trim()) {
      errors.push({ field: "profile.username", message: "Username is required." });
    }
    const usernameClean = draft.profile.username.trim();
    if (usernameClean && !/^[a-z0-9_]{3,24}$/.test(usernameClean)) {
      errors.push({
        field: "profile.username",
        message: "Username: 3–24 chars, lowercase, numbers and underscores only.",
      });
    }
  }

  if (step === "gym") {
    if (draft.gym.mode === "create") {
      if (!draft.gym.name.trim()) {
        errors.push({ field: "gym.create.name", message: "Gym name is required." });
      }
      if (!draft.gym.slug.trim()) {
        errors.push({ field: "gym.create.slug", message: "Gym slug is required." });
      }
    }
    if (draft.gym.mode === "join" && !draft.gym.gymId.trim()) {
      errors.push({ field: "gym.join.gymId", message: "Select a gym to request membership." });
    }
  }

  if (step === "consents") {
    if (!draft.consents.acceptTerms) {
      errors.push({
        field: "consents.acceptTerms",
        message: "Rank requires consent to current policy.",
      });
    }
    if (!draft.consents.acceptPrivacy) {
      errors.push({
        field: "consents.acceptPrivacy",
        message: "Rank requires consent to current policy.",
      });
    }
    if (!draft.consents.acceptHealthData) {
      errors.push({
        field: "consents.acceptHealthData",
        message: "Rank requires consent to current policy.",
      });
    }
  }

  return errors;
}
