import type { FeatureFlagKey } from "@kruxt/types";

import { guildHallChecklist } from "./flows/guild-hall";
import { phase2OnboardingChecklist } from "./flows/phase2-onboarding";

const defaultEnabledFlags: FeatureFlagKey[] = [
  "provider_apple_health_enabled",
  "provider_garmin_enabled",
  "privacy_requests_enabled",
  "consent_capture_enabled",
  "checkin_access_control_enabled",
  "class_waitlist_enabled"
];

export function mobileAppScaffold() {
  return {
    name: "KRUXT Mobile",
    tagline: "No log, no legend.",
    theme: "guild-premium",
    defaultEnabledFlags,
    phase2: {
      flow: "auth -> profile -> consents -> gym role -> guild hall",
      checklist: [...phase2OnboardingChecklist],
      guildHallChecklist: [...guildHallChecklist],
      rpcEndpoints: [
        "log_workout_atomic",
        "join_waitlist",
        "promote_waitlist_member",
        "submit_privacy_request",
        "record_waiver_acceptance"
      ]
    }
  };
}
