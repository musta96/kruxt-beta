import type {
  ConsentRecord,
  CreateGymInput,
  GuildHallSnapshot,
  Gym,
  GymMembership,
  Profile,
  UpsertProfileInput
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MobileAuthService, type CredentialsInput } from "./auth-service";
import { KruxtAppError } from "./errors";
import { GymService } from "./gym-service";
import { PolicyService, type BaselineConsentInput } from "./policy-service";
import { ProfileService } from "./profile-service";

const AVATAR_BUCKET =
  (import.meta as { env?: Record<string, string | undefined> }).env?.EXPO_PUBLIC_AVATAR_BUCKET ||
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_AVATAR_BUCKET ||
  (import.meta as { env?: Record<string, string | undefined> }).env?.SUPABASE_AVATAR_BUCKET ||
  "profile-avatars";

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/jpg" || mimeType === "image/jpeg") return "jpg";
  return "bin";
}

export interface OnboardingGymPreference {
  createGym?: CreateGymInput;
  joinGymId?: string;
  setAsHomeGym?: boolean;
}

export interface Phase2OnboardingInput {
  mode: "signup" | "signin";
  credentials: CredentialsInput;
  profile?: Partial<UpsertProfileInput>;
  baselineConsents: BaselineConsentInput;
  gymPreference?: OnboardingGymPreference;
}

export interface Phase2OnboardingResult {
  userId: string;
  profile: Profile;
  consents: ConsentRecord[];
  gym?: Gym;
  membership?: GymMembership;
  guildHall?: GuildHallSnapshot;
}

export class Phase2OnboardingService {
  readonly auth: MobileAuthService;
  readonly profiles: ProfileService;
  readonly policies: PolicyService;
  readonly gyms: GymService;

  constructor(private readonly supabase: SupabaseClient) {
    this.auth = new MobileAuthService(supabase);
    this.profiles = new ProfileService(supabase);
    this.policies = new PolicyService(supabase);
    this.gyms = new GymService(supabase);
  }

  private validateInput(input: Phase2OnboardingInput): void {
    const normalizedEmail = input.credentials.email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      throw new KruxtAppError("ONBOARDING_EMAIL_INVALID", "A valid email address is required.");
    }

    const minPasswordLength = input.mode === "signup" ? 8 : 1;
    if ((input.credentials.password ?? "").length < minPasswordLength) {
      throw new KruxtAppError(
        "ONBOARDING_PASSWORD_INVALID",
        input.mode === "signup"
          ? "Password must be at least 8 characters."
          : "Password is required."
      );
    }

