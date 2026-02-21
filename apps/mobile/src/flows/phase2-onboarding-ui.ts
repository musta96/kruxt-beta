import type { CreateGymInput, Gym, PolicyVersion, UpsertProfileInput } from "@kruxt/types";
import { translateLegalText } from "@kruxt/types";

import {
  createMobileSupabaseClient,
  GymService,
  KruxtAppError,
  Phase2OnboardingService,
  PolicyService,
  type BaselineConsentInput,
  type Phase2OnboardingInput,
  type Phase2OnboardingResult
} from "../services";
import { phase2OnboardingChecklistKeys } from "./phase2-onboarding";

export type OnboardingUiStep = "welcome" | "auth" | "profile" | "gym" | "consents" | "review";

export const onboardingUiStepOrder = ["welcome", "auth", "profile", "gym", "consents", "review"] as const;

export interface OnboardingScreenSpec {
  step: OnboardingUiStep;
  title: string;
  subtitle: string;
  primaryActionLabel: string;
}

export interface OnboardingAuthDraft {
  mode: Phase2OnboardingInput["mode"];
  email: string;
  password: string;
}

export interface OnboardingProfileDraft {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  locale?: string;
  preferredUnits?: "metric" | "imperial";
}

export type OnboardingGymDraft =
  | {
      mode: "skip";
    }
  | {
      mode: "create";
      createGym: CreateGymInput;
      setAsHomeGym?: boolean;
    }
  | {
      mode: "join";
      gymId: string;
      setAsHomeGym?: boolean;
    };

export interface OnboardingUiDraft {
  auth: OnboardingAuthDraft;
  profile: OnboardingProfileDraft;
  consents: BaselineConsentInput;
  gym: OnboardingGymDraft;
}

export interface OnboardingUiPolicySnapshot {
  activePolicies: PolicyVersion[];
  termsPolicy: PolicyVersion | null;
  privacyPolicy: PolicyVersion | null;
  healthDataPolicy: PolicyVersion | null;
}

export interface OnboardingUiGymOption {
  id: Gym["id"];
  slug: Gym["slug"];
  name: Gym["name"];
  city: Gym["city"];
  motto: Gym["motto"];
  isPublic: Gym["isPublic"];
}

export interface OnboardingUiMicrocopy {
  proofCounts: string;
  consentGate: string;
  profileGate: string;
}

export interface OnboardingUiLoadSnapshot {
  stepOrder: readonly OnboardingUiStep[];
  screens: readonly OnboardingScreenSpec[];
  defaultDraft: OnboardingUiDraft;
  policies: OnboardingUiPolicySnapshot;
  gymSuggestions: OnboardingUiGymOption[];
  microcopy: OnboardingUiMicrocopy;
}

export interface OnboardingFieldError {
  field: string;
  message: string;
}

export interface OnboardingUiError {
  code: string;
  step: OnboardingUiStep;
  message: string;
  recoverable: boolean;
  fieldErrors: OnboardingFieldError[];
}

export interface OnboardingUiSuccess {
  ok: true;
  result: Phase2OnboardingResult;
  nextRoute: "guild_hall";
}

export interface OnboardingUiFailure {
  ok: false;
  error: OnboardingUiError;
}

export interface OnboardingUiLoadSuccess {
  ok: true;
  snapshot: OnboardingUiLoadSnapshot;
}

export interface OnboardingUiLoadFailure {
  ok: false;
  error: OnboardingUiError;
}

export type OnboardingUiLoadResult = OnboardingUiLoadSuccess | OnboardingUiLoadFailure;
export type OnboardingUiSubmitResult = OnboardingUiSuccess | OnboardingUiFailure;

const PHASE2_ONBOARDING_SCREEN_SPECS: readonly OnboardingScreenSpec[] = [
  {
    step: "welcome",
    title: "Proof counts.",
    subtitle: "Log to claim. Rank is earned weekly.",
    primaryActionLabel: "Log to claim"
  },
  {
    step: "auth",
    title: "Claim your profile",
    subtitle: "Proof counts. Start with your account.",
    primaryActionLabel: "Continue"
  },
  {
    step: "profile",
    title: "Set your identity",
    subtitle: "Choose how your guild sees your progress.",
    primaryActionLabel: "Save profile"
  },
  {
    step: "gym",
    title: "Join a guild",
    subtitle: "Create a gym or request access to an existing one.",
    primaryActionLabel: "Continue"
  },
  {
    step: "consents",
    title: "Accept the rules",
    subtitle: "Terms, privacy, and health-data consent are required.",
    primaryActionLabel: "Accept and continue"
  },
  {
    step: "review",
    title: "Finish onboarding",
    subtitle: "Post the proof.",
    primaryActionLabel: "Enter Guild Hall"
  }
] as const;

