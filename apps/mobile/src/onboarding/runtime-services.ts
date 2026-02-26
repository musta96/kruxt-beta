import type { OnboardingServices, OnboardingSubmitInput, GymSearchResult } from "./types";
import { createMobileSupabaseClient } from "../services/supabase-client";
import { GymService } from "../services/gym-service";
import { createPhase2OnboardingUiFlow, type OnboardingUiDraft } from "../flows/phase2-onboarding-ui";

export function createOnboardingRuntimeServices(): OnboardingServices {
  try {
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
  } catch (error) {
    // Keep Lovable preview usable when env vars are not available.
    console.warn("[onboarding-runtime] Falling back to preview services:", error);
    return {
      searchGyms: async (query: string): Promise<GymSearchResult[]> => {
        const q = query.trim();
        if (!q) return [];
        return [
          { id: "preview-1", name: `${q} Fitness`, city: "Pavia", isPublic: true },
          { id: "preview-2", name: `${q} Guild Club`, city: "Milan", isPublic: false },
        ];
      },
      submit: async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      },
    };
  }
}

function mapGym(g: { id: string; name: string; city?: string | null; isPublic: boolean }): GymSearchResult {
  return { id: g.id, name: g.name, city: g.city ?? null, isPublic: g.isPublic };
}

function mapToDraft(input: OnboardingSubmitInput): OnboardingUiDraft {
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
      acceptHealthData: consents.acceptHealthData,
    },
    gym: gymDraft,
  };
}