    if (input.gymPreference?.createGym && input.gymPreference?.joinGymId) {
      throw new KruxtAppError(
        "ONBOARDING_GYM_PREFERENCE_INVALID",
        "Onboarding cannot create and join a gym in the same request."
      );
    }
  }

  private isUserAlreadyRegistered(error: unknown): boolean {
    const details = JSON.stringify(error ?? "").toLowerCase();
    return details.includes("already registered") || details.includes("user_already_exists");
  }

  private async uploadAvatarIfNeeded(userId: string, avatarUrl?: string): Promise<string | undefined> {
    const value = avatarUrl?.trim();
    if (!value) return undefined;
    if (!value.startsWith("data:image/")) return value;

    const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!dataUrlMatch) {
      throw new KruxtAppError("AVATAR_UPLOAD_FAILED", "Invalid avatar format.");
    }

    const mimeType = dataUrlMatch[1];
    const base64Payload = dataUrlMatch[2];

    if (typeof atob !== "function") {
      throw new KruxtAppError("AVATAR_UPLOAD_FAILED", "Avatar upload is not supported in this environment.");
    }

    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const extension = extensionFromMimeType(mimeType);
    const path = `users/${userId}/avatar-${Date.now()}.${extension}`;
    const storage = this.supabase.storage.from(AVATAR_BUCKET);
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
      cacheControl: "3600"
    });

    if (uploadError) {
      throw new KruxtAppError(
        "AVATAR_UPLOAD_FAILED",
        `Avatar upload failed. Confirm bucket "${AVATAR_BUCKET}" exists and allows authenticated uploads.`,
        uploadError
      );
    }

    const {
      data: { publicUrl }
    } = storage.getPublicUrl(path);
    if (!publicUrl) {
      throw new KruxtAppError("AVATAR_UPLOAD_FAILED", "Avatar upload succeeded but URL generation failed.");
    }

    return publicUrl;
  }

  async run(input: Phase2OnboardingInput): Promise<Phase2OnboardingResult> {
    this.validateInput(input);
    const credentials: CredentialsInput = {
      email: input.credentials.email.trim().toLowerCase(),
      password: input.credentials.password
    };

    if (input.mode === "signup") {
      try {
        await this.auth.signUpWithPassword(credentials);
      } catch (error) {
        if (!this.isUserAlreadyRegistered(error)) {
          throw error;
        }
      }

      await this.auth.signInWithPassword(credentials);
    } else {
      await this.auth.signInWithPassword(credentials);
    }

    const currentUser = await this.auth.getCurrentUser();
    if (!currentUser) {
      throw new KruxtAppError("AUTH_REQUIRED", "Authentication required.");
    }

    const userId = currentUser.id;
    const userEmail = currentUser.email ?? credentials.email;

    if (input.mode === "signin") {
      const existingProfile = await this.profiles.ensureProfile(userId, userEmail);
      const consents = await this.policies.listUserConsents(userId);
      const guildHall = await this.gyms.getGuildHallSnapshot(userId);

      return {
        userId,
        profile: existingProfile,
        consents,
        guildHall
      };
    }

    const avatarUrl = await this.uploadAvatarIfNeeded(userId, input.profile?.avatarUrl);
    const profile = await this.profiles.ensureProfile(userId, userEmail, {
      ...(input.profile ?? {}),
      avatarUrl
    });
    const policyLocale = input.profile?.locale ?? input.baselineConsents.locale ?? null;
    const localizedPolicies = new PolicyService(this.supabase, { locale: policyLocale });

    const consents = await localizedPolicies.captureBaselineConsents(userId, {
      ...input.baselineConsents,
      locale: input.profile?.locale ?? input.baselineConsents.locale,
      source: "mobile"
    });
    await localizedPolicies.assertRequiredConsents(userId);

    const requiredConsentTypes: Array<ConsentRecord["consentType"]> = [
      "terms",
      "privacy",
      "health_data_processing"
    ];
    const missingRequiredConsentType = requiredConsentTypes.find(
      (consentType) => !consents.some((consent) => consent.consentType === consentType && consent.granted)
    );

    if (missingRequiredConsentType) {
      throw new KruxtAppError(
        "ONBOARDING_CONSENT_CAPTURE_INCOMPLETE",
        "Unable to continue until required baseline consents are recorded.",
        { missingConsentType: missingRequiredConsentType }
      );
    }

    let gym: Gym | undefined;
    let membership: GymMembership | undefined;
    let profileAfterHomeGymUpdate: Profile | undefined;

    if (input.gymPreference?.createGym) {
      const created = await this.gyms.createGymWithLeaderMembership(userId, input.gymPreference.createGym);
      gym = created.gym;
      membership = created.membership;
    } else if (input.gymPreference?.joinGymId) {
      membership = await this.gyms.joinGym(userId, {
        gymId: input.gymPreference.joinGymId
      });
    }

    const shouldSetHomeGym =
      input.gymPreference?.setAsHomeGym ??
      Boolean(input.gymPreference?.createGym);

    if (shouldSetHomeGym) {
      const homeGymId = gym?.id ?? membership?.gymId;
      if (homeGymId) {
        profileAfterHomeGymUpdate = await this.profiles.setHomeGym(userId, homeGymId);
      }
    }

    const finalProfile =
      (await this.profiles.getProfileById(userId)) ??
      profileAfterHomeGymUpdate ??
      profile;
    const expectedHomeGymId = shouldSetHomeGym ? gym?.id ?? membership?.gymId ?? null : null;

    if (expectedHomeGymId && finalProfile.homeGymId !== expectedHomeGymId) {
      throw new KruxtAppError(
        "ONBOARDING_HOME_GYM_NOT_PERSISTED",
        "Home gym could not be confirmed. Please retry this step.",
        {
          expectedHomeGymId,
          actualHomeGymId: finalProfile.homeGymId ?? null
        }
      );
    }

    const guildHall = await this.gyms.getGuildHallSnapshot(userId);

    return {
      userId,
      profile: finalProfile,
      consents,
      gym,
      membership,
      guildHall
    };
  }
}