const PHASE2_ONBOARDING_MICROCOPY: OnboardingUiMicrocopy = {
  proofCounts: "Proof counts.",
  consentGate: "Rank requires consent to current policy.",
  profileGate: "Guild access starts when profile is complete."
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

function createDefaultDraft(): OnboardingUiDraft {
  return {
    auth: {
      mode: "signup",
      email: "",
      password: ""
    },
    profile: {
      username: "",
      displayName: "",
      preferredUnits: "metric"
    },
    consents: {
      acceptTerms: false,
      acceptPrivacy: false,
      acceptHealthData: false,
      marketingEmailOptIn: false,
      pushNotificationsOptIn: true,
      source: "mobile"
    },
    gym: {
      mode: "skip"
    }
  };
}

function inferStepFromField(field: string): OnboardingUiStep {
  if (field.startsWith("auth.")) {
    return "auth";
  }

  if (field.startsWith("profile.")) {
    return "profile";
  }

  if (field.startsWith("consents.")) {
    return "consents";
  }

  if (field.startsWith("gym.")) {
    return "gym";
  }

  return "review";
}

function sanitizeProfileDraft(draft: OnboardingProfileDraft): Partial<UpsertProfileInput> {
  return {
    username: draft.username.trim(),
    displayName: draft.displayName.trim(),
    avatarUrl: draft.avatarUrl?.trim() || undefined,
    bio: draft.bio?.trim() || undefined,
    locale: draft.locale?.trim() || undefined,
    preferredUnits: draft.preferredUnits
  };
}

function toGymPreference(gym: OnboardingGymDraft): Phase2OnboardingInput["gymPreference"] {
  if (gym.mode === "create") {
    return {
      createGym: gym.createGym,
      setAsHomeGym: gym.setAsHomeGym ?? true
    };
  }

  if (gym.mode === "join") {
    return {
      joinGymId: gym.gymId,
      setAsHomeGym: gym.setAsHomeGym ?? true
    };
  }

  return undefined;
}

function toServiceInput(draft: OnboardingUiDraft): Phase2OnboardingInput {
  const profile = sanitizeProfileDraft(draft.profile);

  return {
    mode: draft.auth.mode,
    credentials: {
      email: draft.auth.email.trim(),
      password: draft.auth.password
    },
    profile,
    baselineConsents: {
      ...draft.consents,
      locale: profile.locale ?? draft.consents.locale
    },
    gymPreference: toGymPreference(draft.gym)
  };
}

function validateDraft(draft: OnboardingUiDraft): OnboardingFieldError[] {
  const errors: OnboardingFieldError[] = [
    ...validateStep("auth", draft),
    ...validateStep("profile", draft),
    ...validateStep("gym", draft),
    ...validateStep("consents", draft)
  ];
  return errors;
}

export function validateStep(step: OnboardingUiStep, draft: OnboardingUiDraft): OnboardingFieldError[] {
  const errors: OnboardingFieldError[] = [];

  if (step === "welcome" || step === "review") {
    return errors;
  }

  if (step === "auth") {
    if (!emailPattern.test(draft.auth.email.trim())) {
      errors.push({
        field: "auth.email",
        message: "Enter a valid email address."
      });
    }

    const minPasswordLength = draft.auth.mode === "signup" ? 8 : 1;
    if (draft.auth.password.length < minPasswordLength) {
      errors.push({
        field: "auth.password",
        message:
          draft.auth.mode === "signup"
            ? "Password must be at least 8 characters."
            : "Password is required."
      });
    }
  }

  if (step === "profile") {
    if (!draft.profile.displayName.trim()) {
      errors.push({
        field: "profile.displayName",
        message: "Display name is required."
      });
    }

    const username = draft.profile.username.trim();
    if (!username) {
      errors.push({
        field: "profile.username",
        message: "Username is required."
      });
    } else if (!usernamePattern.test(username)) {
      errors.push({
        field: "profile.username",
        message: "Username: 3-24 chars, lowercase, numbers and underscores only."
      });
    }
  }

  if (step === "gym") {
    if (draft.gym.mode === "create") {
      if (!draft.gym.createGym.name.trim()) {
        errors.push({
          field: "gym.create.name",
          message: "Gym name is required."
        });
      }

      if (!draft.gym.createGym.slug.trim()) {
        errors.push({
          field: "gym.create.slug",
          message: "Gym slug is required."
        });
      }
    }

    if (draft.gym.mode === "join" && !draft.gym.gymId.trim()) {
      errors.push({
        field: "gym.join.gymId",
        message: "Select a gym to request membership."
      });
    }
  }

  if (step === "consents") {
    if (!draft.consents.acceptTerms) {
      errors.push({
        field: "consents.acceptTerms",
        message: PHASE2_ONBOARDING_MICROCOPY.consentGate
      });
    }

    if (!draft.consents.acceptPrivacy) {
      errors.push({
        field: "consents.acceptPrivacy",
        message: PHASE2_ONBOARDING_MICROCOPY.consentGate
      });
    }

    if (!draft.consents.acceptHealthData) {
      errors.push({
        field: "consents.acceptHealthData",
        message: PHASE2_ONBOARDING_MICROCOPY.consentGate
      });
    }
  }

  return errors;
}

function mapErrorToStep(code: string): OnboardingUiStep {
  if (
    [
      "ONBOARDING_EMAIL_INVALID",
      "ONBOARDING_PASSWORD_INVALID",
      "AUTH_SIGNIN_FAILED",
      "AUTH_SIGNUP_FAILED",
      "AUTH_GET_USER_FAILED",
      "AUTH_REQUIRED"
    ].includes(code)
  ) {
    return "auth";
  }

  if (
    [
      "PROFILE_READ_FAILED",
      "PROFILE_UPSERT_FAILED",
      "PROFILE_USERNAME_COLLISION",
      "PROFILE_NOT_FOUND"
    ].includes(code)
  ) {
    return "profile";
  }

  if (
    [
      "POLICIES_READ_FAILED",
      "BASELINE_CONSENT_REQUIRED",
      "CONSENT_RECORD_FAILED",
      "CONSENT_GAPS_READ_FAILED",
      "CONSENT_GATE_CHECK_FAILED",
      "ONBOARDING_CONSENT_CAPTURE_INCOMPLETE",
      "RECONSENT_REQUIRED",
      "POLICY_BASELINE_MISSING"
    ].includes(code)
  ) {
    return "consents";
  }

  if (
    [
      "GYM_LIST_FAILED",
      "GYM_CREATE_FAILED",
      "GYM_JOIN_FAILED",
      "GYM_SLUG_INVALID",
      "GYM_SLUG_CONFLICT",
      "PROFILE_HOME_GYM_UPDATE_FAILED",
      "ONBOARDING_HOME_GYM_NOT_PERSISTED"
    ].includes(code)
  ) {
    return "gym";
  }

  return "review";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "AUTH_SIGNIN_FAILED") {
    return "Sign in failed. Verify email and password, then retry.";
  }

  if (code === "AUTH_SIGNUP_FAILED") {
    return "Sign up failed. Retry in a moment.";
  }

  if (code === "PROFILE_USERNAME_COLLISION") {
    return "That username is unavailable. Try another username.";
  }

  if (code === "BASELINE_CONSENT_REQUIRED") {
    return translateLegalText("legal.error.baseline_consent_required");
  }

  if (code === "RECONSENT_REQUIRED") {
    return translateLegalText("legal.error.reconsent_required_action");
  }

  if (code === "POLICY_BASELINE_MISSING") {
    return "Legal policy records are not available right now. Try again shortly.";
  }

  if (code === "GYM_JOIN_FAILED") {
    return "Membership request failed. Retry after refreshing the gym list.";
  }

  if (code === "ONBOARDING_HOME_GYM_NOT_PERSISTED") {
    return "Home gym was not saved. Retry this step.";
  }

  return fallback;
}

