import type {
  ConsentRecord,
  CreateGymInput,
  Gym,
  GymMembership,
  Profile,
  UpsertProfileInput
} from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MobileAuthService, type CredentialsInput } from "./auth-service";
import { GymService } from "./gym-service";
import { PolicyService, type BaselineConsentInput } from "./policy-service";
import { ProfileService } from "./profile-service";

export interface OnboardingGymPreference {
  createGym?: CreateGymInput;
  joinGymId?: string;
  setAsHomeGym?: boolean;
}

export interface Phase2OnboardingInput {
  mode: "signup" | "signin";
  credentials: CredentialsInput;
  profile: Partial<UpsertProfileInput>;
  baselineConsents: BaselineConsentInput;
  gymPreference?: OnboardingGymPreference;
}

export interface Phase2OnboardingResult {
  userId: string;
  profile: Profile;
  consents: ConsentRecord[];
  gym?: Gym;
  membership?: GymMembership;
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

  async run(input: Phase2OnboardingInput): Promise<Phase2OnboardingResult> {
    if (input.gymPreference?.createGym && input.gymPreference?.joinGymId) {
      throw new Error("Onboarding cannot create and join a gym in the same request.");
    }

    if (input.mode === "signup") {
      await this.auth.signUpWithPassword(input.credentials);
      await this.auth.signInWithPassword(input.credentials);
    } else {
      await this.auth.signInWithPassword(input.credentials);
    }

    const userId = await this.auth.requireCurrentUserId();

    const profile = await this.profiles.ensureProfile(userId, input.credentials.email, input.profile);

    const consents = await this.policies.captureBaselineConsents(userId, {
      ...input.baselineConsents,
      locale: input.profile.locale ?? input.baselineConsents.locale
    });

    let gym: Gym | undefined;
    let membership: GymMembership | undefined;

    if (input.gymPreference?.createGym) {
      const created = await this.gyms.createGymWithLeaderMembership(userId, input.gymPreference.createGym);
      gym = created.gym;
      membership = created.membership;
    } else if (input.gymPreference?.joinGymId) {
      membership = await this.gyms.joinGym(userId, {
        gymId: input.gymPreference.joinGymId
      });
    }

    if (input.gymPreference?.setAsHomeGym) {
      const homeGymId = gym?.id ?? membership?.gymId;
      if (homeGymId) {
        await this.profiles.setHomeGym(userId, homeGymId);
      }
    }

    const finalProfile = await this.profiles.getProfileById(userId);

    return {
      userId,
      profile: finalProfile ?? profile,
      consents,
      gym,
      membership
    };
  }
}
