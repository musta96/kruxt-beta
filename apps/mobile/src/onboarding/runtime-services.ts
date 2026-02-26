import type { OnboardingServices, OnboardingSubmitInput, GymSearchResult } from "./types";
import { createMobileSupabaseClient } from "../services/supabase-client";
import { GymService } from "../services/gym-service";
import { createPhase2OnboardingUiFlow } from "../flows/phase2-onboarding-ui";

export function createOnboardingRuntimeServices(): OnboardingServices {
  const supabase = createMobileSupabaseClient();
  const gymService = new GymService(supabase);
  const flow = createPhase2OnboardingUiFlow();

  return {
    searchGyms: async (query: string): Promise<GymSearchResult[]> => {
      const gyms = await gymService.listVisibleGyms(100);
      const q = query.trim().toLowerCase();
      if (!q) return gyms.map(mapGym);
      return gyms.filter((g) => g.name.toLowerCase().includes(q)).map(mapGym);
    },

    submit: async (input: OnboardingSubmitInput): Promise<void> => {
      const draft = mapToDraft(input);
      const result = await flow.submit(draft);
      if (result.ok === false) {
        throw new Error(result.error.message);
      }
    },
  };
}

function mapGym(g: { id: string; name: string; city?: string | null; isPublic: boolean }): GymSearchResult {
  return { id: g.id, name: g.name, city: g.city ?? null, isPublic: g.isPublic };
}

function mapToDraft(input: OnboardingSubmitInput) {
  const auth = input.auth;
  const profile = input.profile;
  const gym = input.gym;
  const consents = input.consents;

  // Map gym draft to flow's expected shape
  const gymDraft =
    gym.mode === "create"
      ? {
          mode: "create" as const,
          createGym: {
            name: gym.createName ?? "",
            slug: gym.createSlug ?? "",
            isPublic: gym.isPublic ?? true,
          },
          setAsHomeGym: true,
        }
      : gym.mode === "join" && gym.gymId
        ? { mode: "join" as const, gymId: gym.gymId, setAsHomeGym: true }
        : { mode: "skip" as const };

  return {
    auth: {
      mode: (auth.mode ?? "signup") as "signup" | "signin",
      email: auth.email ?? "",
      password: auth.password ?? "",
    },
    profile: {
      username: profile.username ?? "",
      displayName: profile.displayName ?? "",
      avatarUrl: profile.avatarUrl,
      preferredUnits: profile.unitSystem,
    },
    consents: {
      acceptTerms: consents.acceptTerms,
      acceptPrivacy: consents.acceptPrivacy,
      acceptHealthDataProcessing: consents.acceptHealthData,
    },
    gym: gymDraft,
  };
}