function mapRuntimeError(error: unknown, fallbackStep: OnboardingUiStep = "review"): OnboardingUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("ONBOARDING_SUBMIT_FAILED", "Unable to complete onboarding.", error);

  const step = appError.code === "ONBOARDING_LOAD_FAILED" ? fallbackStep : mapErrorToStep(appError.code);
  const message = mapErrorMessage(appError.code, appError.message);
  const recoverable = appError.code !== "POLICY_BASELINE_MISSING";

  return {
    code: appError.code,
    step,
    message,
    recoverable,
    fieldErrors: []
  };
}

function toGymOptions(gyms: Gym[]): OnboardingUiGymOption[] {
  return [...gyms]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((gym) => ({
      id: gym.id,
      slug: gym.slug,
      name: gym.name,
      city: gym.city,
      motto: gym.motto,
      isPublic: gym.isPublic
    }));
}

function resolvePolicySnapshot(policies: PolicyVersion[]): OnboardingUiPolicySnapshot {
  const termsPolicy = policies.find((policy) => policy.policyType === "terms") ?? null;
  const privacyPolicy = policies.find((policy) => policy.policyType === "privacy") ?? null;
  const healthDataPolicy = policies.find((policy) => policy.policyType === "health_data") ?? null;

  return {
    activePolicies: policies,
    termsPolicy,
    privacyPolicy,
    healthDataPolicy
  };
}

