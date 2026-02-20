import type { CreateGymInput, UpsertProfileInput } from "@kruxt/types";
import { translateLegalText } from "@kruxt/types";

import {
  createMobileSupabaseClient,
  KruxtAppError,
  Phase2OnboardingService,
  type BaselineConsentInput,
  type Phase2OnboardingInput,
  type Phase2OnboardingResult
} from "../services";
import { phase2OnboardingChecklistKeys } from "./phase2-onboarding";

export type OnboardingUiStep = "auth" | "profile" | "consents" | "gym" | "review";

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

export type OnboardingUiSubmitResult = OnboardingUiSuccess | OnboardingUiFailure;

const PHASE2_ONBOARDING_SCREEN_SPECS: readonly OnboardingScreenSpec[] = [
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
    step: "consents",
    title: "Accept the rules",
    subtitle: "Terms, privacy, and health-data consent are required.",
    primaryActionLabel: "Accept and continue"
  },
  {
    step: "gym",
    title: "Join a guild",
    subtitle: "Create a gym or request access to an existing one.",
    primaryActionLabel: "Continue"
  },
  {
    step: "review",
    title: "Finish onboarding",
    subtitle: "Post the proof.",
    primaryActionLabel: "Enter Guild Hall"
  }
] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const errors: OnboardingFieldError[] = [];

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

  if (!draft.profile.displayName.trim()) {
    errors.push({
      field: "profile.displayName",
      message: "Display name is required."
    });
  }

  if (!draft.profile.username.trim()) {
    errors.push({
      field: "profile.username",
      message: "Username is required."
    });
  }

  if (!draft.consents.acceptTerms) {
    errors.push({
      field: "consents.acceptTerms",
      message: "You must accept terms to continue."
    });
  }

  if (!draft.consents.acceptPrivacy) {
    errors.push({
      field: "consents.acceptPrivacy",
      message: "You must accept privacy policy to continue."
    });
  }

  if (!draft.consents.acceptHealthData) {
    errors.push({
      field: "consents.acceptHealthData",
      message: "You must accept health-data processing to continue."
    });
  }

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

function mapRuntimeError(error: unknown): OnboardingUiError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("ONBOARDING_SUBMIT_FAILED", "Unable to complete onboarding.", error);

  const step = mapErrorToStep(appError.code);
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

export function createPhase2OnboardingUiFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const onboarding = new Phase2OnboardingService(supabase);
  const checklist = phase2OnboardingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase2OnboardingChecklistKeys,
    screens: [...PHASE2_ONBOARDING_SCREEN_SPECS],
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
