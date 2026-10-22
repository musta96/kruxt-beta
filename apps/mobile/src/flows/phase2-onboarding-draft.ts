import type { CreateGymInput } from "@kruxt/types";

import type { BaselineConsentInput, BaselinePolicyIds, Phase2OnboardingInput } from "../services";

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
  | { mode: "skip" }
  | { mode: "create"; createGym: CreateGymInput; setAsHomeGym?: boolean }
  | { mode: "join"; gymId: string; setAsHomeGym?: boolean };

export type OnboardingConsentDraft = Omit<
  BaselineConsentInput,
  "termsPolicyId" | "privacyPolicyId" | "healthDataPolicyId"
>;

export interface OnboardingUiDraft {
  auth: OnboardingAuthDraft;
  profile: OnboardingProfileDraft;
  consents: OnboardingConsentDraft;
  reviewedPolicyIds?: BaselinePolicyIds;
  gym: OnboardingGymDraft;
}

export function createDefaultOnboardingUiDraft(): OnboardingUiDraft {
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
      pushNotificationsOptIn: false,
      source: "mobile"
    },
    gym: {
      mode: "skip"
    }
  };
}