export function createPhase2OnboardingUiFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const onboarding = new Phase2OnboardingService(supabase);
  const policies = new PolicyService(supabase, { locale: options.locale });
  const gyms = new GymService(supabase);
  const checklist = phase2OnboardingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase2OnboardingChecklistKeys,
    stepOrder: onboardingUiStepOrder,
    screens: [...PHASE2_ONBOARDING_SCREEN_SPECS],
    microcopy: { ...PHASE2_ONBOARDING_MICROCOPY },
    createDraft: (overrides: Partial<OnboardingUiDraft> = {}): OnboardingUiDraft => ({
      ...createDefaultDraft(),
      ...overrides,
      auth: { ...createDefaultDraft().auth, ...overrides.auth },
      profile: { ...createDefaultDraft().profile, ...overrides.profile },
      consents: { ...createDefaultDraft().consents, ...overrides.consents },
      gym: (overrides.gym ?? createDefaultDraft().gym) as OnboardingGymDraft
    }),
    load: async (): Promise<OnboardingUiLoadResult> => {
      try {
        const [activePolicies, visibleGyms] = await Promise.all([
          policies.listActivePolicies(),
          gyms.listVisibleGyms(24)
        ]);

        return {
          ok: true,
          snapshot: {
            stepOrder: onboardingUiStepOrder,
            screens: [...PHASE2_ONBOARDING_SCREEN_SPECS],
            defaultDraft: createDefaultDraft(),
            policies: resolvePolicySnapshot(activePolicies),
            gymSuggestions: toGymOptions(visibleGyms),
            microcopy: { ...PHASE2_ONBOARDING_MICROCOPY }
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: mapRuntimeError(
            new KruxtAppError("ONBOARDING_LOAD_FAILED", "Unable to load onboarding context.", error),
            "welcome"
          )
        };
      }
    },
    validateStep: (step: OnboardingUiStep, draft: OnboardingUiDraft): OnboardingFieldError[] =>
      validateStep(step, draft),
    validate: (draft: OnboardingUiDraft): OnboardingFieldError[] => validateDraft(draft),
    submit: async (draft: OnboardingUiDraft): Promise<OnboardingUiSubmitResult> => {
      const fieldErrors = validateDraft(draft);

      if (fieldErrors.length > 0) {
        return {
          ok: false,
          error: {
            code: "ONBOARDING_VALIDATION_FAILED",
            step: inferStepFromField(fieldErrors[0]?.field ?? "review"),
            message: "Review highlighted fields and retry.",
            recoverable: true,
            fieldErrors
          }
        };
      }

      try {
        const result = await onboarding.run(toServiceInput(draft));
        return {
          ok: true,
          result,
          nextRoute: "guild_hall"
        };
      } catch (error) {
        return {
          ok: false,
          error: mapRuntimeError(error)
        };
      }
    }
  };
}
