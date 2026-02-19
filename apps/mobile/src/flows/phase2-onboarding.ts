import { createMobileSupabaseClient, Phase2OnboardingService } from "../services";
import type { Phase2OnboardingInput, Phase2OnboardingResult } from "../services";

export const phase2OnboardingChecklist = [
  "Authenticate user",
  "Ensure profile exists",
  "Capture baseline consents",
  "Create or join gym",
  "Set home gym"
] as const;

export function createPhase2OnboardingFlow() {
  const supabase = createMobileSupabaseClient();
  const service = new Phase2OnboardingService(supabase);

  return {
    checklist: phase2OnboardingChecklist,
    run: async (input: Phase2OnboardingInput): Promise<Phase2OnboardingResult> => service.run(input)
  };
}
