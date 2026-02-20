import { createMobileSupabaseClient, Phase2OnboardingService } from "../services";
import type { Phase2OnboardingInput, Phase2OnboardingResult } from "../services";
import { type LegalTranslationKey, translateLegalText } from "@kruxt/types";

const PHASE2_ONBOARDING_CHECKLIST_KEYS = [
  "legal.flow.phase2.authenticate_user",
  "legal.flow.phase2.ensure_profile_exists",
  "legal.flow.phase2.capture_baseline_consents",
  "legal.flow.phase2.create_or_join_gym",
  "legal.flow.phase2.set_home_gym",
  "legal.flow.phase2.load_guild_snapshot"
] as const satisfies readonly LegalTranslationKey[];

export const phase2OnboardingChecklistKeys = [...PHASE2_ONBOARDING_CHECKLIST_KEYS] as const;

export const phase2OnboardingChecklist = phase2OnboardingChecklistKeys.map((key) =>
  translateLegalText(key)
);

export function createPhase2OnboardingFlow(options: { locale?: string | null } = {}) {
  const supabase = createMobileSupabaseClient();
  const service = new Phase2OnboardingService(supabase);
  const checklist = phase2OnboardingChecklistKeys.map((key) =>
    translateLegalText(key, { locale: options.locale })
  );

  return {
    checklist,
    checklistKeys: phase2OnboardingChecklistKeys,
    run: async (input: Phase2OnboardingInput): Promise<Phase2OnboardingResult> => service.run(input)
  };
}
